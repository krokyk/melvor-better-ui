import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installShopStock } from "../shop-stock.mjs";

afterEach(() => {
  for (const name of ["ShopCostsAndUnlock", "ShopMenu", "ShopConfirmModalItem", "QuickBuyItem", "Swal", "document", "formatNumber", "numberWithCommas"]) delete globalThis[name];
});

class Element {
  constructor(tag = "span") {
    this.tagName = tag; this.children = []; this.className = ""; this.hidden = false; this.attributes = {}; this.style = {};
    this.classList = {
      add: name => { this.className += ` ${name}`; },
      contains: name => this.className.split(" ").includes(name),
      replace: (oldName, newName) => { this.className = this.className.split(" ").map(name => name === oldName ? newName : name).join(" "); },
    };
  }
  append(...nodes) {
    for (const node of nodes) { node.remove(); this.children.push(node); node.parentElement = this; }
  }
  before(node) {
    node.remove(); const parent = this.parentElement;
    parent.children.splice(parent.children.indexOf(this), 0, node); node.parentElement = parent;
  }
  after(node) {
    node.remove(); const parent = this.parentElement;
    parent.children.splice(parent.children.indexOf(this) + 1, 0, node); node.parentElement = parent;
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = undefined;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
}

function fixture() {
  const items = [{ name: "Iron Bar", quantity: 25_000 }, { name: "Mithril Bar", quantity: 20_000 }];
  const stock = new Map([[items[0], 0], [items[1], 658_000]]);
  const game = { bank: { getQty: item => stock.get(item) ?? 0 } };
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.formatNumber = quantity => quantity >= 1000 ? `${quantity / 1000}K` : `${quantity}`;
  globalThis.numberWithCommas = quantity => quantity.toLocaleString("en-US");
  globalThis.ShopCostsAndUnlock = class {
    constructor() {
      this.game = game; this.root = new Element();
      this.purchase = { costs: { currencies: [{ quantity: 100 }, { quantity: 250 }], items: items.map(item => ({ item, quantity: item.quantity })) } };
      this.createCostElements();
    }
    createCostElements() {
      for (const node of [...this.root.children]) node.remove();
      this.costElements = [...this.purchase.costs.currencies, ...this.purchase.costs.items].map(() => {
        const group = new Element(), image = new Element("img"), cost = new Element();
        group.className = "no-wrap"; image.className = "skill-icon-xs m-1";
        group.append(image, cost); this.root.append(group);
        return { image, cost, tooltip: { target: image } };
      });
      this.updateCostElements();
    }
    updateCostElements() {
      [...this.purchase.costs.currencies, ...this.purchase.costs.items].forEach((value, index) => {
        const cost = this.costElements[index].cost;
        cost.textContent = numberWithCommas(value.quantity);
        cost.className = value.item && game.bank.getQty(value.item) < value.quantity ? "text-danger" : "text-success";
      });
    }
    setToBuyLimit() {
      for (const { image, cost } of this.costElements) { image.classList.add("d-none"); cost.classList.add("d-none"); }
    }
  };
  installShopStock({ patch(Class, method) {
    return { after(callback) {
      const original = Class.prototype[method];
      Class.prototype[method] = function (...args) {
        const result = original.apply(this, args); callback.call(this, result, ...args); return result;
      };
    } };
  } });
  class ShopItem extends ShopCostsAndUnlock {}
  class ShopConfirmModalItem extends ShopCostsAndUnlock {}
  return { game, items, stock, ShopItem, ShopConfirmModalItem };
}

test("shop cards and confirmations show Bank stock below item icons while keeping native costs and tooltips", () => {
  const f = fixture();
  for (const Class of [f.ShopItem, f.ShopConfirmModalItem]) {
    const view = new Class();
    assert.equal(view.costElements.length, 4);
    for (const cost of view.costElements.slice(0, 2)) assert.equal(cost.image.parentElement.children.length, 2, "currencies receive no badge");
    for (const [index, expected] of [[2, "0"], [3, "658K"]]) {
      const { image, cost, tooltip } = view.costElements[index], wrapper = image.parentElement, badge = wrapper.children[1];
      assert.ok(wrapper.classList.contains("kroky-shop-cost-icon"));
      assert.equal(badge.tagName, "small");
      assert.ok(badge.classList.contains("badge-pill")); assert.ok(badge.classList.contains("bg-primary"));
      assert.equal(badge.textContent, expected);
      assert.equal(badge.title, `${f.items[index - 2].name} in Bank: ${index === 2 ? "0" : "658,000"}`);
      assert.equal(badge.getAttribute("aria-label"), badge.title);
      assert.equal(tooltip.target, image); assert.equal(wrapper.parentElement.children[1], cost);
    }
    assert.deepEqual(view.costElements.map(({ cost }) => cost.textContent), ["100", "250", "25,000", "20,000"]);
    assert.deepEqual(view.costElements.map(({ cost }) => cost.className), ["text-success", "text-success", "text-danger", "text-success"]);
  }
});

test("native refresh updates stock without duplicate badges and buy limits hide the whole item wrapper", () => {
  const f = fixture(), view = new f.ShopItem(), records = view.costElements.slice(2);
  f.stock.set(f.items[0], 30_000); f.stock.set(f.items[1], 0);
  view.updateCostElements(); view.updateCostElements();
  assert.deepEqual(records.map(({ image }) => image.parentElement.children[1].textContent), ["30K", "0"]);
  assert.deepEqual(records.map(({ cost }) => cost.className), ["text-success", "text-danger"]);
  assert.deepEqual(records.map(({ cost }) => cost.textContent), ["25,000", "20,000"]);
  for (const { image } of records) assert.equal(image.parentElement.children.length, 2);
  assert.equal(view.setToBuyLimit(), undefined);
  view.setToBuyLimit();
  for (const { image, cost } of records) {
    assert.ok(image.parentElement.classList.contains("d-none"));
    assert.equal(image.parentElement.classList.contains("d-inline-flex"), false);
    assert.ok(image.classList.contains("d-none")); assert.ok(cost.classList.contains("d-none"));
  }
  view.createCostElements();
  assert.equal(view.root.children.length, 4);
  for (const { image } of view.costElements.slice(2)) {
    assert.ok(image.parentElement.classList.contains("d-inline-flex")); assert.equal(image.parentElement.children.length, 2);
  }
});

function productFixture() {
  const item = { name: "Slayer Helmet (Basic)" }, stock = new Map([[item, 0]]), root = new Element("div"), quickModal = new Element("div");
  let popup, image, reads = 0;
  const game = { bank: { getQty(value) { reads++; return stock.get(value) ?? 0; } } };
  globalThis.document = { createElement: tag => new Element(tag), getElementById: () => quickModal };
  globalThis.formatNumber = value => value >= 1000 ? `${value / 1000}K` : `${value}`;
  globalThis.numberWithCommas = value => value.toLocaleString("en-US");
  globalThis.Swal = { getImage: () => image, getPopup: () => popup };
  globalThis.ShopCostsAndUnlock = class {
    constructor(purchase) { this.purchase = purchase; this.game = game; this.costElements = []; }
    createCostElements() {}
    updateCostElements() {}
    setToBuyLimit() {}
  };
  globalThis.ShopConfirmModalItem = class extends ShopCostsAndUnlock { destroy() {} };
  globalThis.QuickBuyItem = class extends ShopCostsAndUnlock {
    constructor(purchase) { super(purchase); this.image = new Element("img"); const art = new Element("div"); art.append(this.image); root.append(art); }
  };
  globalThis.ShopMenu = class {
    constructor() { this.game = game; }
    showConfirmBuyPrompt(purchase) {
      this.confirmBuyItem = new ShopConfirmModalItem(purchase);
      popup = new Element("div"); image = new Element("img"); image.className = "swal2-image";
      this.title = new Element("h2"); this.title.textContent = purchase.contains.items[0]?.item.name ?? "Upgrade";
      popup.append(image, this.title); root.append(popup);
    }
    updateForCostChange() { this.confirmBuyItem?.updateCostElements(); this.quickbuyMenu?.updateCostElements(); }
    changeQuickBuyItem(purchase) { this.quickbuyMenu = new QuickBuyItem(purchase); }
  };
  const ctx = { patch(Class, method) { return { after(callback) {
    const native = Class.prototype[method]; Class.prototype[method] = function (...args) { const result = native.apply(this, args); callback.call(this, result, ...args); return result; };
  } }; } };
  installShopStock(ctx);
  const menu = new ShopMenu();
  const purchase = contains => ({ contains, costs: { currencies: [], items: [] } });
  const ordinary = purchase({ items: [{ item, quantity: 1 }] });
  return { item, stock, menu, ordinary, purchase, root, quickModal, image: () => image, popup: () => popup, reads: () => reads,
    badge: () => image?.parentElement?.children.find(node => node.classList.contains("kroky-shop-product-stock")),
    close() { menu.confirmBuyItem.destroy(); menu.confirmBuyItem = undefined; popup = undefined; },
  };
}

test("purchase artwork shows one centered blue Bank-stock badge and refreshes through native cost events", () => {
  const f = productFixture(); f.menu.showConfirmBuyPrompt(f.ordinary);
  const image = f.image(), badge = f.badge(), title = f.menu.title;
  assert.ok(badge, "purchase artwork must show its current Bank reserve");
  assert.ok(badge.classList.contains("badge-pill")); assert.ok(badge.classList.contains("bg-primary"));
  assert.equal(badge.textContent, "0"); assert.equal(badge.getAttribute("aria-label"), "Slayer Helmet (Basic) in Bank: 0");
  assert.deepEqual(f.popup().children, [image, badge, title]); assert.equal(badge.style.justifySelf, "center");
  assert.equal(badge.style.marginTop, "-1rem", "badge occupies the native artwork's bottom margin");
  f.stock.set(f.item, 1250); f.menu.updateForCostChange(); f.menu.updateForCostChange();
  assert.equal(f.badge(), badge); assert.equal(badge.textContent, "1.25K"); assert.equal(badge.title, "Slayer Helmet (Basic) in Bank: 1,250");
  assert.deepEqual(f.popup().children, [image, badge, title]);
  badge.remove(); f.menu.confirmBuyItem.updateCostElements();
  assert.equal(f.badge(), badge, "native quantity refresh repairs a detached badge without replacing its image or title");
  const foreign = new ShopMenu(), reads = f.reads(); foreign.updateForCostChange(); assert.equal(f.reads(), reads);
  f.close(); const closed = f.reads(); f.menu.updateForCostChange(); assert.equal(f.reads(), closed, "closed confirmations perform no stock work");
});

test("purchase artwork skips ambiguous bundles and special grants while retaining native image and title", () => {
  const f = productFixture();
  for (const contains of [{ items: [] }, { items: [{ item: f.item }, { item: { name: "Other" } }] }, { items: [{ item: f.item }], stats: {} }, { items: [{ item: f.item }], itemCharges: {} }]) {
    f.menu.showConfirmBuyPrompt(f.purchase(contains)); assert.equal(f.badge(), undefined); assert.deepEqual(f.popup().children, [f.image(), f.menu.title]); f.close();
  }
  f.menu.showConfirmBuyPrompt(f.ordinary); assert.equal(f.badge().textContent, "0");
});

test("Quick Buy shares product stock badges without refreshing its hidden artwork", () => {
  const f = productFixture(); f.stock.set(f.item, 7); f.menu.changeQuickBuyItem(f.ordinary);
  const image = f.menu.quickbuyMenu.image, badge = image.parentElement.children[1];
  assert.ok(badge, "Quick Buy artwork uses the same product stock badge"); assert.equal(badge.textContent, "7");
  f.stock.set(f.item, 8); const hiddenReads = f.reads(); f.menu.updateForCostChange(); assert.equal(f.reads(), hiddenReads);
  f.quickModal.classList.add("show"); f.menu.updateForCostChange(); assert.equal(badge.textContent, "8");
  assert.deepEqual(image.parentElement.children, [image, badge]); assert.equal(badge.style.marginTop, undefined);
});
