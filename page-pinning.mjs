const storageKey = "kroky-better-ui:pin";
const targets = [
  ".skill-info", "skill-header", "skillboost-menu", "realm-select-menu", "realmed-category-menu", "category-menu",
  ".sticky-div-mobile", ".sticky-category-menu-mobile", ".kroky-production-toolbar", ".kroky-production-tabs",
  ".kroky-gathering-toolbar", ".kroky-woodcutting-controls", ".kroky-activity-summary", ".kroky-activity-controls",
  "#farming-category-container", "farming-category-options",
  "bank-options-menu", "bank-move-mode-menu", "bank-sell-mode-menu", ".bg-dark-bank-info",
].join(",");

const styles = `
#sidebar .nav-main-link.kroky-sidebar-selected { background-color: #343a46; }
.kroky-page-pin { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; flex: 0 0 auto; min-width: 32px; min-height: 32px; padding: .3rem .4rem; white-space: nowrap; }
.kroky-page-pin[aria-pressed="false"] > i { transform: rotate(-45deg); }
.kroky-page-pin:enabled:is(:hover, :focus-visible) { filter: brightness(1.2); }
.kroky-page-pin:focus-visible { outline: 2px solid var(--info, #5cace5); outline-offset: 2px; }
.kroky-page-pin[aria-pressed="true"] { box-shadow: inset 0 0 0 1px currentColor; }
.kroky-skill-header-compact .kroky-page-header-details { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: .35rem 30px; padding: .4rem .6rem; background: var(--dark, #232a35); color: var(--light, #f5f5f5); }
.kroky-page-header-details > * { flex: 0 0 auto; min-width: 0; max-width: 100%; }
.kroky-summary-stats, .kroky-summary-pools, .kroky-summary-upgrades { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .5rem; }
.kroky-summary-stats > *, .kroky-summary-pools > *, .kroky-summary-upgrades > * { flex: 0 0 auto; max-width: 100%; }
.kroky-summary-upgrades:not(:has(> :not(.d-none):not([hidden]))) { display: none; }
.kroky-page-header-details :is(.kroky-header-level, .kroky-header-xp) { align-items: center; flex-wrap: nowrap; gap: .3rem; white-space: nowrap; }
.kroky-page-header-details .kroky-header-enhancements { display: flex; align-items: center; flex-wrap: nowrap; gap: .25rem; }
.kroky-page-header-details .kroky-header-enhancements::before { content: "Upgrades:"; white-space: nowrap; }
.kroky-page-header-details upgrade-chain-display > span { display: none !important; }
.kroky-page-header-details upgrade-chain-display img { width: 24px; height: 24px; cursor: help; }
.kroky-page-header-details upgrade-chain-display img:focus-visible { outline: 2px solid var(--info, #5cace5); outline-offset: 2px; }
.kroky-page-header-details .kroky-summary-progress { --kroky-summary-color: var(--success, #30c78d); display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 14rem; height: 1.25rem; padding: .05rem .3rem; border: 1px solid var(--kroky-summary-color); border-radius: .2rem; background: linear-gradient(to right, var(--kroky-summary-color) var(--kroky-summary-fill, 0%), var(--dark, #232a35) var(--kroky-summary-fill, 0%)) !important; color: white; font-size: .75rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.kroky-page-header-details .kroky-summary-progress.bg-info { --kroky-summary-color: var(--info, #5cace5); }
.kroky-page-header-details .kroky-summary-progress.bg-danger { --kroky-summary-color: var(--danger, #e56767); }
.kroky-header-level .kroky-summary-progress { width: 4.5rem; }
.kroky-page-header-details .kroky-summary-xp-capped { width: calc(var(--kroky-summary-xp-chars) * 1ch + .6rem); }
.kroky-summary-pool { display: flex; align-items: center; gap: .3rem; }
.kroky-summary-pool img { width: 24px; height: 24px; }
.kroky-summary-percent { color: white; font-size: .75rem; font-weight: 400; white-space: nowrap; font-variant-numeric: tabular-nums; }
.kroky-page-header-details .kroky-summary-pool .kroky-summary-progress { --kroky-summary-color: var(--warning, #e5ae67); width: 12.5rem; }
.kroky-summary-actions { display: flex; align-items: center; }
.kroky-skill-header-compact .kroky-summary-mastery-native { display: none !important; }
.kroky-skill-header-compact > .block > .progress { display: none; }
.kroky-skill-header-compact .skill-header-container:not(.kroky-page-header-details) { padding: 0; min-height: 0; }
#page-container.kroky-page-pinned #page-header { position: sticky; top: 0; z-index: 1040; max-height: var(--kroky-page-pin-cap, 50vh); margin-bottom: 0 !important; }
#page-container.kroky-page-pinned #page-header.kroky-page-pin-overflow { overflow-y: auto; overscroll-behavior: contain auto; }
.kroky-page-pin-controls { position: sticky; top: calc(var(--kroky-page-pin-header-height) + var(--kroky-page-pin-static-height)); z-index: 1035; width: calc(100% + var(--kroky-page-pin-content-left, 1.875rem) + var(--kroky-page-pin-content-right, 1.875rem)); max-height: max(0px, calc(var(--kroky-page-pin-cap, 50vh) - var(--kroky-page-pin-header-height) - var(--kroky-page-pin-static-height))); overflow-y: auto; overscroll-behavior: contain auto; scrollbar-gutter: stable; background: var(--dark, #232a35); margin: calc(-1 * var(--kroky-page-pin-content-top, 1.875rem)) calc(-1 * var(--kroky-page-pin-content-right, 1.875rem)) 1rem calc(-1 * var(--kroky-page-pin-content-left, 1.875rem)); padding: 0 1rem .25rem; }
.kroky-page-pin-static { position: sticky; top: var(--kroky-page-pin-header-height); z-index: 1036; max-height: max(0px, calc(var(--kroky-page-pin-cap, 50vh) - var(--kroky-page-pin-header-height) - var(--kroky-page-pin-reserved-height))); overflow-y: auto; overscroll-behavior: contain auto; background: var(--dark, #232a35); }
#combat-top-menu.kroky-page-pin-static { width: calc(100% + var(--kroky-page-pin-content-left) + var(--kroky-page-pin-content-right)); margin: calc(-1 * var(--kroky-page-pin-content-top)) calc(-1 * var(--kroky-page-pin-content-right)) 0 calc(-1 * var(--kroky-page-pin-content-left)); }
#combat-top-menu.kroky-page-pin-static > div.col-12 { padding-left: 0; padding-right: 0; }
#combat-top-menu.kroky-page-pin-static > div.col-12 > .block { border-top: 0!important; border-radius: 0; margin-bottom: 0; box-shadow: none; transform: none; }
.kroky-page-pin-controls.kroky-page-pin-after-static { width: calc(100% + var(--kroky-page-pin-content-left) + var(--kroky-page-pin-content-right)); margin-top: 0; margin-left: calc(-1 * var(--kroky-page-pin-content-left)); margin-right: calc(-1 * var(--kroky-page-pin-content-right)); }
.kroky-page-pin-controls > * { flex: 0 0 auto; width: 100%; max-width: 100%; }
.kroky-page-pin-controls > .block,
.kroky-page-pin-controls > :not(.block) > .block,
.kroky-page-pin-controls > .skill-info > skill-header > .block { border-top: 0 !important; border-radius: 0; box-shadow: none !important; transform: none !important; }
.kroky-page-pin-controls > .skill-info { margin: 0 -1rem 1rem; width: calc(100% + 2rem); max-width: none; }
.kroky-page-pin-controls :is(.sticky-div-mobile, .sticky-category-menu-mobile) { position: static !important; top: auto !important; }
.kroky-page-pin-controls .kroky-activity-summary { margin-top: .5rem; }
@media (min-width: 992px) {
  #page-container.kroky-page-pinned #shop-container { padding-left: 0; padding-right: 0; }
  #page-container.kroky-page-pinned #shop-container > .kroky-page-pin-controls { width: 100%; margin-left: 0; margin-right: 0; }
  #page-container.kroky-page-pinned #shop-container > .row { margin-left: 0; margin-right: 0; }
  #page-container.kroky-page-pinned #new-shop { padding-left: 0; padding-right: 0; }
  #page-container.kroky-page-pinned #bank-container { display: flex; flex-direction: column; height: calc(100dvh - var(--kroky-page-pin-header-height)); max-width: none; padding: 0 !important; }
  #page-container.kroky-page-pinned #bank-container > .kroky-page-pin-controls { position: static; flex-shrink: 0; width: 100%; margin: 0; padding: 0; }
  #page-container.kroky-page-pinned #bank-container > .kroky-page-pin-controls > * { display: block; padding: 0; }
  #page-container.kroky-page-pinned #bank-container > .kroky-page-pin-controls .block { margin-bottom: 0; box-shadow: none; transform: none; }
  #page-container.kroky-page-pinned #bank-container > .row { flex: 1; min-height: 0; flex-wrap: nowrap; margin: 0; }
  #page-container.kroky-page-pinned #bank-container > .row > [class*="col-"] { padding: 0; }
  #page-container.kroky-page-pinned #bank-tab-menu { display: flex; flex-direction: column; min-height: 0; }
  #page-container.kroky-page-pinned #bank-tab-menu > .block { display: flex; flex-direction: column; flex: 1; min-height: 0; margin: 0; }
  #page-container.kroky-page-pinned #bank-tab-menu > .block > :is(.nav, .bg-dark-bank-info) { position: static; flex-shrink: 0; }
  /* The native 400px inline minimum must yield to the available viewport. */
  #page-container.kroky-page-pinned #bank-tab-menu > .block > .tab-content { flex: 1; min-height: 0 !important; overflow-y: auto; padding: .5rem; }
  #page-container.kroky-page-pinned #bank-tab-menu > .block > .tab-content > .tab-pane > .row { margin: 0; }
  #page-container.kroky-page-pinned #bank-item-box { position: static !important; height: auto; min-height: 0; overflow-y: auto; margin: 0; }
  /* Keep lower item actions above the floating combat minibar. */
  #page-container.kroky-page-pinned #bank-item-box > bank-sidebar-menu { display: block; padding-bottom: 10rem; }
}
@media (max-width: 991px) {
  .kroky-page-pin-controls { width: calc(100% + var(--kroky-page-pin-content-left, 1rem) + var(--kroky-page-pin-content-right, 1rem)); margin: calc(-1 * var(--kroky-page-pin-content-top, .6rem)) calc(-1 * var(--kroky-page-pin-content-right, 1rem)) .75rem calc(-1 * var(--kroky-page-pin-content-left, 1rem)); padding: 0 .5rem .25rem; }
  .kroky-page-pin-controls > .skill-info { margin-left: -.5rem; margin-right: -.5rem; width: calc(100% + 1rem); }
}
`;

export function installPagePinning(ctx, game, isEnabled = () => true, isCompactHeaderEnabled = () => true) {
  if (typeof document === "undefined") return () => {};
  let preference;
  const moved = new Map();
  const dropdowns = new Map();
  const headerMoves = new Map();
  const headerAttributes = new Map();
  const headerTexts = new Map();
  const progressStyles = new Map();
  const cappedXPWidths = new Map();
  const poolGroups = new Map();
  const sidebarLinks = new Map();
  let summaryStats, masteryOptions, masteryActions, masteryPools, summaryUpgrades;
  let currentPage, container, wrapper, stationary, header, root, button, observer, compactHeader;

  const updateSidebarSelection = page => {
    for (const [link, original] of sidebarLinks) {
      link.classList.remove("kroky-sidebar-selected");
      if (original === null) link.removeAttribute("aria-current");
      else link.setAttribute("aria-current", original);
    }
    sidebarLinks.clear();
    const navs = typeof skillNav === "undefined" ? undefined : skillNav.navs;
    const skill = navs?.has(page?.action) ? page.action : page?.skills?.length === 1 ? page.skills[0] : undefined;
    const pages = game.getPagesForSkill?.(skill);
    // Native SkillNav creates one entry per page in this same order.
    for (const [index, { name }] of (navs?.get(skill) ?? []).entries()) {
      if (pages && pages[index] !== page) continue;
      const link = name?.closest(".nav-main-link");
      if (!link || sidebarLinks.has(link)) continue;
      sidebarLinks.set(link, link.getAttribute("aria-current"));
      link.classList.add("kroky-sidebar-selected");
      link.setAttribute("aria-current", "page");
    }
  };

  const refreshTooltips = node => {
    // Reconnecting native enhancement displays recreates their tooltips without content.
    if (node.querySelector("upgrade-chain-display") && game.shop?.renderQueue) game.shop.renderQueue.upgrades = true;
    for (const display of node.querySelectorAll("item-charge-display")) {
      const itemID = display.getAttribute("data-item-id");
      const item = itemID ? game.items?.getObjectByID(itemID) : undefined;
      if (item) display.setItem(item);
    }
    for (const pool of node.querySelectorAll("mastery-pool-display")) {
      for (const [realm, display] of pool.realmDisplayMap ?? []) {
        if (display.realmTooltip?.state?.isDestroyed && typeof tippy === "function") {
          display.realmTooltip = tippy(display.realmImage, {
            content: realm.name, placement: "bottom", allowHTML: false, interactive: false, animation: false,
          });
        }
      }
    }
  };
  const putBack = (node, marker) => { marker.replaceWith(node); refreshTooltips(node); };
  const decorate = (node, name, value) => {
    if (!headerAttributes.has(node)) headerAttributes.set(node, new Map());
    const saved = headerAttributes.get(node);
    if (!saved.has(name)) saved.set(name, node.getAttribute(name));
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  };
  const setHeaderText = (node, value) => {
    if (!node) return;
    if (!headerTexts.has(node)) headerTexts.set(node, node.textContent);
    if (node.textContent !== value) node.textContent = value;
  };
  const statFields = [
    ["skillLevel", "kroky-header-level"], ["skillXp", "kroky-header-xp"],
    ["abyssalLevel", "kroky-header-level"], ["abyssalXp", "kroky-header-xp"],
  ];
  const setStyle = (node, name, value) => {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  };
  const setProgress = (node, amount, label) => {
    if (!node) return;
    if (!progressStyles.has(node)) progressStyles.set(node, node.style.getPropertyValue("--kroky-summary-fill"));
    const percent = Number.isFinite(amount) ? Math.max(0, Math.min(100, amount)) : 0;
    if (!node.classList.contains("kroky-summary-progress")) node.classList.add("kroky-summary-progress");
    setStyle(node, "--kroky-summary-fill", `${percent}%`);
    decorate(node, "role", "progressbar");
    decorate(node, "aria-label", label);
    decorate(node, "aria-valuemin", "0");
    decorate(node, "aria-valuemax", "100");
    decorate(node, "aria-valuenow", String(percent));
    decorate(node, "aria-valuetext", node.textContent);
  };
  const restoreSkillHeader = () => {
    for (const [node, marker] of headerMoves) putBack(node, marker);
    headerMoves.clear();
    for (const [node, attributes] of headerAttributes) {
      for (const [name, value] of attributes) value === null ? node.removeAttribute(name) : node.setAttribute(name, value);
    }
    headerAttributes.clear();
    for (const [node, text] of headerTexts) node.textContent = text;
    headerTexts.clear();
    for (const [node, fill] of progressStyles) {
      node.classList.remove("kroky-summary-progress");
      if (fill) node.style.setProperty("--kroky-summary-fill", fill);
      else node.style.removeProperty("--kroky-summary-fill");
    }
    progressStyles.clear();
    for (const [node, width] of cappedXPWidths) {
      node.classList.remove("kroky-summary-xp-capped");
      if (width) node.style.setProperty("--kroky-summary-xp-chars", width);
      else node.style.removeProperty("--kroky-summary-xp-chars");
    }
    cappedXPWidths.clear();
    for (const group of poolGroups.values()) group.remove();
    poolGroups.clear();
    summaryStats?.remove();
    summaryStats = undefined;
    masteryPools?.remove();
    masteryPools = undefined;
    masteryActions?.remove();
    masteryActions = undefined;
    summaryUpgrades?.remove();
    summaryUpgrades = undefined;
    masteryOptions?.classList.remove("kroky-summary-mastery-native");
    masteryOptions = undefined;
    if (!compactHeader) return;
    compactHeader.classList.remove("kroky-skill-header-compact");
    compactHeader.upperContainer.classList.remove("kroky-page-header-details");
    compactHeader.upgradeChainContainer?.classList.remove("kroky-header-enhancements");
    for (const [field, name] of statFields) compactHeader[field]?.parentElement.classList.remove(name);
    compactHeader = undefined;
  };
  const syncSkillHeader = () => {
    const native = [...container.querySelectorAll("skill-header")].find(node => node.upperContainer && visible(node));
    if (native !== compactHeader) restoreSkillHeader();
    if (!native) return;
    if (!compactHeader) {
      compactHeader = native;
      const lift = (node, destination) => {
        const marker = document.createComment("better ui skill header");
        node.before(marker); headerMoves.set(node, marker);
        destination.append(node); refreshTooltips(node);
      };
      const statGroups = [...native.upperContainer.children].filter(node => statFields.some(([field]) => native[field] && node.contains(native[field])));
      summaryStats = document.createElement("div");
      summaryStats.className = "kroky-summary-stats";
      native.upperContainer.prepend(summaryStats);
      for (const group of statGroups) lift(group, summaryStats);
      masteryOptions = native.querySelector("mastery-skill-options");
      if (masteryOptions) {
        // Its realm tooltips do not recover after reconnecting; only move the native action buttons.
        masteryOptions.classList.add("kroky-summary-mastery-native");
        masteryPools = document.createElement("div");
        masteryPools.className = "kroky-summary-pools";
        summaryStats.after(masteryPools);
        masteryActions = document.createElement("div");
        masteryActions.className = "kroky-summary-actions";
        for (const action of [masteryOptions.viewCheckpointsButton, masteryOptions.spendMasteryButton]) {
          if (action) lift(action, masteryActions);
        }
        native.upperContainer.append(masteryActions);
      }
      summaryUpgrades = document.createElement("div");
      summaryUpgrades.className = "kroky-summary-upgrades";
      native.upperContainer.append(summaryUpgrades);
      for (const enhancements of [native.upgradeChainContainer, native.itemChargeContainer]) {
        if (enhancements) lift(enhancements, summaryUpgrades);
      }
      if (native.skillTreeButton) {
        const treeButton = native.skillTreeButton.querySelector("button");
        if (treeButton && !treeButton.getAttribute("title")) decorate(treeButton, "title", treeButton.textContent.trim());
        lift(native.skillTreeButton, summaryUpgrades);
      }
      native.classList.add("kroky-skill-header-compact");
      native.upperContainer.classList.add("kroky-page-header-details");
      native.upgradeChainContainer?.classList.add("kroky-header-enhancements");
      for (const [field, name] of statFields) {
        native[field]?.parentElement.classList.add(name);
      }
    }
    setHeaderText(native.skillLevel?.parentElement.querySelector("lang-string"), "Level");
    setHeaderText(native.skillXp?.parentElement.querySelector("lang-string"), "XP");
    setHeaderText(native.skillTreeButton?.querySelector("lang-string"), "Skill tree");
    const skillID = native.getAttribute("data-skill-id");
    const skill = (skillID ? game.skills?.getObjectByID(skillID) : undefined) ?? game.openPage?.action;
    if (skill) {
      for (const [levelField, xpField, levelKey, capKey, progressKey] of [
        ["skillLevel", "skillXp", "level", "currentLevelCap", "nextLevelProgress"],
        ["abyssalLevel", "abyssalXp", "abyssalLevel", "currentAbyssalLevelCap", "nextAbyssalLevelProgress"],
      ]) {
        const showLevel = native[levelField] && visible(native[levelField].parentElement);
        const showXP = native[xpField] && visible(native[xpField].parentElement);
        if (!showLevel && !showXP) continue;
        const level = skill[levelKey], cap = skill[capKey];
        if (!Number.isFinite(level) || !Number.isFinite(cap)) continue;
        if (showLevel) setProgress(native[levelField], cap > 1 ? (level - 1) / (cap - 1) * 100 : 100, levelField === "skillLevel" ? "Level" : "Abyssal Level");
        if (showXP) {
          const xp = native[xpField], capped = level >= cap;
          setProgress(xp, capped ? 100 : skill[progressKey], xpField === "skillXp" ? "XP" : "Abyssal XP");
          if (!cappedXPWidths.has(xp)) cappedXPWidths.set(xp, xp.style.getPropertyValue("--kroky-summary-xp-chars"));
          xp.classList.toggle("kroky-summary-xp-capped", capped);
          if (capped) setStyle(xp, "--kroky-summary-xp-chars", String(xp.textContent.length));
          else if (xp.style.getPropertyValue("--kroky-summary-xp-chars")) xp.style.removeProperty("--kroky-summary-xp-chars");
        }
      }
      const realms = masteryOptions ? [...(skill.getRealmsWithMastery?.() ?? [])]
        .filter(realm => realm.isUnlocked || realm.showIfLocked) : [];
      const order = id => id === "melvorD:Melvor" ? 0 : id === "melvorItA:Abyssal" ? 1 : 2;
      realms.sort((a, b) => order(a.id) - order(b.id));
      for (const [realm, group] of poolGroups) {
        if (realms.includes(realm)) continue;
        group.remove(); poolGroups.delete(realm);
      }
      for (const [index, realm] of realms.entries()) {
        let group = poolGroups.get(realm);
        if (!group) {
          group = document.createElement("div");
          group.className = "kroky-summary-pool";
          group.setAttribute("data-realm-id", realm.id);
          const icon = document.createElement("img");
          icon.src = realm.media; icon.alt = realm.name; icon.title = `${realm.name} mastery pool`;
          const percent = document.createElement("span");
          percent.className = "kroky-summary-percent";
          group.append(icon, document.createElement("span"), percent);
          poolGroups.set(realm, group);
          masteryPools.append(group);
        }
        const position = masteryPools.children[index];
        if (position !== group) masteryPools.insertBefore(group, position ?? null);
        const progress = group.children[1];
        const current = skill.getMasteryPoolXP(realm), maximum = skill.getMasteryPoolCap(realm);
        const format = value => typeof numberWithCommas === "function" ? numberWithCommas(Math.floor(value)) : Math.floor(value).toLocaleString("en-US");
        const text = `${format(current)} / ${format(maximum)}`;
        if (progress.textContent !== text) progress.textContent = text;
        setProgress(progress, maximum > 0 ? current / maximum * 100 : 0, `${realm.name} mastery pool`);
        const baseCap = skill.getBaseMasteryPoolCap?.(realm) ?? maximum;
        const percent = baseCap > 0 ? current / baseCap * 100 : 0;
        const percentText = typeof formatPercent === "function" ? formatPercent(percent, 2) : `${percent.toFixed(2)}%`;
        if (group.children[2].textContent !== percentText) group.children[2].textContent = percentText;
      }
    }
    for (const display of native.upperContainer.querySelectorAll("upgrade-chain-display")) {
      if (!display.upgradeImg) continue;
      decorate(display.upgradeImg, "tabindex", "0");
      const name = display.upgradeName?.textContent ?? "Enhancement";
      decorate(display.upgradeImg, "alt", name);
    }
  };

  const nativeOffset = () => root?.classList.contains("page-header-fixed-mobile") && window.innerWidth <= 991
    ? Math.ceil(header.getBoundingClientRect().height) : 0;

  const preferred = id => {
    if (preference !== undefined) return preference;
    try {
      const saved = window.localStorage.getItem(storageKey);
      preference = (saved ?? window.localStorage.getItem("kroky-workforce:pin")
        ?? window.localStorage.getItem(`kroky-workforce:pin:${id}`)) === "true";
      if (saved === null) window.localStorage.setItem(storageKey, String(preference));
    } catch { preference ??= false; }
    return preference;
  };
  const visible = node => {
    if (node.hidden || node.classList.contains("d-none") || getComputedStyle(node).display === "none") return false;
    // Moved controls still inherit the visibility of their original native section.
    for (let parent = moved.get(node)?.parentElement ?? node.parentElement; parent && parent !== container; parent = parent.parentElement) {
      if (parent.hidden || parent.classList.contains("d-none") || getComputedStyle(parent).display === "none") return false;
    }
    return true;
  };
  const restoreDropdown = owner => {
    const saved = dropdowns.get(owner);
    if (!saved) return;
    saved.marker.replaceWith(saved.menu);
    if (saved.style === null) saved.menu.removeAttribute("style");
    else saved.menu.setAttribute("style", saved.style);
    dropdowns.delete(owner);
  };
  const restore = () => {
    for (const owner of dropdowns.keys()) restoreDropdown(owner);
    restoreSkillHeader();
    for (const [node, marker] of moved) putBack(node, marker);
    moved.clear();
    wrapper?.remove();
    wrapper = undefined;
    stationary?.classList.remove("kroky-page-pin-static");
    stationary = undefined;
    root?.classList.remove("kroky-page-pinned");
    header?.classList.remove("kroky-page-pin-overflow");
    setStyle(document.documentElement, "--kroky-page-pin-offset", `${nativeOffset()}px`);
    observer?.disconnect();
    if (header) observer?.observe(header);
  };
  const measure = () => {
    if (!root?.classList.contains("kroky-page-pinned")) {
      setStyle(document.documentElement, "--kroky-page-pin-offset", `${nativeOffset()}px`);
      return;
    }
    const cap = window.innerHeight / 2;
    if (container) {
      const padding = getComputedStyle(container);
      setStyle(document.documentElement, "--kroky-page-pin-content-top", padding.paddingTop ?? "0px");
      setStyle(document.documentElement, "--kroky-page-pin-content-left", padding.paddingLeft ?? "0px");
      setStyle(document.documentElement, "--kroky-page-pin-content-right", padding.paddingRight ?? "0px");
    }
    setStyle(document.documentElement, "--kroky-page-pin-cap", `${cap}px`);
    // Absolutely positioned dropdowns inflate scrollHeight without making the header itself taller.
    const naturalHeight = (header.firstElementChild ?? header).getBoundingClientRect().height;
    header.classList.toggle("kroky-page-pin-overflow", naturalHeight > cap);
    const height = Math.min(cap, header.getBoundingClientRect().height);
    setStyle(document.documentElement, "--kroky-page-pin-header-height", `${Math.ceil(height)}px`);
    const available = Math.max(0, cap - height);
    // Each Combat segment needs a visible scroller; let shorter content yield its unused share.
    const fixedShare = stationary ? Math.min(stationary.scrollHeight, available - Math.min(available / 2, wrapper?.scrollHeight ?? 0)) : 0;
    const reserved = wrapper ? Math.min(available - fixedShare, wrapper.scrollHeight) : 0;
    setStyle(document.documentElement, "--kroky-page-pin-reserved-height", `${Math.ceil(reserved)}px`);
    const fixed = stationary ? Math.min(Math.max(0, cap - height - reserved), stationary.getBoundingClientRect().height) : 0;
    setStyle(document.documentElement, "--kroky-page-pin-static-height", `${Math.ceil(fixed)}px`);
    const controls = wrapper ? Math.min(Math.max(0, cap - height - fixed), wrapper.getBoundingClientRect().height) : 0;
    setStyle(document.documentElement, "--kroky-page-pin-offset", `${Math.ceil(height + fixed + controls)}px`);
  };
  const ensureHeader = () => {
    header = document.getElementById("page-header");
    root = document.getElementById("page-container");
    if (!header || !root) return false;
    if (button) return true;
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);
    button = document.createElement("button");
    button.type = "button";
    button.className = "kroky-page-pin btn btn-sm btn-dual text-combat-smoke ml-1";
    const icon = document.createElement("i");
    icon.className = "fa fa-thumbtack";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    (document.getElementById("header-theme")?.firstElementChild ?? header).append(button);
    button.addEventListener("click", () => {
      const id = game.openPage?.id;
      if (!id) return;
      const enabled = !preferred(id);
      preference = enabled;
      try { window.localStorage.setItem(storageKey, String(enabled)); } catch { /* Browser privacy settings can disable local storage. */ }
      update();
    });
    if (typeof ResizeObserver !== "undefined") observer = new ResizeObserver(measure);
    window.addEventListener("resize", measure);
    if (typeof $ !== "undefined") {
      $(document).on("shown.bs.dropdown.krokyPagePin", event => {
        if (!root.classList.contains("kroky-page-pinned") || dropdowns.has(event.target)) return;
        if (!wrapper?.contains(event.target) && !(header.contains(event.target) && header.classList.contains("kroky-page-pin-overflow"))) return;
        const menu = event.target.querySelector(".dropdown-menu.show");
        if (!menu) return;
        // A capped scrolling header otherwise clips Bootstrap menus, regardless of their z-index.
        const rect = menu.getBoundingClientRect();
        const marker = document.createComment("better ui dropdown");
        menu.before(marker);
        dropdowns.set(event.target, { menu, marker, style: menu.getAttribute("style") });
        document.body.append(menu);
        Object.assign(menu.style, { position: "fixed", transform: "none", top: `${Math.max(8, Math.min(rect.top, window.innerHeight - 64))}px`,
          left: `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`,
          width: `${Math.min(rect.width, window.innerWidth - 16)}px`, maxWidth: "calc(100vw - 16px)",
          maxHeight: `${Math.max(48, window.innerHeight - Math.max(8, rect.top) - 8)}px`, overflowY: "auto", zIndex: "1055" });
      });
      $(document).on("hidden.bs.dropdown.krokyPagePin", event => restoreDropdown(event.target));
    }
    return true;
  };
  const update = () => {
    if (!ensureHeader()) return;
    const page = game.openPage;
    if (page !== currentPage || document.getElementById(page?.containerID) !== container) {
      restore();
      updateSidebarSelection(page);
      currentPage = page;
      container = document.getElementById(page?.containerID);
    }
    const enabled = isEnabled();
    const pinned = enabled && !!page?.id && preferred(page.id);
    button.classList.toggle("d-none", !enabled);
    const disabled = !enabled || !page?.id;
    if (button.disabled !== disabled) button.disabled = disabled;
    const title = pinned ? "Unpin headers throughout the game" : "Pin headers throughout the game";
    if (button.title !== title) button.title = title;
    if (button.getAttribute("aria-label") !== title) button.setAttribute("aria-label", title);
    if (button.getAttribute("aria-pressed") !== String(pinned)) button.setAttribute("aria-pressed", String(pinned));
    button.classList.toggle("btn-dual", !pinned);
    button.classList.toggle("text-combat-smoke", !pinned);
    button.classList.toggle("btn-info", pinned);
    if (!pinned) {
      if (wrapper || root.classList.contains("kroky-page-pinned")) restore();
      measure();
      return;
    }
    if (!root.classList.contains("kroky-page-pinned")) root.classList.add("kroky-page-pinned");
    if (container) {
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "kroky-page-pin-controls";
        // Combat's XP table destroys its rows when disconnected, so pin that native segment in place.
        stationary = container.querySelector("#combat-top-menu");
        if (stationary) {
          stationary.classList.add("kroky-page-pin-static");
          wrapper.classList.add("kroky-page-pin-after-static");
          stationary.after(wrapper);
          observer?.observe(stationary);
        } else container.prepend(wrapper);
      }
      // Keep Bank labels themed and narrow-screen controls in their native layout.
      const bank = container.querySelector("bank-tab-menu");
      const candidates = [...container.querySelectorAll(targets)].filter(node =>
        (!bank || window.innerWidth >= 992 && !bank.contains(node)) && visible(node));
      const selected = candidates.filter(node => !candidates.some(parent => parent !== node && parent.contains(node)));
      for (const [node, marker] of moved) {
        if (selected.includes(node)) continue;
        putBack(node, marker);
        moved.delete(node);
      }
      for (const node of selected) {
        if (moved.has(node)) continue;
        const marker = document.createComment("better ui pinned control");
        node.before(marker);
        moved.set(node, marker);
      }
      selected.sort((a, b) => moved.get(a).compareDocumentPosition(moved.get(b)) & 4 ? -1 : 1);
      selected.forEach((node, index) => {
        if (wrapper.children[index] === node) return;
        wrapper.insertBefore(node, wrapper.children[index] ?? null);
        refreshTooltips(node);
      });
      if (isCompactHeaderEnabled()) syncSkillHeader();
      else restoreSkillHeader();
      if (wrapper.hidden !== (selected.length === 0)) wrapper.hidden = selected.length === 0;
      observer?.observe(wrapper);
    }
    observer?.observe(header);
    measure();
  };
  Object.defineProperty(update, "offset", { get: () => parseFloat(document.documentElement.style.getPropertyValue("--kroky-page-pin-offset")) || 0 });
  return update;
}
