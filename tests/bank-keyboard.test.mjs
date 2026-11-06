import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBankKeyboard } from "../bank-keyboard.mjs";

afterEach(() => { for (const name of ["document", "BankItemIconElement", "BankTabMenuElement", "Game", "$", "Swal", "SwalLocale"]) delete globalThis[name]; });

function fixture({ lateFilter = false, dialogs = false } = {}) {
  let scans = 0, layouts = 0, writes = 0;
  let modal;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.classes = new Set(); this.listeners = new Map(); this._tabIndex = -1; this.rect = { top: 0, bottom: 64, left: 0, right: 64 }; }
    get tabIndex() { return this._tabIndex; } set tabIndex(value) { this._tabIndex = value; writes++; }
    classList = { contains: name => this.classes.has(name), add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
    remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    closest(tag) { return this.tagName === tag.toUpperCase() ? this : this.parentElement?.closest(tag); }
    querySelectorAll(tag) { scans++; return this.children.flatMap(child => [...(child.tagName === tag.toUpperCase() ? [child] : []), ...child.querySelectorAll(tag)]); }
    addEventListener(type, listener) { const list = this.listeners.get(type) ?? []; list.push(listener); this.listeners.set(type, list); }
    fire(type, event) { for (const listener of this.listeners.get(type) ?? []) { listener(event); if (event.stopped) break; } }
    focus() { document.activeElement = this; menu.fire("focusin", { target: this }); }
    click() { const icon = this.closest("bank-item-icon"); if (icon) bank.selectItemOnClick(icon.item); menu.fire("click", { target: this }); }
    getClientRects() { layouts++; return this.hidden || this.classes.has("d-none") || this.noRect ? [] : [this.rect]; }
    getBoundingClientRect() { layouts++; return this.rect; }
    scrollIntoView() {}
  }
  globalThis.BankItemIconElement = class extends Element {
    constructor() { super("bank-item-icon"); this.link = new Element("a"); this.image = new Element("img"); this.link.append(this.image); this.append(this.link); }
    setItem(owner, entry) { this.item = entry.item; }
  };
  class Bank {
    fireItemUpgradeModal() { modal.classes.add("show"); document.body.classes.add("modal-open"); document.activeElement = modal; }
    selectItemOnClick(item) {
      this.calls.push(item); const entry = this.items.get(item);
      if (this.itemSelectionMode === 0) this.selectedBankItem = this.selectedBankItem === entry ? undefined : entry;
      else if (!(this.itemSelectionMode === 2 && this.locked.has(item))) this.selectedItems.has(entry) ? this.selectedItems.delete(entry) : this.selectedItems.add(entry);
    }
  }
  const bank = Object.assign(new Bank(), { selectedBankTab: 0, selectedBankItem: undefined, selectedItems: new Set(), itemSelectionMode: 0, items: new Map(), calls: [], modeCalls: [], locked: new Set(),
    setItemSelectionMode(mode) { this.modeCalls.push(mode); this.itemSelectionMode = mode; this.selectedItems.clear(); this.shiftAnchor = undefined; },
  });
  globalThis.BankTabMenuElement = class extends Element {
    constructor() { super("bank-tab-menu"); this.itemIcons = new Map(); this.tabs = [0, 1].map(() => ({ itemContainer: new Element("div") })); this.tabs.forEach(tab => this.append(tab.itemContainer)); }
    loadAllItems(owner) { this.itemIcons.clear(); for (const tab of this.tabs) for (const child of [...tab.itemContainer.children]) child.remove(); for (const entry of owner.items.values()) this.addItemToEndofTab(owner, entry); }
    addItemToEndofTab(owner, entry) { const icon = new BankItemIconElement(); this.tabs[entry.tab].itemContainer.append(icon); icon.setItem(owner, entry); this.itemIcons.set(entry.item, icon); }
    removeItemFromTab(item) { this.itemIcons.get(item).remove(); this.itemIcons.delete(item); bank.items.delete(item); }
    selectTab(index) { bank.selectedBankTab = index; this.showAllItems(); }
    sortTabByOrder(tab, order) { for (const item of order) this.tabs[tab].itemContainer.append(this.itemIcons.get(item)); }
    moveIconsToNewTab(entries, tab) { for (const entry of entries) { entry.tab = tab; this.tabs[tab].itemContainer.append(this.itemIcons.get(entry.item)); } }
    updateForSearchResult(found) { this.updateForFilterResult(found); }
    updateForFilterResult(found) { for (const [item, icon] of this.itemIcons) found.has(item) ? icon.classes.delete("d-none") : icon.classes.add("d-none"); }
    showAllItems() { for (const icon of this.itemIcons.values()) icon.classes.delete("d-none"); }
  };
  let menu = new BankTabMenuElement(); const page = new Element("section"); page.append(menu);
  const items = Array.from({ length: 9 }, (_, index) => ({ id: index }));
  items.forEach((item, index) => bank.items.set(item, { item, tab: index < 8 ? 0 : 1 })); menu.loadAllItems(bank);
  globalThis.Game = class { decode() {} }; const game = new Game(); game.bank = bank; game.openPage = { id: "melvorD:Bank", containerID: "bank-container" };
  const hooks = { ready: [], character: [] }, head = new Element("head"), body = new Element("body"), documentEvents = new Map(); body.append(page);
  globalThis.document = { head, body, activeElement: undefined, visibilityState: "visible", createElement: tag => new Element(tag),
    getElementById: id => id === "bank-tab-menu" ? menu : id === "bank-container" ? page : id === "modal-item-upgrade" ? modal : null,
    addEventListener(type, listener) { const listeners = documentEvents.get(type) ?? []; listeners.push(listener); documentEvents.set(type, listeners); } };
  const sidebar = new Element("bank-selected-item-menu"), opener = new Element("button"), hiddenHandlers = [], fireCalls = [];
  sidebar.append(opener); page.append(sidebar); modal = new Element("div"); modal.classes.add("modal"); body.append(modal);
  let popup, returnTarget;
  if (dialogs) {
    globalThis.$ = node => ({ on(name, selector, callback) {
      assert.equal(node, document); assert.equal(name, "hidden.bs.modal.krokyBankKeyboard"); assert.equal(selector, "#modal-item-upgrade"); hiddenHandlers.push(callback);
    } });
    globalThis.Swal = class {
      static getPopup() { return popup; }
      static fire(...args) {
        if (args[0]?.error) throw args[0].error;
        returnTarget ??= document.activeElement;
        popup?.remove(); popup = new Element("div");
        for (const text of args[0]?.html?.includes("SOURCES") ? ["SOURCES", "USES"] : ["Unrelated"]) {
          const heading = new Element("h5"); heading.textContent = text; popup.append(heading);
        }
        const confirm = new Element("button"); popup.append(confirm); body.append(popup); body.classes.add("swal2-shown"); document.activeElement = confirm;
        const instance = { params: args[0], popup, confirm, defaults: this.defaults, updates: [], update(changes) { this.updates.push(changes); this.params = { ...this.params, ...changes }; } };
        fireCalls.push({ receiver: this, args, instance }); return instance;
      }
    };
    globalThis.SwalLocale = class extends Swal {};
  }
  const pipelines = new WeakMap();
  const ctx = { onInterfaceReady: fn => hooks.ready.push(fn), onCharacterLoaded: fn => hooks.character.push(fn), patch(Type, name) {
    let methods = pipelines.get(Type); if (!methods) { methods = new Map(); pipelines.set(Type, methods); }
    let pipeline = methods.get(name);
    if (!pipeline) {
      const original = Type.prototype[name]; assert.equal(typeof original, "function", name);
      pipeline = { original, before: [], after: [], replacements: [] }; methods.set(name, pipeline);
      Type.prototype[name] = function (...args) {
        for (const fn of pipeline.before) fn.apply(this, args);
        let body = pipeline.original;
        for (const fn of pipeline.replacements) { const prior = body; body = function (...values) { return fn.call(this, prior.bind(this), ...values); }; }
        let result = body.apply(this, args);
        for (const fn of pipeline.after) { const replacement = fn.call(this, result, ...args); if (replacement !== undefined) result = replacement; }
        return result;
      };
    }
    return { replace: fn => pipeline.replacements.push(fn), before: fn => pipeline.before.push(fn), after: fn => pipeline.after.push(fn) };
  } };
  let allowed;
  if (lateFilter) ctx.patch(BankTabMenuElement, "showAllItems").after(function () {
    if (allowed) for (const [item, icon] of this.itemIcons) if (!allowed.has(item)) icon.classes.add("d-none");
  });
  installBankKeyboard(ctx, game);
  const ready = () => hooks.ready.forEach(fn => fn()); ready();
  const icon = index => menu.itemIcons.get(items[index]);
  const key = (name, target = document.activeElement, extra = {}) => {
    const event = { target, key: name, prevented: false, ...extra, preventDefault() { this.prevented = this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    for (const listener of documentEvents.get("keydown") ?? []) { listener(event); if (event.stopped) break; }
    if (!event.stopped && menu.contains(target)) menu.fire("keydown", event);
    if (!event.prevented && name === "Enter" && target?.tagName === "A") target.click();
    return event;
  };
  const layout = columns => { menu.tabs[0].itemContainer.children.forEach((node, index) => { const left = index % columns * 80, top = Math.floor(index / columns) * 80; node.rect = { left, right: left + 64, top, bottom: top + 64 }; }); };
  layout(3);
  return { game, bank, items, icon, key, layout, ctx, ready, head, page, hooks, documentEvents, get menu() { return menu; },
    filterAfterNative(items) { allowed = new Set(items); menu.showAllItems(); },
    rebuildRoot() { menu.remove(); menu = new BankTabMenuElement(); page.append(menu); menu.loadAllItems(bank); },
    counts: () => ({ scans, layouts, writes }), resetCounts() { scans = layouts = writes = 0; }, Element, Bank, modal, opener, sidebar, fireCalls,
    openUpgrade() { opener.focus(); bank.fireItemUpgradeModal({}, bank.selectedBankItem?.item); },
    closeUpgrade({ focus = body, target = modal, beforeHidden = () => {} } = {}) {
      modal.classes.delete("show"); body.classes.delete("modal-open"); document.activeElement = focus; beforeHidden();
      for (const fn of hiddenHandlers) fn({ target });
    },
    closeSource(instance, { focus = returnTarget, beforeClose = () => {}, callbackThis = instance, args = [] } = {}) {
      if (popup === instance.popup) { popup.remove(); popup = undefined; body.classes.delete("swal2-shown"); }
      document.activeElement = focus; returnTarget = undefined; beforeClose();
      const callback = instance.params.didClose ?? instance.defaults?.didClose;
      if (typeof callback === "function") return callback.apply(callbackThis, args);
    },
  };
}

test("normal arrows select native neighbours and boundaries retain the current selection", () => {
  const m = fixture(); m.icon(0).link.focus(); m.bank.selectItemOnClick(m.items[0]); m.bank.calls.length = 0;
  assert.equal(m.key("ArrowLeft").prevented, true); assert.equal(m.bank.selectedBankItem.item, m.items[0]); assert.equal(m.bank.calls.length, 0);
  m.key("ArrowRight"); assert.equal(document.activeElement, m.icon(1).link); assert.equal(m.bank.selectedBankItem.item, m.items[1]);
  assert.equal(m.icon(0).link.tabIndex, -1); assert.equal(m.icon(1).link.tabIndex, 0);
  m.icon(0).link.focus(); m.key("ArrowRight"); assert.equal(m.bank.selectedBankItem.item, m.items[1], "moving onto an already selected item cannot toggle it off");
});

for (const mode of [0, 1, 2]) test(`mode${mode}: arrows and single Enter/Space activation keep native semantics`, () => {
  const m = fixture(); m.bank.itemSelectionMode = mode; m.icon(0).link.focus(); m.bank.selectedItems.add(m.bank.items.get(m.items[0]));
  m.key("ArrowRight"); assert.equal(document.activeElement, m.icon(1).link);
  if (mode) assert.deepEqual([...m.bank.selectedItems], [m.bank.items.get(m.items[0])]);
  const before = m.bank.calls.length; m.key("Enter"); assert.equal(m.bank.calls.length, before + 1);
  m.key("Enter", document.activeElement, { repeat: true }); assert.equal(m.bank.calls.length, before + 1);
  m.key(" "); assert.equal(m.bank.calls.length, before + 2);
  if (mode) assert.deepEqual([...m.bank.selectedItems], [m.bank.items.get(m.items[0])]);
  if (mode === 2) { m.bank.locked.add(m.items[1]); m.key("Enter"); assert.equal(m.bank.selectedItems.has(m.bank.items.get(m.items[1])), false); }
});

test("Up and Down follow responsive visual rows and nearest available column", () => {
  const m = fixture(); m.icon(1).link.focus(); m.key("ArrowDown"); assert.equal(document.activeElement, m.icon(4).link);
  m.key("ArrowDown"); assert.equal(document.activeElement, m.icon(7).link);
  const selected = m.bank.selectedBankItem; m.key("ArrowDown"); assert.equal(m.bank.selectedBankItem, selected);
  m.layout(4); m.icon(2).link.focus(); m.key("ArrowDown"); assert.equal(document.activeElement, m.icon(6).link);
  m.key("ArrowUp"); assert.equal(document.activeElement, m.icon(2).link);
});

test("filtered rows, hidden icons, stale clones and other controls are excluded", () => {
  const m = fixture(); m.icon(1).classes.add("d-none"); m.icon(2).hidden = true;
  const row = new m.Element("div"); row.hidden = true; row.append(m.icon(3)); m.menu.tabs[0].itemContainer.append(row);
  const clone = new BankItemIconElement(); clone.setItem(m.bank, m.bank.items.get(m.items[4])); m.menu.tabs[0].itemContainer.append(clone);
  m.icon(0).link.focus(); m.key("ArrowRight"); assert.equal(document.activeElement, m.icon(4).link);
  for (const tag of ["input", "select", "textarea", "button"]) {
    const control = new m.Element(tag); m.icon(4).link.append(control); document.activeElement = control;
    assert.equal(m.key("ArrowRight").prevented, false); assert.equal(m.key("Enter").prevented, false);
  }
  const editable = new m.Element("span"); editable.isContentEditable = true; m.icon(4).link.append(editable);
  assert.equal(m.key("ArrowLeft", editable).prevented, false);
  assert.equal(m.key("ArrowRight", m.icon(4).link, { ctrlKey: true }).prevented, false);
  assert.equal(m.key("ArrowRight", m.menu).prevented, false);
});

test("removal and filtering recover only grid focus without stealing Search focus", () => {
  const m = fixture(); m.icon(2).link.focus(); m.menu.removeItemFromTab(m.items[2]);
  assert.equal(document.activeElement, m.icon(3).link); assert.equal(m.bank.calls.length, 0);
  m.menu.updateForSearchResult(new Set([m.items[0], m.items[6]])); assert.equal(document.activeElement, m.icon(6).link);
  const search = new m.Element("input"); document.activeElement = search;
  m.menu.showAllItems(); m.menu.updateForFilterResult(new Set([m.items[0]])); assert.equal(document.activeElement, search);
  m.menu.removeItemFromTab(m.items[0]); assert.equal(document.activeElement, search);
  m.menu.tabs[0].itemContainer.focus(); assert.equal(document.activeElement, m.menu.tabs[0].itemContainer);
});

test("native hidden item additions/removals do not scan the Bank or read layout", () => {
  const m = fixture(); m.page.classes.add("d-none"); document.activeElement = new m.Element("input"); m.resetCounts();
  for (let index = 0; index < 100; index++) {
    const item = { id: `new${index}` }, entry = { item, tab: 0 }; m.bank.items.set(item, entry);
    m.menu.addItemToEndofTab(m.bank, entry); m.menu.removeItemFromTab(item);
  }
  assert.equal(m.counts().scans, 0); assert.equal(m.counts().layouts, 0);
  m.menu.updateForFilterResult(new Set(m.items)); assert.equal(m.counts().scans, 0);
  m.page.classes.delete("d-none"); m.menu.tabs[0].itemContainer.focus(); assert.equal(document.activeElement, m.icon(0).link);
  m.resetCounts(); m.key("ArrowRight"); assert.ok(m.counts().writes <= 3, JSON.stringify(m.counts()));
});

test("sorting, tab changes, rebuilt menus and character reload keep one listener and one roving entry", () => {
  const m = fixture(); m.icon(1).link.focus(); m.menu.sortTabByOrder(0, [...m.items.slice(0, 8)].reverse());
  m.key("ArrowRight"); assert.equal(document.activeElement, m.icon(0).link);
  m.menu.selectTab(1); assert.equal(document.activeElement, m.icon(8).link);
  installBankKeyboard(m.ctx, m.game); m.ready(); assert.equal(m.head.children.length, 1); assert.equal(m.menu.listeners.get("keydown").length, 1);
  m.rebuildRoot(); assert.equal(m.menu.listeners.get("keydown").length, 1);
  m.hooks.character.forEach(fn => fn()); assert.equal(m.icon(8).link.tabIndex, 0);
  m.game.decode(); assert.equal(m.icon(8).link.tabIndex, 0);
  const other = new Game(); other.decode(); assert.equal(m.icon(8).link.tabIndex, 0);
});

test("the SDK after-hook pipeline applies existing filters before repairing the Bank keyboard entry", () => {
  const m = fixture({ lateFilter: true }), search = new m.Element("input"); document.activeElement = search;
  m.filterAfterNative([m.items[3], m.items[4], m.items[6]]);
  assert.equal(m.icon(0).classes.has("d-none"), true);
  assert.equal(m.icon(0).link.tabIndex, -1, "an item hidden by an earlier after-hook cannot retain the roving entry");
  assert.equal(m.icon(3).link.tabIndex, 0); assert.equal(document.activeElement, search);
  m.icon(3).link.focus(); m.key("ArrowRight"); assert.equal(document.activeElement, m.icon(4).link);
  m.filterAfterNative([m.items[6]]);
  assert.equal(document.activeElement, m.icon(6).link); assert.equal(m.icon(4).link.tabIndex, -1);
  m.filterAfterNative([m.items[3], m.items[8]]); m.menu.selectTab(1);
  assert.equal(document.activeElement, m.icon(8).link, "nested native tab/filter hooks settle before restoring grid focus");
  assert.equal(m.icon(8).link.tabIndex, 0); assert.equal(m.icon(6).link.tabIndex, -1);
  const outside = new BankItemIconElement(); outside.link.focus();
  m.filterAfterNative([m.items[8]]); assert.equal(document.activeElement, outside.link, "a Bank icon outside this grid cannot cause focus recovery");
});

for (const mode of [1, 2]) test(`Escape cancels Bank mode${mode} from grid, Search, controls or header without editing text`, () => {
  const m = fixture(), search = new m.Element("input"), button = new m.Element("button"), header = new m.Element("header"); search.value = "runes";
  for (const target of [m.icon(0).link, search, button, header, document.body]) {
    m.bank.itemSelectionMode = mode; m.bank.selectedItems.add(m.bank.items.get(m.items[0])); m.bank.shiftAnchor = m.items[0];
    const before = m.bank.modeCalls.length, event = m.key("Escape", target);
    assert.equal(event.prevented, true); assert.equal(m.bank.itemSelectionMode, 0); assert.equal(m.bank.selectedItems.size, 0);
    assert.equal(m.bank.shiftAnchor, undefined); assert.equal(m.bank.modeCalls.length, before + 1); assert.equal(search.value, "runes");
  }
  const selected = m.bank.items.get(m.items[0]); m.bank.selectedBankItem = selected;
  assert.equal(m.key("Escape", search).prevented, false); assert.equal(m.bank.selectedBankItem, selected);
});

test("Escape leaves other pages, hidden/offline Bank and open native modals to their own handlers", () => {
  const m = fixture(), search = new m.Element("input");
  const cases = [
    () => { m.game.openPage = { id: "melvorD:Mining" }; },
    () => { m.page.classes.add("d-none"); },
    () => { document.visibilityState = "hidden"; },
    () => { m.game.enableRendering = false; },
    () => { m.game._isInOnlineLoop = false; },
    () => { document.body.classes.add("modal-open"); },
    () => { document.body.classes.add("swal2-shown"); },
  ];
  for (const suppress of cases) {
    m.game.openPage = { id: "melvorD:Bank" }; m.page.classes.clear(); document.body.classes.clear(); document.visibilityState = "visible"; m.game.enableRendering = true; m.game._isInOnlineLoop = true;
    m.bank.itemSelectionMode = 1; suppress(); assert.equal(m.key("Escape", search).prevented, false); assert.equal(m.bank.itemSelectionMode, 1);
  }
  document.body.classes.clear(); m.bank.itemSelectionMode = 2;
  const modal = new m.Element("div"), input = new m.Element("input"); modal.classes.add("modal"); modal.classes.add("show"); modal.append(input);
  assert.equal(m.key("Escape", input).prevented, false); assert.equal(m.bank.itemSelectionMode, 2);
  document.activeElement = input; assert.equal(m.key("Escape", document.body).prevented, false);
  modal.classes.clear(); document.activeElement = search;
  for (const modifier of ["ctrlKey", "altKey", "metaKey", "shiftKey"]) assert.equal(m.key("Escape", search, { [modifier]: true }).prevented, false);
  assert.equal(m.key("Escape", search, { defaultPrevented: true }).prevented, false);
  assert.equal(m.key("Enter", search).prevented, false); assert.equal(m.bank.modeCalls.length, 0);
  const swal = new m.Element("div"); swal.classes.add("swal2-container"); swal.append(input);
  assert.equal(m.key("Escape", input).prevented, false);
  assert.equal(m.key("Escape", search).prevented, true, "a later Escape can cancel the Bank mode after the modal closes");
});

test("Escape binds once across repeated installation, interface readiness and character restoration", () => {
  const m = fixture(); installBankKeyboard(m.ctx, m.game); m.ready(); m.hooks.character.forEach(fn => fn()); m.game.decode(); m.ready();
  assert.equal(m.documentEvents.get("keydown").length, 1);
  m.bank.itemSelectionMode = 1; m.key("Escape", document.body); assert.deepEqual(m.bank.modeCalls, [0]);
});

test("Escape follows a retained normal selection from the grid while Search keeps its focus", () => {
  const m = fixture(), original = m.bank.setItemSelectionMode.bind(m.bank);
  m.bank.setItemSelectionMode = mode => { original(mode); m.bank.selectedBankItem = m.bank.items.get(m.items[1]); };
  m.icon(4).link.focus(); m.bank.itemSelectionMode = 1;
  m.key("Escape"); assert.equal(document.activeElement, m.icon(1).link);
  m.key("ArrowRight"); assert.equal(m.bank.selectedBankItem.item, m.items[2]);
  const search = new m.Element("input"); search.focus(); m.bank.itemSelectionMode = 2;
  m.key("Escape"); assert.equal(document.activeElement, search);
});

test("a retained normal selection becomes the grid tab stop without taking focus from another control", () => {
  const m = fixture(), search = new m.Element("input"); m.icon(4).link.focus(); search.focus();
  m.bank.selectItemOnClick(m.items[1]);
  assert.equal(document.activeElement, search); assert.equal(m.icon(1).link.tabIndex, 0); assert.equal(m.icon(4).link.tabIndex, -1);
  m.icon(1).link.focus(); m.key("ArrowRight"); assert.equal(m.bank.selectedBankItem.item, m.items[2]);
});

test("closing a programmatically opened Upgrade returns to the selected icon and arrows work without another click", () => {
  const m = fixture({ dialogs: true }); m.icon(2).link.focus(); m.bank.selectItemOnClick(m.items[2]); m.bank.calls.length = 0;
  m.openUpgrade(); assert.equal(document.activeElement, m.modal);
  m.closeUpgrade(); assert.equal(document.activeElement, m.icon(2).link); assert.equal(m.bank.calls.length, 0);
  m.key("ArrowRight"); assert.equal(document.activeElement, m.icon(3).link); assert.equal(m.bank.selectedBankItem.item, m.items[3]);
});

test("Sources uses the returned native instance, runs the caller close hook after native focus return, then restores the grid", () => {
  const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.opener.focus();
  const receiver = {}, args = ["closed", 2], seen = [];
  const nativeProvider = () => { SwalLocale.fire({ html: "SOURCES USES", didClose: function (...values) { seen.push([this, values, document.activeElement]); return "native close"; } }); };
  assert.equal(nativeProvider(), undefined, "the provider's local closure need not return its popup instance");
  const { instance } = m.fireCalls.at(-1);
  assert.equal(instance.updates.length, 1); assert.equal(m.fireCalls.at(-1).receiver, SwalLocale);
  assert.equal(m.closeSource(instance, { callbackThis: receiver, args }), "native close");
  assert.deepEqual(seen, [[receiver, args, m.opener]]);
  assert.equal(document.activeElement, m.icon(1).link);
  m.key("ArrowRight"); assert.equal(m.bank.selectedBankItem.item, m.items[2]);
});

test("Sources drilldowns retain their Bank origin while replaced popups cannot restore focus over a successor", () => {
  const m = fixture({ dialogs: true }); m.icon(3).link.focus(); m.bank.selectItemOnClick(m.items[3]); m.opener.focus();
  const first = SwalLocale.fire({ html: "SOURCES USES" }), second = SwalLocale.fire({ html: "SOURCES USES" });
  assert.equal(first, m.fireCalls[0].instance); assert.equal(second, m.fireCalls[1].instance);
  first.params.didClose(); assert.equal(document.activeElement, second.confirm);
  m.closeSource(second); assert.equal(document.activeElement, m.icon(3).link);
});

test("upgrades consuming or filtering their root recover the nearest visible item and an empty grid can receive a later item", () => {
  const m = fixture({ dialogs: true }); m.icon(2).link.focus(); m.bank.selectItemOnClick(m.items[2]); m.openUpgrade();
  m.menu.removeItemFromTab(m.items[2]); m.bank.selectedBankItem = undefined;
  m.closeUpgrade(); assert.equal(document.activeElement, m.icon(3).link);
  m.key("ArrowRight"); assert.equal(m.bank.selectedBankItem.item, m.items[4]);
  m.openUpgrade(); m.menu.updateForFilterResult(new Set([m.items[0], m.items[6]]));
  m.closeUpgrade(); assert.equal(document.activeElement, m.icon(6).link);
  m.bank.selectedBankItem = m.bank.items.get(m.items[6]); m.openUpgrade(); m.menu.updateForFilterResult(new Set());
  m.closeUpgrade(); assert.equal(document.activeElement, m.menu.tabs[0].itemContainer);
  const item = { id: "late output" }, entry = { item, tab: 0 }; m.bank.items.set(item, entry); m.menu.addItemToEndofTab(m.bank, entry);
  assert.equal(document.activeElement, m.menu.itemIcons.get(item).link);
});

test("Upgrade return contexts do not cross pages, tabs, menus, banks, characters, selections or explicit external focus", () => {
  for (const change of [
    m => { m.game.openPage = { id: "melvorD:Mining" }; }, m => { m.bank.selectedBankTab = 1; },
    m => { m.page.classes.add("d-none"); }, () => { document.visibilityState = "hidden"; },
    m => { m.game.enableRendering = false; }, m => { m.game._isInOnlineLoop = false; },
    m => m.rebuildRoot(), m => { m.game.bank = { ...m.bank }; }, m => m.hooks.character.forEach(fn => fn()),
    m => m.game.decode(), m => { m.bank.selectedBankItem = m.bank.items.get(m.items[4]); },
  ]) {
    const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.openUpgrade(); change(m);
    m.closeUpgrade(); assert.equal(document.activeElement, document.body);
  }
  for (const tag of ["input", "button", "a"]) {
    const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.openUpgrade();
    const target = new m.Element(tag); m.closeUpgrade({ focus: target }); assert.equal(document.activeElement, target);
  }
});

test("foreign Upgrade opens and unrelated modal closures cannot consume an owned pending return", () => {
  const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.openUpgrade();
  m.closeUpgrade({ target: new m.Element("div") }); assert.equal(document.activeElement, document.body);
  m.closeUpgrade(); assert.equal(document.activeElement, m.icon(1).link);
  m.openUpgrade(); new m.Bank().fireItemUpgradeModal({}, m.items[1]); m.closeUpgrade(); assert.equal(document.activeElement, document.body);
});

test("other dialogs keep focus and Sources nested under Upgrade return inside it before its own Bank handoff", () => {
  const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.openUpgrade();
  const source = SwalLocale.fire({ html: "SOURCES USES" }); assert.equal(source.updates.length, 0);
  m.closeSource(source); assert.equal(document.activeElement, m.modal);
  m.closeUpgrade(); assert.equal(document.activeElement, m.icon(1).link);
  m.openUpgrade(); m.closeUpgrade({ beforeHidden: () => document.body.classes.add("swal2-shown") });
  assert.equal(document.activeElement, document.body);
});

test("Sources respects native callback errors, language subclass replacement and unrelated mixin defaults", () => {
  const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.opener.focus();
  const error = new Error("native close failure"), source = SwalLocale.fire({ html: "SOURCES USES", didClose() { throw error; } });
  assert.throws(() => m.closeSource(source), value => value === error); assert.equal(document.activeElement, m.icon(1).link);
  globalThis.SwalLocale = class extends Swal {}; m.opener.focus();
  const translated = SwalLocale.fire({ html: "SOURCES USES" }); m.closeSource(translated); assert.equal(document.activeElement, m.icon(1).link);
  class OtherMixin extends Swal {} const calls = []; OtherMixin.defaults = { didClose() { calls.push("default"); } }; m.opener.focus();
  const unrelated = OtherMixin.fire({ html: "SOURCES USES" }); assert.equal(unrelated.updates.length, 0);
  m.closeSource(unrelated); assert.deepEqual(calls, ["default"]); assert.equal(document.activeElement, m.opener);
  assert.throws(() => SwalLocale.fire({ error }), value => value === error);
  m.opener.focus(); const noCallback = SwalLocale.fire({ html: "SOURCES USES", didClose: false });
  m.closeSource(noCallback); assert.equal(document.activeElement, m.icon(1).link);
});

test("Sources close callbacks can hand focus to Search or another popup without a Bank focus steal", () => {
  const m = fixture({ dialogs: true }); m.icon(1).link.focus(); m.bank.selectItemOnClick(m.items[1]); m.opener.focus();
  const search = new m.Element("input");
  const source = SwalLocale.fire({ html: "SOURCES USES", didClose() { document.activeElement = search; } });
  m.closeSource(source); assert.equal(document.activeElement, search);
  m.opener.focus(); const field = new m.Element("input"); m.sidebar.append(field); field.focus();
  const editing = SwalLocale.fire({ html: "SOURCES USES" }); assert.equal(editing.updates.length, 0);
  m.closeSource(editing); assert.equal(document.activeElement, field);
  m.opener.focus(); let next;
  const replaced = SwalLocale.fire({ html: "SOURCES USES", didClose() { next = SwalLocale.fire({ html: "Unrelated" }); } });
  m.closeSource(replaced); assert.equal(document.activeElement, next.confirm);
});
