import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installSkillTreeGlow } from "../skill-tree-glow.mjs";

const originalError = console.error;
afterEach(() => {
  for (const name of ["document", "assets", "SkillTree", "SkillTreeButtonElement", "SkillTreeMenuElement", "skillTreeMenu"]) delete globalThis[name];
  console.error = originalError;
});
class Element {
  constructor(tag = "a") {
    this.tagName = tag; this.classes = new Set(["native-class"]); this.toggles = 0; this.style = { color: "native" };
    this.classList = { contains: name => this.classes.has(name), toggle: (name, value) => { this.toggles++; value ? this.classes.add(name) : this.classes.delete(name); } };
  }
  append(child) { child.parentElement = this; }
  closest(tag) { assert.equal(tag, "a"); return this.parentElement; }
}
function emitter() {
  const events = new Map();
  return { events, on(name, callback) { const list = events.get(name) ?? []; list.push(callback); events.set(name, list); }, emit(name) { for (const callback of events.get(name) ?? []) callback(); } };
}
function fixture() {
  const hooks = {}, sidebar = new Element(), image = new Element("img"), head = { children: [], append(node) { this.children.push(node); } };
  sidebar.append(image);
  const state = { lookups: 0, logs: [], requirements: true };
  globalThis.assets = { getURI: value => `native:${value}` };
  globalThis.document = {
    head, createElement: () => new Element("style"), getElementById: id => head.children.find(node => node.id === id),
    querySelector(selector) { state.lookups++; assert.equal(selector, '#sidebar img[src="native:assets/media/main/skill_tree.png"]'); return image; },
  };
  console.error = (...args) => state.logs.push(args);
  class Game {
    constructor() { Object.assign(this, emitter()); this.skills = []; this.bank = { ...emitter(), amount: 10 }; this.currencies = [{ ...emitter(), amount: 10 }]; }
    decode() { state.decode?.(); return "native-decode"; }
  }
  const game = new Game();
  class Tree {
    constructor(skill, points, specs) {
      this.game = game; this.skill = skill; this.points = points; this.checks = 0;
      this.nodes = { allObjects: specs.map(spec => ({ ...spec, isUnlocked: !!spec.unlocked, costs: { points: spec.points ?? 1 }, requirements: spec.requirement ? [typeof spec.requirement === "object" ? spec.requirement : {}] : [],
        get canUnlock() { return (spec.parents ?? []).every(id => skill.tree.nodes.allObjects.find(node => node.id === id)?.isUnlocked) && (!spec.requirement || state.requirements); } })) };
    }
    getNodeCosts(node) { return { getItemQuantityArray: () => node.items ? [{}] : [], getCurrencyQuantityArray: () => node.currency ? [{}] : [] }; }
    canAffordAnyNode() {
      this.checks++; if (this.failCheck) throw this.failCheck;
      return this.nodes.allObjects.some(node => !node.isUnlocked && node.canUnlock && this.points >= node.costs.points && game.bank.amount >= (node.items ?? 0) && game.currencies[0].amount >= (node.currency ?? 0));
    }
    addPoints(amount) { this.points += amount; return "native-points"; }
    unlockNode(node) {
      if (node.isUnlocked || !node.canUnlock || this.points < node.costs.points) return;
      node.isUnlocked = true; this.points -= node.costs.points;
      if (node.fail) throw node.fail;
      game.bank.amount -= node.items ?? 0; game.bank.emit("itemChanged");
      game.currencies[0].amount -= node.currency ?? 0; game.currencies[0].emit("amountChanged");
      game.emit("requirementChange"); return "native-unlock";
    }
  }
  class Header {
    constructor() { this.viewBtn = new Element("button"); }
    setSkill(skill) { this.viewBtn.onclick = () => skill.opened++; return "native-header"; }
  }
  class Menu {
    constructor() { this.dropdownItemMap = new Map(); }
    createDropdownItem(skill) { const link = new Element(), points = new Element("span"); link.append(points); link.onclick = () => skill.opened++; this.dropdownItemMap.set(skill, points); return "native-entry"; }
    render() { return "native-render"; }
  }
  globalThis.SkillTree = Tree; globalThis.SkillTreeButtonElement = Header; globalThis.SkillTreeMenuElement = Menu; globalThis.skillTreeMenu = new Menu();
  const ctx = { onCharacterLoaded(fn) { hooks.character = fn; }, onInterfaceReady(fn) { hooks.ready = fn; }, patch(Class, method) {
    const native = Class.prototype[method];
    return { replace(fn) { Class.prototype[method] = function (...args) { return fn.call(this, native.bind(this), ...args); }; } };
  } };
  installSkillTreeGlow(ctx, game);
  const add = (name, points, specs = [{ id: "root" }]) => {
    const skill = { name, opened: 0, skillTrees: { getObjectByID: id => id === "melvorItA:Abyssal" ? skill.tree : undefined } };
    skill.tree = new Tree(skill, points, specs); game.skills.push(skill);
    const header = new Header(); skill.header = { skillTreeButton: header }; header.setSkill(skill); skillTreeMenu.createDropdownItem(skill);
    return { skill, tree: skill.tree, header: header.viewBtn, entry: skillTreeMenu.dropdownItemMap.get(skill).parentElement };
  };
  const glows = node => node.classes.has("kroky-skill-tree-ready");
  return { game, state, hooks, sidebar, head, add, glows, Header, Menu };
}

test("point gain and purchases update all three cached targets and aggregate multiple skills", () => {
  const m = fixture(), a = m.add("Mining", 0), b = m.add("Fishing", 0); m.hooks.character();
  assert.equal(a.tree.checks, 0); assert.equal(b.tree.checks, 0, "positive minimum skips zero-point helpers");
  const headerClick = a.header.onclick, entryClick = a.entry.onclick, style = { ...a.header.style };
  assert.equal(a.tree.addPoints(1), "native-points");
  for (const node of [a.header, a.entry, m.sidebar]) assert.equal(m.glows(node), true);
  b.tree.addPoints(1); a.tree.unlockNode(a.tree.nodes.allObjects[0]);
  assert.equal(m.glows(a.header), false); assert.equal(m.glows(a.entry), false); assert.equal(m.glows(m.sidebar), true);
  b.tree.unlockNode(b.tree.nodes.allObjects[0]); assert.equal(m.glows(m.sidebar), false);
  assert.equal(a.header.onclick, headerClick); assert.equal(a.entry.onclick, entryClick); assert.deepEqual(a.header.style, style);
  assert.equal(a.header.classes.has("native-class"), true); assert.equal(m.state.lookups, 1);
});

test("saved points initialize readiness, zero-cost nodes are checked, and nonzero unaffordable points do not glow", () => {
  const m = fixture(), blocked = m.add("Blocked", 2, [{ id: "old", points: 1, unlocked: true }, { id: "next", points: 4, parents: ["old"] }]), free = m.add("Free", 0, [{ id: "free", points: 0 }]);
  m.hooks.character(); assert.equal(m.glows(blocked.header), false); assert.equal(m.glows(free.header), true); assert.equal(free.tree.checks, 1);
  const toggles = free.header.toggles; m.hooks.ready(); assert.equal(free.header.toggles, toggles);
  blocked.tree.addPoints(2); assert.equal(m.glows(blocked.entry), true);
});

test("vanilla trees add no bank/currency/requirement listeners and native render loops do not scan", () => {
  const m = fixture(), skills = Array.from({ length: 26 }, (_, index) => m.add(String(index), index === 0 ? 1 : 0)); m.hooks.character();
  assert.equal(m.game.bank.events.size, 0); assert.equal(m.game.currencies[0].events.size, 0); assert.equal(m.game.events.size, 0);
  const checks = skills.map(({ tree }) => tree.checks), lookups = m.state.lookups, toggles = m.sidebar.toggles;
  for (let frame = 0; frame < 50; frame++) { skillTreeMenu.render(); m.game.bank.emit("itemChanged"); m.game.currencies[0].emit("amountChanged"); }
  assert.deepEqual(skills.map(({ tree }) => tree.checks), checks); assert.equal(m.state.lookups, lookups); assert.equal(m.sidebar.toggles, toggles);
});

test("modded item/currency costs and requirements refresh only from their events after complete purchases", () => {
  const m = fixture(); m.state.requirements = false;
  const a = m.add("Modded", 0, [{ id: "free", points: 0, items: 4, currency: 3, requirement: true }]); m.hooks.character();
  assert.equal(m.glows(a.header), false); m.state.requirements = true; m.game.emit("requirementChange"); assert.equal(m.glows(a.header), true);
  m.game.bank.amount = 0; m.game.bank.emit("itemChanged"); assert.equal(m.glows(a.header), false);
  m.game.bank.amount = 10; m.game.currencies[0].amount = 0; m.game.currencies[0].emit("amountChanged"); assert.equal(m.glows(a.header), false);
  m.game.currencies[0].amount = 10; m.game.currencies[0].emit("amountChanged"); assert.equal(m.glows(a.header), true);
  const checks = a.tree.checks; assert.equal(a.tree.unlockNode(a.tree.nodes.allObjects[0]), "native-unlock");
  assert.equal(a.tree.checks, checks + 1, "purchase resource/requirement events coalesce until native completion");
  assert.equal(m.game.bank.amount, 6); assert.equal(m.game.currencies[0].amount, 7); assert.equal(m.glows(a.entry), false);
});

test("modded requirements use their own native event handler without a generic requirement event", () => {
  const m = fixture(); m.state.requirements = false;
  const requirement = { assignHandler(callback) { m.game.bank.on("itemFound", callback); } };
  const a = m.add("Discovery", 1, [{ id: "found", requirement }]); m.hooks.character();
  assert.equal(m.glows(a.header), false); assert.equal(m.game.events.size, 0);
  assert.equal(m.game.bank.events.has("itemChanged"), false);
  m.state.requirements = true; m.game.bank.emit("itemFound"); assert.equal(m.glows(a.header), true);
  m.state.requirements = false; m.game.bank.emit("itemFound"); assert.equal(m.glows(a.header), false);
});

test("later native header/dropdown bindings inherit cached readiness without callback overrides", () => {
  const m = fixture(), a = m.add("Mining", 1); m.hooks.character();
  const header = new m.Header(); assert.equal(header.setSkill(a.skill), "native-header"); assert.equal(m.glows(header.viewBtn), true);
  const menu = new m.Menu(); assert.equal(menu.createDropdownItem(a.skill), "native-entry");
  const link = menu.dropdownItemMap.get(a.skill).parentElement; assert.equal(m.glows(link), true);
  header.viewBtn.onclick(); link.onclick(); assert.equal(a.skill.opened, 2); assert.equal(m.state.lookups, 1);
});

test("QuickLoad and character/interface initialization reset saved readiness without polling", () => {
  const m = fixture(), a = m.add("Mining", 1); m.hooks.character(); assert.equal(m.glows(m.sidebar), true);
  m.state.decode = () => { a.tree.points = 0; }; assert.equal(m.game.decode(), "native-decode");
  assert.equal(m.glows(a.header), false); assert.equal(m.glows(a.entry), false); assert.equal(m.glows(m.sidebar), false);
  a.tree.points = 1; m.hooks.character(); m.hooks.ready(); assert.equal(m.glows(m.sidebar), true); assert.equal(m.state.lookups, 1);
});

test("cosmetic refresh and logging failures never replace native point/purchase behavior or errors", () => {
  const m = fixture(), a = m.add("Mining", 3); m.hooks.character();
  const nativeError = new Error("Native purchase failed"), uiError = new Error("Glow check failed");
  a.tree.failCheck = uiError; a.tree.nodes.allObjects[0].fail = nativeError;
  assert.throws(() => a.tree.unlockNode(a.tree.nodes.allObjects[0]), error => error === nativeError);
  assert.equal(a.tree.nodes.allObjects[0].isUnlocked, true); assert.equal(a.tree.points, 2); assert.equal(m.state.logs[0][1], uiError);
  console.error = () => { throw new Error("Console failed"); }; assert.equal(a.tree.addPoints(1), "native-points"); assert.equal(a.tree.points, 3);
});

test("the gold external pulse changes only pseudo opacity and supports reduced motion", () => {
  const m = fixture(), css = m.head.children[0].textContent;
  assert.match(css, /outline: 2px solid #daa664/); assert.match(css, /box-shadow: 0 0 10px 6px rgba\(218,166,100,\.75\)/);
  assert.match(css, /1\.4s ease-in-out infinite/); assert.match(css, /0%,100% \{ opacity: \.5; \} 50% \{ opacity: 1;/);
  assert.match(css, /pointer-events: none/); assert.match(css, /prefers-reduced-motion: reduce/); assert.match(css, /animation: none; opacity: 1/);
  assert.match(css, /a\.kroky-skill-tree-ready::after \{ inset: 4px 6px; border-radius: 4px; \}/);
  assert.doesNotMatch(css.match(/box-shadow:[^;]+/)?.[0] ?? "", /inset/);
});
