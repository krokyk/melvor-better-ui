const storageKey = "equipment-loadout-references";

function encode(value) {
  return btoa(fflate.strFromU8(fflate.gzipSync(fflate.strToU8(JSON.stringify(value))), true));
}

function decode(value) {
  if (value === undefined || value === null) return [];
  const saved = typeof value === "string" ? JSON.parse(fflate.strFromU8(fflate.gunzipSync(fflate.strToU8(atob(value), true)))) : value;
  if (saved?.version !== 1 || !Array.isArray(saved.presets)) throw new Error("Saved equipment references are invalid or use an unsupported format.");
  return saved.presets.map(preset => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) throw new Error("An equipment preset is invalid.");
    const entries = Object.entries(preset);
    if (entries.some(([slot, item]) => !slot || typeof item !== "string" || !item)) throw new Error("An equipment reference is invalid.");
    return Object.fromEntries(entries);
  });
}

export function installEquipmentLoadouts(ctx, game, planner, applyEquipmentTransaction, prepareQuickEquipCopy) {
  const player = game.combat.player, Player = player.constructor;
  let presets = [], ready = false, busy = false, failure, restoreAfterLoad = false;
  const projections = new Map();
  const roots = equipment => equipment.equippedArray.filter(entry => !entry.isEmpty && entry.occupiedBy === undefined)
    .map(({ slot, item, quantity }) => ({ slot, item, quantity }));
  function notify(message) {
    if (typeof notifyPlayer === "function") notifyPlayer(game.attack, message, "danger");
    else console.warn(`[Better UI] ${message}`);
  }
  function disable(error) {
    failure = error; ready = false;
    console.error("[Better UI] Equipment loadouts unavailable; native inventory was retained.", error);
    notify(`Equipment loadouts unavailable: ${error.message}`);
  }
  function store(next) {
    ctx.characterStorage.setItem(storageKey, encode({ version: 1, presets: next }));
    presets = next; projections.clear();
  }
  function restoreStorage(previous) {
    if (previous === undefined) ctx.characterStorage.removeItem(storageKey);
    else ctx.characterStorage.setItem(storageKey, previous);
  }
  function ensurePreset(index) {
    while (presets.length <= index) presets.push({});
    return presets[index];
  }
  function desired(index, preset = ensurePreset(index)) {
    return Object.entries(preset).map(([slotID, itemID]) => {
      const slot = game.equipmentSlots.getObjectByID(slotID), item = game.items.getObjectByID(itemID);
      if (!slot || !item) throw new Error(`Equipment reference is unavailable: ${itemID} in ${slotID}.`);
      return { slot, item };
    });
  }
  function bankSnapshot(entries) {
    return new Map(entries.map(({ item }) => [item, game.bank.getQty(item)]));
  }
  function checkBankSpace(finalBank) {
    let additionalSlots = 0;
    for (const [item, quantity] of finalBank) additionalSlots += Number(quantity > 0) - Number(game.bank.getQty(item) > 0);
    if (additionalSlots > 0 && game.bank.occupiedSlots + additionalSlots > game.bank.maximumSlots)
      throw new Error("There is not enough Bank space for the resulting equipment change.");
  }
  function projection(index) {
    if (index === player.selectedEquipmentSet) return player.equipment;
    if (!projections.has(index)) {
      const equipment = new Equipment(game);
      for (const { slot, item } of desired(index)) equipment.equipItem(item, slot, 1);
      projections.set(index, equipment);
    }
    return projections.get(index);
  }
  function validateTarget(entries) {
    const equipment = new Equipment(game);
    for (const { slot, item, quantity } of entries) {
      if (!player.isEquipmentSlotUnlocked(slot) || !game.checkRequirements(item.equipRequirements, true))
        throw new Error(`Equipment requirements are not met for ${item.name ?? item.id}.`);
      equipment.equipItem(item, slot, quantity);
    }
    const restrictions = player.manager.getEquipmentRestrictions();
    if (!player.checkDamageTypeEquipRestrictions(restrictions, player.getEquipmentDamageType(equipment)) ||
        !player.checkSlayerItemEquipRestrictionsOnEquipSetChange(restrictions, equipment)) return false;
    if (restrictions.areaItems?.some(item => !equipment.checkForItem(item))) {
      notify("This loadout does not contain the equipment required in the current area.");
      return false;
    }
    return true;
  }
  function setReference(preset, slot, item) {
    const claimed = new Set([slot.id, ...(item.occupiesSlots ?? []).map(occupied => occupied.id)]);
    for (const [oldSlot, oldID] of Object.entries(preset)) {
      const oldItem = game.items.getObjectByID(oldID);
      if (oldID === item.id || claimed.has(oldSlot) || oldItem?.occupiesSlots?.some(occupied => claimed.has(occupied.id))) delete preset[oldSlot];
    }
    preset[slot.id] = item.id;
  }
  function rememberItem(index, slot, item) {
    const next = presets.map(preset => ({ ...preset }));
    while (next.length <= index) next.push({});
    setReference(next[index], slot, item);
    store(next);
    player.renderQueue.equipmentSets = true;
  }
  function initialize() {
    ready = false; failure = undefined;
    let previous, stored = false;
    try {
      previous = ctx.characterStorage.getItem(storageKey);
      const next = decode(previous), sets = player.equipmentSets.map(set => roots(set.equipment));
      while (next.length < sets.length) next.push({});
      sets.forEach((entries, index) => { for (const { slot, item } of entries) setReference(next[index], slot, item); });
      const migration = planner.planMigration(sets, player.selectedEquipmentSet, bankSnapshot(sets.flat()));
      checkBankSpace(migration.bank);
      store(next); stored = true;
      busy = true;
      const changes = migration.clearSets.filter(index => sets[index].length).map(index => ({ equipment: player.equipmentSets[index].equipment, entries: [] }));
      if (changes.length) applyEquipmentTransaction(game, changes, migration.bank, () => { ready = true; });
      ready = true;
      player.renderQueue.equipmentSets = true;
    } catch (error) {
      if (stored && !error.ownershipCommitted) {
        try { restoreStorage(previous); } catch (storageError) { console.error("[Better UI] Could not restore equipment reference data.", storageError); }
      }
      disable(error);
    } finally { busy = false; }
  }

  function applyLoadout(index, copiedPreset, copySource) {
    if (player.checkIfCantEquip()) return false;
    const source = player.selectedEquipmentSet;
    const previousPresets = presets;
    let published = false, fallback, previousStorage, stored = false, success = false, quickCopy, quickCopyStarted = false, shortcuts;
    try {
      const active = roots(player.equipment), requested = desired(index, copiedPreset);
      const plan = planner.planLoadout(active, requested, bankSnapshot([...active, ...requested]));
      checkBankSpace(plan.bank);
      if (!validateTarget(plan.equipment)) return false;
      const changes = index === source ? [{ equipment: player.equipment, entries: plan.equipment }]
        : [{ equipment: player.equipmentSets[source].equipment, entries: [] },
          { equipment: player.equipmentSets[index].equipment, entries: plan.equipment }];
      busy = true;
      if (copiedPreset !== undefined) {
        const sourceSlots = player.equipmentSets[copySource].equipment.equippedItems;
        shortcuts = player.equipmentSets[index].equipment.equippedArray.map(equipped => ({
          equipped, previous: equipped.quickEquipItems, copied: sourceSlots[equipped.slot.id].quickEquipItems.slice(),
        }));
        quickCopy = prepareQuickEquipCopy?.(copySource, index);
        previousStorage = ctx.characterStorage.getItem(storageKey);
        const next = presets.slice(); next[index] = { ...copiedPreset };
        store(next); stored = true;
        if (quickCopy) { quickCopyStarted = true; quickCopy.apply(); }
        for (const { equipped, copied } of shortcuts) equipped.quickEquipItems = copied;
      }
      applyEquipmentTransaction(game, changes, plan.bank, () => {
        player.selectedEquipmentSet = index;
        published = true;
        player.updateForEquipmentChange();
        for (const key of ["prayerSelection", "attackSpellSelection", "auroraSelection", "curseSelection", "runesUsed"])
          player.renderQueue[key] = true;
        player.renderQueue.equipmentSets = true;
      });
      if (typeof ItemEquippedEvent === "function") for (const { item, quantity } of plan.equipment)
        player._events.emit("itemEquipped", new ItemEquippedEvent(item, quantity));
      if (player.selectedEquipmentSet !== index) fallback = player.selectedEquipmentSet;
      success = true;
    } catch (error) {
      if (!published && !error.ownershipCommitted) {
        if (shortcuts) for (const { equipped, previous } of shortcuts) equipped.quickEquipItems = previous;
        if (quickCopyStarted) { try { quickCopy.rollback(); } catch (storageError) { disable(storageError); } }
      }
      if (stored && !published && !error.ownershipCommitted) {
        presets = previousPresets; projections.clear();
        try { restoreStorage(previousStorage); } catch (storageError) { disable(storageError); }
      }
      if (published || error.ownershipCommitted) disable(error);
      else notify(error.message);
    } finally { busy = false; }
    if (fallback !== undefined && ready) player.changeEquipmentSet(fallback);
    return success;
  }
  function copyFrom(index) {
    if (!ready || busy || !Number.isInteger(index) || index < 0 || index >= player.equipmentSets.length || index === player.selectedEquipmentSet) return false;
    return applyLoadout(player.selectedEquipmentSet, { ...ensurePreset(index) }, index);
  }
  ctx.patch(Player, "changeEquipmentSet").replace(function (original, index) {
    if (this === player && busy && ready) {
      if (player.selectedEquipmentSet >= player.equipmentSets.length) return original(index);
      notify("An equipment change is already in progress."); return;
    }
    if (this !== player || !ready) {
      if (this === player && failure && !busy) { notify(failure.message); return; }
      return original(index);
    }
    if (!Number.isInteger(index) || index < 0 || index >= player.equipmentSets.length) return original(index);
    return applyLoadout(index);
  });
  ctx.patch(Player, "equipItem").replace(function (original, item, index, slot = item.validSlots[0], quantity = 1) {
    if (this !== player || !ready) return original(item, index, slot, quantity);
    if (busy && index !== player.selectedEquipmentSet) return false;
    if (!Number.isInteger(index) || index < 0 || index >= player.equipmentSets.length) return original(item, index, slot, quantity);
    if (index !== player.selectedEquipmentSet) {
      try {
        if (!player.isEquipmentSlotUnlocked(slot) || !item.fitsInSlot(slot.id) || !game.checkRequirements(item.equipRequirements, true) ||
            game.bank.getQty(item) + player.equipment.getQuantityOfItem(item) < 1) return false;
        rememberItem(index, slot, item); player.updateForEquipSetChange(); return true;
      } catch (error) { notify(error.message); return false; }
    }
    const result = original(item, index, slot, quantity);
    if (result) { try { rememberItem(index, slot, item); } catch (error) { disable(error); } }
    return result;
  });
  ctx.patch(Player, "unequipItem").replace(function (original, index, slot) {
    if (this !== player || !ready) return original(index, slot);
    if (busy && index !== player.selectedEquipmentSet) return false;
    if (!Number.isInteger(index) || index < 0 || index >= player.equipmentSets.length) return false;
    if (index !== player.selectedEquipmentSet) {
      try {
        const preset = { ...ensurePreset(index) };
        const root = Object.keys(preset).find(slotID => slotID === slot.id ||
          game.items.getObjectByID(preset[slotID])?.occupiesSlots?.some(occupied => occupied.id === slot.id));
        if (root !== undefined) delete preset[root];
        const next = presets.slice(); next[index] = preset; store(next);
        player.updateForEquipSetChange(); return true;
      } catch (error) { notify(error.message); return false; }
    }
    const root = player.equipment.getRootSlot(slot), result = original(index, slot);
    if (result) {
      try { const next = presets.map(preset => ({ ...preset })); delete next[index][root.id]; store(next); }
      catch (error) { disable(error); }
    }
    return result;
  });
  ctx.patch(Player, "equipToSetEquipment").get(function (original) {
    if (this !== player || !ready || busy) return original();
    try { return projection(player.equipToSet); } catch { return original(); }
  });
  if (typeof EquipmentSetMenu === "function") ctx.patch(EquipmentSetMenu, "getTooltipContent").replace(function (original, set) {
    if (!ready) return original(set);
    const index = player.equipmentSets.indexOf(set);
    if (index < 0 || index === player.selectedEquipmentSet) return original(set);
    try { return original({ ...set, equipment: projection(index) }); } catch { return original(set); }
  });
  if (typeof EquipmentSetMenu === "function" && typeof EquipmentSetMenu.prototype.render === "function") {
    const menus = new WeakMap();
    ctx.onInterfaceReady(() => {
      const style = document.createElement("style");
      style.textContent = `
        .row.kroky-equipment-set-row-shell { margin-left: 0; margin-right: 0; padding-left: 0 !important; padding-right: 0 !important; }
        .kroky-equipment-set-copy-enabled { display: flex; align-items: flex-end; justify-content: space-around; flex-wrap: wrap; row-gap: 2.15rem; column-gap: 0; padding: 2.15rem 0 .5rem; }
        .kroky-equipment-set-switch, .kroky-equipment-set-copy { display: flex; flex-direction: column; align-items: center; position: relative; margin: 0; }
        .kroky-equipment-set-heading { font-size: .875rem; font-weight: 400; line-height: 1.25rem; margin: 0 0 .4rem !important; color: inherit; }
        .kroky-equipment-set-copy-enabled .kroky-equipment-set-heading { position: absolute; bottom: calc(100% + .4rem); left: 50%; transform: translateX(-50%); white-space: nowrap; width: max-content; margin: 0 !important; }
        .kroky-equipment-set-heading small { font-size: inherit; }
        .kroky-equipment-set-switch > [id] { margin: 0 !important; }
        .kroky-equipment-set-copy select { width: 5rem; margin: 0; }
        .kroky-equipment-set-copy[hidden] { display: none; }
      `;
      document.head.append(style);
      player.renderQueue.equipmentSets = true;
    });
    ctx.patch(EquipmentSetMenu, "render").after(function (_result, sets, selected, owner) {
      const id = this.container.id;
      if (id !== "combat-equipment-set-menu-0" && id !== "combat-equipment-set-menu-1") return;
      let view = menus.get(this);
      if (!view) {
        const row = document.getElementById(id.replace("menu", "container"));
        const heading = row?.querySelector("h5, small");
        if (!heading) return;
        if (id.endsWith("-0")) row.parentElement?.classList.add("kroky-equipment-set-row-shell");
        const switching = document.createElement("div"), copy = document.createElement("label"), label = document.createElement("span");
        const select = document.createElement("select");
        switching.className = "kroky-equipment-set-switch";
        copy.className = "kroky-equipment-set-copy";
        heading.classList.add("kroky-equipment-set-heading");
        label.className = `kroky-equipment-set-heading${id.endsWith("-1") ? " text-dark" : ""}`; label.textContent = "Copy From";
        select.className = `form-control${id.endsWith("-1") ? " form-control-sm" : ""}`;
        select.setAttribute("aria-label", "Copy equipment from set");
        select.title = "Copy another set's equipment layout into the current set.";
        select.addEventListener("click", event => event.stopPropagation());
        select.addEventListener("keydown", event => event.stopPropagation());
        select.addEventListener("change", event => {
          event.stopPropagation();
          const source = select.value; select.value = "";
          if (source !== "") copyFrom(Number(source));
        });
        switching.append(heading, this.container); copy.append(label, select);
        row.replaceChildren(switching, copy);
        view = { row, copy, select }; menus.set(this, view);
      }
      const enabled = ready && owner === player && !game.isGolbinRaid && sets.length > 1;
      view.copy.hidden = !enabled;
      view.row.classList.toggle("kroky-equipment-set-copy-enabled", enabled);
      const signature = `${selected}:${sets.length}`;
      if (!enabled || view.signature === signature) return;
      view.signature = signature;
      const placeholder = document.createElement("option");
      placeholder.value = ""; placeholder.textContent = "—"; placeholder.disabled = true;
      view.select.replaceChildren(placeholder);
      sets.forEach((_set, index) => {
        if (index === selected) return;
        const option = document.createElement("option"); option.value = String(index); option.textContent = String(index + 1);
        view.select.append(option);
      });
      view.select.value = "";
    });
  }
  if (typeof BankSelectedItemMenuElement === "function") {
    const notes = new WeakMap();
    ctx.patch(BankSelectedItemMenuElement, "createReplaceItemHTML").replace(function (original, slot, item, owner) {
      if (!ready || owner !== player || player.equipToSet === player.selectedEquipmentSet) return original(slot, item, owner);
      try {
        const view = { equipToSet: player.equipToSet,
          equipmentSets: player.equipmentSets.map((set, index) => index === player.equipToSet ? { ...set, equipment: projection(index) } : set),
          isEquipmentSlotUnlocked: target => player.isEquipmentSlotUnlocked(target) };
        return original(slot, item, view);
      } catch { return original(slot, item, owner); }
    });
    ctx.patch(BankSelectedItemMenuElement, "createEquipItemButtons").after(function (_result, item, owner) {
      if (!ready || owner !== player) return;
      const inactive = player.equipToSet !== player.selectedEquipmentSet;
      this.equipQuantitySliderContainer.classList.toggle("d-none", inactive || !item.validSlots[0].allowQuantity);
      let note = notes.get(this);
      if (!note) { note = document.createElement("small"); note.className = "text-info font-size-sm"; notes.set(this, note); }
      note.textContent = "This set remembers the item without reserving Bank stock.";
      note.hidden = !inactive;
      note.classList.toggle("d-block", inactive);
      this.equipSlotButtonContainer.append(note);
    });
  }

  ctx.patch(Game, "decode").after(function () {
    if (this !== game) return;
    restoreAfterLoad = ready || !!failure;
    ready = false; failure = undefined;
  });
  ctx.patch(Game, "onLoad").after(function () {
    if (this === game && restoreAfterLoad) { restoreAfterLoad = false; initialize(); }
  });
  ctx.onCharacterLoaded(initialize);
  return { get ready() { return ready; }, get error() { return failure; }, getPresets: () => presets.map(preset => ({ ...preset })), copyFrom };
}
