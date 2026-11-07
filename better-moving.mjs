const settingName = "better-moving-enabled";
const compactSettingName = "compact-bank-controls-enabled";
const styles = `
bank-move-mode-menu.kroky-better-moving > .row > :nth-child(2) { display: none; }
.kroky-bank-mode-toggle { inline-size: 10.5rem; white-space: nowrap; }
.kroky-compact-bank-controls #main-bank-options > .block > .row { align-items: center; }
.kroky-compact-bank-controls #main-bank-options .p-3 { display: flex; flex-wrap: wrap; align-items: center; }
.kroky-compact-bank-controls .kroky-bank-mode-toggle { inline-size: auto; display: inline-flex; align-items: center; justify-content: center; gap: .35rem; }
.kroky-compact-bank-controls .kroky-bank-mode-toggle > :is(i, img) { flex: 0 0 1rem; width: 1rem; height: 1rem; }
.kroky-compact-bank-controls .kroky-bank-mode-toggle > .text-danger { border-radius: .15rem; background: var(--dark, #232a35); line-height: 1rem; }
.kroky-compact-bank-controls .bg-dark-bank-info > .row { align-items: center; gap: .25rem 1rem; }
.kroky-compact-bank-controls .bg-dark-bank-info > .row > div { flex: 0 0 auto; width: auto; max-width: none; }
.kroky-compact-bank-controls .bg-dark-bank-info > .row > div:last-child { margin-left: auto; }
.kroky-compact-bank-controls .bg-dark-bank-info .ml-3 { margin-left: 0 !important; }
.kroky-compact-bank-controls .bg-dark-bank-info ul { justify-content: flex-end !important; align-items: center; gap: .5rem; }
.kroky-compact-bank-controls .bg-dark-bank-info ul > li { margin: 0; padding: 0; }
.kroky-compact-bank-controls .bg-dark-bank-info ul .btn { height: 30px; min-width: 30px; margin: 0 !important; }
button.kroky-bank-sort, #kroky-bank-item-filters-toggle { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; height: 30px; line-height: 1; }
#kroky-bank-item-filters-toggle.kroky-bank-filters-active { border-color: #daa664; box-shadow: 0 0 0 1px #daa664, 0 0 6px 1px rgba(218,166,100,.4); }
.kroky-bank-filter-count { min-width: .95rem; padding: .12rem .3rem; font-size: .65rem; line-height: 1; background: #daa664; color: var(--dark, #232a35); }
.kroky-bank-filter-count[hidden] { display: none; }
.kroky-bank-sort .fa-exchange-alt { transform: rotate(90deg) scaleX(-1); }
.kroky-bank-item-filters { display: inline-block; vertical-align: middle; margin-right: .25rem; }
.kroky-bank-item-filters > .dropdown-toggle::after { margin-left: 0; }
.kroky-bank-item-filters-menu { width: 22rem; max-width: calc(100vw - 16px); max-height: min(70vh, 36rem); overflow-y: auto; }
body.darkMode .kroky-bank-item-filters-menu { color: var(--light, #f8f9fa); }
.kroky-bank-item-filters-menu fieldset { border: 0; padding: 0; margin: 0 0 .6rem; }
.kroky-bank-item-filters-menu legend { color: inherit; font-size: .8rem; font-weight: bold; margin: 0 0 .2rem; }
.kroky-bank-item-filters-menu label { color: inherit; display: inline-flex; align-items: center; gap: .3rem; margin: .1rem .6rem .1rem 0; font-size: .8rem; font-weight: normal; }
.kroky-bank-item-filters-menu select { height: 30px; }
.kroky-bank-deselect-all:disabled { opacity: .12; }
#bank-tab-menu { --kroky-bank-normal-selection: #daa664; --kroky-bank-move-selection: #5cace5; --kroky-bank-sell-selection: #e5ae67; }
body.darkMode #bank-tab-menu { --kroky-bank-sell-selection: #f3b760; }
#bank-tab-menu .bank-img.border.border-4x.border-success:not(.border-info):not(.border-warning) { border-color: #daa664!important; }
#bank-tab-menu bank-item-icon:has(> a > .bank-img.border.border-4x.border-success:not(.border-info):not(.border-warning)) { --kroky-bank-selection-color: var(--kroky-bank-normal-selection); --kroky-bank-selection-shadow: rgba(218,166,100,.75); }
#bank-tab-menu bank-item-icon:has(> a > .bank-img.border.border-4x.border-info) { --kroky-bank-selection-color: var(--kroky-bank-move-selection); }
#bank-tab-menu bank-item-icon:has(> a > .bank-img.border.border-4x.border-warning) { --kroky-bank-selection-color: var(--kroky-bank-sell-selection); }
#bank-tab-menu bank-item-icon:has(> a > .bank-img.border.border-4x:is(.border-success,.border-info,.border-warning))::before { content: ""; position: absolute; inset: -2px; z-index: 0; border: 2px solid var(--kroky-bank-selection-color); border-radius: inherit; pointer-events: none; box-shadow: 0 0 10px 6px var(--kroky-bank-selection-shadow,var(--kroky-bank-selection-color)); animation: kroky-bank-selection-pulse 1.4s ease-in-out infinite; }
#bank-tab-menu bank-item-icon > a > .bank-img { position: relative; z-index: 1; }
#bank-tab-menu bank-item-icon > a > div { z-index: 2; }
#bank-tab-menu bank-item-icon > a > .in-bank > small { position: relative; z-index: 2; }
@keyframes kroky-bank-selection-pulse { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { #bank-tab-menu bank-item-icon::before { animation: none!important; } }
.kroky-bank-move-tab { position: relative; z-index: 0; }
#bank-tab-menu :is(.kroky-bank-move-target, .kroky-bank-filter-target) { position: relative; z-index: 1; }
#bank-tab-menu :is(.kroky-bank-move-target, .kroky-bank-filter-target)::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; background-color: rgba(218, 166, 100, .5); box-shadow: 0 0 8px 3px rgba(218, 166, 100, .5); animation: kroky-bank-move-pulse 1.4s ease-in-out infinite; }
.kroky-bank-move-tab:focus-visible { outline: 2px solid #daa664; outline-offset: -2px; }
#bank-tab-menu .nav-tabs-block:has(.kroky-bank-move-tab, .kroky-bank-filter-target) { padding: 8px 3px 3px; }
@keyframes kroky-bank-move-pulse {
  0%, 100% { opacity: .02; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { #bank-tab-menu :is(.kroky-bank-move-target, .kroky-bank-filter-target)::before { animation: none; } }
`;

export function installBetterMoving(ctx, game) {
  const settings = ctx.settings.section("General");
  let enabled = false, compact = false, ready = false, anchor, deselectButton, sortState, filterGroup, filtersActive = false, filtersDirty = false;
  const filters = { upgrade: "all", hands: "all", slot: "all", requirements: "all", lock: "all", kind: "all" };
  const filterControls = [], kindPredicates = new Map();
  let filterButton, filterBadge, indicatedFilterCount;
  const requirementListeners = new Map(), watchedEquipment = new Set();
  let requirementsDirty = false;
  const matchingTabs = new Set();
  const glowMenus = new WeakSet();
  let tabGlowsDirty = false, glowSyncDirty = false, glowJob;
  const labels = new Map();
  const modeAttributes = new Map();
  const tabAttributes = new Map();
  let retentionSuppressed = 0;
  const withoutSelectionRetention = run => {
    retentionSuppressed++;
    try { return run(); }
    finally { retentionSuppressed--; }
  };
  const moving = bank => enabled && bank === game.bank && bank.itemSelectionMode === 1;
  const canPaintBank = () => ready && game.openPage?.containerID === "bank-container" && document.visibilityState !== "hidden" &&
    game.enableRendering !== false && game._isInOnlineLoop !== false;
  const hasBankFilters = () => filtersActive || game.settings.bankFilterShowAll === false || (game.bank.currentSearchQuery ?? "").trim() !== "";
  const glowing = tab => tab.classList.contains("kroky-bank-move-target") || tab.classList.contains("kroky-bank-filter-target");
  const setGlow = (tab, name, enabled) => {
    const before = glowing(tab);
    if (tab.classList.contains(name) !== enabled) tab.classList.toggle(name, enabled);
    return before !== glowing(tab);
  };
  const synchronizeGlows = menu => {
    glowSyncDirty = true;
    if (typeof requestAnimationFrame !== "function" || !document.timeline) { glowSyncDirty = false; return; }
    if (glowJob || !canPaintBank() || !menu) return;
    const job = { bank: game.bank }; glowJob = job;
    job.frame = requestAnimationFrame(() => {
      if (glowJob !== job) return;
      glowJob = undefined;
      if (!canPaintBank() || game.bank !== job.bank || document.getElementById("bank-tab-menu") !== menu) return;
      glowSyncDirty = false;
      for (const { tabLink } of menu.tabs) {
        if (!tabLink.isConnected || !glowing(tabLink) || typeof tabLink.getAnimations !== "function") continue;
        for (const animation of tabLink.getAnimations({ subtree: true })) {
          const effect = animation.effect;
          if (animation.animationName !== "kroky-bank-move-pulse" || animation.timeline !== document.timeline || effect?.target !== tabLink ||
              effect.pseudoElement !== undefined && effect.pseudoElement !== "::before" || animation.playState === "paused" ||
              animation.playState !== "running" && !animation.pending) continue;
          // Newly highlighted tabs join the same clock instead of starting another pulse.
          if (animation.startTime !== 0) animation.startTime = 0;
        }
      }
    });
  };
  function paintFilterTabGlows(menu, active = hasBankFilters()) {
    let changed = false;
    menu.tabs.forEach(({ tabLink }, tabID) => {
      const glow = active && tabID !== game.bank.selectedBankTab && matchingTabs.has(tabID);
      changed = setGlow(tabLink, "kroky-bank-filter-target", glow) || changed;
    });
    if (changed) synchronizeGlows(menu);
  }

  function updateFilterTabGlows() {
    if (!ready) return;
    const active = hasBankFilters();
    if (active && !canPaintBank()) { tabGlowsDirty = true; return; }
    const menu = document.getElementById("bank-tab-menu");
    if (!menu) return;
    if (!active) matchingTabs.clear();
    else if (tabGlowsDirty) {
      matchingTabs.clear();
      menu.itemIcons.forEach((icon, item) => {
        const bankItem = game.bank.items.get(item);
        if (bankItem && !icon.hidden && !icon.classList.contains("d-none")) matchingTabs.add(bankItem.tab);
      });
    }
    tabGlowsDirty = false;
    paintFilterTabGlows(menu, active);
  }

  function updateToolbar(options, bank) {
    document.getElementById("bank-container")?.classList.toggle("kroky-compact-bank-controls", compact);
    const sort = options?.sortButton;
    if (sort && !sort.classList.contains("kroky-bank-sort")) {
      const icon = document.createElement("i"); icon.className = "fa fa-exchange-alt"; icon.setAttribute("aria-hidden", "true");
      sort.replaceChildren(icon, "Sort"); sort.classList.add("btn-sm", "btn-info", "kroky-bank-sort");
      sort.setAttribute("title", "Sort Bank"); sort.setAttribute("aria-label", "Sort Bank");
    }
    const tools = compact && document.querySelector("#bank-tab-menu .bg-dark-bank-info ul");
    if (compact && options?.sortButton && tools && !sortState) {
      const button = options.sortButton;
      const marker = document.createComment("better ui bank sort");
      const entry = document.createElement("li");
      entry.className = "kroky-bank-sort-entry";
      sortState = { button, marker, entry };
      button.before(marker);
      entry.append(button);
      tools.prepend(entry);
    } else if (!compact && sortState) {
      const { button, marker, entry } = sortState;
      marker.replaceWith(button);
      entry.remove();
      sortState = undefined;
    }
    if (options?.sortButton?.parentElement) {
      if (!filterGroup) createFilters();
      if (filterGroup.nextSibling !== options.sortButton) options.sortButton.before(filterGroup);
    }
    for (const [button, mode, label] of [
      [options?.moveModeButton, 1, "Move Mode"],
      [options?.sellModeButton, 2, "Sell Mode"],
    ]) {
      if (!button) continue;
      const active = bank.itemSelectionMode === mode;
      if (compact || enabled) {
        if (!labels.has(button)) labels.set(button, [...button.childNodes]);
        if (compact) {
          if (!modeAttributes.has(button)) modeAttributes.set(button, button.getAttribute("aria-pressed"));
          if (button.getAttribute("aria-pressed") !== String(active) || button.textContent !== label) {
            const icon = document.createElement(active || mode === 1 ? "i" : "img");
            if (active || mode === 1) icon.className = active ? "fa fa-times text-danger" : "fa fa-arrows-alt";
            else { icon.src = game.gp.media; icon.alt = ""; }
            icon.setAttribute("aria-hidden", "true");
            button.replaceChildren(icon, label);
          }
          button.setAttribute("aria-pressed", String(active));
        } else {
          const text = `${active ? "Cancel" : "Toggle"} ${label}`;
          if (button.textContent !== text) button.replaceChildren(text);
        }
      } else if (labels.has(button)) {
        button.replaceChildren(...labels.get(button));
        labels.delete(button);
      }
      if (!compact && modeAttributes.has(button)) {
        const value = modeAttributes.get(button);
        value === null ? button.removeAttribute("aria-pressed") : button.setAttribute("aria-pressed", value);
        modeAttributes.delete(button);
      }
      button.classList.toggle("kroky-bank-mode-toggle", compact || enabled);
    }
  }

  function updateFilterIndicator() {
    const count = Object.values(filters).filter(value => value !== "all").length;
    filtersActive = count > 0;
    if (!filterButton || indicatedFilterCount === count) return;
    indicatedFilterCount = count;
    filterButton.classList.toggle("kroky-bank-filters-active", count > 0);
    filterBadge.textContent = count ? String(count) : ""; filterBadge.hidden = count === 0;
    const label = count ? `Categories: ${count} active filter${count === 1 ? "" : "s"}` : "Categories";
    filterButton.setAttribute("aria-label", label);
    filterButton.title = count ? label : "Categories: no active filters";
  }

  function createFilters() {
    filterGroup = document.createElement("div"); filterGroup.className = "dropdown kroky-bank-item-filters";
    const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-sm btn-info m-1 dropdown-toggle";
    const icon = document.createElement("i"); icon.className = "fa fa-filter"; icon.setAttribute("aria-hidden", "true"); button.append(icon, "Categories");
    button.id = "kroky-bank-item-filters-toggle";
    button.setAttribute("data-toggle", "dropdown"); button.setAttribute("aria-haspopup", "true"); button.setAttribute("aria-expanded", "false");
    filterButton = button; filterBadge = document.createElement("span");
    filterBadge.className = "kroky-bank-filter-count badge badge-pill"; filterBadge.setAttribute("aria-hidden", "true"); button.append(filterBadge);
    const menu = document.createElement("div"), form = document.createElement("form");
    menu.className = "dropdown-menu kroky-bank-item-filters-menu p-2"; menu.setAttribute("aria-labelledby", button.id);
    // Keep form interactions open even when pinned controls portal the menu to BODY.
    form.addEventListener("click", event => event.stopPropagation()); form.addEventListener("submit", event => event.preventDefault());
    const addGroup = (key, title, options, select = false) => {
      const fieldset = document.createElement("fieldset"), legend = document.createElement("legend"); legend.textContent = title; fieldset.append(legend);
      let list;
      if (select) {
        list = document.createElement("select"); list.className = "form-control form-control-sm"; list.setAttribute("aria-label", title); list.setAttribute("data-filter-group", key);
        list.addEventListener("change", () => { filters[key] = list.value; applyFilters(); }); fieldset.append(list); filterControls.push([key, list]);
      }
      for (const [value, label] of [["all", "All"], ...options]) {
        if (select) { const option = document.createElement("option"); option.value = value; option.textContent = label; list.append(option); }
        else {
          const wrapper = document.createElement("label"), input = document.createElement("input"); input.type = "radio"; input.name = `kroky-bank-filter-${key}`; input.value = value; input.checked = value === "all";
          input.setAttribute("data-filter-group", key); input.addEventListener("change", () => { if (input.checked) { filters[key] = value; if (key === "requirements") bindRequirements(); applyFilters(); } });
          wrapper.append(input, label); fieldset.append(wrapper); filterControls.push([key, input]);
        }
      }
      if (select) list.value = "all";
      form.append(fieldset);
    };
    addGroup("upgrade", "Upgrade", [["upgrade", "Upgradeable Items"], ["non-upgrade", "Non-Upgradeable Items"]]);
    addGroup("hands", "Handedness", [["one", "One-Handed"], ["two", "Two-Handed"]]);
    const slots = game.equipmentSlots?.allObjects ?? [], handIDs = ["melvorD:Weapon", "melvorD:Shield"];
    const orderedSlots = [...handIDs.flatMap(id => slots.filter(slot => slot.id === id)), ...slots.filter(slot => !handIDs.includes(slot.id))];
    addGroup("slot", "Slot", orderedSlots.map(slot => [slot.id, slot.id === handIDs[0] ? "Main Hand" : slot.id === handIDs[1] ? "Off-Hand" : slot.emptyName]), true);
    addGroup("requirements", "Equip Requirements", [["met", "Met"], ["unmet", "Unmet"]]);
    addGroup("lock", "Lock", [["locked", "Locked"], ["unlocked", "Unlocked"]]);
    const kinds = [
      ["equipment", "Equipment", item => item instanceof EquipmentItem], ["weapons", "Weapons", item => item instanceof WeaponItem],
      ["food", "Food", item => item instanceof FoodItem], ["runes", "Runes", item => item instanceof RuneItem], ["potions", "Potions", item => item instanceof PotionItem],
    ];
    const items = game.items?.allObjects ?? [];
    if (items.some(item => item.isArtefact)) kinds.push(["artefacts", "Archaeology Artefacts", item => !!item.isArtefact]);
    const types = new Set(items.map(item => item.type).filter(type => typeof type === "string" && type !== ""));
    for (const type of types) {
      if (/^(?:Special|Lemon|Lime)$|^(?:Christmas|Birthday|Easter)/i.test(type)) continue;
      const ammoTypes = type === "Arrows" ? [AmmoTypeID.Arrows, AmmoTypeID.AbyssalArrows]
        : type === "Bolts" ? [AmmoTypeID.Bolts, AmmoTypeID.AbyssalBolts] : type === "Javelin" ? [AmmoTypeID.Javelins] : [];
      const matches = item => item.type === type || item instanceof EquipmentItem && ammoTypes.includes(item.ammoType);
      if (new Set(items.filter(matches).map(item => item.id)).size >= 10) kinds.push([`type:${type}`, `Type: ${type}`, matches]);
    }
    kinds.sort((a, b) => Number(a[0].startsWith("type:")) - Number(b[0].startsWith("type:")) ||
      a[1].localeCompare(b[1], "en", { sensitivity: "base" }));
    for (const [key, , matches] of kinds) kindPredicates.set(key, matches);
    addGroup("kind", "Item Type", kinds.map(([key, label]) => [key, label]), true);
    const reset = document.createElement("button"); reset.type = "button"; reset.className = "btn btn-sm btn-secondary"; reset.textContent = "Reset";
    reset.title = "Reset these item filters. Native Bank filters and search are unchanged."; reset.setAttribute("aria-label", "Reset Categories");
    reset.addEventListener("click", () => { resetFilters(); game.bank.onBankFilterChange(); updateFilterTabGlows(); }); form.append(reset);
    menu.append(form); filterGroup.append(button, menu);
    updateFilterIndicator();
  }

  function applyFilters() {
    updateFilterIndicator();
    game.bank.onBankFilterChange();
    updateFilterTabGlows();
  }

  function resetFilters() {
    for (const key of Object.keys(filters)) filters[key] = "all";
    for (const [key, control] of filterControls) control.type === "radio" ? control.checked = control.value === "all" : control.value = "all";
    filtersActive = filtersDirty = false;
    updateFilterIndicator();
    bindRequirements();
  }

  function bindRequirements() {
    const required = new Set(); watchedEquipment.clear();
    if (filters.requirements !== "all") for (const item of game.bank.items.keys()) if (item instanceof EquipmentItem) {
      watchedEquipment.add(item); for (const requirement of item.equipRequirements) required.add(requirement);
    }
    for (const [requirement, unlisten] of requirementListeners) if (!required.has(requirement)) { unlisten(); requirementListeners.delete(requirement); }
    for (const requirement of required) if (!requirementListeners.has(requirement)) {
      requirementListeners.set(requirement, requirement.assignHandler(() => { filtersDirty = true; }));
    }
    requirementsDirty = false;
  }

  function matchesItemFilters(item) {
    if (filters.upgrade !== "all") {
      const hasUpgrade = game.bank.itemUpgrades.get(item)?.some(upgrade => !upgrade.isDowngrade) === true;
      if (hasUpgrade !== (filters.upgrade === "upgrade")) return false;
    }
    if (filters.hands !== "all" && (!(item instanceof WeaponItem) || item.occupiesSlot("melvorD:Shield") !== (filters.hands === "two"))) return false;
    if (filters.slot !== "all" && (!(item instanceof EquipmentItem) || !item.fitsInSlot(filters.slot))) return false;
    if (filters.lock !== "all" && game.bank.lockedItems.has(item) !== (filters.lock === "locked")) return false;
    if (filters.kind !== "all" && !kindPredicates.get(filters.kind)?.(item)) return false;
    if (filters.requirements !== "all" && (!(item instanceof EquipmentItem) || game.checkRequirements(item.equipRequirements, false) !== (filters.requirements === "met"))) return false;
    return true;
  }

  function update() {
    if (!ready) return;
    const options = document.getElementById("main-bank-options");
    const menu = document.getElementById("main-bank-move-mode");
    const bank = game.bank;
    updateToolbar(options, bank);
    if (!deselectButton && options?.sellModeButton?.parentElement) {
      deselectButton = document.createElement("button");
      deselectButton.type = "button";
      deselectButton.className = "btn btn-info m-1 kroky-bank-deselect-all";
      deselectButton.textContent = "Deselect All";
      deselectButton.addEventListener("click", () => {
        const bank = game.bank, mode = bank.itemSelectionMode;
        if (!enabled || (mode !== 1 && mode !== 2) || bank.selectedItems.size === 0) return;
        withoutSelectionRetention(() => {
          bank.setItemSelectionMode(0);
          bank.setItemSelectionMode(mode);
        });
      });
      options.sellModeButton.parentElement.append(deselectButton);
    }
    if (deselectButton) {
      deselectButton.hidden = !enabled || (bank.itemSelectionMode !== 1 && bank.itemSelectionMode !== 2);
      deselectButton.disabled = deselectButton.hidden || bank.selectedItems.size === 0;
    }
    for (const [element, text] of [
      [menu?.querySelector("p"), "Move Mode is active!"],
    ]) {
      if (!element) continue;
      if (enabled) {
        if (!labels.has(element)) labels.set(element, [...element.childNodes]);
        if (element.textContent !== text) element.replaceChildren(text);
      } else if (!enabled && labels.has(element)) {
        element.replaceChildren(...labels.get(element));
        labels.delete(element);
      }
    }
    menu?.classList.toggle("kroky-better-moving", enabled);
    const alert = menu?.querySelector(".alert");
    alert?.classList.toggle("alert-secondary", !enabled);
    alert?.classList.toggle("alert-danger", enabled);
    const hasSelection = moving(bank) && bank.selectedItems.size > 0;
    const bankMenu = document.getElementById("bank-tab-menu");
    if (bankMenu && !glowMenus.has(bankMenu)) {
      glowMenus.add(bankMenu);
      bankMenu.addEventListener("animationstart", event => {
        if (event.animationName === "kroky-bank-move-pulse" && event.pseudoElement === "::before" &&
            document.getElementById("bank-tab-menu") === bankMenu && bankMenu.tabs.some(({ tabLink }) => tabLink === event.target) &&
            glowing(event.target)) synchronizeGlows(bankMenu);
      });
    }
    let glowChanged = false;
    bankMenu?.tabs.forEach(({ tabLink }, tabID) => {
      glowChanged = setGlow(tabLink, "kroky-bank-move-target", hasSelection && tabID !== bank.selectedBankTab) || glowChanged;
      tabLink.classList.toggle("kroky-bank-move-tab", enabled);
      if (enabled) {
        if (!tabAttributes.has(tabLink)) tabAttributes.set(tabLink, ["tabindex", "role", "aria-label", "aria-selected"].map(name => [name, tabLink.getAttribute(name)]));
        tabLink.setAttribute("tabindex", "0");
        tabLink.setAttribute("role", "tab");
        tabLink.setAttribute("aria-label", hasSelection && tabID !== bank.selectedBankTab ? `Move selected items to bank tab ${tabID}` : `Bank tab ${tabID}`);
        tabLink.setAttribute("aria-selected", String(tabID === bank.selectedBankTab));
      } else if (tabAttributes.has(tabLink)) {
        for (const [name, value] of tabAttributes.get(tabLink)) value === null ? tabLink.removeAttribute(name) : tabLink.setAttribute(name, value);
        tabAttributes.delete(tabLink);
      }
    });
    if (glowChanged) synchronizeGlows(bankMenu);
  }

  function pruneSelection(bank) {
    // Production can consume a selected stack while the Bank is open.
    for (const item of bank.selectedItems) {
      if (bank.items.get(item.item) !== item || item.tab !== bank.selectedBankTab) bank.toggleItemForMoving(item);
    }
  }

  function activateTab(event) {
    if (!enabled || !["Enter", " "].includes(event.key)) return;
    const menu = document.getElementById("bank-tab-menu");
    const tabID = menu.tabs.findIndex(({ tabLink }) => tabLink.contains(event.target));
    if (tabID < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    menu.selectTab(tabID, game.bank);
  }

  function selectRange(event) {
    const bank = game.bank;
    if (!enabled || (bank.itemSelectionMode !== 1 && bank.itemSelectionMode !== 2)) return;
    const icon = event.target.closest("bank-item-icon");
    const container = document.getElementById("bank-tab-menu").tabs[bank.selectedBankTab].itemContainer;
    if (!icon || !container.contains(icon)) return;
    if (!event.shiftKey || anchor === undefined) { anchor = icon.item; return; }
    const icons = [...container.children].filter(node => node.matches("bank-item-icon") && !node.hidden && !node.classList.contains("d-none"));
    const start = icons.findIndex(node => node.item === anchor), end = icons.indexOf(icon);
    if (start < 0 || end < 0) { anchor = icon.item; return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    for (const node of icons.slice(Math.min(start, end), Math.max(start, end) + 1)) {
      const bankItem = bank.items.get(node.item);
      if (bankItem && !bank.selectedItems.has(bankItem)) bank.selectItemOnClick(node.item);
    }
  }

  settings.add({
    type: "switch", name: compactSettingName, label: "Enable Compact Bank Controls", default: false,
    hint: "Group Sort with the Bank tab controls, left-align totals, and align icon-labelled mode buttons with Search Bank.",
    onChange(value) {
      if (typeof value !== "boolean") return "Choose enabled or disabled.";
      compact = value;
      update();
    },
  });
  settings.add({
    type: "switch", name: settingName, label: "Better Moving", default: false,
    hint: "Shift-click selects item ranges in Move or Sell Mode. In Move Mode, click another tab or drag the selection onto it to move the items. Move Mode stays active between moves.",
    onChange(value) {
      if (typeof value !== "boolean") return "Choose enabled or disabled.";
      enabled = value;
      if (ready && !enabled && game.bank.itemSelectionMode === 1) game.bank.setItemSelectionMode(0);
      update();
    },
  });

  ctx.patch(Bank, "setItemSelectionMode").replace(function (original, mode, ...args) {
    let first;
    if (this === game.bank && !retentionSuppressed) {
      if (mode === 0 && [1, 2].includes(this.itemSelectionMode))
        first = [...this.selectedItems].find(entry => this.items.get(entry.item) === entry);
      else if (this.itemSelectionMode === 0 && [1, 2].includes(mode)) first = this.selectedBankItem;
    }
    const result = original(mode, ...args);
    if (first && this.itemSelectionMode === mode && this.items.get(first.item) === first &&
        (mode === 0 ? this.selectedBankItem !== first : first.tab === this.selectedBankTab && !this.selectedItems.has(first)))
      this.selectItemOnClick(first.item);
    return result;
  });
  ctx.patch(Bank, "setItemSelectionMode").after(() => { anchor = undefined; update(); });
  ctx.patch(Bank, "shouldShowBasedOnFilter").replace(function (original, item) {
    return original(item) && (this !== game.bank || !filtersActive || matchesItemFilters(item));
  });
  ctx.patch(BankTabMenuElement, "showAllItems").after(function () {
    if (!filtersActive || this !== document.getElementById("bank-tab-menu")) return;
    this.itemIcons.forEach((icon, item) => { if (!game.bank.shouldShowBasedOnFilter(item)) icon.classList.add("d-none"); });
  });
  ctx.patch(BankItemIconElement, "setItem").after(function (_result, bank, bankItem) {
    if (filtersActive && bank === game.bank && !bank.shouldShowBasedOnFilter(bankItem.item)) this.classList.add("d-none");
    if (bank === game.bank && filters.requirements !== "all" && bankItem.item instanceof EquipmentItem && bank.items.has(bankItem.item) && !watchedEquipment.has(bankItem.item)) requirementsDirty = filtersDirty = true;
    if (bank === game.bank) tabGlowsDirty = true;
  });
  ctx.patch(Bank, "onBankFilterChange").after(function () {
    if (this !== game.bank) return;
    filtersDirty = false; tabGlowsDirty = true;
    if (!hasBankFilters()) updateFilterTabGlows();
  });
  ctx.patch(Bank, "onBankSearchChange").after(function () {
    if (this !== game.bank) return;
    tabGlowsDirty = true;
    if (!hasBankFilters()) updateFilterTabGlows();
  });
  for (const method of ["loadAllItems", "removeItemFromTab", "moveIconsToNewTab"]) if (typeof BankTabMenuElement.prototype[method] === "function")
    ctx.patch(BankTabMenuElement, method).after(function () { if (this === document.getElementById("bank-tab-menu")) tabGlowsDirty = true; });
  for (const method of ["moveItemToNewTab", "moveSelectedItemsToTab"]) ctx.patch(Bank, method).after(function () {
    if (this === game.bank) tabGlowsDirty = true;
  });
  ctx.patch(Bank, "toggleItemLock").after(function () { if (this === game.bank && filters.lock !== "all") filtersDirty = true; });
  ctx.patch(Bank, "toggleItemSelected").after(update);
  ctx.patch(Bank, "removeItemQuantity").after(function (_result, item) {
    if (moving(this)) pruneSelection(this);
    if (this === game.bank && watchedEquipment.has(item) && !this.items.has(item)) requirementsDirty = filtersDirty = true;
    if (this === game.bank && !this.items.has(item)) tabGlowsDirty = true;
  });
  ctx.patch(BankTabMenuElement, "updateTabCount").after(update);
  ctx.patch(BankTabMenuElement, "selectTab").replace(function (original, tabID, bank) {
    if (moving(bank)) pruneSelection(bank);
    if (moving(bank) && bank.selectedItems.size > 0) return bank.moveSelectedItemsToTab(tabID);
    const result = original(tabID, bank);
    anchor = undefined;
    update();
    return result;
  });
  ctx.patch(BankTabMenuElement, "selectTab").after(function (_result, tabID, bank) {
    if (bank === game.bank && bank.selectedBankTab === tabID && canPaintBank() && this === document.getElementById("bank-tab-menu")) paintFilterTabGlows(this);
  });
  ctx.patch(Bank, "moveSelectedItemsToTab").replace(function (original, tabID) {
    if (!moving(this)) return this === game.bank ? withoutSelectionRetention(() => original(tabID)) : original(tabID);
    if (!Number.isInteger(tabID) || tabID < 0 || tabID >= this.tabCount || tabID === this.selectedBankTab) return;
    pruneSelection(this);
    if (this.selectedItems.size === 0) return;
    const result = withoutSelectionRetention(() => original(tabID));
    this.setItemSelectionMode(1);
    return result;
  });
  ctx.patch(Bank, "moveItemToNewTab").replace(function (original, oldTabID, newTabID, oldTabPosition) {
    const item = this.itemsByTab[oldTabID]?.[oldTabPosition];
    if (moving(this) && oldTabID !== newTabID && this.selectedItems.has(item)) return this.moveSelectedItemsToTab(newTabID);
    return original(oldTabID, newTabID, oldTabPosition);
  });

  const restore = () => {
    const wasEnabled = enabled;
    enabled = settings.get(settingName) === true;
    compact = settings.get(compactSettingName) === true;
    if (ready && (enabled || wasEnabled) && game.bank.itemSelectionMode === 1)
      withoutSelectionRetention(() => game.bank.setItemSelectionMode(0));
    update();
  };
  const restoreCharacter = () => {
    if (glowJob && typeof cancelAnimationFrame === "function") cancelAnimationFrame(glowJob.frame);
    glowJob = undefined; glowSyncDirty = false;
    const wasActive = filtersActive; resetFilters();
    matchingTabs.clear(); tabGlowsDirty = true;
    if (ready) document.getElementById("bank-tab-menu")?.tabs.forEach(({ tabLink }) => tabLink.classList.remove("kroky-bank-filter-target"));
    if (wasActive && ready) game.bank.onBankFilterChange();
    restore();
  };
  ctx.onCharacterLoaded(restoreCharacter);
  ctx.patch(Game, "decode").after(function () { if (this === game) restoreCharacter(); });
  ctx.onInterfaceReady(() => {
    if (!ready) {
      const style = document.createElement("style");
      style.textContent = styles;
      document.head.append(style);
      document.getElementById("bank-tab-menu")?.addEventListener("click", selectRange, true);
      document.getElementById("bank-tab-menu")?.addEventListener("keydown", activateTab);
      ready = true;
    }
    restore();
    updateFilterTabGlows();
  });
  return () => {
    if ((!filtersDirty && !requirementsDirty && !tabGlowsDirty && !glowSyncDirty) || !canPaintBank()) return;
    const updateItems = filtersDirty || requirementsDirty;
    if (requirementsDirty) bindRequirements();
    if (updateItems) game.bank.onBankFilterChange();
    if (tabGlowsDirty) updateFilterTabGlows();
    if (glowSyncDirty) synchronizeGlows(document.getElementById("bank-tab-menu"));
  };
}
