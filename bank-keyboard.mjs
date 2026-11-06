const installed = new WeakSet();

export function installBankKeyboard(ctx, game) {
  if (installed.has(game)) return;
  installed.add(game);
  const bound = new WeakSet();
  let menu, currentItem, currentLink, currentIndex = 0, currentTab, ready = false, changing = 0, dirty = false;
  let generation = 0, upgradeReturn, sourceReturn;
  const sourcePopups = new WeakMap();
  const hidden = node => node.hidden || node.classList?.contains("d-none");
  const iconFor = node => node?.closest?.("bank-item-icon");
  const container = () => menu?.tabs[game.bank.selectedBankTab]?.itemContainer;
  const icons = () => {
    const host = container();
    return [...host?.querySelectorAll("bank-item-icon") ?? []].filter(icon => {
      if (!icon.link || menu.itemIcons.get(icon.item) !== icon || game.bank.items.get(icon.item)?.tab !== game.bank.selectedBankTab) return false;
      for (let node = icon; node; node = node.parentElement) {
        if (hidden(node)) return false;
        if (node === host) return true;
      }
      return false;
    });
  };
  const gridFocused = () => {
    const host = container(), active = document.activeElement;
    return !!host && (active === host || host.contains(active) && iconFor(active)?.link === active);
  };
  const pageVisible = () => {
    if (document.visibilityState === "hidden" || game.enableRendering === false || game._isInOnlineLoop === false) return false;
    for (let node = menu; node; node = node.parentElement) if (hidden(node)) return false;
    return true;
  };
  const bankPage = () => game.openPage?.containerID === "bank-container" || game.openPage?.id === "melvorD:Bank";
  const dialogOpen = () => document.body.classList.contains("modal-open") || document.body.classList.contains("swal2-shown") ||
    !!document.querySelector?.("dialog[open]");
  const captureReturn = () => {
    if (!ready || !bankPage() || !pageVisible() || dialogOpen()) return;
    const selected = game.bank.selectedBankItem, opener = document.activeElement, host = container();
    if (!selected || game.bank.items.get(selected.item) !== selected || selected.tab !== game.bank.selectedBankTab || !host ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(opener?.tagName) || opener?.isContentEditable ||
        !host.contains(opener) && !document.getElementById("bank-container")?.contains(opener?.closest?.("bank-selected-item-menu"))) return;
    const index = selected.item === currentItem ? currentIndex : icons().findIndex(icon => icon.item === selected.item);
    return { generation, bank: game.bank, menu, tab: game.bank.selectedBankTab, item: selected.item,
      index: index < 0 ? currentIndex : index, opener };
  };
  const restoreReturn = (origin, dialog) => {
    if (!origin || origin.generation !== generation || origin.bank !== game.bank || origin.menu !== document.getElementById("bank-tab-menu") ||
        origin.tab !== game.bank.selectedBankTab || !bankPage() || !pageVisible() || dialogOpen()) return;
    const active = document.activeElement, selected = game.bank.selectedBankItem;
    if (selected && selected.item !== origin.item || active && active !== document.body && active !== document.documentElement &&
        active !== origin.opener && !dialog?.contains(active)) return;
    currentItem = origin.item; currentIndex = origin.index;
    refresh(true);
  };
  const remember = (icon, knownIndex) => {
    if (!icon) return;
    if (icon?.link === currentLink) return;
    const index = knownIndex ?? icons().indexOf(icon);
    if (index < 0) return;
    if (currentLink) currentLink.tabIndex = -1;
    currentItem = icon.item; currentLink = icon.link; currentIndex = index;
    currentLink.tabIndex = 0; container().tabIndex = -1;
  };
  const keydown = event => {
    if (!pageVisible() || event.altKey || event.ctrlKey || event.metaKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
    for (let node = event.target; node && node !== menu; node = node.parentElement) {
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(node.tagName) || node.isContentEditable) return;
    }
    const host = container(), icon = iconFor(event.target);
    if (!icon || !host?.contains(icon) || !icon.link.contains(event.target)) return;
    const visible = icons().filter(item => item.getClientRects().length), index = visible.indexOf(icon);
    if (index < 0 || !host.getClientRects().length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === "Enter" || event.key === " ") {
      if (!event.repeat) icon.link.click();
      return;
    }
    let next;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") next = visible[index + (event.key === "ArrowLeft" ? -1 : 1)];
    else {
      const source = icon.getBoundingClientRect(), down = event.key === "ArrowDown";
      const candidates = visible.map(item => ({ item, rect: item.getBoundingClientRect() }))
        .filter(({ rect }) => down ? rect.top >= source.bottom - 1 : rect.bottom <= source.top + 1);
      if (candidates.length) {
        const row = (down ? Math.min : Math.max)(...candidates.map(({ rect }) => down ? rect.top : rect.bottom));
        const x = (source.left + source.right) / 2;
        next = candidates.filter(({ rect }) => Math.abs((down ? rect.top : rect.bottom) - row) < 1)
          .reduce((best, candidate) => Math.abs((candidate.rect.left + candidate.rect.right) / 2 - x) <
            Math.abs((best.rect.left + best.rect.right) / 2 - x) ? candidate : best).item;
      }
    }
    if (!next || next === icon) return;
    remember(next, visible.indexOf(next)); next.link.focus({ preventScroll: true }); next.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (game.bank.itemSelectionMode === 0 && game.bank.selectedBankItem !== game.bank.items.get(next.item)) game.bank.selectItemOnClick(next.item);
  };
  const escape = event => {
    if (!ready || event.key !== "Escape" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        ![1, 2].includes(game.bank.itemSelectionMode)) return;
    const page = game.openPage, bankPage = document.getElementById("bank-container");
    if (page && page.id !== "melvorD:Bank" && page.containerID !== "bank-container" ||
        !bankPage?.contains(menu) || !pageVisible()) return;
    if (document.body?.classList.contains("modal-open") || document.body?.classList.contains("swal2-shown")) return;
    for (const target of [event.target, document.activeElement]) for (let node = target; node; node = node.parentElement) {
      if (node.classList?.contains("swal2-container") || node.classList?.contains("modal") && node.classList.contains("show") ||
          node.tagName === "DIALOG" && node.open) return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    const fromGrid = gridFocused();
    game.bank.setItemSelectionMode(0);
    if (fromGrid && game.bank.selectedBankItem) { currentItem = game.bank.selectedBankItem.item; refresh(true); }
  };
  const bind = () => {
    menu = document.getElementById("bank-tab-menu");
    if (!menu || bound.has(menu)) return;
    menu.addEventListener("keydown", keydown, true);
    menu.addEventListener("focusin", event => {
      if (event.target === container() || dirty) refresh(event.target === container());
      remember(iconFor(event.target));
    });
    menu.addEventListener("click", event => { if (dirty) refresh(false); remember(iconFor(event.target)); });
    bound.add(menu);
  };
  const refresh = recoverFocus => {
    if (!ready) return;
    bind(); if (!menu) return;
    if (!pageVisible()) {
      dirty = true;
      if (currentLink) currentLink.tabIndex = -1;
      currentLink = undefined;
      if (container() && container().tabIndex !== 0) container().tabIndex = 0;
      return;
    }
    dirty = false;
    if (currentTab !== game.bank.selectedBankTab) { currentTab = game.bank.selectedBankTab; currentItem = undefined; currentIndex = 0; }
    const visible = icons();
    const selected = game.bank.selectedBankItem;
    const next = visible.find(icon => icon.item === currentItem) ??
      (!currentItem && game.bank.items.get(selected?.item) === selected ? visible.find(icon => icon.item === selected?.item) : undefined) ??
      visible[Math.min(currentIndex, visible.length - 1)];
    if (currentLink && currentLink !== next?.link) currentLink.tabIndex = -1;
    if (next) next.link.tabIndex = 0;
    currentLink = next?.link;
    if (container()) container().tabIndex = next ? -1 : 0;
    currentItem = next?.item; currentIndex = Math.max(0, visible.indexOf(next));
    if (recoverFocus && pageVisible()) {
      if (next) { if (document.activeElement !== next.link) next.link.focus({ preventScroll: true }); }
      else if (container()) {
        container().tabIndex = -1;
        if (document.activeElement !== container()) container().focus({ preventScroll: true });
      }
    }
  };
  if (typeof BankItemIconElement !== "undefined") ctx.patch(BankItemIconElement, "setItem").after(function (result, bank) {
    if (bank === game.bank && this.link !== currentLink && this.link.tabIndex !== -1) this.link.tabIndex = -1;
  });
  const removals = [];
  ctx.patch(BankTabMenuElement, "removeItemFromTab").before(function (item) {
    const icon = this.itemIcons.get(item);
    removals.push({ focused: ready && this === menu && icon?.contains(document.activeElement), removedCurrent: ready && this === menu && icon?.link === currentLink });
  });
  ctx.patch(BankTabMenuElement, "removeItemFromTab").after(function () {
    const removal = removals.pop();
    if (removal?.focused) refresh(true);
    else if (removal?.removedCurrent) {
      currentItem = currentLink = undefined; dirty = true;
      if (container()) container().tabIndex = 0;
    }
  });
  ctx.patch(BankTabMenuElement, "addItemToEndofTab").after(function (result, bank, bankItem) {
    if (!ready || this !== document.getElementById("bank-tab-menu")) return;
    bind(); const icon = this.itemIcons.get(bankItem.item);
    if (!currentLink && bankItem.tab === bank.selectedBankTab && !hidden(icon)) {
      currentLink = icon.link; currentItem = icon.item; currentLink.tabIndex = 0; container().tabIndex = -1;
      if (document.activeElement === container() && pageVisible() && !dialogOpen()) currentLink.focus({ preventScroll: true });
    }
  });
  for (const method of ["loadAllItems", "sortTabByOrder", "moveIconsToNewTab", "selectTab", "updateForSearchResult", "updateForFilterResult", "showAllItems"]) {
    if (typeof BankTabMenuElement.prototype[method] !== "function") continue;
    const calls = [];
    ctx.patch(BankTabMenuElement, method).before(function () {
      const owned = ready && this === document.getElementById("bank-tab-menu");
      if (owned) bind();
      calls.push({ owned, focused: owned && gridFocused() });
      if (owned) changing++;
    });
    ctx.patch(BankTabMenuElement, method).after(function () {
      const call = calls.pop();
      if (call?.owned && --changing === 0) refresh(call.focused);
    });
  }
  const Bank = game.bank.constructor;
  if (typeof Bank.prototype.selectItemOnClick === "function") ctx.patch(Bank, "selectItemOnClick").after(function () {
    const selected = this.selectedBankItem;
    if (this === game.bank && this.itemSelectionMode === 0 && selected && selected.tab === this.selectedBankTab &&
        this.items.get(selected.item) === selected && currentItem !== selected.item && ready && pageVisible()) {
      currentItem = selected.item; refresh(false);
    }
  });
  if (typeof Bank.prototype.fireItemUpgradeModal === "function" && typeof $ === "function") {
    ctx.patch(Bank, "fireItemUpgradeModal").before(function (_upgrade, rootItem) {
      upgradeReturn = undefined;
      const origin = this === game.bank && captureReturn(), modal = document.getElementById("modal-item-upgrade");
      if (origin && origin.item === rootItem && modal) upgradeReturn = { origin, modal };
    });
    $(document).on("hidden.bs.modal.krokyBankKeyboard", "#modal-item-upgrade", event => {
      const pending = upgradeReturn;
      if (!pending || event.target !== pending.modal) return;
      upgradeReturn = undefined; restoreReturn(pending.origin, pending.modal);
    });
  }
  if (typeof Swal !== "undefined" && typeof Swal.fire === "function") {
    const original = Swal.fire;
    Swal.fire = function (...args) {
      if (typeof SwalLocale === "undefined" || this !== SwalLocale) return original.apply(this, args);
      const previousPopup = Swal.getPopup?.();
      const inherited = previousPopup?.contains(document.activeElement) && sourcePopups.get(previousPopup);
      const origin = inherited?.origin ?? captureReturn();
      const result = original.apply(this, args);
      if (!origin || origin.generation !== generation || typeof result?.update !== "function" || !result.params) return result;
      const popup = Swal.getPopup?.();
      const headings = [...popup?.querySelectorAll("h5") ?? []].map(node => node.textContent.trim());
      if (!popup || popup === previousPopup || !headings.includes("SOURCES") || !headings.includes("USES")) return result;
      const pending = { origin, popup }; sourceReturn = pending; sourcePopups.set(popup, pending);
      // Native locale mixins define no didClose; preserve the caller's hook after native focus restoration.
      const didClose = result.params.didClose;
      result.update({ didClose: function (...closeArgs) {
        try { if (typeof didClose === "function") return didClose.apply(this, closeArgs); }
        finally {
          if (sourceReturn === pending) { sourceReturn = undefined; restoreReturn(origin, popup); }
        }
      } });
      return result;
    };
  }
  const reset = () => { generation++; upgradeReturn = sourceReturn = undefined; currentItem = undefined; currentIndex = 0; currentTab = undefined; refresh(false); };
  ctx.onCharacterLoaded(reset);
  if (typeof Game.prototype.decode === "function") ctx.patch(Game, "decode").after(function () { if (this === game) reset(); });
  ctx.onInterfaceReady(() => {
    if (!ready) {
      const style = document.createElement("style");
      style.textContent = '#bank-tab-menu bank-item-icon > a:focus-visible > .bank-img { outline: 2px solid #daa664; outline-offset: 2px; }';
      document.head.append(style); document.addEventListener("keydown", escape, true); ready = true;
    }
    refresh(false);
  });
}
