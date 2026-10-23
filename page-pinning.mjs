const storageKey = "kroky-better-ui:pin";
const targets = [
  ".skill-info", "skill-header", "realm-select-menu", "realmed-category-menu", "category-menu",
  ".sticky-div-mobile", ".sticky-category-menu-mobile", ".kroky-production-toolbar", ".kroky-production-tabs",
  ".kroky-gathering-toolbar", ".kroky-woodcutting-controls", ".kroky-activity-summary", ".kroky-activity-controls",
  "#farming-category-container", "farming-category-options",
  "bank-options-menu", "bank-move-mode-menu", "bank-sell-mode-menu", ".bg-dark-bank-info",
].join(",");

const styles = `
.kroky-page-pin { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; flex: 0 0 auto; min-width: 32px; min-height: 32px; padding: .3rem .4rem; white-space: nowrap; }
.kroky-page-pin[aria-pressed="false"] > i { transform: rotate(-45deg); }
.kroky-page-pin:enabled:is(:hover, :focus-visible) { filter: brightness(1.2); }
.kroky-page-pin:focus-visible { outline: 2px solid var(--info, #5cace5); outline-offset: 2px; }
.kroky-page-pin[aria-pressed="true"] { box-shadow: inset 0 0 0 1px currentColor; }
#page-container.kroky-page-pinned #page-header { position: sticky; top: 0; z-index: 1040; max-height: var(--kroky-page-pin-cap, 50vh); margin-bottom: 0 !important; }
#page-container.kroky-page-pinned #page-header.kroky-page-pin-overflow { overflow-y: auto; overscroll-behavior: contain auto; }
.kroky-page-pin-controls { position: sticky; top: calc(var(--kroky-page-pin-header-height) + var(--kroky-page-pin-static-height)); z-index: 1035; width: calc(100% + 3.75rem); max-height: max(0px, calc(var(--kroky-page-pin-cap, 50vh) - var(--kroky-page-pin-header-height) - var(--kroky-page-pin-static-height))); overflow-y: auto; overscroll-behavior: contain auto; scrollbar-gutter: stable; background: var(--dark, #232a35); margin: -1.875rem -1.875rem 1rem; padding: 0 1rem .25rem; }
.kroky-page-pin-static { position: sticky; top: var(--kroky-page-pin-header-height); z-index: 1036; max-height: max(0px, calc(var(--kroky-page-pin-cap, 50vh) - var(--kroky-page-pin-header-height) - var(--kroky-page-pin-reserved-height))); overflow-y: auto; overscroll-behavior: contain auto; background: var(--dark, #232a35); }
#combat-top-menu.kroky-page-pin-static { width: calc(100% + var(--kroky-page-pin-content-left) + var(--kroky-page-pin-content-right)); margin: calc(-1 * var(--kroky-page-pin-content-top)) calc(-1 * var(--kroky-page-pin-content-right)) 0 calc(-1 * var(--kroky-page-pin-content-left)); }
#combat-top-menu.kroky-page-pin-static > div.col-12 { padding-left: 0; padding-right: 0; }
#combat-top-menu.kroky-page-pin-static > div.col-12 > .block { border-top: 0!important; border-radius: 0; margin-bottom: 0; box-shadow: none; transform: none; }
.kroky-page-pin-controls.kroky-page-pin-after-static { width: calc(100% + var(--kroky-page-pin-content-left) + var(--kroky-page-pin-content-right)); margin-top: 0; margin-left: calc(-1 * var(--kroky-page-pin-content-left)); margin-right: calc(-1 * var(--kroky-page-pin-content-right)); }
.kroky-page-pin-controls > * { flex: 0 0 auto; width: 100%; max-width: 100%; }
.kroky-page-pin-controls > .skill-info { margin: 0 -1rem 1rem; width: calc(100% + 2rem); max-width: none; }
.kroky-page-pin-controls :is(.sticky-div-mobile, .sticky-category-menu-mobile) { position: static !important; top: auto !important; }
.kroky-page-pin-controls .kroky-activity-summary { margin-top: .5rem; }
@media (min-width: 992px) {
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
  .kroky-page-pin-controls { width: calc(100% + 2rem); margin: -.6rem -1rem .75rem; padding: 0 .5rem .25rem; }
  .kroky-page-pin-controls > .skill-info { margin-left: -.5rem; margin-right: -.5rem; width: calc(100% + 1rem); }
}
`;

export function installPagePinning(ctx, game, isEnabled = () => true) {
  if (typeof document === "undefined") return () => {};
  let preference;
  const moved = new Map();
  const dropdowns = new Map();
  let currentPage, container, wrapper, stationary, header, root, button, label, observer;

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
    for (const [node, marker] of moved) marker.replaceWith(node);
    moved.clear();
    wrapper?.remove();
    wrapper = undefined;
    stationary?.classList.remove("kroky-page-pin-static");
    stationary = undefined;
    root?.classList.remove("kroky-page-pinned");
    header?.classList.remove("kroky-page-pin-overflow");
    document.documentElement.style.setProperty("--kroky-page-pin-offset", `${nativeOffset()}px`);
    observer?.disconnect();
    if (header) observer?.observe(header);
  };
  const measure = () => {
    if (!root?.classList.contains("kroky-page-pinned")) {
      document.documentElement.style.setProperty("--kroky-page-pin-offset", `${nativeOffset()}px`);
      return;
    }
    const cap = window.innerHeight / 2;
    if (stationary) {
      const padding = getComputedStyle(container);
      document.documentElement.style.setProperty("--kroky-page-pin-content-top", padding.paddingTop ?? "0px");
      document.documentElement.style.setProperty("--kroky-page-pin-content-left", padding.paddingLeft ?? "0px");
      document.documentElement.style.setProperty("--kroky-page-pin-content-right", padding.paddingRight ?? "0px");
    }
    document.documentElement.style.setProperty("--kroky-page-pin-cap", `${cap}px`);
    // Absolutely positioned dropdowns inflate scrollHeight without making the header itself taller.
    const naturalHeight = (header.firstElementChild ?? header).getBoundingClientRect().height;
    header.classList.toggle("kroky-page-pin-overflow", naturalHeight > cap);
    const height = Math.min(cap, header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--kroky-page-pin-header-height", `${Math.ceil(height)}px`);
    const available = Math.max(0, cap - height);
    // Each Combat segment needs a visible scroller; let shorter content yield its unused share.
    const fixedShare = stationary ? Math.min(stationary.scrollHeight, available - Math.min(available / 2, wrapper?.scrollHeight ?? 0)) : 0;
    const reserved = wrapper ? Math.min(available - fixedShare, wrapper.scrollHeight) : 0;
    document.documentElement.style.setProperty("--kroky-page-pin-reserved-height", `${Math.ceil(reserved)}px`);
    const fixed = stationary ? Math.min(Math.max(0, cap - height - reserved), stationary.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--kroky-page-pin-static-height", `${Math.ceil(fixed)}px`);
    const controls = wrapper ? Math.min(Math.max(0, cap - height - fixed), wrapper.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--kroky-page-pin-offset", `${Math.ceil(height + fixed + controls)}px`);
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
    label = document.createElement("span");
    button.append(icon, label);
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
      currentPage = page;
      container = document.getElementById(page?.containerID);
    }
    const enabled = isEnabled();
    const pinned = enabled && !!page?.id && preferred(page.id);
    button.classList.toggle("d-none", !enabled);
    button.disabled = !enabled || !page?.id;
    button.title = pinned ? "Unpin headers throughout the game" : "Pin headers throughout the game";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(pinned));
    button.classList.toggle("btn-dual", !pinned);
    button.classList.toggle("text-combat-smoke", !pinned);
    button.classList.toggle("btn-info", pinned);
    label.textContent = pinned ? "Unpin" : "Pin";
    if (!pinned) {
      if (wrapper || root.classList.contains("kroky-page-pinned")) restore();
      measure();
      return;
    }
    root.classList.add("kroky-page-pinned");
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
        marker.replaceWith(node);
        moved.delete(node);
      }
      for (const node of selected) {
        if (moved.has(node)) continue;
        const marker = document.createComment("better ui pinned control");
        node.before(marker);
        moved.set(node, marker);
      }
      selected.sort((a, b) => moved.get(a).compareDocumentPosition(moved.get(b)) & 4 ? -1 : 1);
      selected.forEach((node, index) => { if (wrapper.children[index] !== node) wrapper.insertBefore(node, wrapper.children[index] ?? null); });
      wrapper.hidden = selected.length === 0;
      observer?.observe(wrapper);
    }
    observer?.observe(header);
    measure();
  };
  Object.defineProperty(update, "offset", { get: () => parseFloat(document.documentElement.style.getPropertyValue("--kroky-page-pin-offset")) || 0 });
  return update;
}
