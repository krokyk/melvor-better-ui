import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installTownshipTaskOrder } from "../township-task-order.mjs";

afterEach(() => { for (const name of ["document", "customElements", "townshipUI"]) delete globalThis[name]; });

class Element {
  constructor() {
    this.nodes = []; this.classes = new Set(); this.moves = 0;
    this.classList = { contains: name => this.classes.has(name), toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  }
  get children() { return this.nodes; }
  append(node) { node.remove(); node.parentElement = this; this.nodes.push(node); }
  insertBefore(node, reference) { this.moves++; node.remove(); node.parentElement = this; this.nodes.splice(reference ? this.nodes.indexOf(reference) : this.nodes.length, 0, node); }
  remove() { if (this.parentElement) this.parentElement.nodes.splice(this.parentElement.nodes.indexOf(this), 1); this.parentElement = undefined; }
}

function fixture(late = false) {
  const hooks = { loaded: [], ready: [] }, patches = new WeakMap(), calls = { goals: 0, claims: 0, skips: 0 };
  // Model the SDK's one pipeline: all before hooks, then native, then all after hooks.
  const ctx = {
    onCharacterLoaded: callback => hooks.loaded.push(callback), onInterfaceReady: callback => hooks.ready.push(callback),
    patch(Class, method) {
      let methods = patches.get(Class); if (!methods) patches.set(Class, methods = new Map());
      let patch = methods.get(method);
      if (!patch) {
        const native = Class.prototype[method]; patch = { before: [], after: [] }; methods.set(method, patch);
        Class.prototype[method] = function (...args) { for (const hook of patch.before) hook.apply(this, args); const result = native.apply(this, args); for (const hook of patch.after) hook.call(this, result, ...args); return result; };
      }
      return { before: callback => patch.before.push(callback), after: callback => patch.after.push(callback) };
    },
  };
  const category = {}, otherCategory = {};
  const makeTask = (name, met, taskCategory = category) => ({ name, category: taskCategory, goals: {
    allGoals: [{ met, checkIfMet() { return this.met; } }, { met: true, checkIfMet() { return this.met; } }],
    checkIfMet() { calls.goals++; return this.allGoals.every(goal => goal.checkIfMet()); },
  } });
  const tasks = [makeTask("A", false), makeTask("B", true), makeTask("C", false), makeTask("D", true), makeTask("Other", true, otherCategory)];
  class TaskNode extends Element {
    constructor() { super(); this.completeButton = new Element(); this.goal = new Element(); this.reward = new Element(); this.append(this.completeButton); this.append(this.goal); this.append(this.reward); }
    setTask(manager, task) { this.task = task; this.completeButton.onclick = () => manager.completeTask(task); this.skip = () => manager.skipTask?.(task); this.updateGoals(task); }
    updateGoals(task) { this.completeButton.classList.toggle("d-none", !task.goals.checkIfMet()); }
  }
  class Tasks {
    constructor() { this.tasks = tasks; this.completedTasks = new Set(); this.renderQueue = { taskGoals: new Set() }; }
    render() { for (const task of this.renderQueue.taskGoals) menu.updateTaskGoals(task); this.renderQueue.taskGoals.clear(); return "native regular"; }
    completeTask(task) { calls.claims++; this.completedTasks.add(task); menu.removeTask(task); }
  }
  class CasualTasks {
    constructor() { this.currentCasualTasks = tasks.slice(0, 4); this.renderQueue = { taskGoals: new Set(), currentTasks: false }; }
    render() { if (this.renderQueue.currentTasks) { menu.setCasualTasks(this); this.renderQueue.currentTasks = false; } for (const task of this.renderQueue.taskGoals) menu.updateCasualTaskGoals(task); this.renderQueue.taskGoals.clear(); return "native casual"; }
    completeTask(task) { calls.claims++; this.currentCasualTasks.splice(this.currentCasualTasks.indexOf(task), 1); menu.removeCasualTask(task); }
    skipTask(task) { calls.skips++; }
  }
  const township = { tasks: new Tasks(), casualTasks: new CasualTasks() };
  class Game { decode() {} }
  const game = new Game(); game.township = township; game.openPage = { action: township }; game._isInOnlineLoop = true;
  class Menu extends Element {
    constructor() { super(); this.mode = 0; this.taskContainer = new Element(); this.casualTaskContainer = new Element(); this.taskMap = new Map(); this.casualTaskMap = new Map(); this.taskElems = []; this.casualTaskElems = []; }
    showCategoryTasks(_game, manager, selectedCategory) {
      this.taskMap.clear(); this.casualTaskMap.clear(); this.mode = 1; let index = 0;
      for (const task of manager.tasks) {
        if (task.category !== selectedCategory || manager.completedTasks.has(task)) continue;
        let node = this.taskElems[index]; if (!node) { this.taskElems.push(node = new TaskNode()); this.taskContainer.append(node); }
        node.setTask(manager, task); node.classList.toggle("d-none", false); this.taskMap.set(task, node); index++;
      }
      for (; index < this.taskElems.length; index++) this.taskElems[index].classList.toggle("d-none", true);
    }
    setCasualTasks(manager) {
      if (this.mode !== 2) return;
      this.casualTaskMap.clear(); manager.currentCasualTasks.forEach((task, index) => {
        let node = this.casualTaskElems[index]; if (!node) { this.casualTaskElems.push(node = new TaskNode()); this.casualTaskContainer.append(node); }
        node.setTask(manager, task); node.classList.toggle("d-none", false); this.casualTaskMap.set(task, node);
      });
      for (let index = manager.currentCasualTasks.length; index < this.casualTaskElems.length; index++) this.casualTaskElems[index].classList.toggle("d-none", true);
    }
    updateTaskGoals(task) { this.taskMap.get(task)?.updateGoals(task); }
    updateCasualTaskGoals(task) { this.casualTaskMap.get(task)?.updateGoals(task); }
    removeTask(task) { this.taskMap.get(task)?.classList.toggle("d-none", true); this.taskMap.delete(task); }
    removeCasualTask(task) { this.casualTaskMap.get(task)?.classList.toggle("d-none", true); this.casualTaskMap.delete(task); }
  }
  const menu = new Menu();
  globalThis.townshipUI = { tasks: menu, currentPage: 2 };
  globalThis.document = { visibilityState: "visible" };
  let registered = !late; globalThis.customElements = { get: name => name === "township-tasks-menu" && registered ? Menu : undefined };
  installTownshipTaskOrder(ctx, game);
  const order = container => container.children.filter(node => !node.classList.contains("d-none")).map(node => node.task.name);
  return { game, township, menu, tasks, calls, ctx, Menu, category, otherCategory, makeTask,
    regular: selected => menu.showCategoryTasks(game, township.tasks, selected ?? category),
    casual() { menu.mode = 2; menu.setCasualTasks(township.casualTasks); },
    order: () => order(menu.mode === 1 ? menu.taskContainer : menu.casualTaskContainer),
    ready: () => hooks.ready.forEach(callback => callback()), loaded: () => hooks.loaded.forEach(callback => callback()), register: () => { registered = true; },
    progress(index, met, casual = false) { tasks[index].goals.allGoals[0].met = met; const manager = casual ? township.casualTasks : township.tasks; manager.renderQueue.taskGoals.add(tasks[index]); return manager.render(); },
  };
}

test("regular tasks stably partition native claimable flags while preserving cards, rewards, goals and completion callbacks", () => {
  const f = fixture(); f.regular(); assert.deepEqual(f.order(), ["B", "D", "A", "C"]); assert.equal(f.calls.goals, 4, "only native setTask evaluates goal completion");
  const entries = [...f.menu.taskMap], nodes = entries.map(([, node]) => ({ node, goal: node.goal, reward: node.reward, click: node.completeButton.onclick }));
  assert.equal(f.progress(1, false), "native regular"); assert.deepEqual(f.order(), ["D", "A", "B", "C"], "incomplete order returns to native Map order, not previously sorted DOM order");
  assert.equal(f.calls.goals, 5); assert.equal(f.calls.claims, 0); assert.equal(f.calls.skips, 0); assert.equal(f.township.tasks.completedTasks.size, 0);
  assert.deepEqual([...f.menu.taskMap], entries);
  for (const { node, goal, reward, click } of nodes) { assert.equal(node.goal, goal); assert.equal(node.reward, reward); assert.equal(node.completeButton.onclick, click); }
  f.menu.taskMap.get(f.tasks[3]).completeButton.onclick(); assert.equal(f.calls.claims, 1); assert.deepEqual(f.order(), ["A", "B", "C"]);
});

test("native categories, completed tasks and reused card bindings remain authoritative", () => {
  const f = fixture(); f.regular(); const cards = [...f.menu.taskElems]; f.township.tasks.completedTasks.add(f.tasks[1]);
  f.regular(); assert.deepEqual(f.order(), ["D", "A", "C"]); assert.equal(f.menu.taskMap.has(f.tasks[1]), false);
  f.regular(f.otherCategory); assert.deepEqual(f.order(), ["Other"]); assert.equal(f.menu.taskMap.size, 1); assert.equal(f.menu.taskElems[0], cards[0]);
  assert.equal(f.menu.taskElems.every(node => cards.includes(node)), true); assert.equal(f.calls.claims, 0);
});

test("casual tasks use their own native current-task order and refresh reused nodes after additions and removals", () => {
  const f = fixture(); f.casual(); assert.deepEqual(f.order(), ["B", "D", "A", "C"]);
  const original = [...f.township.casualTasks.currentCasualTasks], nodes = [...f.menu.casualTaskElems];
  f.progress(0, true, true); assert.deepEqual(f.order(), ["A", "B", "D", "C"]); assert.deepEqual(f.township.casualTasks.currentCasualTasks, original);
  f.township.casualTasks.currentCasualTasks = [f.tasks[2], f.tasks[3], f.tasks[0]]; f.township.casualTasks.renderQueue.currentTasks = true;
  assert.equal(f.township.casualTasks.render(), "native casual"); assert.deepEqual(f.order(), ["D", "A", "C"]);
  assert.equal(f.menu.casualTaskElems.every(node => nodes.includes(node)), true); assert.equal(f.calls.claims + f.calls.skips, 0);
});

test("stable native renders and non-readiness progress make no extra goal checks or DOM moves", () => {
  const f = fixture(); f.regular(); const container = f.menu.taskContainer, moves = container.moves, checks = f.calls.goals;
  for (let frame = 0; frame < 50; frame++) f.township.tasks.render();
  assert.equal(container.moves, moves); assert.equal(f.calls.goals, checks);
  f.progress(0, false); assert.equal(container.moves, moves); assert.equal(f.calls.goals, checks + 1);
  assert.equal(f.township.tasks.renderQueue.taskGoals.size, 0);
});

test("hidden/offline native updates retain pending order and catch up visibly after native dirty sets have cleared", () => {
  for (const [skip, resume] of [
    [f => { document.visibilityState = "hidden"; }, f => { document.visibilityState = "visible"; }],
    [f => { f.game.openPage = { id: "Bank" }; }, f => { f.game.openPage = { action: f.township }; }],
    [f => { townshipUI.currentPage = 0; }, f => { townshipUI.currentPage = 2; }],
    [f => { f.game._isInOnlineLoop = false; }, f => { f.game._isInOnlineLoop = true; }],
    [f => { f.game.enableRendering = false; }, f => { f.game.enableRendering = true; }],
  ]) {
    const f = fixture(); f.regular(); const moves = f.menu.taskContainer.moves; skip(f); f.progress(1, false);
    for (let frame = 0; frame < 20; frame++) f.township.tasks.render();
    assert.equal(f.menu.taskContainer.moves, moves); assert.equal(f.township.tasks.renderQueue.taskGoals.size, 0); assert.equal(f.calls.goals, 5);
    resume(f); f.township.tasks.render(); assert.deepEqual(f.order(), ["D", "A", "B", "C"]);
  }
});

test("later SDK before hooks feed the same native render batch before sorting runs", () => {
  const f = fixture(); f.regular(); let once = true;
  f.ctx.patch(f.township.tasks.constructor, "render").before(function () { if (once) { once = false; f.tasks[0].goals.allGoals[0].met = true; this.renderQueue.taskGoals.add(f.tasks[0]); } });
  f.township.tasks.render(); assert.deepEqual(f.order(), ["A", "B", "D", "C"]); assert.equal(f.calls.goals, 5);
});

test("late native elements, character restore and QuickLoad use current native task bindings without stale readiness", () => {
  const f = fixture(true); f.register(); f.ready(); f.ready(); f.regular(); assert.deepEqual(f.order(), ["B", "D", "A", "C"]);
  f.loaded(); f.game.decode(); f.tasks[0].goals.allGoals[0].met = true; f.tasks[1].goals.allGoals[0].met = false;
  f.regular(); assert.deepEqual(f.order(), ["A", "D", "B", "C"]);
  assert.equal(f.calls.goals, 8, "repeated interface hooks install only one wrapper and add no predicate checks"); assert.equal(f.calls.claims, 0);
});
