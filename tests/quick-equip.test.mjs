import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { installQuickEquip } from "../quick-equip.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "QuickEquipTooltipElement", "EquipmentGridIconElement", "Game", "EquipmentItem", "assets", "cdnMedia", "tippy", "HTMLElement", "formatNumber", "fflate"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.nodeType = 1;
    this.children = []; this.className = ""; this.attributes = {}; this.listeners = new Map();
    this.style = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this.value = "";
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: (...names) => { for (const name of names) if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => { const value = force ?? !this.classList.contains(name); this.classList[value ? "add" : "remove"](name); return value; },
    };
  }
  append(...nodes) { for (const node of nodes) { if (node.nodeType === 11) { this.append(...node.children); continue; } node.remove(); this.children.push(node); node.parentElement = this; } }
  prepend(...nodes) { for (const node of [...nodes].reverse()) { if (node.nodeType === 11) { this.prepend(...node.children); continue; } node.remove(); this.children.unshift(node); node.parentElement = this; } }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = `${value}`; if (name === "id") this.id = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  matches(selector) {
    return selector.split(",").some(part => {
      part = part.trim();
      const compound = part.match(/^([a-z-]+)(\[[^\]]+\])$/i);
      if (compound) return this.matches(compound[1]) && this.matches(compound[2]);
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      if (part.startsWith("#")) return this.id === part.slice(1);
      const attr = part.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
      if (attr) { const actual = this.getAttribute(attr[1]) ?? this[attr[1]]; return attr[2] === undefined ? actual !== undefined && actual !== null : actual === attr[2]; }
      return this.tagName.toLowerCase() === part;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
  removeEventListener(name, callback) { const list = this.listeners.get(name); if (list) this.listeners.set(name, list.filter(fn => fn !== callback)); }
  dispatch(name, event = {}) {
    const state = { target: this, currentTarget: this, stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, ...event };
    for (const callback of this.listeners.get(name) ?? []) callback(state);
    this[`on${name}`]?.(state);
    if (!state.stopped) this.parentElement?.dispatch(name, state);
    return state;
  }
  click() { if (!this.disabled) return this.dispatch("click"); }
  focus() { document.activeElement = this; }
  getBoundingClientRect() { return { x: 10, y: 10, left: 10, top: 10, right: 310, bottom: 210, width: 300, height: 200 }; }
  get textContent() { return (this.ownText ?? "") + this.children.map(node => node.textContent).join(""); }
  set textContent(text) { this.ownText = `${text}`; this.replaceChildren(); }
}

function fixture(saved) {
  const html = new Element("html"), head = new Element("head"), body = new Element("body"); html.append(head, body);
  const doc = new Element("document"); doc.append(html); doc.head = head; doc.body = body;
  doc.createElement = tag => new Element(tag); doc.getElementById = id => doc.querySelector(`#${id}`);
  doc.createDocumentFragment = () => { const fragment = new Element("fragment"); fragment.nodeType = 11; return fragment; };
  globalThis.document = doc;
  globalThis.HTMLElement = Element;
  globalThis.assets = { getURI: path => `media:${path}` };
  globalThis.cdnMedia = path => `media:${path}`;
  globalThis.formatNumber = value => `${value}`;
  globalThis.fflate = { gzipSync, gunzipSync, strToU8: (value, binary) => Buffer.from(value, binary ? "binary" : "utf8"), strFromU8: (value, binary) => Buffer.from(value).toString(binary ? "binary" : "utf8") };
  globalThis.EquipmentItem = class {
    constructor(name, validSlots = [weapon]) { this.id = `test:${name}`; this.name = name; this.media = `${name}.png`; this.validSlots = validSlots; this.equipRequirements = []; }
    fitsInSlot(id) { return this.validSlots.some(slot => slot.id === id); }
  };
  const weapon = { id: "test:Weapon", emptyName: "Weapon", emptyMedia: "weapon.png", allowQuantity: false }, quiver = { id: "test:Quiver", emptyName: "Quiver", emptyMedia: "quiver.png", allowQuantity: true };
  const empty = { id: "test:Empty", name: "Empty", media: "empty.png", fitsInSlot: () => false };
  const sword = new EquipmentItem("Sword"), axe = new EquipmentItem("Axe"), spear = new EquipmentItem("Spear"), bow = new EquipmentItem("Bow");
  const arrows = new EquipmentItem("Arrows", [quiver]), locked = new EquipmentItem("Locked"), absent = new EquipmentItem("Absent"); locked.equipRequirements = ["locked"];
  const items = [sword, axe, spear, bow, arrows, locked, absent], bankItems = new Map(items.filter(item => item !== absent).map(item => [item, { item, quantity: item === arrows ? 15 : 1 }]));
  const calls = { equip: [], quick: [], unequip: [], writes: [], requirements: [], patches: [], scans: 0 }, hooks = {}, values = new Map();
  const bankValues = bankItems.values.bind(bankItems), bankForEach = bankItems.forEach.bind(bankItems), bankEntries = bankItems[Symbol.iterator].bind(bankItems);
  bankItems.values = () => { calls.scans++; return bankValues(); };
  bankItems.forEach = callback => { calls.scans++; return bankForEach(callback); };
  bankItems[Symbol.iterator] = () => { calls.scans++; return bankEntries(); };
  if (saved !== undefined) values.set("quick-equip-extra-slots", saved);
  const equipped = slot => ({ slot, item: sword, quantity: 1, isEmpty: false, quickEquipItems: [sword, axe, empty] });
  const equipment = () => {
    const slots = new Map([[weapon, equipped(weapon)], [quiver, { ...equipped(quiver), item: arrows, quickEquipItems: [arrows, empty, empty] }]]);
    return { getEquippedInSlot: slot => slots.get(slot), getQuickEquipItem: (slot, index) => slots.get(slot).quickEquipItems[index], equippedItems: Object.fromEntries([...slots].map(([slot, eq]) => [slot.id, eq])), slots };
  };
  const player = {
    selectedEquipmentSet: 0, equipmentSets: [{ equipment: equipment() }, { equipment: equipment() }],
    get equipment() { return this.equipmentSets[this.selectedEquipmentSet].equipment; },
    isEquipmentSlotUnlocked: () => true,
    onQuickEquipClick(slot, index) { calls.quick.push({ slot, index }); },
    equipItem(item, set, slot, quantity) { calls.equip.push({ item, set, slot, quantity }); return true; },
    unequipCallback(slot) { return () => { calls.unequip.push({ slot, set: this.selectedEquipmentSet }); }; },
    setQuickEquipItem() { assert.fail("assignment must not use native Set, which copies the equipped item"); },
  };
  const bank = { items: bankItems, getQty: item => bankItems.get(item)?.quantity ?? 0 };
  const game = { items: { getObjectByID: id => items.find(item => item.id === id) }, emptyEquipmentItem: empty, bank, combat: { player }, checkRequirements(requirements, notify) { calls.requirements.push({ requirements, notify }); return !requirements.includes("locked"); } };
  player.manager = { bank };
  globalThis.Game = class { decode(next) { values.clear(); if (next !== undefined) values.set("quick-equip-extra-slots", next); } };
  globalThis.tippy = (target, props) => ({ props, setProps(next) { Object.assign(this.props, next); }, setContent(content) { this.props.content = content; }, show() { if (this.props.content instanceof Element) body.append(this.props.content); this.props.onShow?.(); }, hide() {}, destroy() {} });
  globalThis.QuickEquipTooltipElement = class extends Element {
    constructor() {
      super("quick-equip-tooltip"); this.buttons = []; this.buttonContainer = new Element("ul"); this.unequipButton = new Element("button");
      const group = new Element(); group.append(this.unequipButton); this.buttonContainer.append(group); this.append(this.buttonContainer);
    }
    init(count) {
      for (let index = 0; index < count; index++) {
        const group = new Element(), equip = new Element("button"), image = new Element("img"), set = new Element("button");
        set.textContent = "Set"; equip.append(image); group.append(equip, set); this.buttonContainer.prepend(group); this.buttons.push({ equip, image, set });
      }
    }
    setEquipped(actualPlayer, eq) {
      eq.quickEquipItems.forEach((item, index) => { this.buttons[index].image.src = item.media; this.buttons[index].equip.onclick = () => actualPlayer.onQuickEquipClick(eq.slot, index); this.buttons[index].set.onclick = () => actualPlayer.setQuickEquipItem(eq.slot, index); });
      this.unequipButton.onclick = actualPlayer.unequipCallback(eq.slot);
    }
  };
  globalThis.EquipmentGridIconElement = class extends Element {
    constructor() {
      super("equipment-grid-icon"); this.quickEquipEnabled = true; this.container = new Element(); this.image = new Element("img"); this.container.append(this.image); this.append(this.container);
      this.quickEquip = new QuickEquipTooltipElement(); this.quickEquip.init(3); this.quickEquipTooltip = tippy(this.image, { content: this.quickEquip });
    }
    setEquipped(actualPlayer, eq) { this.image.src = eq.item.media; this.quickEquipTooltip.setProps({ onShow: () => this.quickEquip.setEquipped(actualPlayer, eq) }); }
    setQuickEquipEnabled(enabled) { this.quickEquipEnabled = enabled; }
  };
  globalThis.customElements = { get: tag => ({ "quick-equip-tooltip": QuickEquipTooltipElement, "equipment-grid-icon": EquipmentGridIconElement })[tag] };
  const ctx = {
    characterStorage: { getItem: name => values.has(name) ? structuredClone(values.get(name)) : undefined, setItem(name, value) { if (name.length + JSON.stringify(value).length >= 8192) throw new Error("Character storage limit exceeded"); calls.writes.push({ name, value: structuredClone(value) }); values.set(name, structuredClone(value)); } },
    onCharacterLoaded(callback) { hooks.character = callback; }, onInterfaceReady(callback) { hooks.interface = callback; },
    patch(Class, method) { calls.patches.push({ Class, method }); return { after(callback) { const original = Class.prototype[method]; Class.prototype[method] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; }; } }; },
  };
  installQuickEquip(ctx, game);
  const icon = new EquipmentGridIconElement(); body.append(icon); icon.setEquipped(player, player.equipment.getEquippedInSlot(weapon));
  hooks.character?.(); hooks.interface?.();
  const show = (target = icon, slot = weapon) => { target.setEquipped(player, player.equipment.getEquippedInSlot(slot)); target.quickEquipTooltip.show(); return target.quickEquip; };
  return { ctx, game, player, weapon, quiver, empty, sword, axe, spear, bow, arrows, locked, absent, items, bankItems, calls, hooks, values, icon, body, show, EquipmentGridIconElement };
}

function dragData() {
  const entries = new Map();
  return { effectAllowed: "", dropEffect: "", types: [], setData(type, value) { entries.set(type, value); this.types = [...entries.keys()]; }, getData: type => entries.get(type) ?? "" };
}

function decodeSaved(value) { return typeof value === "string" ? JSON.parse(gunzipSync(Buffer.from(value, "base64")).toString("utf8")) : value; }

function slots(menu) { return menu.querySelectorAll(".kroky-quick-equip-slot"); }
function openBank(menu) { menu.querySelector(".kroky-quick-equip-bank").click(); return menu.querySelector(".kroky-quick-equip-picker"); }
function bankItem(menu, item) { return menu.querySelectorAll(".kroky-quick-equip-bank-item").find(button => button.dataset.itemId === item.id); }
function drop(menu, item, index) {
  const button = bankItem(menu, item);
  assert.ok(button, `${item.name} must be offered by the bank picker`);
  const dataTransfer = dragData(); button.dispatch("dragstart", { dataTransfer });
  const event = slots(menu)[index].dispatch("drop", { dataTransfer });
  button.dispatch("dragend", { dataTransfer });
  return event;
}

test("shared Combat and header grids show six shortcuts and place native unequip on the equipment icon", () => {
  const f = fixture();
  const menu = f.show();
  assert.equal(slots(menu).length, 6);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems.length, 3, "native save array remains at three");
  assert.ok(menu.buttons.every(button => !menu.contains(button.set) || button.set.hidden || button.set.classList.contains("d-none")), "Set actions are removed from the popup");
  assert.equal(menu.querySelector(".kroky-quick-unequip"), null, "popup no longer contains the native unequip control");
  const unequip = f.icon.container.querySelector(".kroky-quick-unequip");
  assert.ok(unequip); assert.equal(unequip.getAttribute("aria-label"), "Unequip Sword"); assert.equal(unequip.disabled, false); unequip.click();
  assert.deepEqual(f.calls.unequip, [{ slot: f.weapon, set: 0 }]);
  const header = new f.EquipmentGridIconElement(); f.body.append(header);
  const headerMenu = f.show(header);
  assert.equal(slots(headerMenu).length, 6);
  assert.ok(header.container.querySelector(".kroky-quick-unequip"), "the same native class enhancement reaches the top bar");
});

test("bank selection filters compatible items without timers, render hooks or repeated work during stable equipment refreshes", t => {
  const intervals = t.mock.method(globalThis, "setInterval", () => 0), timeouts = t.mock.method(globalThis, "setTimeout", () => 0);
  const f = fixture();
  const unequip = f.icon.container.querySelector(".kroky-quick-unequip");
  const attributeWrites = t.mock.method(unequip, "setAttribute");
  for (let i = 0; i < 20; i++) f.icon.setEquipped(f.player, f.player.equipment.getEquippedInSlot(f.weapon));
  assert.equal(attributeWrites.mock.callCount(), 0, "stable equipment refreshes must not rewrite the moved X attributes");
  const menu = f.show();
  assert.equal(f.calls.scans, 0, "equipment rendering must not enumerate bank items");
  const picker = openBank(menu);
  assert.equal(f.calls.scans, 1, "the bank is scanned only when opening the picker");
  assert.ok(bankItem(menu, f.axe));
  assert.equal(bankItem(menu, f.arrows), undefined, "wrong equipment slot is filtered");
  assert.equal(bankItem(menu, f.locked), undefined, "unmet equipment requirements are filtered");
  assert.equal(bankItem(menu, f.absent), undefined, "items absent from the bank are not inventively supplied");
  assert.ok(f.calls.requirements.every(call => call.notify === false), "filtering must not trigger native error notifications");
  const search = picker.querySelector("input");
  assert.ok(search); search.value = "axe"; search.dispatch("input");
  assert.equal(bankItem(menu, f.axe).hidden, false);
  assert.equal(bankItem(menu, f.sword).hidden, true);
  assert.equal(f.calls.scans, 1, "typing filters already-built buttons rather than rescanning the bank");
  for (let i = 0; i < 20; i++) f.icon.setEquipped(f.player, f.player.equipment.getEquippedInSlot(f.weapon));
  assert.equal(f.calls.scans, 1, "an open picker does not cause per-render bank scans");
  assert.equal(attributeWrites.mock.callCount(), 0, "opening or searching Bank does not create X update churn");
  assert.equal(f.calls.patches.some(patch => patch.Class === Game && patch.method === "render"), false, "quick equip must not add game-render polling");
  assert.equal(intervals.mock.callCount() + timeouts.mock.callCount(), 0, "quick equip must not schedule timer polling");
});

test("dragging bank items replaces native and extra shortcuts without equipping, consuming or extending native data", () => {
  const f = fixture(); const menu = f.show(); openBank(menu);
  const beforeBank = [...Map.prototype.entries.call(f.bankItems)].map(([item, entry]) => [item.id, entry.quantity]);
  drop(menu, f.spear, 1);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[1], f.spear);
  assert.equal(f.calls.writes.length, 0, "native three shortcuts retain native persistence");
  drop(menu, f.bow, 4);
  assert.equal(decodeSaved(f.values.get("quick-equip-extra-slots"))[0][f.weapon.id][1], f.bow.id);
  drop(menu, f.axe, 4);
  assert.equal(decodeSaved(f.values.get("quick-equip-extra-slots"))[0][f.weapon.id][1], f.axe.id, "new drops replace rather than append");
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems.length, 3);
  assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []); assert.deepEqual(f.calls.unequip, []);
  assert.deepEqual([...Map.prototype.entries.call(f.bankItems)].map(([item, entry]) => [item.id, entry.quantity]), beforeBank);
});

test("click assignment supports keyboard and touch, while normal shortcut clicks retain native equipment behavior", () => {
  const f = fixture(); const menu = f.show(); openBank(menu);
  bankItem(menu, f.spear).click(); slots(menu)[2].click();
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[2], f.spear);
  assert.deepEqual(f.calls.quick, [], "selecting then assigning must not equip immediately");
  slots(menu)[2].click();
  assert.deepEqual(f.calls.quick, [{ slot: f.weapon, index: 2 }]);
  bankItem(menu, f.bow).click(); slots(menu)[3].click(); slots(menu)[3].click();
  assert.deepEqual(f.calls.equip, [{ item: f.bow, set: 0, slot: f.weapon, quantity: 1 }]);
  slots(menu)[3].dispatch("keydown", { key: "Delete" }); slots(menu)[3].dispatch("contextmenu");
  assert.equal(decodeSaved(f.values.get("quick-equip-extra-slots"))[0][f.weapon.id][0], f.bow.id, "no delete functionality is introduced");
});

test("extra shortcuts persist per equipment set and slot and recover on native decode", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, "missing:ModItem"], "test:Quiver": ["test:Arrows", null, null] }, 1: { "test:Weapon": ["test:Bow", null, null] } };
  const f = fixture(saved); const menu = f.show();
  slots(menu)[3].click(); assert.equal(f.calls.equip.at(-1).item, f.spear);
  f.player.selectedEquipmentSet = 1; f.show(); slots(menu)[3].click(); assert.equal(f.calls.equip.at(-1).item, f.bow);
  assert.equal(f.calls.equip.at(-1).set, 1);
  f.player.selectedEquipmentSet = 0; f.show(f.icon, f.quiver); slots(menu)[3].click();
  assert.equal(f.calls.equip.at(-1).item, f.arrows); assert.equal(f.calls.equip.at(-1).slot, f.quiver);
  assert.equal(f.calls.equip.at(-1).quantity, 14, "quantity equipment follows the native quick-equip rule");
  const loaded = new Game(); loaded.decode({ 0: { "test:Weapon": ["test:Axe", null, null] } }); f.show(); slots(menu)[3].click();
  assert.equal(f.calls.equip.at(-1).item, f.axe, "QuickLoad replaces rather than leaks earlier shortcut data");
  loaded.decode(undefined); f.show(); const before = f.calls.equip.length; slots(menu)[3].click(); assert.equal(f.calls.equip.length, before);
});

test("stale, incompatible, unavailable and disabled drops cannot change stored shortcuts", () => {
  const f = fixture(); const menu = f.show(); openBank(menu);
  const dataTransfer = dragData(); bankItem(menu, f.axe).dispatch("dragstart", { dataTransfer });
  f.player.selectedEquipmentSet = 1; slots(menu)[0].dispatch("drop", { dataTransfer });
  assert.equal(f.player.equipmentSets[0].equipment.getEquippedInSlot(f.weapon).quickEquipItems[0], f.sword);
  assert.equal(f.player.equipmentSets[1].equipment.getEquippedInSlot(f.weapon).quickEquipItems[0], f.sword);
  f.player.selectedEquipmentSet = 0; f.show(); openBank(menu);
  const missing = dragData(); bankItem(menu, f.axe).dispatch("dragstart", { dataTransfer: missing }); f.bankItems.delete(f.axe);
  slots(menu)[0].dispatch("drop", { dataTransfer: missing }); assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[0], f.sword);
  f.bankItems.set(f.axe, { item: f.axe, quantity: 1 });
  f.icon.setQuickEquipEnabled(false); const snapshot = JSON.stringify(f.values.get("quick-equip-extra-slots"));
  slots(menu)[4].dispatch("drop", { dataTransfer }); slots(menu)[0].click();
  assert.equal(JSON.stringify(f.values.get("quick-equip-extra-slots")), snapshot);
  assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []);
  const unequip = f.icon.container.querySelector(".kroky-quick-unequip"); assert.ok(unequip.hidden || unequip.disabled);
});

test("malformed saved extras and absent item IDs are safe and are not rewritten during ordinary rendering", t => {
  t.mock.method(console, "warn", () => {});
  for (const saved of ["invalid", [], { 0: { "test:Weapon": ["missing:ModItem", 4, null] } }]) {
    const f = fixture(saved); const menu = f.show();
    assert.equal(slots(menu).length, 6); slots(menu)[3].click();
    assert.deepEqual(f.calls.equip, []); assert.equal(f.calls.writes.length, 0);
  }
});

test("replacing one extra shortcut preserves other stored IDs, including temporarily unavailable mod items", () => {
  const saved = { 0: { "test:Weapon": [null, null, "missing:ModItem"], "other:Slot": ["missing:Other", null, null] }, 9: { "test:Weapon": ["missing:FutureSet", null, null] } };
  const f = fixture(saved); const menu = f.show(); openBank(menu); drop(menu, f.axe, 3);
  const actual = decodeSaved(f.values.get("quick-equip-extra-slots"));
  assert.deepEqual(actual[0][f.weapon.id], [f.axe.id, null, "missing:ModItem"]);
  assert.deepEqual(actual[0]["other:Slot"], saved[0]["other:Slot"]);
  assert.deepEqual(actual[9], saved[9]);
});

test("native and extra shortcuts whose bank item is gone cannot call equipment actions", () => {
  const f = fixture({ 0: { "test:Weapon": ["test:Spear", null, null] } }); const menu = f.show();
  f.bankItems.delete(f.sword); f.bankItems.delete(f.spear);
  slots(menu)[0].click(); slots(menu)[3].click();
  assert.deepEqual(f.calls.quick, [], "a native non-quantity shortcut must not reach equipItem with an empty bank");
  assert.deepEqual(f.calls.equip, [], "extra shortcuts also recheck current ownership");
  f.bankItems.set(f.sword, { item: f.sword, quantity: 1 }); slots(menu)[0].click();
  assert.equal(f.calls.quick.length, 1, "shortcuts become usable again when their item returns");
});

test("storage failure retains the previous extra shortcut in saved data, display and activation", t => {
  t.mock.method(console, "warn", () => {});
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } };
  const f = fixture(saved); const menu = f.show(); openBank(menu);
  f.ctx.characterStorage.setItem = () => { throw new Error("Character storage full"); };
  drop(menu, f.axe, 3);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved);
  assert.equal(slots(menu)[3].querySelector("img").src, f.spear.media);
  assert.match(menu.querySelector(".kroky-quick-equip-status").textContent, /Could not save.*previous shortcut was kept/);
  f.show(); slots(menu)[3].click(); assert.equal(f.calls.equip.at(-1).item, f.spear);
});

test("temporarily disabling quick equip also restores the native unequip overlay when enabled again", () => {
  const f = fixture(); f.show();
  const button = f.icon.container.querySelector(".kroky-quick-unequip");
  f.icon.setQuickEquipEnabled(false); assert.equal(button.hidden, true); assert.equal(button.disabled, true);
  f.icon.setQuickEquipEnabled(true); assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  button.click(); assert.deepEqual(f.calls.unequip, [{ slot: f.weapon, set: 0 }]);
});

test("equipment icons open quick equip through Enter and Space while respecting native disabled state", t => {
  const f = fixture(), image = f.icon.image;
  const show = t.mock.method(f.icon.quickEquipTooltip, "show");
  assert.equal(image.tabIndex, 0); assert.equal(image.getAttribute("role"), "button");
  assert.equal(image.getAttribute("aria-label"), "Quick equip: Weapon");
  for (const key of ["Enter", " "]) {
    const event = image.dispatch("keydown", { key });
    assert.equal(event.prevented, true); assert.equal(event.stopped, true);
  }
  assert.equal(show.mock.callCount(), 2);
  assert.equal(slots(f.icon.quickEquip).length, 6, "keyboard activation opens the actual native menu content");
  const otherKey = image.dispatch("keydown", { key: "ArrowDown" });
  assert.equal(otherKey.prevented, false); assert.equal(show.mock.callCount(), 2);
  f.icon.setQuickEquipEnabled(false);
  image.dispatch("keydown", { key: "Enter" }); image.dispatch("keydown", { key: " " });
  assert.equal(show.mock.callCount(), 2, "native disabled quick equip cannot be opened through the keyboard");
});

test("four full equipment sets fit native character storage and compressed shortcuts survive decoding", () => {
  const saved = Object.fromEntries(Array.from({ length: 4 }, (_, set) => [set,
    Object.fromEntries(Array.from({ length: 17 }, (_, slot) => [slot === 0 ? "test:Weapon" : `melvorD:EquipmentSlot${slot}`,
      Array.from({ length: 3 }, (_, preset) => `Some_Long_Equipment_Mod_Namespace:Distinct_Equipment_Identifier_Set${set}_Slot${slot}_Preset${preset}`),
    ])),
  ]));
  assert.ok(JSON.stringify(saved).length > 8192, "the representative uncompressed data exceeds Melvor's storage allowance");
  const f = fixture(saved); const menu = f.show(); openBank(menu); drop(menu, f.axe, 3);
  const stored = f.values.get("quick-equip-extra-slots");
  assert.equal(typeof stored, "string");
  assert.ok("quick-equip-extra-slots".length + JSON.stringify(stored).length < 8192, "compressed save must fit the real per-mod storage cap");
  const expected = structuredClone(saved); expected[0][f.weapon.id][0] = f.axe.id;
  assert.deepEqual(decodeSaved(stored), expected, "compression preserves all sets, slots and temporarily unavailable item IDs");
  new Game().decode(stored); f.show(); slots(menu)[3].click();
  assert.equal(f.calls.equip.at(-1).item, f.axe);
  assert.equal(f.calls.writes.length, 1, "restoring compressed data must not rewrite it");
});

test("corrupt compressed shortcuts block extra replacements without destroying the saved value or native shortcuts", t => {
  t.mock.method(console, "warn", () => {});
  const corruptValues = ["!invalid-base64!", Buffer.from("not gzip").toString("base64"), gzipSync(Buffer.from("{invalid JSON")).toString("base64")];
  for (const corrupt of corruptValues) {
    const f = fixture(corrupt); const menu = f.show(); openBank(menu); drop(menu, f.axe, 3);
    assert.equal(f.values.get("quick-equip-extra-slots"), corrupt);
    assert.equal(f.calls.writes.length, 0, "failed restore must not silently overwrite the old data");
    assert.match(menu.querySelector(".kroky-quick-equip-status").textContent, /could not be read.*Reload/);
    drop(menu, f.spear, 1);
    assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[1], f.spear, "native shortcuts remain usable");
    assert.equal(f.values.get("quick-equip-extra-slots"), corrupt);
  }
});
