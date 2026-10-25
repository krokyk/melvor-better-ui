const storageKey = "quick-equip-extra-slots";
const dragType = "application/x-kroky-quick-equip";
const settingName = "quick-equip-enabled";
const extraSlotsSettingName = "extra-quick-slots-enabled";
const statsSettingName = "equipment-item-stats-mode";
const statsDisplaySettingName = "equipment-preview-stats-mode";

export function installQuickEquip(ctx, game, createItemStatsPreview) {
  const QuickEquip = customElements.get("quick-equip-tooltip");
  const GridIcon = customElements.get("equipment-grid-icon");
  if (!QuickEquip || !GridIcon) return;
  const menus = new WeakMap(), owners = new WeakMap(), bindings = new WeakMap();
  const settings = ctx.settings.section("General");
  let extra = {}, storageReady = false, storageError = false, enabled = true, extraSlotsEnabled = true, statsMode = "click", statsLayout = "compact";
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
    type: "radio-group", name: statsSettingName, label: "Show Item Stats in Equipment", default: "click",
    hint: "Preview items beside the Bank picker in the Enhanced Equipment Menu. Drag items to assign shortcuts.",
    options: [{ value: "click", label: "By clicking on item" }, { value: "hover", label: "By hovering over item" }],
    onChange(value) {
      if (!["click", "hover"].includes(value)) return "Choose click or hover.";
      statsMode = value; syncInterface();
    },
  });
  settings.add({
    type: "radio-group", name: statsDisplaySettingName, label: "Equipment Stats Layout", default: "compact",
    hint: "Vanilla shows item details, offensive stats and defensive stats in three columns. Compact stacks them beside the picker. Both show item values and equipped differences.",
    options: [{ value: "vanilla", label: "Vanilla" }, { value: "compact", label: "Compact" }],
    onChange(value) {
      if (!["vanilla", "compact"].includes(value)) return "Choose Vanilla or Compact.";
      statsLayout = value; syncInterface();
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
    for (const icon of document.querySelectorAll("equipment-grid-icon")) {
      const binding = bindings.get(icon);
      if (!binding) continue;
      updateUnequip(icon, binding.player, binding.equipped);
      if (menus.has(icon.quickEquip) || icon.quickEquip.isConnected) icon.quickEquip.setEquipped(binding.player, binding.equipped);
    }
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
    const savedMode = settings.get(statsSettingName);
    statsMode = ["click", "hover"].includes(savedMode) ? savedMode : "click";
    const savedDisplayMode = settings.get(statsDisplaySettingName);
    statsLayout = ["vanilla", "compact"].includes(savedDisplayMode) ? savedDisplayMode : "compact";
    syncInterface();
  }
  ctx.onCharacterLoaded(() => { storageReady = true; restore(); });
  ctx.patch(Game, "decode").after(() => { if (storageReady) restore(); });
  ctx.onInterfaceReady(() => {
    syncInterface();
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
      #swal2-html-container .custom-radio > input[name^="KrokyBetterUI:"] + label { margin-left: 2rem !important; }
      .kroky-quick-equip-layout { --kroky-stats-width: min(22rem, calc(100vw - 21.75rem)); display: grid; grid-template-columns: minmax(0, 18rem); grid-template-rows: minmax(0, 1fr); gap: .75rem; width: max-content; max-width: calc(100vw - 3rem); max-height: calc(100vh - 2rem); }
      .kroky-quick-equip-layout.kroky-stats-vanilla { --kroky-stats-width: min(66rem, calc(100vw - 21.75rem)); }
      .kroky-quick-equip-layout.kroky-has-stats { grid-template-columns: minmax(0, 18rem) minmax(0, var(--kroky-stats-width)); }
      .kroky-quick-equip-layout.kroky-has-stats.kroky-preview-left { grid-template-columns: minmax(0, var(--kroky-stats-width)) minmax(0, 18rem); }
      .kroky-quick-equip-column { display: flex; flex-direction: column; grid-row: 1; grid-column: 1; min-height: 0; width: min(18rem, calc(100vw - 3rem)); }
      .kroky-has-stats.kroky-preview-left > .kroky-quick-equip-column { grid-column: 2; }
      .kroky-quick-equip-picker { display: flex; flex: 1; min-height: 0; margin-top: .5rem; }
      .kroky-quick-equip-bank-pane { display: flex; flex-direction: column; width: min(18rem, calc(100vw - 3rem)); min-height: 0; flex: 1; }
      .kroky-quick-equip-bank-pane > input, .kroky-quick-equip-selected-name { flex-shrink: 0; }
      .kroky-quick-equip-selected-name { display: block; font-weight: bold; margin: .4rem 0; }
      .kroky-quick-equip-preview { grid-row: 1; grid-column: 2; width: var(--kroky-stats-width); min-height: 0; overflow: auto; padding: .75rem; border: 1px solid #59616e; border-radius: .25rem; background: #232a35; text-align: left; font-size: .875rem; }
      .kroky-preview-left > .kroky-quick-equip-preview { grid-column: 1; }
      .kroky-quick-equip-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); grid-auto-rows: 44px; align-content: start; gap: 4px; min-height: 0; flex: 1; overflow-y: auto; margin-top: .5rem; }
      .kroky-equipment-stats-table { width: 100%; margin-bottom: .75rem; border-collapse: collapse; table-layout: fixed; font-size: .8rem; }
      .kroky-equipment-stats-heading { margin: 0 0 .4rem; padding: .25rem; background: #343c4a; text-align: center; font-size: .875rem; }
      .kroky-equipment-stats-table th, .kroky-equipment-stats-table td { padding: .25rem .15rem; vertical-align: top; }
      .kroky-equipment-stats-table th { width: 58%; text-align: left; font-weight: normal; }
      .kroky-equipment-stats-table td { text-align: right; white-space: nowrap; }
      .kroky-equipment-stat-value-cell { width: 22%; }
      .kroky-equipment-stat-difference-cell { width: 20%; }
      .kroky-item-stats-vanilla { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; align-items: start; }
      .kroky-item-stats-vanilla .kroky-equipment-item-details { grid-column: 1; grid-row: 1; min-width: 0; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-tables { display: contents; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-section:first-child { grid-column: 2; grid-row: 1; min-width: 0; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-section:last-child { grid-column: 3; grid-row: 1; min-width: 0; }
      .kroky-item-stats-vanilla .kroky-equipment-stats-section { padding: .5rem; border-radius: .25rem; background: #343c4a; }
      .kroky-item-stats-vanilla .kroky-equipment-item-details > .mt-1 { padding: .5rem; border-radius: .25rem; background: #343c4a; text-align: center; }
      .kroky-equipment-preview-name { padding: .5rem; border-radius: .25rem; background: #343c4a; text-align: center; font-size: 1rem; }
      .kroky-equipment-preview-art { display: block; width: 100%; height: 12rem; object-fit: contain; margin: .75rem 0; padding: 1rem; border-radius: .25rem; background: #343c4a; }
      .kroky-quick-equip-bank-item { position: relative; min-height: 44px; padding: 3px; }
      .kroky-quick-equip-bank-item img { width: 28px; height: 28px; pointer-events: none; }
      .kroky-quick-equip-bank-item[aria-pressed="true"] { border-color: #5cace5; background: #34485b; }
      .kroky-quick-equip-slot[hidden], .kroky-quick-equip-bank-item[hidden], .kroky-quick-equip-picker[hidden], .kroky-quick-equip-preview[hidden], .kroky-quick-equip-selected-name[hidden], .kroky-quick-unequip[hidden] { display: none; }
      .kroky-quick-equip-status { display: block; max-width: 18rem; margin-top: .25rem; }
      .kroky-quick-unequip { display: inline-flex; align-items: center; justify-content: center; left: auto !important; right: -6px; z-index: 1; border: 1px solid currentColor; border-radius: 2px; background: #232a35; line-height: 1; font-size: .75rem; font-weight: bold; text-decoration: none; }
      @media (max-width: 1000px) { .kroky-item-stats-vanilla { display: block; } .kroky-item-stats-vanilla .kroky-equipment-stats-tables { display: block; } }
      @media (max-width: 700px) { .kroky-quick-equip-layout.kroky-has-stats.kroky-preview-left, .kroky-quick-equip-layout.kroky-has-stats, .kroky-quick-equip-layout { --kroky-stats-width: min(22rem, calc(100vw - 3rem)); display: flex; flex-direction: column; overflow-y: auto; } .kroky-quick-equip-column, .kroky-quick-equip-preview { flex-shrink: 0; } .kroky-quick-equip-layout.kroky-stats-vanilla { --kroky-stats-width: min(66rem, calc(100vw - 3rem)); } }
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
    for (const entry of view.bankItems) entry.button.setAttribute("aria-pressed", "false");
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
    view.pendingItem = undefined;
    view.previewedItem = undefined;
    if (!view.preview) return;
    view.preview.replaceChildren(); view.preview.hidden = true;
    view.layout.classList.remove("kroky-has-stats");
    view.selectedName.textContent = ""; view.selectedName.hidden = true;
    for (const entry of view.bankItems) entry.button.setAttribute("aria-pressed", "false");
    const tooltip = owners.get(view.menu)?.quickEquipTooltip;
    if (view.expandedPreview) {
      tooltip?.setProps({ maxWidth: view.nativeMaxWidth });
      view.expandedPreview = false;
    }
    tooltip?.popperInstance?.update();
  }
  function previewItem(view, item, button) {
    if (!canAssign(view, item)) return;
    view.pendingItem = undefined;
    view.previewedItem = item;
    view.selectedName.textContent = item.name; view.selectedName.hidden = false;
    for (const entry of view.bankItems) entry.button.setAttribute("aria-pressed", String(entry.button === button));
    view.layout.classList.toggle("kroky-stats-vanilla", statsLayout === "vanilla");
    const result = createItemStatsPreview?.(item, game, { fullStats: true, layout: statsLayout, equipment: view.player.equipment, slot: view.equipped.slot });
    view.preview.replaceChildren(...(result?.hasStats ? [result.element] : []));
    view.preview.hidden = !result?.hasStats;
    view.layout.classList.toggle("kroky-has-stats", !!result?.hasStats);
    const owner = owners.get(view.menu), tooltip = owner?.quickEquipTooltip;
    if (result?.hasStats) {
      const rect = owner?.image.getBoundingClientRect();
      view.layout.classList.toggle("kroky-preview-left", !!rect && rect.left + rect.width / 2 > document.documentElement.clientWidth / 2);
      if (!view.expandedPreview) {
        view.nativeMaxWidth = tooltip?.props.maxWidth;
        view.expandedPreview = true;
        tooltip?.setProps({ maxWidth: "none" });
      }
    } else if (view.expandedPreview) {
      tooltip?.setProps({ maxWidth: view.nativeMaxWidth }); view.expandedPreview = false;
    }
    tooltip?.popperInstance?.update();
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
        previewItem(view, item, button);
      });
      for (const event of ["mouseenter", "focus"]) button.addEventListener(event, () => {
        if (statsMode === "hover" && view.previewedItem !== item) previewItem(view, item, button);
      });
      button.addEventListener("keydown", event => {
        if (event.key !== " " || !canAssign(view, item)) return;
        event.preventDefault(); event.stopPropagation();
        previewItem(view, item, button);
        view.pendingItem = item;
        view.status.textContent = `Choose a quick slot for ${item.name} with Enter or Space.`;
        view.entries[0].equip.focus();
      });
      fragment.append(button);
      view.bankItems.push({ button, name: item.name.toLocaleLowerCase() });
    }
    view.items.replaceChildren(fragment);
    filterBank(view);
  }
  function closePicker(view) {
    clearPreview(view);
    if (view.anchoredPicker) {
      owners.get(view.menu)?.quickEquipTooltip?.setProps({ placement: view.nativePlacement });
      view.anchoredPicker = false;
    }
    if (view.picker) view.picker.hidden = true;
    view.items?.replaceChildren(); view.bankItems = [];
    view.bank.setAttribute("aria-expanded", "false");
    view.pendingItem = view.draggedItem = undefined;
    view.status.textContent = "";
  }
  function enableMenu(view) {
    if (view.active) return;
    view.active = true;
    view.menu.classList.add("kroky-quick-equip");
    view.nativeParent.append(view.layout);
    view.layout.append(view.column);
    if (view.heading) view.column.append(view.heading);
    view.column.append(view.actions);
    view.actions.append(view.menu.buttonContainer, view.bank);
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
    bank.type = "button"; bank.className = "btn btn-outline-secondary kroky-quick-equip-bank";
    bank.setAttribute("aria-expanded", "false"); bank.setAttribute("aria-label", "Choose quick-equip items from Bank");
    label.textContent = "Bank"; chest.src = assets.getURI("assets/media/main/bank_header.png"); chest.alt = "";
    bank.append(label, chest);
    const entries = menu.buttons.slice(0, 3);
    for (let index = 0; index < 3; index++) {
      const equip = document.createElement("button"), image = document.createElement("img");
      equip.type = "button"; equip.className = "btn btn-sm"; equip.append(image);
      entries.push({ equip, image });
    }
    const status = document.createElement("small");
    status.className = "kroky-quick-equip-status"; status.setAttribute("role", "status");
    const view = { menu, bank, status, entries, actions, nativeParent, nativeChildren, nativeButtons, heading, layout, column, bankItems: [] };
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
          view.selectedName = document.createElement("small"); view.selectedName.className = "kroky-quick-equip-selected-name"; view.selectedName.hidden = true;
          view.selectedName.setAttribute("role", "status");
          view.preview = document.createElement("aside"); view.preview.className = "kroky-quick-equip-preview"; view.preview.hidden = true;
          view.preview.setAttribute("aria-label", "Item stats preview");
          view.items = document.createElement("div"); view.items.className = "kroky-quick-equip-items";
          view.search.addEventListener("input", () => { clearPreview(view); filterBank(view); });
          bankPane.append(view.search, view.selectedName, view.items);
          view.picker.append(bankPane); view.column.append(view.picker); view.layout.append(view.preview);
        }
        view.search.value = ""; view.picker.hidden = false;
        const owner = owners.get(menu), tooltip = owner?.quickEquipTooltip;
        if (tooltip) {
          const rect = owner.image.getBoundingClientRect();
          const left = rect.left + rect.width / 2 > document.documentElement.clientWidth / 2;
          view.layout.classList.toggle("kroky-preview-left", left);
          view.nativePlacement = tooltip.props.placement; view.anchoredPicker = true;
          // Keep the bank grid on the same edge while the side preview expands.
          tooltip.setProps({ placement: left ? "bottom-end" : "bottom-start" });
        }
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
      button.addEventListener("click", event => {
        if (!enabled) return;
        event.stopPropagation();
        const current = bindings.get(icon);
        if (!button.disabled && current) current.player.unequipCallback(current.equipped.slot)();
      });
      // Keep the header dropdown open when its equipment icon opens quick equip.
      icon.image.addEventListener("click", event => { if (enabled) event.stopPropagation(); });
      icon.image.addEventListener("keydown", event => {
        if (!enabled || !icon.quickEquipEnabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault(); event.stopPropagation(); icon.quickEquipTooltip?.show();
      });
    }
    binding.player = player; binding.equipped = equipped;
    if (!enabled) {
      if (!binding.active) return;
      binding.active = false;
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
      button.className = "kroky-quick-unequip info-icon-overlay skill-icon-xxs btn btn-link text-danger p-0";
      button.type = "button"; button.textContent = "−"; button.title = "Unequip";
      icon.container.append(button);
      icon.image.setAttribute("tabindex", "0");
      icon.image.setAttribute("role", "button");
      icon.image.setAttribute("aria-label", `Quick equip: ${equipped.slot.emptyName}`);
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
