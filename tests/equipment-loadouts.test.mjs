import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { installEquipmentLoadouts } from "../equipment-loadouts.mjs";
import * as planner from "../loadout-plan.mjs";
import { applyEquipmentTransaction } from "../loadout-transaction.mjs";

const storageKey = "equipment-loadout-references";

afterEach(() => {
  mock.restoreAll();
  for (const name of ["Game", "Equipment", "EquipmentSetMenu", "BankSelectedItemMenuElement", "ItemEquippedEvent", "fflate", "notifyPlayer", "document", "mod", "customElements"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); }
  children = [];
  className = "";
  hidden = false;
  attributes = {};
  listeners = new Map();
  classList = {
    contains: name => this.className.split(/\s+/).includes(name),
    add: (...names) => { for (const name of names) this.classList.toggle(name, true); },
    toggle: (name, enabled) => { const names = new Set(this.className.split(/\s+/).filter(Boolean)); if (enabled) names.add(name); else names.delete(name); this.className = [...names].join(" "); },
  };
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children.splice(node.parentElement.children.indexOf(node), 1);
      node.parentElement = this; this.children.push(node);
    }
  }
  replaceChildren(...nodes) { this.textContent = ""; this.append(...nodes); }
  querySelectorAll(selector) {
    const matches = node => selector.split(",").some(value => { value = value.trim(); return value.startsWith(".") ? node.classList.contains(value.slice(1)) : node.tagName.toLowerCase() === value; });
    return this.children.flatMap(node => [...(matches(node) ? [node] : []), ...node.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  dispatch(type) {
    const event = { stopped: false, stopPropagation() { this.stopped = true; } };
    for (const callback of this.listeners.get(type) ?? []) callback(event);
    this[`on${type}`]?.(event); return event;
  }
  set textContent(value) { this.text = value; for (const node of this.children) node.parentElement = undefined; this.children = []; }
  get textContent() { return this.text ?? ""; }
}

class Events {
  listeners = new Map();
  history = [];
  on(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  emit(type, event) { this.history.push([type, event]); for (const callback of this.listeners.get(type) ?? []) callback(event); }
}

function fixture({ configure = () => {}, saved, load = true } = {}) {
  const f = { notifications: [], errors: [], telemetry: [], writes: [], hooks: {}, patches: [], storage: new Map(), calls: { switch: 0, update: 0, setUpdate: 0, stop: 0, start: 0, nativeTick: 0, settings: 0 } };
  mock.method(console, "error", (...args) => f.errors.push(args));
  globalThis.fflate = { gzipSync, gunzipSync, strToU8: (value, binary) => Buffer.from(value, binary ? "binary" : "utf8"), strFromU8: (value, binary) => Buffer.from(value).toString(binary ? "binary" : "utf8") };
  globalThis.notifyPlayer = (_skill, message) => f.notifications.push(message);
  f.elements = new Map();
  globalThis.document = f.document = { head: new Element("head"), createElement: tag => new Element(tag), getElementById: id => f.elements.get(id) ?? null };
  globalThis.ItemEquippedEvent = class { constructor(item, quantity) { Object.assign(this, { item, quantity }); } };
  const weapon = { id: "test:Weapon", allowQuantity: false }, shield = { id: "test:Shield", allowQuantity: false }, helmet = { id: "test:Helmet", allowQuantity: false };
  const quiver = { id: "test:Quiver", allowQuantity: true }, summon1 = { id: "test:Summon1", allowQuantity: true }, summon2 = { id: "test:Summon2", allowQuantity: true };
  f.slots = { weapon, shield, helmet, quiver, summon1, summon2 };
  const slots = Object.values(f.slots);
  class Item {
    constructor(name, validSlots = [], occupiesSlots = [], charged = false) {
      Object.assign(this, { id: `test:${name}`, name, validSlots, occupiesSlots, cantEquipWith: [], equipRequirements: [], events: new Events() });
      if (charged) this.consumesChargesOn = [];
    }
    fitsInSlot(id) { return this.validSlots.some(slot => slot.id === id); }
    emit(...args) { this.events.emit(...args); }
  }
  f.items = { empty: new Item("Empty"), sword: new Item("Sword", [weapon], [], true), axe: new Item("Axe", [weapon]),
    shield: new Item("Shield", [shield]), hat: new Item("Hat", [helmet]), greatsword: new Item("Greatsword", [weapon], [shield], true),
    arrows: new Item("Arrows", [quiver]), bolts: new Item("Bolts", [quiver]), tablet: new Item("Tablet", [summon1, summon2]),
    otherTablet: new Item("OtherTablet", [summon1, summon2]), food: new Item("Food"), rune: new Item("Rune") };
  const itemByID = id => Object.values(f.items).find(item => item.id === id);
  const slotByID = id => slots.find(slot => slot.id === id);
  class EquippedItem {
    constructor(slot, emptyItem) { Object.assign(this, { slot, emptyItem, item: emptyItem, quantity: 0, occupies: [], quickEquipItems: new Array(3).fill(emptyItem) }); }
    get isEmpty() { return this.item === this.emptyItem; }
    get providesStats() { return !this.isEmpty && this.occupiedBy === undefined; }
    setEmpty() { Object.assign(this, { item: this.emptyItem, quantity: 0, occupies: [], occupiedBy: undefined }); }
    setEquipped(item, quantity, occupies) { Object.assign(this, { item, quantity, occupies, occupiedBy: undefined }); }
    setOccupied(item, occupiedBy) { Object.assign(this, { item, occupiedBy, quantity: 0, occupies: [] }); }
  }
  class Equipment {
    constructor(game) {
      this.game = game; this.equippedArray = slots.map(slot => new EquippedItem(slot, game.emptyEquipmentItem));
      this.equippedItems = Object.fromEntries(this.equippedArray.map(entry => [entry.slot.id, entry]));
      this.itemSlotMap = new Map(); this.itemChargeUsers = new Set();
    }
    getRootSlot(slot) { return this.equippedItems[slot.id].occupiedBy ?? slot; }
    getSlotOfItem(item) { return this.itemSlotMap.get(item); }
    getQuantityOfItem(item) { const slot = this.getSlotOfItem(item); return slot ? this.equippedItems[slot.id].quantity : 0; }
    checkForItem(item) { return this.itemSlotMap.has(item); }
    getSlotsToUnequip(item, slot) { return [...new Set([slot, ...item.occupiesSlots].filter(required => !this.equippedItems[required.id].isEmpty).map(required => this.getRootSlot(required)))]; }
    getItemsAddedOnEquip(item, slot) { return this.getSlotsToUnequip(item, slot).map(root => this.equippedItems[root.id]).map(({ item, quantity }) => ({ item, quantity })); }
    equipItem(item, slot, quantity) {
      this.getSlotsToUnequip(item, slot).forEach(root => this.unequipItem(root));
      this.itemSlotMap.set(item, slot);
      if (item.consumesChargesOn !== undefined) this.itemChargeUsers.add(this.equippedItems[slot.id]);
      this.equippedItems[slot.id].setEquipped(item, quantity, item.occupiesSlots);
      item.occupiesSlots.forEach(occupied => this.equippedItems[occupied.id].setOccupied(item, slot));
      f.failEquipment?.(this, item);
    }
    unequipItem(slot) {
      const entry = this.equippedItems[this.getRootSlot(slot).id];
      this.itemSlotMap.delete(entry.item); this.itemChargeUsers.delete(entry);
      entry.occupies.forEach(occupied => this.equippedItems[occupied.id].setEmpty()); entry.setEmpty();
    }
    addQuantityToSlot(slot, quantity) { this.equippedItems[slot.id].quantity += quantity; }
    removeQuantityFromSlot(slotID, quantity) {
      const entry = this.equippedItems[slotID]; entry.quantity -= quantity;
      if (entry.quantity <= 0) { this.unequipItem(entry.slot); return true; }
      return false;
    }
  }
  class Bank {
    constructor(game) {
      Object.assign(this, { game, items: new Map(), itemsByTab: [[], []], customSortOrder: [], defaultItemTabs: new Map(), maximumSlots: 100, _events: new Events(), calls: [] });
    }
    get occupiedSlots() { return this.items.size; }
    getQty(item) { return this.items.get(item)?.quantity ?? 0; }
    getItemDefaultTab(item) { return this.defaultItemTabs.get(item) ?? 0; }
    seed(item, quantity, tab = 0) {
      const bankItem = { item, quantity, tab, tabPosition: this.itemsByTab[tab].length };
      this.items.set(item, bankItem); this.itemsByTab[tab].push(bankItem); this.customSortOrder.push(item);
    }
    removeItemQuantity(item, quantity, removeItemCharges) {
      this.calls.push(["remove", item, quantity, removeItemCharges]);
      f.failBankBefore?.("remove", item);
      const bankItem = this.items.get(item), oldQuantity = this.getQty(item);
      if (!bankItem || quantity > oldQuantity) throw new Error("Not enough Bank stock.");
      bankItem.quantity -= quantity;
      if (bankItem.quantity === 0) {
        this.items.delete(item); this.itemsByTab[bankItem.tab].splice(bankItem.tabPosition, 1);
        this.itemsByTab[bankItem.tab].forEach((entry, index) => { entry.tabPosition = index; });
        if (removeItemCharges) this.game.itemCharges.delete(item);
      }
      f.failBankAfter?.("remove", item);
      const event = { item, oldQuantity, newQuantity: this.getQty(item) };
      this._events.emit("itemChanged", event); item.emit("bankQuantityChanged", event);
    }
    addItem(item, quantity, logLost, found, ignoreSpace, notify, source) {
      this.calls.push(["add", item, quantity, logLost, found, ignoreSpace, notify, source]);
      f.failBankBefore?.("add", item);
      const oldQuantity = this.getQty(item);
      if (!this.items.has(item)) {
        if (!ignoreSpace && this.occupiedSlots >= this.maximumSlots) return false;
        this.seed(item, quantity, this.getItemDefaultTab(item));
      } else this.items.get(item).quantity += quantity;
      f.failBankAfter?.("add", item);
      this.game.telemetry.createItemGainedEvent(item, quantity, source);
      const event = { item, oldQuantity, newQuantity: this.getQty(item) };
      this._events.emit("itemChanged", event); item.emit("bankQuantityChanged", event); return true;
    }
  }
  class Player {
    constructor(game) {
      Object.assign(this, { game, selectedEquipmentSet: 0, equipToSet: 0, equipmentSets: [0, 1, 2].map(() => ({ equipment: new Equipment(game) })), renderQueue: {}, _events: new Events() });
      this.manager = { bank: game.bank, getEquipmentRestrictions: () => f.restrictions ?? {} };
    }
    get equipment() { return this.equipmentSets[this.selectedEquipmentSet].equipment; }
    get equipToSetEquipment() { return this.equipmentSets[this.equipToSet].equipment; }
    isEquipmentSlotUnlocked(slot) { return !f.lockedSlots?.has(slot); }
    checkIfCantEquip() { return f.cantEquip ?? false; }
    getEquipmentDamageType(equipment) { return equipment.equippedItems[weapon.id].item.damageType ?? "normal"; }
    checkDamageTypeEquipRestrictions() { return !f.blockDamage; }
    checkSlayerItemEquipRestrictionsOnEquipSetChange() { return !f.blockSlayer; }
    updateForEquipmentChange() { f.calls.update++; this._events.emit("equipmentChanged", {}); f.failUpdate?.(); }
    updateForEquipSetChange() { f.calls.setUpdate++; }
    equipCallback(item, slot, quantity) { return this.equipItem(item, this.equipToSet, slot, quantity); }
    changeEquipmentSet(index) { f.calls.switch++; if (this.checkIfCantEquip()) return; this.selectedEquipmentSet = index; this.updateForEquipmentChange(); }
    equipItem(item, index, slot = item.validSlots[0], quantity = 1) {
      if (this.checkIfCantEquip()) return false;
      const equipment = this.equipmentSets[index].equipment, bank = this.game.bank;
      quantity = Math.min(bank.getQty(item), slot.allowQuantity ? quantity : 1);
      if (quantity === 0) throw new Error("Tried to equip item when none is owned.");
      const existing = equipment.getSlotOfItem(item);
      if (existing) {
        if (existing !== slot || !slot.allowQuantity) return false;
        equipment.addQuantityToSlot(slot, quantity); bank.removeItemQuantity(item, quantity, false);
        this._events.emit("itemEquipped", new ItemEquippedEvent(item, quantity)); return true;
      }
      if (!this.game.checkRequirements(item.equipRequirements, true)) return false;
      const removed = equipment.getItemsAddedOnEquip(item, slot);
      if (item.cantEquipWith.some(conflict => equipment.checkForItem(conflict) && !removed.some(entry => entry.item === conflict))) return false;
      const added = removed.filter(entry => bank.getQty(entry.item) === 0).length, freed = Number(bank.getQty(item) === quantity);
      if (added - freed > 0 && bank.occupiedSlots + added - freed > bank.maximumSlots) return false;
      bank.removeItemQuantity(item, quantity, false);
      removed.forEach(entry => bank.addItem(entry.item, entry.quantity, false, false, false, true, "Game.Unequip"));
      equipment.equipItem(item, slot, quantity);
      if (index === this.selectedEquipmentSet) this.updateForEquipmentChange(); else this.updateForEquipSetChange();
      this._events.emit("itemEquipped", new ItemEquippedEvent(item, quantity)); return true;
    }
    unequipItem(index, slot) {
      if (this.checkIfCantEquip()) return false;
      const equipment = this.equipmentSets[index].equipment, entry = equipment.equippedItems[equipment.getRootSlot(slot).id];
      if (!this.game.bank.addItem(entry.item, entry.quantity, false, false, false, true, "Game.Unequip")) return false;
      equipment.unequipItem(slot); this.updateForEquipmentChange(); return true;
    }
  }
  globalThis.Game = class {
    constructor() {
      this.emptyEquipmentItem = f.items.empty;
      this.items = { getObjectByID: itemByID }; this.equipmentSlots = { getObjectByID: slotByID };
      this.bank = new Bank(this); this.itemCharges = new Map([[f.items.sword, 37], [f.items.greatsword, 88]]);
      this.telemetry = { createItemGainedEvent: (...args) => f.telemetry.push(args) };
      this.combat = { player: new Player(this), isActive: false, stop() { f.calls.stop++; this.isActive = false; }, start() { f.calls.start++; this.isActive = true; } };
    }
    checkRequirements(requirements) { return !requirements.includes("locked"); }
    tick() { f.calls.nativeTick++; f.tickAction?.(); }
    onLoad() { f.onNativeLoad?.(); }
    decode(snapshot) {
      if (!snapshot) return;
      this.bank.items.clear(); this.bank.itemsByTab = [[], []]; this.bank.customSortOrder = [];
      for (const [id, quantity] of snapshot.bank) this.bank.seed(itemByID(id), quantity);
      this.combat.player.equipmentSets = snapshot.sets.map(entries => {
        const equipment = new Equipment(this);
        entries.forEach(({ slot, item, quantity }) => equipment.equipItem(itemByID(item), slotByID(slot), quantity));
        return { equipment };
      });
      this.combat.player.selectedEquipmentSet = snapshot.selected;
    }
  };
  globalThis.EquipmentSetMenu = class {
    constructor(id) { this.container = id ? document.getElementById(id) : new Element(); this.buttons = []; }
    getTooltipContent(set) { return set.equipment; }
    render(sets, selected, owner) {
      sets.forEach((_set, index) => {
        if (!this.buttons[index]) { const button = new Element("button"); button.textContent = String(index + 1); this.buttons.push({ button }); this.container.append(button); }
      });
      this.buttons.forEach(({ button }, index) => {
        button.hidden = index >= sets.length; button.classList.toggle("btn-success", index === selected);
        button.onclick = () => owner.changeEquipmentSet(index);
      });
    }
  };
  globalThis.BankSelectedItemMenuElement = class {
    constructor() {
      this.equipQuantitySliderContainer = new Element(); this.equipSlotButtonContainer = new Element();
      this.equipQuantitySlider = { quantity: 1 }; this.replacementOwners = [];
    }
    createReplaceItemHTML(slot, item, owner) {
      this.replacementOwners.push(owner);
      return owner.equipmentSets[owner.equipToSet].equipment.getItemsAddedOnEquip(item, slot)
        .map(({ item, quantity }) => `${item.id}:${quantity}`).join("|") || (owner.isEquipmentSlotUnlocked(slot) ? "empty" : "");
    }
    createEquipItemButtons(item, owner) {
      this.equipSlotButtonContainer.textContent = "";
      for (const slot of item.validSlots) {
        if (!owner.isEquipmentSlotUnlocked(slot)) continue;
        const button = new Element(); button.innerHTML = this.createReplaceItemHTML(slot, item, owner);
        button.onclick = () => owner.equipCallback(item, slot, this.equipQuantitySlider.quantity);
        this.equipSlotButtonContainer.append(button);
      }
    }
  };
  const game = f.game = new Game(); f.bank = game.bank; f.player = game.combat.player; f.Equipment = Equipment; f.Player = Player;
  globalThis.Equipment = Equipment;
  f.ctx = {
    settings: { section() { f.calls.settings++; throw new Error("Loadouts must not register configuration."); } },
    characterStorage: {
      getItem(key) { if (f.failStorageRead) throw new Error("Storage read failed."); return f.storage.get(key); },
      setItem(key, value) { if (f.failStorageWrite) throw new Error("Storage write failed."); f.writes.push([key, value]); f.storage.set(key, value); },
      removeItem(key) { f.storage.delete(key); },
    },
    onCharacterLoaded(callback) { f.hooks.loaded = callback; },
    onInterfaceReady(callback) {
      const previous = f.hooks.interface;
      f.hooks.interface = () => { previous?.(); return callback(); };
    },
    patch(Type, name) {
      f.patches.push({ Type, name });
      const descriptor = Object.getOwnPropertyDescriptor(Type.prototype, name);
      return {
        replace(callback) { Type.prototype[name] = function (...args) { return callback.call(this, descriptor.value.bind(this), ...args); }; },
        after(callback) { Type.prototype[name] = function (...args) { const result = descriptor.value.apply(this, args); callback.call(this, result, ...args); return result; }; },
        get(callback) { Object.defineProperty(Type.prototype, name, { ...descriptor, get() { return callback.call(this, descriptor.get.bind(this)); } }); },
      };
    },
  };
  f.wear = (index, item, slot = item.validSlots[0], quantity = 1) => f.player.equipmentSets[index].equipment.equipItem(item, slot, quantity);
  f.makeSetMenu = (index, id = `combat-equipment-set-menu-${index}`) => {
    const shell = new Element(), row = new Element(), container = new Element(), heading = new Element(index === 1 ? "small" : "h5");
    shell.className = "row"; shell.append(row);
    row.id = id.replace("menu", "container"); container.id = id; heading.textContent = "Equipment Sets";
    row.append(heading, container); f.elements.set(row.id, row); f.elements.set(id, container);
    return { shell, row, container, heading, menu: new EquipmentSetMenu(id) };
  };
  f.consume = (slot, quantity = 1, preserved = false) => { if (!preserved) return f.player.equipment.removeQuantityFromSlot(slot.id, quantity); };
  f.save = () => ({ selected: f.player.selectedEquipmentSet, sets: f.player.equipmentSets.map(set => rootEntries(set.equipment).map(({ slot, item, quantity }) => ({ slot: slot.id, item: item.id, quantity }))), bank: [...f.bank.items].map(([item, entry]) => [item.id, entry.quantity]), references: f.storage.get(storageKey) });
  if (saved !== undefined) f.storage.set(storageKey, saved);
  configure(f);
  f.feature = installEquipmentLoadouts(f.ctx, game, planner, applyEquipmentTransaction, f.prepareQuickEquipCopy);
  if (load) { game.onLoad(); f.hooks.loaded(); }
  return f;
}

function rootEntries(equipment) { return equipment.equippedArray.filter(entry => entry.providesStats); }
function ownership(f) {
  const totals = new Map([...f.bank.items].map(([item, entry]) => [item.id, entry.quantity]));
  for (const set of f.player.equipmentSets) for (const { item, quantity } of rootEntries(set.equipment)) totals.set(item.id, (totals.get(item.id) ?? 0) + quantity);
  return [...totals].sort(([left], [right]) => left.localeCompare(right));
}
function state(f) { return { native: f.save(), charges: [...f.game.itemCharges], references: f.feature.getPresets(), totals: ownership(f) }; }
function references(f, index, slot, item) { assert.equal(f.feature.getPresets()[index]?.[slot.id], item.id); }

function simulatorFixture(f, loaded = Promise.resolve(true)) {
  const imports = [];
  // Combat Simulator 3.2.0 reads the requested native set inside these synchronous button handlers.
  class SimulatorEquipmentPage {
    constructor() { this._equipmentSetContainer = new Element(); this._createEquipmentSets(); }
    _createEquipmentSets() {
      this._equipmentSetContainer.replaceChildren();
      f.player.equipmentSets.forEach((_set, index) => {
        const button = new Element("button");
        button.onclick = function (event) {
          const set = f.player.equipmentSets[index], equipment = set.equipment;
          const imported = {
            equipment: new Map(equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => [slot.slot.id, slot.item.id])),
            summons: [f.slots.summon1, f.slots.summon2].map(slot => equipment.equippedItems[slot.id].item.id),
            prayers: [...(set.prayerSelection ?? [])].map(prayer => prayer.id),
            spells: Object.fromEntries(["attack", "aurora", "curse"].map(key => [key, set.spellSelection?.[key]?.id ?? ""])),
            owner: this, event,
          };
          imports.push(imported);
          f.failSimulatorImport?.();
          return imported;
        };
        this._equipmentSetContainer.append(button);
      });
    }
  }
  const page = new SimulatorEquipmentPage();
  globalThis.mod = { api: { mythCombatSimulator: { isLoaded: loaded } } };
  globalThis.customElements = { get: name => name === "mcs-equipment-page" ? SimulatorEquipmentPage : undefined };
  document.querySelectorAll = selector => selector === "mcs-equipment-page" ? [page] : [];
  return { page, imports };
}

test("Combat Simulator imports inactive shared references before reading spells and summons without moving real items", async () => {
  const f = fixture({ configure(f) {
    f.wear(0, f.items.sword);
    f.wear(1, f.items.greatsword);
    f.wear(1, f.items.arrows, f.slots.quiver, 30);
    f.wear(1, f.items.tablet, f.slots.summon1, 40);
    f.wear(1, f.items.otherTablet, f.slots.summon2, 50);
    f.player.equipmentSets[1].prayerSelection = new Set([{ id: "test:Prayer" }]);
    f.player.equipmentSets[1].spellSelection = { attack: { id: "test:Spell" }, aurora: { id: "test:Aurora" } };
  } });
  const simulator = simulatorFixture(f), original = f.player.equipmentSets.map(set => set.equipment);
  const before = state(f), calls = { ...f.calls }, writes = f.writes.length;
  await f.hooks.interface();
  const button = simulator.page._equipmentSetContainer.children[1], event = {};
  const imported = button.onclick(event);
  assert.equal(imported.equipment.get(f.slots.weapon.id), f.items.greatsword.id);
  assert.equal(imported.equipment.get(f.slots.shield.id), f.items.greatsword.id, "occupied slots follow the native equipment view");
  assert.equal(imported.equipment.get(f.slots.quiver.id), f.items.arrows.id);
  assert.deepEqual(imported.summons, [f.items.tablet.id, f.items.otherTablet.id]);
  assert.deepEqual(imported.prayers, ["test:Prayer"]);
  assert.deepEqual(imported.spells, { attack: "test:Spell", aurora: "test:Aurora", curse: "" });
  assert.equal(imported.owner, button); assert.equal(imported.event, event);
  assert.deepEqual(state(f), before); assert.deepEqual(f.calls, calls); assert.equal(f.writes.length, writes);
  f.player.equipmentSets.forEach((set, index) => assert.equal(set.equipment, original[index]));
  assert.equal(rootEntries(original[1]).length, 0, "inactive native equipment still owns no gear");
});

test("Combat Simulator retains native active imports and reads updated references after rebuilding import buttons", async () => {
  const f = copyFixture(), simulator = simulatorFixture(f);
  await f.hooks.interface();
  const before = state(f), active = f.player.equipment;
  const imported = simulator.page._equipmentSetContainer.children[1].onclick();
  assert.equal(imported.equipment.get(f.slots.weapon.id), f.items.sword.id);
  assert.equal(f.player.equipment, active); assert.deepEqual(state(f), before);
  const inactive = simulator.page._equipmentSetContainer.children[0].onclick();
  assert.equal(inactive.equipment.get(f.slots.weapon.id), f.items.axe.id);
  f.bank.seed(f.items.hat, 1);
  assert.equal(f.player.equipItem(f.items.hat, 0, f.slots.helmet), true);
  simulator.page._createEquipmentSets();
  const rebuilt = simulator.page._equipmentSetContainer.children[0], wrapped = rebuilt.onclick;
  await f.hooks.interface();
  assert.equal(rebuilt.onclick, wrapped, "repeated interface callbacks do not stack wrappers");
  const updatedBefore = state(f), updated = rebuilt.onclick();
  assert.equal(updated.equipment.get(f.slots.helmet.id), f.items.hat.id);
  assert.equal(simulator.imports.length, 3);
  assert.deepEqual(state(f), updatedBefore);
  const empty = simulator.page._equipmentSetContainer.children[2].onclick();
  assert.equal(empty.equipment.size, 0, "empty references stay empty");
});

test("Combat Simulator import failures restore the exact inactive equipment object and inventory", async () => {
  const f = copyFixture(), simulator = simulatorFixture(f);
  await f.hooks.interface();
  const physical = f.player.equipmentSets[0].equipment, before = state(f);
  f.failSimulatorImport = () => {
    assert.equal(f.player.equipmentSets[0].equipment.checkForItem(f.items.axe), true);
    throw new Error("Simulator import failed");
  };
  assert.throws(() => simulator.page._equipmentSetContainer.children[0].onclick(), /Simulator import failed/);
  assert.equal(f.player.equipmentSets[0].equipment, physical);
  assert.deepEqual(state(f), before);
});

test("Combat Simulator compatibility waits without blocking later interface-ready hooks", async () => {
  for (const success of [true, false]) {
    const f = copyFixture();
    let finish;
    const simulator = simulatorFixture(f, new Promise(resolve => { finish = resolve; }));
    const button = simulator.page._equipmentSetContainer.children[0], original = button.onclick;
    const installed = f.hooks.interface();
    const blocked = installed !== undefined;
    assert.equal(button.onclick, original, "pending simulator load leaves its handler untouched");
    finish(success); await installed;
    assert.equal(blocked, false, "the simulator can only finish loading after this interface-ready hook returns");
    assert.equal(button.onclick === original, !success);
  }
});

test("absent or incompatible Combat Simulator APIs leave equipment loadouts independent", () => {
  for (const provider of [undefined, { api: {} }, { api: { mythCombatSimulator: {} } }]) {
    const f = copyFixture(), before = state(f), patches = f.patches.length;
    if (provider === undefined) delete globalThis.mod;
    else globalThis.mod = provider;
    globalThis.customElements = { get() { assert.fail("an absent simulator must not inspect its custom elements"); } };
    f.document.querySelectorAll = () => assert.fail("an absent simulator must not inspect its UI");
    assert.equal(f.hooks.interface(), undefined);
    assert.equal(f.patches.length, patches);
    assert.equal(f.feature.ready, true);
    assert.deepEqual(state(f), before);
  }
});

function copyFixture(configure = () => {}) {
  return fixture({ configure(f) {
    f.player.selectedEquipmentSet = 1; f.wear(1, f.items.sword); f.wear(0, f.items.axe); configure(f);
  } });
}

function seedCopyShortcuts(f) {
  const source = f.player.equipmentSets[0].equipment, target = f.player.equipmentSets[1].equipment;
  const choices = { weapon: [f.items.axe, f.items.empty, f.items.sword], shield: [f.items.shield, f.items.empty, f.items.empty],
    helmet: [f.items.hat, f.items.empty, f.items.empty], quiver: [f.items.arrows, f.items.bolts, f.items.empty],
    summon1: [f.items.tablet, f.items.otherTablet, f.items.empty], summon2: [f.items.otherTablet, f.items.empty, f.items.tablet] };
  for (const [name, slot] of Object.entries(f.slots)) {
    source.equippedItems[slot.id].quickEquipItems = choices[name].slice();
    target.equippedItems[slot.id].quickEquipItems = choices[name].slice().reverse();
  }
}

function fakeExtraCopyBridge(f) {
  const key = "quick-equip-extra-slots";
  f.extraShortcuts = [{ [f.slots.weapon.id]: [f.items.axe.id, null, f.items.sword.id], [f.slots.helmet.id]: [f.items.hat.id, null, null] },
    { [f.slots.weapon.id]: [f.items.sword.id, null, null] }, {}];
  f.storage.set(key, JSON.stringify(f.extraShortcuts)); f.shortcutCalls = [];
  f.prepareQuickEquipCopy = (source, target) => {
    f.shortcutCalls.push(["prepare", source, target]);
    if (f.failShortcutPrepare) throw new Error("Extra shortcut preparation failed.");
    const before = structuredClone(f.extraShortcuts), copied = structuredClone(f.extraShortcuts[source]), stored = f.storage.get(key);
    return {
      apply() {
        f.shortcutCalls.push(["apply"]); f.extraShortcuts[target] = structuredClone(copied);
        f.ctx.characterStorage.setItem(key, JSON.stringify(f.extraShortcuts));
        if (f.failShortcutApply) throw new Error("Extra shortcut apply failed after writing.");
      },
      rollback() { f.shortcutCalls.push(["rollback"]); f.extraShortcuts = structuredClone(before); f.storage.set(key, stored); },
    };
  };
}

function shortcutState(f) {
  return { native: f.player.equipmentSets.map(set => set.equipment.equippedArray.map(entry => entry.quickEquipItems.map(item => item.id))),
    extra: structuredClone(f.extraShortcuts), stored: f.storage.get("quick-equip-extra-slots") };
}

test("migration adds every inactive copy and stack to Bank while retaining active quantities and charges", () => {
  let before;
  const f = fixture({ configure(f) {
    f.wear(0, f.items.sword); f.wear(0, f.items.arrows, f.slots.quiver, 17);
    for (const index of [1, 2]) { f.wear(index, f.items.sword); f.wear(index, f.items.arrows, f.slots.quiver, 23); }
    f.bank.seed(f.items.sword, 2); f.bank.seed(f.items.arrows, 30); before = ownership(f);
  } });
  assert.equal(f.feature.ready, true); assert.deepEqual(ownership(f), before);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 17);
  assert.equal(f.bank.getQty(f.items.arrows), 76); assert.equal(f.bank.getQty(f.items.sword), 4);
  assert.deepEqual(f.player.equipmentSets.slice(1).map(set => rootEntries(set.equipment).length), [0, 0]);
  for (const index of [0, 1, 2]) references(f, index, f.slots.weapon, f.items.sword);
  assert.equal(f.game.itemCharges.get(f.items.sword), 37);
  assert.deepEqual([...f.player.equipment.itemChargeUsers], [f.player.equipment.equippedItems[f.slots.weapon.id]]);
  assert.equal(f.player.equipmentSets[1].equipment.itemChargeUsers.size, 0);
  assert.ok(f.bank.calls.filter(call => call[0] === "add").every(call => call[4] === false));
});

test("migration physical roots replace stale saved references in their occupied slots", () => {
  const f = fixture({ saved: { version: 1, presets: [{}, { "test:Shield": "test:Shield" }] }, configure(f) {
    f.wear(0, f.items.sword); f.wear(1, f.items.greatsword); f.bank.seed(f.items.shield, 1);
  } });
  assert.equal(f.feature.ready, true);
  assert.equal(f.feature.getPresets()[1][f.slots.shield.id], undefined);
  references(f, 1, f.slots.weapon, f.items.greatsword);
  const before = ownership(f); f.player.changeEquipmentSet(1);
  assert.equal(f.player.selectedEquipmentSet, 1); assert.deepEqual(ownership(f), before);
  assert.equal(f.player.equipment.equippedItems[f.slots.shield.id].occupiedBy, f.slots.weapon);
});

test("inactive references own no physical items and survive native plus character-storage save round trips", () => {
  const first = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.sword); f.wear(1, f.items.tablet, f.slots.summon1, 30); } });
  const saved = first.save(), before = ownership(first);
  assert.deepEqual(saved.sets[1], []); assert.equal(typeof saved.references, "string");
  const next = fixture({ saved: saved.references, load: false }); next.game.decode(saved); next.game.onLoad(); next.hooks.loaded();
  assert.equal(next.feature.ready, true); assert.deepEqual(ownership(next), before);
  references(next, 1, next.slots.summon1, next.items.tablet);
  assert.equal(rootEntries(next.player.equipmentSets[1].equipment).length, 0);
  const bankBefore = next.bank.getQty(next.items.tablet); next.game.decode(next.save()); next.game.onLoad();
  assert.equal(next.bank.getQty(next.items.tablet), bankBefore);
  assert.equal(rootEntries(next.player.equipmentSets[1].equipment).length, 0);
  next.player.equipToSet = 1;
  const projection = next.player.equipToSetEquipment;
  assert.equal(projection.getQuantityOfItem(next.items.tablet), 1);
  assert.equal(rootEntries(next.player.equipmentSets[1].equipment).length, 0);
  assert.deepEqual(ownership(next), before);
  assert.equal(new EquipmentSetMenu().getTooltipContent(next.player.equipmentSets[1]), projection);
});

test("switching carries common stack quantities and permits depleted consumable references", () => {
  const f = fixture({ configure(f) {
    f.wear(0, f.items.sword); f.wear(0, f.items.tablet, f.slots.summon1, 47);
    f.wear(1, f.items.axe); f.wear(1, f.items.tablet, f.slots.summon2, 13); f.wear(1, f.items.arrows, f.slots.quiver, 10);
    f.bank.seed(f.items.tablet, 200);
  } });
  f.bank.removeItemQuantity(f.items.arrows, 10, false);
  const before = ownership(f); f.player.changeEquipmentSet(1);
  assert.equal(f.player.selectedEquipmentSet, 1);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 47);
  assert.equal(f.bank.getQty(f.items.tablet), 213);
  assert.equal(f.player.equipment.equippedItems[f.slots.summon2.id].item, f.items.tablet);
  assert.equal(f.player.equipment.equippedItems[f.slots.quiver.id].isEmpty, true);
  assert.equal(rootEntries(f.player.equipmentSets[0].equipment).length, 0);
  references(f, 1, f.slots.quiver, f.items.arrows); assert.deepEqual(ownership(f), before);
});

test("a newly equipped quantity stack takes available Bank stock and callbacks see the final loadout", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.greatsword); f.wear(1, f.items.arrows, f.slots.quiver, 19); f.bank.seed(f.items.arrows, 9); } });
  const before = ownership(f); let bankEvents = 0;
  f.bank._events.on("itemChanged", event => {
    bankEvents++; assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.player.equipment.checkForItem(f.items.greatsword), true);
    assert.deepEqual(ownership(f), before); assert.equal(event.newQuantity, f.bank.getQty(event.item));
  });
  f.player.changeEquipmentSet(1);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 28); assert.equal(f.bank.getQty(f.items.arrows), 0);
  assert.equal(f.player.equipment.equippedItems[f.slots.shield.id].occupiedBy, f.slots.weapon);
  assert.equal(f.game.itemCharges.get(f.items.sword), 37); assert.equal(f.game.itemCharges.get(f.items.greatsword), 88);
  assert.ok(bankEvents > 0); assert.deepEqual([...f.player.equipment.itemChargeUsers], [f.player.equipment.equippedItems[f.slots.weapon.id]]);
});

for (const blocked of ["missing essential", "damage restriction", "slayer restriction", "required area item", "locked slot", "item requirement", "full Bank", "combat equip restriction"]) {
  test(`${blocked} rejects a loadout apply without changing ownership, selection or references`, () => {
    const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); } });
    if (blocked === "missing essential") f.bank.removeItemQuantity(f.items.axe, 1, false);
    if (blocked === "damage restriction") f.blockDamage = true;
    if (blocked === "slayer restriction") f.blockSlayer = true;
    if (blocked === "required area item") f.restrictions = { areaItems: [f.items.hat] };
    if (blocked === "locked slot") f.lockedSlots = new Set([f.slots.weapon]);
    if (blocked === "item requirement") f.items.axe.equipRequirements = ["locked"];
    if (blocked === "full Bank") { f.bank.items.get(f.items.axe).quantity = 2; f.bank.maximumSlots = f.bank.occupiedSlots; }
    if (blocked === "combat equip restriction") f.cantEquip = true;
    const before = state(f); f.player.changeEquipmentSet(1);
    assert.deepEqual(state(f), before); assert.equal(f.player.selectedEquipmentSet, 0);
  });
}

test("manual active native equip, top-up and occupied-slot unequip keep references in step", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.bank.seed(f.items.greatsword, 1); f.bank.seed(f.items.arrows, 40); } });
  const before = ownership(f);
  assert.equal(f.player.equipItem(f.items.greatsword, 0, f.slots.weapon), true);
  references(f, 0, f.slots.weapon, f.items.greatsword);
  assert.equal(f.player.equipItem(f.items.arrows, 0, f.slots.quiver, 5), true);
  assert.equal(f.player.equipItem(f.items.arrows, 0, f.slots.quiver, 7), true);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 12); references(f, 0, f.slots.quiver, f.items.arrows);
  assert.equal(f.player.unequipItem(0, f.slots.shield), true);
  assert.equal(f.feature.getPresets()[0][f.slots.weapon.id], undefined);
  assert.deepEqual(ownership(f), before); assert.equal(f.game.itemCharges.get(f.items.greatsword), 88);
});

test("manual inactive equip and unequip change references without withdrawing, duplicating or moving gear", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.bank.seed(f.items.arrows, 100); f.bank.seed(f.items.greatsword, 1); } });
  const before = f.save(), totals = ownership(f);
  assert.equal(f.player.equipItem(f.items.sword, 1, f.slots.weapon, 1), true);
  assert.equal(f.player.equipItem(f.items.arrows, 1, f.slots.quiver, 50), true);
  references(f, 1, f.slots.weapon, f.items.sword); references(f, 1, f.slots.quiver, f.items.arrows);
  assert.deepEqual(f.save().bank, before.bank); assert.deepEqual(f.save().sets, before.sets);
  assert.equal(f.player.equipItem(f.items.greatsword, 1, f.slots.weapon), true);
  references(f, 1, f.slots.weapon, f.items.greatsword);
  assert.equal(f.player.unequipItem(1, f.slots.weapon), true); assert.equal(f.feature.getPresets()[1][f.slots.weapon.id], undefined);
  assert.deepEqual(ownership(f), totals); assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
  assert.equal(f.player.equipItem(f.items.hat, 1, f.slots.helmet), false);
});

test("inactive changes remove occupied-slot conflicts from the reference layout", () => {
  const f = fixture({ configure(f) { f.bank.seed(f.items.shield, 1); f.bank.seed(f.items.greatsword, 1); } });
  f.player.equipItem(f.items.shield, 1, f.slots.shield); f.player.equipItem(f.items.greatsword, 1, f.slots.weapon);
  assert.equal(f.feature.getPresets()[1][f.slots.shield.id], undefined); references(f, 1, f.slots.weapon, f.items.greatsword);
  f.player.equipItem(f.items.shield, 1, f.slots.shield);
  assert.equal(f.feature.getPresets()[1][f.slots.weapon.id], undefined); references(f, 1, f.slots.shield, f.items.shield);
});

test("manual inactive unequip through an occupied slot removes its referenced root item", () => {
  const f = fixture({ configure(f) { f.bank.seed(f.items.greatsword, 1); } });
  f.player.equipItem(f.items.greatsword, 1, f.slots.weapon);
  const before = ownership(f);
  assert.equal(f.player.unequipItem(1, f.slots.shield), true);
  assert.equal(f.feature.getPresets()[1][f.slots.weapon.id], undefined);
  assert.deepEqual(ownership(f), before);
});

for (const failure of ["read", "write", "malformed saved data", "migration full Bank", "migration native failure"]) {
  test(`${failure} during initialization retains all physical holdings and safely disables loadouts`, () => {
    const f = fixture({ load: false, configure(f) {
      f.wear(0, f.items.sword); f.wear(1, f.items.axe); f.bank.seed(f.items.arrows, 10);
      if (failure === "read") f.failStorageRead = true;
      if (failure === "write") f.failStorageWrite = true;
      if (failure === "malformed saved data") f.storage.set(storageKey, "invalid gzip");
      if (failure === "migration full Bank") f.bank.maximumSlots = 1;
      if (failure === "migration native failure") f.failBankBefore = step => { if (step === "add") throw new Error("Bank add failed."); };
    } });
    const before = { totals: ownership(f), equipment: f.save().sets, bank: f.save().bank }, stored = f.storage.get(storageKey);
    assert.doesNotThrow(() => f.hooks.loaded());
    assert.equal(f.feature.ready, false); assert.ok(f.feature.error);
    assert.deepEqual({ totals: ownership(f), equipment: f.save().sets, bank: f.save().bank }, before);
    assert.equal(f.storage.get(storageKey), stored);
    f.player.changeEquipmentSet(1); assert.equal(f.player.selectedEquipmentSet, 0);
  });
}

test("inactive storage failure preserves references and native ownership", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.bank.seed(f.items.axe, 1); } });
  const before = state(f); f.failStorageWrite = true;
  assert.equal(f.player.equipItem(f.items.axe, 1, f.slots.weapon), false); assert.deepEqual(state(f), before);
});

test("active storage failure retains the completed native action and disables further switching", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.bank.seed(f.items.axe, 1); } });
  const totals = ownership(f); f.failStorageWrite = true;
  assert.equal(f.player.equipItem(f.items.axe, 0, f.slots.weapon), true);
  assert.equal(f.player.equipment.checkForItem(f.items.axe), true); assert.deepEqual(ownership(f), totals);
  assert.equal(f.feature.ready, false); f.player.changeEquipmentSet(1); assert.equal(f.player.selectedEquipmentSet, 0);
});

test("loadouts register no configuration and leave native quantity consumption and Game ticks unpatched", () => {
  const f = fixture();
  assert.equal(f.calls.settings, 0);
  assert.equal(f.patches.some(({ Type, name }) => Type === f.Equipment && ["removeQuantityFromSlot", "addQuantityToSlot"].includes(name)), false);
  assert.equal(f.patches.some(({ Type, name }) => Type === Game && name === "tick"), false);
});

test("native preservation and depletion retain references without withdrawing Bank stock or controlling combat", () => {
  const f = fixture({ configure(f) {
    f.wear(0, f.items.tablet, f.slots.summon1, 2); f.wear(0, f.items.arrows, f.slots.quiver, 101);
    f.bank.seed(f.items.tablet, 20); f.bank.seed(f.items.arrows, 50);
  } });
  const before = new Map(ownership(f)), storage = f.storage.get(storageKey), bankCalls = f.bank.calls.length;
  f.game.combat.isActive = true;
  f.consume(f.slots.summon1, 1, true); assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 2);
  f.consume(f.slots.quiver); assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 100);
  f.consume(f.slots.summon1, 2); assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 0);
  references(f, 0, f.slots.summon1, f.items.tablet);
  assert.equal(f.bank.getQty(f.items.tablet), 20); assert.equal(f.bank.getQty(f.items.arrows), 50);
  assert.equal(f.bank.calls.length, bankCalls); assert.equal(f.storage.get(storageKey), storage);
  const after = new Map(ownership(f));
  assert.equal(after.get(f.items.tablet.id), before.get(f.items.tablet.id) - 2);
  assert.equal(after.get(f.items.arrows.id), before.get(f.items.arrows.id) - 1);
  f.game.tick(); assert.equal(f.calls.stop, 0); assert.equal(f.calls.start, 0);
  assert.equal(f.feature.ready, true);
});

test("a remaining native stack carries to another referenced set without adding matching Bank stock", () => {
  const f = fixture({ configure(f) {
    f.wear(0, f.items.tablet, f.slots.summon1, 13); f.wear(1, f.items.tablet, f.slots.summon2, 7);
    f.bank.seed(f.items.tablet, 80);
  } });
  f.consume(f.slots.summon1, 3);
  const before = ownership(f), bankQuantity = f.bank.getQty(f.items.tablet);
  assert.equal(bankQuantity, 87); f.player.changeEquipmentSet(1);
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 10);
  assert.equal(f.player.equipment.equippedItems[f.slots.summon2.id].item, f.items.tablet);
  assert.equal(f.bank.getQty(f.items.tablet), bankQuantity); assert.deepEqual(ownership(f), before);
});

test("native apply failure rolls back all ownership and leaves the selected loadout and references unchanged", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.greatsword); } });
  const before = state(f);
  f.failEquipment = (equipment, item) => {
    if (equipment === f.player.equipmentSets[1].equipment && item === f.items.greatsword) throw new Error("Native equip failed.");
  };
  f.player.changeEquipmentSet(1); assert.deepEqual(state(f), before); assert.equal(f.feature.ready, true);
});

test("post-commit native update failure retains conserved ownership without taking over combat", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.greatsword); } });
  const before = ownership(f); f.game.combat.isActive = true; f.failUpdate = () => { throw new Error("Native stats update failed."); };
  f.player.changeEquipmentSet(1);
  assert.deepEqual(ownership(f), before); assert.equal(f.player.selectedEquipmentSet, 1);
  assert.equal(f.feature.ready, false); f.game.tick(); assert.equal(f.calls.stop, 0); assert.equal(f.game.combat.isActive, true);
});

test("reload migration waits for native onLoad capacity and never reapplies active preset quantities", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.arrows, f.slots.quiver, 60); f.wear(1, f.items.axe); } });
  const save = f.save();
  save.sets[0][0].quantity = 7;
  save.sets[1] = [{ slot: f.slots.weapon.id, item: f.items.sword.id, quantity: 1 }];
  f.bank.maximumSlots = 0;
  f.game.decode(save);
  assert.equal(f.feature.ready, false);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 7);
  assert.equal(f.player.equipmentSets[1].equipment.checkForItem(f.items.sword), true);
  f.onNativeLoad = () => { f.bank.maximumSlots = 100; };
  const before = ownership(f); f.game.onLoad();
  assert.equal(f.feature.ready, true); assert.deepEqual(ownership(f), before);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 7);
  assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
  references(f, 1, f.slots.weapon, f.items.sword);
});

test("first load waits for characterLoaded after native onLoad before migrating physical inactive gear", () => {
  const f = fixture({ load: false, configure(f) { f.wear(1, f.items.axe); f.bank.maximumSlots = 0; } });
  f.onNativeLoad = () => { f.bank.maximumSlots = 100; };
  f.game.decode(); f.game.onLoad();
  assert.equal(f.feature.ready, false); assert.equal(f.bank.getQty(f.items.axe), 0);
  assert.equal(f.player.equipmentSets[1].equipment.checkForItem(f.items.axe), true);
  f.hooks.loaded();
  assert.equal(f.feature.ready, true); assert.equal(f.bank.getQty(f.items.axe), 1);
  assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
});

test("installation before native equipment sets are decoded never reads the active equipment getter", () => {
  let f, activeReads = 0;
  assert.doesNotThrow(() => {
    f = fixture({ load: false, configure(f) {
      f.player.equipmentSets = [];
      Object.defineProperty(f.player, "equipment", { configurable: true, get() { activeReads++; throw new Error("Active equipment is not decoded."); } });
    } });
  });
  assert.equal(f.feature.ready, false); assert.equal(activeReads, 0);
  f.game.decode({ selected: 0, bank: [[f.items.arrows.id, 7]], sets: [
    [{ slot: f.slots.weapon.id, item: f.items.sword.id, quantity: 1 }, { slot: f.slots.quiver.id, item: f.items.arrows.id, quantity: 13 }],
    [{ slot: f.slots.weapon.id, item: f.items.axe.id, quantity: 1 }], [],
  ] });
  f.game.onLoad(); assert.equal(activeReads, 0); assert.equal(f.feature.ready, false);
  const before = ownership(f); delete f.player.equipment;
  f.hooks.loaded();
  assert.equal(f.feature.ready, true); assert.deepEqual(ownership(f), before);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 13);
  assert.equal(f.bank.getQty(f.items.arrows), 7); assert.equal(f.bank.getQty(f.items.axe), 1);
  assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
  references(f, 1, f.slots.weapon, f.items.axe);
});

test("a secondary Game decode cannot disable main loadouts or fall through to native empty-set switching", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); } });
  const secondary = new Game(), before = state(f), writes = f.writes.length;
  secondary.decode(f.save());
  assert.equal(f.feature.ready, true); assert.deepEqual(state(f), before); assert.equal(f.writes.length, writes);
  f.player.changeEquipmentSet(1);
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.player.equipment.checkForItem(f.items.axe), true);
  assert.equal(rootEntries(f.player.equipmentSets[0].equipment).length, 0);
  assert.equal(f.calls.switch, 0); assert.deepEqual(ownership(f), before.totals);
});

test("a secondary Game onLoad cannot initialize a pending main restore before main onLoad", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); } });
  const secondary = new Game(), snapshot = f.save();
  snapshot.sets[2] = [{ slot: f.slots.helmet.id, item: f.items.hat.id, quantity: 1 }];
  f.game.decode(snapshot);
  const before = state(f), writes = f.writes.length;
  secondary.onLoad();
  assert.equal(f.feature.ready, false); assert.deepEqual(state(f), before); assert.equal(f.writes.length, writes);
  assert.equal(f.player.equipmentSets[2].equipment.checkForItem(f.items.hat), true);
  f.game.onLoad();
  assert.equal(f.feature.ready, true); assert.equal(rootEntries(f.player.equipmentSets[2].equipment).length, 0);
  assert.equal(f.bank.getQty(f.items.hat), 1); assert.deepEqual(ownership(f), before.totals);
});

test("secondary Game lifecycle cannot clear a main initialization failure or enable native fallback switching", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); f.failStorageRead = true; } });
  const error = f.feature.error, before = state(f), secondary = new Game();
  assert.ok(error);
  secondary.decode(); secondary.onLoad();
  assert.equal(f.feature.ready, false); assert.equal(f.feature.error, error);
  f.player.changeEquipmentSet(1);
  assert.equal(f.player.selectedEquipmentSet, 0); assert.equal(f.calls.switch, 0); assert.deepEqual(state(f), before);
});

test("reapplying the selected set restores a depleted reference while retaining common stack quantities", () => {
  const f = fixture({ configure(f) {
    f.wear(0, f.items.tablet, f.slots.summon1, 2); f.wear(0, f.items.arrows, f.slots.quiver, 7);
    f.bank.seed(f.items.tablet, 15); f.bank.seed(f.items.arrows, 40);
  } });
  f.consume(f.slots.summon1, 2); assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 0);
  references(f, 0, f.slots.summon1, f.items.tablet);
  const before = ownership(f); f.player.changeEquipmentSet(0);
  assert.equal(f.player.selectedEquipmentSet, 0); assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 15);
  assert.equal(f.bank.getQty(f.items.tablet), 0); assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 7);
  assert.equal(f.bank.getQty(f.items.arrows), 40); assert.deepEqual(ownership(f), before);
});

test("migration Bank observers cannot equip physical inactive items or switch while ownership is committed", () => {
  const attempts = [];
  const f = fixture({ configure(f) {
    f.wear(0, f.items.sword); f.wear(1, f.items.axe); f.bank.seed(f.items.arrows, 40);
    f.bank._events.on("itemChanged", () => {
      attempts.push(f.player.equipItem(f.items.arrows, 1, f.slots.quiver, 5));
      attempts.push(f.player.unequipItem(1, f.slots.weapon)); f.player.changeEquipmentSet(1);
    });
  } });
  assert.deepEqual(attempts, [false, false]); assert.equal(f.feature.ready, true);
  assert.equal(f.player.selectedEquipmentSet, 0); assert.equal(f.calls.switch, 0);
  assert.equal(f.bank.getQty(f.items.arrows), 40); assert.equal(f.bank.getQty(f.items.axe), 1);
  assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
  references(f, 1, f.slots.weapon, f.items.axe);
  assert.equal(f.feature.getPresets()[1][f.slots.quiver.id], undefined);
});

for (const eventSource of ["Bank", "equipment", "itemEquipped"]) {
  test(`${eventSource} callbacks cannot switch recursively or populate inactive physical equipment during a switch`, () => {
    const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); f.bank.seed(f.items.arrows, 40); } });
    const before = ownership(f), presets = f.feature.getPresets(), attempts = [];
    const reenter = () => {
      attempts.push(f.player.equipItem(f.items.arrows, 0, f.slots.quiver, 5));
      attempts.push(f.player.unequipItem(0, f.slots.weapon)); f.player.changeEquipmentSet(2);
    };
    if (eventSource === "Bank") f.bank._events.on("itemChanged", reenter);
    else f.player._events.on(eventSource === "equipment" ? "equipmentChanged" : "itemEquipped", reenter);
    f.player.changeEquipmentSet(1);
    assert.ok(attempts.length > 0); assert.ok(attempts.every(result => result === false));
    assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.calls.switch, 0);
    assert.equal(rootEntries(f.player.equipmentSets[0].equipment).length, 0);
    assert.equal(rootEntries(f.player.equipmentSets[2].equipment).length, 0);
    assert.deepEqual(ownership(f), before); assert.deepEqual(f.feature.getPresets(), presets);
  });
}

test("native active equipment edits during equipment callbacks conserve stock and update active references", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); f.bank.seed(f.items.hat, 1); } });
  const before = ownership(f); let handled = false;
  f.player._events.on("equipmentChanged", () => {
    if (handled) return; handled = true;
    assert.equal(f.player.equipItem(f.items.hat, f.player.selectedEquipmentSet, f.slots.helmet), true);
  });
  f.player.changeEquipmentSet(1);
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.player.equipment.checkForItem(f.items.hat), true);
  references(f, 1, f.slots.helmet, f.items.hat); assert.deepEqual(ownership(f), before);
  assert.equal(rootEntries(f.player.equipmentSets[0].equipment).length, 0);
});

test("Bank replacement previews use reference projections for inactive sets and native holdings for active or other players", () => {
  const f = fixture({ configure(f) {
    f.wear(0, f.items.arrows, f.slots.quiver, 7); f.wear(1, f.items.arrows, f.slots.quiver, 12); f.bank.seed(f.items.bolts, 3);
  } });
  const menu = new BankSelectedItemMenuElement(), before = ownership(f);
  f.player.equipToSet = 1;
  assert.equal(menu.createReplaceItemHTML(f.slots.quiver, f.items.bolts, f.player), "test:Arrows:1");
  assert.notEqual(menu.replacementOwners.at(-1), f.player);
  assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
  f.player.equipToSet = 0;
  assert.equal(menu.createReplaceItemHTML(f.slots.quiver, f.items.bolts, f.player), "test:Arrows:7");
  assert.equal(menu.replacementOwners.at(-1), f.player);
  const other = new f.Player(f.game); other.equipment.equipItem(f.items.arrows, f.slots.quiver, 4);
  assert.equal(menu.createReplaceItemHTML(f.slots.quiver, f.items.bolts, other), "test:Arrows:4");
  assert.equal(menu.replacementOwners.at(-1), other); assert.deepEqual(ownership(f), before);
});

test("Bank equipment controls hide inactive quantity selection, show its reference note and reuse it on redraw", () => {
  const f = fixture({ configure(f) { f.wear(0, f.items.arrows, f.slots.quiver, 7); f.bank.seed(f.items.bolts, 20); f.bank.seed(f.items.sword, 1); } });
  const menu = new BankSelectedItemMenuElement(); f.player.equipToSet = 1;
  const before = ownership(f); menu.equipQuantitySlider.quantity = 15;
  menu.createEquipItemButtons(f.items.bolts, f.player);
  assert.equal(menu.equipQuantitySliderContainer.classList.contains("d-none"), true);
  const note = menu.equipSlotButtonContainer.children.at(-1);
  assert.equal(note.hidden, false); assert.match(note.textContent, /without reserving Bank stock/);
  assert.equal(note.classList.contains("d-block"), true);
  menu.equipSlotButtonContainer.children[0].onclick(); references(f, 1, f.slots.quiver, f.items.bolts);
  assert.equal(f.bank.getQty(f.items.bolts), 20); assert.equal(rootEntries(f.player.equipmentSets[1].equipment).length, 0);
  menu.createEquipItemButtons(f.items.bolts, f.player);
  assert.equal(menu.equipSlotButtonContainer.children.at(-1), note); assert.equal(menu.equipSlotButtonContainer.children.length, 2);
  f.player.equipToSet = 0; menu.createEquipItemButtons(f.items.bolts, f.player);
  assert.equal(menu.equipQuantitySliderContainer.classList.contains("d-none"), false); assert.equal(note.hidden, true);
  assert.equal(note.classList.contains("d-block"), false);
  menu.createEquipItemButtons(f.items.sword, f.player);
  assert.equal(menu.equipQuantitySliderContainer.classList.contains("d-none"), true); assert.equal(note.hidden, true);
  assert.deepEqual(ownership(f), before);
});

test("Copy From replaces current references and gear while preserving the source, selection and physical ownership", () => {
  const f = copyFixture(f => {
    f.wear(1, f.items.arrows, f.slots.quiver, 9);
    f.wear(0, f.items.arrows, f.slots.quiver, 3); f.wear(0, f.items.tablet, f.slots.summon1, 20);
    f.bank.seed(f.items.arrows, 30); f.bank.seed(f.items.tablet, 5);
  });
  const source = f.feature.getPresets()[0], before = ownership(f), order = [], write = f.ctx.characterStorage.setItem;
  f.ctx.characterStorage.setItem = function (...args) {
    assert.equal(f.player.equipment.checkForItem(f.items.sword), true);
    assert.deepEqual(ownership(f), before);
    write.apply(this, args); order.push("storage");
  };
  f.failBankBefore = () => { assert.equal(order[0], "storage"); order.push("native mutation"); };
  f.bank._events.on("itemChanged", () => {
    assert.equal(f.player.selectedEquipmentSet, 1);
    assert.deepEqual(f.feature.getPresets()[1], source); assert.deepEqual(f.feature.getPresets()[0], source);
    assert.equal(f.player.equipment.checkForItem(f.items.axe), true); assert.deepEqual(ownership(f), before);
    order.push("Bank event");
  });
  assert.equal(f.feature.copyFrom(0), true);
  assert.equal(order[0], "storage"); assert.ok(order.includes("Bank event"));
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.calls.switch, 0);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.arrows), 9); assert.equal(f.bank.getQty(f.items.arrows), 33);
  assert.equal(f.player.equipment.getQuantityOfItem(f.items.tablet), 25); assert.equal(f.bank.getQty(f.items.tablet), 0);
  assert.equal(f.bank.getQty(f.items.sword), 1); assert.equal(f.bank.getQty(f.items.axe), 0);
  assert.deepEqual(f.feature.getPresets()[0], source); assert.deepEqual(f.feature.getPresets()[1], source);
  assert.equal(rootEntries(f.player.equipmentSets[0].equipment).length, 0); assert.equal(rootEntries(f.player.equipmentSets[2].equipment).length, 0);
  assert.deepEqual(ownership(f), before); assert.equal(f.game.itemCharges.get(f.items.sword), 37);
  f.ctx.characterStorage.setItem = write;
  f.player.unequipItem(0, f.slots.summon1);
  assert.equal(f.feature.getPresets()[0][f.slots.summon1.id], undefined); references(f, 1, f.slots.summon1, f.items.tablet);
});

test("Copy From rejects invalid and current source indices without writing storage or changing gear", () => {
  const f = copyFixture(), before = state(f), writes = f.writes.length;
  for (const source of [-1, 3, 0.5, NaN, Infinity, undefined, "0", 1]) {
    assert.equal(f.feature.copyFrom(source), false); assert.deepEqual(state(f), before);
  }
  assert.equal(f.writes.length, writes); assert.equal(f.calls.update, 0);
});

test("Copy From an empty source clears the selected layout and returns its gear without changing the source", () => {
  const f = copyFixture(), before = ownership(f), source = f.feature.getPresets()[0];
  assert.equal(f.feature.copyFrom(2), true);
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(rootEntries(f.player.equipment).length, 0);
  assert.deepEqual(f.feature.getPresets()[1], {}); assert.deepEqual(f.feature.getPresets()[2], {});
  assert.deepEqual(f.feature.getPresets()[0], source); assert.equal(f.bank.getQty(f.items.sword), 1);
  assert.deepEqual(ownership(f), before);
});

for (const failure of ["missing gear", "Bank capacity", "restriction", "combat restriction", "storage read", "storage write", "native equip", "native Bank write"]) {
  test(`Copy From ${failure} failure preserves the current preset, stored references and physical holdings`, () => {
    const f = copyFixture();
    if (failure === "missing gear") f.bank.removeItemQuantity(f.items.axe, 1, false);
    if (failure === "Bank capacity") { f.bank.items.get(f.items.axe).quantity = 2; f.bank.maximumSlots = f.bank.occupiedSlots; }
    if (failure === "restriction") f.blockDamage = true;
    if (failure === "combat restriction") f.cantEquip = true;
    if (failure === "storage read") f.failStorageRead = true;
    if (failure === "storage write") f.failStorageWrite = true;
    if (failure === "native equip") f.failEquipment = (equipment, item) => {
      if (equipment === f.player.equipment && item === f.items.axe) throw new Error("Native copy equip failed.");
    };
    if (failure === "native Bank write") f.failBankBefore = step => { if (step === "add") throw new Error("Native copy Bank write failed."); };
    const before = state(f), writes = f.writes.length;
    assert.equal(f.feature.copyFrom(0), false);
    assert.deepEqual(state(f), before); assert.equal(f.feature.ready, true); assert.equal(f.player.selectedEquipmentSet, 1);
    if (!["native equip", "native Bank write"].includes(failure)) assert.equal(f.writes.length, writes);
    assert.equal(f.calls.stop, 0);
  });
}

for (const eventSource of ["Bank", "equipment"]) {
  test(`Copy From rejects a nested copy from ${eventSource} callbacks while applying the current layout`, () => {
    const f = copyFixture(), before = ownership(f), source = f.feature.getPresets()[0], attempts = [];
    const copyAgain = () => attempts.push(f.feature.copyFrom(2));
    if (eventSource === "Bank") f.bank._events.on("itemChanged", copyAgain);
    else f.player._events.on("equipmentChanged", copyAgain);
    assert.equal(f.feature.copyFrom(0), true);
    assert.ok(attempts.length > 0); assert.ok(attempts.every(result => result === false));
    assert.deepEqual(f.feature.getPresets()[0], source); assert.deepEqual(f.feature.getPresets()[1], source);
    assert.equal(f.player.selectedEquipmentSet, 1); assert.deepEqual(ownership(f), before);
  });
}

test("Copy From is unavailable before character load and after an initialization failure", () => {
  const f = fixture({ load: false, configure(f) { f.wear(0, f.items.sword); f.wear(1, f.items.axe); } });
  const before = state(f);
  assert.equal(f.feature.copyFrom(1), false); assert.deepEqual(state(f), before);
  f.failStorageRead = true; f.hooks.loaded(); assert.ok(f.feature.error);
  assert.equal(f.feature.copyFrom(1), false); assert.deepEqual(state(f), before);
});

test("Copy From retains committed new references and ownership if native post-commit updates fail", () => {
  const f = copyFixture(), before = ownership(f), source = f.feature.getPresets()[0];
  f.game.combat.isActive = true; f.failUpdate = () => { throw new Error("Copy stats update failed."); };
  assert.equal(f.feature.copyFrom(0), false);
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.player.equipment.checkForItem(f.items.axe), true);
  assert.equal(f.bank.getQty(f.items.sword), 1); assert.equal(f.bank.getQty(f.items.axe), 0);
  assert.deepEqual(f.feature.getPresets()[0], source); assert.deepEqual(f.feature.getPresets()[1], source);
  const saved = JSON.parse(fflate.strFromU8(fflate.gunzipSync(fflate.strToU8(atob(f.storage.get(storageKey)), true))));
  assert.deepEqual(saved.presets[1], source); assert.deepEqual(ownership(f), before);
  assert.equal(f.feature.ready, false); f.game.tick(); assert.equal(f.calls.stop, 0); assert.equal(f.game.combat.isActive, true);
});

test("Copy From clones all three native shortcuts in every slot without an extra-shortcut bridge", () => {
  const f = copyFixture(seedCopyShortcuts), source = f.player.equipmentSets[0].equipment;
  const target = f.player.equipmentSets[1].equipment, before = ownership(f), native = shortcutState(f).native[0];
  assert.equal(f.prepareQuickEquipCopy, undefined); assert.equal(f.feature.copyFrom(0), true);
  assert.deepEqual(shortcutState(f).native[0], native); assert.deepEqual(shortcutState(f).native[1], native);
  for (const { slot } of source.equippedArray)
    assert.notEqual(target.equippedItems[slot.id].quickEquipItems, source.equippedItems[slot.id].quickEquipItems);
  assert.equal(target.equippedItems[f.slots.helmet.id].isEmpty, true);
  assert.equal(target.equippedItems[f.slots.helmet.id].quickEquipItems[0], f.items.hat);
  target.equippedItems[f.slots.weapon.id].quickEquipItems[0] = f.items.sword;
  assert.equal(source.equippedItems[f.slots.weapon.id].quickEquipItems[0], f.items.axe);
  assert.deepEqual(ownership(f), before);
});

test("Copy From restores native shortcuts after a precommit failure without an extra-shortcut bridge", () => {
  const f = copyFixture(seedCopyShortcuts), before = state(f), shortcuts = shortcutState(f);
  f.failEquipment = (equipment, item) => { if (equipment === f.player.equipment && item === f.items.axe) throw new Error("Native equip failed."); };
  assert.equal(f.feature.copyFrom(0), false);
  assert.deepEqual(state(f), before); assert.deepEqual(shortcutState(f), shortcuts);
});

test("Copy From prepares the numeric source and current target, then applies private and persisted extra shortcuts before inventory writes", () => {
  const f = copyFixture(f => { seedCopyShortcuts(f); fakeExtraCopyBridge(f); });
  const before = ownership(f), native = shortcutState(f).native[0], extra = structuredClone(f.extraShortcuts[0]);
  f.failBankBefore = () => {
    assert.deepEqual(f.shortcutCalls, [["prepare", 0, 1], ["apply"]]);
    assert.deepEqual(f.extraShortcuts[1], extra);
    assert.deepEqual(JSON.parse(f.storage.get("quick-equip-extra-slots"))[1], extra);
    assert.deepEqual(shortcutState(f).native[1], native);
  };
  assert.equal(f.feature.copyFrom(0), true);
  assert.deepEqual(f.shortcutCalls, [["prepare", 0, 1], ["apply"]]);
  assert.deepEqual(f.extraShortcuts[0], extra); assert.deepEqual(f.extraShortcuts[1], extra);
  assert.notEqual(f.extraShortcuts[0], f.extraShortcuts[1]);
  assert.deepEqual(shortcutState(f).native[0], native); assert.deepEqual(shortcutState(f).native[1], native);
  assert.deepEqual(ownership(f), before);
});

test("ordinary equipment set switching preserves each set's shortcuts without preparing or applying a copy", () => {
  const f = copyFixture(f => { seedCopyShortcuts(f); fakeExtraCopyBridge(f); }), before = shortcutState(f);
  f.player.changeEquipmentSet(0);
  assert.equal(f.player.selectedEquipmentSet, 0); assert.deepEqual(f.shortcutCalls, []);
  assert.deepEqual(shortcutState(f), before);
});

for (const failure of ["preflight", "prepare", "storage", "extra apply", "native equip", "native Bank write"]) {
  test(`Copy From ${failure} failure restores native and extra shortcuts together with references and physical gear`, () => {
    const f = copyFixture(f => { seedCopyShortcuts(f); fakeExtraCopyBridge(f); });
    if (failure === "preflight") f.bank.removeItemQuantity(f.items.axe, 1, false);
    if (failure === "prepare") f.failShortcutPrepare = true;
    if (failure === "storage") f.failStorageWrite = true;
    if (failure === "extra apply") f.failShortcutApply = true;
    if (failure === "native equip") f.failEquipment = (equipment, item) => {
      if (equipment === f.player.equipment && item === f.items.axe) throw new Error("Native copy equip failed.");
    };
    if (failure === "native Bank write") f.failBankBefore = step => { if (step === "add") throw new Error("Native copy Bank failed."); };
    const before = state(f), shortcuts = shortcutState(f);
    assert.equal(f.feature.copyFrom(0), false);
    assert.deepEqual(state(f), before); assert.deepEqual(shortcutState(f), shortcuts);
    assert.equal(f.feature.ready, true);
    if (failure === "preflight") assert.deepEqual(f.shortcutCalls, []);
    else assert.deepEqual(f.shortcutCalls[0], ["prepare", 0, 1]);
    if (["extra apply", "native equip", "native Bank write"].includes(failure)) {
      assert.ok(f.shortcutCalls.some(([step]) => step === "apply"));
      assert.deepEqual(f.shortcutCalls.at(-1), ["rollback"]);
    }
  });
}

test("Copy From keeps native and extra shortcuts if ownership committed before a native update error", () => {
  const f = copyFixture(f => { seedCopyShortcuts(f); fakeExtraCopyBridge(f); });
  const native = shortcutState(f).native[0], extra = structuredClone(f.extraShortcuts[0]), before = ownership(f);
  f.failUpdate = () => { throw new Error("Native update failed after shortcut copy."); };
  assert.equal(f.feature.copyFrom(0), false);
  assert.equal(f.feature.ready, false); assert.equal(f.player.equipment.checkForItem(f.items.axe), true);
  assert.deepEqual(f.shortcutCalls, [["prepare", 0, 1], ["apply"]]);
  assert.deepEqual(shortcutState(f).native[0], native); assert.deepEqual(shortcutState(f).native[1], native);
  assert.deepEqual(f.extraShortcuts[0], extra); assert.deepEqual(f.extraShortcuts[1], extra);
  assert.deepEqual(JSON.parse(f.storage.get("quick-equip-extra-slots"))[1], extra);
  assert.deepEqual(ownership(f), before);
});

for (const index of [0, 1]) {
  test(`native equipment menu ${index} keeps one Copy From control with other set numbers and live selection/count`, () => {
    const f = copyFixture(), { shell, row, container, heading, menu } = f.makeSetMenu(index);
    const render = () => menu.render(f.player.equipmentSets, f.player.selectedEquipmentSet, f.player);
    render();
    const select = row.querySelector("select"), nativeButtons = menu.buttons.map(entry => entry.button), placeholder = select.children[0];
    assert.deepEqual(select.children.map(option => [option.value, option.textContent]), [["", "—"], ["0", "1"], ["2", "3"]]);
    assert.equal(placeholder.disabled, true); assert.equal(select.getAttribute("aria-label"), "Copy equipment from set");
    assert.equal(row.children[0].children[0], heading); assert.equal(row.children[0].children[1], container);
    assert.equal(row.children[1].children[0].textContent, "Copy From"); assert.equal(row.classList.contains("kroky-equipment-set-copy-enabled"), true);
    assert.equal(shell.classList.contains("kroky-equipment-set-row-shell"), index === 0);
    assert.deepEqual(container.children, nativeButtons); assert.equal(select.classList.contains("form-control-sm"), index === 1);
    for (let repeat = 0; repeat < 5; repeat++) render();
    assert.equal(row.querySelectorAll("select").length, 1); assert.equal(row.querySelector("select"), select);
    assert.equal(select.children[0], placeholder); assert.deepEqual(container.children, nativeButtons);
    nativeButtons[0].dispatch("click"); assert.equal(f.player.selectedEquipmentSet, 0); render();
    assert.deepEqual(select.children.map(option => option.value), ["", "1", "2"]);
    f.player.equipmentSets.push({ equipment: new f.Equipment(f.game) }); render();
    assert.deepEqual(select.children.map(option => [option.value, option.textContent]), [["", "—"], ["1", "2"], ["2", "3"], ["3", "4"]]);
    assert.equal(container.children[0], nativeButtons[0]); assert.equal(container.children[1], nativeButtons[1]);
    assert.equal(row.querySelectorAll("select").length, 1);
  });
}

test("Copy From dropdown dispatch copies the chosen source into the current set and clears its selection", () => {
  const f = copyFixture(), { row, menu } = f.makeSetMenu(0), source = f.feature.getPresets()[0], before = ownership(f);
  menu.render(f.player.equipmentSets, f.player.selectedEquipmentSet, f.player);
  const select = row.querySelector("select"); select.value = "0";
  assert.equal(select.dispatch("click").stopped, true); assert.equal(select.dispatch("keydown").stopped, true);
  assert.equal(select.dispatch("change").stopped, true); assert.equal(select.value, "");
  assert.equal(f.player.selectedEquipmentSet, 1); assert.equal(f.player.equipment.checkForItem(f.items.axe), true);
  assert.deepEqual(f.feature.getPresets()[0], source); assert.deepEqual(f.feature.getPresets()[1], source);
  assert.deepEqual(ownership(f), before); assert.equal(rootEntries(f.player.equipmentSets[0].equipment).length, 0);
  select.dispatch("change"); assert.equal(f.player.selectedEquipmentSet, 1); assert.deepEqual(ownership(f), before);
});

test("Copy From excludes the footer and simulator menu IDs while preserving native controls", () => {
  const f = copyFixture();
  for (const id of ["combat-equipment-set-menu-2", "combat-simulator-equipment-set-menu-0"]) {
    const { row, container, heading, menu } = f.makeSetMenu(2, id);
    menu.render(f.player.equipmentSets, f.player.selectedEquipmentSet, f.player);
    assert.equal(row.querySelector("select"), null); assert.deepEqual(row.children, [heading, container]);
    assert.equal(container.children.length, f.player.equipmentSets.length);
    assert.equal(row.classList.contains("kroky-equipment-set-copy-enabled"), false);
  }
});

test("Copy From hides for Raid and other players, then restores the main player's one control", () => {
  const f = copyFixture(), { row, menu } = f.makeSetMenu(0);
  const render = owner => menu.render(owner.equipmentSets, owner.selectedEquipmentSet, owner);
  render(f.player); const copy = row.children[1], select = row.querySelector("select");
  f.game.isGolbinRaid = true; render(f.player);
  assert.equal(copy.hidden, true); assert.equal(row.classList.contains("kroky-equipment-set-copy-enabled"), false);
  f.game.isGolbinRaid = false; const other = new f.Player(f.game); render(other);
  assert.equal(copy.hidden, true); assert.equal(row.classList.contains("kroky-equipment-set-copy-enabled"), false);
  render(f.player);
  assert.equal(copy.hidden, false); assert.equal(row.classList.contains("kroky-equipment-set-copy-enabled"), true);
  assert.equal(row.querySelectorAll("select").length, 1); assert.equal(row.querySelector("select"), select);
});

test("Copy From stays hidden until loadouts are ready and for a single available set", () => {
  const f = fixture({ load: false }), { row, menu } = f.makeSetMenu(1);
  const render = sets => menu.render(sets, f.player.selectedEquipmentSet, f.player);
  render(f.player.equipmentSets); const copy = row.children[1]; assert.equal(copy.hidden, true);
  f.hooks.loaded(); render(f.player.equipmentSets); assert.equal(copy.hidden, false);
  render(f.player.equipmentSets.slice(0, 1)); assert.equal(copy.hidden, true);
  assert.equal(row.classList.contains("kroky-equipment-set-copy-enabled"), false);
});

test("Copy From layout CSS gives four equal space-around gaps without headings adding to control widths", () => {
  const f = fixture(); f.hooks.interface();
  const style = f.document.head.querySelector("style");
  assert.ok(style);
  const row = style.textContent.match(/\.kroky-equipment-set-copy-enabled\s*\{([^}]*)\}/)?.[1];
  assert.ok(row);
  const declarations = new Map(row.split(";").filter(value => value.includes(":")).map(value => value.split(":").map(part => part.trim())));
  assert.equal(declarations.get("display"), "flex"); assert.equal(declarations.get("justify-content"), "space-around");
  const padding = declarations.get("padding")?.split(/\s+/), zero = /^0(?:px|rem)?$/;
  assert.match(declarations.get("padding-inline") ?? padding?.[padding.length === 1 ? 0 : 1] ?? "missing", zero);
  if (padding?.length === 4) assert.match(padding[3], zero);
  assert.match(declarations.get("column-gap") ?? declarations.get("gap")?.split(/\s+/).at(-1) ?? "0", zero);
  assert.match(style.textContent, /\.kroky-equipment-set-heading\s*\{[^}]*position:\s*absolute/);
  assert.match(style.textContent, /\.kroky-equipment-set-switch,\s*\.kroky-equipment-set-copy\s*\{[^}]*align-items:\s*center/);
  assert.match(style.textContent, /\.row\.kroky-equipment-set-row-shell\s*\{[^}]*margin-left:\s*0;\s*margin-right:\s*0/);
  assert.equal(f.player.renderQueue.equipmentSets, true);
});
