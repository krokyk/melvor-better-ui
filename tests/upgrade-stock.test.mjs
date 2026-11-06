import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installUpgradeStock } from "../upgrade-stock.mjs";
import { installItemSourcesAndUses } from "../item-sources-and-uses.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "formatNumber", "numberWithCommas", "Game", "mod"]) delete globalThis[name];
});

class Element {
  constructor(tag = "span") {
    this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = []; this.className = ""; this.attributes = {}; this.listeners = new Map(); this.textWrites = 0;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: name => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); },
      toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name),
    };
  }
  set textContent(value) { this.replaceChildren(); this.text = String(value); this.textWrites++; }
  get textContent() { return this.text ?? ""; }
  append(...nodes) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentElement = this; } }
  replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.append(...nodes); }
  before(node) { const parent = this.parentElement; node.remove(); parent.children.splice(parent.children.indexOf(this), 0, node); node.parentElement = parent; }
  after(node) { const parent = this.parentElement; node.remove(); parent.children.splice(parent.children.indexOf(this) + 1, 0, node); node.parentElement = parent; }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
  matches(selectors) { return selectors.split(",").some(selector => { const value = selector.trim(); return value.startsWith(".") ? this.classList.contains(value.slice(1)) : value.startsWith("#") ? this.id === value.slice(1) : this.tagName.toLowerCase() === value; }); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, callback) { const callbacks = this.listeners.get(name) ?? []; callbacks.push(callback); this.listeners.set(name, callbacks); }
  click() { for (const callback of this.listeners.get("click") ?? []) callback({ stopPropagation() {}, preventDefault() {} }); }
}

function fixture({ late = false, sources } = {}) {
  const root = new Element("html"), head = new Element("head"), page = new Element("main"), modal = new Element("div");
  page.id = "page-container"; modal.id = "modal-item-upgrade"; modal.className = "modal show"; root.append(head, page); page.append(modal);
  const items = ["Iron Bar", "Mithril Bar", "Coal"].map(name => ({ id: `test:${name}`, name, media: `${name}.png` }));
  const result = { id: "test:Upgraded Hat", name: "Upgraded Hat", media: "upgraded-hat.png" };
  const stock = new Map([[items[0], 0], [items[1], 2_345_678], [items[2], 100], [result, 0]]), hooks = { ready: [], character: [] }, patches = [], sourceCalls = [];
  class Bank {
    constructor() { this.renderQueue = { items: new Set() }; this.reads = []; this.renders = 0; }
    getQty(item) { this.reads.push(item); return stock.get(item) ?? 0; }
    render() { this.renders++; this.renderQueue.items.clear(); return "native bank render"; }
  }
  globalThis.Game = class { decode() {} };
  const game = new Game(); game.bank = new Bank(); game._isInOnlineLoop = true;
  game.items = { getObjectByID: id => items.find(item => item.id === id) };
  globalThis.document = { head, visibilityState: "visible", createElement: tag => new Element(tag), getElementById: id => root.querySelector(`#${id}`), querySelectorAll: selector => root.querySelectorAll(selector) };
  globalThis.formatNumber = value => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1000 ? `${value / 1000}K` : `${value}`;
  globalThis.numberWithCommas = value => value.toLocaleString("en-US");
  class UpgradeMenu extends Element {
    constructor() {
      super("item-upgrade-menu"); this.itemCosts = new Element(); this.currencyCosts = new Element(); this.itemImage = new Element("img");
      this.itemTooltips = []; this.currencyTooltips = []; this.nativeBuilds = 0;
      this.upgradeButton = new Element("button"); this.upgradeButton.onclick = () => "native upgrade";
      this.append(this.itemImage, this.itemCosts, this.currencyCosts, this.upgradeButton);
    }
    // Native setUpgradeCosts rebuilds alternating original images and required amounts, with tippy attached to each image.
    setUpgradeCosts(upgrade, bank) {
      this.nativeBuilds++;
      for (const [costs, container, field] of [[upgrade.currencyCosts, this.currencyCosts, "currencyTooltips"], [upgrade.itemCosts, this.itemCosts, "itemTooltips"]]) {
        container.textContent = "";
        this[field].forEach(tooltip => tooltip.destroy()); this[field] = [];
        for (const cost of costs) {
          const value = cost.item ?? cost.currency, image = new Element("img"), required = new Element();
          image.className = "skill-icon-sm mr-1"; image.src = value.media;
          const owned = cost.item ? bank.getQty(cost.item) : Infinity;
          this[field].push({ target: image, content: value.name, destroy() { this.destroyed = true; } });
          required.textContent = numberWithCommas(cost.quantity); required.className = owned >= cost.quantity ? "text-success" : "text-danger";
          container.append(image, required);
        }
      }
      return "native costs";
    }
  }
  const classes = new Map(late ? [] : [["item-upgrade-menu", UpgradeMenu]]);
  globalThis.customElements = { get: name => classes.get(name) };
  let sourceSetting, sourceEnabled = false;
  const ctx = {
    onCharacterLoaded: callback => hooks.character.push(callback), onInterfaceReady: callback => hooks.ready.push(callback),
    settings: { section: () => ({ add(config) { sourceSetting = config; }, get: () => sourceEnabled }) },
    patch(Class, method) {
      return Object.fromEntries(["before", "after"].map(phase => [phase, callback => {
        patches.push([Class, method, phase]); const original = Class.prototype[method];
        Class.prototype[method] = function (...args) {
          if (phase === "before") callback.apply(this, args);
          const result = original.apply(this, args);
          if (phase === "after") callback.call(this, result, ...args);
          return result;
        };
      }]));
    },
  };
  if (sources) globalThis.mod = { api: { ShowItemSourcesAndUses: { showList: id => sourceCalls.push(id) } } };
  if (sources === "before") installItemSourcesAndUses(ctx, game);
  installUpgradeStock(ctx, game);
  if (sources === "after") installItemSourcesAndUses(ctx, game);
  const menu = new UpgradeMenu(); modal.append(menu);
  const upgrade = { upgradedItem: result, itemCosts: [{ item: items[0], quantity: 25_000 }, { item: items[1], quantity: 500 }], currencyCosts: [{ currency: { name: "GP", media: "gp.png" }, quantity: 100_000 }] };
  return { game, Bank, menu, modal, page, head, items, result, stock, upgrade, patches, sourceCalls,
    ready: () => hooks.ready.forEach(callback => callback()), load: () => hooks.character.forEach(callback => callback()),
    register: () => classes.set("item-upgrade-menu", UpgradeMenu),
    sources(value) { sourceEnabled = value; sourceSetting.onChange(value); },
    build(next = upgrade) { menu.itemImage.src = next.upgradedItem.media; return menu.setUpgradeCosts(next, game.bank, game); },
    resultBadge: () => menu.querySelector(".kroky-upgrade-result-stock"),
    badges: () => menu.itemCosts.querySelectorAll(".kroky-upgrade-stock"),
  };
}

test("upgrade material stock uses native blue pills while preserving images, required amounts, tooltip targets and upgrade controls", () => {
  const f = fixture(), click = f.menu.upgradeButton.onclick;
  assert.equal(f.build(), "native costs");
  assert.deepEqual(f.badges().map(badge => badge.textContent), ["0", "2.35M"]);
  assert.deepEqual(f.badges().map(badge => badge.title), ["Iron Bar in Bank: 0", "Mithril Bar in Bank: 2,345,678"]);
  const amounts = f.menu.itemCosts.children.filter(node => !node.classList.contains("kroky-upgrade-cost-icon"));
  assert.deepEqual(amounts.map(node => [node.textContent, node.className]), [["25,000", "text-danger"], ["500", "text-success"]]);
  for (const [index, tooltip] of f.menu.itemTooltips.entries()) {
    const wrapper = tooltip.target.parentElement, badge = f.badges()[index];
    assert.equal(wrapper.children[0], tooltip.target); assert.equal(wrapper.children[1], badge); assert.equal(tooltip.destroyed, undefined);
    assert.equal(tooltip.content, f.items[index].name); assert.equal(badge.getAttribute("aria-label"), badge.title);
    for (const name of ["font-size-xs", "badge-pill", "bg-primary", "text-white"]) assert.equal(badge.classList.contains(name), true);
  }
  assert.equal(f.menu.itemCosts.querySelectorAll("img").length, 2, "no extra images disturb the source shortcut index mapping");
  assert.equal(f.menu.currencyCosts.querySelector(".kroky-upgrade-stock"), null); assert.equal(f.menu.currencyTooltips[0].target.parentElement, f.menu.currencyCosts);
  assert.equal(f.menu.itemImage.parentElement, f.menu); assert.equal(f.menu.upgradeButton.onclick, click);
});

test("Bank refresh consumes only changed required materials before the native queue clears and caches unchanged DOM", () => {
  const f = fixture(); f.build(); f.game.bank.reads = [];
  const checked = [], queue = f.game.bank.renderQueue.items;
  queue.has = function (item) { checked.push(item); return Set.prototype.has.call(this, item); };
  queue[Symbol.iterator] = () => { throw new Error("stock must not scan all changed bank items"); };
  f.menu.closest = () => { throw new Error("the native modal binding is cached"); };
  f.game.bank.renderQueue.items.add(f.items[2]); assert.equal(f.game.bank.render(), "native bank render"); assert.deepEqual(f.game.bank.reads, []);
  assert.deepEqual(checked, [...f.items.slice(0, 2), f.result], "only the dialog's material and result keys are checked against the native dirty set");
  f.stock.set(f.items[0], 50_000); f.game.bank.renderQueue.items.add(f.items[0]); f.game.bank.render();
  assert.deepEqual(f.game.bank.reads, [f.items[0]]); assert.equal(f.badges()[0].textContent, "50K"); assert.equal(f.game.bank.renderQueue.items.size, 0);
  assert.equal(f.menu.nativeBuilds, 1, "stock refresh never rebuilds costs or upgrade buttons");
  const writes = f.badges()[0].textWrites; f.game.bank.reads = [];
  f.game.bank.renderQueue.items.add(f.items[0]); f.game.bank.render(); assert.equal(f.badges()[0].textWrites, writes);
  f.game.bank.reads = []; for (let frame = 0; frame < 20; frame++) f.game.bank.render(); assert.deepEqual(f.game.bank.reads, []);
});

test("relevant bank changes skipped while hidden, offline, rendering-disabled or closed catch up without a timer", () => {
  const f = fixture(); f.build();
  const cases = [
    [() => { document.visibilityState = "hidden"; }, () => { document.visibilityState = "visible"; }],
    [() => { f.game._isInOnlineLoop = false; }, () => { f.game._isInOnlineLoop = true; }],
    [() => { f.game.enableRendering = false; }, () => { f.game.enableRendering = true; }],
    [() => f.modal.classList.remove("show"), () => f.modal.classList.add("show")],
  ];
  for (const [index, [skip, resume]] of cases.entries()) {
    const badge = f.badges()[0], old = badge.textContent; f.game.bank.reads = []; skip();
    f.stock.set(f.items[0], index + 1); f.game.bank.renderQueue.items.add(f.items[0]); f.game.bank.render();
    assert.equal(badge.textContent, old); assert.deepEqual(f.game.bank.reads, []); assert.equal(f.game.bank.renderQueue.items.size, 0);
    resume(); f.game.bank.render(); assert.equal(badge.textContent, `${index + 1}`); assert.deepEqual(f.game.bank.reads, [f.items[0]]);
  }
});

test("reopening and new recipes replace bindings, duplicate material entries share reads and native tooltip cleanup remains intact", () => {
  const f = fixture(); f.build(); const oldBadges = f.badges(), oldTooltips = [...f.menu.itemTooltips];
  const duplicate = { ...f.upgrade, itemCosts: [{ item: f.items[2], quantity: 2 }, { item: f.items[2], quantity: 3 }] };
  f.build(duplicate); assert(oldTooltips.every(tooltip => tooltip.destroyed));
  assert.equal(f.badges().length, 2); assert.equal(f.menu.itemCosts.querySelectorAll(".kroky-upgrade-cost-icon").length, 2);
  f.stock.set(f.items[2], 200); f.game.bank.reads = []; f.game.bank.renderQueue.items.add(f.items[2]); f.game.bank.render();
  assert.deepEqual(f.badges().map(badge => badge.textContent), ["200", "200"]); assert.deepEqual(f.game.bank.reads, [f.items[2]]);
  assert.deepEqual(oldBadges.map(badge => badge.textContent), ["0", "2.35M"]);
  f.game.bank.reads = []; f.game.bank.renderQueue.items.add(f.items[0]); f.game.bank.render(); assert.deepEqual(f.game.bank.reads, []);
  f.build(duplicate); assert.equal(f.badges().length, 2); assert.equal(f.head.querySelectorAll("style").length, 1);
});

test("character loads clear old bindings and foreign bank renders cannot update the current dialog", () => {
  const f = fixture(); f.build(); const badge = f.badges()[0], other = new f.Bank();
  f.stock.set(f.items[0], 25); other.renderQueue.items.add(f.items[0]); other.render(); assert.equal(badge.textContent, "0");
  f.modal.classList.remove("show"); f.game.bank.renderQueue.items.add(f.items[0]); f.game.bank.render();
  f.load(); f.modal.classList.add("show"); f.game.bank.reads = []; f.game.bank.render();
  assert.equal(badge.textContent, "0"); assert.deepEqual(f.game.bank.reads, []);
  f.build(); assert.equal(f.badges()[0].textContent, "25");
});

test("late custom element definitions install one upgrade hook at interface readiness", () => {
  const f = fixture({ late: true });
  assert.equal(f.patches.filter(([, method]) => method === "setUpgradeCosts").length, 0);
  f.ready(); f.register(); f.ready(); f.ready(); f.build();
  assert.equal(f.patches.filter(([, method]) => method === "setUpgradeCosts").length, 1);
  assert.equal(f.badges().length, 2);
});

test("source shortcuts and stock reuse the same wrapper in either install order and after repeated source setting changes", () => {
  for (const sources of ["before", "after"]) {
    const f = fixture({ sources }); f.ready(); f.build();
    const images = f.menu.itemCosts.querySelectorAll("img"), wrappers = images.map(image => image.parentElement), badges = f.badges();
    f.sources(true); f.sources(false); f.sources(true);
    assert.deepEqual(images.map(image => image.parentElement), wrappers);
    assert.equal(f.menu.itemCosts.querySelectorAll(".kroky-upgrade-cost-icon").length, 2);
    assert.deepEqual(f.badges(), badges); assert.equal(f.menu.itemCosts.querySelectorAll("img").length, 2);
    assert.equal(f.menu.querySelectorAll(".kroky-item-source-button").length, 2, "the main result artwork receives no source shortcut");
    for (const [index, wrapper] of wrappers.entries()) {
      assert.equal(wrapper.querySelectorAll(".kroky-item-source-button").length, 1);
      wrapper.querySelector(".kroky-item-source-button").click(); assert.equal(f.sourceCalls.at(-1), f.items[index].id);
    }
    f.build(); assert.equal(f.menu.itemCosts.querySelectorAll(".kroky-upgrade-cost-icon").length, 2);
    assert.equal(f.menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 2); assert.equal(f.badges().length, 2);
  }
});

test("upgraded-result stock stays below the original artwork and refreshes through the shared bank bindings", () => {
  const f = fixture(), image = f.menu.itemImage, parent = image.parentElement;
  f.build();
  const badge = f.resultBadge(); assert.ok(badge);
  assert.equal(image.parentElement, parent); assert.equal(parent.children[parent.children.indexOf(image) + 1], badge);
  assert.equal(image.src, f.result.media); assert.equal(badge.textContent, "0");
  assert.equal(badge.title, "Upgraded Hat in Bank: 0"); assert.equal(badge.getAttribute("aria-label"), badge.title);
  for (const name of ["font-size-xs", "badge-pill", "bg-primary", "text-white"]) assert.equal(badge.classList.contains(name), true);
  f.stock.set(f.result, 1_234_567); f.game.bank.reads = []; f.game.bank.renderQueue.items.add(f.result); f.game.bank.render();
  assert.equal(badge.textContent, "1.23M"); assert.equal(badge.title, "Upgraded Hat in Bank: 1,234,567");
  assert.deepEqual(f.game.bank.reads, [f.result]); assert.equal(f.menu.nativeBuilds, 1);
  const writes = badge.textWrites; f.game.bank.renderQueue.items.add(f.result); f.game.bank.render(); assert.equal(badge.textWrites, writes);
  f.build(); f.build(); assert.equal(f.resultBadge(), badge); assert.equal(f.menu.querySelectorAll(".kroky-upgrade-result-stock").length, 1);
});

test("switching upgrades rebinds the reused result badge and shares a read with a matching required material", () => {
  const f = fixture(); f.build(); const badge = f.resultBadge(); assert.ok(badge);
  const next = { ...f.upgrade, upgradedItem: f.items[1] }; f.build(next);
  assert.equal(f.resultBadge(), badge); assert.equal(f.menu.itemImage.src, f.items[1].media);
  assert.equal(badge.textContent, "2.35M"); assert.equal(badge.title, "Mithril Bar in Bank: 2,345,678");
  f.stock.set(f.items[1], 42); f.game.bank.reads = []; f.game.bank.renderQueue.items.add(f.items[1]); f.game.bank.render();
  assert.deepEqual(f.game.bank.reads, [f.items[1]]); assert.equal(badge.textContent, "42"); assert.equal(f.badges()[1].textContent, "42");
  f.stock.set(f.result, 9); f.game.bank.reads = []; f.game.bank.renderQueue.items.add(f.result); f.game.bank.render();
  assert.equal(badge.textContent, "42"); assert.deepEqual(f.game.bank.reads, []);
  f.modal.classList.remove("show"); f.stock.set(f.items[1], 70); f.game.bank.renderQueue.items.add(f.items[1]); f.game.bank.render();
  f.load(); f.modal.classList.add("show"); f.game.bank.render(); assert.equal(badge.textContent, "42");
  f.build(next); assert.equal(f.resultBadge(), badge); assert.equal(badge.textContent, "70");
});
