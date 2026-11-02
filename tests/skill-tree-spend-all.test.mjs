import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installSkillTreeSpendAll } from "../skill-tree-spend-all.mjs";

const originalError = console.error;
afterEach(() => { for (const name of ["document", "SwalLocale", "SkillTreeMenuElement"]) delete globalThis[name]; console.error = originalError; });
class Element {
  constructor() { this.children = []; this.events = {}; this.disabled = false; this.classList = { add() {} }; }
  append(node) { node.parentElement = this; this.children.push(node); }
  after(node) { node.parentElement = this.parentElement; this.parentElement.children.splice(this.parentElement.children.indexOf(this) + 1, 0, node); }
  addEventListener(event, callback) { this.events[event] = callback; }
}
function fixture() {
  const state = { saves: 0, attempts: [], paid: [], shown: [], confirms: [], logs: [], items: 10, currency: 10 };
  const loads = [];
  globalThis.document = { visibilityState: "visible", createElement: () => new Element() };
  globalThis.SwalLocale = { fire(options) {
    state.shown.push(options);
    if (options.icon === "error") { if (state.reportError) throw state.reportError; return Promise.resolve({}); }
    return new Promise(resolve => state.confirms.push(resolve));
  } };
  console.error = (...args) => state.logs.push(args);
  class Menu {
    constructor() { this.pointsCount = new Element(); this.row = new Element(); this.row.append(this.pointsCount); this.renderQueue = {}; this.visible = true; this.renders = 0; }
    get currentSkillTree() { return this.tree; }
    getClientRects() { return this.visible ? [{}] : []; }
    setSkillTree(tree) { this.tree = tree; return "native-bind"; }
    render() { this.renders++; this.renderQueue.currentPoints = this.renderQueue.costs = this.renderQueue.requirements = false; return "native-render"; }
    onClose() { this.tree = undefined; this.visible = false; return "native-close"; }
  }
  globalThis.SkillTreeMenuElement = Menu;
  const menu = new Menu(), game = { scheduleSave() { state.saves++; if (state.saveError) throw state.saveError; } };
  const ctx = { onCharacterLoaded(callback) { loads.push(callback); }, patch(Class, method) {
    const native = Class.prototype[method];
    return { replace(hook) { Class.prototype[method] = function (...args) { return hook.call(this, native.bind(this), ...args); }; } };
  } };
  installSkillTreeSpendAll(ctx, game);
  const tree = (name, points, specs) => {
    const result = { name, skill: { name: "Mining" }, game, points, nodes: { allObjects: [] }, unlockedNodes: [], checks: 0 };
    for (const spec of specs) result.nodes.allObjects.push({ ...spec, costs: { points: spec.points ?? 1 }, isUnlocked: !!spec.unlocked,
      requirements: spec.requires ? [spec.requires] : [], get canUnlock() { return (spec.parents ?? []).every(id => result.nodes.allObjects.find(node => node.id === id)?.isUnlocked) && this.requirements.every(check => check()); } });
    result.getNodeCosts = node => ({
      getItemQuantityArray: () => node.items ? [{ item: { id: "mod:Ore" }, quantity: node.items }] : [],
      getCurrencyQuantityArray: () => node.currency ? [{ currency: { id: "mod:Coins" }, quantity: node.currency }] : [],
      checkIfOwned: () => state.items >= (node.items ?? 0) && state.currency >= (node.currency ?? 0),
      consumeCosts() { state.items -= node.items ?? 0; state.currency -= node.currency ?? 0; state.paid.push(node.id); menu.renderQueue.costs = true; },
    });
    result.canAffordNode = node => result.points >= node.costs.points && result.getNodeCosts(node).checkIfOwned();
    result.canAffordAnyNode = () => { result.checks++; return result.nodes.allObjects.some(node => !node.isUnlocked && node.canUnlock && result.canAffordNode(node)); };
    result.unlockNode = node => {
      state.attempts.push(node.id);
      if (node.fail === "before") throw node.error;
      if (node.decline || node.isUnlocked || !node.canUnlock || !result.canAffordNode(node)) return;
      node.isUnlocked = true; result.points -= node.costs.points; menu.renderQueue.currentPoints = true;
      if (node.fail === "points") throw node.error;
      result.getNodeCosts(node).consumeCosts(); result.unlockedNodes.push(node); menu.renderQueue.requirements = true;
      node.onUnlock?.();
      if (node.fail === "stats") throw node.error;
    };
    return result;
  };
  const button = () => menu.row.children.find(node => node.textContent === "Spend All");
  const bind = target => { menu.visible = true; return menu.setSkillTree(target, game); };
  return { state, game, menu, tree, button, bind, load: () => loads.forEach(callback => callback()),
    click: () => button().events.click(), confirm: (index = 0, isConfirmed = true) => state.confirms[index]({ isConfirmed }) };
}

test("Spend all uses fresh cheapest eligible nodes, native costs and queued rendering", async () => {
  const m = fixture(), tree = m.tree("Abyssal", 6, [
    { id: "expensive", points: 3, currency: 3 }, { id: "root", points: 1, items: 2, currency: 1 },
    { id: "new-free-child", points: 0, parents: ["root"], currency: 1 }, { id: "tie", points: 1, items: 1 },
  ]);
  assert.equal(m.bind(tree), "native-bind"); assert.equal(m.button().parentElement, m.menu.pointsCount.parentElement);
  assert.equal(m.button().disabled, false); assert.match(m.button().className, /btn btn-success ml-2/);
  const pending = m.click(); assert.equal(m.button().disabled, true); assert.equal(m.state.shown.length, 1);
  assert.match(m.state.shown[0].text, /Mining — Abyssal/); assert.match(m.state.shown[0].text, /6/);
  assert.match(m.state.shown[0].text, /cheapest point cost first/); assert.match(m.state.shown[0].text, /item and currency costs/); assert.equal(m.state.shown[0].html, undefined);
  m.confirm(); await pending;
  assert.deepEqual(m.state.attempts, ["root", "new-free-child", "tie", "expensive"]);
  assert.deepEqual(m.state.paid, m.state.attempts); assert.equal(tree.points, 1); assert.equal(m.state.items, 7); assert.equal(m.state.currency, 5);
  assert.equal(m.state.saves, 1); assert.equal(m.menu.renders, 0); assert.equal(m.menu.renderQueue.currentPoints, true);
  m.menu.render(); assert.equal(m.button().disabled, true);
});

test("ties retain native node order, and zero-point nodes terminate through native unlock flags", async () => {
  const m = fixture(), tie = m.tree("Ties", 1, [{ id: "first" }, { id: "second" }]); m.bind(tie);
  let pending = m.click(); m.confirm(); await pending; assert.deepEqual(m.state.attempts, ["first"]);
  const free = m.tree("Free", 0, [{ id: "free", points: 0 }, { id: "child", points: 0, parents: ["free"] }]); m.bind(free);
  pending = m.click(); m.confirm(1); await pending; assert.deepEqual(m.state.attempts.slice(1), ["free", "child"]); assert.equal(m.state.saves, 2);
});

for (const [name, points, specs] of [
  ["zero points", 0, [{ id: "costly" }]], ["unmet requirements", 5, [{ id: "locked", requires: () => false }]],
  ["unmet parents", 5, [{ id: "child", parents: ["missing"] }]], ["already unlocked", 5, [{ id: "old", unlocked: true }]],
  ["unaffordable modded costs", 5, [{ id: "modded", items: 11, currency: 11 }]], ["empty", 5, []],
]) test(`Spend all is unavailable for ${name}`, async () => {
  const m = fixture(); m.bind(m.tree(name, points, specs)); assert.equal(m.button().disabled, true);
  await m.click(); assert.equal(m.state.shown.length, 0); assert.equal(m.state.saves, 0);
});

test("confirmation cancellation and changed affordability never purchase", async () => {
  const m = fixture(), tree = m.tree("Cancel", 2, [{ id: "one", items: 1 }]); m.bind(tree);
  let pending = m.click(); m.confirm(0, false); await pending; assert.equal(m.state.saves, 0);
  m.menu.render(); pending = m.click(); m.state.items = 0; m.confirm(1); await pending;
  assert.deepEqual(m.state.attempts, []); assert.equal(m.state.saves, 0);
});

for (const change of ["tree", "close", "load", "away-and-back"]) test(`${change} invalidates the pending confirmation`, async () => {
  const m = fixture(), a = m.tree("A", 3, [{ id: "a" }]), b = m.tree("B", 3, [{ id: "b" }]); m.bind(a);
  const pending = m.click(); await m.click(); assert.equal(m.state.shown.length, 1, "reentry cannot create another confirmation");
  if (change === "tree") m.bind(b);
  if (change === "close") m.menu.onClose();
  if (change === "load") m.load();
  if (change === "away-and-back") { m.bind(b); m.bind(a); }
  m.confirm(); await pending; assert.deepEqual(m.state.attempts, []); assert.equal(m.state.saves, 0);
});

test("a stale confirmation cannot release a newer tree's busy operation", async () => {
  const m = fixture(), a = m.tree("A", 2, [{ id: "a" }]), b = m.tree("B", 2, [{ id: "b" }]); m.bind(a);
  const old = m.click(); m.bind(b); const current = m.click(); m.confirm(0); await old;
  assert.equal(m.button().disabled, true); await m.click(); assert.equal(m.state.shown.length, 2);
  m.confirm(1); await current; assert.deepEqual(m.state.attempts, ["b"]); assert.equal(m.state.saves, 1);
});

test("native refusal stops immediately, and menu changes during purchase stop after the successful node", async () => {
  const m = fixture(), refused = m.tree("Refused", 5, [{ id: "refused", decline: true }, { id: "other", points: 2 }]); m.bind(refused);
  let pending = m.click(); m.confirm(); await pending; assert.deepEqual(m.state.attempts, ["refused"]); assert.equal(m.state.saves, 0);
  const other = m.tree("Other", 2, [{ id: "foreign" }]), moved = m.tree("Moved", 5, [{ id: "first", onUnlock: () => m.bind(other) }, { id: "second" }]); m.bind(moved);
  pending = m.click(); m.confirm(1); await pending; assert.deepEqual(m.state.attempts, ["refused", "first"]); assert.equal(m.state.saves, 1);
});

for (const phase of ["before", "points", "stats"]) test(`native ${phase} failure preserves partial effects, reports and saves once`, async () => {
  const m = fixture(), failure = new Error(`Failed at ${phase}`), tree = m.tree("Failure", 5, [
    { id: "first" }, { id: "fails", fail: phase, error: failure, items: 2 }, { id: "never" },
  ]); m.bind(tree);
  const pending = m.click(); m.confirm(); await assert.rejects(pending, error => error === failure);
  assert.deepEqual(m.state.attempts, ["first", "fails"]); assert.equal(m.state.saves, 1);
  assert.equal(tree.nodes.allObjects[1].isUnlocked, phase !== "before");
  assert.deepEqual(m.state.paid, phase === "stats" ? ["first", "fails"] : ["first"]);
  assert.equal(m.state.logs[0][1], failure); assert.equal(m.state.shown.at(-1).icon, "error");
});

test("first-node failure saves nothing; secondary save/report failures do not replace the native error", async () => {
  const m = fixture(), failure = new Error("Native failure"), tree = m.tree("First", 1, [{ id: "fails", fail: "before", error: failure }]); m.bind(tree);
  let pending = m.click(); m.confirm(); await assert.rejects(pending, error => error === failure); assert.equal(m.state.saves, 0);
  tree.nodes.allObjects[0].fail = "points"; m.menu.render(); m.state.saveError = new Error("Save failed"); m.state.reportError = new Error("Report failed");
  pending = m.click(); m.confirm(1); await assert.rejects(pending, error => error === failure); assert.equal(m.state.saves, 1);
});

test("only relevant native dirty flags rescan availability, including deferred visibility", () => {
  const m = fixture(), plain = m.tree("Plain", 0, [{ id: "one" }]); m.bind(plain); const checks = plain.checks;
  for (let frame = 0; frame < 20; frame++) { m.menu.renderQueue.costs = m.menu.renderQueue.requirements = true; m.menu.render(); }
  assert.equal(plain.checks, checks, "bank ticks do not rescan a points-only tree");
  plain.points = 1; m.menu.renderQueue.currentPoints = true; m.menu.visible = false; m.menu.render(); assert.equal(plain.checks, checks);
  m.menu.visible = true; m.menu.render(); assert.equal(plain.checks, checks + 1); assert.equal(m.button().disabled, false);
  const after = plain.checks; for (let frame = 0; frame < 20; frame++) m.menu.render(); assert.equal(plain.checks, after);
  m.menu.onClose(); m.load(); for (let frame = 0; frame < 20; frame++) m.menu.render(); assert.equal(plain.checks, after);
  let requirement = false;
  const modded = m.tree("Modded", 5, [{ id: "modded", items: 11, requires: () => requirement }]); m.bind(modded);
  assert.equal(m.button().disabled, true); requirement = true; m.state.items = 11; m.menu.renderQueue.requirements = true; m.menu.render(); assert.equal(m.button().disabled, false);
  m.state.items = 0; m.menu.renderQueue.costs = true; m.menu.render(); assert.equal(m.button().disabled, true);
});

test("new nodes added during purchases cannot exceed the initial attempt bound", async () => {
  const m = fixture(), tree = m.tree("Bounded", 5, [{ id: "one", onUnlock() { tree.nodes.allObjects.push({ id: "new", costs: { points: 0 }, isUnlocked: false, canUnlock: true, requirements: [] }); } }]); m.bind(tree);
  const pending = m.click(); m.confirm(); await pending;
  assert.deepEqual(m.state.attempts, ["one"]); assert.equal(tree.nodes.allObjects[1].isUnlocked, false); assert.equal(m.state.saves, 1);
});
