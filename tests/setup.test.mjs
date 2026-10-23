import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { setup } from "../setup.mjs";

const originalPerformance = globalThis.performance;
afterEach(() => {
  for (const name of ["game", "Game"]) delete globalThis[name];
  globalThis.performance = originalPerformance;
});

test("setup loads its packaged module through Melvor's standalone module URL", async () => {
  let registered = false;
  await setup({
    async loadModule(path) {
      assert.equal(path, "page-pinning.mjs");
      const source = await readFile(new URL(`../${path}`, import.meta.url));
      return import(`data:text/javascript;base64,${source.toString("base64")}`);
    },
    onModsLoaded() { registered = true; },
  });
  assert.equal(registered, true);
});

test("config restores on load and QuickLoad, applies toggles immediately, and bounds render updates", async () => {
  const hooks = {}, values = new Map(), updates = [];
  let field, now = 0;
  globalThis.performance = { now: () => now };
  globalThis.Game = class {
    decode(value) { values.set(field.name, value); }
    render() { return "native render"; }
  };
  globalThis.game = new Game();
  const ctx = {
    async loadModule(path) {
      assert.equal(path, "page-pinning.mjs");
      return { installPagePinning(actualCtx, actualGame, isEnabled) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        return () => updates.push(isEnabled());
      } };
    },
    settings: { section(name) {
      assert.equal(name, "General");
      return {
        add(config) { field = config; values.set(field.name, field.default); },
        get: name => values.get(name),
      };
    } },
    onModsLoaded(fn) { hooks.mods = fn; },
    onCharacterLoaded(fn) { hooks.character = fn; },
    onInterfaceReady(fn) { hooks.interface = fn; },
    patch(Class, method) {
      return { after(fn) {
        const original = Class.prototype[method];
        Class.prototype[method] = function (...args) {
          const result = original.apply(this, args);
          fn.call(this, result, ...args);
          return result;
        };
      } };
    },
  };
  await setup(ctx); hooks.mods();
  assert.equal(field.type, "switch");
  assert.equal(field.name, "page-pinning-enabled");
  assert.equal(field.default, true);
  game.render(); assert.deepEqual(updates, []);
  game.decode(false); hooks.character();
  assert.deepEqual(updates, [], "saved settings wait until the interface is ready");
  hooks.interface(); assert.deepEqual(updates, [false]);
  assert.equal(field.onChange(true), undefined);
  assert.equal(updates.at(-1), true, "onChange applies before the settings API stores its value");
  values.set(field.name, true);
  assert.equal(game.render(), "native render");
  const count = updates.length;
  now = 199; game.render(); assert.equal(updates.length, count);
  now = 200; game.render(); assert.equal(updates.length, count + 1);
  assert.equal(field.onChange(false), undefined);
  assert.equal(updates.at(-1), false);
  assert.equal(typeof field.onChange("false"), "string");
  game.decode(true); assert.equal(updates.at(-1), true);
  game.decode(false); assert.equal(updates.at(-1), false);
  game.decode(undefined); assert.equal(updates.at(-1), true);
});
