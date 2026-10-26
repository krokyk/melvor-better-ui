import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { setup } from "../setup.mjs";

const originalPerformance = globalThis.performance;
afterEach(() => {
  for (const name of ["game", "Game", "document", "MutationObserver"]) delete globalThis[name];
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
  assert.deepEqual(loaded, ["page-pinning.mjs", "wide-layout.mjs", "item-stats.mjs", "loadout-plan.mjs", "loadout-transaction.mjs", "equipment-loadouts.mjs", "quick-equip.mjs", "item-sources-and-uses.mjs"]);
});

test("independent config restores on load and QuickLoad, updates new pages immediately, and throttles same-page pinning", async () => {
  const hooks = {}, values = new Map(), fields = new Map();
  const updates = { pinning: [], compact: [], wide: [] };
  let sourcesInstalled = 0, quickEquipInstalled = 0, skillStatsInstalled = 0, loadoutsInstalled = 0;
  const createItemStatsPreview = () => {}, getStatsLayout = () => "vanilla", installed = [];
  const loadoutPlanner = { planLoadout() {} }, applyEquipmentTransaction = () => {};
  const shortcutCopies = [], preparedCopy = {};
  const prepareSetCopy = (source, target) => { shortcutCopies.push([source, target]); return preparedCopy; };
  let prepareQuickEquipCopy;
  const renderEvents = [];
  const pageA = { id: "melvorD:Smithing", containerID: "smithing-container" }, pageB = { id: "melvorD:Mining", containerID: "mining-container" };
  const parent = {}, card = {}, roots = new Map([pageA, pageB].map(page => {
    const node = { hidden: false, parentElement: parent, children: [card], classList: { contains: name => name === "d-none" && node.hidden } };
    return [page.containerID, node];
  }));
  const observers = [];
  globalThis.document = { getElementById: id => roots.get(id) ?? null };
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
    observe(node, options) { this.observed.push({ node, options }); }
  };
  let now = 0;
  globalThis.performance = { now: () => now };
  globalThis.Game = class {
    decode(config) { for (const [name, value] of Object.entries(config)) values.set(name, value); }
    render() { renderEvents.push("native"); return "native render"; }
  };
  globalThis.game = new Game();
  game.pages = { forEach: callback => [pageA, pageB, { containerID: "missing-container" }].forEach(callback) };
  const ctx = {
    async loadModule(path) {
      if (path === "loadout-plan.mjs") return loadoutPlanner;
      if (path === "loadout-transaction.mjs") return { applyEquipmentTransaction };
      if (path === "equipment-loadouts.mjs") return { installEquipmentLoadouts(actualCtx, actualGame, actualPlanner, actualTransaction, prepareCopy) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        assert.equal(actualPlanner, loadoutPlanner); assert.equal(actualTransaction, applyEquipmentTransaction);
        loadoutsInstalled++; installed.push("loadouts");
        prepareQuickEquipCopy = prepareCopy;
      } };
      if (path === "item-stats.mjs") return { createItemStatsPreview, installItemStats(actualCtx, actualGame, actualLayout) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        assert.equal(actualLayout, getStatsLayout);
        skillStatsInstalled++; installed.push("skills");
      } };
      if (path === "quick-equip.mjs") return { installQuickEquip(actualCtx, actualGame, actualPreview) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        assert.equal(actualPreview, createItemStatsPreview);
        assert.equal(loadoutsInstalled, 1, "equipment lifecycle hooks are installed before quick equip");
        quickEquipInstalled++; installed.push("equipment");
        return { getStatsLayout, prepareSetCopy };
      } };
      if (path === "item-sources-and-uses.mjs") return { installItemSourcesAndUses(actualCtx, actualGame) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        sourcesInstalled++; installed.push("sources");
      } };
      const pinning = path === "page-pinning.mjs";
      assert.ok(pinning || path === "wide-layout.mjs");
      return { [pinning ? "installPagePinning" : "installWideLayout"](actualCtx, actualGame, isEnabled, isCompactHeaderEnabled) {
        assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
        return () => {
          renderEvents.push(pinning ? "pinning" : "wide");
          updates[pinning ? "pinning" : "wide"].push(isEnabled());
          if (pinning) updates.compact.push(isCompactHeaderEnabled());
        };
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
  await setup(ctx);
  assert.equal(sourcesInstalled, 0, "optional integrations wait for all mods to load");
  assert.equal(quickEquipInstalled, 0, "quick equip waits for all mods to load");
  assert.equal(skillStatsInstalled, 0, "skill stats wait for all mods to load");
  assert.equal(loadoutsInstalled, 0, "equipment loadouts wait for all mods to load");
  hooks.mods();
  assert.equal(sourcesInstalled, 1);
  assert.equal(quickEquipInstalled, 1);
  assert.equal(skillStatsInstalled, 1);
  assert.equal(loadoutsInstalled, 1);
  assert.equal(prepareQuickEquipCopy(2, 1), preparedCopy);
  assert.deepEqual(shortcutCopies, [[2, 1]]);
  assert.deepEqual(installed, ["loadouts", "equipment", "skills", "sources"], "loadout lifecycle hooks precede quick equip while existing UI installs retain their order");
  const pinning = fields.get("page-pinning-enabled"), wide = fields.get("wide-layout-enabled");
  const compact = fields.get("compact-skill-header-enabled");
  assert.equal(fields.size, 3);
  assert.equal(pinning.label, "Enable Page Pinning");
  assert.equal(wide.label, "Enable Wide Layout");
  assert.equal(compact.label, "Enable Compact Skill Header");
  for (const field of fields.values()) {
    assert.equal(field.type, "switch");
    assert.equal(field.default, true);
  }
  game.render(); assert.deepEqual(updates, { pinning: [], compact: [], wide: [] });
  assert.equal(observers.length, 0, "page observation waits for the interface");
  assert.equal(compact.onChange(false), undefined);
  game.decode({ [pinning.name]: false, [compact.name]: false, [wide.name]: true }); hooks.character();
  assert.deepEqual(updates, { pinning: [], compact: [], wide: [] }, "saved settings and toggles wait until the interface is ready");
  hooks.interface(); assert.deepEqual(updates, { pinning: [false], compact: [false], wide: [true] });
  assert.equal(observers.length, 1);
  assert.deepEqual(observers[0].observed.map(entry => entry.node), [...roots.values()], "only registered page roots are observed, not their parent or cards");
  for (const { options } of observers[0].observed) assert.deepEqual(options, { attributes: true, attributeFilter: ["class"] });
  assert.equal(pinning.onChange(true), undefined);
  assert.equal(updates.pinning.at(-1), true, "onChange applies before the settings API stores its value");
  assert.equal(updates.wide.length, 1, "pinning toggles do not reapply the wide layout");
  assert.equal(updates.compact.at(-1), false, "pinning toggles preserve compact header settings");
  values.set(pinning.name, true);
  assert.equal(compact.onChange(true), undefined);
  assert.equal(updates.compact.at(-1), true, "compact headers apply before the settings API stores their value");
  assert.equal(updates.pinning.at(-1), true, "compact header toggles preserve pinning settings");
  assert.equal(updates.wide.length, 1, "compact header toggles do not reapply the wide layout");
  values.set(compact.name, true);
  assert.equal(wide.onChange(false), undefined);
  assert.equal(updates.wide.at(-1), false);
  assert.equal(updates.pinning.length, 3, "wide layout toggles do not reapply pinning");
  values.set(wide.name, false);
  const wideCount = updates.wide.length;
  assert.equal(game.render(), "native render");
  assert.equal(updates.wide.length, wideCount, "CSS wide layouts do not need render updates");
  const count = updates.pinning.length;
  now = 199; game.render();
  assert.equal(updates.pinning.length, count); assert.equal(updates.wide.length, wideCount);
  now = 200; game.render();
  assert.equal(updates.pinning.length, count + 1); assert.equal(updates.wide.length, wideCount);
  assert.equal(updates.compact.length, count + 1);
  assert.equal(updates.pinning.at(-1), true); assert.equal(updates.wide.at(-1), false);
  const renderPage = (time, page, expectedEvents) => {
    now = time; game.openPage = page; renderEvents.length = 0;
    assert.equal(game.render(), "native render");
    assert.deepEqual(renderEvents, expectedEvents, `page ${page.id} at ${time}ms renders natively before any pinning update`);
    assert.equal(updates.wide.length, wideCount, "page transitions never reapply the CSS wide layout");
  };
  renderPage(201, pageA, ["native", "pinning"]);
  renderPage(202, pageA, ["native"]);
  renderPage(203, pageB, ["native", "pinning"]);
  renderPage(204, pageA, ["native", "pinning"]);
  renderPage(403, pageA, ["native"]);
  renderPage(404, pageA, ["native", "pinning"]);
  const notifyPage = (time, page, shown, expectedEvents) => {
    const previous = game.openPage, records = [];
    if (previous !== page) {
      roots.get(previous.containerID).hidden = true;
      records.push({ type: "attributes", attributeName: "class", target: roots.get(previous.containerID) });
    }
    now = time; game.openPage = page; roots.get(page.containerID).hidden = !shown; renderEvents.length = 0;
    records.push({ type: "attributes", attributeName: "class", target: roots.get(page.containerID) });
    observers[0].callback(records);
    assert.deepEqual(renderEvents, expectedEvents, "visible new pages update before the next native render");
    assert.equal(updates.wide.length, wideCount, "page visibility changes never reapply the CSS wide layout");
  };
  notifyPage(405, pageB, false, []);
  notifyPage(405, pageB, true, ["pinning"]);
  notifyPage(405, pageB, true, []);
  renderPage(406, pageB, ["native"]);
  notifyPage(407, pageA, true, ["pinning"]);
  notifyPage(408, pageB, true, ["pinning"]);
  renderPage(607, pageB, ["native"]);
  renderPage(608, pageB, ["native", "pinning"]);
  const missingPage = { id: "mod:Missing", containerID: "missing-container" };
  game.openPage = missingPage; renderEvents.length = 0;
  observers[0].callback([{ type: "attributes", attributeName: "class", target: roots.get(pageB.containerID) }]);
  assert.deepEqual(renderEvents, [], "an unavailable new page root waits for the native-render fallback");
  renderPage(609, missingPage, ["native", "pinning"]);
  for (const field of fields.values()) assert.equal(typeof field.onChange("false"), "string");
  game.decode({ [pinning.name]: false, [compact.name]: false, [wide.name]: true });
  assert.equal(updates.pinning.at(-1), false); assert.equal(updates.wide.at(-1), true);
  assert.equal(updates.compact.at(-1), false);
  values.set(pinning.name, true); values.set(compact.name, true); values.set(wide.name, false); hooks.character();
  assert.equal(updates.pinning.at(-1), true); assert.equal(updates.wide.at(-1), false);
  assert.equal(updates.compact.at(-1), true);
  game.decode({ [pinning.name]: undefined, [compact.name]: undefined, [wide.name]: undefined });
  assert.equal(updates.pinning.at(-1), true); assert.equal(updates.wide.at(-1), true);
  assert.equal(updates.compact.at(-1), true);
  hooks.interface();
  assert.equal(observers.length, 1, "repeated interface readiness keeps one observer");
  assert.equal(observers[0].observed.length, 2, "repeated readiness does not duplicate page observations");
  assert.equal(sourcesInstalled, 1, "restoring settings and rendering never reinstall the optional integration");
  assert.equal(quickEquipInstalled, 1, "restoring settings and rendering never reinstall quick equip");
  assert.equal(skillStatsInstalled, 1, "restoring settings and rendering never reinstall skill stats");
  assert.equal(loadoutsInstalled, 1, "restoring settings and rendering never reinstall equipment loadouts");
});

test("render remains the page-change fallback without MutationObserver or the page registry", async () => {
  for (const hasObserver of [false, true]) {
    const hooks = {}, calls = { pinning: 0, wide: 0 };
    let sourcesInstalled = 0, quickEquipInstalled = 0, skillStatsInstalled = 0, loadoutsInstalled = 0;
    const createItemStatsPreview = () => {};
    const loadoutPlanner = { planLoadout() {} }, applyEquipmentTransaction = () => {};
    let now = 0;
    globalThis.performance = { now: () => now };
    globalThis.document = { getElementById: () => null };
    if (hasObserver) globalThis.MutationObserver = class { observe() { assert.fail("missing registered pages cannot be observed"); } };
    else delete globalThis.MutationObserver;
    globalThis.Game = class { decode() {} render() { return "native"; } };
    globalThis.game = new Game();
    game.openPage = { id: "melvorD:Smithing" };
    if (!hasObserver) game.pages = { forEach() { assert.fail("a browser without observers does not inspect page roots"); } };
    const ctx = {
      async loadModule(path) {
        if (path === "loadout-plan.mjs") return loadoutPlanner;
        if (path === "loadout-transaction.mjs") return { applyEquipmentTransaction };
        if (path === "equipment-loadouts.mjs") return { installEquipmentLoadouts(actualCtx, actualGame, actualPlanner, actualTransaction) {
          assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
          assert.equal(actualPlanner, loadoutPlanner); assert.equal(actualTransaction, applyEquipmentTransaction);
          loadoutsInstalled++;
        } };
        if (path === "item-stats.mjs") return { createItemStatsPreview, installItemStats(actualCtx, actualGame) {
          assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
          skillStatsInstalled++;
        } };
        if (path === "quick-equip.mjs") return { installQuickEquip(actualCtx, actualGame, actualPreview) {
          assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
          assert.equal(actualPreview, createItemStatsPreview);
          assert.equal(loadoutsInstalled, 1);
          quickEquipInstalled++;
        } };
        if (path === "item-sources-and-uses.mjs") return { installItemSourcesAndUses(actualCtx, actualGame) {
          assert.equal(actualCtx, ctx); assert.equal(actualGame, game);
          sourcesInstalled++;
        } };
        return path === "page-pinning.mjs"
          ? { installPagePinning: () => () => calls.pinning++ }
          : { installWideLayout: () => () => calls.wide++ };
      },
      settings: { section: () => ({ add() {}, get: () => true }) },
      onModsLoaded(fn) { hooks.mods = fn; },
      onCharacterLoaded() {},
      onInterfaceReady(fn) { hooks.interface = fn; },
      patch(Class, method) {
        return { after(fn) {
          const original = Class.prototype[method];
          Class.prototype[method] = function (...args) { const result = original.apply(this, args); fn.call(this, result, ...args); return result; };
        } };
      },
    };
    await setup(ctx); hooks.mods(); hooks.interface();
    assert.equal(game.render(), "native");
    const baseline = calls.pinning, wideCount = calls.wide;
    game.openPage = { id: "melvorD:Mining" };
    now = 1; game.render();
    assert.equal(calls.pinning, baseline + 1);
    now = 200; game.render();
    assert.equal(calls.pinning, baseline + 1);
    now = 201; game.render();
    assert.equal(calls.pinning, baseline + 2);
    assert.equal(calls.wide, wideCount);
    assert.equal(sourcesInstalled, 1);
    assert.equal(quickEquipInstalled, 1);
    assert.equal(skillStatsInstalled, 1);
    assert.equal(loadoutsInstalled, 1);
  }
});
