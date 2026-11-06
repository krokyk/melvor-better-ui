import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBankTabOrder } from "../bank-tab-order.mjs";

afterEach(() => { for (const name of ["document", "Sortable", "BankTabMenuElement", "getSortableDelayOnTouch", "notifyPlayer"]) delete globalThis[name]; });

function fixture({ count = 21, saved, late = false } = {}) {
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.className = ""; }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
    remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
    closest(selector) { return selector.startsWith(".") && this.className.split(" ").includes(selector.slice(1)) || this.tagName.toLowerCase() === selector ? this : this.parentElement?.closest(selector); }
    addEventListener(type, callback) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
    removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(value => value !== callback)); }
    fire(type, target = this, detail = 1) {
      const event = { target, detail, prevented: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
      for (const callback of this.listeners.get(type) ?? []) { callback(event); if (event.stopped) break; }
      if (type === "click" && !event.prevented) target.closest(".nav-item")?.onclick?.();
      return event;
    }
  }
  const instances = [], messages = [], reads = [], writes = [], storage = new Map();
  if (saved !== undefined) storage.set("bank-tab-order", saved);
  class SortableMock {
    constructor(root, options) { this.el = root; this.options = options; instances.push(this); }
    option(key, value) { if (value === undefined) return this.options[key]; this.options[key] = value; }
    destroy() { this.destroyed = true; }
  }
  globalThis.Sortable = SortableMock;
  globalThis.getSortableDelayOnTouch = () => true;
  globalThis.notifyPlayer = (skill, message, type) => messages.push({ skill, message, type });
  class Bank {
    constructor() {
      this.tabCount = count; this.itemSelectionMode = 0; this.selectedBankTab = 0;
      this.itemsByTab = Array.from({ length: count }, (_, id) => [{ item: `item${id}`, tab: id }]);
      this.tabIcons = new Map([[0, "custom-icon"]]); this.defaultItemTabs = new Map([["item", 20]]);
    }
    setItemSelectionMode(mode) { this.itemSelectionMode = mode; return "native mode"; }
  }
  const bank = new Bank();
  globalThis.BankTabMenuElement = class {
    constructor() { this.tabContainer = new Element("ul"); this.tabs = []; this.clicks = []; }
    updateTabCount(owner) {
      for (let id = this.tabs.length; id < owner.tabCount; id++) {
        const tab = new Element("li"), tabLink = new Element("a"), tabImage = new Element("img"), pane = new Element("div"), itemContainer = new Element("div");
        tab.className = "nav-item pointer-enabled"; tabLink.append(tabImage); tab.append(tabLink);
        tab.onclick = () => { owner.selectedBankTab = id; this.clicks.push(id); };
        const nativeDrop = { options: { group: { name: "bankTab", put: ["bankContainer"] }, sort: false, draggable: "bank-item-icon" },
          onAdd: event => { event.bankItem.tab = id; } };
        tab.nativeDrop = nativeDrop;
        this.tabContainer.append(tab); this.tabs.push({ tab, tabLink, tabImage, pane, itemContainer, containerSortable: { native: id } });
      }
      return "native tabs";
    }
  };
  let menu = late ? undefined : new BankTabMenuElement(); menu?.updateTabCount(bank);
  class Game { decode(callback) { callback?.(); return "native decoded"; } scheduleSave() { this.saves++; } }
  const game = new Game(); game.bank = bank; game.attack = {}; game.saves = 0;
  const hooks = { loaded: [], interface: [] }, pipelines = new WeakMap(); let unlocked = false, failStorage = false;
  const ctx = {
    characterStorage: {
      getItem(key) { assert.equal(unlocked, true); reads.push(key); return storage.get(key); },
      setItem(key, value) { assert.equal(unlocked, true); if (failStorage) throw new Error("quota exceeded"); writes.push([key, [...value]]); storage.set(key, [...value]); },
    },
    onCharacterLoaded(callback) { hooks.loaded.push(callback); }, onInterfaceReady(callback) { hooks.interface.push(callback); },
    patch(Type, name) {
      let methods = pipelines.get(Type); if (!methods) { methods = new Map(); pipelines.set(Type, methods); }
      let pipeline = methods.get(name);
      if (!pipeline) {
        pipeline = { original: Type.prototype[name], before: [], after: [], replace: [] }; methods.set(name, pipeline);
        Type.prototype[name] = function (...args) {
          for (const callback of pipeline.before) { const changed = callback.apply(this, args); if (Array.isArray(changed)) args = changed; }
          let index = pipeline.replace.length;
          const next = (...values) => { args = values; return --index < 0 ? pipeline.original.apply(this, args) : pipeline.replace[index].call(this, next, ...args); };
          let result = next(...args);
          for (const callback of pipeline.after) { const changed = callback.call(this, result, ...args); if (changed !== undefined) result = changed; }
          return result;
        };
      }
      return { before: callback => pipeline.before.push(callback), after: callback => pipeline.after.push(callback), replace: callback => pipeline.replace.push(callback) };
    },
  };
  globalThis.document = { getElementById: id => id === "bank-tab-menu" ? menu : undefined };
  installBankTabOrder(ctx, game);
  const load = next => { unlocked = true; if (next !== undefined) storage.set("bank-tab-order", next); hooks.loaded.forEach(callback => callback()); };
  const sortable = () => instances.findLast(instance => instance.el === menu?.tabContainer && !instance.destroyed);
  const ids = () => menu.tabContainer.children.filter(node => node !== Sortable.ghost && node !== Sortable.clone).map(node => menu.tabs.findIndex(entry => entry.tab === node));
  const arrange = order => order.forEach(id => menu.tabContainer.append(menu.tabs[id].tab));
  const start = id => {
    const current = sortable(), root = menu.tabContainer, item = menu.tabs[id].tab;
    if (current.options.disabled || current.options.filter({ target: menu.tabs[id].tabImage }, item)) return false;
    current.options.onStart({ from: root, item }); return { sortable: current, root, item };
  };
  const end = (drag, next, extra = {}) => { arrange(next); drag.sortable.options.onEnd({ from: drag.root, to: drag.root, item: drag.item, ...extra }); };
  return { ctx, game, bank, instances, storage, writes, reads, messages, sortable, ids, arrange, start, end, load,
    get menu() { return menu; }, ready: () => hooks.interface.forEach(callback => callback()),
    failStorage: value => { failStorage = value; },
    replaceMenu() { menu = new BankTabMenuElement(); menu.updateTabCount(bank); },
    replaceBank() { game.bank = new Bank(); menu.updateTabCount(game.bank); return game.bank; },
    Element,
  };
}

test("tab20 can move between tabs11 and12 without changing native tab identity, contents or click routing", () => {
  const f = fixture(); f.load(); const nativeTabs = [...f.menu.tabs], bankItems = f.bank.itemsByTab, icons = f.bank.tabIcons, defaults = f.bank.defaultItemTabs;
  const contents = structuredClone(bankItems);
  const next = [...Array.from({ length: 12 }, (_, id) => id), 20, ...Array.from({ length: 8 }, (_, id) => id + 12)];
  const drag = f.start(20); f.end(drag, next);
  assert.deepEqual(f.ids(), next); assert.deepEqual(f.storage.get("bank-tab-order"), next); assert.equal(f.game.saves, 1);
  assert.deepEqual(f.menu.tabs, nativeTabs); assert.equal(f.bank.itemsByTab, bankItems); assert.equal(f.bank.tabIcons, icons); assert.equal(f.bank.defaultItemTabs, defaults);
  assert.deepEqual(f.bank.itemsByTab, contents);
  assert.equal(Object.hasOwn(f.menu, "isSorting"), false); assert.equal(f.bank.selectedBankTab, 0);
  f.menu.tabContainer.fire("pointerdown", f.menu.tabs[20].tabImage); f.menu.tabContainer.fire("click", f.menu.tabs[20].tabImage);
  assert.equal(f.bank.selectedBankTab, 20); assert.deepEqual(f.menu.clicks, [20]);
  const bankItem = { tab: 0 }; f.menu.tabs[11].tab.nativeDrop.onAdd({ bankItem }); assert.equal(bankItem.tab, 11);
  assert.deepEqual(f.menu.tabs[11].tab.nativeDrop.options.group, { name: "bankTab", put: ["bankContainer"] });
});

test("loading and newly appended tabs merge native IDs without writing, and the native fallback is explicit per character", () => {
  const f = fixture({ count: 4, saved: [3, 1, 0] }); f.ready(); assert.equal(f.reads.length, 0); assert.equal(f.instances.length, 0);
  f.load(); assert.deepEqual(f.ids(), [3, 1, 0, 2]); assert.equal(f.writes.length, 0);
  f.bank.tabCount = 6; assert.equal(f.menu.updateTabCount(f.bank), "native tabs"); assert.deepEqual(f.ids(), [3, 1, 0, 2, 4, 5]);
  assert.equal(f.writes.length, 0); assert.equal(f.instances.length, 1);
  f.storage.delete("bank-tab-order"); assert.equal(f.game.decode(), "native decoded"); assert.deepEqual(f.ids(), [0, 1, 2, 3, 4, 5]);
  assert.equal(f.writes.length, 0);
});

test("invalid preferences fall back to native order without mutating or overwriting the saved value", () => {
  for (const saved of [null, {}, "2,1,0", [0, 0, 1], [-1], [3], [1.5], ["1"], [undefined], Array(1)]) {
    const f = fixture({ count: 3, saved }); f.load(); assert.deepEqual(f.ids(), [0, 1, 2]);
    assert.equal(f.storage.get("bank-tab-order"), saved); assert.equal(f.writes.length, 0);
  }
});

test("failed storage rolls the visual order back before reporting, then a later successful drag can persist", () => {
  const f = fixture({ count: 4, saved: [2, 0, 3, 1] }); f.load(); const before = f.ids();
  const drag = f.start(3); f.failStorage(true); f.end(drag, [3, 2, 0, 1]);
  assert.deepEqual(f.ids(), before); assert.deepEqual(f.storage.get("bank-tab-order"), before); assert.equal(f.game.saves, 0);
  assert.equal(f.messages.length, 1); assert.match(f.messages[0].message, /previous order was restored.*quota exceeded/); assert.equal(f.messages[0].type, "danger");
  f.failStorage(false); f.end(f.start(3), [3, 2, 0, 1]); assert.deepEqual(f.storage.get("bank-tab-order"), [3, 2, 0, 1]);
  assert.equal(f.game.saves, 1);
});

test("Move and Sell modes disable only parent tab reordering and foreign item/root drags are rejected", () => {
  const f = fixture({ count: 3 }); f.load(); const parent = f.sortable(), root = f.menu.tabContainer, first = f.menu.tabs[0].tab;
  assert.deepEqual(parent.options.group, { name: "kroky-bank-tab-order", pull: false, put: false }); assert.equal(parent.options.draggable, "> .nav-item");
  for (const mode of [1, 2]) {
    assert.equal(f.bank.setItemSelectionMode(mode), "native mode"); assert.equal(parent.options.disabled, true); assert.equal(f.start(0), false);
    assert.equal(f.menu.tabs[0].tab.nativeDrop.options.sort, false);
  }
  f.bank.setItemSelectionMode(0); assert.equal(parent.options.disabled, false);
  const item = new f.Element("bank-item-icon"), other = new f.Element("ul"); first.append(item);
  assert.equal(parent.options.filter({ target: item }, first), true);
  assert.equal(parent.options.onMove({ from: root, to: root, dragged: item, related: first }), false);
  assert.equal(parent.options.onMove({ from: root, to: other, dragged: first, related: first }), false);
  assert.equal(parent.options.onMove({ from: other, to: root, dragged: first, related: first }), false);
  assert.equal(parent.options.onMove({ from: root, to: root, dragged: first, related: f.menu.tabs[1].tab }), true);
  f.end(f.start(0), [1, 0, 2], { to: other }); assert.deepEqual(f.ids(), [0, 1, 2]);
  const canceled = f.start(0); f.bank.setItemSelectionMode(1); f.end(canceled, [1, 0, 2]); assert.deepEqual(f.ids(), [0, 1, 2]);
  assert.equal(f.writes.length, 0);
});

test("a post-drag click is suppressed while the next intended click and keyboard activation retain native selection", () => {
  const f = fixture({ count: 3 }); f.load(); f.end(f.start(2), [2, 0, 1]);
  assert.equal(f.menu.tabContainer.fire("click", f.menu.tabs[2].tabImage).prevented, true); assert.deepEqual(f.menu.clicks, []);
  f.menu.tabContainer.fire("pointerdown", f.menu.tabs[1].tabImage); f.menu.tabContainer.fire("click", f.menu.tabs[1].tabImage);
  assert.deepEqual(f.menu.clicks, [1]);
  f.end(f.start(0), [0, 2, 1]); assert.equal(f.menu.tabContainer.fire("click", f.menu.tabs[0].tabImage, 0).prevented, false);
  assert.deepEqual(f.menu.clicks, [1, 0]);
});

test("QuickLoad invalidates an old drag and restores only the newly decoded character's order", () => {
  const f = fixture({ count: 4, saved: [3, 2, 1, 0] }); f.load(); const old = f.start(3);
  f.game.decode(() => f.storage.set("bank-tab-order", [1, 3, 0, 2])); assert.deepEqual(f.ids(), [1, 3, 0, 2]);
  f.end(old, [2, 1, 0, 3]); assert.deepEqual(f.ids(), [1, 3, 0, 2]); assert.equal(f.writes.length, 0);
  const fresh = f.start(1); f.end(fresh, [0, 1, 2, 3]); assert.deepEqual(f.storage.get("bank-tab-order"), [0, 1, 2, 3]);
});

test("parent Sortable is reused, a replaced native root gets one instance, and stale callbacks cannot write", () => {
  const f = fixture({ count: 3 }); f.load(); const old = f.start(2), original = f.sortable();
  installBankTabOrder(f.ctx, f.game); f.ready(); f.menu.updateTabCount(f.bank); assert.equal(f.instances.length, 1);
  f.replaceMenu(); assert.equal(original.destroyed, true); assert.equal(f.instances.length, 2);
  assert.equal(original.el.listeners.get("click").length, 0);
  old.sortable.options.onEnd({ from: old.root, to: old.root, item: old.item }); assert.equal(f.writes.length, 0);
  assert.deepEqual(f.ids(), [0, 1, 2]);
});

test("late menus and initial decode wait for character storage, and no-change drops avoid save writes", () => {
  const f = fixture({ count: 3, saved: [2, 0, 1], late: true }); f.game.decode(); f.ready(); assert.equal(f.reads.length, 0);
  f.load(); assert.equal(f.instances.length, 0); f.replaceMenu(); assert.deepEqual(f.ids(), [2, 0, 1]);
  f.end(f.start(2), [2, 0, 1]); assert.equal(f.writes.length, 0); assert.equal(f.game.saves, 0);
});

test("a new main Bank instance on the same native tab strip replaces its old parent binding", () => {
  const f = fixture({ count: 3 }); f.load(); const old = f.start(2), original = f.sortable(), root = f.menu.tabContainer;
  const bank = f.replaceBank(); assert.equal(f.menu.tabContainer, root); assert.equal(original.destroyed, true);
  assert.equal(f.instances.length, 2); assert.equal(root.listeners.get("click").length, 1); assert.equal(root.listeners.get("pointerdown").length, 1);
  old.sortable.options.onEnd({ from: root, to: root, item: old.item }); assert.equal(f.writes.length, 0);
  bank.setItemSelectionMode(1); assert.equal(f.sortable().options.disabled, true);
  bank.setItemSelectionMode(0); f.end(f.start(2), [2, 0, 1]); assert.deepEqual(f.storage.get("bank-tab-order"), [2, 0, 1]);
});

test("QuickLoad cannot save old tab IDs while the native menu awaits a smaller character's rebuild", () => {
  const f = fixture({ count: 4, saved: [3, 2, 1, 0] }); f.load();
  f.game.decode(() => { f.bank.tabCount = 2; f.bank.itemsByTab.length = 2; f.storage.set("bank-tab-order", [1, 0]); });
  assert.equal(f.start(3), false); assert.equal(f.writes.length, 0);
  f.replaceMenu(); assert.deepEqual(f.ids(), [1, 0]); assert.ok(f.start(1));
});

test("fallback ghosts are excluded and a mid-drag new tab never loses its native identity", () => {
  const f = fixture({ count: 3 }); f.load(); const ghost = new f.Element("li"); ghost.className = "nav-item";
  Sortable.ghost = ghost; f.menu.tabContainer.append(ghost); const drag = f.start(2); assert.ok(drag);
  f.bank.tabCount = 4; f.menu.updateTabCount(f.bank); f.end(drag, [2, 0, 1, 3]);
  assert.deepEqual(f.ids(), [0, 1, 2, 3]); assert.equal(f.writes.length, 0); assert.equal(f.menu.tabs[3].tab.nativeDrop.options.group.name, "bankTab");
});
