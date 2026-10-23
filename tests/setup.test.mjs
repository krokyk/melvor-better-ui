import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { setup } from "../setup.mjs";

const originalPerformance = globalThis.performance;
afterEach(() => {
  for (const name of ["game", "Game"]) delete globalThis[name];
  globalThis.performance = originalPerformance;
});

test("setup loads its packaged modules through Melvor's standalone module URLs", async () => {
  let registered = false;
  const loaded = [];
  await setup({
    async loadModule(path) {
      loaded.push(path);
      const source = await readFile(new URL(`../${path}`, import.meta.url));
      return import(`data:text/javascript;base64,${source.toString("base64")}`);
    },
    onModsLoaded() { registered = true; },
  });
  assert.equal(registered, true);
  assert.deepEqual(loaded, ["page-pinning.mjs", "wide-layout.mjs"]);
});

test("independent config restores on load and QuickLoad, applies toggles immediately, and bounds render updates", async () => {
  const hooks = {}, values = new Map(), fields = new Map();
  const updates = { pinning: [], wide: [] };
  let now = 0;
  globalThis.performance = { now: () => now };
  globalThis.Game = class {
    decode(config) { for (const [name, value] of Object.entries(config)) values.set(name, value); }
    render() { return "native render"; }
  };
  globalThis.game = new Game();
  const ctx = {
    async loadModule(path) {
      const pinning = path === "page-pinning.mjs";
      assert.ok(pinning || path === "wide-layout.mjs");
      return { [pinning ? "installPagePinning" : "installWideLayout"](actualCtx, actualGame, isEnabled) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        return () => updates[pinning ? "pinning" : "wide"].push(isEnabled());
      } };
    },
    settings: { section(name) {
      assert.equal(name, "General");
      return {
        add(config) { fields.set(config.name, config); values.set(config.name, config.default); },
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
  const pinning = fields.get("page-pinning-enabled"), wide = fields.get("wide-layout-enabled");
  assert.equal(fields.size, 2);
  assert.equal(pinning.label, "Enable Page Pinning");
  assert.equal(wide.label, "Enable Wide Layout");
  for (const field of fields.values()) {
    assert.equal(field.type, "switch");
    assert.equal(field.default, true);
  }
  game.render(); assert.deepEqual(updates, { pinning: [], wide: [] });
  game.decode({ [pinning.name]: false, [wide.name]: true }); hooks.character();
  assert.deepEqual(updates, { pinning: [], wide: [] }, "saved settings wait until the interface is ready");
  hooks.interface(); assert.deepEqual(updates, { pinning: [false], wide: [true] });
  assert.equal(pinning.onChange(true), undefined);
  assert.equal(updates.pinning.at(-1), true, "onChange applies before the settings API stores its value");
  assert.equal(updates.wide.length, 1, "pinning toggles do not reapply the wide layout");
  values.set(pinning.name, true);
  assert.equal(wide.onChange(false), undefined);
  assert.equal(updates.wide.at(-1), false);
  assert.equal(updates.pinning.length, 2, "wide layout toggles do not reapply pinning");
  values.set(wide.name, false);
  assert.equal(game.render(), "native render");
  const count = updates.pinning.length;
  assert.equal(updates.wide.length, count);
  now = 199; game.render();
  assert.equal(updates.pinning.length, count); assert.equal(updates.wide.length, count);
  now = 200; game.render();
  assert.equal(updates.pinning.length, count + 1); assert.equal(updates.wide.length, count + 1);
  assert.equal(updates.pinning.at(-1), true); assert.equal(updates.wide.at(-1), false);
  for (const field of fields.values()) assert.equal(typeof field.onChange("false"), "string");
  game.decode({ [pinning.name]: false, [wide.name]: true });
  assert.equal(updates.pinning.at(-1), false); assert.equal(updates.wide.at(-1), true);
  values.set(pinning.name, true); values.set(wide.name, false); hooks.character();
  assert.equal(updates.pinning.at(-1), true); assert.equal(updates.wide.at(-1), false);
  game.decode({ [pinning.name]: undefined, [wide.name]: undefined });
  assert.equal(updates.pinning.at(-1), true); assert.equal(updates.wide.at(-1), true);
});
