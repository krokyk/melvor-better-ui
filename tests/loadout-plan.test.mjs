import assert from "node:assert/strict";
import { test } from "node:test";
import { planLoadout, planMigration } from "../loadout-plan.mjs";

const weapon = { id: "test:Weapon", allowQuantity: false }, shield = { id: "test:Shield", allowQuantity: false };
const helmet = { id: "test:Helmet", allowQuantity: false }, quiver = { id: "test:Quiver", allowQuantity: true };
const summon1 = { id: "test:Summon1", allowQuantity: true }, summon2 = { id: "test:Summon2", allowQuantity: true };
const maxQuantity = 0xffffffff;

function item(id, validSlots, occupiesSlots = [], cantEquipWith = []) {
  return { id: `test:${id}`, validSlots, occupiesSlots, cantEquipWith,
    fitsInSlot(slotID) { return this.validSlots.some(slot => slot.id === slotID); } };
}

function holdings(entries, bank) {
  const quantities = new Map(bank);
  for (const { item, quantity } of entries) quantities.set(item, (quantities.get(item) ?? 0) + quantity);
  return quantities;
}

test("loadout planning conserves physical items and leaves its inputs intact", () => {
  const sword = item("Sword", [weapon]), axe = item("Axe", [weapon]), hat = item("Hat", [helmet]);
  const active = [{ slot: weapon, item: sword, quantity: 1 }, { slot: helmet, item: hat, quantity: 1 }];
  const desired = [{ slot: weapon, item: axe }], bank = new Map([[sword, 2], [axe, 3], [hat, 0]]);
  const originalBank = new Map(bank), originalActive = active.map(entry => ({ ...entry })), originalDesired = desired.map(entry => ({ ...entry }));
  const result = planLoadout(active, desired, bank);
  assert.deepEqual(result.equipment, [{ slot: weapon, item: axe, quantity: 1 }]);
  assert.deepEqual(result.bank, new Map([[sword, 3], [hat, 1], [axe, 2]]));
  assert.deepEqual(holdings(result.equipment, result.bank), holdings(active, bank));
  assert.deepEqual(result.missingStacks, []);
  assert.deepEqual(bank, originalBank); assert.deepEqual(active, originalActive); assert.deepEqual(desired, originalDesired);
});

test("common stacks keep their equipped quantity when retained or moved", () => {
  const tablet = item("Tablet", [summon1, summon2]);
  for (const slot of [summon1, summon2]) {
    const result = planLoadout([{ slot: summon1, item: tablet, quantity: 38 }], [{ slot, item: tablet }], new Map([[tablet, 600]]));
    assert.deepEqual(result.equipment, [{ slot, item: tablet, quantity: 38 }]);
    assert.equal(result.bank.get(tablet), 600);
  }
});

test("new stacks take available Bank stock and replaced stacks return to Bank", () => {
  const oldArrow = item("OldArrow", [quiver]), arrow = item("Arrow", [quiver]);
  const result = planLoadout([{ slot: quiver, item: oldArrow, quantity: 22 }], [{ slot: quiver, item: arrow }], new Map([[oldArrow, 3], [arrow, 9]]));
  assert.deepEqual(result.equipment, [{ slot: quiver, item: arrow, quantity: 9 }]);
  assert.deepEqual(result.bank, new Map([[oldArrow, 25], [arrow, 0]]));
});

test("unavailable stack references stay empty while other gear applies", () => {
  const arrow = item("Arrow", [quiver]), sword = item("Sword", [weapon]);
  const result = planLoadout([], [{ slot: quiver, item: arrow }, { slot: weapon, item: sword }], new Map([[arrow, undefined], [sword, 1]]));
  assert.deepEqual(result.missingStacks, [{ slot: quiver, item: arrow }]);
  assert.deepEqual(result.equipment, [{ slot: weapon, item: sword, quantity: 1 }]);
  assert.equal(result.bank.get(arrow), 0); assert.equal(result.bank.get(sword), 0);
});

test("missing nonquantity gear rejects the whole plan without changing Bank or active gear", () => {
  const sword = item("Sword", [weapon]), hat = item("Hat", [helmet]);
  const active = [{ slot: weapon, item: sword, quantity: 1 }], bank = new Map([[sword, 0]]);
  assert.throws(() => planLoadout(active, [{ slot: helmet, item: hat }], bank), /Hat.*unavailable/);
  assert.equal(active[0].quantity, 1); assert.deepEqual(bank, new Map([[sword, 0]]));
});

test("one physical item can move between valid slots without consuming another copy", () => {
  const hat = item("Hat", [helmet, shield]);
  const result = planLoadout([{ slot: helmet, item: hat, quantity: 1 }], [{ slot: shield, item: hat }]);
  assert.deepEqual(result.equipment, [{ slot: shield, item: hat, quantity: 1 }]);
  assert.equal(result.bank.get(hat), 0);
});

test("nonquantity destinations take one item and return excess physical quantity", () => {
  const hybrid = item("Hybrid", [quiver, weapon]);
  const result = planLoadout([{ slot: quiver, item: hybrid, quantity: 20 }], [{ slot: weapon, item: hybrid }], new Map([[hybrid, 2]]));
  assert.equal(result.equipment[0].quantity, 1); assert.equal(result.bank.get(hybrid), 21);
});

test("duplicate items, duplicate roots, occupied slots, invalid slots and item conflicts reject", () => {
  const tablet = item("Tablet", [summon1, summon2]), sword = item("Sword", [weapon]);
  const axe = item("Axe", [weapon]), twoHanded = item("TwoHanded", [weapon], [shield]), buckler = item("Buckler", [shield]);
  const hat = item("Hat", [helmet], [], [sword]);
  const invalidTargets = [
    [[{ slot: summon1, item: tablet }, { slot: summon2, item: tablet }], /more than one equipment slot/],
    [[{ slot: weapon, item: sword }, { slot: weapon, item: axe }], /required by more than one/],
    [[{ slot: weapon, item: twoHanded }, { slot: shield, item: buckler }], /Shield.*required by more than one/],
    [[{ slot: helmet, item: sword }], /cannot be equipped in/],
    [[{ slot: weapon, item: sword }, { slot: helmet, item: hat }], /cannot be equipped with/],
    [[{ slot: helmet, item: hat }, { slot: weapon, item: sword }], /cannot be equipped with/],
  ];
  for (const [target, error] of invalidTargets) assert.throws(() => planLoadout([], target), error);
  assert.throws(() => planLoadout([
    { slot: summon1, item: tablet, quantity: 1 }, { slot: summon2, item: tablet, quantity: 1 },
  ], []), /more than one equipment slot/);
});

test("validSlots supports equipment objects without fitsInSlot", () => {
  const sword = { id: "test:Sword", validSlots: [weapon] };
  assert.equal(planLoadout([], [{ slot: weapon, item: sword }], new Map([[sword, 1]])).equipment[0].item, sword);
});

test("invalid quantities and overflowing output buckets reject without clamping", () => {
  const arrow = item("Arrow", [quiver]);
  for (const quantity of [-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, maxQuantity + 1]) {
    assert.throws(() => planLoadout([{ slot: quiver, item: arrow, quantity }], []), /positive uint32 integer/);
  }
  for (const quantity of [-1, 0.5, NaN, Infinity, null, maxQuantity + 1]) {
    assert.throws(() => planLoadout([], [{ slot: quiver, item: arrow }], new Map([[arrow, quantity]])), /non-negative uint32 integer/);
  }
  const active = [{ slot: quiver, item: arrow, quantity: maxQuantity }], bank = new Map([[arrow, 1]]);
  assert.throws(() => planLoadout(active, [], bank), /Resulting Bank quantity.*uint32/);
  assert.equal(bank.get(arrow), 1); assert.equal(active[0].quantity, maxQuantity);
  const retained = planLoadout(active, [{ slot: quiver, item: arrow }], bank);
  assert.equal(retained.equipment[0].quantity, maxQuantity); assert.equal(retained.bank.get(arrow), 1);
});

test("unaffected Bank types are not read or copied", () => {
  const sword = item("Sword", [weapon]), unrelated = item("Unrelated", [helmet]);
  const bank = new Map([[sword, 1], [unrelated, Infinity]]);
  bank[Symbol.iterator] = () => { throw new Error("Bank scan"); };
  const result = planLoadout([], [{ slot: weapon, item: sword }], bank);
  assert.deepEqual(result.bank, new Map([[sword, 0]]));
});

test("migration sums all inactive physical copies and stacks, leaves active uninspected, and changes no input", () => {
  const sword = item("Sword", [weapon]), arrow = item("Arrow", [quiver]);
  const first = [{ slot: weapon, item: sword, quantity: 1 }, { slot: quiver, item: arrow, quantity: 7 }];
  const third = [{ slot: weapon, item: sword, quantity: 1 }, { slot: quiver, item: arrow, quantity: 11 }];
  const sets = [first, undefined, third, []], bank = new Map([[sword, 2], [arrow, 3]]);
  const result = planMigration(sets, 1, bank);
  assert.deepEqual(result.bank, new Map([[sword, 4], [arrow, 21]]));
  assert.deepEqual(result.clearSets, [0, 2, 3]);
  assert.equal(sets[0], first); assert.equal(sets[1], undefined); assert.equal(sets[2], third);
  assert.equal(first[1].quantity, 7); assert.equal(third[1].quantity, 11);
  assert.deepEqual(bank, new Map([[sword, 2], [arrow, 3]]));
});

test("migration counts repeated real roots instead of deduplicating them", () => {
  const sword = item("Sword", [weapon]);
  const result = planMigration([[], [{ slot: weapon, item: sword, quantity: 1 }, { slot: shield, item: sword, quantity: 1 }]], 0);
  assert.equal(result.bank.get(sword), 2);
});

test("migration rejects invalid indices, quantities and Bank overflow before mutating input", () => {
  const arrow = item("Arrow", [quiver]), entry = { slot: quiver, item: arrow, quantity: 1 };
  const bank = new Map([[arrow, maxQuantity]]);
  for (const index of [-1, 2, 0.5, NaN]) assert.throws(() => planMigration([[], [entry]], index, bank), /index is invalid/);
  assert.throws(() => planMigration([[], [entry]], 0, bank), /Resulting Bank quantity.*uint32/);
  assert.equal(bank.get(arrow), maxQuantity); assert.equal(entry.quantity, 1);
  assert.throws(() => planMigration([[], [{ ...entry, quantity: 0 }]], 0), /positive uint32 integer/);
});
