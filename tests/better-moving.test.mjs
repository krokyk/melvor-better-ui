import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBetterMoving } from "../better-moving.mjs";

afterEach(() => {
  for (const name of ["document", "Bank", "BankTabMenuElement", "Game"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div", text = "") {
    this.tagName = tag.toUpperCase(); this.childNodes = []; this.text = text; this.classes = new Set(); this.listeners = new Map(); this.attributes = new Map();
    this.classList = {
      contains: name => this.classes.has(name),
      add: name => this.classes.add(name), remove: name => this.classes.delete(name),
      toggle: (name, value = !this.classes.has(name)) => { value ? this.classes.add(name) : this.classes.delete(name); return value; },
    };
  }
  get textContent() { return this.text + this.childNodes.map(node => node.textContent).join(""); }
  set textContent(value) { this.text = String(value); this.childNodes = []; }
  get className() { return [...this.classes].join(" "); }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get children() { return this.childNodes; }
  append(...nodes) {
    for (let node of nodes) {
      if (typeof node === "string") node = new Element("#text", node);
      if (node.parentElement) node.parentElement.childNodes.splice(node.parentElement.childNodes.indexOf(node), 1);
      node.parentElement = this; this.childNodes.push(node);
    }
  }
  replaceChildren(...nodes) { this.childNodes.forEach(node => { node.parentElement = undefined; }); this.text = ""; this.childNodes = []; this.append(...nodes); }
  querySelector(selector) { return this.childNodes.find(node => node.matches(selector)) ?? this.childNodes.map(node => node.querySelector(selector)).find(Boolean) ?? null; }
  matches(selector) { return selector.startsWith(".") ? this.classes.has(selector.slice(1)) : this.tagName === selector.toUpperCase(); }
  closest(tag) { return this.tagName === tag.toUpperCase() ? this : this.parentElement?.closest(tag) ?? null; }
  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)); }
  addEventListener(name, callback) { const handlers = this.listeners.get(name) ?? []; handlers.push(callback); this.listeners.set(name, handlers); }
  click() {
    if (this.disabled) return;
    const event = { target: this };
    this.onclick?.(event);
    for (const callback of this.listeners.get("click") ?? []) callback(event);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  remove() {
    if (this.parentElement) this.parentElement.childNodes.splice(this.parentElement.childNodes.indexOf(this), 1);
    this.parentElement = undefined;
  }
}

function fixture(enabled, load = true) {
  const fields = new Map(), values = new Map(), hooks = { character: [], interface: [] };
  const calls = { bulk: 0, single: 0, navigation: 0 }, head = new Element("head");
  let tabs;
  const options = new Element("bank-options-menu"), menu = new Element("bank-move-mode-menu"), banner = new Element("p"), alert = new Element(), toolbar = new Element();
  const nativeButtonLabel = new Element("lang-string", "Move items to new Tab");
  const nativeSellButtonLabel = new Element("lang-string", "Toggle Sell Mode");
  const nativeBannerLabel = new Element("lang-string", "Move Item Mode is active! Move items to a new Tab.");
  options.moveModeButton = new Element("button"); options.moveModeButton.append(nativeButtonLabel);
  options.moveModeButton.classList.add("btn-secondary");
  options.sellModeButton = new Element("button"); options.sellModeButton.append(nativeSellButtonLabel);
  options.sellModeButton.classList.add("btn-danger");
  toolbar.append(new Element("button", "Sort"), options.moveModeButton, options.sellModeButton); options.append(toolbar);
  alert.classList.add("alert"); alert.classList.add("alert-secondary");
  banner.append(nativeBannerLabel); alert.append(banner); menu.append(alert);
  const items = ["Logs", "Ore", "Fish", "Seed"].map((name, index) => ({ item: { id: name }, quantity: index + 10, tab: index === 3 ? 1 : 0 }));
  const icons = new Map(items.map(entry => {
    const icon = new Element("bank-item-icon"); icon.item = entry.item; icon.append(new Element("img"));
    return [entry, icon];
  }));
  const reindex = bank => bank.itemsByTab.forEach((tab, tabID) => tab.forEach((item, index) => {
    item.tabPosition = index;
    tabs?.tabs[tabID]?.itemContainer.append(icons.get(item));
  }));
  globalThis.Bank = class {
    constructor() {
      this.itemsByTab = [items.slice(0, 3), items.slice(3), []]; this.items = new Map(items.map(item => [item.item, item]));
      this.selectedBankTab = 0; this.selectedItems = new Set(); this.itemSelectionMode = 0; this.selectedBankItem = items[0];
      reindex(this);
    }
    get tabCount() { return this.itemsByTab.length; }
    moveItemModeOnClick() { this.setItemSelectionMode(this.itemSelectionMode === 1 ? 0 : 1); }
    sellItemModeOnClick() { this.setItemSelectionMode(this.itemSelectionMode === 2 ? 0 : 2); }
    setItemSelectionMode(mode) {
      if (this.itemSelectionMode === mode) return;
      this.selectedItems.clear(); this.itemSelectionMode = mode;
      if (mode !== 0) this.selectedBankItem = undefined;
      menu.classList.toggle("d-none", mode !== 1);
    }
    toggleItemSelected(item) { this.selectedItems.has(item) ? this.selectedItems.delete(item) : this.selectedItems.add(item); }
    toggleItemForMoving(item) { this.toggleItemSelected(item); }
    selectItemOnClick(item) {
      if (this.itemSelectionMode === 0) this.selectedBankItem = this.items.get(item);
      else if (this.itemSelectionMode === 1) this.toggleItemForMoving(this.items.get(item));
      else this.toggleItemSelected(this.items.get(item));
    }
    moveSelectedItemsToTab(tabID) {
      calls.bulk++;
      if (this.itemSelectionMode !== 1) return;
      const ordered = [...this.selectedItems].sort((a, b) => a.tabPosition - b.tabPosition);
      for (const entry of ordered) {
        if (entry.tab === tabID) continue;
        const source = this.itemsByTab[entry.tab]; source.splice(source.indexOf(entry), 1);
        entry.tab = tabID; this.itemsByTab[tabID].push(entry);
      }
      reindex(this); this.setItemSelectionMode(0);
      return "bulk move";
    }
    moveItemToNewTab(sourceID, tabID, index) {
      calls.single++;
      const [entry] = this.itemsByTab[sourceID].splice(index, 1);
      entry.tab = tabID; this.itemsByTab[tabID].push(entry); reindex(this);
      return "single move";
    }
    removeItemQuantity(item, quantity) {
      const entry = this.items.get(item); if (!entry) return;
      entry.quantity -= quantity;
      if (entry.quantity <= 0) {
        this.items.delete(item); this.itemsByTab[entry.tab].splice(entry.tabPosition, 1); icons.get(entry).remove();
      }
      reindex(this);
    }
  };
  globalThis.BankTabMenuElement = class extends Element {
    constructor() {
      super("bank-tab-menu");
      this.tabs = Array.from({ length: 3 }, () => ({ tabLink: new Element("a"), itemContainer: new Element("div") }));
      this.tabs.forEach(tab => this.append(tab.tabLink, tab.itemContainer));
    }
    selectTab(tabID, bank) { calls.navigation++; bank.selectedBankTab = tabID; return "navigate"; }
    updateTabCount(bank) {
      while (this.tabs.length < bank.tabCount) {
        const tab = { tabLink: new Element("a"), itemContainer: new Element("div") };
        this.tabs.push(tab); this.append(tab.tabLink, tab.itemContainer);
      }
    }
  };
  tabs = new BankTabMenuElement();
  const nodes = new Map([["main-bank-options", options], ["main-bank-move-mode", menu], ["bank-tab-menu", tabs]]);
  globalThis.document = { head, getElementById: id => nodes.get(id) ?? null, createElement: tag => new Element(tag) };
  globalThis.Game = class {
    constructor() { this.bank = new Bank(); }
    decode(preference) { values.set("better-moving-enabled", preference); }
  };
  const game = new Game();
  menu.updateSelectionCount = () => {};
  const ctx = {
    settings: { section(name) {
      assert.equal(name, "General");
      return { add(field) { fields.set(field.name, field); values.set(field.name, enabled ?? field.default); }, get: name => values.get(name) };
    } },
    onCharacterLoaded: callback => hooks.character.push(callback),
    onInterfaceReady: callback => hooks.interface.push(callback),
    patch(Type, method) {
      const original = Type.prototype[method];
      assert.equal(typeof original, "function", `native ${method} exists`);
      return {
        after(callback) { Type.prototype[method] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; }; },
        replace(callback) { Type.prototype[method] = function (...args) { return callback.call(this, original.bind(this), ...args); }; },
      };
    },
  };
  installBetterMoving(ctx, game);
  const field = fields.get("better-moving-enabled"); assert.ok(field);
  const toggle = value => { const result = field.onChange(value); if (result === undefined || result === true) values.set(field.name, value); return result; };
  const loaded = () => hooks.character.forEach(callback => callback());
  const ready = () => hooks.interface.forEach(callback => callback());
  const click = (entry, shiftKey = false) => {
    const event = { target: icons.get(entry).children[0], shiftKey, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; } };
    for (const callback of tabs.listeners.get("click") ?? []) { callback(event); if (event.stopped) break; }
    if (!event.stopped) game.bank.selectItemOnClick(entry.item);
    return event;
  };
  const key = (tabID, value) => {
    const event = { target: tabs.tabs[tabID].tabLink, key: value, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; } };
    for (const callback of tabs.listeners.get("keydown") ?? []) { callback(event); if (event.stopped) break; }
    return event;
  };
  if (load) { loaded(); ready(); }
  return { game, bank: game.bank, items, icons, click, key, calls, tabs, field, toggle, values, loaded, ready, head, menu, banner, alert, toolbar, button: options.moveModeButton, sellButton: options.sellModeButton, nativeButtonLabel, nativeSellButtonLabel, nativeBannerLabel };
}

const targets = f => f.tabs.tabs.map(tab => tab.tabLink.classList.contains("kroky-bank-move-target"));
const select = (f, ...items) => items.forEach(entry => f.bank.selectItemOnClick(entry.item));

test("Better Moving defaults off, validates its setting, and leaves native navigation and transfers intact", () => {
  const f = fixture();
  assert.equal(f.field.label, "Better Moving"); assert.equal(f.field.type, "switch"); assert.equal(f.field.default, false);
  assert.equal(typeof f.toggle("true"), "string"); assert.equal(f.values.get(f.field.name), false);
  assert.equal(f.button.childNodes[0], f.nativeButtonLabel);
  assert.equal(f.sellButton.childNodes[0], f.nativeSellButtonLabel);
  f.bank.moveItemModeOnClick(); select(f, f.items[0], f.items[1]);
  assert.deepEqual(targets(f), [false, false, false]);
  assert.equal(f.tabs.selectTab(1, f.bank), "navigate");
  assert.equal(f.bank.moveSelectedItemsToTab(2), "bulk move");
  assert.equal(f.bank.itemSelectionMode, 0); assert.equal(f.bank.selectedBankTab, 1);
  assert.deepEqual(f.calls, { bulk: 1, single: 0, navigation: 1 });
});

test("mode buttons use Cancel only for the active mode and retain their stable-width class", () => {
  const f = fixture(true);
  const check = mode => {
    assert.equal(f.bank.itemSelectionMode, mode);
    assert.equal(f.button.textContent, mode === 1 ? "Cancel Move Mode" : "Toggle Move Mode");
    assert.equal(f.sellButton.textContent, mode === 2 ? "Cancel Sell Mode" : "Toggle Sell Mode");
    for (const button of [f.button, f.sellButton]) assert.equal(button.classList.contains("kroky-bank-mode-toggle"), true);
  };
  check(0);
  for (let i = 0; i < 2; i++) {
    f.bank.moveItemModeOnClick(); check(1);
    f.bank.moveItemModeOnClick(); check(0);
    f.bank.sellItemModeOnClick(); check(2);
    f.bank.moveItemModeOnClick(); check(1);
    f.bank.sellItemModeOnClick(); check(2);
    f.bank.sellItemModeOnClick(); check(0);
  }
});

test("Deselect All is the single rightmost blue action, visible only in enabled selection modes", () => {
  const f = fixture(true), button = f.toolbar.querySelector(".kroky-bank-deselect-all");
  assert.ok(button); assert.equal(button.textContent, "Deselect All");
  assert.equal(button.classList.contains("btn-info"), true); assert.equal(f.toolbar.children.at(-1), button);
  assert.equal(button.hidden, true); assert.equal(button.disabled, true);
  for (const mode of [1, 2]) {
    f.bank.setItemSelectionMode(mode);
    assert.equal(button.hidden, false); assert.equal(button.disabled, true);
    select(f, f.items[0]); assert.equal(button.disabled, false);
    select(f, f.items[0]); assert.equal(button.disabled, true);
  }
  f.bank.setItemSelectionMode(0); assert.equal(button.hidden, true);
  f.bank.setItemSelectionMode(2); select(f, f.items[0]); f.toggle(false);
  assert.equal(button.hidden, true); assert.equal(button.disabled, true);
  assert.deepEqual([...f.bank.selectedItems], [f.items[0]], "disabling the option preserves native Sell selection");
  f.toggle(true); f.ready(); f.loaded(); f.game.decode(true);
  assert.equal(f.toolbar.querySelector(".kroky-bank-deselect-all"), button);
  assert.equal(f.toolbar.children.filter(node => node.classList.contains("kroky-bank-deselect-all")).length, 1);
  assert.equal(f.toolbar.children.at(-1), button);
});

test("Deselect All clears both selection modes without moving items or ending the active mode", () => {
  for (const mode of [1, 2]) {
    const f = fixture(true), button = f.toolbar.querySelector(".kroky-bank-deselect-all");
    const quantities = f.items.map(entry => entry.quantity), order = f.bank.itemsByTab.map(tab => [...tab]);
    f.bank.setItemSelectionMode(mode); select(f, f.items[0], f.items[2]);
    assert.equal(button.disabled, false); button.click();
    assert.equal(f.bank.selectedItems.size, 0); assert.equal(f.bank.itemSelectionMode, mode);
    assert.equal(f.bank.selectedBankTab, 0); assert.equal(f.bank.selectedBankItem, undefined);
    assert.equal(button.hidden, false); assert.equal(button.disabled, true);
    assert.deepEqual(targets(f), [false, false, false]);
    assert.deepEqual(f.items.map(entry => entry.quantity), quantities); assert.deepEqual(f.bank.itemsByTab, order);
    assert.deepEqual(f.calls, { bulk: 0, single: 0, navigation: 0 });
    button.click(); assert.equal(f.bank.itemSelectionMode, mode);
  }
});

test("Deselect All clears the Shift-click anchor along with the selected group", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  f.click(f.items[0]); f.click(f.items[2], true); assert.equal(f.bank.selectedItems.size, 3);
  f.toolbar.querySelector(".kroky-bank-deselect-all").click();
  assert.equal(f.click(f.items[1], true).stopped, false, "a cleared range cannot retain its previous anchor");
  assert.deepEqual([...f.bank.selectedItems], [f.items[1]]); assert.equal(f.bank.itemSelectionMode, 1);
});

test("selection highlights destinations only while Move Mode has items and never opens item details", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  assert.equal(f.button.textContent, "Cancel Move Mode"); assert.equal(f.banner.textContent, "Move Mode is active!");
  assert.equal(f.menu.classList.contains("kroky-better-moving"), true);
  assert.equal(f.bank.selectedBankItem, undefined); assert.deepEqual(targets(f), [false, false, false]);
  select(f, f.items[0], f.items[2]);
  assert.equal(f.bank.selectedItems.size, 2); assert.equal(f.bank.selectedBankItem, undefined);
  assert.deepEqual(targets(f), [false, true, true]);
  select(f, f.items[0], f.items[2]); assert.deepEqual(targets(f), [false, false, false]);
  assert.equal(f.tabs.selectTab(1, f.bank), "navigate"); assert.equal(f.bank.selectedBankTab, 1);
  select(f, f.items[3]); assert.deepEqual(targets(f), [true, false, true]);
  f.bank.sellItemModeOnClick(); assert.equal(f.bank.itemSelectionMode, 2);
  assert.equal(f.bank.selectedItems.size, 0); assert.deepEqual(targets(f), [false, false, false]);
  f.bank.moveItemModeOnClick(); assert.equal(f.bank.itemSelectionMode, 1);
});

test("clicking a destination moves the full selected stacks, stays at the source, and keeps mode active", () => {
  const f = fixture(true), quantities = f.items.map(item => item.quantity);
  f.bank.moveItemModeOnClick(); select(f, f.items[2], f.items[0]);
  assert.equal(f.tabs.selectTab(1, f.bank), "bulk move");
  assert.deepEqual(f.bank.itemsByTab.map(tab => tab.map(entry => entry.item.id)), [["Ore"], ["Seed", "Logs", "Fish"], []]);
  assert.deepEqual(f.items.map(item => item.quantity), quantities);
  assert.equal(f.bank.selectedBankTab, 0); assert.equal(f.bank.itemSelectionMode, 1); assert.equal(f.bank.selectedItems.size, 0);
  assert.equal(f.button.textContent, "Cancel Move Mode"); assert.equal(f.sellButton.textContent, "Toggle Sell Mode");
  assert.equal(f.bank.selectedBankItem, undefined); assert.deepEqual(targets(f), [false, false, false]);
  assert.deepEqual(f.calls, { bulk: 1, single: 0, navigation: 0 });
  f.tabs.selectTab(2, f.bank); assert.equal(f.bank.selectedBankTab, 2); assert.equal(f.calls.bulk, 1);
});

test("dragging a selected item transfers its whole group once and leaves native unselected drags available", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0], f.items[1]);
  assert.equal(f.bank.moveItemToNewTab(0, 2, 1), "bulk move");
  assert.deepEqual(f.bank.itemsByTab[2].map(item => item.item.id), ["Logs", "Ore"]);
  assert.equal(f.bank.selectedBankTab, 0); assert.equal(f.bank.itemSelectionMode, 1); assert.equal(f.bank.selectedItems.size, 0);
  assert.equal(f.calls.bulk, 1); assert.equal(f.calls.single, 0); assert.deepEqual(targets(f), [false, false, false]);
  assert.equal(f.bank.moveItemToNewTab(0, 1, 0), "single move");
  assert.equal(f.calls.single, 1); assert.equal(f.items[2].tab, 1);
});

test("current or invalid destinations and an empty selection cannot trigger a transfer", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  f.bank.moveSelectedItemsToTab(1); assert.equal(f.calls.bulk, 0);
  select(f, f.items[0]);
  for (const tabID of [0, -1, 3, 1.5, "1", undefined]) f.bank.moveSelectedItemsToTab(tabID);
  f.tabs.selectTab(0, f.bank);
  assert.equal(f.calls.bulk, 0); assert.equal(f.calls.navigation, 0); assert.equal(f.bank.selectedItems.size, 1);
  assert.equal(f.items[0].tab, 0); assert.deepEqual(targets(f), [false, true, true]);
});

test("disabling exits move mode, clears selection, and restores the exact native label nodes", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  assert.equal(f.alert.classList.contains("alert-danger"), true); assert.equal(f.alert.classList.contains("alert-secondary"), false);
  assert.equal(f.toggle(false), undefined);
  assert.equal(f.bank.itemSelectionMode, 0); assert.equal(f.bank.selectedItems.size, 0);
  assert.deepEqual(targets(f), [false, false, false]); assert.equal(f.menu.classList.contains("kroky-better-moving"), false);
  assert.equal(f.button.childNodes[0], f.nativeButtonLabel); assert.equal(f.banner.childNodes[0], f.nativeBannerLabel);
  assert.equal(f.sellButton.childNodes[0], f.nativeSellButtonLabel);
  assert.equal(f.alert.classList.contains("alert-danger"), false); assert.equal(f.alert.classList.contains("alert-secondary"), true);
  for (const button of [f.button, f.sellButton]) assert.equal(button.classList.contains("kroky-bank-mode-toggle"), false);
  assert.equal(f.button.classList.contains("btn-secondary"), true); assert.equal(f.sellButton.classList.contains("btn-danger"), true);
  f.toggle(true);
  assert.equal(f.alert.classList.contains("alert-danger"), true); assert.equal(f.alert.classList.contains("alert-secondary"), false);
  f.toggle(false);
  assert.equal(f.button.childNodes.length, 1); assert.equal(f.button.childNodes[0], f.nativeButtonLabel);
  assert.equal(f.sellButton.childNodes.length, 1); assert.equal(f.sellButton.childNodes[0], f.nativeSellButtonLabel);
});

test("disabling during Sell Mode restores its native label without changing the native mode", () => {
  const f = fixture(true); f.bank.sellItemModeOnClick();
  assert.equal(f.sellButton.textContent, "Cancel Sell Mode");
  f.toggle(false);
  assert.equal(f.bank.itemSelectionMode, 2);
  assert.equal(f.button.childNodes[0], f.nativeButtonLabel); assert.equal(f.sellButton.childNodes[0], f.nativeSellButtonLabel);
  assert.equal(f.sellButton.classList.contains("kroky-bank-mode-toggle"), false);
  f.toggle(true);
  assert.equal(f.button.textContent, "Toggle Move Mode"); assert.equal(f.sellButton.textContent, "Cancel Sell Mode");
  f.toggle(false);
  assert.equal(f.sellButton.childNodes.length, 1); assert.equal(f.sellButton.childNodes[0], f.nativeSellButtonLabel);
});

test("character settings and QuickLoad restore without leaking a previous move selection or duplicating styles", () => {
  const f = fixture(true, false);
  f.loaded(); assert.equal(f.button.childNodes[0], f.nativeButtonLabel);
  f.ready(); assert.equal(f.button.textContent, "Toggle Move Mode");
  f.bank.moveItemModeOnClick(); select(f, f.items[0]); f.game.decode(false);
  assert.equal(f.bank.itemSelectionMode, 0); assert.equal(f.bank.selectedItems.size, 0); assert.deepEqual(targets(f), [false, false, false]);
  assert.equal(f.button.childNodes[0], f.nativeButtonLabel);
  f.values.set(f.field.name, true); f.loaded(); assert.equal(f.button.textContent, "Toggle Move Mode");
  f.bank.moveItemModeOnClick(); select(f, f.items[1]); f.game.decode(true);
  assert.equal(f.bank.itemSelectionMode, 0); assert.equal(f.bank.selectedItems.size, 0);
  f.ready(); assert.equal(f.head.childNodes.length, 1);
  f.game.decode(undefined); assert.equal(f.button.childNodes[0], f.nativeButtonLabel);
});

test("new bank tabs inherit the current selection highlight", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  f.bank.itemsByTab.push([]); f.tabs.updateTabCount(f.bank);
  assert.deepEqual(targets(f), [false, true, true, true]);
  f.bank.moveItemModeOnClick(); assert.deepEqual(targets(f), [false, false, false, false]);
});

test("Shift-click selects inclusive forward and backward ranges from the last ordinary click", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  f.click(f.items[0]); const forward = f.click(f.items[2], true);
  assert.equal(forward.prevented, true); assert.equal(forward.stopped, true);
  assert.deepEqual([...f.bank.selectedItems], f.items.slice(0, 3));
  f.click(f.items[1], true);
  assert.equal(f.bank.selectedItems.size, 3, "repeating Shift-click adds without toggling already selected items");
  f.bank.moveItemModeOnClick(); f.bank.moveItemModeOnClick();
  f.click(f.items[2]); f.click(f.items[0], true);
  assert.deepEqual(new Set(f.bank.selectedItems), new Set(f.items.slice(0, 3)));
  assert.equal(f.bank.selectedBankItem, undefined);
});

test("Shift-click follows visible row order, skips filtered items, and keeps existing selections", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  f.tabs.tabs[0].itemContainer.replaceChildren(f.icons.get(f.items[2]), f.icons.get(f.items[1]), f.icons.get(f.items[0]));
  f.icons.get(f.items[1]).classList.add("d-none");
  f.click(f.items[2]); f.click(f.items[0], true);
  assert.deepEqual(new Set(f.bank.selectedItems), new Set([f.items[2], f.items[0]]));
  assert.equal(f.bank.selectedItems.has(f.items[1]), false, "filtered intermediate items are not selected");
  f.icons.get(f.items[1]).classList.remove("d-none");
  f.click(f.items[1]); f.click(f.items[0], true);
  assert.equal(f.bank.selectedItems.size, 3, "a prior selection outside the new range is retained");
});

test("Shift-click without an anchor uses native toggling and range anchors never cross modes or tabs", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  assert.equal(f.click(f.items[0], true).stopped, false);
  assert.equal(f.bank.selectedItems.size, 1);
  f.click(f.items[2]); f.bank.moveItemModeOnClick(); f.bank.moveItemModeOnClick();
  assert.equal(f.click(f.items[0], true).stopped, false); assert.equal(f.bank.selectedItems.size, 1);
  f.click(f.items[0]); f.tabs.selectTab(1, f.bank);
  assert.equal(f.click(f.items[3], true).stopped, false); assert.deepEqual([...f.bank.selectedItems], [f.items[3]]);
  f.bank.sellItemModeOnClick();
  assert.equal(f.click(f.items[3], true).stopped, false, "Sell Mode retains native item toggling");
  f.toggle(false); f.bank.setItemSelectionMode(0);
  assert.equal(f.click(f.items[0], true).stopped, false); assert.equal(f.bank.selectedBankItem, f.items[0]);
});

test("a selected stack consumed during production cannot move its former neighbor", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0], f.items[1]);
  f.bank.items.delete(f.items[0].item); f.bank.itemsByTab[0].shift();
  f.bank.itemsByTab[0].forEach((entry, index) => { entry.tabPosition = index; });
  f.tabs.selectTab(2, f.bank);
  assert.deepEqual(f.bank.itemsByTab.map(tab => tab.map(entry => entry.item.id)), [["Fish"], ["Seed"], ["Ore"]]);
  assert.equal(f.calls.bulk, 1); assert.equal(f.bank.selectedItems.size, 0); assert.equal(f.bank.itemSelectionMode, 1);
});

test("same-tab drops retain the native reorder path without clearing the move selection", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0], f.items[1]);
  assert.equal(f.bank.moveItemToNewTab(0, 0, 0), "single move");
  assert.deepEqual(f.bank.itemsByTab[0].map(entry => entry.item.id), ["Ore", "Fish", "Logs"]);
  assert.equal(f.bank.selectedItems.size, 2); assert.equal(f.calls.bulk, 0); assert.equal(f.calls.single, 1);
});

test("consuming selected stacks refreshes targets immediately and empty selections navigate on the next click", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0], f.items[1]);
  f.bank.removeItemQuantity(f.items[0].item, f.items[0].quantity);
  assert.deepEqual([...f.bank.selectedItems], [f.items[1]]); assert.deepEqual(targets(f), [false, true, true]);
  f.bank.removeItemQuantity(f.items[1].item, f.items[1].quantity);
  assert.equal(f.bank.selectedItems.size, 0); assert.deepEqual(targets(f), [false, false, false]);
  assert.equal(f.tabs.selectTab(1, f.bank), "navigate");
  assert.equal(f.bank.selectedBankTab, 1); assert.equal(f.calls.bulk, 0); assert.equal(f.bank.itemSelectionMode, 1);
});

test("tab clicks prune a stale selection before deciding whether to move or navigate", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  f.bank.items.delete(f.items[0].item); f.bank.itemsByTab[0].shift();
  f.bank.itemsByTab[0].forEach((entry, index) => { entry.tabPosition = index; });
  assert.equal(f.tabs.selectTab(2, f.bank), "navigate");
  assert.equal(f.bank.selectedBankTab, 2); assert.equal(f.bank.selectedItems.size, 0); assert.equal(f.calls.bulk, 0);
  assert.deepEqual(targets(f), [false, false, false]);
});

test("unrelated Game decoding cannot change the active character's Better Moving setting or selection", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  const other = new Game(); other.decode(false);
  assert.equal(f.button.textContent, "Cancel Move Mode"); assert.equal(f.bank.itemSelectionMode, 1);
  assert.deepEqual([...f.bank.selectedItems], [f.items[0]]); assert.deepEqual(targets(f), [false, true, true]);
});

test("disabled Better Moving leaves vanilla move selection intact during character restore and QuickLoad", () => {
  const f = fixture(); f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  f.loaded(); f.game.decode(false);
  assert.equal(f.bank.itemSelectionMode, 1); assert.deepEqual([...f.bank.selectedItems], [f.items[0]]);
  assert.equal(f.button.childNodes[0], f.nativeButtonLabel); assert.deepEqual(targets(f), [false, false, false]);
});

test("keyboard users can navigate empty tabs and transfer selected groups without leaving the source", () => {
  const f = fixture(true); f.bank.moveItemModeOnClick();
  const link = f.tabs.tabs[1].tabLink;
  assert.equal(link.getAttribute("tabindex"), "0"); assert.equal(link.getAttribute("role"), "tab");
  assert.equal(link.getAttribute("aria-label"), "Bank tab 1"); assert.equal(link.getAttribute("aria-selected"), "false");
  assert.equal(f.key(1, "Enter").prevented, true); assert.equal(f.bank.selectedBankTab, 1);
  assert.equal(link.getAttribute("aria-selected"), "true");
  select(f, f.items[3]);
  assert.equal(f.tabs.tabs[2].tabLink.getAttribute("aria-label"), "Move selected items to bank tab 2");
  assert.equal(f.key(2, " ").prevented, true); assert.equal(f.items[3].tab, 2);
  assert.equal(f.bank.selectedBankTab, 1); assert.equal(f.bank.itemSelectionMode, 1); assert.equal(f.bank.selectedItems.size, 0);
  assert.equal(f.tabs.tabs[2].tabLink.getAttribute("aria-label"), "Bank tab 2");
  assert.equal(f.key(0, "Escape").prevented, false); assert.equal(f.bank.selectedBankTab, 1);
});

test("disabling restores existing tab accessibility attributes and removes added attributes", () => {
  const f = fixture(true, false), first = f.tabs.tabs[0].tabLink, second = f.tabs.tabs[1].tabLink;
  const original = { tabindex: "-1", role: "button", "aria-label": "Native label", "aria-selected": "mixed" };
  for (const [name, value] of Object.entries(original)) first.setAttribute(name, value);
  f.loaded(); f.ready(); f.toggle(false);
  for (const [name, value] of Object.entries(original)) {
    assert.equal(first.getAttribute(name), value); assert.equal(second.getAttribute(name), null);
  }
  assert.equal(f.key(2, "Enter").prevented, false); assert.equal(f.bank.selectedBankTab, 0);
});
