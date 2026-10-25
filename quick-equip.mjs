const storageKey = "quick-equip-extra-slots";
const dragType = "application/x-kroky-quick-equip";

export function installQuickEquip(ctx, game) {
  const QuickEquip = customElements.get("quick-equip-tooltip");
  const GridIcon = customElements.get("equipment-grid-icon");
  if (!QuickEquip || !GridIcon) return;
  const menus = new WeakMap(), owners = new WeakMap(), bindings = new WeakMap();
  let extra = {}, storageReady = false, storageError = false;

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
  }
  ctx.onCharacterLoaded(() => { storageReady = true; restore(); });
  ctx.patch(Game, "decode").after(() => { if (storageReady) restore(); });
  ctx.onInterfaceReady(() => {
    if (document.getElementById("kroky-quick-equip-style")) return;
    const style = document.createElement("style");
    style.id = "kroky-quick-equip-style";
    style.textContent = `
      .kroky-quick-equip-actions { display: flex; align-items: center; gap: .5rem; }
      .kroky-quick-equip-grid { display: grid !important; grid-template-columns: repeat(3, 44px); gap: 4px; margin: .25rem 0; }
      .kroky-quick-equip-slot { width: 44px; height: 44px; padding: 3px; border-radius: .25rem !important; }
      .kroky-quick-equip-slot img { width: 28px; height: 28px; margin: 0; pointer-events: none; }
      .kroky-quick-equip-slot.kroky-drop-target { border-color: #5cace5; background: #34485b; }
      .kroky-quick-equip-bank { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px; }
      .kroky-quick-equip-bank img { width: 32px; height: 32px; }
      .kroky-quick-equip-picker { width: min(18rem, calc(100vw - 3rem)); margin-top: .5rem; }
      .kroky-quick-equip-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 4px; max-height: 15rem; overflow-y: auto; margin-top: .5rem; }
      .kroky-quick-equip-bank-item { position: relative; min-height: 44px; padding: 3px; }
      .kroky-quick-equip-bank-item img { width: 28px; height: 28px; pointer-events: none; }
      .kroky-quick-equip-bank-item[aria-pressed="true"] { border-color: #5cace5; background: #34485b; }
      .kroky-quick-equip-bank-item[hidden], .kroky-quick-equip-picker[hidden] { display: none; }
      .kroky-quick-equip-status { display: block; max-width: 18rem; margin-top: .25rem; }
      .kroky-quick-unequip { left: auto !important; right: -6px; z-index: 1; border: 0; border-radius: 50%; background: #232a35; line-height: 1; font-weight: bold; }
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
    return storageReady && view.player === game.combat.player && view.player.selectedEquipmentSet === view.set
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
  function redraw(view) {
    view.entries.forEach(({ equip, image }, index) => {
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
    for (const entry of view.bankItems) entry.button.setAttribute("aria-pressed", "false");
    view.status.textContent = `${item.name} assigned to quick slot ${index + 1}.`;
    redraw(view);
  }
  function activate(view, index) {
    if (!isCurrent(view)) return;
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
    view.status.textContent = count ? "Drag an item to a quick slot, or select an item and then a slot." : "No matching equippable items in Bank.";
  }
  function populateBank(view) {
    view.bankItems = [];
    view.pendingItem = view.draggedItem = undefined;
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
        view.pendingItem = item;
        for (const entry of view.bankItems) entry.button.setAttribute("aria-pressed", String(entry.button === button));
        view.status.textContent = `Choose a quick slot for ${item.name}.`;
        view.entries[0].equip.focus();
      });
      fragment.append(button);
      view.bankItems.push({ button, name: item.name.toLocaleLowerCase() });
    }
    view.items.replaceChildren(fragment);
    filterBank(view);
  }
  function closePicker(view) {
    if (view.picker) view.picker.hidden = true;
    view.items?.replaceChildren(); view.bankItems = [];
    view.bank.setAttribute("aria-expanded", "false");
    view.pendingItem = view.draggedItem = undefined;
    view.status.textContent = "";
  }
  function createMenu(menu) {
    menu.classList.add("kroky-quick-equip");
    menu.addEventListener("click", event => event.stopPropagation());
    const actions = document.createElement("div"), bank = document.createElement("button"), label = document.createElement("span"), chest = document.createElement("img");
    actions.className = "kroky-quick-equip-actions";
    bank.type = "button"; bank.className = "btn btn-outline-secondary kroky-quick-equip-bank";
    bank.setAttribute("aria-expanded", "false"); bank.setAttribute("aria-label", "Choose quick-equip items from Bank");
    label.textContent = "Bank"; chest.src = assets.getURI("assets/media/main/bank_header.png"); chest.alt = "";
    bank.append(label, chest);
    menu.buttonContainer.parentElement.append(actions);
    actions.append(menu.buttonContainer, bank);
    menu.buttonContainer.classList.add("kroky-quick-equip-grid");
    const entries = menu.buttons.slice(0, 3);
    for (let index = 0; index < 3; index++) {
      const equip = document.createElement("button"), image = document.createElement("img");
      equip.type = "button"; equip.className = "btn btn-sm"; equip.append(image);
      entries.push({ equip, image });
    }
    menu.buttonContainer.replaceChildren(...entries.map(entry => entry.equip));
    const status = document.createElement("small");
    status.className = "kroky-quick-equip-status"; status.setAttribute("role", "status");
    menu.append(status);
    const view = { menu, bank, status, entries, bankItems: [] };
    entries.forEach(({ equip }, index) => {
      equip.classList.add("kroky-quick-equip-slot");
      // Native setEquipped replaces onclick for the first three buttons on each opening.
      equip.onclick = null;
      equip.addEventListener("click", () => activate(view, index));
      equip.addEventListener("dragover", event => {
        if (!canAssign(view, view.draggedItem)) return;
        event.preventDefault(); event.dataTransfer.dropEffect = "copy";
        equip.classList.add("kroky-drop-target");
      });
      equip.addEventListener("dragleave", () => equip.classList.remove("kroky-drop-target"));
      equip.addEventListener("drop", event => {
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
          view.items = document.createElement("div"); view.items.className = "kroky-quick-equip-items";
          view.search.addEventListener("input", () => filterBank(view));
          view.picker.append(view.search, view.items); menu.append(view.picker);
        }
        view.search.value = ""; view.picker.hidden = false;
        populateBank(view); view.search.focus();
      }
      owners.get(menu)?.quickEquipTooltip?.popperInstance?.update();
    });
    menus.set(menu, view);
    return view;
  }
  ctx.patch(QuickEquip, "setEquipped").after(function (_result, player, equipped) {
    if (player !== game.combat.player) return;
    const view = menus.get(this) ?? createMenu(this);
    view.player = player; view.equipped = equipped; view.set = player.selectedEquipmentSet;
    for (const { equip } of view.entries) equip.onclick = null;
    this.unequipButton.onclick = null;
    closePicker(view); redraw(view);
  });
  function updateUnequip(icon, player, equipped) {
    let binding = bindings.get(icon);
    if (!binding) { binding = {}; bindings.set(icon, binding); }
    binding.player = player; binding.equipped = equipped;
    const button = icon.quickEquip.unequipButton;
    if (!owners.has(icon.quickEquip)) {
      owners.set(icon.quickEquip, icon);
      button.className = "kroky-quick-unequip info-icon-overlay skill-icon-xxs btn btn-link text-danger p-0";
      button.type = "button"; button.textContent = "×";
      button.title = "Unequip";
      button.addEventListener("click", event => {
        event.stopPropagation();
        const current = bindings.get(icon);
        if (!button.disabled && current) current.player.unequipCallback(current.equipped.slot)();
      });
      icon.container.append(button);
      icon.image.tabIndex = 0;
      icon.image.setAttribute("role", "button");
      icon.image.setAttribute("aria-label", `Quick equip: ${equipped.slot.emptyName}`);
      icon.image.addEventListener("keydown", event => {
        if (!icon.quickEquipEnabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault(); event.stopPropagation(); icon.quickEquipTooltip?.show();
      });
    }
    const label = `Unequip ${equipped.item.name}`;
    if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
    const hidden = player !== game.combat.player || equipped.isEmpty || !icon.quickEquipEnabled;
    if (button.hidden !== hidden) button.hidden = hidden;
    if (button.disabled !== hidden) button.disabled = hidden;
    if (button.onclick) button.onclick = null;
  }
  ctx.patch(GridIcon, "setEquipped").after(function (_result, player, equipped) { updateUnequip(this, player, equipped); });
  ctx.patch(GridIcon, "setQuickEquipEnabled").after(function () {
    const binding = bindings.get(this);
    if (binding) updateUnequip(this, binding.player, binding.equipped);
    const view = menus.get(this.quickEquip);
    if (view && !this.quickEquipEnabled) closePicker(view);
  });
}
