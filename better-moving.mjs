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
.kroky-bank-sort .fa-exchange-alt { transform: rotate(90deg) scaleX(-1); }
.kroky-bank-deselect-all:disabled { opacity: .12; }
.kroky-bank-move-tab { position: relative; z-index: 0; }
#bank-tab-menu .kroky-bank-move-target { z-index: 1; }
#bank-tab-menu .kroky-bank-move-target::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; background-color: rgba(218, 166, 100, .5); box-shadow: 0 0 8px 3px rgba(218, 166, 100, .5); animation: kroky-bank-move-pulse 1.4s ease-in-out infinite; }
.kroky-bank-move-tab:focus-visible { outline: 2px solid #daa664; outline-offset: -2px; }
#bank-tab-menu .nav-tabs-block:has(.kroky-bank-move-tab) { padding: 8px 3px 3px; }
@keyframes kroky-bank-move-pulse {
  0%, 100% { opacity: .02; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { #bank-tab-menu .kroky-bank-move-target::before { animation: none; } }
`;

export function installBetterMoving(ctx, game) {
  const settings = ctx.settings.section("General");
  let enabled = false, compact = false, ready = false, anchor, deselectButton, sortState;
  const labels = new Map();
  const modeAttributes = new Map();
  const tabAttributes = new Map();
  const moving = bank => enabled && bank === game.bank && bank.itemSelectionMode === 1;

  function updateToolbar(options, bank) {
    document.getElementById("bank-container")?.classList.toggle("kroky-compact-bank-controls", compact);
    const tools = compact && document.querySelector("#bank-tab-menu .bg-dark-bank-info ul");
    if (compact && options?.sortButton && tools && !sortState) {
      const button = options.sortButton;
      const marker = document.createComment("better ui bank sort");
      const entry = document.createElement("li");
      entry.className = "kroky-bank-sort";
      sortState = { button, marker, entry, children: [...button.childNodes],
        attributes: ["class", "title", "aria-label"].map(name => [name, button.getAttribute(name)]) };
      button.before(marker);
      const icon = document.createElement("i");
      icon.className = "fa fa-exchange-alt";
      icon.setAttribute("aria-hidden", "true");
      button.replaceChildren(icon);
      button.classList.remove("m-1");
      button.classList.add("btn-sm", "p-1");
      button.setAttribute("title", "Sort Bank");
      button.setAttribute("aria-label", "Sort Bank");
      entry.append(button);
      tools.prepend(entry);
    } else if (!compact && sortState) {
      const { button, marker, entry, children, attributes } = sortState;
      button.replaceChildren(...children);
      for (const [name, value] of attributes) value === null ? button.removeAttribute(name) : button.setAttribute(name, value);
      marker.replaceWith(button);
      entry.remove();
      sortState = undefined;
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
        bank.setItemSelectionMode(0);
        bank.setItemSelectionMode(mode);
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
    document.getElementById("bank-tab-menu")?.tabs.forEach(({ tabLink }, tabID) => {
      tabLink.classList.toggle("kroky-bank-move-target", hasSelection && tabID !== bank.selectedBankTab);
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

  ctx.patch(Bank, "setItemSelectionMode").after(() => { anchor = undefined; update(); });
  ctx.patch(Bank, "toggleItemSelected").after(update);
  ctx.patch(Bank, "removeItemQuantity").after(function () { if (moving(this)) pruneSelection(this); });
  ctx.patch(BankTabMenuElement, "updateTabCount").after(update);
  ctx.patch(BankTabMenuElement, "selectTab").replace(function (original, tabID, bank) {
    if (moving(bank)) pruneSelection(bank);
    if (moving(bank) && bank.selectedItems.size > 0) return bank.moveSelectedItemsToTab(tabID);
    const result = original(tabID, bank);
    anchor = undefined;
    update();
    return result;
  });
  ctx.patch(Bank, "moveSelectedItemsToTab").replace(function (original, tabID) {
    if (!moving(this)) return original(tabID);
    if (!Number.isInteger(tabID) || tabID < 0 || tabID >= this.tabCount || tabID === this.selectedBankTab) return;
    pruneSelection(this);
    if (this.selectedItems.size === 0) return;
    const result = original(tabID);
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
    if (ready && (enabled || wasEnabled) && game.bank.itemSelectionMode === 1) game.bank.setItemSelectionMode(0);
    update();
  };
  ctx.onCharacterLoaded(restore);
  ctx.patch(Game, "decode").after(function () { if (this === game) restore(); });
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
  });
}
