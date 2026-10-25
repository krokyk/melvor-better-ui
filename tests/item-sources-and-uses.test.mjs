import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import { installItemSourcesAndUses } from "../item-sources-and-uses.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "MutationObserver", "Game", "mod", "SwalLocale"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.nodeType = 1;
    this.children = []; this.className = ""; this.listeners = new Map(); this.attributes = {};
    this.checked = false; this.hidden = false;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: name => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); },
      toggle: (name, value) => value ? this.classList.add(name) : this.classList.remove(name),
    };
  }
  append(...nodes) {
    for (const node of nodes) { node.remove(); this.children.push(node); node.parentElement = this; }
  }
  replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.append(...nodes); }
  before(node) {
    const parent = this.parentElement;
    if (!parent) return;
    node.remove(); parent.children.splice(parent.children.indexOf(this), 0, node); node.parentElement = parent;
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = undefined;
  }
  matches(selector) {
    return selector.split(",").some(value => {
      value = value.trim();
      return value.startsWith(".") ? this.classList.contains(value.slice(1))
        : value.startsWith("#") ? this.id === value.slice(1) : this.tagName.toLowerCase() === value;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(callback);
  }
  dispatch(name, event = { stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } }) {
    for (const callback of this.listeners.get(name) ?? []) callback(event);
    this[`on${name}`]?.(event);
    if (!event.stopped) this.parentElement?.dispatch(name, event);
    return event;
  }
  click() { return this.dispatch("click"); }
}

function fixture(provider = "available", saved = false, install = installItemSourcesAndUses, upgradeRegistered = true) {
  const html = new Element("html"), head = new Element("head"), page = new Element(), nativeRoot = new Element(), workforce = new Element("section"), skillRoot = new Element();
  page.id = "page-container"; nativeRoot.id = "smithing-container"; workforce.className = "kroky-production"; skillRoot.className = "kroky-production-recipe-details";
  html.append(head, page); page.append(nativeRoot); nativeRoot.append(workforce); workforce.append(skillRoot);
  const items = ["Iron", "Coal", "ShopIngredient", "PotionI", "PotionIV"].map(name => ({ id: `test:${name}`, name }));
  items[2].buyable = true;
  const calls = [], observers = [], patches = [], hooks = {}, fields = new Map(), values = new Map();
  globalThis.document = { head, createElement: tag => new Element(tag), getElementById: id => html.querySelector(`#${id}`), querySelectorAll: selector => html.querySelectorAll(selector) };
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = new Map(); observers.push(this); }
    observe(node, options) { this.nodes.set(node, options); }
    disconnect() { this.nodes.clear(); }
  };
  globalThis.Game = class { decode(value) { values.set("recipe-item-sources-enabled", value); } render() {} };
  const game = new Game();
  game.items = { getObjectByID: id => items.find(item => item.id === id) };
  game.herblore = { tier: 0, getPotionTier() { return this.tier; } };
  if (provider === "available") globalThis.mod = { api: { ShowItemSourcesAndUses: { showList(id) { calls.push(id); } } } };
  else if (provider === "incompatible") globalThis.mod = { api: { ShowItemSourcesAndUses: { showList: true } } };
  class QuantityIcon extends Element {
    constructor() {
      super("item-quantity-icon"); this.container = new Element(); this.itemImage = new Element("img"); this.autoBuyIcon = new Element("img");
      this.container.className = "info-icon";
      this.autoBuyIcon.className = "d-none"; this.append(this.container); this.container.append(this.itemImage, this.autoBuyIcon);
      this.nativeClicks = 0;
    }
    setItem(item, quantity, allowQuickBuy = false) {
      this.itemQuantity = { item, quantity };
      this.autoBuyIcon.classList.toggle("d-none", !(allowQuickBuy && item?.buyable));
      this.container.onclick = () => this.nativeClicks++;
      return "native result";
    }
  }
  class CurrentIcon extends QuantityIcon {
    constructor() { super(); this.tagName = "ITEM-CURRENT-ICON"; }
    setItem(item, quantity, actualGame, allowQuickBuy = false) {
      assert.equal(actualGame, game); this.item = item;
      this.autoBuyIcon.classList.toggle("d-none", !(allowQuickBuy && item?.buyable));
    }
  }
  class ChanceIcon extends QuantityIcon {
    constructor() { super(); this.tagName = "ITEM-CHANCE-ICON"; }
    setItem(item) { this.item = item; }
  }
  class StockpileIcon extends QuantityIcon {
    constructor() { super(); this.tagName = "COOKING-STOCKPILE-ICON"; }
    setItem(item) { this.item = item; }
    unsetItem() { this.item = undefined; }
  }
  class RecipeOption extends Element {
    constructor() { super("item-recipe-option"); this.recipeImage = new Element("img"); this.append(this.recipeImage); }
    setUnlocked(recipe) { this.recipeImage.alt = recipe.product?.name; }
  }
  class HerbloreOption extends Element {
    constructor() { super("herblore-recipe-option"); this.recipeImage = new Element("img"); this.append(this.recipeImage); }
    setUnlocked(recipe) { this.recipeImage.alt = recipe.potions[game.herblore.getPotionTier(recipe)].name; }
  }
  class FishOption extends Element {
    constructor() { super("fishing-area-menu-button"); this.fishImage = new Element("img"); this.append(this.fishImage); }
    setFishUnlocked(fish) { this.fishImage.alt = fish.product.name; }
    setFishLocked() { this.fishImage.alt = "Locked"; }
  }
  class UpgradeMenu extends Element {
    constructor() {
      super("item-upgrade-menu"); this.itemCosts = new Element("span"); this.currencyCosts = new Element("span"); this.itemImage = new Element("img");
      this.itemImage.className = "w-100"; this.itemTooltips = []; this.currencyTooltips = [];
      this.append(this.itemImage, this.currencyCosts, this.itemCosts);
    }
    setUpgradeCosts(upgrade, bank, actualGame) {
      assert.equal(actualGame, game);
      this.currencyCosts.replaceChildren(); this.itemCosts.replaceChildren();
      for (const tooltip of [...this.currencyTooltips, ...this.itemTooltips]) tooltip.destroyed = true;
      this.currencyTooltips = []; this.itemTooltips = [];
      for (const [costs, container, tooltips] of [[upgrade.currencyCosts, this.currencyCosts, this.currencyTooltips], [upgrade.itemCosts, this.itemCosts, this.itemTooltips]]) {
        for (const cost of costs) {
          const value = cost.item ?? cost.currency, image = new Element("img"), quantity = new Element("span");
          image.className = "skill-icon-sm mr-1"; image.src = value.media;
          quantity.textContent = `${cost.quantity}`; quantity.className = cost.item && bank.getQty(cost.item) < cost.quantity ? "text-danger" : "text-success";
          tooltips.push({ target: image, content: value.name, destroyed: false }); container.append(image, quantity);
        }
      }
      return "native upgrade costs";
    }
  }
  const classes = new Map([["item-quantity-icon", QuantityIcon], ["item-current-icon", CurrentIcon], ["item-chance-icon", ChanceIcon], ["cooking-stockpile-icon", StockpileIcon], ["item-recipe-option", RecipeOption],
    ["herblore-recipe-option", HerbloreOption], ["fishing-area-menu-button", FishOption], ["item-upgrade-menu", UpgradeMenu]]);
  if (!upgradeRegistered) classes.delete("item-upgrade-menu");
  globalThis.customElements = { get: tag => classes.get(tag) };
  const ctx = {
    settings: { section(name) {
      assert.equal(name, "General");
      return {
        add(config) {
          values.set(config.name, config.default);
          const root = config.render(`BetterUI:${config.name}`, () => {
            const next = config.get(root), result = config.onChange(next);
            if (result === undefined || result === true) values.set(config.name, next);
            config.set(root, values.get(config.name));
          }, config);
          fields.set(config.name, { config, root });
          values.set(config.name, saved); config.set(root, saved);
        },
        get: name => values.get(name),
      };
    } },
    onCharacterLoaded(callback) { hooks.character = callback; },
    onInterfaceReady(callback) { hooks.interface = callback; },
    patch(Class, method) {
      patches.push([Class, method]);
      return { after(callback) {
        const original = Class.prototype[method];
        Class.prototype[method] = function (...args) {
          const result = original.apply(this, args); callback.call(this, result, ...args); return result;
        };
      } };
    },
  };
  install(ctx, game);
  const field = fields.get("recipe-item-sources-enabled");
  const toggle = enabled => { const input = field.root.querySelector("input"); input.checked = enabled; input.dispatch("change"); };
  return { game, items, calls, observers, patches, hooks, field, values, page, nativeRoot, workforce, skillRoot, head, QuantityIcon, CurrentIcon, ChanceIcon, StockpileIcon, RecipeOption, HerbloreOption, FishOption, UpgradeMenu, registerUpgrade: () => classes.set("item-upgrade-menu", UpgradeMenu), toggle };
}

function sourceButton(icon) { return icon.querySelector(".kroky-item-source-button"); }

test("only Summoning output loses its shortcut while ingredients and other products retain theirs", () => {
  const f = fixture("available", true), costs = new Element(), products = new Element();
  costs.className = "kroky-production-costs"; products.className = "kroky-production-products";
  f.skillRoot.append(costs, products);
  const ingredient = new f.QuantityIcon(), product = new f.QuantityIcon();
  costs.append(ingredient); products.append(product);
  ingredient.setItem(f.items[0], 1); product.setItem(f.items[1], 1); f.hooks.interface();
  assert.ok(sourceButton(product), "ordinary production outputs keep their shortcut");
  f.nativeRoot.id = "summoning-container";
  ingredient.setItem(f.items[0], 1); product.setItem(f.items[1], 1);
  assert.equal(sourceButton(ingredient).hidden, false);
  assert.equal(sourceButton(product).hidden, true);
  const tablet = new f.QuantityIcon(); products.append(tablet); tablet.setItem(f.items[1], 1);
  assert.equal(sourceButton(tablet), null, "produced Summoning tablets do not gain a question mark");
  sourceButton(ingredient).click(); assert.deepEqual(f.calls, [f.items[0].id]);
  f.nativeRoot.id = "smithing-container"; product.setItem(f.items[1], 1);
  assert.equal(sourceButton(product).hidden, false, "the exclusion is limited to Summoning products");
});

test("provider detection supports Melvor's lexical const mod binding", async () => {
  const source = await readFile(new URL("../item-sources-and-uses.mjs", import.meta.url), "utf8");
  const f = fixture("missing", false, (ctx, game) => {
    const context = createContext({ document, customElements, MutationObserver, Game, console });
    runInContext("const mod = { api: { ShowItemSourcesAndUses: { showList() {} } } };", context);
    assert.equal(context.mod, undefined, "native const declarations are not properties of the global object");
    const install = runInContext(`${source.replace("export function", "function")}\ninstallItemSourcesAndUses;`, context);
    install(ctx, game);
  });
  assert.equal(f.field.root.querySelector("input").disabled, false);
  assert.match(f.field.root.querySelector("small").textContent, /Add a blue/);
});

test("missing or incompatible providers leave an explained, disabled switch and preserve its saved preference", () => {
  for (const provider of ["missing", "incompatible"]) {
    delete globalThis.mod;
    const f = fixture(provider, true), { config, root } = f.field;
    assert.equal(config.type, "custom"); assert.equal(config.default, false);
    assert.equal(root.querySelector("input").disabled, true);
    assert.match(root.querySelector("small").textContent, /installed and enabled.*compatible API.*Reload/);
    assert.equal(config.get(root), true, "restoring an unavailable provider does not destroy the saved choice");
    assert.equal(typeof config.onChange(true), "string");
    assert.equal(f.patches.length, 0, "missing optional integration does not patch gameplay or icons");
    assert.equal(f.observers.length, 0);
  }
});

test("the available integration starts off, restores per-character settings and never patches game rendering", () => {
  const f = fixture(), icon = new f.QuantityIcon(); f.skillRoot.append(icon); icon.setItem(f.items[0], 1);
  assert.equal(f.field.root.querySelector("input").disabled, false);
  f.hooks.interface(); assert.equal(sourceButton(icon), null); assert.equal(f.observers.length, 0);
  assert.equal(typeof f.field.config.onChange("true"), "string");
  f.toggle(true); assert.ok(sourceButton(icon)); assert.equal(f.page.classList.contains("kroky-item-sources-enabled"), true);
  assert.equal(f.observers.length, 1); assert.deepEqual(f.observers[0].nodes.get(f.workforce), { childList: true, subtree: true });
  f.toggle(false); assert.equal(f.page.classList.contains("kroky-item-sources-enabled"), false);
  assert.equal(f.observers[0].nodes.size, 0);
  sourceButton(icon).click(); assert.deepEqual(f.calls, [], "a disabled feature cannot invoke the provider through retained markup");
  f.game.decode(true); assert.equal(f.page.classList.contains("kroky-item-sources-enabled"), true);
  f.values.set("recipe-item-sources-enabled", false); f.hooks.character();
  assert.equal(f.page.classList.contains("kroky-item-sources-enabled"), false);
  assert.equal(f.patches.some(([, method]) => method === "render"), false);
});

test("item changes reuse one button and keep the normal icon action and keyboard events independent", () => {
  const f = fixture("available", true), icon = new f.QuantityIcon(); f.skillRoot.append(icon);
  assert.equal(icon.setItem(f.items[0], 1), "native result"); f.hooks.interface();
  const button = sourceButton(icon);
  assert.equal(button.type, "button"); assert.equal(button.getAttribute("aria-label"), "Show sources and uses for Iron");
  for (const name of ["keydown", "keyup", "dblclick"]) assert.equal(button.dispatch(name).stopped, true);
  assert.deepEqual(f.calls, []);
  assert.equal(button.click().prevented, true); assert.deepEqual(f.calls, [f.items[0].id]); assert.equal(icon.nativeClicks, 0);
  icon.itemImage.click(); assert.equal(icon.nativeClicks, 1);
  icon.setItem(f.items[1], 2); icon.setItem(f.items[1], 3);
  assert.equal(icon.querySelectorAll(".kroky-item-source-button").length, 1);
  assert.equal(button.title, "Show sources and uses for Coal"); button.click(); assert.equal(f.calls.at(-1), f.items[1].id);
  assert.deepEqual(icon.itemQuantity, { item: f.items[1], quantity: 3 }, "the integration preserves the native item binding");
});

test("Quick Buy coins exclude ingredients but a shop-sold output remains eligible in both icon types", () => {
  const f = fixture("available", true); f.hooks.interface();
  for (const Icon of [f.QuantityIcon, f.CurrentIcon]) {
    const icon = new Icon(); f.skillRoot.append(icon);
    const bind = (item, shop) => Icon === f.CurrentIcon ? icon.setItem(item, 1, f.game, shop) : icon.setItem(item, 1, shop);
    bind(f.items[2], true); assert.equal(sourceButton(icon), null, "the existing gold coin wins over a new question mark");
    bind(f.items[2], false); const button = sourceButton(icon); assert.ok(button); assert.equal(button.hidden, false);
    bind(f.items[2], true); assert.equal(button.hidden, true, "reusing an output tile for a buyable ingredient hides its old question mark");
    bind(f.items[1], true); assert.equal(button.hidden, false, "allowing Quick Buy alone does not exclude items without a coin");
  }
});

test("shared native icon images keep their direct-child sizing and original order", () => {
  const f = fixture("available", true), icon = new f.QuantityIcon(); f.skillRoot.append(icon);
  icon.setItem(f.items[0], 1); f.hooks.interface();
  assert.equal(icon.itemImage.parentElement, icon.container, "native .info-icon > img sizing still applies");
  assert.deepEqual(icon.container.children, [icon.itemImage, icon.autoBuyIcon, sourceButton(icon)]);
  assert.equal(icon.querySelector(".kroky-item-source-icon"), null, "shared components do not gain an image wrapper");
  f.toggle(false); f.toggle(true); icon.setItem(f.items[1], 2);
  assert.equal(icon.itemImage.parentElement, icon.container);
  assert.deepEqual(icon.container.children, [icon.itemImage, icon.autoBuyIcon, sourceButton(icon)]);
});

test("visible source buttons stay accessible after Workforce restores an image role during item updates", () => {
  const f = fixture("available", true), product = new f.QuantityIcon(), hero = new f.CurrentIcon();
  const quantity = new Element("small"); product.container.append(quantity); hero.itemImage.classList.add("kroky-production-image");
  f.skillRoot.append(product, hero); product.container.setAttribute("role", "img"); hero.container.setAttribute("role", "img");
  product.setItem(f.items[0], 1); hero.setItem(f.items[0], 0, f.game); f.hooks.interface();
  assert.equal(product.container.getAttribute("role"), "group", "a visible nested button is exposed to assistive technology");
  product.setItem(f.items[1], 2); product.container.setAttribute("role", "img"); quantity.textContent = "2";
  f.observers[0].callback([{ target: quantity, addedNodes: [{ nodeType: 3 }] }]);
  assert.equal(product.container.getAttribute("role"), "group", "the native quantity mutation repairs a later Workforce role overwrite");
  assert.equal(hero.container.getAttribute("role"), "img"); assert.equal(sourceButton(hero), null);
  product.setItem(f.items[2], 1, true); product.container.setAttribute("role", "img");
  f.observers[0].callback([{ target: quantity, addedNodes: [{ nodeType: 3 }] }, { target: hero.container, addedNodes: [] }]);
  assert.equal(sourceButton(product).hidden, true); assert.equal(product.container.getAttribute("role"), "img");
  assert.equal(hero.container.getAttribute("role"), "img", "main artwork without a button keeps its native role");
  assert.deepEqual(f.calls, [], "accessibility updates never request item information");
});

test("detached bindings decorate when cards mount, while other pages and text-only updates are ignored", () => {
  const f = fixture("available", true); f.hooks.interface();
  const detached = new f.QuantityIcon(); detached.setItem(f.items[0], 1);
  assert.equal(sourceButton(detached), null);
  f.skillRoot.append(detached); f.observers[0].callback([{ addedNodes: [detached] }]);
  assert.ok(sourceButton(detached));
  f.observers[0].callback([{ addedNodes: [detached, { nodeType: 3 }] }]);
  assert.equal(detached.querySelectorAll(".kroky-item-source-button").length, 1);
  const outside = new f.QuantityIcon(); f.page.append(outside); outside.setItem(f.items[0], 1);
  f.observers[0].callback([{ addedNodes: [outside] }]); assert.equal(sourceButton(outside), null);
  assert.deepEqual(f.calls, [], "binding and scanning never calculate sources or uses");
});

test("only registered concrete items receive a button and stale item bindings cannot open a dialog", () => {
  const f = fixture("available", true); f.hooks.interface();
  const icon = new f.QuantityIcon(); f.skillRoot.append(icon);
  icon.setItem({ id: f.items[0].id, name: "Unregistered clone" }, 1); assert.equal(sourceButton(icon), null);
  icon.setItem({ id: "test:Missing", name: "Spell artwork" }, 1); assert.equal(sourceButton(icon), null);
  icon.setItem(f.items[0], 1); const button = sourceButton(icon); assert.ok(button);
  icon.setItem({ id: "test:Missing", name: "Removed item" }, 1);
  assert.equal(button.hidden, true); button.click(); assert.deepEqual(f.calls, []);
  icon.setItem(f.items[1], 1); assert.equal(button.hidden, false); button.click(); assert.deepEqual(f.calls, [f.items[1].id]);
});

test("main artwork remains plain while recipe ingredient and product item icons receive buttons", () => {
  const f = fixture("available", true), ordinary = new f.RecipeOption(), potion = new f.HerbloreOption(), fish = new f.FishOption();
  const hero = new f.CurrentIcon(), product = new f.QuantityIcon();
  hero.classList.add("kroky-production-stock"); hero.itemImage.classList.add("kroky-production-image");
  f.skillRoot.append(ordinary, potion, fish, hero, product); ordinary.setUnlocked({ product: f.items[0] });
  const recipe = { id: "test:PotionRecipe", potions: [f.items[3], f.items[4]] };
  potion.setUnlocked(recipe); fish.setFishUnlocked({ product: f.items[0] }); hero.setItem(f.items[3], 0, f.game); product.setItem(f.items[3], 1);
  f.hooks.interface();
  for (const art of [ordinary, potion, fish, hero]) assert.equal(sourceButton(art) === null, true, "main artwork never receives a question mark");
  assert.equal(ordinary.recipeImage.parentElement, ordinary); assert.equal(potion.recipeImage.parentElement, potion);
  assert.equal(fish.fishImage.parentElement, fish); assert.equal(hero.itemImage.parentElement, hero.container);
  sourceButton(product).click(); assert.deepEqual(f.calls, [f.items[3].id]);
  f.game.herblore.tier = 1; potion.setUnlocked(recipe); product.setItem(f.items[4], 1); sourceButton(product).click();
  assert.equal(f.calls.at(-1), f.items[4].id); assert.equal(sourceButton(potion), null);
  assert.equal(f.patches.some(([, method]) => ["setUnlocked", "setFishUnlocked", "updateRecipeCosts"].includes(method)), false);
});

test("question marks mirror the native shop overlay at the top right", () => {
  const f = fixture("available", true), icon = new f.QuantityIcon();
  f.skillRoot.append(icon); icon.setItem(f.items[0], 1); f.hooks.interface();
  assert.equal(sourceButton(icon).classList.contains("info-icon-overlay"), true);
  assert.equal(sourceButton(icon).classList.contains("skill-icon-xxs"), true);
  const rule = f.head.querySelector("style").textContent.match(/\.kroky-item-source-button:not\(\[hidden\]\)\s*\{([^}]+)\}/s)?.[1];
  assert.ok(rule);
  assert.match(rule, /left:\s*auto\s*;/); assert.match(rule, /right:\s*-6px\s*;/);
  assert.doesNotMatch(rule, /(?:^|[;\s])(?:position|top|bottom|width|height|margin)\s*:/);
});

test("Workforce output tiles are enabled while original native Smithing icons remain untouched", () => {
  const f = fixture("available", true), original = new f.QuantityIcon(); f.nativeRoot.append(original); original.setItem(f.items[0], 1);
  const outputs = [];
  for (const [id, stockClass] of [["woodcutting-tree-container", "kroky-woodcutting-stock"], ["mining-ores-container", "kroky-mining-stock"], ["fishing-area-menu-container", "kroky-fishing-stock"]]) {
    const area = new Element(), stock = new f.CurrentIcon(); area.id = id; stock.className = stockClass;
    f.page.append(area); area.append(stock); stock.setItem(f.items[0], 0, f.game); outputs.push(stock);
  }
  f.hooks.interface();
  assert.equal(sourceButton(original), null); assert.equal(original.itemImage.parentElement, original.container);
  assert.equal(f.observers[0].nodes.has(f.nativeRoot), false, "the original Smithing page is not observed");
  for (const stock of outputs) { assert.ok(sourceButton(stock)); sourceButton(stock).click(); }
  assert.deepEqual(f.calls, [f.items[0].id, f.items[0].id, f.items[0].id]);
});

test("native Firemaking and Cooking ingredients and products are supported without decorating shop shortcuts", () => {
  const f = fixture("available", true), nativeIcons = [];
  for (const id of ["firemaking-container", "cooking-container"]) {
    const area = new Element(); area.id = id; f.page.append(area);
    const ingredient = new f.QuantityIcon(), product = new f.ChanceIcon(), stockpile = new f.StockpileIcon(), shop = new f.QuantityIcon();
    area.append(ingredient, product, stockpile, shop); ingredient.setItem(f.items[0], 1); product.setItem(f.items[1]); stockpile.setItem(f.items[3]); shop.setItem(f.items[2], 1, true);
    nativeIcons.push({ area, ingredient, product, stockpile, shop });
  }
  f.hooks.interface();
  for (const { area, ingredient, product, stockpile, shop } of nativeIcons) {
    assert.equal(f.observers[0].nodes.has(area), true);
    for (const icon of [ingredient, product, stockpile]) { assert.ok(sourceButton(icon)); assert.equal(icon.itemImage.parentElement, icon.container); }
    assert.equal(sourceButton(shop), null);
    sourceButton(product).click(); assert.equal(f.calls.at(-1), f.items[1].id);
    stockpile.unsetItem(); assert.equal(sourceButton(stockpile).hidden, true);
  }
});

function upgradeFixture(f) {
  const modal = new Element(), menu = new f.UpgradeMenu(); modal.id = "modal-item-upgrade";
  f.page.append(modal); modal.append(menu);
  const upgrade = { currencyCosts: [{ currency: { id: "test:GP", name: "GP", media: "coins.png" }, quantity: 100000 }],
    itemCosts: [{ item: f.items[0], quantity: 1 }, { item: f.items[1], quantity: 500 }, { item: f.items[2], quantity: 2 }] };
  const bank = { getQty: item => item === f.items[0] ? 10 : 0 };
  return { modal, menu, upgrade, bank };
}

test("upgrade material costs expose sources without changing currencies, main artwork, quantities or native tooltip targets", () => {
  const f = fixture("available", true), { modal, menu, upgrade, bank } = upgradeFixture(f);
  f.hooks.interface(); assert.equal(menu.setUpgradeCosts(upgrade, bank, f.game), "native upgrade costs");
  assert.equal(menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 3);
  assert.equal(menu.currencyCosts.querySelectorAll(".kroky-item-source-button").length, 0);
  assert.equal(menu.itemImage.parentElement, menu, "large upgrade artwork stays in its native parent");
  assert.equal(menu.itemImage.className, "w-100");
  assert.equal(f.observers[0].nodes.has(modal), true, "only the existing upgrade modal joins the observed roots");
  assert.deepEqual(menu.itemCosts.children.filter(node => node.tagName === "SPAN" && !node.querySelector("img")).map(node => [node.textContent, node.className]),
    [["1", "text-success"], ["500", "text-danger"], ["2", "text-danger"]]);
  for (const [index, tooltip] of menu.itemTooltips.entries()) {
    const image = tooltip.target, wrapper = image.parentElement;
    assert.equal(wrapper.classList.contains("kroky-upgrade-cost-icon"), true);
    assert.equal(wrapper.children[0], image, "the original image remains the native tooltip target");
    assert.equal(tooltip.destroyed, false); assert.equal(tooltip.content, upgrade.itemCosts[index].item.name);
    sourceButton(wrapper).click(); assert.equal(f.calls.at(-1), upgrade.itemCosts[index].item.id);
  }
  assert.equal(menu.currencyTooltips[0].target.parentElement, menu.currencyCosts, "currency images retain their native parent");
  assert.equal(menu.currencyTooltips[0].target.className, "skill-icon-sm mr-1");
  assert.equal(menu.querySelectorAll(".kroky-item-source-button").length, 3, "no stat, mastery or output art gets a shortcut");
});

test("refreshing upgrade costs keeps the new material bindings and native cost lifecycle without duplicate shortcuts", () => {
  const f = fixture("available", true), { menu, upgrade, bank } = upgradeFixture(f); f.hooks.interface();
  menu.setUpgradeCosts(upgrade, bank, f.game);
  const oldTooltips = [...menu.itemTooltips], oldImages = oldTooltips.map(tooltip => tooltip.target);
  const next = { ...upgrade, itemCosts: [{ item: f.items[4], quantity: 2 }, { item: f.items[3], quantity: 3 }] };
  menu.setUpgradeCosts(next, bank, f.game);
  assert.equal(oldTooltips.every(tooltip => tooltip.destroyed), true, "native tooltip cleanup still runs");
  assert.equal(menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 2);
  assert.equal(menu.itemCosts.querySelectorAll("img").some(image => oldImages.includes(image)), false);
  for (const [index, image] of menu.itemCosts.querySelectorAll("img").entries()) {
    sourceButton(image.parentElement).click(); assert.equal(f.calls.at(-1), next.itemCosts[index].item.id);
    f.observers[0].callback([{ target: menu.itemCosts, addedNodes: [image.parentElement] }]);
  }
  assert.equal(menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 2, "observed native changes do not add a second shortcut");
});

test("upgrade costs bound before readiness or while disabled decorate only when the existing source setting enables them", () => {
  for (const saved of [false, true]) {
    const f = fixture("available", saved), { menu, upgrade, bank } = upgradeFixture(f);
    menu.setUpgradeCosts(upgrade, bank, f.game);
    const images = [...menu.itemCosts.querySelectorAll("img")];
    assert.equal(menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 0);
    assert.equal(images.every(image => image.parentElement === menu.itemCosts), true, "disabled or unready integration leaves native images unwrapped");
    f.hooks.interface(); if (!saved) f.toggle(true);
    assert.equal(menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 3);
    const buttons = [...menu.itemCosts.querySelectorAll(".kroky-item-source-button")];
    f.toggle(false); for (const button of buttons) button.click(); assert.deepEqual(f.calls, []);
    f.toggle(true);
    assert.deepEqual(menu.itemCosts.querySelectorAll("img"), images);
    assert.deepEqual(menu.itemCosts.querySelectorAll(".kroky-item-source-button"), buttons);
    assert.equal(menu.currencyCosts.querySelectorAll(".kroky-item-source-button").length, 0);
  }
});

test("missing source providers leave upgrade costs native and the source switch disabled with its explanation", () => {
  const f = fixture("missing", true), { menu, upgrade, bank } = upgradeFixture(f);
  menu.setUpgradeCosts(upgrade, bank, f.game);
  assert.equal(menu.querySelectorAll(".kroky-item-source-button").length, 0);
  assert.equal(menu.itemTooltips.every(tooltip => tooltip.target.parentElement === menu.itemCosts), true);
  assert.equal(f.field.root.querySelector("input").disabled, true);
  assert.match(f.field.root.querySelector("small").textContent, /Requires Show Item Sources And Uses.*installed and enabled/);
  assert.equal(f.field.config.get(f.field.root), true, "a missing optional mod keeps the prior saved preference");
  assert.equal(f.patches.length, 0);
});

test("late-defined upgrade menus receive their source hook at interface readiness only once", () => {
  const f = fixture("available", true, installItemSourcesAndUses, false);
  assert.equal(f.patches.some(([Class]) => Class === f.UpgradeMenu), false, "native initMenus has not defined the upgrade element yet");
  f.registerUpgrade();
  const { menu, upgrade, bank } = upgradeFixture(f);
  f.hooks.interface(); menu.setUpgradeCosts(upgrade, bank, f.game);
  assert.equal(menu.itemCosts.querySelectorAll(".kroky-item-source-button").length, 3);
  f.hooks.interface(); f.hooks.interface(); menu.setUpgradeCosts(upgrade, bank, f.game);
  assert.equal(f.patches.filter(([Class, method]) => Class === f.UpgradeMenu && method === "setUpgradeCosts").length, 1);
  const buttons = menu.itemCosts.querySelectorAll(".kroky-item-source-button");
  assert.equal(buttons.length, 3);
  for (const button of buttons) button.click();
  assert.deepEqual(f.calls, upgrade.itemCosts.map(({ item }) => item.id), "one click invokes the provider once after repeated interface readiness");
});
