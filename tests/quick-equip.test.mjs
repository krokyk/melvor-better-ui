import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { installQuickEquip } from "../quick-equip.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "QuickEquipTooltipElement", "EquipmentGridIconElement", "Game", "EquipmentItem", "assets", "cdnMedia", "tippy", "HTMLElement", "formatNumber", "fflate", "viewItemStats"]) delete globalThis[name];
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
  insertBefore(node, reference) { if (!reference) { this.append(node); return node; } node.remove(); this.children.splice(this.children.indexOf(reference), 0, node); node.parentElement = this; return node; }
  get childNodes() { return this.children; }
  get parentNode() { return this.parentElement; }
  get isConnected() { return this.nodeType === 9 || !!this.parentElement?.isConnected; }
  get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null; }
  get tabIndex() { return this.attributes.tabindex === undefined ? (["BUTTON", "INPUT"].includes(this.tagName) ? 0 : -1) : Number(this.attributes.tabindex); }
  set tabIndex(value) { this.attributes.tabindex = `${value}`; }
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

function fixture(saved, savedEnabled = true, savedStatsMode = "click", savedExtraSlots = true, savedLayout = "compact", savedDirectUnequip = false) {
  const html = new Element("html"), head = new Element("head"), body = new Element("body"); html.append(head, body);
  const doc = new Element("document"); doc.nodeType = 9; doc.append(html); doc.head = head; doc.body = body; doc.documentElement = html; html.clientWidth = 1280;
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
  const arrows = new EquipmentItem("Arrows", [quiver]), locked = new EquipmentItem("Locked"), absent = new EquipmentItem("Absent"), plain = new EquipmentItem("Plain"); locked.equipRequirements = ["locked"];
  const items = [sword, axe, spear, bow, arrows, locked, absent, plain], bankItems = new Map(items.filter(item => item !== absent).map(item => [item, { item, quantity: item === arrows ? 15 : 1 }]));
  const calls = { equip: [], quick: [], set: [], unequip: [], writes: [], requirements: [], patches: [], previews: [], previewOptions: [], nativeStats: [], tooltipHides: [], eventOn: [], eventOff: [], scans: 0 }, hooks = {}, values = new Map();
  const fields = new Map(), settingsValues = new Map([["quick-equip-enabled", savedEnabled], ["equipment-item-stats-mode", savedStatsMode], ["extra-quick-slots-enabled", savedExtraSlots], ["equipment-preview-stats-mode", savedLayout], ["unequip-on-equipment-icons", savedDirectUnequip]]);
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
  const equipmentListeners = new Map();
  const player = {
    selectedEquipmentSet: 0, equipmentSets: [{ equipment: equipment() }, { equipment: equipment() }],
    get equipment() { return this.equipmentSets[this.selectedEquipmentSet].equipment; },
    isEquipmentSlotUnlocked: () => true,
    on(name, callback) {
      calls.eventOn.push({ name, callback });
      if (!equipmentListeners.has(name)) equipmentListeners.set(name, new Set());
      equipmentListeners.get(name).add(callback);
    },
    off(name, callback) { calls.eventOff.push({ name, callback }); equipmentListeners.get(name)?.delete(callback); },
    onQuickEquipClick(slot, index) { calls.quick.push({ slot, index }); },
    equipItem(item, set, slot, quantity) { calls.equip.push({ item, set, slot, quantity }); return true; },
    unequipCallback(slot) { return () => { calls.unequip.push({ slot, set: this.selectedEquipmentSet }); }; },
    setQuickEquipItem(slot, index) { calls.set.push({ slot, index }); this.equipment.getEquippedInSlot(slot).quickEquipItems[index] = this.equipment.getEquippedInSlot(slot).item; return true; },
  };
  const emitPlayerEvent = name => { for (const callback of [...(equipmentListeners.get(name) ?? [])]) callback({}); };
  const emitEquipmentChanged = (withItemEquipped = false) => { emitPlayerEvent("equipmentChanged"); if (withItemEquipped) emitPlayerEvent("itemEquipped"); };
  const emitItemEquipped = () => emitPlayerEvent("itemEquipped");
  const bank = { items: bankItems, getQty: item => bankItems.get(item)?.quantity ?? 0 };
  const game = { items: { getObjectByID: id => items.find(item => item.id === id) }, emptyEquipmentItem: empty, bank, combat: { player }, checkRequirements(requirements, notify) { calls.requirements.push({ requirements, notify }); return !requirements.includes("locked"); } };
  player.manager = { bank };
  globalThis.viewItemStats = (item, actualEquipment) => calls.nativeStats.push({ item, equipment: actualEquipment, pickerHidden: body.querySelector(".kroky-quick-equip-picker")?.hidden, tooltipHides: calls.tooltipHides.length });
  globalThis.Game = class { decode(next, enabled, statsMode, extraSlots, comparisonMode, directUnequip) { values.clear(); if (next !== undefined) values.set("quick-equip-extra-slots", next); if (enabled !== undefined) settingsValues.set("quick-equip-enabled", enabled); if (statsMode !== undefined) settingsValues.set("equipment-item-stats-mode", statsMode); if (extraSlots !== undefined) settingsValues.set("extra-quick-slots-enabled", extraSlots); if (comparisonMode !== undefined) settingsValues.set("equipment-preview-stats-mode", comparisonMode); if (directUnequip !== undefined) settingsValues.set("unequip-on-equipment-icons", directUnequip); } };
  globalThis.tippy = (target, props) => {
    const popper = new Element(), box = new Element(), content = new Element(), arrow = new Element();
    box.className = "tippy-box"; content.className = "tippy-content"; arrow.className = "tippy-arrow";
    box.append(content, arrow); popper.append(box);
    const tooltip = { popper, props: { maxWidth: 350, placement: "bottom", ...props }, setProps(next) { Object.assign(this.props, next); }, setContent(content) { this.props.content = content; }, show() {
      this.props.onShow?.();
      if (this.props.content instanceof Element) { body.append(popper); content.append(this.props.content); this.props.content.connectedCallback?.(); }
    }, hide() { calls.tooltipHides.push(this); }, destroy() {} };
    target.addEventListener("click", () => tooltip.show());
    return tooltip;
  };
  globalThis.QuickEquipTooltipElement = class extends Element {
    constructor() {
      super("quick-equip-tooltip"); this.buttons = []; this.buttonContainer = new Element("ul"); this.unequipButton = new Element("button"); this.unequipButton.textContent = "X";
      this._content = document.createDocumentFragment();
      const nativeRoot = new Element(), heading = new Element("lang-string"), group = new Element();
      heading.textContent = "Quick Equip";
      group.append(this.unequipButton); this.buttonContainer.append(group); nativeRoot.append(heading, this.buttonContainer); this._content.append(nativeRoot);
    }
    connectedCallback() { this.append(this._content); }
    init(count) {
      for (let index = 0; index < count; index++) {
        const group = new Element(), equip = new Element("button"), image = new Element("img"), set = new Element("button");
        equip.className = "btn btn-sm"; set.className = "btn btn-sm btn-outline-warning";
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
    settings: { section(name) { assert.equal(name, "General"); return {
      add(config) { fields.set(config.name, config); if (!settingsValues.has(config.name)) settingsValues.set(config.name, config.default); },
      get: name => settingsValues.get(name),
    }; } },
    characterStorage: { getItem: name => values.has(name) ? structuredClone(values.get(name)) : undefined, setItem(name, value) { if (name.length + JSON.stringify(value).length >= 8192) throw new Error("Character storage limit exceeded"); calls.writes.push({ name, value: structuredClone(value) }); values.set(name, structuredClone(value)); } },
    onCharacterLoaded(callback) { hooks.character = callback; }, onInterfaceReady(callback) { hooks.interface = callback; },
    patch(Class, method) { calls.patches.push({ Class, method }); return { after(callback) { const original = Class.prototype[method]; Class.prototype[method] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; }; } }; },
  };
  const createItemStatsPreview = (item, actualGame, options) => {
    assert.equal(actualGame, game); calls.previews.push(item); calls.previewOptions.push(options);
    const element = new Element(), heading = new Element("h5"); heading.textContent = item.name; element.append(heading);
    const hasStats = item !== plain;
    if (hasStats) { const stats = new Element("small"); stats.textContent = `Stats for ${item.name}`; element.append(stats); }
    return { element, hasStats };
  };
  installQuickEquip(ctx, game, createItemStatsPreview);
  const icon = new EquipmentGridIconElement(); body.append(icon); icon.setEquipped(player, player.equipment.getEquippedInSlot(weapon));
  hooks.character?.(); hooks.interface?.();
  const show = (target = icon, slot = weapon) => { target.setEquipped(player, player.equipment.getEquippedInSlot(slot)); target.quickEquipTooltip.show(); return target.quickEquip; };
  const toggle = enabled => { const field = fields.get("quick-equip-enabled"); assert.ok(field, "quick-equip setting must be registered"); const result = field.onChange(enabled); if (result === undefined || result === true) settingsValues.set(field.name, enabled); return result; };
  const setStatsMode = mode => { const field = fields.get("equipment-item-stats-mode"); assert.ok(field, "equipment preview setting must be registered"); const result = field.onChange(mode); if (result === undefined || result === true) settingsValues.set(field.name, mode); return result; };
  const setExtraSlots = enabled => { const field = fields.get("extra-quick-slots-enabled"); assert.ok(field, "extra-slot setting must be registered"); const result = field.onChange(enabled); if (result === undefined || result === true) settingsValues.set(field.name, enabled); return result; };
  const setLayout = layout => { const field = fields.get("equipment-preview-stats-mode"); assert.ok(field, "equipment stats layout setting must be registered"); const result = field.onChange(layout); if (result === undefined || result === true) settingsValues.set(field.name, layout); return result; };
  const setDirectUnequip = enabled => { const field = fields.get("unequip-on-equipment-icons"); assert.ok(field, "unequip placement setting must be registered"); const result = field.onChange(enabled); if (result === undefined || result === true) settingsValues.set(field.name, enabled); return result; };
  return { ctx, game, player, weapon, quiver, empty, sword, axe, spear, bow, arrows, locked, absent, plain, items, bankItems, calls, hooks, values, fields, settingsValues, toggle, setStatsMode, setExtraSlots, setLayout, setDirectUnequip, equipmentListeners, emitEquipmentChanged, emitItemEquipped, icon, body, show, EquipmentGridIconElement };
}

function dragData() {
  const entries = new Map();
  return { effectAllowed: "", dropEffect: "", types: [], setData(type, value) { entries.set(type, value); this.types = [...entries.keys()]; }, getData: type => entries.get(type) ?? "" };
}

function decodeSaved(value) { return typeof value === "string" ? JSON.parse(gunzipSync(Buffer.from(value, "base64")).toString("utf8")) : value; }

function slots(menu) { return menu.querySelectorAll(".kroky-quick-equip-slot"); }
function openBank(menu) { menu.querySelector(".kroky-quick-equip-bank").click(); return menu.querySelector(".kroky-quick-equip-picker"); }
function bankItem(menu, item) { return menu.querySelectorAll(".kroky-quick-equip-bank-item").find(button => button.dataset.itemId === item.id); }
function assertPopupUnequipOrder(menu) {
  const bank = menu.querySelector(".kroky-quick-equip-bank"), button = menu.querySelector(".kroky-quick-equip-unequip-current");
  assert.ok(bank && button);
  assert.ok(button.parentElement === bank.parentElement);
  const siblings = bank.parentElement.children;
  assert.ok(siblings[siblings.indexOf(bank) + 1] === button, "popup Unequip Current must be directly after Bank");
}
function drop(menu, item, index) {
  const button = bankItem(menu, item);
  assert.ok(button, `${item.name} must be offered by the bank picker`);
  const dataTransfer = dragData(); button.dispatch("dragstart", { dataTransfer });
  const event = slots(menu)[index].dispatch("drop", { dataTransfer });
  button.dispatch("dragend", { dataTransfer });
  return event;
}

test("shared Combat and header grids default to unequip beside Bank without equipment-icon overlays", () => {
  const f = fixture();
  const menu = f.show();
  assert.equal(slots(menu).length, 6);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems.length, 3, "native save array remains at three");
  assert.ok(menu.buttons.every(button => !menu.contains(button.set) || button.set.hidden || button.set.classList.contains("d-none")), "Set actions are removed from the popup");
  assert.ok(!f.icon.container.querySelector(".kroky-quick-unequip"), "direct controls are opt-in");
  const unequip = menu.querySelector(".kroky-quick-equip-unequip-current");
  assert.ok(unequip); assert.equal(unequip.getAttribute("aria-label"), "Unequip Sword"); assert.equal(unequip.disabled, false); unequip.click();
  assert.equal(unequip, menu.unequipButton, "placement reuses the native control");
  assertPopupUnequipOrder(menu);
  assert.equal(unequip.textContent, "Unequip Current");
  assert.deepEqual(f.calls.unequip, [{ slot: f.weapon, set: 0 }]);
  const header = new f.EquipmentGridIconElement(); f.body.append(header);
  const headerMenu = f.show(header);
  assert.equal(slots(headerMenu).length, 6);
  assert.ok(!header.container.querySelector(".kroky-quick-unequip"));
  assert.ok(headerMenu.querySelector(".kroky-quick-equip-unequip-current"), "the same placement reaches the top bar");
  assertPopupUnequipOrder(headerMenu);
});

test("the off-default unequip icon switch adds overlays without removing either popup action", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } }, f = fixture(saved);
  const field = f.fields.get("unequip-on-equipment-icons");
  assert.ok(field, "unequip placement must be configurable");
  assert.equal(field.type, "switch"); assert.equal(field.label, "Show Unequip Button on Equipment Icons"); assert.equal(field.default, false);
  assert.match(field.hint, /always/i); assert.match(field.hint, /Bank/);
  assert.equal(typeof f.setDirectUnequip("false"), "string");
  assert.equal(f.settingsValues.get(field.name), false);
  const menu = f.show(), header = new f.EquipmentGridIconElement(); f.body.append(header); const headerMenu = f.show(header);
  const controls = [f.icon.quickEquip.unequipButton, header.quickEquip.unequipButton];
  for (let cycle = 0; cycle < 3; cycle++) {
    f.setDirectUnequip(true);
    for (const [index, icon] of [f.icon, header].entries()) {
      const button = icon.container.querySelector(".kroky-quick-unequip");
      const current = [menu, headerMenu][index], popup = current.querySelector(".kroky-quick-equip-unequip-current");
      assert.ok(button); assert.ok(button !== controls[index], "the optional overlay is separate from the permanent popup action");
      assert.ok(popup === controls[index], "enabling overlays keeps the same native popup control");
      assertPopupUnequipOrder(current);
      assert.equal(popup.hidden, false); assert.equal(popup.disabled, false);
      assert.equal(button.textContent, "−"); assert.equal(button.hidden, false); button.click();
      popup.click();
      assert.equal(current.querySelectorAll(".kroky-quick-equip-unequip-current").length, 1);
      assert.equal(icon.container.querySelectorAll(".kroky-quick-unequip").length, 1);
    }
    f.setDirectUnequip(false);
    for (const [index, current] of [menu, headerMenu].entries()) {
      const button = current.querySelector(".kroky-quick-equip-unequip-current");
      assert.ok(button); assert.ok(button === controls[index]); assertPopupUnequipOrder(current);
      assert.equal(button.textContent, "Unequip Current"); assert.equal(button.hidden, false); button.click();
      assert.equal(current.querySelectorAll(".kroky-quick-equip-unequip-current").length, 1);
      const overlay = [f.icon, header][index].container.querySelector(".kroky-quick-unequip");
      assert.ok(!overlay || overlay.hidden, "turning the setting off hides only the optional overlay");
    }
    assert.equal(f.calls.unequip.length, (cycle + 1) * 6, "both controls invoke the native action exactly once per click");
  }
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved);
  assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.scans, 0);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems.length, 3);
});

test("unequip placement restores saved preferences, applies before first opening and respects native-menu restoration", () => {
  const f = fixture(undefined, true, "click", true, "compact", true);
  assert.ok(f.icon.container.querySelector(".kroky-quick-unequip"), "saved direct placement applies before first opening");
  const menu = f.show(); assertPopupUnequipOrder(menu);
  f.setDirectUnequip(false);
  assert.ok(!f.icon.container.querySelector(".kroky-quick-unequip"));
  f.show(); assertPopupUnequipOrder(menu);
  new Game().decode(undefined, true, "click", true, "compact", true);
  assert.ok(f.icon.container.querySelector(".kroky-quick-unequip"));
  assertPopupUnequipOrder(menu);
  new Game().decode(undefined, true, "click", true, "compact", false);
  assertPopupUnequipOrder(menu);
  for (const corrupt of ["true", 1, null]) {
    new Game().decode(undefined, true, "click", true, "compact", corrupt);
    assert.ok(menu.querySelector(".kroky-quick-equip-unequip-current"), "only a saved boolean true enables direct controls");
    assertPopupUnequipOrder(menu);
  }
  f.toggle(false); assertNativeMenu(f.icon);
  f.setDirectUnequip(true); assertNativeMenu(f.icon);
  assert.equal(menu.unequipButton.textContent, "X", "the master switch preserves the original native menu");
  f.toggle(true); assert.ok(f.icon.container.querySelector(".kroky-quick-unequip")); assertPopupUnequipOrder(menu);
  f.toggle(false); f.setDirectUnequip(false); f.toggle(true);
  assertPopupUnequipOrder(menu);
  assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.scans, 0);
});

test("permanent popup and optional overlay controls share empty and disabled equipment guards", () => {
  const f = fixture(), equipped = f.player.equipment.getEquippedInSlot(f.weapon), menu = f.show();
  const button = menu.unequipButton;
  equipped.item = f.empty; equipped.isEmpty = true; f.show();
  assert.ok(menu.querySelector(".kroky-quick-equip-unequip-current"));
  assert.equal(button.hidden, false, "empty equipment leaves a discoverable popup action");
  assert.equal(button.getAttribute("aria-label"), "Unequip Current", "empty slots must not expose the empty item's untranslated name");
  assert.equal(button.disabled, true); button.click(); assert.deepEqual(f.calls.unequip, []);
  f.setDirectUnequip(true);
  const overlay = f.icon.container.querySelector(".kroky-quick-unequip"); assert.ok(overlay);
  assertPopupUnequipOrder(menu);
  assert.equal(button.hidden, false); assert.equal(button.disabled, true);
  assert.equal(overlay.hidden, true); assert.equal(overlay.disabled, true);
  overlay.click(); button.click(); assert.deepEqual(f.calls.unequip, []);
  equipped.item = f.sword; equipped.isEmpty = false; f.icon.setEquipped(f.player, equipped);
  assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  assert.equal(overlay.hidden, false); assert.equal(overlay.disabled, false);
  f.icon.setQuickEquipEnabled(false); button.click(); overlay.click(); assert.deepEqual(f.calls.unequip, []);
  assert.equal(button.disabled, true);
  assert.equal(overlay.disabled, true);
  f.setDirectUnequip(false); button.click(); assert.deepEqual(f.calls.unequip, []);
  assert.equal(button.disabled, true);
  f.icon.setQuickEquipEnabled(true); assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  button.click(); assert.deepEqual(f.calls.unequip, [{ slot: f.weapon, set: 0 }]);
  f.setDirectUnequip(true); overlay.click(); assert.equal(f.calls.unequip.length, 2);
  f.icon.setEquipped({ ...f.player }, equipped);
  assert.equal(button.disabled, true, "equipment belonging to another player context cannot invoke the main character action");
  assert.equal(overlay.disabled, true);
  button.click(); overlay.click(); assert.equal(f.calls.unequip.length, 2);
});

test("bank selection filters compatible items without timers, render hooks or repeated work during stable equipment refreshes", t => {
  const intervals = t.mock.method(globalThis, "setInterval", () => 0), timeouts = t.mock.method(globalThis, "setTimeout", () => 0);
  const f = fixture();
  const unequip = f.icon.quickEquip.unequipButton;
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

test("clicking a bank item previews it without assigning or changing normal quick-slot equipment actions", () => {
  const f = fixture(); const menu = f.show(); openBank(menu);
  const nativeBefore = [...f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems];
  bankItem(menu, f.spear).click();
  assert.deepEqual(f.calls.previews, [f.spear]);
  assert.match(menu.querySelector(".kroky-quick-equip-preview").textContent, /Stats for Spear/);
  assert.equal(menu.querySelector(".kroky-quick-equip-preview").hidden, false);
  assert.deepEqual(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems, nativeBefore);
  assert.equal(f.calls.writes.length, 0); assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []);
  slots(menu)[0].click();
  assert.deepEqual(f.calls.quick, [{ slot: f.weapon, index: 0 }], "a preview must not arm click-to-overwrite on quick slots");
  assert.deepEqual(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems, nativeBefore);
});

test("keyboard picking and dropping assigns shortcuts without equipping and preserves replacement-only behavior", () => {
  const f = fixture(); const menu = f.show(); openBank(menu);
  const pickup = bankItem(menu, f.spear).dispatch("keydown", { key: " " });
  assert.equal(pickup.prevented, true, "Space picks up the item without scrolling the page");
  const placement = slots(menu)[2].dispatch("keydown", { key: "Enter" });
  assert.equal(placement.prevented, true);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[2], f.spear);
  assert.deepEqual(f.calls.quick, [], "keyboard assignment must not equip immediately");
  slots(menu)[2].click();
  assert.deepEqual(f.calls.quick, [{ slot: f.weapon, index: 2 }]);
  bankItem(menu, f.bow).dispatch("keydown", { key: " " }); slots(menu)[3].dispatch("keydown", { key: " " }); slots(menu)[3].click();
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
  const unequip = f.icon.quickEquip.unequipButton; assert.ok(unequip.hidden || unequip.disabled);
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

test("temporarily disabling quick equip disables its popup unequip control and restores it when enabled again", () => {
  const f = fixture(); f.show();
  const button = f.icon.quickEquip.unequipButton;
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

function assertNativeMenu(icon) {
  const menu = icon.quickEquip;
  assert.equal(slots(menu).length, 0, "disabled rework must leave no enhanced shortcut targets");
  assert.equal(menu.querySelector(".kroky-quick-equip-bank"), null);
  assert.equal(menu.buttons.length, 3);
  for (const { equip, set } of menu.buttons) {
    assert.equal(menu.contains(equip), true); assert.equal(menu.contains(set), true);
    assert.equal(set.hidden, false, "native Set buttons must be available again");
  }
  assert.equal(menu.contains(menu.unequipButton), true, "native X returns to the popup");
  assert.equal(icon.container.querySelector(".kroky-quick-unequip"), null);
  assert.equal(menu.querySelector(".kroky-quick-equip-layout"), null);
  assert.equal(menu.querySelector(".kroky-quick-equip-column"), null);
  const nativeRoot = menu.buttonContainer.parentElement, heading = nativeRoot.querySelector("lang-string");
  assert.ok(heading); assert.equal(heading.parentElement, nativeRoot);
  assert.ok(nativeRoot.children.indexOf(heading) < nativeRoot.children.indexOf(menu.buttonContainer), "restoration returns the title above the native slots");
}

test("saved disabled preference leaves the native three-slot menu and its actions intact before first opening", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } };
  const f = fixture(saved, false); const field = f.fields.get("quick-equip-enabled");
  assert.ok(field); assert.equal(field.type, "switch"); assert.equal(field.default, true);
  assert.equal(field.label, "Enhanced Equipment Menu");
  f.show(); assertNativeMenu(f.icon);
  assert.equal(f.icon.image.getAttribute("role"), null, "disabled rework preserves the native image role");
  f.icon.quickEquip.buttons[0].equip.click();
  f.icon.quickEquip.buttons[1].set.click();
  f.icon.quickEquip.unequipButton.click();
  assert.deepEqual(f.calls.quick, [{ slot: f.weapon, index: 0 }]);
  assert.deepEqual(f.calls.set, [{ slot: f.weapon, index: 1 }]);
  assert.deepEqual(f.calls.unequip, [{ slot: f.weapon, set: 0 }]);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved);
  assert.equal(f.calls.scans, 0); assert.equal(f.calls.writes.length, 0);
});

test("turning off an open rework immediately restores both grids and rejects stale drag targets while retaining shortcuts", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } };
  const f = fixture(saved); const menu = f.show(); openBank(menu);
  const header = new f.EquipmentGridIconElement(); f.body.append(header); f.show(header);
  const shortcuts = [...f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems];
  const target = slots(menu)[3], source = bankItem(menu, f.axe), dataTransfer = dragData();
  source.dispatch("dragstart", { dataTransfer });
  assert.equal(f.toggle(false), undefined);
  assertNativeMenu(f.icon); assertNativeMenu(header);
  target.dispatch("drop", { dataTransfer });
  assert.deepEqual(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems, shortcuts);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved);
  assert.equal(f.calls.writes.length, 0);
  f.icon.quickEquip.buttons[0].equip.click(); header.quickEquip.buttons[0].equip.click();
  assert.equal(f.calls.quick.length, 2, "each native shortcut action must fire once after restoration");
  f.icon.quickEquip.unequipButton.click();
  assert.equal(f.calls.unequip.length, 1, "native popup X must not also trigger the enhanced listener");
  f.toggle(true);
  assert.equal(slots(menu).length, 6); assert.equal(slots(header.quickEquip).length, 6);
  assert.equal(slots(menu)[3].querySelector("img").src, f.spear.media);
  assert.ok(menu.querySelector(".kroky-quick-equip-unequip-current"));
  for (const current of [menu, header.quickEquip]) assertPopupUnequipOrder(current);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved);
});

test("repeated live configuration changes never duplicate shortcut or unequip actions", () => {
  const f = fixture(); const menu = f.show();
  for (let cycle = 0; cycle < 4; cycle++) {
    f.toggle(false); assertNativeMenu(f.icon);
    menu.buttons[0].equip.click(); menu.unequipButton.click();
    assert.equal(f.calls.quick.length, cycle * 2 + 1); assert.equal(f.calls.unequip.length, cycle * 2 + 1);
    f.toggle(true);
    assert.equal(slots(menu).length, 6); assert.equal(menu.querySelectorAll(".kroky-quick-equip-bank").length, 1);
    slots(menu)[0].click(); menu.unequipButton.click();
    assert.equal(f.calls.quick.length, cycle * 2 + 2); assert.equal(f.calls.unequip.length, cycle * 2 + 2);
  }
  assert.equal(f.calls.scans, 0); assert.equal(f.calls.writes.length, 0);
});

test("enhanced popup backdrops stay isolated and restore native presentation when disabled", () => {
  const f = fixture(); const menu = f.show(), popper = f.icon.quickEquipTooltip.popper;
  assert.ok(popper.querySelector(".tippy-content").contains(menu), "the fixture keeps the native tooltip wrapper around its content");
  assert.equal(popper.classList.contains("kroky-equipment-floating"), true);
  f.toggle(false);
  assert.equal(popper.classList.contains("kroky-equipment-floating"), false, "native tooltip presentation returns with the native menu");
  f.toggle(true);
  assert.equal(popper.classList.contains("kroky-equipment-floating"), true);
  f.show();
  assert.equal(popper.classList.contains("kroky-equipment-floating"), true, "reopening does not discard the enhanced popup treatment");
  assert.equal(f.calls.scans, 0); assert.equal(f.calls.writes.length, 0);
});

test("per-character preference restores through load and native decode without discarding extra slots", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } };
  const f = fixture(saved, false); const menu = f.show(); assertNativeMenu(f.icon);
  f.toggle(true); assert.equal(slots(menu).length, 6);
  assert.equal(f.settingsValues.get("quick-equip-enabled"), true);
  assert.equal(typeof f.fields.get("quick-equip-enabled").onChange("false"), "string");
  new Game().decode(saved, false); assertNativeMenu(f.icon);
  new Game().decode(saved, true); assert.equal(slots(menu).length, 6);
  assert.equal(slots(menu)[3].querySelector("img").src, f.spear.media);
  assert.equal(f.calls.writes.length, 0, "configuration changes must not rewrite shortcut storage");
});

test("opening quick equip from the header retains its dropdown only while the rework is enabled", () => {
  const f = fixture(), dropdown = new Element(); let closeCount = 0;
  dropdown.addEventListener("click", () => closeCount++);
  const header = new f.EquipmentGridIconElement(); dropdown.append(header); f.body.append(dropdown);
  header.setEquipped(f.player, f.player.equipment.getEquippedInSlot(f.weapon));
  header.image.click();
  assert.equal(slots(header.quickEquip).length, 6, "the native image click still opens the menu");
  assert.equal(closeCount, 0, "the same click must not bubble to Bootstrap and close its parent equipment dropdown");
  f.toggle(false); header.image.click();
  assertNativeMenu(header);
  assert.equal(closeCount, 1, "disabled rework restores native propagation");
  f.toggle(true); header.image.click();
  assert.equal(closeCount, 1, "re-enabling keeps the dropdown open without duplicate handlers");
});

test("the first native connection keeps the title above shortcuts and assignment feedback below them", () => {
  const f = fixture(), menu = f.show(), status = menu.querySelector(".kroky-quick-equip-status");
  assert.equal(menu.isConnected, true);
  const column = menu.querySelector(".kroky-quick-equip-column"), layout = menu.querySelector(".kroky-quick-equip-layout");
  assert.equal(column.parentElement, layout);
  assert.equal(status.parentElement, column, "feedback stays in the same column as the equipment slots");
  assert.equal(menu.buttonContainer.parentElement.parentElement, column);
  assert.ok(column.children.indexOf(menu.buttonContainer.parentElement) < column.children.indexOf(status), "feedback must follow the shortcut actions");
  const heading = column.querySelector("lang-string");
  assert.ok(heading); assert.equal(heading.parentElement, column);
  assert.ok(column.children.indexOf(heading) < column.children.indexOf(menu.buttonContainer.parentElement), "native title stays above the shortcuts");
  const picker = openBank(menu);
  assert.equal(picker.parentElement, column);
  assert.ok(column.children.indexOf(status) < column.children.indexOf(picker), "the picker follows feedback under the shortcuts");
  assert.equal(menu.querySelector(".kroky-quick-equip-preview").parentElement, layout, "preview sits beside the entire equipment column");
  drop(menu, f.axe, 3);
  assert.match(status.textContent, /Axe assigned/);
});

test("equipment preview is one click-default radio selection and validates its supported modes", () => {
  const f = fixture(), field = f.fields.get("equipment-item-stats-mode");
  assert.ok(field); assert.equal(field.type, "radio-group");
  assert.equal(field.label, "Show Item Stats in Equipment"); assert.equal(field.default, "click");
  assert.deepEqual(field.options, [
    { value: "click", label: "By clicking on item" },
    { value: "hover", label: "By hovering over item" },
  ]);
  assert.equal(typeof f.setStatsMode("icon"), "string", "equipment does not expose the skill-only icon option");
  assert.equal(f.settingsValues.get("equipment-item-stats-mode"), "click");
  assert.equal(f.setStatsMode("hover"), undefined);
  assert.equal(f.settingsValues.get("equipment-item-stats-mode"), "hover");
  assert.equal(f.calls.writes.length, 0, "preferences use native settings rather than rewriting shortcut storage");
});

test("equipment stats layout defaults to Compact and passes the active equipment slot to its fixed comparison renderer", () => {
  const f = fixture(), menu = f.show(), field = f.fields.get("equipment-preview-stats-mode");
  assert.ok(field, "the equipment stats layout setting must be registered");
  assert.equal(field.type, "radio-group"); assert.equal(field.label, "Equipment Stats Layout"); assert.equal(field.default, "compact");
  assert.deepEqual(field.options, [
    { value: "vanilla", label: "Vanilla" },
    { value: "compact", label: "Compact" },
  ]);
  assert.equal(typeof f.setLayout("unsupported"), "string");
  assert.equal(f.settingsValues.get(field.name), "compact");
  openBank(menu); bankItem(menu, f.spear).click();
  assert.deepEqual(f.calls.previewOptions.at(-1), { fullStats: true, layout: "compact", equipment: f.player.equipment, slot: f.weapon });
  assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []); assert.equal(f.calls.writes.length, 0);
  const picker = menu.querySelector(".kroky-quick-equip-picker"), preview = menu.querySelector(".kroky-quick-equip-preview");
  assert.equal(f.setLayout("vanilla"), undefined);
  assert.equal(picker.hidden, true); assert.equal(preview.hidden, true); assert.equal(preview.childNodes.length, 0);
  assert.equal(f.calls.scans, 1, "changing layout does not rescan the bank");
  openBank(menu); bankItem(menu, f.spear).click();
  assert.equal(f.calls.previewOptions.at(-1).layout, "vanilla");
  assert.equal(f.calls.previews.length, 2, "Vanilla uses the same inline renderer with its own layout");
  assert.deepEqual(f.calls.nativeStats, []);
  assert.equal(f.calls.writes.length, 0, "layout settings do not rewrite stored shortcuts");
});

test("equipment stats layout restores per character and decode while legacy values fall back to Compact", () => {
  const f = fixture(undefined, true, "click", true, "vanilla"), menu = f.show(); openBank(menu); bankItem(menu, f.spear).click();
  assert.equal(f.calls.previews.at(-1), f.spear); assert.equal(f.calls.previewOptions.at(-1).layout, "vanilla"); assert.deepEqual(f.calls.nativeStats, []);
  new Game().decode(undefined, true, "click", true, "compact");
  openBank(menu); bankItem(menu, f.axe).click(); assert.equal(f.calls.previews.at(-1), f.axe);
  for (const legacy of ["item", "difference", "both", "unsupported"]) {
    new Game().decode(undefined, true, "click", true, legacy);
    openBank(menu); bankItem(menu, f.axe).click();
    assert.equal(f.calls.previews.at(-1), f.axe, `${legacy} safely restores the Compact layout`);
    assert.equal(f.calls.previewOptions.at(-1).layout, "compact"); assert.equal(f.calls.nativeStats.length, 0);
  }
  f.player.selectedEquipmentSet = 1;
  f.show(f.icon, f.quiver); openBank(menu); bankItem(menu, f.arrows).click();
  const options = f.calls.previewOptions.at(-1);
  assert.equal(options.equipment, f.player.equipmentSets[1].equipment);
  assert.equal(options.slot, f.quiver, "the picker slot must override an item's default valid slot");
  assert.equal(options.fullStats, true);
  assert.equal("mode" in options, false, "Compact always renders values and differences rather than separate value modes");
  assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []); assert.equal(f.calls.writes.length, 0);
});

test("Vanilla keeps the picker open and renders its stats beside it without opening a modal or changing equipment", () => {
  const f = fixture(undefined, true, "click", true, "vanilla"), menu = f.show(); openBank(menu);
  const before = [...f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems];
  bankItem(menu, f.spear).click();
  assert.deepEqual(f.calls.nativeStats, []); assert.deepEqual(f.calls.tooltipHides, []);
  assert.deepEqual(f.calls.previews, [f.spear]); assert.equal(f.calls.previewOptions.at(-1).layout, "vanilla");
  assert.equal(menu.querySelector(".kroky-quick-equip-picker").hidden, false);
  assert.equal(menu.querySelector(".kroky-quick-equip-preview").hidden, false);
  assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []);
  assert.deepEqual(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems, before); assert.equal(f.calls.writes.length, 0);
});

test("Vanilla supports hover and keyboard assignment inline without opening the native stats dialog", () => {
  const f = fixture(undefined, true, "hover", true, "vanilla"), menu = f.show(); openBank(menu);
  const before = [...f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems];
  bankItem(menu, f.spear).dispatch("mouseenter"); bankItem(menu, f.spear).dispatch("focus");
  assert.deepEqual(f.calls.previews, [f.spear], "Vanilla hover and focus share the same visible preview");
  assert.equal(f.calls.previewOptions.at(-1).layout, "vanilla");
  assert.equal(menu.querySelector(".kroky-quick-equip-picker").hidden, false);
  assert.deepEqual(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems, before);
  bankItem(menu, f.spear).dispatch("keydown", { key: " " }); slots(menu)[1].dispatch("keydown", { key: "Enter" });
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[1], f.spear);
  assert.deepEqual(f.calls.nativeStats, []); assert.deepEqual(f.calls.equip, []); assert.deepEqual(f.calls.quick, []);
});

test("Vanilla keyboard assignment in click mode remains separate from inspection", () => {
  const f = fixture(undefined, true, "click", true, "vanilla"), menu = f.show(); openBank(menu);
  bankItem(menu, f.spear).dispatch("keydown", { key: " " }); slots(menu)[1].dispatch("keydown", { key: "Enter" });
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[1], f.spear);
  assert.deepEqual(f.calls.nativeStats, []); assert.deepEqual(f.calls.equip, []); assert.deepEqual(f.calls.quick, []);
});

test("inline equipment previews do not depend on native modal APIs or native equipment item types", () => {
  const f = fixture(undefined, true, "click", true, "vanilla"), menu = f.show(); openBank(menu);
  const nativeStats = globalThis.viewItemStats;
  delete globalThis.viewItemStats;
  bankItem(menu, f.spear).click();
  assert.deepEqual(f.calls.nativeStats, []); assert.deepEqual(f.calls.previews, [f.spear]);
  assert.equal(f.calls.previewOptions.at(-1).layout, "vanilla");
  assert.equal(menu.querySelector(".kroky-quick-equip-preview").hidden, false);
  globalThis.viewItemStats = nativeStats;
  const customItem = { id: "test:Custom", name: "Custom Item", media: "custom.png", equipRequirements: [], fitsInSlot: id => id === f.weapon.id };
  f.items.push(customItem); f.bankItems.set(customItem, { item: customItem, quantity: 1 });
  f.show(); openBank(menu); bankItem(menu, customItem).click();
  assert.deepEqual(f.calls.nativeStats, [], "non-native item types must not be passed to the native equipment dialog");
  assert.equal(f.calls.previews.at(-1), customItem);
  assert.equal(f.calls.previewOptions.at(-1).layout, "vanilla");
  bankItem(menu, f.plain).click();
  assert.ok(!menu.querySelector(".kroky-quick-equip-selected-name"), "item names are shown in the preview rather than repeated under search");
  const fallback = menu.querySelector(".kroky-quick-equip-preview");
  assert.equal(fallback.textContent, f.plain.name);
  assert.equal(fallback.hidden, false, "items without stats still expose their name in the side preview");
});

test("extra quick slots default to enabled and can be hidden without changing stored assignments", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", "test:Bow", null] } };
  const f = fixture(saved), menu = f.show(), field = f.fields.get("extra-quick-slots-enabled");
  assert.equal(field.type, "switch"); assert.equal(field.label, "Enable 3 Extra Quick Slots"); assert.equal(field.default, true);
  assert.equal(slots(menu).filter(button => !button.hidden).length, 6);
  assert.equal(typeof f.setExtraSlots("false"), "string");
  assert.equal(f.settingsValues.get("extra-quick-slots-enabled"), true);
  const header = new f.EquipmentGridIconElement(); f.body.append(header); const headerMenu = f.show(header);
  f.setExtraSlots(false);
  for (const current of [menu, headerMenu]) {
    assert.equal(slots(current).filter(button => !button.hidden).length, 3);
    assert.ok(current.querySelector(".kroky-quick-equip-bank"), "the enhanced Bank picker remains available with three slots");
    assert.ok(current.buttons.every(button => !current.contains(button.set)), "hiding extras does not restore native Set buttons");
  }
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved); assert.equal(f.calls.writes.length, 0);
  f.setExtraSlots(true);
  assert.equal(slots(menu).filter(button => !button.hidden).length, 6);
  assert.equal(slots(menu)[3].querySelector("img").src, f.spear.media);
  assert.equal(slots(menu)[4].querySelector("img").src, f.bow.media);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems.length, 3);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved); assert.equal(f.calls.scans, 0);
});

test("hidden extra slots reject clicks, drag drops and keyboard assignment while native shortcuts remain usable", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } };
  const f = fixture(saved), menu = f.show(); f.setExtraSlots(false); openBank(menu);
  slots(menu)[3].click();
  drop(menu, f.axe, 3);
  const source = bankItem(menu, f.axe); source.dispatch("keydown", { key: " " });
  slots(menu)[3].dispatch("keydown", { key: "Enter" });
  assert.deepEqual(f.calls.equip, []); assert.deepEqual(f.calls.quick, []); assert.equal(f.calls.writes.length, 0);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved);
  drop(menu, f.bow, 0);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems[0], f.bow);
  slots(menu)[0].click(); assert.deepEqual(f.calls.quick, [{ slot: f.weapon, index: 0 }]);
  assert.equal(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems.length, 3);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved); assert.equal(f.calls.writes.length, 0);
});

test("extra-slot preference restores per character and decode without interfering with native menu restoration", () => {
  const saved = { 0: { "test:Weapon": ["test:Spear", null, null] } };
  const f = fixture(saved, true, "click", false), menu = f.show();
  assert.equal(slots(menu).filter(button => !button.hidden).length, 3);
  f.setExtraSlots(true); assert.equal(slots(menu).filter(button => !button.hidden).length, 6);
  new Game().decode(saved, true, "click", false);
  assert.equal(slots(menu).filter(button => !button.hidden).length, 3);
  f.toggle(false); assertNativeMenu(f.icon);
  f.setExtraSlots(true); assertNativeMenu(f.icon);
  f.setExtraSlots(false); assertNativeMenu(f.icon);
  f.toggle(true); assert.equal(slots(menu).filter(button => !button.hidden).length, 3);
  new Game().decode(saved, true, "click", true);
  assert.equal(slots(menu).filter(button => !button.hidden).length, 6);
  assert.equal(slots(menu)[3].querySelector("img").src, f.spear.media);
  assert.deepEqual(f.values.get("quick-equip-extra-slots"), saved); assert.equal(f.calls.writes.length, 0);
  assert.equal(f.calls.scans, 0, "preferences and native restoration do not scan the bank");
});

test("item names appear only in the side preview while search leads directly into the bank grid", () => {
  const f = fixture(), menu = f.show(), picker = openBank(menu);
  const search = picker.querySelector("input");
  const items = picker.querySelector(".kroky-quick-equip-items"), preview = menu.querySelector(".kroky-quick-equip-preview");
  assert.ok(preview); assert.equal(preview.hidden, true);
  assert.ok(!picker.querySelector(".kroky-quick-equip-selected-name"), "the duplicated name below Search Bank is removed");
  assert.equal(search.parentElement, items.parentElement);
  assert.ok(search.nextSibling === items, "the item grid immediately follows search");
  const layout = menu.querySelector(".kroky-quick-equip-layout"), column = menu.querySelector(".kroky-quick-equip-column");
  assert.equal(preview.parentElement, layout); assert.equal(picker.parentElement, column); assert.equal(column.parentElement, layout);
  assert.equal(column.contains(preview), false, "preview cannot push the bank grid away from its quick-slot column");
  bankItem(menu, f.spear).click();
  assert.equal(preview.hidden, false); assert.match(preview.textContent, /Stats for Spear/);
  assert.equal(preview.querySelector("h5").textContent, f.spear.name, "the preview header owns the selected item name");
  assert.equal(f.icon.quickEquipTooltip.props.maxWidth, "none", "the native tooltip can expand to include the side pane");
  bankItem(menu, f.plain).click();
  assert.equal(preview.textContent, f.plain.name); assert.equal(preview.hidden, false, "name-only fallback remains visible in the preview");
  assert.equal(f.icon.quickEquipTooltip.props.maxWidth, "none", "the fallback uses the same side-preview container");
  assert.deepEqual(f.calls.quick, []); assert.deepEqual(f.calls.equip, []); assert.equal(f.calls.writes.length, 0);
});

test("hover previews are opt-in and keyboard focus previews items without arming assignment", () => {
  const f = fixture(), menu = f.show(); openBank(menu);
  bankItem(menu, f.spear).dispatch("mouseenter");
  assert.deepEqual(f.calls.previews, [], "default click mode must not inspect items while the pointer passes over them");
  f.setStatsMode("hover"); openBank(menu);
  bankItem(menu, f.spear).dispatch("mouseenter");
  assert.deepEqual(f.calls.previews, [f.spear]);
  bankItem(menu, f.spear).dispatch("focus"); bankItem(menu, f.spear).dispatch("mouseenter");
  assert.deepEqual(f.calls.previews, [f.spear], "hover and focus on the same item reuse the visible preview");
  bankItem(menu, f.axe).dispatch("focus");
  assert.equal(f.calls.previews.at(-1), f.axe, "focus supplies the keyboard equivalent of hover");
  const before = [...f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems];
  slots(menu)[0].click();
  assert.deepEqual(f.calls.quick, [{ slot: f.weapon, index: 0 }]);
  assert.deepEqual(f.player.equipment.getEquippedInSlot(f.weapon).quickEquipItems, before);
  assert.equal(f.calls.writes.length, 0);
});

test("equipping through a quick slot refreshes an open search with items returned to Bank", async () => {
  const f = fixture(), equipped = f.player.equipment.getEquippedInSlot(f.weapon);
  f.sword.name = "Ultima Godsword"; f.axe.name = "God Axe";
  f.bankItems.delete(f.sword);
  const menu = f.show(), picker = openBank(menu), search = picker.querySelector("input");
  search.value = "god"; search.dispatch("input");
  assert.equal(bankItem(menu, f.sword), undefined, "the equipped Godsword is initially absent from Bank");
  bankItem(menu, f.axe).click();
  const preview = menu.querySelector(".kroky-quick-equip-preview");
  assert.equal(preview.hidden, false);
  f.player.onQuickEquipClick = function (slot, index) {
    f.calls.quick.push({ slot, index });
    const next = this.equipment.getQuickEquipItem(slot, index), previous = equipped.item;
    f.bankItems.set(previous, { item: previous, quantity: 1 }); f.bankItems.delete(next);
    equipped.item = next; equipped.isEmpty = false;
    f.emitEquipmentChanged(true);
  };
  slots(menu)[1].click(); await Promise.resolve();
  assert.equal(search.value, "god", "native equipment changes preserve the user's query");
  assert.equal(picker.hidden, false);
  assert.equal(bankItem(menu, f.sword)?.hidden, false, "the returned Godsword appears without reopening Bank");
  assert.equal(bankItem(menu, f.axe), undefined, "the newly equipped item is removed from the picker");
  assert.equal(preview.hidden, true, "a selected item that left Bank cannot keep stale stats visible");
  assert.equal(preview.children.length, 0);
  assert.equal(f.calls.scans, 2, "equipmentChanged and itemEquipped from one equip coalesce into one bank refresh");
  assert.equal(f.calls.writes.length, 0, "equipping never rewrites quick-slot assignments");
  slots(menu)[0].click(); await Promise.resolve();
  assert.equal(search.value, "god");
  assert.equal(bankItem(menu, f.sword), undefined);
  assert.equal(bankItem(menu, f.axe)?.hidden, false, "the search stays live over subsequent equipment changes");
  assert.equal(f.calls.scans, 3);
});

test("open equipment changes preserve visible selection and scroll while refreshing its comparison", async () => {
  const f = fixture(); f.spear.name = "God Spear";
  for (let index = 0; index < 40; index++) {
    const item = new EquipmentItem(`God Weapon ${index}`); f.items.push(item); f.bankItems.set(item, { item, quantity: 1 });
  }
  const menu = f.show(), picker = openBank(menu), search = picker.querySelector("input"), list = picker.querySelector(".kroky-quick-equip-items");
  search.value = "god"; search.dispatch("input"); bankItem(menu, f.spear).click();
  list.clientHeight = 120; list.scrollHeight = 600; list.scrollTop = 137;
  const before = f.calls.previews.length;
  f.player.equipment.getEquippedInSlot(f.weapon).item = f.axe;
  f.emitEquipmentChanged(true); await Promise.resolve();
  assert.equal(search.value, "god"); assert.equal(list.scrollTop, 137);
  assert.equal(bankItem(menu, f.spear)?.getAttribute("aria-pressed"), "true");
  assert.equal(menu.querySelector(".kroky-quick-equip-preview").hidden, false);
  assert.equal(f.calls.previews.length, before + 1, "the selected item's comparison is recomputed against current gear");
  assert.equal(f.calls.previews.at(-1), f.spear);
  assert.equal(f.calls.previewOptions.at(-1).equipment, f.player.equipment);
  assert.equal(f.calls.scans, 2);
  search.value = "axe"; search.dispatch("input");
  f.emitEquipmentChanged(); await Promise.resolve();
  assert.equal(menu.querySelector(".kroky-quick-equip-preview").hidden, true, "an item outside the active query cannot remain selected");
});

test("quantity-only native equipment events refresh Bank counts and empty-slot unequip state", async () => {
  const f = fixture(), menu = f.show(f.icon, f.quiver), picker = openBank(menu), search = picker.querySelector("input");
  search.value = "arrows"; search.dispatch("input"); bankItem(menu, f.arrows).click();
  f.player.onQuickEquipClick = function (slot, index) {
    f.calls.quick.push({ slot, index });
    f.bankItems.get(f.arrows).quantity -= 3;
    this.equipment.getEquippedInSlot(slot).quantity += 3;
    f.emitItemEquipped();
  };
  slots(menu)[0].click(); await Promise.resolve();
  assert.equal(search.value, "arrows");
  assert.equal(bankItem(menu, f.arrows).getAttribute("aria-label"), "Arrows (12)");
  assert.equal(bankItem(menu, f.arrows).getAttribute("aria-pressed"), "true");
  assert.equal(f.calls.previews.length, 2); assert.equal(f.calls.scans, 2);
  const equipped = f.player.equipment.getEquippedInSlot(f.quiver);
  equipped.item = f.empty; equipped.isEmpty = true;
  f.emitEquipmentChanged(); await Promise.resolve();
  assert.equal(menu.unequipButton.hidden, false); assert.equal(menu.unequipButton.disabled, true);
});

test("equipment event subscriptions remain singular and closed pickers never rescan Bank", async () => {
  const f = fixture(); f.show();
  f.hooks.character(); f.hooks.interface(); new Game().decode();
  for (const name of ["equipmentChanged", "itemEquipped"]) {
    assert.equal(f.equipmentListeners.get(name)?.size, 1);
    assert.equal(f.calls.eventOn.filter(call => call.name === name).length, 1, "readiness and decode must not add duplicate handlers");
  }
  f.emitEquipmentChanged(true); await Promise.resolve();
  assert.equal(f.calls.scans, 0, "a menu whose Bank picker was never opened does no data work");
  const menu = f.icon.quickEquip; openBank(menu);
  f.emitEquipmentChanged(true); menu.querySelector(".kroky-quick-equip-bank").click();
  await Promise.resolve(); assert.equal(f.calls.scans, 1, "closing before a queued refresh cancels its bank work");
  f.emitEquipmentChanged(true); await Promise.resolve(); assert.equal(f.calls.scans, 1);
  const nextListeners = new Map(), replacement = { ...f.player,
    on(name, callback) { if (!nextListeners.has(name)) nextListeners.set(name, new Set()); nextListeners.get(name).add(callback); },
    off(name, callback) { nextListeners.get(name)?.delete(callback); },
  };
  f.game.combat.player = replacement; f.hooks.character();
  for (const name of ["equipmentChanged", "itemEquipped"]) {
    assert.equal(f.equipmentListeners.get(name)?.size, 0, "changing player context detaches the previous character's listener");
    assert.equal(nextListeners.get(name)?.size, 1);
  }
  f.emitEquipmentChanged(true); await Promise.resolve(); assert.equal(f.calls.scans, 1);
  for (const listeners of nextListeners.values()) for (const callback of listeners) callback({});
  await Promise.resolve(); assert.equal(f.calls.scans, 1, "replacement-player events also leave closed pickers alone");
});

test("preview mode restores per character and through decode while clearing an earlier mode's picker state", () => {
  const f = fixture(undefined, true, "hover"), menu = f.show(); openBank(menu);
  bankItem(menu, f.spear).dispatch("mouseenter"); assert.equal(f.calls.previews.at(-1), f.spear);
  const preview = menu.querySelector(".kroky-quick-equip-preview"), picker = menu.querySelector(".kroky-quick-equip-picker");
  f.setStatsMode("click");
  assert.equal(picker.hidden, true); assert.equal(preview.hidden, true); assert.equal(preview.childNodes.length, 0);
  openBank(menu); bankItem(menu, f.axe).dispatch("mouseenter"); assert.equal(f.calls.previews.length, 1);
  new Game().decode(undefined, true, "hover"); openBank(menu); bankItem(menu, f.axe).dispatch("mouseenter");
  assert.equal(f.calls.previews.at(-1), f.axe);
  new Game().decode(undefined, true, "unsupported"); openBank(menu);
  const count = f.calls.previews.length; bankItem(menu, f.spear).dispatch("mouseenter"); assert.equal(f.calls.previews.length, count);
  bankItem(menu, f.spear).click(); assert.equal(f.calls.previews.at(-1), f.spear, "invalid saved values safely use click mode");
  assert.equal(f.calls.writes.length, 0);
});

test("closing the bank picker frees preview content and stale or disabled sources cannot reopen it", () => {
  const f = fixture(undefined, true, "hover"), menu = f.show(), picker = openBank(menu);
  const source = bankItem(menu, f.spear), preview = menu.querySelector(".kroky-quick-equip-preview");
  source.dispatch("mouseenter"); assert.equal(preview.hidden, false);
  menu.querySelector(".kroky-quick-equip-bank").click();
  assert.equal(picker.hidden, true); assert.equal(preview.hidden, true); assert.equal(preview.childNodes.length, 0);
  assert.ok(!picker.querySelector(".kroky-quick-equip-selected-name"));
  assert.equal(menu.querySelectorAll(".kroky-quick-equip-bank-item").length, 0);
  assert.equal(f.icon.quickEquipTooltip.props.maxWidth, 350);
  assert.equal(f.icon.quickEquipTooltip.props.placement, "bottom", "closing Bank restores the native tooltip anchor");
  openBank(menu); const stale = bankItem(menu, f.axe), count = f.calls.previews.length;
  f.player.selectedEquipmentSet = 1; stale.dispatch("mouseenter"); stale.click();
  assert.equal(f.calls.previews.length, count, "an item from an old equipment set cannot inspect or select into the current menu");
  f.player.selectedEquipmentSet = 0; f.show(); openBank(menu); const disabled = bankItem(menu, f.axe);
  f.icon.setQuickEquipEnabled(false); disabled.dispatch("mouseenter"); disabled.click();
  assert.equal(f.calls.previews.length, count);
  assert.equal(f.calls.writes.length, 0);
});

test("side previews flip away from the right edge without repeated bank scans or preview rendering", () => {
  const f = fixture();
  f.icon.image.getBoundingClientRect = () => ({ x: 1120, y: 10, left: 1120, top: 10, right: 1200, bottom: 60, width: 80, height: 50 });
  const menu = f.show(), picker = openBank(menu); bankItem(menu, f.spear).click();
  assert.equal(menu.querySelector(".kroky-quick-equip-layout").classList.contains("kroky-preview-left"), true);
  assert.equal(f.icon.quickEquipTooltip.props.placement, "bottom-end", "right-edge menus keep their bank grid anchored while a left preview expands");
  assert.equal(f.calls.previews.length, 1); assert.equal(f.calls.scans, 1);
  const search = picker.querySelector("input"); search.value = "spear"; search.dispatch("input");
  for (let index = 0; index < 20; index++) f.icon.setEquipped(f.player, f.player.equipment.getEquippedInSlot(f.weapon));
  assert.equal(f.calls.previews.length, 1, "ordinary equipment refreshes and searches must not rebuild the preview");
  assert.equal(f.calls.scans, 1, "previewing must reuse the current bank results");
  menu.querySelector(".kroky-quick-equip-bank").click();
  assert.equal(f.icon.quickEquipTooltip.props.placement, "bottom");
  const left = fixture(), leftMenu = left.show(); openBank(leftMenu);
  assert.equal(left.icon.quickEquipTooltip.props.placement, "bottom-start", "left-edge menus use the mirrored stable anchor");
  bankItem(leftMenu, left.spear).click();
  assert.equal(left.icon.quickEquipTooltip.props.placement, "bottom-start");
  leftMenu.querySelector(".kroky-quick-equip-bank").click();
  assert.equal(left.icon.quickEquipTooltip.props.placement, "bottom");
});
