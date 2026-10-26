const storageKey = "quick-equip-extra-slots";
const dragType = "application/x-kroky-quick-equip";
const settingName = "quick-equip-enabled";
const extraSlotsSettingName = "extra-quick-slots-enabled";
const directUnequipSettingName = "unequip-on-equipment-icons";
const statsDisplaySettingName = "equipment-preview-stats-mode";
const equipBehaviorSettingName = "equip-button-behavior";

export function installQuickEquip(ctx, game, createItemStatsPreview) {
  const QuickEquip = customElements.get("quick-equip-tooltip");
  const GridIcon = customElements.get("equipment-grid-icon");
  if (!QuickEquip || !GridIcon) return;
  const menus = new WeakMap(), owners = new WeakMap(), bindings = new WeakMap();
  const settings = ctx.settings.section("General");
  let extra = {}, storageReady = false, storageError = false, enabled = true, extraSlotsEnabled = true, directUnequipEnabled = false, statsLayout = "compact";
  let equipmentEventPlayer, equipmentRefreshQueued = false;
  let equipBehavior = "close-bank";
  const validEquipBehavior = value => ["close-menu", "close-bank", "keep-open"].includes(value);
  settings.add({
    type: "switch", name: settingName, label: "Enhanced Equipment Menu", default: true,
    hint: "Use enhanced quick slots and a searchable Bank picker in Combat and the top-bar equipment menu. Disable to restore the native menu while retaining your shortcuts.",
    onChange(value) {
      if (typeof value !== "boolean") return "Choose enabled or disabled.";
      enabled = value; syncInterface();
    },
  });
  settings.add({
    type: "switch", name: extraSlotsSettingName, label: "Enable 3 Extra Quick Slots", default: true,
    hint: "Show a second row of three shortcuts in the Enhanced Equipment Menu. Disable to hide that row while retaining its saved assignments.",
    onChange(value) {
      if (typeof value !== "boolean") return "Choose enabled or disabled.";
      extraSlotsEnabled = value; syncInterface();
    },
  });
  settings.add({
    type: "switch", name: directUnequipSettingName, label: "Show Unequip Button on Equipment Icons", default: false,
    hint: "Show an additional red minus-square on equipment icons. Unequip Current is always shown beside Bank in the quick-equip popup.",
    onChange(value) {
      if (typeof value !== "boolean") return "Choose enabled or disabled.";
      directUnequipEnabled = value; syncInterface();
    },
  });
  settings.add({
    type: "radio-group", name: statsDisplaySettingName, label: "Equipment Stats Layout", default: "compact",
    hint: "Applies to equipment previews, skill hovers and View Item Stats throughout the game. Vanilla uses three columns; Compact puts item details beside stacked stats in two columns.",
    options: [{ value: "vanilla", label: "Vanilla" }, { value: "compact", label: "Compact" }],
    onChange(value) {
      if (!["vanilla", "compact"].includes(value)) return "Choose Vanilla or Compact.";
      statsLayout = value; syncInterface();
    },
  });
  settings.add({
    type: "radio-group", name: equipBehaviorSettingName, label: "Equip button behavior", default: "close-bank",
    hint: "Choose what stays open after Equip selected succeeds. Failed equips keep the selection available.",
    options: [
      { value: "close-menu", label: "Closes equip menu" },
      { value: "close-bank", label: "Closes just Bank and item stats, keeping quick equip open" },
      { value: "keep-open", label: "Keeps everything open" },
    ],
    onChange(value) {
      if (!validEquipBehavior(value)) return "Choose an Equip button behavior.";
      equipBehavior = value;
    },
  });
  const rememberAttributes = (node, names) => Object.fromEntries(names.map(name => [name, node.getAttribute(name)]));
  function restoreAttributes(node, attributes) {
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) node.removeAttribute(name);
      else node.setAttribute(name, value);
    }
  }
  function syncInterface() {
    document.body.classList.toggle("kroky-item-stats-layout-vanilla", statsLayout === "vanilla");
    document.body.classList.toggle("kroky-item-stats-layout-compact", statsLayout === "compact");
    for (const icon of document.querySelectorAll("equipment-grid-icon")) {
      const binding = bindings.get(icon);
      if (!binding) continue;
      updateUnequip(icon, binding.player, binding.equipped);
      if (menus.has(icon.quickEquip) || icon.quickEquip.isConnected) icon.quickEquip.setEquipped(binding.player, binding.equipped);
    }
  }
  function queueEquipmentRefresh() {
    if (!enabled || equipmentRefreshQueued) return;
    equipmentRefreshQueued = true;
    // Native equips emit both events; refresh once after their bank and stat updates finish.
    queueMicrotask(() => { equipmentRefreshQueued = false; refreshOpenPickers(); });
  }
  function watchEquipmentChanges() {
    const player = game.combat?.player;
    if (equipmentEventPlayer === player) return;
    for (const event of ["equipmentChanged", "itemEquipped"]) equipmentEventPlayer?.off?.(event, queueEquipmentRefresh);
    equipmentEventPlayer = undefined;
    if (typeof player?.on !== "function") return;
    for (const event of ["equipmentChanged", "itemEquipped"]) player.on(event, queueEquipmentRefresh);
    equipmentEventPlayer = player;
  }

  function restore() {
    try {
      let saved = ctx.characterStorage.getItem(storageKey);
      if (typeof saved === "string") {
        const compressed = fflate.strToU8(atob(saved), true);
        saved = JSON.parse(fflate.strFromU8(fflate.gunzipSync(compressed)));
      }
      extra = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
      storageError = false;
    } catch (error) {
      extra = {}; storageError = true;
      console.warn("[Better UI] Could not read the extra quick-equip slots. Saved data was kept.", error);
    }
    enabled = settings.get(settingName) !== false;
    extraSlotsEnabled = settings.get(extraSlotsSettingName) !== false;
    directUnequipEnabled = settings.get(directUnequipSettingName) === true;
    const savedDisplayMode = settings.get(statsDisplaySettingName);
    statsLayout = ["vanilla", "compact"].includes(savedDisplayMode) ? savedDisplayMode : "compact";
    const savedEquipBehavior = settings.get(equipBehaviorSettingName);
    equipBehavior = validEquipBehavior(savedEquipBehavior) ? savedEquipBehavior : "close-bank";
    syncInterface();
    watchEquipmentChanges();
  }
  function prepareSetCopy(sourceIndex, targetIndex) {
    if (!storageReady || storageError) throw new Error("Saved quick-equip shortcuts are unavailable. Reload before copying equipment sets.");
    const sets = game.combat.player.equipmentSets;
    if (![sourceIndex, targetIndex].every(index => Number.isInteger(index) && index >= 0 && index < sets.length && sets[index]?.equipment))
      throw new Error("Choose valid equipment sets to copy.");
    if (sourceIndex === targetIndex) throw new Error("Choose a different equipment set to copy from.");
    const previous = extra, previousStorage = structuredClone(ctx.characterStorage.getItem(storageKey));
    const next = { ...extra, [targetIndex]: structuredClone(extra[sourceIndex] ?? {}) };
    const compressed = fflate.gzipSync(fflate.strToU8(JSON.stringify(next)));
    const saved = btoa(fflate.strFromU8(compressed, true));
    let applied = false;
    return {
      apply() {
        if (applied) return;
        if (extra !== previous) throw new Error("Quick-equip shortcuts changed while the equipment-set copy was prepared.");
        ctx.characterStorage.setItem(storageKey, saved);
        extra = next; applied = true;
      },
      rollback() {
        if (!applied) return;
        if (previousStorage === undefined) ctx.characterStorage.removeItem(storageKey);
        else ctx.characterStorage.setItem(storageKey, previousStorage);
        extra = previous; applied = false;
      },
    };
  }
  ctx.onCharacterLoaded(() => { storageReady = true; restore(); });
  ctx.patch(Game, "decode").after(function () { if (this === game && storageReady) restore(); });
  ctx.onInterfaceReady(() => {
    syncInterface();
    watchEquipmentChanges();
    if (document.getElementById("kroky-quick-equip-style")) return;
    const style = document.createElement("style");
    style.id = "kroky-quick-equip-style";
    style.textContent = `
      .kroky-equipment-floating { pointer-events: none !important; }
      .kroky-equipment-floating .tippy-box { background: transparent !important; border: 0 !important; box-shadow: none !important; }
      .kroky-equipment-floating .tippy-content { padding: 0; pointer-events: none; }
      .kroky-equipment-floating .tippy-arrow { display: none; }
      equipment-grid-icon.kroky-equipment-hovered .combat-equip-img,
      equipment-grid-icon.kroky-equipment-selected .combat-equip-img { outline: 2px solid #5cace5; outline-offset: 1px; }
      .kroky-quick-equip-actions { display: flex; align-items: center; justify-content: center; gap: .5rem; min-height: 92px; }
      .kroky-quick-equip-grid { display: grid !important; grid-template-columns: repeat(3, 44px); gap: 4px; margin: 0; }
      .kroky-quick-equip-slot { width: 44px; height: 44px; padding: 3px; border-radius: .25rem !important; }
      .kroky-quick-equip-slot img { width: 28px; height: 28px; margin: 0; pointer-events: none; }
      .kroky-quick-equip-slot.kroky-drop-target { border-color: #5cace5; background: #34485b; }
      .kroky-quick-equip-bank { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 92px; padding: 4px; }
      .kroky-quick-equip-bank img { width: 32px; height: 32px; }
      .kroky-quick-equip-action-stack { display: flex; flex-direction: column; gap: 4px; width: 5rem; }
      .kroky-quick-equip-action-stack > button { width: 100%; height: 44px; padding: .25rem; white-space: normal; font-size: .75rem; line-height: 1.2; }
      .kroky-quick-equip-action-stack > button:disabled { opacity: .4; cursor: default; }
      #swal2-html-container .custom-radio > input[name^="KrokyBetterUI:"] + label { margin-left: 2rem !important; }
      .kroky-quick-equip-layout { --kroky-stats-width: min(44rem, calc(100vw - 22.75rem)); position: relative; width: max-content; max-width: calc(100vw - 2rem); }
      .kroky-quick-equip-layout.kroky-stats-vanilla { --kroky-stats-width: min(66rem, calc(100vw - 22.75rem)); }
      .kroky-quick-equip-column { display: flex; flex-direction: column; flex: 0 0 auto; min-height: 0; width: min(20rem, calc(100vw - 2rem)); max-height: calc(100vh - 2rem); padding: .5rem; border: 1px solid #59616e; border-radius: .25rem; background: #222; pointer-events: auto; }
      .kroky-quick-equip-picker { display: flex; flex: 0 1 auto; min-height: 0; margin-top: .5rem; }
      .kroky-quick-equip-bank-pane { display: flex; flex-direction: column; width: 100%; min-height: 0; flex: 1; }
      .kroky-quick-equip-bank-pane > input { flex-shrink: 0; }
      .kroky-quick-equip-quantity { width: 100%; flex-shrink: 0; margin-top: .5rem; text-align: left; }
      .kroky-quick-equip-quantity-row { display: flex; align-items: center; gap: .5rem; }
      .kroky-quick-equip-quantity-number { min-width: 0; flex: 1; }
      .kroky-quick-equip-preview { position: absolute; top: 0; left: calc(100% + .75rem); width: max-content; max-width: var(--kroky-stats-width); max-height: calc(100vh - 2rem); overflow: auto; padding: .75rem; border: 1px solid #59616e; border-radius: .25rem; background: #232a35; text-align: left; font-size: .875rem; pointer-events: auto; }
      .kroky-preview-left > .kroky-quick-equip-preview { left: auto; right: calc(100% + .75rem); }
      .kroky-quick-equip-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); grid-auto-rows: 44px; align-content: start; gap: 4px; min-height: 0; flex: 0 1 auto; overflow-y: auto; margin-top: .5rem; }
      .kroky-equipment-stats-table { width: 100%; margin-bottom: .75rem; border-collapse: collapse; table-layout: fixed; font-size: .8rem; }
      .kroky-equipment-stats-heading { margin: 0 0 .4rem; padding: .25rem; background: #343c4a; text-align: center; font-size: .875rem; }
      .kroky-equipment-stats-table th, .kroky-equipment-stats-table td { padding: .25rem .15rem; vertical-align: top; }
      .kroky-equipment-stats-table th { width: 58%; text-align: left; font-weight: normal; }
      .kroky-equipment-stats-table td { text-align: right; white-space: nowrap; }
      .kroky-equipment-stat-value-cell { width: 22%; }
      .kroky-equipment-stat-difference-cell { width: 20%; }
      .kroky-item-stats-compact.kroky-item-stats-with-tables { display: grid; grid-template-columns: fit-content(22rem) fit-content(22rem); gap: 1rem; align-items: start; width: max-content; max-width: 100%; }
      .kroky-equipment-item-details { min-width: 0; max-width: 22rem; }
      .kroky-item-stats-compact .kroky-equipment-stats-tables { min-width: 18rem; max-width: 22rem; }
      .kroky-item-stats-vanilla.kroky-item-stats-with-tables { display: grid; grid-template-columns: repeat(3, fit-content(22rem)); gap: 1rem; align-items: start; width: max-content; max-width: 100%; }
      .kroky-item-stats-vanilla .kroky-equipment-item-details { grid-column: 1; grid-row: 1; min-width: 0; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-tables { display: contents; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-section:first-child { grid-column: 2; grid-row: 1; min-width: 0; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-section:last-child { grid-column: 3; grid-row: 1; min-width: 0; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-section { min-width: 18rem; max-width: 22rem; padding: .5rem; border-radius: .25rem; background: #343c4a; }
      .kroky-equipment-item-details > .mt-1 { padding: .5rem; border-radius: .25rem; background: #343c4a; text-align: center; }
      .kroky-equipment-preview-name { padding: .5rem; border-radius: .25rem; background: #343c4a; text-align: center; font-size: 1rem; }
      .kroky-equipment-preview-art { display: block; width: 100%; height: 12rem; object-fit: contain; margin: .75rem 0; padding: 1rem; border-radius: .25rem; background: #343c4a; }
      .tippy-box[data-theme~="kroky-item-stats"] { width: max-content; max-width: calc(100vw - 2rem); background: #232a35; border: 1px solid #59616e; }
      .tippy-box[data-theme~="kroky-item-stats"] > .tippy-content { padding: .75rem; max-height: calc(100vh - 2rem); overflow: auto; }
      #modal-item-stats.kroky-item-stats-dialog > .modal-dialog { width: max-content; max-width: calc(100vw - 2rem); }
      #modal-item-stats.kroky-item-stats-dialog .block-content > .row { display: none; }
      .kroky-item-stats-layout-compact #modal-item-stats-current > .modal-dialog { width: fit-content; max-width: min(48rem, calc(100vw - 2rem)); }
      .kroky-item-stats-layout-compact #modal-item-stats-current .block-content > .row { display: grid; grid-template-columns: minmax(0, 22rem) minmax(18rem, 22rem); grid-template-rows: min-content 1fr; gap: 0 1rem; align-items: start; margin: 0; }
      .kroky-item-stats-layout-compact #modal-item-stats-current .block-content > .row > div { width: auto; max-width: none; padding: 0; }
      .kroky-item-stats-layout-compact #modal-item-stats-current .block-content > .row > div:first-child { grid-column: 1; grid-row: 1 / 3; }
      .kroky-item-stats-layout-compact #modal-item-stats-current .block-content > .row > div:nth-child(2) { grid-column: 2; grid-row: 1; }
      .kroky-item-stats-layout-compact #modal-item-stats-current .block-content > .row > div:nth-child(3) { grid-column: 2; grid-row: 2; }
      .kroky-quick-equip-bank-item { position: relative; min-height: 44px; padding: 3px; }
      .kroky-quick-equip-bank-item img { width: 28px; height: 28px; pointer-events: none; }
      .kroky-quick-equip-bank-item[aria-pressed="true"] { border-color: #5cace5; background: #34485b; }
      .kroky-quick-equip-slot[hidden], .kroky-quick-equip-bank-item[hidden], .kroky-quick-equip-picker[hidden], .kroky-quick-equip-quantity[hidden], .kroky-quick-equip-preview[hidden], .kroky-quick-unequip[hidden] { display: none; }
      .kroky-quick-equip-status { display: block; max-width: 18rem; margin-top: .25rem; }
      .kroky-quick-unequip { display: inline-flex; align-items: center; justify-content: center; left: auto !important; right: -6px; z-index: 1; border: 1px solid currentColor; border-radius: 2px; background: #232a35; line-height: 1; font-size: .75rem; font-weight: bold; text-decoration: none; }
      @media (max-width: 1000px) { .kroky-item-stats-vanilla.kroky-item-stats-with-tables, .kroky-item-stats-compact.kroky-item-stats-with-tables { display: block; } .kroky-item-stats-vanilla .kroky-equipment-stats-tables { display: block; } }
      @media (max-width: 1000px) { .kroky-item-stats-layout-compact #modal-item-stats-current .block-content > .row { display: block; } }
      @media (max-width: 700px) { .kroky-quick-equip-layout { --kroky-stats-width: calc(100vw - 2rem); } .kroky-quick-equip-column { max-height: calc(50vh - 1rem); } .kroky-quick-equip-layout.kroky-stats-vanilla { --kroky-stats-width: calc(100vw - 2rem); } }
    `;
    document.head.append(style);
  });

  const extraIDs = view => {
    const ids = extra[view.set]?.[view.equipped.slot.id];
    return Array.isArray(ids) ? ids : [];
  };
  const getItem = (view, index) => index < 3 ? view.equipped.quickEquipItems[index]
    : game.items.getObjectByID(extraIDs(view)[index - 3]);
  function isCurrent(view) {
    return enabled && storageReady && view.player === game.combat.player && view.player.selectedEquipmentSet === view.set
      && view.player.equipment.getEquippedInSlot(view.equipped.slot) === view.equipped
      && owners.get(view.menu)?.quickEquipEnabled !== false;
  }
  function fits(view, item) {
    return item && game.items.getObjectByID(item.id) === item && typeof item.fitsInSlot === "function"
      && item.fitsInSlot(view.equipped.slot.id) && game.checkRequirements(item.equipRequirements, false)
      && view.player.isEquipmentSlotUnlocked(view.equipped.slot);
  }
  function canAssign(view, item) {
    return isCurrent(view) && fits(view, item) && view.player.manager.bank.getQty(item) > 0;
  }
  function canEquipSelected(view) {
    const item = view.selectedItem;
    if (!canAssign(view, item)) return false;
    const equippedSlot = view.player.equipment.getSlotOfItem?.(item);
    if (equippedSlot && equippedSlot !== view.equipped.slot) return false;
    return view.equipped.slot.allowQuantity ? validSelectedQuantity(view) : view.equipped.isEmpty || view.equipped.item !== item;
  }
  function validSelectedQuantity(view) {
    const quantity = Number(view.quantityInput?.value);
    return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= view.player.manager.bank.getQty(view.selectedItem);
  }
  function updateQuantity(view) {
    if (!view.quantitySection) return;
    const available = view.selectedItem ? view.player.manager.bank.getQty(view.selectedItem) : 0;
    view.quantitySection.hidden = !view.selectedItem || !view.equipped.slot.allowQuantity || available <= 0;
    view.quantityAllButOne.disabled = available <= 1;
    if (view.quantitySection.hidden) { if (available <= 0) view.selectedQuantity = 1; return; }
    const quantity = Math.min(view.selectedQuantity ?? available, available);
    view.quantityInput.max = String(available);
    view.quantitySlider.setSliderRange({ quantity: available });
    if (available === 1) {
      // The native slider uses a fixed 0..1 range for one Bank copy.
      view.quantitySlider.sliderMin = 1; view.quantitySlider.sliderInstance.update({ min: 1 });
    }
    view.quantitySlider.setSliderPosition(view.quantitySlider.sliderMode === 0 ? quantity : Math.max(1, view.quantitySlider.quantity));
  }
  function updateSelection(view) {
    view.equipSelected.disabled = !canEquipSelected(view);
    if (view.quantityInput) view.quantityInput.setAttribute("aria-invalid", String(!view.quantitySection.hidden && !validSelectedQuantity(view)));
    for (const [button, mode] of [[view.quantityAllButOne, 1], [view.quantityAll, 2]]) {
      if (!button) continue;
      const active = view.quantitySlider.sliderMode === mode;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("btn-success", active); button.classList.toggle("btn-info", !active);
    }
    for (const entry of view.bankItems)
      entry.button.setAttribute("aria-pressed", String(entry.button.dataset.itemId === view.selectedItem?.id));
  }
  function equipSelected(view) {
    if (view.equipped.slot.allowQuantity && view.quantitySlider?.sliderMode) updateQuantity(view);
    if (!canEquipSelected(view)) { updateQuantity(view); updateSelection(view); return; }
    view.pendingItem = view.hoveredItem = undefined;
    const item = view.selectedItem;
    const quantity = view.equipped.slot.allowQuantity ? Number(view.quantityInput.value) : 1;
    const success = view.player.equipItem(item, view.set, view.equipped.slot, quantity);
    updateSelection(view);
    if (success) redraw(view);
    if (!success || equipBehavior === "keep-open") renderPreview(view);
    else {
      closePicker(view);
      const owner = owners.get(view.menu), popup = owner?.quickEquipTooltip;
      if (equipBehavior === "close-menu") {
        if (popup?.popper?.contains(document.activeElement)) owner.image.focus({ preventScroll: true });
        popup?.hide();
      }
      else popup?.popperInstance?.update();
    }
  }
  function redraw(view) {
    view.entries.forEach(({ equip, image }, index) => {
      equip.hidden = index >= 3 && !extraSlotsEnabled;
      const item = getItem(view, index), empty = !item || item === game.emptyEquipmentItem;
      image.src = empty ? view.equipped.slot.emptyMedia : item.media;
      image.alt = "";
      const name = empty ? "Empty" : item.name;
      equip.title = `${name} — quick slot ${index + 1}`;
      equip.setAttribute("aria-label", `${name}, quick slot ${index + 1}`);
      const active = !empty && !view.equipped.isEmpty && item === view.equipped.item;
      equip.classList.toggle("btn-outline-success", active);
      equip.classList.toggle("btn-outline-secondary", !active);
    });
  }
  function assign(view, index, item) {
    if (index >= 3 && !extraSlotsEnabled) return;
    if (!canAssign(view, item)) {
      view.status.textContent = "This item is no longer available for this equipment slot. Reopen Bank to refresh.";
      return;
    }
    if (index < 3) view.equipped.quickEquipItems[index] = item;
    else {
      if (storageError) { view.status.textContent = "Saved shortcuts could not be read. Reload before replacing them."; return; }
      const ids = Array.from({ length: 3 }, (_, position) => typeof extraIDs(view)[position] === "string" ? extraIDs(view)[position] : null);
      ids[index - 3] = item.id;
      const next = { ...extra, [view.set]: { ...extra[view.set], [view.equipped.slot.id]: ids } };
      try {
        // Melvor limits each mod's character storage to 8 KiB.
        const compressed = fflate.gzipSync(fflate.strToU8(JSON.stringify(next)));
        ctx.characterStorage.setItem(storageKey, btoa(fflate.strFromU8(compressed, true)));
      }
      catch (error) {
        console.warn("[Better UI] Could not save the extra quick-equip slots.", error);
        view.status.textContent = "Could not save this shortcut. Your previous shortcut was kept.";
        return;
      }
      extra = next;
    }
    view.pendingItem = view.draggedItem = undefined;
    view.status.textContent = `${item.name} assigned to quick slot ${index + 1}.`;
    redraw(view);
  }
  function activate(view, index) {
    if (!isCurrent(view) || (index >= 3 && !extraSlotsEnabled)) return;
    if (view.pendingItem) { assign(view, index, view.pendingItem); return; }
    const item = getItem(view, index);
    if (!fits(view, item) || item === game.emptyEquipmentItem || view.player.manager.bank.getQty(item) <= 0) return;
    if (index < 3) view.player.onQuickEquipClick(view.equipped.slot, index);
    else {
      // Match native quick equip, including retaining one bank item for quantity slots.
      const quantity = view.equipped.slot.allowQuantity ? view.player.manager.bank.getQty(item) - 1 : 1;
      if (view.player.manager.bank.getQty(item) > 0 && quantity >= 1)
        view.player.equipItem(item, view.set, view.equipped.slot, quantity);
    }
    redraw(view);
  }
  function filterBank(view) {
    const query = view.search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const entry of view.bankItems) {
      entry.button.hidden = !entry.name.includes(query);
      if (!entry.button.hidden) count++;
    }
    view.status.textContent = count ? "Drag an item to assign a quick slot. Keyboard: Space on an item, then Enter on a slot." : "No matching equippable items in Bank.";
  }
  function clearPreview(view) {
    view.previewedItem = undefined;
    if (!view.preview) return;
    view.preview.replaceChildren(); view.preview.hidden = true;
    view.layout.classList.remove("kroky-has-stats");
    const tooltip = owners.get(view.menu)?.quickEquipTooltip;
    if (view.expandedPreview) {
      tooltip?.setProps({ maxWidth: view.nativeMaxWidth });
      view.expandedPreview = false;
    }
    tooltip?.popperInstance?.update();
  }
  function positionPreview(view) {
    if (!view.preview || view.preview.hidden) return;
    const viewport = document.documentElement;
    const rect = view.column.getBoundingClientRect();
    if (viewport.clientWidth <= 700) {
      const aboveSpace = Math.max(0, rect.top - 28), belowSpace = Math.max(0, viewport.clientHeight - rect.bottom - 28);
      const above = aboveSpace > belowSpace, right = rect.left + rect.width / 2 > viewport.clientWidth / 2;
      view.preview.style.top = above ? "auto" : "calc(100% + .75rem)";
      view.preview.style.bottom = above ? "calc(100% + .75rem)" : "auto";
      view.preview.style.left = right ? "auto" : "0";
      view.preview.style.right = right ? "0" : "auto";
      view.preview.style.maxWidth = `min(var(--kroky-stats-width), ${Math.max(0, right ? rect.right - 16 : viewport.clientWidth - rect.left - 16)}px)`;
      view.preview.style.maxHeight = `${above ? aboveSpace : belowSpace}px`;
      return;
    }
    view.preview.style.top = view.preview.style.bottom = view.preview.style.left = view.preview.style.right = "";
    const leftSpace = rect.left - 28, rightSpace = viewport.clientWidth - rect.right - 28;
    const left = leftSpace > rightSpace;
    view.layout.classList.toggle("kroky-preview-left", left);
    view.preview.style.maxWidth = `min(var(--kroky-stats-width), ${Math.max(0, left ? leftSpace : rightSpace)}px)`;
    view.preview.style.maxHeight = `${Math.max(0, viewport.clientHeight - Math.max(16, rect.top) - 16)}px`;
  }
  function renderPreview(view, force = false) {
    const item = view.hoveredItem ?? view.selectedItem;
    if (!isCurrent(view) || !item || game.items.getObjectByID(item.id) !== item) { clearPreview(view); return; }
    if (!force && view.previewedItem === item) return;
    view.previewedItem = item;
    view.layout.classList.toggle("kroky-stats-vanilla", statsLayout === "vanilla");
    const result = createItemStatsPreview?.(item, game, { fullStats: true, layout: statsLayout, equipment: view.player.equipment, slot: view.equipped.slot });
    const hasPreview = !!result?.element;
    view.preview.replaceChildren(...(hasPreview ? [result.element] : []));
    view.preview.hidden = !hasPreview;
    view.layout.classList.toggle("kroky-has-stats", hasPreview);
    const owner = owners.get(view.menu), tooltip = owner?.quickEquipTooltip;
    if (hasPreview) {
      if (!view.expandedPreview) {
        view.nativeMaxWidth = tooltip?.props.maxWidth;
        view.expandedPreview = true;
        tooltip?.setProps({ maxWidth: "none" });
      }
    } else if (view.expandedPreview) {
      tooltip?.setProps({ maxWidth: view.nativeMaxWidth }); view.expandedPreview = false;
    }
    positionPreview(view);
    tooltip?.popperInstance?.update();
  }
  function populateBank(view) {
    view.bankItems = [];
    view.pendingItem = view.draggedItem = view.hoveredItem = undefined;
    const fragment = document.createDocumentFragment();
    for (const { item, quantity } of game.bank.items.values()) {
      if (quantity <= 0 || !fits(view, item)) continue;
      const button = document.createElement("button"), image = document.createElement("img");
      button.type = "button"; button.className = "btn btn-outline-secondary kroky-quick-equip-bank-item";
      button.draggable = true; button.dataset.itemId = item.id;
      button.title = `${item.name} (${formatNumber(quantity)})`;
      button.setAttribute("aria-label", button.title); button.setAttribute("aria-pressed", "false");
      image.src = item.media; image.alt = ""; button.append(image);
      button.addEventListener("dragstart", event => {
        if (!canAssign(view, item)) { event.preventDefault(); return; }
        view.draggedItem = item;
        event.dataTransfer.setData(dragType, item.id); event.dataTransfer.effectAllowed = "copy";
      });
      button.addEventListener("dragend", () => {
        view.draggedItem = undefined;
        for (const entry of view.entries) entry.equip.classList.remove("kroky-drop-target");
      });
      button.addEventListener("click", () => {
        if (!canAssign(view, item)) return;
        view.pendingItem = undefined;
        view.selectedItem = view.selectedItem === item ? undefined : item;
        view.selectedQuantity = undefined;
        view.quantitySlider.setSliderMode(2);
        updateQuantity(view); updateSelection(view); renderPreview(view);
      });
      for (const event of ["mouseenter", "focus"]) button.addEventListener(event, () => {
        if (!canAssign(view, item)) return;
        view.hoveredItem = item; renderPreview(view);
      });
      for (const event of ["mouseleave", "blur"]) button.addEventListener(event, () => {
        if (view.hoveredItem !== item) return;
        view.hoveredItem = undefined; renderPreview(view);
      });
      button.addEventListener("keydown", event => {
        if (event.key !== " " || !canAssign(view, item)) return;
        event.preventDefault(); event.stopPropagation();
        view.hoveredItem = item; renderPreview(view);
        view.pendingItem = item;
        view.status.textContent = `Choose a quick slot for ${item.name} with Enter or Space.`;
        view.entries[0].equip.focus();
      });
      fragment.append(button);
      view.bankItems.push({ button, name: item.name.toLocaleLowerCase() });
    }
    view.items.replaceChildren(fragment);
    filterBank(view); updateQuantity(view); updateSelection(view);
  }
  function refreshOpenPickers() {
    if (!enabled) return;
    for (const menu of document.querySelectorAll(".kroky-quick-equip")) {
      const view = menus.get(menu);
      if (!view) continue;
      if (!isCurrent(view)) { closePicker(view); continue; }
      redraw(view);
      if (!view.picker || view.picker.hidden) continue;
      const scrollTop = view.items.scrollTop ?? 0;
      populateBank(view);
      const owner = owners.get(menu);
      if (owner) updateUnequip(owner, view.player, view.equipped);
      renderPreview(view, true);
      view.items.scrollTop = scrollTop;
      owner?.quickEquipTooltip?.popperInstance?.update();
    }
  }
  function closePicker(view) {
    view.selectedItem = view.hoveredItem = undefined;
    clearPreview(view);
    if (view.picker) view.picker.hidden = true;
    view.items?.replaceChildren(); view.bankItems = [];
    view.bank.setAttribute("aria-expanded", "false");
    view.pendingItem = view.draggedItem = undefined;
    view.status.textContent = "";
    updateQuantity(view); updateSelection(view);
  }
  function enableMenu(view) {
    const tooltip = owners.get(view.menu)?.quickEquipTooltip;
    tooltip?.popper?.classList.add("kroky-equipment-floating");
    if (tooltip && view.positionedTooltip !== tooltip) {
      view.positionedTooltip = tooltip; view.nativePopperOptions = tooltip.props.popperOptions;
      tooltip.setProps({ popperOptions: { ...view.nativePopperOptions, modifiers: [
        ...(view.nativePopperOptions?.modifiers ?? []),
        { name: "kroky-preview-bounds", enabled: true, phase: "afterWrite", fn: () => positionPreview(view) },
      ] } });
    }
    if (view.active) return;
    view.active = true;
    view.menu.classList.add("kroky-quick-equip");
    view.nativeParent.append(view.layout);
    view.layout.append(view.column);
    if (view.heading) view.column.append(view.heading);
    view.column.append(view.actions);
    view.actions.append(view.menu.buttonContainer, view.bank, view.actionStack);
    view.actionStack.append(view.equipSelected, view.menu.unequipButton);
    view.menu.buttonContainer.classList.add("kroky-quick-equip-grid");
    for (const { equip } of view.entries) equip.classList.add("kroky-quick-equip-slot");
    view.menu.buttonContainer.replaceChildren(...view.entries.map(entry => entry.equip));
    view.column.append(view.status);
    if (view.picker) view.column.append(view.picker);
    if (view.preview) view.layout.append(view.preview);
  }
  function restoreMenu(view) {
    if (!view.active) return;
    closePicker(view);
    owners.get(view.menu)?.quickEquipTooltip?.popper?.classList.remove("kroky-equipment-floating");
    view.positionedTooltip?.setProps({ popperOptions: view.nativePopperOptions }); view.positionedTooltip = undefined;
    view.active = false;
    for (const entry of view.nativeButtons) {
      entry.parent.prepend(entry.equip);
      entry.equip.classList.remove("kroky-quick-equip-slot");
      restoreAttributes(entry.equip, entry.attributes);
      restoreAttributes(entry.image, entry.imageAttributes);
    }
    view.menu.buttonContainer.replaceChildren(...view.nativeChildren);
    view.menu.buttonContainer.classList.remove("kroky-quick-equip-grid");
    if (view.heading) view.nativeParent.append(view.heading);
    view.nativeParent.append(view.menu.buttonContainer);
    view.layout.remove(); view.picker?.remove(); view.preview?.remove();
    view.menu.classList.remove("kroky-quick-equip");
  }
  function createMenu(menu) {
    const nativeParent = menu.buttonContainer.parentElement, nativeChildren = [...menu.buttonContainer.childNodes];
    const heading = nativeParent.querySelector("lang-string"), layout = document.createElement("div"), column = document.createElement("div");
    layout.className = "kroky-quick-equip-layout"; column.className = "kroky-quick-equip-column";
    const nativeButtons = menu.buttons.slice(0, 3).map(entry => ({ ...entry, parent: entry.equip.parentElement,
      attributes: rememberAttributes(entry.equip, ["title", "aria-label"]), imageAttributes: rememberAttributes(entry.image, ["alt"]) }));
    menu.addEventListener("click", event => { if (enabled) event.stopPropagation(); });
    const actions = document.createElement("div"), bank = document.createElement("button"), label = document.createElement("span"), chest = document.createElement("img");
    actions.className = "kroky-quick-equip-actions";
    bank.type = "button"; bank.className = "btn btn-success text-white kroky-quick-equip-bank";
    bank.setAttribute("aria-expanded", "false"); bank.setAttribute("aria-label", "Choose quick-equip items from Bank");
    label.textContent = "Bank"; chest.src = assets.getURI("assets/media/main/bank_header.png"); chest.alt = "";
    bank.append(label, chest);
    const actionStack = document.createElement("div"), equip = document.createElement("button");
    actionStack.className = "kroky-quick-equip-action-stack";
    equip.type = "button"; equip.className = "btn btn-info text-white kroky-quick-equip-equip-selected";
    equip.textContent = "Equip selected"; equip.disabled = true;
    const entries = menu.buttons.slice(0, 3);
    for (let index = 0; index < 3; index++) {
      const equip = document.createElement("button"), image = document.createElement("img");
      equip.type = "button"; equip.className = "btn btn-sm"; equip.append(image);
      entries.push({ equip, image });
    }
    const status = document.createElement("small");
    status.className = "kroky-quick-equip-status"; status.setAttribute("role", "status");
    const view = { menu, bank, equipSelected: equip, actionStack, status, entries, actions, nativeParent, nativeChildren, nativeButtons, heading, layout, column, bankItems: [] };
    equip.addEventListener("click", () => equipSelected(view));
    entries.forEach(({ equip }, index) => {
      // Native setEquipped replaces onclick for the first three buttons on each opening.
      equip.onclick = null;
      equip.addEventListener("click", () => activate(view, index));
      equip.addEventListener("keydown", event => {
        if (!view.pendingItem || !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); activate(view, index);
      });
      equip.addEventListener("dragover", event => {
        if ((index >= 3 && !extraSlotsEnabled) || !canAssign(view, view.draggedItem)) return;
        event.preventDefault(); event.dataTransfer.dropEffect = "copy";
        equip.classList.add("kroky-drop-target");
      });
      equip.addEventListener("dragleave", () => equip.classList.remove("kroky-drop-target"));
      equip.addEventListener("drop", event => {
        if (!enabled) return;
        event.preventDefault(); event.stopPropagation(); equip.classList.remove("kroky-drop-target");
        if (view.draggedItem && event.dataTransfer.getData(dragType) === view.draggedItem.id) assign(view, index, view.draggedItem);
      });
    });
    bank.addEventListener("click", () => {
      if (!isCurrent(view)) return;
      if (view.picker && !view.picker.hidden) closePicker(view);
      else {
        if (!view.picker) {
          view.picker = document.createElement("div"); view.picker.className = "kroky-quick-equip-picker";
          view.search = document.createElement("input"); view.search.type = "search";
          view.search.className = "form-control form-control-sm"; view.search.placeholder = "Search Bank";
          view.search.setAttribute("aria-label", "Search compatible bank equipment");
          const bankPane = document.createElement("div"); bankPane.className = "kroky-quick-equip-bank-pane";
          view.quantitySection = document.createElement("div"); view.quantitySection.className = "kroky-quick-equip-quantity"; view.quantitySection.hidden = true;
          const quantityRow = document.createElement("div"), quantityRange = document.createElement("input");
          quantityRow.className = "kroky-quick-equip-quantity-row";
          view.quantityInput = document.createElement("input"); view.quantityInput.type = "number";
          view.quantityInput.className = "form-control kroky-quick-equip-quantity-number";
          view.quantityInput.min = "1"; view.quantityInput.step = "1";
          view.quantityInput.setAttribute("aria-label", "Quantity from Bank to equip");
          quantityRange.setAttribute("aria-label", "Quantity from Bank to equip");
          view.quantityAllButOne = document.createElement("button"); view.quantityAll = document.createElement("button");
          for (const [button, mode, label] of [[view.quantityAllButOne, 1, "All but 1"], [view.quantityAll, 2, "All"]]) {
            button.type = "button"; button.className = "btn btn-info text-nowrap"; button.textContent = label;
            button.addEventListener("click", () => {
              if (!canAssign(view, view.selectedItem)) { updateQuantity(view); updateSelection(view); return; }
              updateQuantity(view);
              if (mode === 1 && view.quantityAllButOne.disabled) return;
              view.quantitySlider.setSliderMode(mode);
            });
          }
          quantityRow.append(view.quantityInput, view.quantityAllButOne, view.quantityAll);
          view.quantitySection.append(quantityRange, quantityRow);
          view.preview = document.createElement("aside"); view.preview.className = "kroky-quick-equip-preview"; view.preview.hidden = true;
          view.preview.setAttribute("aria-label", "Item stats preview");
          view.items = document.createElement("div"); view.items.className = "kroky-quick-equip-items";
          view.search.addEventListener("input", () => { view.hoveredItem = undefined; filterBank(view); renderPreview(view); });
          bankPane.append(view.search, view.quantitySection, view.items);
          view.picker.append(bankPane); view.column.append(view.picker); view.layout.append(view.preview);
          view.quantitySlider = new BankRangeSlider(quantityRange);
          view.quantitySlider.setOnChange(quantity => {
            view.selectedQuantity = quantity; view.quantityInput.value = String(quantity); updateSelection(view);
          });
          view.quantityInput.addEventListener("input", () => {
            view.quantitySlider.setSliderMode(0);
            if (validSelectedQuantity(view)) { view.selectedQuantity = Number(view.quantityInput.value); updateQuantity(view); }
            updateSelection(view);
          });
        }
        view.search.value = ""; view.picker.hidden = false;
        populateBank(view); view.search.focus();
      }
      owners.get(menu)?.quickEquipTooltip?.popperInstance?.update();
    });
    menus.set(menu, view);
    enableMenu(view);
    return view;
  }
  ctx.patch(QuickEquip, "setEquipped").after(function (_result, player, equipped) {
    if (!enabled) { const view = menus.get(this); if (view) restoreMenu(view); return; }
    if (player !== game.combat.player) return;
    const view = menus.get(this) ?? createMenu(this);
    enableMenu(view);
    view.player = player; view.equipped = equipped; view.set = player.selectedEquipmentSet;
    for (const { equip } of view.entries) equip.onclick = null;
    this.unequipButton.onclick = null;
    closePicker(view); redraw(view);
    const owner = owners.get(this);
    if (owner) updateUnequip(owner, player, equipped);
  });
  function updateUnequip(icon, player, equipped) {
    let binding = bindings.get(icon);
    const button = icon.quickEquip.unequipButton;
    if (!binding) {
      binding = { parent: button.parentElement, buttonClass: button.className, buttonText: button.textContent,
        buttonAttributes: rememberAttributes(button, ["title", "aria-label"]), buttonHidden: button.hidden, buttonDisabled: button.disabled,
        imageAttributes: rememberAttributes(icon.image, ["tabindex", "role", "aria-label"]) };
      bindings.set(icon, binding);
      owners.set(icon.quickEquip, icon);
      binding.unequip = event => {
        if (!enabled) return;
        event.stopPropagation();
        const current = bindings.get(icon);
        if (!event.currentTarget.disabled && current) current.player.unequipCallback(current.equipped.slot)();
      };
      button.addEventListener("click", binding.unequip);
      // Keep the header dropdown open when its equipment icon opens quick equip.
      icon.image.addEventListener("click", event => { if (enabled) event.stopPropagation(); });
      icon.image.addEventListener("keydown", event => {
        if (!enabled || !icon.quickEquipEnabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault(); event.stopPropagation(); icon.quickEquipTooltip?.show();
      });
    }
    binding.player = player; binding.equipped = equipped;
    const popup = icon.quickEquipTooltip;
    if (popup && binding.popup !== popup) {
      binding.popup = popup;
      const { onHide } = popup.props;
      popup.setProps({ onHide(instance) {
        if (onHide?.(instance) === false) return false;
        icon.classList.remove("kroky-equipment-selected");
        const view = menus.get(icon.quickEquip);
        if (view) closePicker(view);
      } });
    }
    if (popup && binding.popupOnShow !== popup.props.onShow) {
      const { onShow } = popup.props;
      binding.popupOnShow = instance => {
        if (onShow?.(instance) === false) return false;
        icon.tooltip?.hide();
        if (enabled) icon.classList.add("kroky-equipment-selected");
      };
      popup.setProps({ onShow: binding.popupOnShow });
    }
    const tooltip = icon.tooltip;
    if (tooltip && binding.statsTooltip !== tooltip) {
      binding.statsTooltip = tooltip;
      const { content, onShow, onHide, popperOptions } = tooltip.props;
      const grid = icon.closest("equipment-grid") ?? icon.container;
      const left = !!icon.closest("#header-equipment-dropdown");
      tooltip.setProps({ theme: "kroky-item-stats", maxWidth: "none", interactive: false,
        trigger: "mouseenter focusin", triggerTarget: icon.container, placement: left ? "left" : "right",
        getReferenceClientRect: () => grid.getBoundingClientRect(),
        aria: { content: "describedby", expanded: false },
        popperOptions: { ...popperOptions, modifiers: [
          ...(popperOptions?.modifiers ?? []).filter(modifier => !["flip", "preventOverflow"].includes(modifier.name)),
          { name: "flip", enabled: false },
          { name: "preventOverflow", options: { altAxis: false, tether: false } },
        ] },
        onHide(instance) {
          if (onHide?.(instance) === false) return false;
          icon.classList.remove("kroky-equipment-hovered");
        },
        onShow(instance) {
          if (icon.quickEquipTooltip?.state.isVisible) return false;
          if (onShow?.(instance) === false) return false;
          const { player, equipped } = binding;
          icon.classList.toggle("kroky-equipment-hovered", !equipped.isEmpty);
          const rect = grid.getBoundingClientRect();
          instance.setProps({ maxWidth: Math.max(0, (left ? rect.left : document.documentElement.clientWidth - rect.right) - 28) });
          instance.setContent(equipped.isEmpty ? content : createItemStatsPreview(equipped.item, game,
            { fullStats: true, layout: statsLayout, equipment: player.equipment, slot: equipped.slot }).element);
      } });
    }
    if (!enabled) {
      if (!binding.active) return;
      binding.active = false;
      binding.directButton?.remove();
      binding.parent.append(button);
      button.className = binding.buttonClass; button.textContent = binding.buttonText;
      restoreAttributes(button, binding.buttonAttributes);
      button.hidden = binding.buttonHidden; button.disabled = binding.buttonDisabled;
      button.onclick = player.unequipCallback(equipped.slot);
      restoreAttributes(icon.image, binding.imageAttributes);
      return;
    }
    if (!binding.active) {
      binding.active = true;
      button.type = "button"; button.className = "btn btn-sm btn-danger text-white kroky-quick-equip-unequip-current";
      button.textContent = "Unequip Current"; button.title = "Unequip Current";
      icon.image.setAttribute("tabindex", "0");
      icon.image.setAttribute("role", "button");
      icon.image.setAttribute("aria-label", `Quick equip: ${equipped.slot.emptyName}`);
    }
    const parent = menus.get(icon.quickEquip)?.actionStack ?? binding.parent;
    if (button.parentElement !== parent || parent.children[parent.children.length - 1] !== button) parent.append(button);
    const label = equipped.isEmpty ? "Unequip Current" : `Unequip ${equipped.item.name}`;
    if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
    const unavailable = player !== game.combat.player || !icon.quickEquipEnabled;
    if (button.hidden !== unavailable) button.hidden = unavailable;
    const disabled = unavailable || equipped.isEmpty;
    if (button.disabled !== disabled) button.disabled = disabled;
    if (button.onclick) button.onclick = null;
    if (directUnequipEnabled && !binding.directButton && !unavailable) {
      const direct = document.createElement("button");
      direct.type = "button"; direct.className = "kroky-quick-unequip info-icon-overlay skill-icon-xxs btn btn-link text-danger p-0";
      direct.textContent = "−"; direct.title = "Unequip";
      direct.addEventListener("click", binding.unequip); binding.directButton = direct;
    }
    const direct = binding.directButton;
    if (direct) {
      if (directUnequipEnabled && direct.parentElement !== icon.container) icon.container.append(direct);
      else if (!directUnequipEnabled && direct.parentElement) direct.remove();
      const hidden = unavailable || equipped.isEmpty;
      if (direct.hidden !== hidden) direct.hidden = hidden;
      if (direct.disabled !== disabled) direct.disabled = disabled;
      if (direct.getAttribute("aria-label") !== label) direct.setAttribute("aria-label", label);
    }
  }
  ctx.patch(GridIcon, "setEquipped").after(function (_result, player, equipped) { updateUnequip(this, player, equipped); });
  ctx.patch(GridIcon, "setQuickEquipEnabled").after(function () {
    const binding = bindings.get(this);
    if (binding) updateUnequip(this, binding.player, binding.equipped);
    const view = menus.get(this.quickEquip);
    if (view && !this.quickEquipEnabled) closePicker(view);
  });
  return { getStatsLayout: () => statsLayout, prepareSetCopy };
}
