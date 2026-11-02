import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installShopStock } from "../shop-stock.mjs";

afterEach(() => {
  for (const name of ["ShopCostsAndUnlock", "document", "formatNumber", "numberWithCommas"]) delete globalThis[name];
});

class Element {
  constructor(tag = "span") {
    this.tagName = tag; this.children = []; this.className = ""; this.hidden = false; this.attributes = {};
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
