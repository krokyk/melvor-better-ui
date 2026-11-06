const storageKey = "bank-tab-order";
const installed = new WeakSet();

export function installBankTabOrder(ctx, game) {
  if (installed.has(game)) return;
  installed.add(game);
  let ready = false, loading = false, generation = 0, order = [], state;
  const valid = (value, count) => Array.isArray(value) && value.length <= count &&
    Array.from(value).every(id => Number.isSafeInteger(id) && id >= 0 && id < count) && new Set(value).size === value.length;
  const mergedOrder = count => {
    const saved = valid(order, count) ? order : [];
    const seen = new Set(saved);
    return [...saved, ...Array.from({ length: count }, (_, id) => id).filter(id => !seen.has(id))];
  };
  const domOrder = current => [...current.root.children]
    .filter(node => node !== Sortable.ghost && node !== Sortable.clone).map(node => current.ids.get(node));
  const applyOrder = (current, next) => {
    const actual = domOrder(current);
    if (actual.length === next.length && actual.every((id, index) => id === next[index])) return;
    for (const id of next) current.root.append(current.menu.tabs[id].tab);
  };
  const canDrag = current => ready && !loading && current === state && game.bank === current.bank &&
    document.getElementById("bank-tab-menu") === current.menu && current.ids.size === game.bank.tabCount && game.bank.itemSelectionMode === 0;
  const sync = () => {
    if (!ready || loading || typeof Sortable !== "function") return;
    const menu = document.getElementById("bank-tab-menu"), count = game.bank.tabCount;
    if (!menu?.tabContainer || menu.tabs.length !== count) return;
    if (state?.root !== menu.tabContainer || state?.bank !== game.bank) {
      if (state) {
        state.sortable.destroy();
        state.root.removeEventListener("pointerdown", state.pointerDown, true);
        state.root.removeEventListener("click", state.click, true);
      }
      const current = { menu, root: menu.tabContainer, bank: game.bank, ids: new Map(), drag: undefined, suppressClick: false };
      state = current;
      current.pointerDown = () => { current.suppressClick = false; };
      current.click = event => {
        if (!current.suppressClick || event.detail === 0 || !current.ids.has(event.target.closest?.(".nav-item"))) return;
        current.suppressClick = false;
        event.preventDefault(); event.stopImmediatePropagation();
      };
      current.root.addEventListener("pointerdown", current.pointerDown, true);
      current.root.addEventListener("click", current.click, true);
      current.sortable = new Sortable(current.root, {
        group: { name: "kroky-bank-tab-order", pull: false, put: false },
        draggable: "> .nav-item", delay: 200, delayOnTouchOnly: getSortableDelayOnTouch(), preventOnFilter: false,
        filter(event, tab) { return !canDrag(current) || !current.ids.has(tab) || tab.parentElement !== current.root || !!event.target.closest?.("bank-item-icon"); },
        onMove(event) {
          return canDrag(current) && event.from === current.root && event.to === current.root && current.ids.has(event.dragged) &&
            (event.related === current.root || current.ids.has(event.related));
        },
        onStart(event) {
          if (!canDrag(current) || event.from !== current.root || !current.ids.has(event.item)) return;
          const before = domOrder(current);
          if (!valid(before, current.ids.size) || before.length !== current.ids.size) return;
          current.drag = { generation, item: event.item, before };
          current.suppressClick = true;
        },
        onEnd(event) {
          const drag = current.drag; current.drag = undefined;
          if (!drag) return;
          if (drag.generation !== generation || current !== state) { sync(); return; }
          const next = domOrder(current), count = current.ids.size;
          if (!canDrag(current) || event.from !== current.root || event.to !== current.root || event.item !== drag.item ||
              drag.before.length !== count || !valid(next, count) || next.length !== count) {
            applyOrder(current, mergedOrder(count)); return;
          }
          if (next.every((id, index) => id === drag.before[index])) return;
          try { ctx.characterStorage.setItem(storageKey, next); }
          catch (error) {
            applyOrder(current, drag.before);
            const message = `Could not save Bank tab order. The previous order was restored. ${error.message}`;
            if (typeof notifyPlayer === "function") notifyPlayer(game.attack, message, "danger");
            else console.warn(`[Better UI] ${message}`, error);
            return;
          }
          order = [...next];
          game.scheduleSave();
        },
      });
    }
    state.ids = new Map(menu.tabs.map(({ tab }, id) => [tab, id]));
    applyOrder(state, mergedOrder(count));
    state.sortable.option("disabled", game.bank.itemSelectionMode !== 0);
  };
  const load = () => {
    generation++; loading = false; ready = true;
    try {
      const saved = ctx.characterStorage.getItem(storageKey);
      order = valid(saved, game.bank.tabCount) ? [...saved] : [];
    } catch (error) { order = []; console.warn("[Better UI] Could not read Bank tab order.", error); }
    sync();
  };
  ctx.onCharacterLoaded(load);
  ctx.onInterfaceReady(sync);
  ctx.patch(BankTabMenuElement, "updateTabCount").after(function (_result, bank) {
    if (bank === game.bank && this === document.getElementById("bank-tab-menu")) sync();
  });
  ctx.patch(game.bank.constructor, "setItemSelectionMode").after(function () {
    if (this === game.bank && state) state.sortable.option("disabled", !canDrag(state));
  });
  ctx.patch(game.constructor, "decode").before(function () { if (this === game) { generation++; loading = true; } });
  ctx.patch(game.constructor, "decode").after(function () {
    if (this !== game) return;
    loading = false;
    if (ready) load();
  });
}
