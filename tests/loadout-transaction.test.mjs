import assert from "node:assert/strict";
import { test } from "node:test";
import { applyEquipmentTransaction } from "../loadout-transaction.mjs";

class Events {
  listeners = [];
  emit(type, event) { this.listeners.forEach(listener => listener(type, event)); }
}

class Item {
  constructor(id, occupiesSlots = [], charged = false) {
    this.id = id;
    this.occupiesSlots = occupiesSlots;
    if (charged) this.consumesChargesOn = [];
    this.events = new Events();
  }
  emit(...args) { this.events.emit(...args); }
}

class ItemQuantityChangedEvent {
  constructor(item, oldQuantity, newQuantity) { Object.assign(this, { item, oldQuantity, newQuantity }); }
}

class EquippedItem {
  constructor(slot, emptyItem) { Object.assign(this, { slot, emptyItem, item: emptyItem, quantity: 0, occupies: [], quickEquipItems: [] }); }
  get isEmpty() { return this.item === this.emptyItem; }
  get providesStats() { return !this.isEmpty && this.occupiedBy === undefined; }
  setEmpty() { Object.assign(this, { item: this.emptyItem, quantity: 0, occupies: [], occupiedBy: undefined }); }
  setEquipped(item, quantity, occupies) { Object.assign(this, { item, quantity, occupies, occupiedBy: undefined }); }
  setOccupied(item, occupiedBy) { Object.assign(this, { item, occupiedBy, quantity: 0, occupies: [] }); }
}

class Equipment {
  constructor(slots, empty) {
    this.equippedArray = slots.map(slot => new EquippedItem(slot, empty));
    this.equippedItems = Object.fromEntries(this.equippedArray.map(equipped => [equipped.slot.id, equipped]));
    this.itemSlotMap = new Map();
    this.itemChargeUsers = new Set();
  }
  getRootSlot(slot) { return this.equippedItems[slot.id].occupiedBy ?? slot; }
  unequipItem(slot) {
    const equipped = this.equippedItems[this.getRootSlot(slot).id];
    this.itemSlotMap.delete(equipped.item);
    this.itemChargeUsers.delete(equipped);
    equipped.occupies.forEach(occupied => this.equippedItems[occupied.id].setEmpty());
    equipped.setEmpty();
  }
  equipItem(item, slot, quantity) {
    const roots = new Set([slot, ...item.occupiesSlots]
      .filter(required => !this.equippedItems[required.id].isEmpty)
      .map(required => this.getRootSlot(required)));
    roots.forEach(root => this.unequipItem(root));
    this.itemSlotMap.set(item, slot);
    if (item.consumesChargesOn !== undefined) this.itemChargeUsers.add(this.equippedItems[slot.id]);
    this.equippedItems[slot.id].setEquipped(item, quantity, item.occupiesSlots);
    this.fail?.("equip");
    item.occupiesSlots.forEach(occupied => this.equippedItems[occupied.id].setOccupied(item, slot));
  }
}

class Bank {
  constructor(game) {
    this.game = game;
    this._events = new Events();
    this.items = new Map();
    this.itemsByTab = [[], []];
    this.defaultItemTabs = new Map();
    this.customSortOrder = [];
    this.maximumSlots = 3;
    this.calls = [];
  }
  getItemDefaultTab(item) { return this.defaultItemTabs.get(item) ?? 0; }
  seed(item, quantity, tab) {
    const bankItem = { item, quantity, tab, tabPosition: this.itemsByTab[tab].length };
    this.items.set(item, bankItem);
    this.itemsByTab[tab].push(bankItem);
    this.customSortOrder.push(item);
  }
  removeItemQuantity(item, quantity, removeItemCharges) {
    this.calls.push(["remove", item, quantity, removeItemCharges]);
    const bankItem = this.items.get(item), oldQuantity = bankItem.quantity;
    bankItem.quantity -= quantity;
    if (bankItem.quantity <= 0) {
      this.items.delete(item);
      const tab = this.itemsByTab[bankItem.tab];
      tab.splice(bankItem.tabPosition, 1);
      tab.forEach((entry, index) => { entry.tabPosition = index; });
      if (removeItemCharges) this.game.itemCharges.delete(item);
    }
    this.fail?.("remove");
    const event = new ItemQuantityChangedEvent(item, oldQuantity, Math.max(bankItem.quantity, 0));
    this._events.emit("itemChanged", event);
    item.emit("bankQuantityChanged", event);
  }
  addItem(item, quantity, logLost, found, ignoreSpace, notify, source) {
    this.calls.push(["add", item, quantity, logLost, found, ignoreSpace, notify, source]);
    let bankItem = this.items.get(item);
    const oldQuantity = bankItem?.quantity ?? 0;
    if (bankItem) bankItem.quantity += quantity;
    else {
      if (this.items.size >= this.maximumSlots && !ignoreSpace) return false;
      const tab = this.getItemDefaultTab(item);
      bankItem = { item, quantity, tab, tabPosition: this.itemsByTab[tab].length };
      this.items.set(item, bankItem);
      this.itemsByTab[tab].push(bankItem);
      if (!this.customSortOrder.includes(item)) this.customSortOrder = this.itemsByTab.flat().map(entry => entry.item);
    }
    this.fail?.("add");
    this.game.telemetry.createItemGainedEvent(item, quantity, source);
    const event = new ItemQuantityChangedEvent(item, oldQuantity, bankItem.quantity);
    this._events.emit("itemChanged", event);
    item.emit("bankQuantityChanged", event);
    return true;
  }
}

function fixture() {
  const weapon = { id: "weapon" }, shield = { id: "shield" }, quiver = { id: "quiver" };
  const items = {
    empty: new Item("empty"), sword: new Item("sword", [], true), shield: new Item("shield"),
    greatsword: new Item("greatsword", [shield], true), arrows: new Item("arrows"), spare: new Item("spare"),
  };
  const telemetry = [];
  const game = {
    telemetry: { createItemGainedEvent(...args) { telemetry.push(args); } },
    itemCharges: new Map([[items.sword, 37], [items.greatsword, 99]]), selected: 0,
  };
  const bank = game.bank = new Bank(game);
  bank.seed(items.greatsword, 1, 0);
  bank.seed(items.spare, 1, 0);
  bank.seed(items.arrows, 40, 1);
  bank.defaultItemTabs.set(items.sword, 1);
  bank.defaultItemTabs.set(items.shield, 0);
  const equipment = new Equipment([weapon, shield, quiver], items.empty);
  equipment.equipItem(items.sword, weapon, 1);
  equipment.equipItem(items.shield, shield, 1);
  equipment.equipItem(items.arrows, quiver, 10);
  const untouched = new Equipment([weapon, shield, quiver], items.empty);
  const changes = [{ equipment, entries: [
    { item: items.greatsword, slot: weapon, quantity: 1 },
    { item: items.arrows, slot: quiver, quantity: 50 },
  ] }];
  const quantities = new Map([[items.greatsword, 0], [items.arrows, 0], [items.sword, 1], [items.shield, 1]]);
  return { game, bank, equipment, untouched, items, changes, quantities, telemetry, weapon, shield, quiver };
}

function ownership({ bank, equipment, untouched }) {
  const totals = new Map([...bank.items].map(([item, entry]) => [item.id, entry.quantity]));
  for (const equipped of [...equipment.equippedArray, ...untouched.equippedArray]) {
    if (equipped.providesStats) totals.set(equipped.item.id, (totals.get(equipped.item.id) ?? 0) + equipped.quantity);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}

function capture(f) {
  return {
    totals: ownership(f), items: new Map(f.bank.items), quantities: new Map([...f.bank.items].map(([item, entry]) => [item, entry.quantity])),
    tabs: f.bank.itemsByTab.map(tab => ({ tab, entries: [...tab] })),
    sort: f.bank.customSortOrder, order: [...f.bank.customSortOrder],
    slots: f.equipment.equippedArray.map(equipped => ({ equipped, state: Object.getOwnPropertyDescriptors(equipped) })),
    itemSlots: [...f.equipment.itemSlotMap], chargeUsers: [...f.equipment.itemChargeUsers],
    bankEmit: Object.getOwnPropertyDescriptor(f.bank._events, "emit"),
    itemEmits: new Map([...f.quantities.keys()].map(item => [item, Object.getOwnPropertyDescriptor(item, "emit")])),
    telemetry: Object.getOwnPropertyDescriptor(f.game.telemetry, "createItemGainedEvent"),
  };
}

function assertRestoredMethods(f, before) {
  assert.deepEqual(Object.getOwnPropertyDescriptor(f.bank._events, "emit"), before.bankEmit);
  for (const [item, descriptor] of before.itemEmits) assert.deepEqual(Object.getOwnPropertyDescriptor(item, "emit"), descriptor);
  assert.deepEqual(Object.getOwnPropertyDescriptor(f.game.telemetry, "createItemGainedEvent"), before.telemetry);
}

function assertRolledBack(f, before) {
  assert.deepEqual(ownership(f), before.totals);
  for (const [item, entry] of before.items) assert.equal(f.bank.items.get(item), entry);
  assert.equal(f.bank.items.size, before.items.size);
  before.tabs.forEach(({ tab, entries }, index) => {
    assert.equal(f.bank.itemsByTab[index], tab);
    assert.deepEqual(tab, entries);
    tab.forEach((entry, position) => assert.equal(entry.tabPosition, position));
  });
  assert.equal(f.bank.customSortOrder, before.sort);
  assert.deepEqual(f.bank.customSortOrder, before.order);
  before.slots.forEach(({ equipped, state }, index) => {
    assert.equal(f.equipment.equippedArray[index], equipped);
    assert.deepEqual(Object.getOwnPropertyDescriptors(equipped), state);
  });
  assert.deepEqual([...f.equipment.itemSlotMap], before.itemSlots);
  assert.deepEqual([...f.equipment.itemChargeUsers], before.chargeUsers);
  assert.equal(f.telemetry.length, 0);
  assertRestoredMethods(f, before);
}

test("native Bank and item callbacks see final equipment, stats selection, quantities, and charge ownership", () => {
  const f = fixture(), before = capture(f), notifications = [], untouched = capture({ ...f, equipment: f.untouched }).slots;
  const checkFinal = () => {
    assert.equal(f.game.selected, 1);
    assert.deepEqual(ownership(f), before.totals);
    assert.equal(f.equipment.equippedItems.weapon.item, f.items.greatsword);
    assert.equal(f.equipment.equippedItems.shield.occupiedBy, f.weapon);
    assert.equal(f.equipment.equippedItems.quiver.quantity, 50);
    for (const [item, quantity] of f.quantities) assert.equal(f.bank.items.get(item)?.quantity ?? 0, quantity);
  };
  f.bank._events.listeners.push((type, event) => { checkFinal(); notifications.push(["bank", type, event]); });
  for (const item of f.quantities.keys()) item.events.listeners.push((type, event) => { checkFinal(); notifications.push(["item", type, event]); });
  const originalTelemetry = f.game.telemetry.createItemGainedEvent;
  f.game.telemetry.createItemGainedEvent = function (...args) { checkFinal(); originalTelemetry.apply(this, args); };
  before.telemetry = Object.getOwnPropertyDescriptor(f.game.telemetry, "createItemGainedEvent");
  let updates = 0;
  applyEquipmentTransaction(f.game, f.changes, f.quantities, () => {
    assert.equal(notifications.length, 0);
    assert.equal(f.telemetry.length, 0);
    f.game.selected = 1;
    updates++;
  });
  checkFinal();
  assert.equal(updates, 1);
  assert.deepEqual(f.bank.calls.map(call => call[0]), ["remove", "remove", "add", "add"]);
  f.bank.calls.filter(call => call[0] === "remove").forEach(call => assert.equal(call[3], false));
  f.bank.calls.filter(call => call[0] === "add").forEach(call => assert.deepEqual(call.slice(3), [false, false, false, false, "Game.Unequip"]));
  assert.equal(notifications.length, 8);
  for (const [channel, type, event] of notifications) {
    assert.ok(event instanceof ItemQuantityChangedEvent);
    assert.equal(type, channel === "bank" ? "itemChanged" : "bankQuantityChanged");
    assert.equal(event.oldQuantity, before.quantities.get(event.item) ?? 0);
    assert.equal(event.newQuantity, f.quantities.get(event.item));
  }
  assert.equal(f.game.itemCharges.get(f.items.sword), 37);
  assert.equal(f.game.itemCharges.get(f.items.greatsword), 99);
  assert.deepEqual([...f.equipment.itemChargeUsers], [f.equipment.equippedItems.weapon]);
  untouched.forEach(({ equipped, state }) => assert.deepEqual(Object.getOwnPropertyDescriptors(equipped), state));
  assertRestoredMethods(f, before);
});

for (const step of ["remove", "equip", "add"]) {
  test(`native ${step} failure restores quantities, occupied roots, identities, and bank tab ordering`, () => {
    const f = fixture(), before = capture(f);
    let notifications = 0;
    f.bank._events.listeners.push(() => { notifications++; });
    const failure = new Error(`failed ${step}`);
    const fail = actual => { if (actual === step) throw failure; };
    f.bank.fail = fail;
    f.equipment.fail = fail;
    assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), error => error === failure && !error.ownershipCommitted);
    assertRolledBack(f, before);
    assert.equal(notifications, 0);
    delete f.bank.fail;
    delete f.equipment.fail;
    applyEquipmentTransaction(f.game, f.changes, f.quantities, () => {});
    assert.deepEqual(ownership(f), before.totals);
  });
}

test("a native bank capacity rejection rolls back instead of dropping an unequipped item", () => {
  const f = fixture(), before = capture(f);
  f.bank.maximumSlots = 1;
  assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), /returned to the bank/);
  assertRolledBack(f, before);
});

for (const step of ["afterCommit", "bank listener", "item listener", "telemetry"]) {
  test(`${step} failure retains committed ownership and restores intercepted methods`, () => {
    const f = fixture();
    const failure = new Error(step);
    if (step === "bank listener") f.bank._events.listeners.push(() => { throw failure; });
    if (step === "item listener") f.items.greatsword.events.listeners.push(() => { throw failure; });
    if (step === "telemetry") f.game.telemetry.createItemGainedEvent = () => { throw failure; };
    const before = capture(f);
    assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => {
      f.game.selected = 1;
      if (step === "afterCommit") throw failure;
    }), error => error === failure && error.ownershipCommitted === true);
    assert.deepEqual(ownership(f), before.totals);
    assert.equal(f.game.selected, 1);
    assert.equal(f.equipment.equippedItems.weapon.item, f.items.greatsword);
    for (const [item, quantity] of f.quantities) assert.equal(f.bank.items.get(item)?.quantity ?? 0, quantity);
    assertRestoredMethods(f, before);
  });
}

test("multiple changed native sets are committed together and inactive root ownership can be emptied", () => {
  const f = fixture(), before = capture(f);
  f.changes = [
    { equipment: f.equipment, entries: [] },
    { equipment: f.untouched, entries: [{ item: f.items.greatsword, slot: f.weapon, quantity: 1 }, { item: f.items.arrows, slot: f.quiver, quantity: 50 }] },
  ];
  f.bank._events.listeners.push(() => {
    assert.equal(f.equipment.itemSlotMap.size, 0);
    assert.equal(f.untouched.equippedItems.weapon.item, f.items.greatsword);
    assert.equal(f.game.selected, 1);
  });
  applyEquipmentTransaction(f.game, f.changes, f.quantities, () => { f.game.selected = 1; });
  assert.deepEqual(ownership(f), before.totals);
  assert.equal(f.equipment.itemChargeUsers.size, 0);
  assert.deepEqual([...f.untouched.itemChargeUsers], [f.untouched.equippedItems.weapon]);
});

test("repeated native quantity emissions are coalesced into original-before to final-after events", () => {
  const f = fixture(), events = [];
  const remove = f.bank.removeItemQuantity;
  f.bank.removeItemQuantity = function (item, quantity, charges) {
    if (quantity > 1) {
      remove.call(this, item, 1, charges);
      remove.call(this, item, quantity - 1, charges);
    } else remove.call(this, item, quantity, charges);
  };
  f.bank._events.listeners.push((type, event) => {
    if (event.item === f.items.arrows) events.push(["bank", type, event]);
  });
  f.items.arrows.events.listeners.push((type, event) => events.push(["item", type, event]));
  applyEquipmentTransaction(f.game, f.changes, f.quantities, () => {});
  assert.equal(events.length, 2);
  assert.equal(events[0][2], events[1][2]);
  events.forEach(([, , event]) => {
    assert.ok(event instanceof ItemQuantityChangedEvent);
    assert.equal(event.oldQuantity, 40);
    assert.equal(event.newQuantity, 0);
  });
});

test("reentry during native data commit is rejected before changing ownership", () => {
  const f = fixture(), before = capture(f);
  f.bank.fail = () => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => {});
  assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), /already running/);
  assertRolledBack(f, before);
});

test("interceptor setup failure restores already intercepted methods before any native ownership changes", () => {
  const f = fixture();
  Object.defineProperty(f.items.sword, "emit", { value: f.items.sword.emit, writable: false, configurable: false });
  const before = capture(f);
  assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), TypeError);
  assertRolledBack(f, before);
});

test("invalid final bank quantities fail before intercepting native methods", () => {
  const f = fixture(), before = capture(f);
  f.quantities.set(f.items.greatsword, -1);
  assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), /Invalid final bank quantity/);
  assertRolledBack(f, before);
});

for (const quantity of [49, 51]) {
  test(`an invalid plan with ${quantity} final arrows fails before any native mutation`, () => {
    const f = fixture(), before = capture(f);
    f.changes[0].entries[1].quantity = quantity;
    assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), /changes ownership of arrows/);
    assert.equal(f.bank.calls.length, 0);
    assertRolledBack(f, before);
  });
}

for (const step of ["add", "remove", "equip"]) {
  test(`a native ${step} that silently writes the wrong quantity rolls back before publication`, () => {
    const f = fixture(), before = capture(f);
    if (step === "add") {
      const add = f.bank.addItem;
      f.bank.addItem = function (item, ...args) { return item === f.items.sword ? true : add.call(this, item, ...args); };
    } else if (step === "remove") {
      f.bank.maximumSlots = 4;
      const remove = f.bank.removeItemQuantity;
      f.bank.removeItemQuantity = function (item, ...args) { if (item !== f.items.arrows) remove.call(this, item, ...args); };
    } else {
      const equip = f.equipment.equipItem;
      f.equipment.equipItem = function (...args) {
        equip.apply(this, args);
        this.equippedItems[args[1].id].quantity--;
      };
    }
    let notifications = 0;
    f.bank._events.listeners.push(() => { notifications++; });
    assert.throws(() => applyEquipmentTransaction(f.game, f.changes, f.quantities, () => assert.fail("must not commit")), /changes ownership/);
    assertRolledBack(f, before);
    assert.equal(notifications, 0);
  });
}

test("a switch with unchanged Bank quantities avoids Bank tabs, sort copies, native methods, and event interception", () => {
  const f = fixture(), before = capture(f);
  const entries = f.equipment.equippedArray.filter(equipped => equipped.providesStats)
    .map(({ item, slot, quantity }) => ({ item, slot, quantity }));
  f.changes = [{ equipment: f.equipment, entries: [] }, { equipment: f.untouched, entries }];
  f.quantities = new Map([...f.quantities.keys()].map(item => [item, f.bank.items.get(item)?.quantity ?? 0]));
  Object.defineProperty(f.bank, "itemsByTab", { get() { assert.fail("Bank tabs must not be copied"); } });
  Object.defineProperty(f.bank, "customSortOrder", { get() { assert.fail("Bank sort order must not be copied"); } });
  Object.defineProperty(f.bank._events, "emit", { value: f.bank._events.emit, writable: false, configurable: false });
  Object.freeze(f.game.telemetry);
  for (const item of f.quantities.keys()) Object.defineProperty(item, "emit", { value: item.emit, writable: false, configurable: false });
  f.bank.addItem = f.bank.removeItemQuantity = () => assert.fail("Native Bank methods must not be called");
  let commits = 0;
  applyEquipmentTransaction(f.game, f.changes, f.quantities, () => { commits++; });
  assert.equal(commits, 1);
  assert.deepEqual(ownership(f), before.totals);
  assert.equal(f.equipment.itemSlotMap.size, 0);
  assert.equal(f.untouched.itemSlotMap.get(f.items.sword), f.weapon);
  assert.equal(f.telemetry.length, 0);
});

test("unchanged Bank items are not intercepted while other Bank items change", () => {
  const f = fixture();
  f.bank.maximumSlots = 4;
  f.quantities.set(f.items.arrows, 40);
  f.changes[0].entries[1].quantity = 10;
  Object.defineProperty(f.items.arrows, "emit", { value: f.items.arrows.emit, writable: false, configurable: false });
  const before = capture(f);
  applyEquipmentTransaction(f.game, f.changes, f.quantities, () => {});
  assert.equal(f.bank.items.get(f.items.arrows).quantity, 40);
  assert.deepEqual(ownership(f), before.totals);
  assert.equal(f.bank.calls.filter(call => call[1] === f.items.arrows).length, 0);
  assertRestoredMethods(f, before);
});
