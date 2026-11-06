import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBackgroundRendering } from "../background-rendering.mjs";

afterEach(() => { delete globalThis.document; delete globalThis.customElements; delete globalThis.mod; delete globalThis.SplashManager; delete globalThis.numberWithCommas; });
const thievingMethods = ["renderMenu", "renderProgressBar", "renderStopButton", "renderNPCUnlock", "renderAreaRealmVisibility"];
function fixture() {
  const calls = { value: 0, tabValue: 0, icons: 0, runes: 0, tokens: 0, nav: 0, sidebar: 0, before: [], after: [] }, hooks = {};
  let menu;
  class Game { decode() { return "decoded"; } }
  const game = new Game();
  game.openPage = { containerID: "woodcutting-container" }; game.enableRendering = true; game._isInOnlineLoop = true;
  class Bank {
    constructor() { this.renderQueue = { items: new Set(), bankValue: false, space: false }; }
    getTabValue() { calls.tabValue++; return "tab value"; }
    getBankValue() { calls.value++; return "bank value"; }
    render() {
      if (this.renderQueue.items.size) {
        for (const item of this.renderQueue.items) {
          calls.icons++;
          const bankItem = this.items?.get(item), icon = menu.itemIcons?.get(item);
          if (bankItem && icon) icon.updateQuantity(bankItem, game.settings.enableAccessibility);
          else if (bankItem && menu.addItemToEndofTab) menu.addItemToEndofTab(this, bankItem);
          else if (icon && menu.removeItemFromTab) menu.removeItemFromTab(item);
          if (bankItem && this.selectedBankItem?.item === item) calls.selected = (calls.selected ?? 0) + 1;
          if (item === "Rune" || item.type === "Rune") calls.runes++;
          if (item === "Token" || item.type === "Token") calls.tokens++;
        }
        this.renderQueue.bankValue = this.renderQueue.space = true;
        this.renderQueue.items.clear();
      }
      if (this.renderQueue.bankValue) { menu.updateBankValue(this); this.renderQueue.bankValue = false; }
      if (this.renderQueue.space) { calls.nav++; this.renderQueue.space = false; }
      if (this.failRender) throw new Error("native bank render failed");
      return "bank render";
    }
  }
  class BankMenu {
    updateBankValue(bank, marker) {
      bank.getTabValue(); bank.getBankValue();
      this.lastMarker = marker;
      return "painted bank values";
    }
  }
  class Thieving {
    constructor() { this.renderQueue = Object.fromEntries(thievingMethods.map(method => [method, true])); this.paints = []; }
    render() { calls.sidebar++; for (const method of thievingMethods) this[method](); }
  }
  for (const method of thievingMethods) Thieving.prototype[method] = function (marker) {
    if (!this.renderQueue[method]) return;
    this.paints.push([method, marker]); this.renderQueue[method] = false;
    return `painted ${method}`;
  };
  game.bank = new Bank(); game.thieving = new Thieving(); menu = new BankMenu();
  const nativeRoot = { visibilityState: "visible", getElementById: id => id === "bank-tab-menu" ? menu : null };
  globalThis.document = nativeRoot;
  globalThis.customElements = { get: name => name === "bank-tab-menu" ? BankMenu : undefined };
  const pipelines = new WeakMap();
  const ctx = {
    onCharacterLoaded(callback) { hooks.character = callback; }, onInterfaceReady(callback) { hooks.interface = callback; },
    patch(Class, method) {
      let methods = pipelines.get(Class); if (!methods) { methods = new Map(); pipelines.set(Class, methods); }
      let pipeline = methods.get(method);
      if (!pipeline) {
        pipeline = { original: Class.prototype[method], before: [], after: [], replace: [] }; methods.set(method, pipeline);
        Class.prototype[method] = function (...args) {
          for (const before of pipeline.before) { const next = before.apply(this, args); if (Array.isArray(next)) args = next; }
          let index = pipeline.replace.length;
          const next = (...values) => --index < 0 ? pipeline.original.apply(this, values) : pipeline.replace[index].call(this, next, ...values);
          const result = next(...args);
          for (const after of pipeline.after) after.call(this, result, ...args);
          return result;
        };
      }
      return { replace: callback => pipeline.replace.push(callback), before: callback => pipeline.before.push(callback), after: callback => pipeline.after.push(callback) };
    },
  };
  const flush = installBackgroundRendering(ctx, game);
  return { game, menu, Bank, BankMenu, Thieving, calls, hooks, ctx, flush, document: nativeRoot,
    open(containerID) { game.openPage = { containerID, ...(containerID === "thieving-container" ? { action: game.thieving } : {}) }; } };
}

test("hidden Bank value calculation is deferred while item icons, rune counts, mastery tokens and sidebar space retain native behavior", () => {
  const f = fixture(); f.hooks.interface();
  f.game.bank.renderQueue.items.add("Rune"); f.game.bank.renderQueue.items.add("Token");
  assert.equal(f.game.bank.render(), "bank render");
  assert.equal(f.calls.value, 0); assert.equal(f.calls.tabValue, 0);
  assert.equal(f.calls.icons, 2); assert.equal(f.calls.runes, 1); assert.equal(f.calls.tokens, 1); assert.equal(f.calls.nav, 1);
  assert.equal(f.game.bank.renderQueue.items.size, 0); assert.equal(f.game.bank.renderQueue.space, false); assert.equal(f.game.bank.renderQueue.bankValue, true);
  for (let i = 0; i < 20; i++) f.game.bank.render();
  assert.equal(f.calls.value, 0); assert.equal(f.calls.nav, 1); assert.equal(f.game.bank.renderQueue.bankValue, true);
  f.open("bank-container"); f.flush();
  assert.equal(f.calls.value, 1); assert.equal(f.calls.tabValue, 1); assert.equal(f.game.bank.renderQueue.bankValue, false);
  f.flush(); f.game.bank.render(); assert.equal(f.calls.value, 1, "catch-up is not repeated after native flags are cleared");
});

test("only Thieving's five page-specific renderers defer, retain their flags and replay through current public methods before paint", () => {
  const f = fixture(); f.hooks.interface(); f.game.thieving.render();
  assert.equal(f.calls.sidebar, 1); assert.deepEqual(f.game.thieving.paints, []);
  assert.ok(Object.values(f.game.thieving.renderQueue).every(Boolean));
  for (const method of thievingMethods) f.game.thieving[method]("first");
  for (const method of thievingMethods) f.game.thieving[method]("latest");
  for (const method of thievingMethods) {
    f.ctx.patch(f.Thieving, method).before(function (marker) { f.calls.before.push([method, marker]); });
    f.ctx.patch(f.Thieving, method).after(function (_result, marker) { f.calls.after.push([method, marker]); });
  }
  f.open("thieving-container"); f.flush();
  assert.deepEqual(f.game.thieving.paints, thievingMethods.map(method => [method, "latest"]));
  assert.deepEqual(f.calls.before, thievingMethods.map(method => [method, "latest"]));
  assert.deepEqual(f.calls.after, thievingMethods.map(method => [method, "latest"]));
  f.flush(); f.game.thieving.render(); assert.equal(f.game.thieving.paints.length, 5);
});

test("initialization, unknown pages, Golbin Raid and foreign instances keep native rendering", () => {
  const f = fixture();
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render(); assert.equal(f.calls.value, 1);
  f.game.thieving.render(); assert.equal(f.game.thieving.paints.length, 5);
  f.hooks.interface(); f.game.openPage = undefined;
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render(); assert.equal(f.calls.value, 2);
  f.open("woodcutting-container"); f.game.isGolbinRaid = true;
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render(); assert.equal(f.calls.value, 3);
  f.game.isGolbinRaid = false;
  const foreign = new f.Bank(); f.menu.updateBankValue(foreign); assert.equal(f.calls.value, 4);
  const foreignMenu = new f.BankMenu(); foreignMenu.updateBankValue(f.game.bank); assert.equal(f.calls.value, 5);
  const foreignThieving = new f.Thieving(); foreignThieving.render(); assert.equal(foreignThieving.paints.length, 5);
});

test("hidden, offline and rendering-disabled states retain pending values until visible online rendering resumes", () => {
  for (const mode of ["hidden", "offline", "disabled"]) {
    const f = fixture(); f.hooks.interface(); f.open("bank-container");
    if (mode === "hidden") f.document.visibilityState = "hidden";
    if (mode === "offline") f.game._isInOnlineLoop = false;
    if (mode === "disabled") f.game.enableRendering = false;
    f.game.bank.renderQueue.bankValue = true; f.game.bank.render(); f.flush();
    assert.equal(f.calls.value, 0); assert.equal(f.game.bank.renderQueue.bankValue, true);
    f.document.visibilityState = "visible"; f.game._isInOnlineLoop = true; f.game.enableRendering = true;
    f.flush(); assert.equal(f.calls.value, 1); assert.equal(f.game.bank.renderQueue.bankValue, false);
  }
});

test("decode and character loading discard stale pending calls, and current realm changes replay only the latest model", () => {
  for (const reset of ["decode", "character"]) {
    const f = fixture(); f.hooks.interface();
    f.game.thieving.renderMenu("old character"); f.game.bank.renderQueue.bankValue = true; f.game.bank.render();
    if (reset === "decode") assert.equal(f.game.decode(), "decoded"); else f.hooks.character();
    f.game.thieving.renderQueue.renderMenu = false; f.game.bank.renderQueue.bankValue = false;
    f.open("thieving-container"); f.hooks.interface(); f.flush(); assert.deepEqual(f.game.thieving.paints, []);
    f.open("bank-container"); f.flush(); assert.equal(f.calls.value, 0);
    f.open("woodcutting-container"); f.game.thieving.renderQueue.renderMenu = true;
    f.game.thieving.realm = "Melvor"; f.game.thieving.renderMenu("pending"); f.game.thieving.realm = "Abyssal";
    f.ctx.patch(f.Thieving, "renderMenu").after(function () { f.calls.realm = this.realm; });
    f.open("thieving-container"); f.flush(); assert.equal(f.calls.realm, "Abyssal");
  }
});

test("native errors stay visible and an aborted Bank render retains deferred values for the next visible render", () => {
  const f = fixture(); f.hooks.interface(); f.game.bank.renderQueue.bankValue = true; f.game.bank.failRender = true;
  assert.throws(() => f.game.bank.render(), /native bank render failed/);
  assert.equal(f.game.bank.renderQueue.bankValue, true); assert.equal(f.calls.value, 0);
  f.game.bank.failRender = false; f.open("bank-container"); f.flush(); assert.equal(f.calls.value, 1);
});
test("QuickLoad and later character callbacks retain guards after the interface is ready without another interface-ready event", () => {
  const f = fixture();
  f.game.decode(); f.hooks.character();
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render();
  assert.equal(f.calls.value, 1, "first-load initialization stays native before interface readiness");
  f.hooks.interface();
  f.game.thieving.renderMenu("old pending call");
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render();
  assert.equal(f.calls.value, 1);
  f.game.decode();
  f.game.thieving.renderQueue.renderMenu = false;
  f.open("thieving-container"); f.flush(); assert.deepEqual(f.game.thieving.paints, []);
  f.open("woodcutting-container");
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render();
  assert.equal(f.calls.value, 1, "decode re-arms the existing interface's guards");
  f.hooks.character();
  f.game.bank.renderQueue.bankValue = true; f.game.bank.render();
  assert.equal(f.calls.value, 1, "a later character callback keeps the ready interface guarded");
  f.open("bank-container"); f.flush();
  assert.equal(f.calls.value, 2); assert.equal(f.game.bank.renderQueue.bankValue, false);
});
test("a foreign Game decode does not clear or suspend the current character's pending rendering", () => {
  const f = fixture(); f.hooks.interface();
  f.game.thieving.renderMenu("current character");
  const foreign = new f.game.constructor(); assert.equal(foreign.decode(), "decoded");
  f.open("thieving-container"); f.flush();
  assert.deepEqual(f.game.thieving.paints, [["renderMenu", "current character"]]);
});
test("optional ETA skips only the current game's combined Woodcutting forecast when Workforce hides its native panel", () => {
  const f = fixture(), tree = { id: "Tree" }, actions = [tree];
  f.game.woodcutting = { id: "Woodcutting" }; f.game.agility = { id: "Agility" }; f.game.currentGamemode = { enableInstantActions: false };
  let hiddenPanel = false;
  const getElement = f.document.getElementById;
  f.document.getElementById = id => id === "woodcutting-grants" ? { closest: selector => selector === ".kroky-activity-native-panel" && hiddenPanel ? {} : null } : getElement(id);
  class ETA {
    constructor(game) { this.game = game; this.calls = []; this.singleCalls = 0; }
    computeAndInjectMultiHTML(skill, selected, injectSubCalcs) { this.calls.push([skill, selected, injectSubCalcs]); return "native combined result"; }
    computeAndInjectHTML() { this.singleCalls++; return "native tree result"; }
  }
  f.hooks.interface(); f.flush();
  const first = new ETA(f.game); globalThis.mod = { api: { ETA: { ETA: first } } };
  f.flush(); f.flush();
  assert.equal(first.computeAndInjectMultiHTML(f.game.woodcutting, actions, false), "native combined result");
  hiddenPanel = true;
  assert.equal(first.computeAndInjectMultiHTML(f.game.woodcutting, actions, false), undefined);
  assert.equal(first.calls.length, 1, "the hidden native combined panel does not launch a forecast");
  assert.equal(first.computeAndInjectHTML(f.game.woodcutting, tree), "native tree result"); assert.equal(first.singleCalls, 1);
  assert.equal(first.computeAndInjectMultiHTML(f.game.agility, actions, true), "native combined result");
  f.game.isGolbinRaid = true; first.computeAndInjectMultiHTML(f.game.woodcutting, actions, false); f.game.isGolbinRaid = false;
  f.game.currentGamemode.enableInstantActions = true; first.computeAndInjectMultiHTML(f.game.woodcutting, actions, false); f.game.currentGamemode.enableInstantActions = false;
  const foreign = new ETA({}); foreign.computeAndInjectMultiHTML(f.game.woodcutting, actions, false); assert.equal(foreign.calls.length, 1);
  const replacement = new ETA(f.game); mod.api.ETA.ETA = replacement;
  first.computeAndInjectMultiHTML(f.game.woodcutting, actions, false); assert.equal(first.calls.length, 5, "replaced provider instances retain native behavior");
  assert.equal(replacement.computeAndInjectMultiHTML(f.game.woodcutting, actions, false), undefined);
  hiddenPanel = false;
  assert.equal(replacement.computeAndInjectMultiHTML(f.game.woodcutting, actions, false), "native combined result");
  assert.equal(replacement.calls[0][1], actions); assert.equal(replacement.calls[0][2], false);
  delete mod.api.ETA;
  replacement.computeAndInjectMultiHTML(f.game.woodcutting, actions, false); assert.equal(replacement.calls.length, 2);
});
const headerMethods = ["updateXP", "updateLevel", "updateAbyssalXP", "updateAbyssalLevel"];
function headerFixture(id = "Smithing", containerID = "smithing-container") {
  const f = fixture(), roots = new Map();
  for (const name of [containerID, "woodcutting-container", "combat-container", "farming-container", "altmagic-container"])
    roots.set(name, { contains: header => header.root === roots.get(name) });
  const skill = { id, xp: 10, level: 1, abyssalXP: 20, abyssalLevel: 1, previousLevel: 1, previousAbyssalLevel: 1 };
  const skills = new Map([[id, skill]]), pages = new Map([[skill, [{ containerID }]]]);
  f.game.skills = { getObjectByID: key => skills.get(key) }; f.game.getPagesForSkill = target => pages.get(target);
  class Header {
    constructor(target = skill) { this.skillID = target.id; this.root = roots.get(containerID); this.isConnected = true; this.writes = []; this.text = {}; }
    getAttribute(name) { return name === "data-skill-id" ? this.skillID : null; }
    closest() { return this.inModal ? {} : null; }
    setSkill(target) { this.skillID = target.id; target.header = this; this.bound = target; }
  }
  for (const [method, field] of headerMethods.map((method, index) => [method, ["xp", "level", "abyssalXP", "abyssalLevel"][index]])) {
    Header.prototype[method] = function (game, target) {
      if (this.fail) throw new Error("native header failed");
      this.argumentGame = game; this.writes.push([method, target[field]]); this.text[field] = target[field]; return `painted ${method}`;
    };
  }
  const getClass = customElements.get;
  customElements.get = name => name === "skill-header" ? Header : getClass(name);
  const getElement = f.document.getElementById;
  f.document.getElementById = key => roots.get(key) ?? getElement(key);
  const header = new Header(); header.setSkill(skill);
  skill.render = function () {
    f.calls.sidebar++;
    if (this.level > this.previousLevel) { f.calls.levelUps = (f.calls.levelUps ?? 0) + 1; this.previousLevel = this.level; }
    if (this.abyssalLevel > this.previousAbyssalLevel) { f.calls.abyssalLevelUps = (f.calls.abyssalLevelUps ?? 0) + 1; this.previousAbyssalLevel = this.abyssalLevel; }
    for (const method of headerMethods) this.header[method](f.game, this);
  };
  return { ...f, skill, header, Header, roots, skills, pages, containerID };
}

test("hidden owned skill headers defer four DOM sinks while native model, sidebar and level-up updates continue", () => {
  const f = headerFixture(); f.hooks.interface();
  f.skill.xp = 100; f.skill.level = 2; f.skill.abyssalXP = 200; f.skill.abyssalLevel = 3;
  f.skill.render(); f.skill.render();
  assert.deepEqual(f.header.writes, []); assert.equal(f.calls.sidebar, 2);
  assert.equal(f.calls.levelUps, 1); assert.equal(f.calls.abyssalLevelUps, 1);
  f.skill.xp = 123; f.skill.level = 4; f.skill.abyssalXP = 456; f.skill.abyssalLevel = 5;
  const pipeline = [];
  f.ctx.patch(f.Header, "updateXP").before(function (game, skill) { assert.equal(game, f.game); assert.equal(skill, f.skill); pipeline.push("before"); });
  f.ctx.patch(f.Header, "updateXP").after(function (result) { assert.equal(result, "painted updateXP"); pipeline.push("after"); });
  f.open(f.containerID); f.flush();
  assert.deepEqual(f.header.text, { xp: 123, level: 4, abyssalXP: 456, abyssalLevel: 5 });
  assert.equal(f.header.writes.length, 4); assert.deepEqual(pipeline, ["before", "after"]);
  assert.equal(f.calls.levelUps, 1); assert.equal(f.calls.abyssalLevelUps, 1);
  f.flush(); assert.equal(f.header.writes.length, 4, "catch-up uses the latest model once rather than replaying every hidden update");
});

test("header visibility uses native page containment for Alt. Magic and Farming, including headers inside an open modal", () => {
  for (const [id, containerID] of [["Magic", "altmagic-container"], ["Farming", "farming-container"]]) {
    const f = headerFixture(id, containerID); f.hooks.interface();
    assert.equal(f.game.openPage.action, undefined);
    f.header.updateXP(f.game, f.skill); assert.equal(f.header.writes.length, 0);
    f.open(containerID); assert.equal(f.game.openPage.action, undefined); f.flush();
    assert.equal(f.header.writes.length, 1);
    f.open("combat-container"); f.header.inModal = true;
    f.header.updateXP(f.game, f.skill); assert.equal(f.header.writes.length, 2, "an open modal remains a visible consumer on another page");
  }
});

test("unknown, disconnected, foreign, replacement and custom HUD headers retain native behavior", () => {
  for (const mode of ["unknown", "disconnected", "foreign skill", "replacement", "custom HUD", "missing pages", "wrong metadata"]) {
    const f = headerFixture(); f.hooks.interface();
    let target = f.skill;
    if (mode === "unknown") f.skills.clear();
    if (mode === "disconnected") f.header.isConnected = false;
    if (mode === "foreign skill") target = { ...f.skill };
    if (mode === "replacement") f.skill.header = new f.Header();
    if (mode === "custom HUD") f.header.root = {};
    if (mode === "missing pages") f.pages.clear();
    if (mode === "wrong metadata") f.header.skillID = "Unknown";
    assert.equal(f.header.updateXP(f.game, target), "painted updateXP", mode);
    assert.equal(f.header.writes.length, 1);
  }
  const f = headerFixture(); f.hooks.interface();
  const foreign = new f.game.constructor();
  assert.equal(f.header.updateXP(foreign, f.skill), "painted updateXP");
  assert.equal(f.header.argumentGame, foreign); assert.equal(f.header.writes.length, 1);
});

test("rebinding headers and character loads discard stale work, while current visible header errors remain native", () => {
  for (const reset of ["rebind", "replace", "decode", "character"]) {
    const f = headerFixture(); f.hooks.interface(); f.header.updateXP(f.game, f.skill);
    if (reset === "rebind") {
      const other = { ...f.skill, id: "Other" }; f.skills.set(other.id, other); f.header.setSkill(other);
      assert.equal(f.header.bound, other, "setSkill remains native");
    }
    if (reset === "replace") f.skill.header = new f.Header();
    if (reset === "decode") f.game.decode();
    if (reset === "character") f.hooks.character();
    f.open(f.containerID); f.flush(); assert.deepEqual(f.header.writes, [], reset);
  }
  const f = headerFixture(); f.hooks.interface(); f.header.updateXP(f.game, f.skill);
  f.open(f.containerID); f.header.fail = true;
  assert.throws(() => f.flush(), /native header failed/);
  f.header.fail = false; f.skill.xp = 321; f.flush(); assert.equal(f.header.text.xp, 321);
  f.game.isGolbinRaid = true; f.open("woodcutting-container");
  f.header.updateLevel(f.game, f.skill); assert.equal(f.header.text.level, f.skill.level);
});
function splashFixture() {
  const f = fixture(), scheduled = [], containers = new Map();
  let combatHidden = true, layoutReads = 0;
  const root = { classList: { contains: name => name === "d-none" && combatHidden } };
  const makeContainer = id => {
    const node = { id, children: [], appendChild(child) { this.children.push(child); }, removeChild(child) { this.children.splice(this.children.indexOf(child), 1); } };
    Object.defineProperty(node, "offsetParent", { get() { layoutReads++; return combatHidden ? null : root; } });
    return node;
  };
  for (const id of ["combat-player-splash-container", "combat-enemy-splash-container"]) containers.set(id, makeContainer(id));
  const getElement = f.document.getElementById;
  f.document.getElementById = id => id === "combat-container" ? root : containers.get(id) ?? getElement(id);
  // Match the native damageSplash.js?12097 queue, layout-read and scheduled-paint boundaries.
  globalThis.SplashManager = class SplashManager {
    constructor(container) { this.container = container; this.queue = []; this.maxSplashes = 10; this.splashDelay = 200; }
    add(splash) { if (!f.game.settings.enableCombatDamageSplashes) return; this.queue.push(splash); if (this.queue.length > this.maxSplashes) this.queue.shift(); }
    render() {
      if (this.container.offsetParent === null) return;
      this.queue.forEach((splash, i) => scheduled.push({ run: () => this.renderSplash(splash), delay: i * this.splashDelay }));
      this.queue = [];
    }
    renderSplash(splash) {
      const node = { textContent: splash.text ?? String(splash.amount), source: splash.source, left: `${splash.xOffset}%` };
      this.container.appendChild(node); node.onanimationend = () => this.container.removeChild(node);
    }
  };
  const character = id => ({
    hitpoints: 100, stats: { unchanged: true }, renderQueue: { damageSplash: false, hitpoints: false },
    splashManager: new SplashManager(containers.get(id)),
    damage(amount) { this.hitpoints -= amount; this.renderQueue.hitpoints = this.renderQueue.damageSplash = true; this.splashManager.add({ amount: -amount, source: "Attack", xOffset: this.hitpoints }); },
    renderDamageSplashes() { this.splashManager.render(); this.renderQueue.damageSplash = false; },
  });
  f.game.settings = { enableCombatDamageSplashes: true }; f.game.combat = { player: character("combat-player-splash-container"), enemy: character("combat-enemy-splash-container") };
  return { ...f, scheduled, containers, makeContainer, root, get layoutReads() { return layoutReads; },
    showCombat() { combatHidden = false; f.open("combat-container"); }, hideCombat() { combatHidden = true; f.open("woodcutting-container"); } };
}

test("hidden main Combat splashes discard only visual queues without layout reads, scheduled paints or damage/model changes", () => {
  const f = splashFixture(); f.hooks.interface();
  for (const character of [f.game.combat.player, f.game.combat.enemy]) {
    character.damage(12); character.damage(3);
    assert.equal(character.hitpoints, 85); assert.equal(character.splashManager.queue.length, 2);
    character.renderDamageSplashes();
    assert.equal(character.splashManager.queue.length, 0); assert.equal(character.renderQueue.damageSplash, false);
    assert.equal(character.hitpoints, 85); assert.equal(character.renderQueue.hitpoints, true); assert.deepEqual(character.stats, { unchanged: true });
  }
  assert.equal(f.layoutReads, 0); assert.equal(f.scheduled.length, 0);
  assert.equal(f.game.settings.enableCombatDamageSplashes, true);
  f.showCombat(); f.game.combat.player.renderDamageSplashes();
  assert.equal(f.scheduled.length, 0, "opening Combat does not replay hidden damage splashes");
  f.game.combat.player.damage(7); f.game.combat.player.renderDamageSplashes();
  assert.equal(f.scheduled.length, 1); f.scheduled[0].run();
  const container = f.containers.get("combat-player-splash-container");
  assert.equal(container.children[0].textContent, "-7"); assert.equal(f.game.combat.player.hitpoints, 78);
  container.children[0].onanimationend(); assert.equal(container.children.length, 0);
});

test("scheduled main-page splashes stop painting after the Combat page hides, while current visible splashes stay native", () => {
  const f = splashFixture(); f.hooks.interface(); f.showCombat();
  const player = f.game.combat.player; player.damage(5); player.damage(6); player.renderDamageSplashes();
  assert.equal(f.scheduled.length, 2); assert.deepEqual(f.scheduled.map(job => job.delay), [0, 200]);
  f.hideCombat(); f.scheduled.forEach(job => job.run());
  assert.equal(f.containers.get("combat-player-splash-container").children.length, 0);
  assert.equal(player.splashManager.queue.length, 0); assert.equal(player.hitpoints, 89);
});

test("splash initialization, Raid, foreign managers, unknown containers and unavailable render contexts retain native behavior", () => {
  const initial = splashFixture(); initial.game.combat.player.damage(1); initial.game.combat.player.renderDamageSplashes(); assert.equal(initial.layoutReads, 1);
  for (const mode of ["Raid", "foreign manager", "foreign container", "unknown page", "hidden document", "offline", "rendering disabled", "Combat action"]) {
    const f = splashFixture(); f.hooks.interface();
    let manager = f.game.combat.player.splashManager;
    if (mode === "Raid") f.game.isGolbinRaid = true;
    if (mode === "foreign manager") manager = new SplashManager(f.containers.get("combat-player-splash-container"));
    if (mode === "foreign container") manager.container = f.makeContainer("notification-splash-container");
    if (mode === "unknown page") f.game.openPage = undefined;
    if (mode === "hidden document") f.document.visibilityState = "hidden";
    if (mode === "offline") f.game._isInOnlineLoop = false;
    if (mode === "rendering disabled") f.game.enableRendering = false;
    if (mode === "Combat action") f.game.openPage.action = f.game.combat;
    manager.add({ amount: -1, source: "Attack", xOffset: 90 }); manager.render();
    assert.equal(f.layoutReads, 1, mode); assert.equal(manager.queue.length, 1, "native hidden-container retention remains outside the narrow main-page guard");
    manager.renderSplash({ amount: -2, source: "Attack", xOffset: 80 }); assert.equal(manager.container.children.length, 1, mode);
  }
});
function bankQuantityFixture() {
  const f = fixture();
  globalThis.numberWithCommas = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const spaceNode = () => {
    let text = "", writes = 0; const classes = new Set();
    return { get textContent() { return text; }, set textContent(value) { text = value; writes++; }, get writes() { return writes; },
      classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) } };
  };
  f.Bank.prototype.updateSpaceElement = function (element) {
    f.calls.space = (f.calls.space ?? 0) + 1;
    element.textContent = `${numberWithCommas(this.occupiedSlots)} / ${numberWithCommas(this.maximumSlots)}`;
    this.occupiedSlots >= this.maximumSlots ? element.classList.add("text-danger") : element.classList.remove("text-danger");
  };
  f.game.bank.occupiedSlots = 1234; f.game.bank.maximumSlots = 2648;
  f.game.settings = { enableAccessibility: false }; f.game.bank.items = new Map();
  f.menu.itemIcons = new Map(); f.menu.contains = icon => icon.parentMenu === f.menu;
  class BankIcon {
    constructor() { this.isConnected = true; this.parentMenu = f.menu; this.itemID = undefined; this.quantity = spaceNode(); this.nativeUpdates = 0; }
    getAttribute(name) { return name === "data-item-id" ? this.itemID : null; }
    setItem(bank, bankItem) {
      this.updateQuantity(bankItem, f.game.settings.enableAccessibility);
      this.itemID = bankItem.item.id; this.item = bankItem.item;
      this.onclick = () => { f.calls.selectedClick = this.item; };
    }
    updateQuantity(bankItem, enableAccessibility) {
      this.nativeUpdates++;
      const text = enableAccessibility ? ` ${bankItem.item.name}` : "";
      this.quantity.textContent = `${bankItem.quantity}${text}`;
      this.onmouseenter = () => { this.quantity.textContent = numberWithCommas(bankItem.quantity) + text; };
      this.onmouseleave = () => { this.quantity.textContent = `${bankItem.quantity}${text}`; };
    }
  }
  const getClass = customElements.get;
  customElements.get = name => name === "bank-item-icon" ? BankIcon : getClass(name);
  f.BankMenu.prototype.addItemToEndofTab = function (bank, bankItem) {
    const icon = new BankIcon(); icon.setItem(bank, bankItem); this.itemIcons.set(bankItem.item, icon); return icon;
  };
  f.BankMenu.prototype.removeItemFromTab = function (item) {
    const icon = this.itemIcons.get(item); icon.isConnected = false; this.itemIcons.delete(item);
  };
  const add = (id, quantity = 1, type = "Rune") => {
    const item = { id, name: id, type }, bankItem = { bank: f.game.bank, item, quantity };
    f.game.bank.items.set(item, bankItem); const icon = f.menu.addItemToEndofTab(f.game.bank, bankItem);
    return { item, bankItem, icon };
  };
  return { ...f, BankIcon, spaceNode, add };
}

test("owned Bank space labels skip only identical comma-formatted text and danger state while capacity changes remain native", () => {
  const f = bankQuantityFixture(); f.hooks.interface(); const node = f.spaceNode();
  f.game.bank.updateSpaceElement(node); assert.equal(node.textContent, "1,234 / 2,648"); assert.equal(node.writes, 1);
  for (let i = 0; i < 10; i++) f.game.bank.updateSpaceElement(node);
  assert.equal(node.writes, 1); assert.equal(f.calls.space, 1);
  node.classList.add("text-danger"); f.game.bank.updateSpaceElement(node);
  assert.equal(node.classList.contains("text-danger"), false); assert.equal(node.writes, 2);
  f.game.bank.maximumSlots = 1234; f.game.bank.updateSpaceElement(node);
  assert.equal(node.textContent, "1,234 / 1,234"); assert.equal(node.classList.contains("text-danger"), true);
  f.game.bank.maximumSlots = 3000; f.game.bank.updateSpaceElement(node);
  assert.equal(node.textContent, "1,234 / 3,000"); assert.equal(node.classList.contains("text-danger"), false);
  const foreign = new f.Bank(); foreign.occupiedSlots = 1234; foreign.maximumSlots = 3000;
  const before = node.writes; foreign.updateSpaceElement(node); foreign.updateSpaceElement(node); assert.equal(node.writes, before + 2);
});

test("owned hidden Bank badges defer without dropping native rune/token/sidebar updates and use live stock and current accessibility when opened", () => {
  const f = bankQuantityFixture(); f.hooks.interface();
  const rune = f.add("Rune", 10), token = f.add("Token", 2, "Token");
  assert.equal(rune.icon.nativeUpdates, 1, "initial setItem paints before main-menu ownership is registered");
  f.game.bank.selectedBankItem = rune.bankItem;
  rune.bankItem.quantity = 2000; token.bankItem.quantity = 4;
  f.game.bank.renderQueue.items.add(rune.item); f.game.bank.renderQueue.items.add(token.item); f.game.bank.render();
  assert.equal(rune.icon.nativeUpdates, 1); assert.equal(rune.icon.quantity.textContent, "10");
  assert.equal(f.calls.runes, 1); assert.equal(f.calls.tokens, 1); assert.equal(f.calls.selected, 1); assert.equal(f.calls.nav, 1);
  assert.equal(f.game.bank.renderQueue.items.size, 0); assert.equal(rune.bankItem.quantity, 2000);
  rune.bankItem.quantity = 3456; f.game.settings.enableAccessibility = true;
  f.open("bank-container"); f.flush();
  assert.equal(rune.icon.quantity.textContent, "3456 Rune"); assert.equal(token.icon.quantity.textContent, "4 Token");
  assert.equal(rune.icon.nativeUpdates, 2); rune.icon.onmouseenter(); assert.equal(rune.icon.quantity.textContent, "3,456 Rune");
  rune.icon.onmouseleave(); assert.equal(rune.icon.quantity.textContent, "3456 Rune");
  rune.icon.onclick(); assert.equal(f.calls.selectedClick, rune.item);
  f.flush(); assert.equal(rune.icon.nativeUpdates, 2);
});

test("removed or rebound main Bank icons discard stale pending quantities without retaining removed model references", () => {
  for (const mode of ["remove", "rebind", "decode", "character"]) {
    const f = bankQuantityFixture(); f.hooks.interface(); const old = f.add("Old", 1);
    old.bankItem.quantity = 2; old.icon.updateQuantity(old.bankItem, false); assert.equal(old.icon.nativeUpdates, 1);
    if (mode === "remove") {
      f.game.bank.items.delete(old.item); f.menu.removeItemFromTab(old.item);
      Object.defineProperty(old.bankItem, "item", { get() { throw new Error("removed model reference retained"); } });
    }
    if (mode === "rebind") {
      f.game.bank.items.delete(old.item); f.menu.itemIcons.delete(old.item);
      const nextItem = { id: "New", name: "New" }, next = { bank: f.game.bank, item: nextItem, quantity: 9 };
      f.game.bank.items.set(nextItem, next); old.icon.setItem(f.game.bank, next); f.menu.itemIcons.set(nextItem, old.icon);
      assert.equal(old.icon.quantity.textContent, "9");
    }
    if (mode === "decode") f.game.decode();
    if (mode === "character") f.hooks.character();
    const before = old.icon.nativeUpdates; f.open("bank-container"); assert.doesNotThrow(() => f.flush(), mode); assert.equal(old.icon.nativeUpdates, before, mode);
  }
});

test("unowned clones, disconnected icons, foreign previews and changed BankItem identities keep native quantity updates", () => {
  for (const mode of ["clone", "disconnected", "foreign bank", "replaced model", "wrong metadata", "custom parent"]) {
    const f = bankQuantityFixture(); f.hooks.interface(); const owned = f.add("Owned", 3);
    let icon = owned.icon, bankItem = owned.bankItem;
    if (mode === "clone") { icon = new f.BankIcon(); icon.setItem(f.game.bank, bankItem); }
    if (mode === "disconnected") icon.isConnected = false;
    if (mode === "foreign bank") bankItem = { ...bankItem, bank: new f.Bank() };
    if (mode === "replaced model") bankItem = { ...bankItem };
    if (mode === "wrong metadata") icon.itemID = "Different";
    if (mode === "custom parent") icon.parentMenu = {};
    const before = icon.nativeUpdates; icon.updateQuantity(bankItem, false); assert.equal(icon.nativeUpdates, before + 1, mode);
  }
});