import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBetterMoving } from "../better-moving.mjs";

afterEach(() => {
  for (const name of ["document", "Bank", "BankTabMenuElement", "BankItemIconElement", "Game", "EquipmentItem", "WeaponItem", "FoodItem", "RuneItem", "PotionItem", "AmmoTypeID", "requestAnimationFrame", "cancelAnimationFrame"]) delete globalThis[name];
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
  get nextSibling() { return this.parentElement?.childNodes[this.parentElement.childNodes.indexOf(this) + 1]; }
  before(node) { const parent = this.parentElement; node.remove(); node.parentElement = parent; parent.childNodes.splice(parent.childNodes.indexOf(this), 0, node); }
  append(...nodes) {
    for (let node of nodes) {
      if (typeof node === "string") node = new Element("#text", node);
      if (node.parentElement) node.parentElement.childNodes.splice(node.parentElement.childNodes.indexOf(node), 1);
      node.parentElement = this; this.childNodes.push(node);
    }
  }
  replaceChildren(...nodes) { this.childNodes.forEach(node => { node.parentElement = undefined; }); this.text = ""; this.childNodes = []; this.append(...nodes); }
  querySelector(selector) { return this.childNodes.find(node => node.matches(selector)) ?? this.childNodes.map(node => node.querySelector(selector)).find(Boolean) ?? null; }
  querySelectorAll(selector) { return this.childNodes.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
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
  const sellSelections = [], normalSelections = [];
  let tabs;
  const options = new Element("bank-options-menu"), menu = new Element("bank-move-mode-menu"), banner = new Element("p"), alert = new Element(), toolbar = new Element();
  const nativeButtonLabel = new Element("lang-string", "Move items to new Tab");
  const nativeSellButtonLabel = new Element("lang-string", "Toggle Sell Mode");
  const nativeBannerLabel = new Element("lang-string", "Move Item Mode is active! Move items to a new Tab.");
  options.moveModeButton = new Element("button"); options.moveModeButton.append(nativeButtonLabel);
  options.moveModeButton.classList.add("btn-secondary");
  options.sellModeButton = new Element("button"); options.sellModeButton.append(nativeSellButtonLabel);
  options.sellModeButton.classList.add("btn-danger");
  options.sortButton = new Element("button", "Sort");
  toolbar.append(options.sortButton, options.moveModeButton, options.sellModeButton); options.append(toolbar);
  alert.classList.add("alert"); alert.classList.add("alert-secondary");
  banner.append(nativeBannerLabel); alert.append(banner); menu.append(alert);
  const items = ["Logs", "Ore", "Fish", "Seed"].map((name, index) => ({ item: { id: name }, quantity: index + 10, tab: index === 3 ? 1 : 0 }));
  for (const entry of items) entry.item.type = entry.item.id;
  class Item { constructor(name, type) { this.id = this.name = name; this.type = type; } }
  globalThis.EquipmentItem = class extends Item {
    constructor(name, slots = ["melvorD:Weapon"]) { super(name, "Equipment"); this.slots = slots; this.equipRequirements = []; }
    fitsInSlot(id) { return this.slots.includes(id); }
  };
  globalThis.WeaponItem = class extends EquipmentItem { occupiesSlot(id) { return id === "melvorD:Shield" && !!this.twoHanded; } };
  globalThis.FoodItem = class extends Item {}; globalThis.RuneItem = class extends Item {}; globalThis.PotionItem = class extends Item {};
  const filterItems = { weapon: new WeaponItem("Sword"), twoHand: new WeaponItem("Greatsword"), shield: new EquipmentItem("Shield", ["melvorD:Shield"]),
    body: new EquipmentItem("Body", ["melvorD:Body"]), food: new FoodItem("Food", "Food"), rune: new RuneItem("Rune", "Rune"),
    potion: new PotionItem("Potion", "Potion"), artefact: new PotionItem("Artefact potion", "Potion") };
  filterItems.twoHand.twoHanded = true; filterItems.artefact.isArtefact = true;
  const catalogue = [...items.map(entry => entry.item), ...Object.values(filterItems)];
  for (const { item } of items) for (let index = 1; index < 10; index++) catalogue.push({ id: `${item.id}-${index}`, type: item.type });
  globalThis.BankItemIconElement = class extends Element {
    constructor() { super("bank-item-icon"); this.append(new Element("img")); }
    setItem(bank, bankItem) { this.item = bankItem.item; this.onclick = () => bank.selectItemOnClick(bankItem.item); return "native item"; }
  };
  const icons = new Map(items.map(entry => {
    const icon = new BankItemIconElement(); icon.item = entry.item;
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
      this.lockedItems = new Set();
      this.itemUpgrades = new Map(); this.currentSearchQuery = ""; this.filterChanges = 0;
      reindex(this);
    }
    get tabCount() { return this.itemsByTab.length; }
    shouldShowBasedOnFilter(item) { return !item.nativeHidden; }
    toggleItemLock(bankItem) { this.lockedItems.has(bankItem.item) ? this.lockedItems.delete(bankItem.item) : this.lockedItems.add(bankItem.item); }
    onBankSearchChange(query) {
      this.currentSearchQuery = query;
      if (query.trim() === "") tabs.showAllItems();
      else tabs.updateForFilterResult(new Set([...this.items.keys()].filter(item => item.id.toLowerCase().includes(query.toLowerCase()) && this.shouldShowBasedOnFilter(item))));
    }
    // Native Show All fast path and filtered/search path from Bank.onBankFilterChange.
    onBankFilterChange() {
      this.filterChanges++;
      if (this.game.settings.bankFilterShowAll && this.currentSearchQuery === "") tabs.showAllItems();
      else {
        const itemsToShow = new Set();
        this.items.forEach(bankItem => { if (this.shouldShowBasedOnFilter(bankItem.item)) itemsToShow.add(bankItem.item); });
        tabs.updateForFilterResult(itemsToShow);
        if (this.currentSearchQuery !== "") this.onBankSearchChange(this.currentSearchQuery);
      }
    }
    moveItemModeOnClick() { this.setItemSelectionMode(this.itemSelectionMode === 1 ? 0 : 1); }
    sellItemModeOnClick() { this.setItemSelectionMode(this.itemSelectionMode === 2 ? 0 : 2); }
    setItemSelectionMode(mode, ...args) {
      if (this.modeFailure) throw this.modeFailure;
      this.modeArgs = [mode, ...args];
      if (this.itemSelectionMode === mode) return;
      this.selectedItems.clear(); this.itemSelectionMode = mode;
      if (mode !== 0) this.selectedBankItem = undefined;
      menu.classList.toggle("d-none", mode !== 1);
      if (this.nativeModeSelection) this.selectedBankItem = this.nativeModeSelection;
      return this.modeResult;
    }
    toggleItemSelected(item) { this.selectedItems.has(item) ? this.selectedItems.delete(item) : this.selectedItems.add(item); }
    toggleItemForMoving(item) { this.toggleItemSelected(item); }
    toggleItemForSelling(item) {
      if (this.lockedItems.has(item.item)) return;
      this.toggleItemSelected(item); sellSelections.push([...this.selectedItems]);
    }
    selectItemOnClick(item) {
      if (this.itemSelectionMode === 0) { normalSelections.push(item); this.selectedBankItem = this.items.get(item); }
      else if (this.itemSelectionMode === 1) this.toggleItemForMoving(this.items.get(item));
      else this.toggleItemForSelling(this.items.get(item));
    }
    moveSelectedItemsToTab(tabID) {
      calls.bulk++;
      if (this.moveFailure) throw this.moveFailure;
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
      this.itemIcons = new Map(items.map(entry => [entry.item, icons.get(entry)]));
      this.tabs.forEach(tab => this.append(tab.tabLink, tab.itemContainer));
    }
    selectTab(tabID, bank) { calls.navigation++; bank.selectedBankTab = tabID; bank.onBankFilterChange(); return "navigate"; }
    addItemToEndofTab(bank, entry) { const icon = new BankItemIconElement(); this.tabs[entry.tab].itemContainer.append(icon); icon.setItem(bank, entry); this.itemIcons.set(entry.item, icon); }
    removeItemFromTab(item) { this.itemIcons.get(item)?.remove(); this.itemIcons.delete(item); }
    moveIconsToNewTab(entries, tabID) { for (const entry of entries) { const icon = this.itemIcons.get(entry.item); if (icon) this.tabs[tabID].itemContainer.append(icon); } }
    loadAllItems(bank) { for (const entries of bank.itemsByTab) for (const entry of entries) this.addItemToEndofTab(bank, entry); }
    updateForFilterResult(foundItems) { this.itemIcons.forEach((icon, item) => icon.classList.toggle("d-none", !foundItems.has(item))); }
    showAllItems() {
      this.itemIcons.forEach((icon, item) => { if (game.settings.bankFilterShowAll || game.bank.shouldShowBasedOnFilter(item)) icon.classList.remove("d-none"); });
      this.searchResultTabs = undefined;
    }
    updateTabCount(bank) {
      while (this.tabs.length < bank.tabCount) {
        const tab = { tabLink: new Element("a"), itemContainer: new Element("div") };
        this.tabs.push(tab); this.append(tab.tabLink, tab.itemContainer);
      }
    }
  };
  tabs = new BankTabMenuElement();
  const nodes = new Map([["main-bank-options", options], ["main-bank-move-mode", menu], ["bank-tab-menu", tabs]]);
  globalThis.document = { head, visibilityState: "visible", getElementById: id => nodes.get(id) ?? null, createElement: tag => new Element(tag) };
  globalThis.Game = class {
    constructor() {
      this.settings = { bankFilterShowAll: true }; this.bank = new Bank(); this.bank.game = this; this.events = new Map();
      this.items = { allObjects: catalogue }; this.equipmentSlots = { allObjects: ["Weapon", "Shield", "Body"].map(name => ({ id: `melvorD:${name}`, emptyName: name })) };
      this.openPage = { containerID: "bank-container" }; this._isInOnlineLoop = true;
    }
    on(name, callback) { const listeners = this.events.get(name) ?? []; listeners.push(callback); this.events.set(name, listeners); }
    emit(name) { for (const callback of this.events.get(name) ?? []) callback(); }
    checkRequirements(requirements, notify) { assert.equal(notify, false); return requirements.every(requirement => requirement.met); }
    decode(preference) { values.set("better-moving-enabled", preference); }
  };
  const game = new Game();
  menu.updateSelectionCount = () => {};
  const patchers = new WeakMap();
  const ctx = {
    settings: { section(name) {
      assert.equal(name, "General");
      return { add(field) { fields.set(field.name, field); values.set(field.name, field.name === "better-moving-enabled" ? enabled ?? field.default : field.default); }, get: name => values.get(name) };
    } },
    onCharacterLoaded: callback => hooks.character.push(callback),
    onInterfaceReady: callback => hooks.interface.push(callback),
    patch(Type, method) {
      let methods = patchers.get(Type); if (!methods) patchers.set(Type, methods = new Map());
      let patch = methods.get(method);
      if (!patch) {
        const original = Type.prototype[method]; assert.equal(typeof original, "function", `native ${method} exists`);
        patch = { before: [], after: [], replace: [] }; methods.set(method, patch);
        Type.prototype[method] = function (...args) {
          for (const callback of patch.before) callback.apply(this, args);
          let invoke = original.bind(this); for (const callback of patch.replace) { const next = invoke; invoke = (...values) => callback.call(this, next, ...values); }
          const result = invoke(...args); for (const callback of patch.after) callback.call(this, result, ...args); return result;
        };
      }
      return { before: callback => patch.before.push(callback), after: callback => patch.after.push(callback), replace: callback => patch.replace.push(callback) };
    },
  };
  const flushFilters = installBetterMoving(ctx, game);
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
  const filterControl = (group, value) => toolbar.querySelectorAll("input").find(node => node.getAttribute("data-filter-group") === group && node.value === value)
    ?? toolbar.querySelectorAll("select").find(node => node.getAttribute("data-filter-group") === group);
  const choose = (group, value) => {
    const control = filterControl(group, value); assert.ok(control, `${group}: ${value}`);
    if (control.type === "radio") for (const node of toolbar.querySelectorAll("input")) if (node.name === control.name) node.checked = node === control;
    control.value = value; control.listeners.get("change")[0]();
  };
  const addItem = (item, tab = 0) => { const entry = { item, quantity: 1, tab, tabPosition: game.bank.itemsByTab[tab].length };
    game.bank.items.set(item, entry); game.bank.itemsByTab[tab].push(entry); tabs.addItemToEndofTab(game.bank, entry); icons.set(entry, tabs.itemIcons.get(item)); return entry; };
  return { game, bank: game.bank, items, icons, click, key, calls, sellSelections, normalSelections, tabs, field, toggle, values, loaded, ready, head, menu, banner, alert, toolbar, options, filter: value => choose("upgrade", value ? "upgrade" : "all"),
    choose, filterControl, filterItems, addItem, flushFilters, ctx, button: options.moveModeButton, sellButton: options.sellModeButton, nativeButtonLabel, nativeSellButtonLabel, nativeBannerLabel };
}

const targets = f => f.tabs.tabs.map(tab => tab.tabLink.classList.contains("kroky-bank-move-target"));
const filterTargets = f => f.tabs.tabs.map(tab => tab.tabLink.classList.contains("kroky-bank-filter-target"));
const select = (f, ...items) => items.forEach(entry => f.bank.selectItemOnClick(entry.item));

function glowClock(f) {
  const frames = new Map(), reads = [], animations = new Map();
  let id = 0, writes = 0;
  document.timeline = {};
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = frame => frames.delete(frame);
  const pulse = (target, startTime = 900, extra = {}) => {
    const animation = { animationName: "kroky-bank-move-pulse", timeline: document.timeline, playState: "running", pending: false,
      effect: { target, pseudoElement: "::before" }, ...extra };
    Object.defineProperty(animation, "startTime", { get: () => startTime, set(value) { writes++; startTime = value; } });
    return animation;
  };
  for (const { tabLink } of f.tabs.tabs) {
    tabLink.isConnected = true;
    animations.set(tabLink, [pulse(tabLink)]);
    tabLink.getAnimations = options => { assert.deepEqual(options, { subtree: true }); reads.push(tabLink); return animations.get(tabLink); };
  }
  return { frames, reads, animations, pulse, writes: () => writes,
    run() { const queued = [...frames.values()]; frames.clear(); for (const callback of queued) callback(); } };
}

test("staggered filter and Move Mode tab pulses share one timeline without recurring animation work", () => {
  const f = fixture(true), clock = glowClock(f), first = f.tabs.tabs[1].tabLink, second = f.tabs.tabs[2].tabLink;
  f.addItem({ id: "First matching logs", type: "Logs" }, 1); f.choose("kind", "type:Logs");
  assert.equal(clock.frames.size, 1); clock.run(); assert.equal(clock.animations.get(first)[0].startTime, 0);
  f.addItem({ id: "Later matching logs", type: "Logs" }, 2); f.flushFilters();
  assert.equal(clock.animations.get(second)[0].startTime, 900, "the newly matching tab starts independently before synchronization");
  assert.equal(clock.frames.size, 1); clock.run();
  assert.equal(clock.animations.get(first)[0].startTime, clock.animations.get(second)[0].startTime);
  assert.equal(clock.animations.get(second)[0].startTime, 0);
  const stableReads = clock.reads.length, stableWrites = clock.writes();
  for (let frame = 0; frame < 600; frame++) f.flushFilters();
  new Bank().setItemSelectionMode(1);
  assert.equal(clock.frames.size, 0, "foreign Bank mode changes do not restart owned pulses");
  f.bank.moveItemModeOnClick(); select(f, f.items[0]); f.choose("kind", "all");
  assert.equal(clock.frames.size, 0, "overlapping move/filter classes keep the same highlighted membership");
  assert.equal(clock.reads.length, stableReads); assert.equal(clock.writes(), stableWrites);
  f.bank.setItemSelectionMode(0); clock.run();
  clock.animations.get(first).push(clock.pulse(first, 1200));
  f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  f.bank.toggleItemSelected(f.items[0]); select(f, f.items[0]);
  assert.equal(clock.frames.size, 1, "rapid membership changes coalesce into one frame"); clock.run();
  assert.equal(clock.animations.get(first).at(-1).startTime, 0);
  assert.equal(clock.reads.includes(f.tabs.tabs[0].tabLink), false, "the active tab is never enumerated");
});

test("glow synchronization leaves paused, foreign, other-pseudo and non-tab animations native", () => {
  const f = fixture(), clock = glowClock(f), first = f.tabs.tabs[1].tabLink, second = f.tabs.tabs[2].tabLink;
  const untouched = [clock.pulse(first, 20, { animationName: "native-animation" }), clock.pulse(first, 30, { playState: "paused", pending: true }),
    clock.pulse(first, 40, { timeline: {} }), clock.pulse(first, 50, { effect: { target: second, pseudoElement: "::before" } }),
    clock.pulse(first, 60, { effect: { target: first, pseudoElement: "::after" } }), clock.pulse(first, 70, { playState: "finished" })];
  const pending = clock.pulse(first, null, { pending: true }); clock.animations.set(first, [pending, ...untouched]);
  f.addItem({ id: "Matching logs", type: "Logs" }, 1); f.choose("kind", "type:Logs"); clock.run();
  assert.equal(pending.startTime, 0); assert.deepEqual(untouched.map(animation => animation.startTime), [20, 30, 40, 50, 60, 70]);
  f.choose("kind", "all"); clock.run(); clock.animations.set(first, []);
  f.choose("kind", "type:Logs"); clock.run(); assert.equal(clock.writes(), 1, "reduced-motion CSS exposes no pulse to modify");
});

test("owned pulse restarts after tab reinsertion rejoin the shared clock without changing membership", () => {
  const f = fixture(), clock = glowClock(f), first = f.tabs.tabs[1].tabLink;
  f.addItem({ id: "Matching logs", type: "Logs" }, 1); f.choose("kind", "type:Logs"); clock.run();
  const restarted = clock.pulse(first, 1250); clock.animations.set(first, [restarted]);
  const handlers = f.tabs.listeners.get("animationstart") ?? [];
  const start = overrides => handlers.forEach(callback => callback({ target: first, pseudoElement: "::before", animationName: "kroky-bank-move-pulse", ...overrides }));
  const reads = clock.reads.length;
  start({ animationName: "native-animation" }); start({ pseudoElement: "::after" });
  start({ target: new Element("a") }); start({ target: {} }); start({ target: f.tabs.tabs[0].tabLink });
  const getElement = document.getElementById;
  document.getElementById = id => id === "bank-tab-menu" ? new Element("bank-tab-menu") : getElement(id);
  start(); document.getElementById = getElement;
  assert.equal(clock.frames.size, 0); assert.equal(clock.reads.length, reads, "unrelated, inactive and retired-menu events do no animation work");
  start(); start(); assert.equal(clock.frames.size, 1); clock.run();
  assert.equal(restarted.startTime, 0, "the replacement CSS animation aligns despite unchanged highlight classes");
  const writes = clock.writes(); start(); clock.run();
  assert.equal(clock.writes(), writes, "an initial animationstart after alignment cannot cause another timing write");
  delete globalThis.requestAnimationFrame;
  start(); assert.equal(clock.frames.size, 0, "unsupported animation control leaves the CSS fallback intact");
});

test("hidden or stale glow frames do no animation work and character reset cancels queued jobs", () => {
  const f = fixture(), clock = glowClock(f);
  f.addItem({ id: "Matching logs", type: "Logs" }, 1); f.choose("kind", "type:Logs");
  document.visibilityState = "hidden"; clock.run(); assert.equal(clock.reads.length, 0); assert.equal(clock.frames.size, 0);
  document.visibilityState = "visible"; f.flushFilters(); assert.equal(clock.frames.size, 1); clock.run();
  f.choose("kind", "all"); clock.run(); f.choose("kind", "type:Logs"); f.game._isInOnlineLoop = false;
  clock.run(); assert.equal(clock.frames.size, 0); const reads = clock.reads.length;
  f.game._isInOnlineLoop = true; f.game.openPage = { containerID: "woodcutting-container" }; f.flushFilters();
  assert.equal(clock.reads.length, reads); assert.equal(clock.frames.size, 0);
  f.game.openPage = { containerID: "bank-container" }; f.flushFilters(); assert.equal(clock.frames.size, 1);
  const stale = [...clock.frames.values()][0]; f.loaded(); assert.equal(clock.frames.size, 0); stale();
  assert.equal(clock.reads.length, reads, "a canceled callback cannot revive the previous character's work");
  f.choose("kind", "type:Logs"); f.tabs.tabs[1].tabLink.isConnected = false; clock.run();
  assert.equal(clock.reads.length, reads, "disconnected tab links are left alone");
  delete f.tabs.tabs[1].tabLink.getAnimations; f.tabs.tabs[1].tabLink.isConnected = true;
  f.choose("kind", "all"); clock.run(); f.choose("kind", "type:Logs"); clock.run();
  assert.equal(clock.reads.length, reads, "older browsers without element animations retain CSS fallback behavior");
  delete document.timeline;
  f.choose("kind", "all"); f.choose("kind", "type:Logs"); assert.equal(clock.frames.size, 0);
});

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

for (const mode of [1, 2]) test(`canceling mode ${mode} retains the first selected item in normal Bank selection`, () => {
  for (const enabled of [false, true]) {
    const f = fixture(enabled), quantities = f.items.map(item => item.quantity), order = f.bank.itemsByTab.map(tab => [...tab]);
    f.bank.setItemSelectionMode(mode); select(f, f.items[2], f.items[0], f.items[1]);
    f.bank.setItemSelectionMode(0);
    assert.equal(f.bank.selectedBankItem, f.items[2], "selection insertion order takes priority over grid order");
    assert.deepEqual(f.normalSelections, [f.items[2].item]); assert.equal(f.bank.selectedItems.size, 0);
    assert.equal(f.bank.selectedBankTab, 0); assert.deepEqual(f.items.map(item => item.quantity), quantities); assert.deepEqual(f.bank.itemsByTab, order);
    f.bank.setItemSelectionMode(mode); select(f, f.items[1]);
    (mode === 1 ? f.bank.moveItemModeOnClick : f.bank.sellItemModeOnClick).call(f.bank);
    assert.equal(f.bank.selectedBankItem, f.items[1], "the native cancel button uses the same path");
  }
});

test("cancel selection skips removed and replaced entries, leaving unrelated transitions and foreign banks native", () => {
  const f = fixture(true); f.bank.setItemSelectionMode(2); select(f, f.items[0], f.items[1], f.items[2]);
  f.bank.items.delete(f.items[0].item); f.bank.items.set(f.items[1].item, { ...f.items[1] }); f.bank.setItemSelectionMode(0);
  assert.equal(f.bank.selectedBankItem, f.items[2]); assert.deepEqual(f.normalSelections, [f.items[2].item]);
  f.bank.setItemSelectionMode(0); assert.equal(f.normalSelections.length, 1);
  f.bank.setItemSelectionMode(1); select(f, f.items[2]); f.bank.setItemSelectionMode(2);
  assert.equal(f.bank.selectedBankItem, undefined, "switching between bulk modes clears the old group without opening details");
  f.bank.setItemSelectionMode(0); assert.equal(f.bank.selectedBankItem, undefined, "an empty group has nothing to retain");
  const foreign = new Bank(); foreign.setItemSelectionMode(1); foreign.selectItemOnClick(f.items[2].item); foreign.setItemSelectionMode(0);
  assert.equal(foreign.selectedBankItem, undefined); assert.equal(f.normalSelections.length, 1);
});

test("completed transfers and Deselect All never briefly create a normal selection", () => {
  for (const enabled of [false, true]) {
    const f = fixture(enabled); f.bank.setItemSelectionMode(1); select(f, f.items[0], f.items[1]);
    assert.equal(f.bank.moveSelectedItemsToTab(2), "bulk move"); assert.deepEqual(f.normalSelections, []);
    assert.equal(f.bank.selectedBankItem, undefined); assert.equal(f.bank.itemSelectionMode, enabled ? 1 : 0);
  }
  for (const mode of [1, 2]) {
    const f = fixture(true); f.bank.setItemSelectionMode(mode); select(f, f.items[0], f.items[1]);
    f.toolbar.querySelector(".kroky-bank-deselect-all").click();
    assert.deepEqual(f.normalSelections, []); assert.equal(f.bank.selectedBankItem, undefined); assert.equal(f.bank.itemSelectionMode, mode);
  }
});

test("native return values, extra arguments and errors survive selection retention without toggling an already selected item", () => {
  const f = fixture(true), marker = {}, error = new Error("native mode failure"); f.bank.setItemSelectionMode(1); select(f, f.items[1]);
  f.bank.modeResult = marker; assert.equal(f.bank.setItemSelectionMode(0, "extra", 4), marker);
  assert.deepEqual(f.bank.modeArgs, [0, "extra", 4]); assert.equal(f.bank.selectedBankItem, f.items[1]);
  f.bank.setItemSelectionMode(1); select(f, f.items[2]); f.bank.nativeModeSelection = f.items[2];
  f.bank.setItemSelectionMode(0); assert.deepEqual(f.normalSelections, [f.items[1].item], "an original handler already selecting the retained entry must not be toggled off");
  delete f.bank.nativeModeSelection; f.bank.setItemSelectionMode(2); select(f, f.items[0]); f.bank.modeFailure = error;
  assert.throws(() => f.bank.setItemSelectionMode(0), value => value === error);
  assert.equal(f.bank.itemSelectionMode, 2); assert.deepEqual([...f.bank.selectedItems], [f.items[0]]);
});

test("failed transfers and Deselect All restore retention eligibility for a later cancel", () => {
  const error = new Error("operation failure");
  for (const enabled of [false, true]) {
    const f = fixture(enabled); f.bank.setItemSelectionMode(1); select(f, f.items[1]); f.bank.moveFailure = error;
    assert.throws(() => f.bank.moveSelectedItemsToTab(2), value => value === error); delete f.bank.moveFailure;
    f.bank.setItemSelectionMode(0); assert.equal(f.bank.selectedBankItem, f.items[1]);
  }
  const f = fixture(true); f.bank.setItemSelectionMode(2); select(f, f.items[2]); f.bank.modeFailure = error;
  assert.throws(() => f.toolbar.querySelector(".kroky-bank-deselect-all").click(), value => value === error); delete f.bank.modeFailure;
  f.bank.setItemSelectionMode(0); assert.equal(f.bank.selectedBankItem, f.items[2]);
});

test("character restoration does not retain the previous bulk group's item", () => {
  const f = fixture(true); f.bank.setItemSelectionMode(1); select(f, f.items[1]); f.loaded();
  assert.equal(f.bank.selectedBankItem, undefined); assert.deepEqual(f.normalSelections, []);
  f.bank.setItemSelectionMode(1); select(f, f.items[2]); f.game.decode(true);
  assert.equal(f.bank.selectedBankItem, undefined); assert.deepEqual(f.normalSelections, []);
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

for (const mode of [1, 2]) test(`Mode ${mode}: Shift-click selects inclusive forward and backward ranges from the last ordinary click`, () => {
  const f = fixture(true); f.bank.setItemSelectionMode(mode);
  f.click(f.items[0]); const forward = f.click(f.items[2], true);
  assert.equal(forward.prevented, true); assert.equal(forward.stopped, true);
  assert.deepEqual([...f.bank.selectedItems], f.items.slice(0, 3));
  f.click(f.items[1], true);
  assert.equal(f.bank.selectedItems.size, 3, "repeating Shift-click adds without toggling already selected items");
  f.bank.setItemSelectionMode(0); f.bank.setItemSelectionMode(mode);
  f.click(f.items[2]); f.click(f.items[0], true);
  assert.deepEqual(new Set(f.bank.selectedItems), new Set(f.items.slice(0, 3)));
  assert.equal(f.bank.selectedBankItem, undefined);
});

test("Sell Mode supports Shift-click ranges without moving items or highlighting destinations", () => {
  const f = fixture(true); f.bank.sellItemModeOnClick();
  f.click(f.items[0]); const range = f.click(f.items[2], true);
  assert.equal(range.prevented, true); assert.equal(range.stopped, true);
  assert.deepEqual([...f.bank.selectedItems], f.items.slice(0, 3));
  f.click(f.items[1], true);
  assert.equal(f.bank.selectedItems.size, 3, "repeated ranges preserve already selected items");
  assert.equal(f.bank.selectedBankItem, undefined);
  assert.deepEqual(targets(f), [false, false, false]);
  assert.equal(f.tabs.selectTab(1, f.bank), "navigate");
  assert.deepEqual([...f.bank.selectedItems], f.items.slice(0, 3), "Sell selections remain selected across tabs");
  assert.equal(f.calls.bulk, 0); assert.equal(f.calls.single, 0);
  assert.equal(f.bank.itemSelectionMode, 2);
});

test("Sell ranges retain native lock checks and sale-value refreshes, and stay optional", () => {
  const f = fixture(true); f.bank.sellItemModeOnClick();
  f.bank.lockedItems.add(f.items[1].item);
  f.click(f.items[0]); f.click(f.items[2], true);
  assert.deepEqual([...f.bank.selectedItems], [f.items[0], f.items[2]]);
  assert.deepEqual(f.sellSelections, [[f.items[0]], [f.items[0], f.items[2]]]);
  f.click(f.items[2], true);
  assert.equal(f.sellSelections.length, 2, "repeated ranges leave selected items selected");
  f.toggle(false); f.bank.setItemSelectionMode(0); f.bank.sellItemModeOnClick();
  f.bank.lockedItems.clear();
  f.click(f.items[0]); assert.equal(f.click(f.items[2], true).stopped, false);
  assert.deepEqual([...f.bank.selectedItems], [f.items[0], f.items[2]]);
});

for (const mode of [1, 2]) test(`Mode ${mode}: Shift-click follows visible row order, skips filtered items, and keeps existing selections`, () => {
  const f = fixture(true); f.bank.setItemSelectionMode(mode);
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

test("Categories defaults to All before Sort and combines any non-downgrade recipe with native filters despite Show All", () => {
  const f = fixture(), group = f.toolbar.querySelector(".kroky-bank-item-filters"), button = group.querySelector("button");
  assert.equal(button.textContent, "Categories"); assert.equal(button.children[0].className, "fa fa-filter"); assert.equal(group.nextSibling, f.options.sortButton);
  assert.equal(button.getAttribute("data-toggle"), "dropdown"); assert.equal(f.filterControl("upgrade", "all").checked, true);
  f.bank.itemUpgrades.set(f.items[0].item, [{ isDowngrade: false }]);
  f.bank.itemUpgrades.set(f.items[1].item, [{ isDowngrade: true }]);
  f.bank.itemUpgrades.set(f.items[2].item, [{ isDowngrade: true }, { isDowngrade: false }]);
  const before = f.items.map(entry => ({ ...entry })), selected = f.bank.selectedBankItem;
  f.filter(true);
  assert.equal(f.bank.filterChanges, 1); assert.equal(f.game.settings.bankFilterShowAll, true);
  assert.deepEqual(f.items.map(entry => f.icons.get(entry).classList.contains("d-none")), [false, true, false, true]);
  f.items[2].item.nativeHidden = true; f.bank.onBankFilterChange(); assert.equal(f.icons.get(f.items[2]).classList.contains("d-none"), true, "native filters are still required");
  const foreign = new Bank(); assert.equal(foreign.shouldShowBasedOnFilter(f.items[1].item), true);
  assert.deepEqual(f.items.map(entry => ({ ...entry })), before); assert.equal(f.bank.selectedBankItem, selected);
  assert.equal(f.bank.selectedBankTab, 0); assert.deepEqual(f.calls, { bulk: 0, single: 0, navigation: 0 });
});

test("Categories marks its active groups with a stable count badge and clears on All, Reset and character load", () => {
  const f = fixture(), group = f.toolbar.querySelector(".kroky-bank-item-filters"), button = group.querySelector("button");
  const badge = button.querySelector(".kroky-bank-filter-count"); assert.ok(badge);
  button.setAttribute("aria-expanded", "true");
  const countIs = count => {
    assert.equal(button.classList.contains("kroky-bank-filters-active"), count > 0);
    assert.equal(badge.textContent, count ? String(count) : ""); assert.equal(badge.hidden, count === 0);
    assert.equal(button.getAttribute("aria-label"), count ? `Categories: ${count} active filter${count === 1 ? "" : "s"}` : "Categories");
    assert.equal(button.title, count ? `Categories: ${count} active filter${count === 1 ? "" : "s"}` : "Categories: no active filters");
    assert.equal(button.getAttribute("aria-expanded"), "true"); assert.equal(button.getAttribute("aria-pressed"), null);
    assert.equal(button.classList.contains("btn-info"), true); assert.equal(button.querySelector(".kroky-bank-filter-count"), badge);
  };
  countIs(0); f.choose("kind", "equipment"); countIs(1); f.choose("lock", "locked"); countIs(2);
  f.choose("kind", "all"); countIs(1); f.choose("lock", "all"); countIs(0);
  f.choose("upgrade", "non-upgrade"); countIs(1);
  group.querySelectorAll("button").find(node => node.textContent === "Reset").click(); countIs(0);
  f.choose("kind", "food"); f.choose("hands", "one"); countIs(2); f.loaded(); countIs(0);
  assert.equal(group.querySelector("button"), button); assert.equal(button.children[0].className, "fa fa-filter");
});

test("Categories indicator ignores search/native filters and unchanged group values add no indicator writes or animation", () => {
  const f = fixture(), button = f.toolbar.querySelector(".kroky-bank-item-filters").querySelector("button");
  f.bank.onBankSearchChange("log"); f.game.settings.bankFilterShowAll = false; f.bank.onBankFilterChange(); f.flushFilters();
  assert.equal(button.classList.contains("kroky-bank-filters-active"), false);
  assert.equal(button.querySelector(".kroky-bank-filter-count").textContent, "");
  f.choose("kind", "equipment");
  const setAttribute = button.setAttribute.bind(button); let writes = 0;
  button.setAttribute = (...args) => { writes++; setAttribute(...args); };
  for (let index = 0; index < 20; index++) { f.choose("kind", "equipment"); f.flushFilters(); }
  assert.equal(writes, 0);
  const css = f.head.children.map(node => node.textContent).join("\n");
  const rule = css.match(/#kroky-bank-item-filters-toggle\.kroky-bank-filters-active\s*\{([^}]+)\}/);
  assert.ok(rule); assert.match(rule[1], /#daa664/i); assert.doesNotMatch(rule[1], /animation|background/i);
});

test("upgradable survives native search and clear-search fast paths while disabling it preserves the query", () => {
  const f = fixture(); f.bank.itemUpgrades.set(f.items[0].item, [{ isDowngrade: false }]); f.bank.itemUpgrades.set(f.items[2].item, [{}]);
  f.filter(true); f.bank.onBankSearchChange("ore");
  assert.equal(f.items.every(entry => f.icons.get(entry).classList.contains("d-none")), true);
  f.bank.onBankSearchChange(""); assert.deepEqual(f.items.map(entry => f.icons.get(entry).classList.contains("d-none")), [false, true, false, true]);
  f.bank.onBankSearchChange("seed"); f.filter(false);
  assert.equal(f.bank.currentSearchQuery, "seed"); assert.deepEqual(f.items.map(entry => f.icons.get(entry).classList.contains("d-none")), [true, true, true, false]);
  f.bank.onBankSearchChange(""); assert.equal(f.items.every(entry => !f.icons.get(entry).classList.contains("d-none")), true);
});

test("new native icons honor upgradable without changing native bindings or foreign-bank icons", () => {
  const f = fixture(); f.filter(true);
  const icon = new BankItemIconElement(), plain = f.items[0], upgraded = f.items[1];
  assert.equal(icon.setItem(f.bank, plain), "native item"); assert.equal(icon.classList.contains("d-none"), true); assert.equal(icon.item, plain.item);
  const eligible = new BankItemIconElement(); f.bank.itemUpgrades.set(upgraded.item, [{}]); eligible.setItem(f.bank, upgraded);
  assert.equal(eligible.classList.contains("d-none"), false); eligible.onclick(); assert.equal(f.bank.selectedBankItem, upgraded);
  const foreign = new BankItemIconElement(); foreign.setItem(new Bank(), plain); assert.equal(foreign.classList.contains("d-none"), false);
  f.filter(false); const native = new BankItemIconElement(); native.setItem(f.bank, plain); assert.equal(native.classList.contains("d-none"), false);
});

test("upgradable keeps existing selections and quantities while Better Moving ranges skip native-hidden non-upgradable icons", () => {
  const f = fixture(true); f.bank.itemUpgrades.set(f.items[0].item, [{}]); f.bank.itemUpgrades.set(f.items[2].item, [{}]);
  f.bank.moveItemModeOnClick(); select(f, f.items[1]); const quantities = f.items.map(entry => entry.quantity);
  f.filter(true); assert.equal(f.bank.selectedItems.has(f.items[1]), true, "filtering never silently deselects a previously selected stack");
  f.bank.setItemSelectionMode(0); f.bank.setItemSelectionMode(1); f.click(f.items[0]); f.click(f.items[2], true);
  assert.deepEqual([...f.bank.selectedItems], [f.items[0], f.items[2]]); assert.deepEqual(f.items.map(entry => entry.quantity), quantities);
  assert.equal(f.calls.bulk + f.calls.single, 0);
});

test("upgradable resets on character load and QuickLoad without a General setting or premature interface work", () => {
  const f = fixture(false, false); f.loaded(); assert.equal(f.bank.filterChanges, 0); f.ready();
  f.bank.itemUpgrades.set(f.items[0].item, [{}]); f.filter(true); f.ready();
  assert.equal(f.filterControl("upgrade", "upgrade").checked, true, "repeated interface hooks do not reset a live filter");
  new Game().decode(false); assert.equal(f.bank.shouldShowBasedOnFilter(f.items[1].item), false, "foreign loads leave the filter intact");
  f.loaded(); assert.equal(f.filterControl("upgrade", "all").checked, true);
  assert.equal(f.items.every(entry => !f.icons.get(entry).classList.contains("d-none")), true);
  f.filter(true); f.game.decode(false); assert.equal(f.bank.shouldShowBasedOnFilter(f.items[1].item), true);
  assert.equal(f.filterControl("upgrade", "all").checked, true);
});

test("normal Bank selection is gold while Move and Sell keep their native border and full-intensity shadow colours", () => {
  const f = fixture(), css = f.head.children[0].textContent;
  assert.match(css, /\.bank-img\.border\.border-4x\.border-success:not\(\.border-info\):not\(\.border-warning\) \{ border-color: #daa664!important; \}/);
  assert.match(css, /--kroky-bank-normal-selection: #daa664/); assert.match(css, /--kroky-bank-selection-shadow: rgba\(218,166,100,\.75\)/);
  assert.match(css, /--kroky-bank-move-selection: #5cace5/); assert.match(css, /--kroky-bank-sell-selection: #e5ae67/);
  assert.match(css, /body\.darkMode #bank-tab-menu \{ --kroky-bank-sell-selection: #f3b760; \}/);
  assert.match(css, /box-shadow: 0 0 10px 6px var\(--kroky-bank-selection-shadow,var\(--kroky-bank-selection-color\)\)/);
});

test("Item Filters combine groups with AND and distinguish valid equipment slots from occupied two-handed slots", () => {
  const f = fixture(), entries = Object.fromEntries(Object.entries(f.filterItems).map(([key, item]) => [key, f.addItem(item)]));
  const shown = () => Object.keys(entries).filter(key => !f.icons.get(entries[key]).classList.contains("d-none"));
  f.choose("kind", "equipment"); assert.deepEqual(shown(), ["weapon", "twoHand", "shield", "body"]);
  f.choose("hands", "one"); assert.deepEqual(shown(), ["weapon"], "One-Handed applies to weapons, not every non-two-handed item");
  f.choose("slot", "melvorD:Shield"); assert.deepEqual(shown(), []);
  f.choose("hands", "all"); assert.deepEqual(shown(), ["shield"], "a two-handed weapon occupies Off-Hand but does not fit there");
  f.choose("slot", "melvorD:Weapon"); f.choose("hands", "two"); assert.deepEqual(shown(), ["twoHand"]);
  f.choose("upgrade", "non-upgrade"); assert.deepEqual(shown(), ["twoHand"]);
  f.bank.itemUpgrades.set(f.filterItems.twoHand, [{}]); f.bank.onBankFilterChange(); assert.deepEqual(shown(), []);
  f.choose("upgrade", "upgrade"); assert.deepEqual(shown(), ["twoHand"]);
  const slot = f.filterControl("slot"); assert.deepEqual(slot.children.slice(0, 3).map(option => option.textContent), ["All", "Main Hand", "Off-Hand"]);
});

test("Item Type uses native classes, exact resource types and the cross-type Archaeology artefact flag", () => {
  const f = fixture(), entries = Object.fromEntries(Object.entries(f.filterItems).map(([key, item]) => [key, f.addItem(item)]));
  for (const [kind, expected] of [["weapons", ["weapon", "twoHand"]], ["food", ["food"]], ["runes", ["rune"]], ["potions", ["potion", "artefact"]], ["artefacts", ["artefact"]]]) {
    f.choose("kind", kind); assert.deepEqual(Object.keys(entries).filter(key => !f.icons.get(entries[key]).classList.contains("d-none")), expected, kind);
  }
  f.choose("kind", "type:Logs"); assert.deepEqual(f.items.filter(entry => !f.icons.get(entry).classList.contains("d-none")), [f.items[0]]);
  const options = f.filterControl("kind").children; assert.equal(options.some(option => option.textContent === "Type: Logs"), true);
  assert.equal(options.some(option => option.textContent === "Materials"), false, "no invented generic Materials predicate");
});

test("Item Type keeps All first and sorts broad groups before native types, A-Z within each section", () => {
  const f = fixture(false, false);
  for (const type of ["Zebra", "apple", "Beta"])
    f.game.items.allObjects.push(...Array.from({ length: 10 }, (_, index) => ({ id: `${type}-${index}`, type })));
  f.loaded(); f.ready();
  assert.deepEqual(f.filterControl("kind").children.map(option => option.textContent), [
    "All", "Archaeology Artefacts", "Equipment", "Food", "Potions", "Runes", "Weapons",
    "Type: apple", "Type: Beta", "Type: Fish", "Type: Logs", "Type: Ore", "Type: Seed", "Type: Zebra",
  ]);
  f.choose("kind", "weapons");
  assert.equal(f.bank.shouldShowBasedOnFilter(f.filterItems.weapon), true);
  assert.equal(f.bank.shouldShowBasedOnFilter(f.filterItems.food), false);
});

test("Type choices require ten distinct catalogue items independently of stock and keep broad groups", () => {
  const f = fixture(false, false), catalogue = f.game.items.allObjects;
  for (const [type, count] of [["Rare", 9], ["Boundary", 10], ["Many", 11], ["Duplicates", 9]])
    catalogue.push(...Array.from({ length: count }, (_, index) => ({ id: `${type}-${index}`, type })));
  catalogue.push(...Array.from({ length: 20 }, () => ({ id: "Duplicates-0", type: "Duplicates" })));
  catalogue.push({ id: "Missing type" }, { id: "Empty type", type: "" });
  let catalogueReads = 0;
  Object.defineProperty(f.game.items, "allObjects", { get() { catalogueReads++; return catalogue; } });
  f.loaded(); f.ready();
  const values = new Set(f.filterControl("kind").children.map(option => option.value));
  for (const type of ["Rare", "Duplicates", ""]) assert.equal(values.has(`type:${type}`), false, type);
  for (const type of ["Boundary", "Many"]) assert.equal(values.has(`type:${type}`), true, type);
  for (const kind of ["equipment", "weapons", "food", "runes", "potions", "artefacts"]) assert.equal(values.has(kind), true, kind);
  const rare = f.addItem(catalogue.find(item => item.type === "Rare")); rare.quantity = 1_000_000;
  const boundary = f.addItem(catalogue.find(item => item.type === "Boundary"));
  f.choose("kind", "type:Boundary");
  assert.equal(f.icons.get(boundary).classList.contains("d-none"), false);
  assert.equal(f.icons.get(rare).classList.contains("d-none"), true);
  for (let frame = 0; frame < 20; frame++) { f.bank.onBankFilterChange(); f.flushFilters(); }
  assert.equal(catalogueReads, 1, "catalogue counting runs only when constructing the menu");
});

test("Special, citrus and seasonal Type choices stay excluded even above the item threshold", () => {
  const f = fixture(false, false);
  const excluded = ["Special", "special", "Lemon", "Lime", "Christmas", "Christmas 2021", "Birthday 2023", "Birthday 2026", "Easter", "Easter 2025"];
  const retained = ["Limestone", "Special Gem", "Consumable"];
  for (const type of [...excluded, ...retained])
    f.game.items.allObjects.push(...Array.from({ length: 12 }, (_, index) => ({ id: `${type}-${index}`, type })));
  f.loaded(); f.ready();
  const values = new Set(f.filterControl("kind").children.map(option => option.value));
  for (const type of excluded) assert.equal(values.has(`type:${type}`), false, type);
  for (const type of retained) assert.equal(values.has(`type:${type}`), true, type);
  f.choose("kind", "all");
  const special = f.addItem(f.game.items.allObjects.find(item => item.type === "Special"));
  assert.equal(f.icons.get(special).classList.contains("d-none"), false, "excluding a dropdown choice does not hide its items from All");
});

test("native types include equipment consumables such as Luminous Lure alongside broad item classes", () => {
  const f = fixture(false, false), lure = new EquipmentItem("Luminous Lure"), other = new EquipmentItem("Other consumable");
  lure.type = other.type = "Consumable";
  f.game.items.allObjects.push(lure, other, ...Array.from({ length: 8 }, (_, index) => Object.assign(new EquipmentItem(`Consumable-${index}`), { type: "Consumable" })));
  f.loaded(); f.ready();
  const lureEntry = f.addItem(lure), otherEntry = f.addItem(other), weaponEntry = f.addItem(f.filterItems.weapon);
  assert.equal(f.filterControl("kind").children.filter(option => option.value === "type:Consumable").length, 1);
  f.choose("kind", "type:Consumable");
  assert.equal(f.icons.get(lureEntry).classList.contains("d-none"), false);
  assert.equal(f.icons.get(otherEntry).classList.contains("d-none"), false);
  assert.equal(f.icons.get(weaponEntry).classList.contains("d-none"), true);
  f.choose("kind", "equipment");
  assert.equal(f.icons.get(lureEntry).classList.contains("d-none"), false);
  assert.equal(f.icons.get(otherEntry).classList.contains("d-none"), false);
});

test("existing ammunition Type choices include native Melvor and Abyssal ammo families while retaining raw materials and excluding weapons that only require ammo", () => {
  const f = fixture(false, false);
  // The native enum becomes available after module import/installation and before interface construction.
  globalThis.AmmoTypeID = { Arrows: 0, Bolts: 1, Javelins: 2, ThrowingKnives: 3, None: 4, AbyssalArrows: 5, AbyssalBolts: 6 };
  const samples = [
    ["Bronze Arrows", "Ammo", 0, "Arrows"], ["Abyssium Arrows", "Ammo", 5, "Arrows"],
    ["Darksteel Arrows", "Arrows", 0, "Arrows"], ["Aranite Arrows", "Arrows", 5, "Arrows"],
    ["Sapphire Bolts", "Ammo", 1, "Bolts"], ["Abyssal Bolts", "Ammo", 6, "Bolts"],
    ["Rune Javelin", "RangedWeapon", 2, "Javelin"], ["Throwing Knife", "RangedWeapon", 3, undefined],
    ["Longbow", "RangedWeapon", 4, undefined, 0], ["Abyssal Bow", "RangedWeapon", 4, undefined, 5],
    ["Crossbow", "RangedWeapon", 4, undefined, 1], ["Abyssal Crossbow", "RangedWeapon", 4, undefined, 6],
    ["No Ammo", "Equipment", 4, undefined],
  ].map(([name, type, ammoType, family, ammoTypeRequired]) => {
    const item = new (type === "RangedWeapon" ? WeaponItem : EquipmentItem)(name);
    Object.assign(item, { type, ammoType, ammoTypeRequired }); return { item, family };
  });
  for (const [name, type] of [["Arrow Shafts", "Arrows"], ["Headless Arrows", "Arrows"], ["Unfinished Bolts", "Bolts"], ["Javelin Heads", "Javelin"]])
    samples.push({ item: { id: name, type }, family: type });
  samples.push({ item: { id: "Non-equipment ammo-like metadata", type: "Material", ammoType: 0 }, family: undefined });
  f.game.items.allObjects.push(...samples.map(({ item }) => item));
  for (const ammoType of [0, 1, 2]) for (let index = 0; index < 10; index++)
    f.game.items.allObjects.push(Object.assign(new EquipmentItem(`Catalogue ammo ${ammoType}-${index}`), { type: "Ammo", ammoType }));
  f.loaded(); f.ready();
  const entries = samples.map(sample => ({ ...sample, entry: f.addItem(sample.item) }));
  for (const type of ["Arrows", "Bolts", "Javelin"]) {
    f.choose("kind", `type:${type}`);
    assert.deepEqual(entries.filter(({ entry }) => !f.icons.get(entry).classList.contains("d-none")).map(({ item }) => item.id),
      samples.filter(sample => sample.family === type).map(({ item }) => item.id), type);
  }
  assert.equal(f.filterControl("kind").children.some(option => /Kniv/.test(option.textContent)), false, "the fix creates no new Type choices");
});

test("native lock changes coalesce into one visible refresh without changing selection, search or quantities", () => {
  const f = fixture(); f.bank.onBankSearchChange("log"); const selected = f.bank.selectedBankItem, quantities = f.items.map(entry => entry.quantity);
  f.choose("lock", "locked"); const initial = f.bank.filterChanges;
  f.bank.toggleItemLock(f.items[0]); f.bank.toggleItemLock(f.items[1]); assert.equal(f.bank.filterChanges, initial);
  f.flushFilters(); assert.equal(f.bank.filterChanges, initial + 1); assert.equal(f.icons.get(f.items[0]).classList.contains("d-none"), false);
  assert.equal(f.icons.get(f.items[1]).classList.contains("d-none"), true, "the search still excludes another locked item");
  f.flushFilters(); assert.equal(f.bank.filterChanges, initial + 1);
  assert.equal(f.bank.currentSearchQuery, "log"); assert.equal(f.bank.selectedBankItem, selected); assert.deepEqual(f.items.map(entry => entry.quantity), quantities);
  const foreign = new Bank(); foreign.toggleItemLock(f.items[0]); f.flushFilters(); assert.equal(f.bank.filterChanges, initial + 1);
});

test("requirements filters exclude non-equipment and event changes refresh only once when Bank can paint", () => {
  const f = fixture(), handlers = new Set(), requirement = { met: false, assignHandler(callback) { handlers.add(callback); return () => handlers.delete(callback); } };
  const changed = () => { for (const callback of handlers) callback(); };
  f.filterItems.weapon.equipRequirements = [requirement]; const entry = f.addItem(f.filterItems.weapon);
  f.choose("requirements", "unmet"); assert.equal(f.icons.get(entry).classList.contains("d-none"), false); assert.equal(f.bank.shouldShowBasedOnFilter(f.items[0].item), false);
  f.choose("requirements", "met"); assert.equal(f.icons.get(entry).classList.contains("d-none"), true);
  assert.equal(handlers.size, 1); let refreshes = f.bank.filterChanges;
  requirement.met = true; changed(); changed(); assert.equal(f.bank.filterChanges, refreshes);
  f.flushFilters(); assert.equal(f.bank.filterChanges, ++refreshes); assert.equal(f.icons.get(entry).classList.contains("d-none"), false);
  for (const [skip, resume] of [
    [() => { f.game.openPage = { containerID: "woodcutting-container" }; }, () => { f.game.openPage = { containerID: "bank-container" }; }],
    [() => { document.visibilityState = "hidden"; }, () => { document.visibilityState = "visible"; }],
    [() => { f.game._isInOnlineLoop = false; }, () => { f.game._isInOnlineLoop = true; }],
    [() => { f.game.enableRendering = false; }, () => { f.game.enableRendering = true; }],
  ]) {
    skip(); requirement.met = !requirement.met; changed();
    for (let frame = 0; frame < 20; frame++) f.flushFilters(); assert.equal(f.bank.filterChanges, refreshes);
    resume(); f.flushFilters(); assert.equal(f.bank.filterChanges, ++refreshes);
  }
  f.choose("requirements", "all"); refreshes = f.bank.filterChanges; assert.equal(handlers.size, 0); changed(); f.flushFilters(); assert.equal(f.bank.filterChanges, refreshes);
});

test("native dungeon requirement handlers deduplicate owned equipment and bind/unbind new or removed Bank items", () => {
  const f = fixture(), callbacks = new Set(); let assignments = 0;
  const dungeon = { met: false, assignHandler(callback) { assignments++; callbacks.add(callback); return () => callbacks.delete(callback); } };
  f.filterItems.weapon.equipRequirements = [dungeon]; f.filterItems.body.equipRequirements = [dungeon];
  f.choose("requirements", "met"); const sword = f.addItem(f.filterItems.weapon); const body = f.addItem(f.filterItems.body);
  f.bank.onBankFilterChange(); f.flushFilters(); assert.equal(assignments, 1); assert.equal(callbacks.size, 1);
  assert.equal(f.icons.get(sword).classList.contains("d-none"), true);
  dungeon.met = true; for (const callback of callbacks) callback(); f.flushFilters();
  assert.equal(f.icons.get(sword).classList.contains("d-none"), false); assert.equal(f.icons.get(body).classList.contains("d-none"), false);
  const count = f.bank.filterChanges; f.icons.get(sword).setItem(f.bank, sword); f.flushFilters();
  assert.equal(assignments, 1); assert.equal(f.bank.filterChanges, count, "quantity/ghost rebinds of already watched equipment do no subscription work");
  f.bank.removeItemQuantity(sword.item, 1); f.flushFilters(); assert.equal(callbacks.size, 1, "another owned item still requires this native handler");
  f.bank.removeItemQuantity(body.item, 1); f.flushFilters(); assert.equal(callbacks.size, 0);
  f.addItem(f.filterItems.weapon); f.flushFilters(); assert.equal(callbacks.size, 1);
  f.loaded(); assert.equal(callbacks.size, 0, "character reset removes old requirement handlers");
});

test("Reset clears only Item Filters and native form interaction stays open even outside its dropdown parent", () => {
  const f = fixture(), group = f.toolbar.querySelector(".kroky-bank-item-filters"), menu = group.querySelector(".dropdown-menu"), form = menu.querySelector("form");
  f.choose("kind", "runes"); f.choose("lock", "locked"); f.game.settings.bankFilterShowAll = false; f.items[0].item.nativeHidden = true;
  f.bank.onBankSearchChange("ore"); group.querySelectorAll("button").find(button => button.textContent === "Reset").click();
  assert.equal(f.bank.currentSearchQuery, "ore"); assert.equal(f.game.settings.bankFilterShowAll, false);
  assert.deepEqual(f.items.filter(entry => !f.icons.get(entry).classList.contains("d-none")), [f.items[1]]);
  for (const key of ["upgrade", "hands", "requirements", "lock"]) assert.equal(f.filterControl(key, "all").checked, true);
  assert.equal(f.filterControl("slot").value, "all"); assert.equal(f.filterControl("kind").value, "all");
  let stopped = false; form.listeners.get("click")[0]({ stopPropagation() { stopped = true; } }); assert.equal(stopped, true);
  const other = new Element(); other.append(menu); stopped = false; form.listeners.get("click")[0]({ stopPropagation() { stopped = true; } }); assert.equal(stopped, true, "BODY portalling does not break the form's keep-open behavior");
});

test("lock hooks use the SDK before-native-after pipeline and defer expensive filtering to the shared flush", () => {
  const f = fixture(), phases = []; f.choose("lock", "locked"); const count = f.bank.filterChanges;
  f.ctx.patch(Bank, "toggleItemLock").before(function (entry) { phases.push(["before", this.lockedItems.has(entry.item)]); });
  f.ctx.patch(Bank, "toggleItemLock").after(function (_result, entry) { phases.push(["after", this.lockedItems.has(entry.item)]); });
  f.bank.toggleItemLock(f.items[0]); assert.deepEqual(phases, [["before", false], ["after", true]]); assert.equal(f.bank.filterChanges, count);
  f.flushFilters(); assert.equal(f.bank.filterChanges, count + 1);
});

test("Categories glow inactive tabs from actual visible matches while Better Moving is off and respect custom display order", () => {
  const f = fixture(), first = { id: "Other Logs", type: "Logs" }, second = { id: "More Logs", type: "Logs" };
  f.addItem(first, 1); f.addItem(second, 2); f.flushFilters(); assert.deepEqual(filterTargets(f), [false, false, false], "unfiltered Bank does not glow every populated tab");
  const nativeTabs = [...f.tabs.tabs]; f.tabs.append(nativeTabs[2].tabLink, nativeTabs[0].tabLink, nativeTabs[1].tabLink);
  f.choose("kind", "type:Logs"); assert.deepEqual(filterTargets(f), [false, true, true]);
  assert.equal(nativeTabs[1].tabLink.classList.contains("kroky-bank-move-tab"), false);
  assert.deepEqual(f.tabs.tabs, nativeTabs); assert.equal(f.bank.selectedBankTab, 0);
  const get = f.bank.items.get.bind(f.bank.items); let reads = 0; f.bank.items.get = item => { reads++; return get(item); };
  f.tabs.selectTab(1, f.bank); assert.deepEqual(filterTargets(f), [true, false, true]); assert.equal(reads, 0, "active exclusion uses cached matches, including the old active tab");
  f.choose("kind", "all"); assert.deepEqual(filterTargets(f), [false, false, false]); assert.equal(reads, 0, "All clears classes without classifying Bank items");
});

test("filter tab glows use the final Categories, native filter and search intersection without rechecking predicates", () => {
  const f = fixture(); f.game.settings.bankFilterShowAll = false; f.items[3].item.nativeHidden = true;
  f.bank.onBankFilterChange(); f.flushFilters(); assert.deepEqual(filterTargets(f), [false, false, false]);
  f.items[3].item.nativeHidden = false; f.bank.onBankSearchChange("seed");
  const predicate = f.bank.shouldShowBasedOnFilter.bind(f.bank); let checks = 0; f.bank.shouldShowBasedOnFilter = item => { checks++; return predicate(item); };
  f.flushFilters(); assert.deepEqual(filterTargets(f), [false, true, false]); assert.equal(checks, 0, "glows read native visibility rather than rerun any requirement or item predicate");
  f.choose("kind", "type:Logs"); assert.deepEqual(filterTargets(f), [false, false, false], "Categories applies before the tab visibility scan, including nested native search");
  f.choose("kind", "all"); assert.deepEqual(filterTargets(f), [false, true, false]);
  f.bank.onBankSearchChange("no match"); f.flushFilters(); assert.deepEqual(filterTargets(f), [false, false, false]);
  f.bank.onBankSearchChange(""); f.icons.get(f.items[3]).hidden = true; f.flushFilters(); assert.deepEqual(filterTargets(f), [false, false, false], "the icon's own hidden flag also excludes a match");
  f.icons.get(f.items[3]).hidden = false; f.bank.onBankFilterChange(); f.flushFilters(); assert.deepEqual(filterTargets(f), [false, true, false]);
  f.game.settings.bankFilterShowAll = true; f.bank.onBankFilterChange(); assert.deepEqual(filterTargets(f), [false, false, false], "unfiltered All removes stale glows immediately");
});

test("Categories performs one final visibility scan and Reset clears only its own targets without disturbing Move Mode", () => {
  const f = fixture(true); f.addItem({ id: "Other Logs", type: "Logs" }, 1); f.bank.moveItemModeOnClick(); select(f, f.items[0]);
  const get = f.bank.items.get.bind(f.bank.items); let reads = 0; f.bank.items.get = item => { reads++; return get(item); };
  f.choose("kind", "type:Logs"); assert.equal(reads, f.tabs.itemIcons.size); assert.deepEqual(filterTargets(f), [false, true, false]);
  assert.deepEqual(targets(f), [false, true, true]);
  const selection = [...f.bank.selectedItems], mode = f.bank.itemSelectionMode;
  f.toolbar.querySelectorAll("button").find(button => button.textContent === "Reset").click();
  assert.deepEqual(filterTargets(f), [false, false, false]); assert.deepEqual(targets(f), [false, true, true]);
  assert.deepEqual([...f.bank.selectedItems], selection); assert.equal(f.bank.itemSelectionMode, mode);
  assert.equal(reads, f.tabs.itemIcons.size, "unfiltered Reset adds no second visibility scan");
});

test("native adds, last-stack removals and tab moves coalesce membership glows in the shared flush", () => {
  const f = fixture(); f.bank.itemUpgrades.set(f.items[0].item, [{}]); f.filter(true);
  const get = f.bank.items.get.bind(f.bank.items); let reads = 0; f.bank.items.get = item => { reads++; return get(item); };
  const first = { id: "New upgrade", type: "Ore" }, second = { id: "Second upgrade", type: "Ore" };
  f.bank.itemUpgrades.set(first, [{}]); f.bank.itemUpgrades.set(second, [{}]);
  const a = f.addItem(first, 1), b = f.addItem(second, 2); assert.equal(reads, 0); assert.deepEqual(filterTargets(f), [false, false, false]);
  f.flushFilters(); assert.equal(reads, f.tabs.itemIcons.size); assert.deepEqual(filterTargets(f), [false, true, true]);
  const steady = reads; for (let frame = 0; frame < 20; frame++) f.flushFilters(); assert.equal(reads, steady);
  f.bank.removeItemQuantity(first, 1); f.tabs.removeItemFromTab(first); assert.deepEqual(filterTargets(f), [false, true, true]);
  f.flushFilters(); assert.deepEqual(filterTargets(f), [false, false, true]);
  f.bank.moveItemToNewTab(2, 1, b.tabPosition); assert.equal(b.tab, 1); assert.deepEqual(filterTargets(f), [false, false, true]);
  f.flushFilters(); assert.deepEqual(filterTargets(f), [false, true, false]);
  f.bank.setItemSelectionMode(1); f.bank.selectedItems.add(b); f.bank.moveSelectedItemsToTab(2); f.flushFilters(); assert.deepEqual(filterTargets(f), [false, false, true]);
  assert.equal(a.quantity, 0); assert.equal(b.quantity, 1);
});

test("hidden membership updates do no visibility scans and character restore removes stale glow state", () => {
  const f = fixture(); f.choose("kind", "type:Logs"); const get = f.bank.items.get.bind(f.bank.items); let reads = 0;
  f.bank.items.get = item => { reads++; return get(item); }; f.game.openPage = { containerID: "woodcutting-container" };
  f.addItem({ id: "Hidden Logs", type: "Logs" }, 1);
  for (let frame = 0; frame < 20; frame++) f.flushFilters(); assert.equal(reads, 0);
  f.game.openPage = { containerID: "bank-container" }; document.visibilityState = "hidden"; f.flushFilters(); assert.equal(reads, 0);
  document.visibilityState = "visible"; f.flushFilters(); assert.equal(reads, f.tabs.itemIcons.size); assert.deepEqual(filterTargets(f), [false, true, false]);
  f.loaded(); assert.deepEqual(filterTargets(f), [false, false, false]);
  f.choose("kind", "type:Logs"); assert.deepEqual(filterTargets(f), [false, true, false]); f.game.decode(false); assert.deepEqual(filterTargets(f), [false, false, false]);
});
