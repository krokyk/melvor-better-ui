import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installShopQuantities } from "../shop-quantities.mjs";

afterEach(() => {
  for (const name of ["Game", "Shop", "ShopMenu", "ShopConfirmModalItem", "ShopBuyQuantityMenu", "Swal", "SwalLocale", "document", "game", "shopMenu", "templateLangString", "numberWithCommas", "$" ]) delete globalThis[name];
});

class Element {
  constructor(className = "") {
    this.className = className; this.children = []; this.textContent = ""; this.disabled = false; this.attributes = {}; this.style = {};
    this.classList = { add: name => { this.className += ` ${name}`; }, contains: name => this.className.split(" ").includes(name) };
  }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
  closest(selector) { return this.classList.contains(selector.slice(1)) ? this : this.parentElement?.closest(selector); }
  querySelector(selector) { return this.children.find(child => selector === "#swal2-title" ? child.id === "swal2-title" : child.classList.contains(selector.slice(1))) ?? this.children.map(child => child.querySelector(selector)).find(Boolean); }
  get previousElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) - 1]; }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function fixture() {
  const state = { coins: 1_000_000, bankFits: true, requirements: true, awarded: [], confirmed: [], prompts: [], chooserCount: 0, restores: 0, warnings: 0, focusHandlers: [] };
  const kit = id => ({ id: `melvorF:Slayer_Upgrade_Kit_${id}`, name: `Slayer Gear Upgrade Kit (${id})`, media: "kit.png", isModded: false, allowQuantityPurchase: false,
    contains: { items: [{ item: { id }, quantity: 1 }] }, purchaseRequirements: [], limit: Infinity,
    getBuyLimit(mode) { const limit = this.modeLimits?.get(mode) ?? this.limit; return limit === 0 ? Infinity : limit; },
    getTemplatedDescription(shop) { return `${shop.buyQuantity} kits`; } });
  const strong = kit("Strong"), elite = kit("Elite"), master = kit("Master"), single = { ...kit("Permanent"), id: "melvorD:Multi_Tree", limit: 1 };
  const foreignKit = { ...kit("Strong"), id: "another:Slayer_Upgrade_Kit_Strong", isModded: true }, normal = { ...kit("Cheese"), id: "melvorD:Cheese", allowQuantityPurchase: true };
  const legendary = { ...kit("Legendary"), id: "melvorTotH:Slayer_Upgrade_Kit_Legendary" };
  const mythical = { ...kit("Mythical"), id: "melvorTotH:Slayer_Upgrade_Kit_Mythical" };
  const extra = ["melvorF:Slayer_Helmet_Basic", "melvorF:Skilling_Outfit_Upgrade", "melvorAoD:Archaeologists_Hat", "melvorItA:Abyssal_Slayer_Helmet_Woeful", "melvorD:Golbin_Raid_Weapon"].map(id => ({ ...kit(id), id }));
  const excluded = ["stats", "pet", "itemCharges", "lootBox", "bankTab"].map(key => ({ ...kit(key), contains: { items: [{ item: { id: key }, quantity: 1 }], [key]: {} } }));
  excluded.push({ ...kit("empty"), contains: { items: [] } });
  const limited = { ...kit("limited"), limit: 2 };
  const purchases = [strong, elite, master, legendary, mythical, single, foreignKit, normal, ...extra, ...excluded, limited];
  const loads = [];
  globalThis.document = { createElement: () => new Element(), querySelector: selector => selector === ".modal.show" ? state.underlyingModal : undefined };
  globalThis.numberWithCommas = value => value.toLocaleString("en-US");
  globalThis.templateLangString = (id, values) => id === "SHOP_MISC_10" ? `Buy ${values.qty} x ${values.shopName}?` : `Buy ${values.shopName}?`;
  globalThis.$ = target => ({ on(name, selector, callback) { state.focusHandlers.push({ target, name, selector, callback }); } });
  let popup, pending;
  globalThis.Swal = {
    getPopup: () => popup, getTitle: () => popup?.querySelector("#swal2-title"), getConfirmButton: () => popup?.querySelector(".swal2-confirm"),
    getHtmlContainer: () => popup?.querySelector(".swal2-html-container"),
    update(options) { Object.assign(popup.options, options); if (options.title !== undefined) this.getTitle().textContent = options.title; },
  };
  globalThis.SwalLocale = { fire(options) {
    popup = new Element("swal2-popup"); popup.options = options;
    const title = new Element(), confirm = new Element("swal2-confirm"); title.id = "swal2-title"; title.textContent = options.title;
    const html = new Element("swal2-html-container"); html.style.overflow = "auto"; html.append(options.html);
    popup.append(title, html, confirm); state.prompts.push(popup);
    return new Promise(resolve => { pending = resolve; });
  } };
  globalThis.ShopConfirmModalItem = class {
    constructor(purchase, game) {
      this.purchase = purchase; this.game = game; this.parent = new Element(); this.description = new Element(); this.costContainer = new Element();
      this.description.innerHTML = purchase.getTemplatedDescription(game.shop); this.parent.append(this.description, this.costContainer); this.updateCostElements();
    }
    get buyQty() { return this.purchase.allowQuantityPurchase ? this.game.shop.capPurchaseQuantity(this.purchase, this.game.shop.buyQuantity) : 1; }
    updateCostElements() { this.costContainer.textContent = `${this.buyQty * 50_000}`; }
    updatePurchaseRequirements() { this.requirementsMet = state.requirements; }
    updateForQuantityChange() { this.updateCostElements(); }
    destroy() { this.destroyed = true; }
  };
  globalThis.ShopBuyQuantityMenu = class {
    constructor(parent) { this.parent = parent; this.container = new Element("dropdown"); this.button = new Element("shop-buy-qty-btn"); this.button.textContent = "Buy x1"; this.container.append(this.button); parent.append(this.container); state.chooserCount++; }
    select(quantity) { globalThis.game.shop.updateBuyQuantity(quantity); }
    destroy() { this.container.remove(); }
  };
  globalThis.Shop = class {
    constructor() { this.buyQuantity = 5; this.purchases = { allObjects: purchases, getObjectByID: id => purchases.find(p => p.id === id) }; this.bought = new Map(); }
    capPurchaseQuantity(purchase, quantity) { return Math.min(purchase.getBuyLimit(this.game.currentGamemode) - (this.bought.get(purchase) ?? 0), quantity); }
    isPurchaseAtBuyLimit(purchase) { return this.capPurchaseQuantity(purchase, 1) <= 0; }
    getPurchaseCosts(_purchase, quantity) { return { checkIfOwned: () => state.coins >= quantity * 50_000 }; }
    updateBuyQuantity(quantity) { this.buyQuantity = Math.min(4294967295, quantity); for (const child of popup?.options.html.children ?? []) for (const node of child.children) if (node.classList.contains("dropdown")) node.children[0].textContent = `Buy x${this.buyQuantity}`; globalThis.shopMenu.updateForBuyQtyChange(); }
    buyItemOnClick(purchase, confirmed = false) {
      if (!this.game.tutorial.complete && !this.game.tutorial.allowedShopPurchases.has(purchase)) { state.warnings++; return; }
      const quantity = purchase.allowQuantityPurchase ? this.capPurchaseQuantity(purchase, this.buyQuantity) : 1;
      if (this.isPurchaseAtBuyLimit(purchase) || !this.getPurchaseCosts(purchase, quantity).checkIfOwned() || !this.game.checkRequirements(purchase.purchaseRequirements)) return;
      if (!confirmed && this.game.settings.showShopConfirmations) { globalThis.shopMenu.showConfirmBuyPrompt(purchase); return; }
      state.confirmed.push([purchase, quantity]); if (!state.bankFits) return;
      state.coins -= quantity * 50_000; state.awarded.push([purchase, quantity]); this.bought.set(purchase, (this.bought.get(purchase) ?? 0) + quantity);
    }
  };
  globalThis.ShopMenu = class {
    constructor(game) { this.game = game; }
    showConfirmBuyPrompt(purchase) {
      if (this.confirmBuyItem) throw new Error("Already confirming");
      this.confirmBuyItem = new ShopConfirmModalItem(purchase, this.game);
      SwalLocale.fire({ title: purchase.allowQuantityPurchase ? templateLangString("SHOP_MISC_10", { qty: `${this.game.shop.buyQuantity}`, shopName: purchase.name }) : templateLangString("SHOP_MISC_7", { shopName: purchase.name }), html: this.confirmBuyItem.parent }).then(result => {
        if (result.value) this.game.shop.buyItemOnClick(purchase, true);
        this.confirmBuyItem?.destroy(); this.confirmBuyItem = undefined;
      });
    }
    updateForBuyQtyChange() { this.confirmBuyItem?.updateForQuantityChange(); }
    updateForCostChange() { this.confirmBuyItem?.updateCostElements(); }
    updateForRequirementChange() { this.confirmBuyItem?.updatePurchaseRequirements(); }
  };
  globalThis.Game = class { decode(mode) { this.currentGamemode = mode; return "native decode"; } };
  const game = globalThis.game = Object.assign(new Game(), { currentGamemode: {}, settings: { showShopConfirmations: true }, tutorial: { complete: true, allowedShopPurchases: new Set() }, checkRequirements: () => state.requirements });
  game.shop = new Shop(); game.shop.game = game; globalThis.shopMenu = new ShopMenu(game);
  const ctx = { onCharacterLoaded: callback => loads.push(callback), patch(Class, method) {
    const native = Class.prototype[method];
    return { after(callback) { Class.prototype[method] = function (...args) { const result = native.apply(this, args); callback.call(this, result, ...args); return result; }; },
      replace(callback) { Class.prototype[method] = function (...args) { return callback.call(this, native.bind(this), ...args); }; } };
  } };
  installShopQuantities(ctx, game, () => { state.restores++; });
  return { state, game, strong, elite, master, legendary, mythical, single, foreignKit, normal, extra, excluded, limited, menu: globalThis.shopMenu,
    load(mode) { game.currentGamemode = mode; loads.forEach(callback => callback()); },
    popup: () => popup, title: () => Swal.getTitle().textContent, button: () => Swal.getConfirmButton(),
    chooser: () => globalThis.shopMenu.confirmBuyItem?.quantityMenu,
    async respond(value) { const old = popup; pending({ value }); await Promise.resolve(); old.options.didClose?.(); popup = undefined; },
  };
}

test("missing native Shop classes are harmless", () => { assert.doesNotThrow(() => installShopQuantities({}, {})); });

test("all five repeatable native Slayer kits gain bulk buying", () => {
  const f = fixture(); for (const purchase of [f.strong, f.elite, f.master, f.legendary, f.mythical]) assert.equal(purchase.allowQuantityPurchase, true, purchase.id);
  assert.equal(f.single.allowQuantityPurchase, false); assert.equal(f.foreignKit.allowQuantityPurchase, false); assert.equal(f.normal.allowQuantityPurchase, true);
});

test("Slayer kit confirmation respects the shared quantity and has a native chooser", async () => {
  const f = fixture(); f.game.shop.buyItemOnClick(f.strong);
  assert.equal(f.state.awarded.length, 0); assert.equal(f.state.chooserCount, 1); assert.match(f.title(), /5 x Slayer/);
  assert.equal(Swal.getHtmlContainer().style.overflow, "visible", "native dropdown options extend beyond the short confirmation body");
  assert.equal(Swal.getHtmlContainer().style.zIndex, "2", "quantity options paint above the later native Buy and Cancel actions");
  assert.equal(f.menu.confirmBuyItem.costContainer.textContent, "250000"); assert.equal(f.button().disabled, false);
  await f.respond(true); assert.deepEqual(f.state.awarded, [[f.strong, 5]]); assert.equal(f.state.restores, 1);
});

test("an unaffordable batch still opens its chooser and changing it updates native costs and Buy", async () => {
  const f = fixture(); f.game.shop.buyQuantity = 100_000; f.game.shop.buyItemOnClick(f.strong);
  assert.equal(f.state.prompts.length, 1); assert.equal(f.button().disabled, true); assert.match(f.title(), /100,000 x/);
  f.chooser().select(3); assert.match(f.title(), /3 x/); assert.equal(f.menu.confirmBuyItem.costContainer.textContent, "150000");
  assert.equal(f.menu.confirmBuyItem.description.innerHTML, "3 kits"); assert.equal(f.button().disabled, false); assert.equal(f.game.shop.buyQuantity, 3);
  await f.respond(true); assert.deepEqual(f.state.awarded, [[f.strong, 3]]); assert.equal(f.state.coins, 850_000);
});

test("existing bulk purchases use the same chooser and display their capped quantity", async () => {
  const f = fixture(); f.normal.limit = 7; f.game.shop.bought.set(f.normal, 5); f.game.shop.buyQuantity = 10;
  f.game.shop.buyItemOnClick(f.normal); assert.equal(f.state.chooserCount, 1); assert.match(f.title(), /2 x/);
  assert.equal(f.menu.confirmBuyItem.costContainer.textContent, "100000"); await f.respond(true);
  assert.deepEqual(f.state.awarded, [[f.normal, 2]]); assert.equal(f.game.shop.buyQuantity, 10);
});

test("cost and requirement refreshes update Buy without extra dialogs or polling", () => {
  const f = fixture(); f.game.shop.buyItemOnClick(f.normal); assert.equal(f.button().disabled, false);
  f.state.coins = 0; f.menu.updateForCostChange(); assert.equal(f.button().disabled, true);
  f.state.coins = 1_000_000; f.menu.updateForCostChange(); assert.equal(f.button().disabled, false);
  f.state.requirements = false; f.menu.updateForRequirementChange(); assert.equal(f.button().disabled, true);
  assert.equal(f.state.prompts.length, 1); assert.equal(f.state.chooserCount, 1);
});

test("native final purchase guards survive changes between opening and confirmation", async () => {
  for (const guard of ["funds", "requirements", "bank", "limit"]) {
    const f = fixture(); f.game.shop.buyItemOnClick(f.normal);
    if (guard === "funds") f.state.coins = 0;
    if (guard === "requirements") f.state.requirements = false;
    if (guard === "bank") f.state.bankFits = false;
    if (guard === "limit") f.game.shop.bought.set(f.normal, f.normal.limit = 1);
    await f.respond(true); assert.deepEqual(f.state.awarded, [], guard); assert.equal(f.state.coins, guard === "funds" ? 0 : 1_000_000);
  }
});

test("single purchases, tutorial warnings and disabled confirmations retain native behavior", async () => {
  const f = fixture(); f.game.shop.buyItemOnClick(f.single); assert.equal(f.state.chooserCount, 0); await f.respond(false);
  assert.equal(f.state.awarded.length, 0); f.game.tutorial.complete = false; f.game.shop.buyItemOnClick(f.normal); assert.equal(f.state.warnings, 1);
  f.game.tutorial.complete = true; f.game.settings.showShopConfirmations = false; f.game.shop.buyItemOnClick(f.normal);
  assert.deepEqual(f.state.awarded, [[f.normal, 5]]); assert.equal(f.state.prompts.length, 1);
});

test("closing a confirmation removes the native chooser and stops subsequent refresh work", async () => {
  const f = fixture(); f.game.shop.buyItemOnClick(f.normal); const view = f.menu.confirmBuyItem;
  assert.ok(f.chooser()); await f.respond(false); assert.equal(view.destroyed, true); assert.equal(f.menu.confirmBuyItem, undefined);
  assert.equal(f.state.restores, 1); f.menu.updateForCostChange(); f.menu.updateForRequirementChange(); f.menu.updateForBuyQtyChange();
  assert.equal(f.state.prompts.length, 1); assert.deepEqual(f.state.awarded, []);
});

test("the native quantity input keeps focus above Bootstrap without trapping unrelated dialogs", () => {
  const f = fixture(); f.game.shop.buyItemOnClick(f.normal); const handler = f.state.focusHandlers[0].callback;
  let stopped = 0; const event = { currentTarget: f.popup(), stopPropagation() { stopped++; } };
  handler(event); assert.equal(stopped, 0, "standalone confirmations do not suppress other focus handlers");
  f.state.underlyingModal = new Element("modal show"); handler(event); assert.equal(stopped, 1);
  handler({ ...event, currentTarget: new Element("swal2-popup") }); assert.equal(stopped, 1);
});

test("unrelated Shop instances keep their native buying path", () => {
  const f = fixture(), other = new Shop(); other.game = f.game;
  other.buyItemOnClick(f.foreignKit, true); assert.deepEqual(f.state.awarded, [[f.foreignKit, 1]]); assert.equal(f.state.prompts.length, 0);
});

for (const tier of ["legendary", "mythical"]) test(`${tier} kit opens its quantity chooser and uses the selected batch`, async () => {
  const f = fixture(), purchase = f[tier]; f.game.shop.buyQuantity = 3;
  f.game.shop.buyItemOnClick(purchase);
  assert.ok(f.chooser(), `${purchase.id} must expose its quantity selector`);
  assert.match(f.title(), /Buy 3 x/); assert.equal(f.menu.confirmBuyItem.costContainer.textContent, "150000");
  f.chooser().select(2); await f.respond(true);
  assert.deepEqual(f.state.awarded, [[purchase, 2]]);
});

test("native repeatable item-only purchases across content use the shared bulk rule", async () => {
  const f = fixture(); f.game.shop.buyQuantity = 3;
  for (const purchase of f.extra) {
    assert.equal(purchase.allowQuantityPurchase, true, purchase.id);
    f.game.shop.buyItemOnClick(purchase); assert.ok(f.chooser(), purchase.id); assert.match(f.title(), /Buy 3 x/);
    await f.respond(false);
  }
  assert.deepEqual(f.state.awarded, []); assert.equal(f.game.shop.buyQuantity, 3);
});

test("single purchases, modded purchases and special rewards retain their native flags", () => {
  const f = fixture();
  for (const purchase of [f.single, f.foreignKit, ...f.excluded]) assert.equal(purchase.allowQuantityPurchase, false, purchase.id);
  assert.equal(f.normal.allowQuantityPurchase, true);
});

test("new bulk support respects a finite native buy limit", async () => {
  const f = fixture(); assert.equal(f.limited.allowQuantityPurchase, true);
  f.game.shop.buyQuantity = 10; f.game.shop.buyItemOnClick(f.limited);
  assert.match(f.title(), /Buy 2 x/); await f.respond(true);
  assert.deepEqual(f.state.awarded, [[f.limited, 2]]); assert.equal(f.game.shop.buyQuantity, 10);
});

test("character loads restore original single-quantity behavior where the gamemode caps an item at one", () => {
  const f = fixture(), capped = {}, unlimited = {};
  f.game.shop.buyQuantity = 37;
  for (const purchase of [f.strong, ...f.extra]) purchase.modeLimits = new Map([[capped, 1], [unlimited, 0]]);
  f.normal.modeLimits = new Map([[capped, 1]]);
  f.load(capped);
  for (const purchase of [f.strong, ...f.extra]) assert.equal(purchase.allowQuantityPurchase, false, purchase.id);
  assert.equal(f.normal.allowQuantityPurchase, true, "an existing native bulk flag is retained even with a one-purchase cap");
  f.load(unlimited);
  for (const purchase of [f.strong, ...f.extra]) assert.equal(purchase.allowQuantityPurchase, true, purchase.id);
  assert.equal(f.game.shop.buyQuantity, 37);
});

test("Quick Load updates quantity support after native Game decode without touching another game", () => {
  const f = fixture(), capped = {}, unlimited = {}, other = new Game();
  f.strong.modeLimits = new Map([[capped, 1], [unlimited, Infinity]]);
  other.decode(capped); assert.equal(f.strong.allowQuantityPurchase, true);
  assert.equal(f.game.decode(capped), "native decode"); assert.equal(f.strong.allowQuantityPurchase, false);
  f.game.decode(unlimited); assert.equal(f.strong.allowQuantityPurchase, true); assert.equal(f.game.shop.buyQuantity, 5);
});
