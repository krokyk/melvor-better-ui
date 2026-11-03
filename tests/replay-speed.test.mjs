import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { installReplaySpeed } from "../replay-speed.mjs";

const journal = "speedup-replay-previous-factor";

function fixture(t, { factor = 1000, savedFactor, missing = false, blockedWrite = false } = {}) {
  const previousMod = globalThis.mod;
  const previousGame = globalThis.Game;
  const previousWarn = console.warn;
  t.after(() => {
    if (previousMod === undefined) delete globalThis.mod;
    else globalThis.mod = previousMod;
    if (previousGame === undefined) delete globalThis.Game;
    else globalThis.Game = previousGame;
    console.warn = previousWarn;
  });

  const state = { factor, effectiveFactor: factor, changes: [], storage: new Map() };
  if (savedFactor !== undefined) state.storage.set(journal, savedFactor);
  console.warn = () => {};
  globalThis.mod = {
    getContext(namespace) {
      assert.equal(namespace, "SpeedupPP");
      if (missing) throw new Error("Mod is absent");
      return { settings: { section(name) {
        assert.equal(name, "Speed options");
        return {
          get(key) { assert.equal(key, "speedupFactor"); return state.factor; },
          set(key, value) {
            assert.equal(key, "speedupFactor");
            if (value === state.blockedFactor) return;
            state.factor = state.effectiveFactor = value;
            state.changes.push(value);
          },
        };
      } } };
    },
  };
  globalThis.Game = class extends EventEmitter {
    decode(saved) {
      if (saved) {
        state.factor = saved.factor;
        if (saved.previousFactor !== undefined) state.storage.set(journal, saved.previousFactor);
      }
      return "native-decode";
    }
  };
  const game = new Game();
  const hooks = {};
  installReplaySpeed({
    characterStorage: {
      getItem: key => state.storage.get(key),
      setItem(key, value) {
        if (blockedWrite) throw new Error("Character storage is unavailable");
        state.storage.set(key, value);
      },
      removeItem: key => state.storage.delete(key),
    },
    onCharacterLoaded(callback) { hooks.loaded = callback; },
    patch(Class, name) {
      const original = Class.prototype[name];
      return { replace(callback) {
        Class.prototype[name] = function (...args) {
          return callback.call(this, original.bind(this), ...args);
        };
      } };
    },
  }, game);
  return { state, game, hooks };
}

test("offline replay runs at ×1 and duplicate entry preserves the previous multiplier", t => {
  const { state, game, hooks } = fixture(t);
  hooks.loaded();
  game.emit("offlineLoopEntered");
  assert.equal(state.factor, 1);
  assert.equal(state.effectiveFactor, 1);
  assert.equal(state.storage.get(journal), 1000);
  game.emit("offlineLoopEntered");
  game.emit("offlineLoopExited");
  game.emit("offlineLoopExited");
  assert.equal(state.factor, 1000);
  assert.equal(state.effectiveFactor, 1000);
  assert.deepEqual(state.changes, [1, 1000]);
  assert.equal(state.storage.has(journal), false);
});

test("loading a saved replay restores its original multiplier", t => {
  const { state, hooks } = fixture(t, { factor: 1, savedFactor: 1000 });
  hooks.loaded();
  assert.equal(state.factor, 1000);
  assert.equal(state.storage.has(journal), false);
});

test("decoding the active game recovers a saved replay, while auxiliary games leave it alone", t => {
  const { state, game, hooks } = fixture(t);
  hooks.loaded();
  game.emit("offlineLoopEntered");
  new Game().decode();
  assert.equal(state.factor, 1);
  assert.equal(state.storage.get(journal), 1000);
  assert.equal(game.decode({ factor: 1, previousFactor: 50 }), "native-decode");
  assert.equal(state.factor, 50);
  assert.equal(state.effectiveFactor, 50);
  assert.equal(state.storage.has(journal), false);
});

test("loading a legacy save with no replay journal does not inherit the old multiplier", t => {
  const { state, game, hooks } = fixture(t);
  hooks.loaded();
  game.emit("offlineLoopEntered");
  assert.equal(game.decode({ factor: 1 }), "native-decode");
  assert.equal(state.factor, 1);
  assert.equal(state.effectiveFactor, 1);
  assert.equal(state.storage.has(journal), false);
});

test("offline exit preserves a multiplier changed during replay", t => {
  const { state, game, hooks } = fixture(t);
  hooks.loaded();
  game.emit("offlineLoopEntered");
  state.factor = state.effectiveFactor = 50;
  game.emit("offlineLoopExited");
  assert.equal(state.factor, 50);
  assert.deepEqual(state.changes, [1]);
  assert.equal(state.storage.has(journal), false);
});

test("replay avoids changing the multiplier if recovery cannot be saved", t => {
  const { state, game, hooks } = fixture(t, { blockedWrite: true });
  hooks.loaded();
  game.emit("offlineLoopEntered");
  game.emit("offlineLoopExited");
  assert.equal(state.factor, 1000);
  assert.deepEqual(state.changes, []);
});

test("a rejected restore keeps the journal for recovery on the next load", t => {
  const { state, game, hooks } = fixture(t);
  hooks.loaded();
  game.emit("offlineLoopEntered");
  state.blockedFactor = 1000;
  game.emit("offlineLoopExited");
  assert.equal(state.factor, 1);
  assert.equal(state.storage.get(journal), 1000);
});

test("characters without Speedup++ keep their regular offline lifecycle", t => {
  const { state, game, hooks } = fixture(t, { missing: true });
  hooks.loaded?.();
  game.emit("offlineLoopEntered");
  game.emit("offlineLoopExited");
  assert.deepEqual(state.changes, []);
  assert.equal(state.storage.size, 0);
});
