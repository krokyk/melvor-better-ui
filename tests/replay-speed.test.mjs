import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { installReplaySpeed } from "../replay-speed.mjs";

const journal = "speedup-replay-previous-factor";

// Melvor's SDK consumes its replacement index each time the supplied next callback is invoked.
function createMethodPatcher(Class, name) {
  const beforeHooks = [], afterHooks = [], overrides = [], original = Class.prototype[name];
  Class.prototype[name] = function (...args) {
    for (const hook of beforeHooks) { const nextArgs = hook.apply(this, args); if (Array.isArray(nextArgs)) args = nextArgs; }
    let result;
    if (!overrides.length) result = original.apply(this, args);
    else {
      let index = overrides.length - 1;
      const next = (...nextArgs) => {
        args = nextArgs; index--;
        return index < 0 ? original.apply(this, args) : overrides[index].call(this, next, ...args);
      };
      result = overrides[index].call(this, next, ...args);
    }
    for (const hook of afterHooks) { const nextResult = hook.call(this, result, ...args); if (nextResult !== undefined) result = nextResult; }
    return result;
  };
  return { before: callback => beforeHooks.push(callback), after: callback => afterHooks.push(callback), replace: callback => overrides.push(callback) };
}

function fixture(t, { factor = 1000, savedFactor, missing = false, tickCost = .5, minFPS = 60, install = true, version = "1.0.4" } = {}) {
  const globals = new Map(["mod", "Game", "performance", "offlineLoading"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const warn = console.warn;
  t.after(() => {
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
    console.warn = warn;
  });
  const state = { factor, effectiveFactor: factor, changes: [], storage: new Map(), cpu: 0, lastTickStart: 0,
    tickCost, requests: [], progress: [], errors: [], exits: [], originalLoops: 0 };
  if (savedFactor !== undefined) state.storage.set(journal, savedFactor);
  console.warn = () => {};
  Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => state.cpu } });
  globalThis.offlineLoading = {
    updateProgress(processed, total, rate) { state.progress.push({ processed, total, rate }); },
    setError(error) { state.errors.push(error); },
  };
  const settings = {
    get(key) { assert.ok(["speedupFactor", "minFPS"].includes(key)); return key === "minFPS" ? minFPS : state.factor; },
    set(key, value) {
      assert.equal(key, "speedupFactor");
      if (value === state.blockedFactor) return;
      state.factor = state.effectiveFactor = value; state.changes.push(value);
    },
  };
  globalThis.mod = {
    getContext(namespace) {
      assert.equal(namespace, "SpeedupPP");
      if (missing) throw new Error("Mod is absent");
      return { version, settings: { section(name) { assert.equal(name, "Speed options"); return settings; } } };
    },
    getModErrorFromError: error => error,
  };
  globalThis.Game = class extends EventEmitter {
    constructor() {
      super(); this.MAX_OFFLINE_TIME = 86400000; this.OFFLINE_EXIT_TIME = 500; this.OFFLINE_GC_RATIO = .95;
      this._isInOnlineLoop = true; this._offlineInfo = {}; this.previousTickTime = 0;
      this.ticks = 0; this.random = 12345; this.xp = 0; this.items = 0;
      this.activeAction = { stop() { state.stopped = true; } };
    }
    tick() {
      if (this.ticks + 1 === state.throwAtTick) throw new Error("native tick failed");
      this.ticks++; state.cpu += state.tickCost;
      this.random = (Math.imul(this.random, 1664525) + 1013904223) >>> 0;
      if (this.ticks % 5 === 0) { this.xp += this.random % 7; this.items += 3; }
    }
    // Speedup++ 1.0.4 returns actual completed ticks and budgets its native batches at 200 ticks.
    runTicks(ticksToRun) {
      state.requests.push(ticksToRun);
      if (state.zeroOnce) { state.zeroOnce = false; return 0; }
      if (state.invalidReturn) return undefined;
      if (state.returnLimit) ticksToRun = Math.min(ticksToRun, state.returnLimit);
      if (ticksToRun <= 0) return;
      let ticks = 0, start = performance.now();
      const maxUpdateTime = 1000 / 60, effStart = state.lastTickStart + maxUpdateTime;
      if (effStart < start && start - effStart < maxUpdateTime) start = effStart;
      state.lastTickStart = start;
      const ticksPerLoop = 200;
      let end = Math.min(ticksPerLoop, ticksToRun);
      while (ticks < ticksToRun) {
        const loopStart = performance.now();
        for (let index = 0; index < end; index++) this.tick();
        ticks += end;
        if (ticks >= ticksToRun) break;
        const elapsed = performance.now() - start;
        if (elapsed >= maxUpdateTime) break;
        const timePerTick = (performance.now() - loopStart) / end;
        end = Math.min(ticksPerLoop, ticksToRun - ticks, Math.ceil((maxUpdateTime - elapsed) / timePerTick));
        if (end < ticksPerLoop) break;
      }
      this.previousTickTime += ticks * (50 / state.effectiveFactor);
      return ticks;
    }
    // Speedup++'s offline accounting calls the runner once and credits only its returned tick count.
    loopOffline(loopTime) {
      state.originalLoops++;
      try {
        const totalTime = Math.min(loopTime - this._offlineInfo.startTime, this.MAX_OFFLINE_TIME);
        const ticksLeft = Math.floor((totalTime - this._offlineInfo.timeProcessed) * (state.effectiveFactor / 50));
        const start = performance.now();
        const completed = this.runTicks(Math.min(this._offlineInfo.tickRate, ticksLeft));
        this._offlineInfo.timeProcessed += completed / state.effectiveFactor * 50;
        const rate = completed / Math.max(performance.now() - start, 1);
        this._offlineInfo.tickRate = Math.max(1, Math.floor(rate * 50 * this.OFFLINE_GC_RATIO));
        offlineLoading.updateProgress(this._offlineInfo.timeProcessed, totalTime, rate * 1000);
      } catch (error) {
        offlineLoading.setError(error); this.activeAction?.stop();
      }
    }
    enterOfflineLoop() {
      this._isInOnlineLoop = false; this._offlineInfo = { startTime: 0, timeProcessed: 0, tickRate: 1000 };
      this.emit("offlineLoopEntered");
    }
    exitOfflineLoop(loopTime) {
      state.exits.push({ loopTime, processed: this._offlineInfo.timeProcessed, ticks: this.ticks });
      this._isInOnlineLoop = true; this._offlineInfo = { startTime: 0, timeProcessed: 0, tickRate: 1000 };
      this.emit("offlineLoopExited");
    }
    // Retain the native early-exit condition to catch lost accelerated tail work.
    loop(loopTime) {
      if (this._isInOnlineLoop) this.enterOfflineLoop();
      else if (loopTime - this._offlineInfo.startTime - this._offlineInfo.timeProcessed <= this.OFFLINE_EXIT_TIME ||
          this._offlineInfo.timeProcessed >= this.MAX_OFFLINE_TIME) this.exitOfflineLoop(loopTime);
      if (!this._isInOnlineLoop) this.loopOffline(loopTime);
    }
    getErrorLog(error) { return error.message; }
    decode(saved) {
      if (saved) {
        state.factor = saved.factor;
        if (saved.previousFactor !== undefined) state.storage.set(journal, saved.previousFactor);
      }
      return "native-decode";
    }
  };
  const speedupRunner = Game.prototype.runTicks, speedupOffline = Game.prototype.loopOffline;
  // Install Speedup as an SDK replacement of vanilla's void-returning runner.
  Game.prototype.runTicks = function (count) { for (let index = 0; index < count; index++) this.tick(); };
  const patches = new Map();
  const ctx = {
    characterStorage: {
      getItem: key => state.storage.get(key),
      removeItem: key => state.storage.delete(key),
      setItem(key, value) { state.storage.set(key, value); },
    },
    onCharacterLoaded(callback) { hooks.loaded = callback; },
    patch(Class, name) {
      if (!patches.has(Class)) patches.set(Class, new Map());
      const methods = patches.get(Class);
      if (!methods.has(name)) methods.set(name, createMethodPatcher(Class, name));
      return methods.get(name);
    },
  };
  ctx.patch(Game, "runTicks").replace(function (_original, ...args) { return speedupRunner.apply(this, args); });
  ctx.patch(Game, "loopOffline").replace(function (_original, ...args) { return speedupOffline.apply(this, args); });
  const game = new Game(), hooks = {};
  if (install) installReplaySpeed(ctx, game);
  const replay = (awayMs, step = 50) => {
    let loopTime = awayMs; game.loop(loopTime);
    for (let loops = 0; !game._isInOnlineLoop; loops++) {
      assert.ok(loops < 5000, "replay must finish without generating its own backlog");
      game.loop(loopTime += step);
    }
  };
  return { state, game, hooks, settings, replay };
}

for (const factor of [1, 10, 1000]) test(`offline replay preserves ×${factor} and exactly matches ordered native ticks`, t => {
  const f = fixture(t, { factor }); f.hooks.loaded(); f.replay(1250, 1000);
  const expectedTicks = 1250 * factor / 50;
  assert.equal(f.game.ticks, expectedTicks); assert.equal(f.state.exits.at(-1).processed, 1250);
  assert.equal(f.state.factor, factor); assert.equal(f.state.effectiveFactor, factor);
  assert.deepEqual(f.state.changes, []); assert.equal(f.state.storage.size, 0);
  assert.ok(f.state.requests.every(value => value > 0 && value <= 16));
  assert.ok(f.state.progress.every(({ total }) => total === 1250), "replay time does not extend the captured away window");
  assert.equal(f.game.OFFLINE_EXIT_TIME, 500);
  const reference = fixture(t, { factor, install: false });
  for (let tick = 0; tick < expectedTicks; tick++) reference.game.tick();
  assert.deepEqual([f.game.random, f.game.xp, f.game.items], [reference.game.random, reference.game.xp, reference.game.items]);
});

test("native offline cap and fractional final tick are respected without NaN or fake rewards", t => {
  const f = fixture(t, { factor: 10 }); f.hooks.loaded();
  assert.equal(f.game.MAX_OFFLINE_TIME, 86400000);
  f.game.MAX_OFFLINE_TIME = 5000; f.replay(100000);
  assert.equal(f.game.ticks, 1000); assert.equal(f.state.exits.at(-1).processed, 5000);
  const fraction = fixture(t, { factor: 10 }); fraction.hooks.loaded(); fraction.replay(1001);
  assert.equal(fraction.game.ticks, 200); assert.equal(fraction.state.exits.at(-1).processed, 1000);
  assert.ok(fraction.state.progress.every(({ processed }) => Number.isFinite(processed)));
});

test("offline work yields after small batches while online and auxiliary runners retain native behavior", t => {
  const f = fixture(t); f.hooks.loaded(); f.game.loop(2000);
  assert.equal(f.game.ticks, 32); assert.equal(f.state.cpu, 16);
  assert.deepEqual(f.state.requests, [16, 16]); assert.equal(f.game.OFFLINE_EXIT_TIME, 0);
  f.game.exitOfflineLoop(2050);
  assert.equal(f.game.OFFLINE_EXIT_TIME, 500); assert.equal(f.state.factor, 1000);
  f.state.requests.length = 0; f.game.runTicks(1000);
  assert.deepEqual(f.state.requests, [1000]);
  const auxiliary = new Game(); auxiliary._isInOnlineLoop = false; auxiliary._offlineInfo = { startTime: 0, timeProcessed: 0, tickRate: 1000 };
  f.state.requests.length = 0; auxiliary.loopOffline(2000);
  assert.deepEqual(f.state.requests, [1000]); assert.equal(auxiliary.OFFLINE_EXIT_TIME, 500);
});

test("a multiplier edited during replay applies to the remaining window without overwriting its setting", t => {
  const f = fixture(t); f.hooks.loaded(); f.game.loop(1000);
  const firstTicks = f.game.ticks, firstTime = f.game._offlineInfo.timeProcessed;
  f.settings.set("speedupFactor", 10);
  let time = 2000;
  for (let count = 0; !f.game._isInOnlineLoop; count++) { assert.ok(count < 5000); f.game.loop(time += 1000); }
  assert.equal(f.game.ticks, firstTicks + Math.floor((1000 - firstTime) * 10 / 50));
  assert.equal(f.state.factor, 10); assert.deepEqual(f.state.changes, [10]);
});

test("replay errors retain native error handling and preserve recovery until native exit", t => {
  const f = fixture(t, { tickCost: .1 }); f.hooks.loaded(); f.state.throwAtTick = 33;
  f.game.loop(1000);
  assert.equal(f.game.ticks, 32); assert.equal(f.game._offlineInfo.timeProcessed, 1.6);
  assert.equal(f.state.errors.length, 1); assert.match(f.state.errors[0].message, /native tick failed/);
  assert.equal(f.state.stopped, true); assert.equal(f.game.OFFLINE_EXIT_TIME, 0);
  f.game.exitOfflineLoop(1000); assert.equal(f.game.OFFLINE_EXIT_TIME, 500);
  assert.equal(f.state.factor, 1000); assert.deepEqual(f.state.changes, []);
});

test("loading or decoding an older replay recovers its multiplier without changing ordinary saves", t => {
  const f = fixture(t, { factor: 1, savedFactor: 1000 }); f.hooks.loaded();
  assert.equal(f.state.factor, 1000); assert.equal(f.state.storage.has(journal), false);
  f.game.loop(1000); assert.equal(f.game.OFFLINE_EXIT_TIME, 0);
  assert.equal(f.game.decode({ factor: 1, previousFactor: 50 }), "native-decode");
  assert.equal(f.state.factor, 50); assert.equal(f.state.effectiveFactor, 50); assert.equal(f.game.OFFLINE_EXIT_TIME, 500);
  assert.equal(f.state.storage.has(journal), false);
  f.game.decode({ factor: 1 }); assert.equal(f.state.factor, 1); assert.equal(f.state.effectiveFactor, 1);
});

test("legacy recovery preserves deliberate edits and retains a rejected journal for retry", t => {
  const f = fixture(t, { factor: 10, savedFactor: 1000 }); f.hooks.loaded();
  assert.equal(f.state.factor, 10); assert.deepEqual(f.state.changes, []); assert.equal(f.state.storage.size, 0);
  f.state.factor = f.state.effectiveFactor = 1; f.state.storage.set(journal, 1000); f.state.blockedFactor = 1000;
  f.hooks.loaded(); assert.equal(f.state.factor, 1); assert.equal(f.state.storage.get(journal), 1000);
  delete f.state.blockedFactor; f.hooks.loaded(); assert.equal(f.state.factor, 1000); assert.equal(f.state.storage.size, 0);
});

test("characters without Speedup++ keep native offline and runner behavior", t => {
  const f = fixture(t, { missing: true });
  assert.equal(f.hooks.loaded, undefined); f.game.loop(1000);
  assert.deepEqual(f.state.requests, [1000]); assert.equal(f.game.OFFLINE_EXIT_TIME, 500);
  assert.deepEqual(f.state.changes, []); assert.equal(f.state.storage.size, 0);
});

test("higher configured frame rates shorten replay work and an empty window exits without invalid progress", t => {
  const f = fixture(t, { minFPS: 240 }); f.hooks.loaded(); f.game.loop(1000);
  assert.equal(f.game.ticks, 16); assert.deepEqual(f.state.requests, [16]);
  f.game.exitOfflineLoop(1000);
  const empty = fixture(t); empty.hooks.loaded(); empty.game.loop(0);
  assert.equal(empty.game.ticks, 0); assert.equal(empty.game._isInOnlineLoop, true);
  assert.equal(empty.state.progress.length, 0);
});


test("partial and zero native returns credit only completed work and invalid returns use native errors", t => {
  const partial = fixture(t, { factor: 10 }); partial.hooks.loaded(); partial.state.returnLimit = 3;
  partial.replay(1000);
  assert.equal(partial.game.ticks, 200); assert.equal(partial.state.exits.at(-1).processed, 1000);
  const zero = fixture(t, { factor: 10 }); zero.hooks.loaded(); zero.state.zeroOnce = true;
  zero.game.loop(1000);
  assert.equal(zero.game.ticks, 0); assert.equal(zero.game._offlineInfo.timeProcessed, 0);
  let loopTime = 2000;
  for (let count = 0; !zero.game._isInOnlineLoop; count++) { assert.ok(count < 5000); zero.game.loop(loopTime += 1000); }
  assert.equal(zero.game.ticks, 200); assert.equal(zero.state.exits.at(-1).processed, 1000);
  const invalid = fixture(t); invalid.hooks.loaded(); invalid.state.invalidReturn = true; invalid.game.loop(1000);
  assert.equal(invalid.game.ticks, 0); assert.equal(invalid.game._offlineInfo.timeProcessed, 0);
  assert.equal(invalid.game.OFFLINE_EXIT_TIME, 0); assert.equal(invalid.state.errors.length, 1);
  invalid.game.exitOfflineLoop(1000); assert.equal(invalid.game.OFFLINE_EXIT_TIME, 500);
});


test("successful ticks inside a faulted native batch are credited before native error handling", t => {
  const f = fixture(t, { tickCost: .1 }); f.hooks.loaded(); f.state.throwAtTick = 40;
  f.game.loop(1000);
  assert.equal(f.game.ticks, 39); assert.equal(f.game._offlineInfo.timeProcessed, 1.95);
  assert.equal(f.state.errors.length, 1); assert.equal(f.game.OFFLINE_EXIT_TIME, 0);
  f.game.exitOfflineLoop(1000); assert.equal(f.game.OFFLINE_EXIT_TIME, 500);
});


test("other Speedup versions keep their runner and replay implementation while legacy recovery remains available", t => {
  const f = fixture(t, { version: "1.0.5", factor: 1, savedFactor: 10 }); f.hooks.loaded();
  assert.equal(f.state.factor, 10); assert.equal(f.state.storage.size, 0);
  f.game.loop(1000);
  assert.equal(f.state.originalLoops, 1); assert.deepEqual(f.state.requests, [200]);
  assert.equal(f.game.OFFLINE_EXIT_TIME, 500);
});


test("early and late native errors retain the captured horizon until retry completes or the player aborts", t => {
  for (const failedTick of [40, 19990]) {
    const f = fixture(t, { factor: 1000, tickCost: .001 }); f.hooks.loaded(); f.state.throwAtTick = failedTick;
    for (let count = 0; !f.state.errors.length; count++) { assert.ok(count < 100); f.game.loop(1000); }
    assert.equal(f.game.ticks, failedTick - 1);
    assert.equal(f.game._offlineInfo.timeProcessed, (failedTick - 1) / 20);
    assert.equal(f.game.OFFLINE_EXIT_TIME, 0, "an error must not re-enable native accelerated tail loss");
    assert.equal(f.state.stopped, true); assert.equal(f.state.errors.length, 1);
    delete f.state.throwAtTick;
    for (let count = 0; !f.game._isInOnlineLoop; count++) { assert.ok(count < 100); f.game.loop(100000); }
    assert.equal(f.game.ticks, 20000); assert.equal(f.state.exits.at(-1).processed, 1000);
    assert.equal(f.game.OFFLINE_EXIT_TIME, 500); assert.equal(f.state.factor, 1000);
    const reference = fixture(t, { factor: 1000, install: false });
    for (let count = 0; count < 20000; count++) reference.game.tick();
    assert.deepEqual([f.game.random, f.game.xp, f.game.items], [reference.game.random, reference.game.xp, reference.game.items]);
  }
  const aborted = fixture(t, { tickCost: .001 }); aborted.hooks.loaded(); aborted.state.throwAtTick = 19990;
  for (let count = 0; !aborted.state.errors.length; count++) { assert.ok(count < 100); aborted.game.loop(1000); }
  aborted.game.exitOfflineLoop(1000);
  assert.equal(aborted.game.OFFLINE_EXIT_TIME, 500); assert.equal(aborted.game.ticks, 19989);
  assert.equal(aborted.state.factor, 1000); assert.equal(aborted.game._isInOnlineLoop, true);
});
