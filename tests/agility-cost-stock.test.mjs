import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installAgilityCostStock } from "../agility-cost-stock.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "formatNumber", "numberWithCommas", "toggleDangerSuccess"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div", className = "") {
    this.tagName = tag; this.className = className; this.children = []; this.attributes = {}; this.writes = 0;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: name => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); },
    };
  }
  set textContent(value) { this.replaceChildren(); this.value = String(value); this.writes++; }
  get textContent() { return this.value ?? ""; }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
}

function fixture(late = false) {
  const modal = new Element("div", "modal show"), reads = [], colourChanges = [], hooks = { ready: [], character: [] }, patches = [];
  const items = [{ name: "Logs", media: "logs.png" }, { name: "Abyssal Logs", media: "abyssal.png" }];
  const currencies = [{ name: "GP", media: "gp.png", amount: 50_000 }, { name: "AP", media: "ap.png", amount: 0 }];
  const stock = new Map([[items[0], 0], [items[1], 100_000]]);
  const game = { _isInOnlineLoop: true, bank: { getQty(item) { reads.push(item); return stock.get(item) ?? 0; } } };
  globalThis.document = { visibilityState: "visible", getElementById: id => id === "modal-select-agility-obstacle" ? modal : undefined };
  globalThis.formatNumber = value => value >= 1000 ? `${value / 1000}K` : `${value}`;
  globalThis.numberWithCommas = value => value.toLocaleString("en-US");
  globalThis.toggleDangerSuccess = (element, success) => { colourChanges.push([element, success]); element.classList.remove(success ? "text-danger" : "text-success"); element.classList.add(success ? "text-success" : "text-danger"); };
  class Selection extends Element {
    constructor() { super("agility-obstacle-selection"); this.costContainer = new Element(); this.requirements = new Element(); this.requirements.textContent = "Native level requirement"; this.link = { onclick: () => "original build" }; this.append(this.costContainer, this.requirements); }
    createInlineRequirement(textClass) {
      const row = new Element("inline-requirement", `font-size-sm ${textClass}`); row.image = new Element("img"); row.text = new Element("span");
      row.tooltip = { target: row.image }; row.append(row.image, row.text);
      row.setContent = (media, text, name) => { row.image.src = media; row.text.textContent = text; row.tooltip.content = name; };
      return row;
    }
    // Native shared obstacle/pillar method, with its item-then-currency child order.
    setCosts(items, currencies) {
      this.costContainer.textContent = "";
      const addReq = (media, qty, name, currentQty) => {
        const newReq = this.createInlineRequirement(currentQty >= qty ? "text-success" : "text-danger");
        this.costContainer.append(newReq); newReq.setContent(media, formatNumber(qty), name);
      };
      items.forEach(({ item, quantity }) => addReq(item.media, quantity, item.name, game.bank.getQty(item)));
      currencies.forEach(({ currency, quantity }) => addReq(currency.media, quantity, currency.name, currency.amount));
      return "native costs";
    }
    setObstacle(target) { this.link.onclick = target.build; this.setCosts(target.modifiedItems, target.modifiedCurrencies); }
    setPillar(target) { this.link.onclick = target.build; this.setCosts(target.modifiedItems, target.modifiedCurrencies); }
  }
  const classes = new Map(late ? [] : [["agility-obstacle-selection", Selection]]);
  globalThis.customElements = { get: name => classes.get(name) };
  const ctx = {
    onCharacterLoaded: callback => hooks.character.push(callback), onInterfaceReady: callback => hooks.ready.push(callback),
    patch(Class, method) { patches.push([Class, method]); return { after(callback) { const original = Class.prototype[method]; Class.prototype[method] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; }; } }; },
  };
  const update = installAgilityCostStock(ctx, game), menu = new Selection(); modal.append(menu);
  const itemsCost = [{ item: items[0], quantity: 2500 }, { item: items[1], quantity: 0 }], currencyCost = [{ currency: currencies[0], quantity: 4300 }, { currency: currencies[1], quantity: 1 }];
  return { update, game, menu, modal, items, currencies, stock, reads, colourChanges, patches, itemsCost, currencyCost,
    build: () => menu.setCosts(itemsCost, currencyCost), rows: () => menu.costContainer.children,
    ready: () => hooks.ready.forEach(callback => callback()), load: () => hooks.character.forEach(callback => callback()),
    register: () => classes.set("agility-obstacle-selection", Selection),
  };
}

test("native obstacle and pillar costs in both realms show modified required/owned quantities without changing native artwork or build actions", () => {
  const f = fixture();
  for (const realm of ["Melvor", "Abyssal"]) for (const method of ["setObstacle", "setPillar"]) {
    const target = { realm, rawCost: 10_000, modifiedItems: f.itemsCost, modifiedCurrencies: f.currencyCost, build: () => `${realm} ${method}` };
    f.menu[method](target);
    assert.deepEqual(f.rows().map(row => row.text.textContent), ["(2.5K/0)", "(0/100K)", "(4.3K/50K)", "(1/0)"]);
    assert.deepEqual(f.rows().map(row => row.classList.contains("text-success")), [false, true, true, false]);
    for (const [index, row] of f.rows().entries()) {
      const resource = [...f.items, ...f.currencies][index];
      assert.equal(row.tooltip.target, row.image); assert.equal(row.tooltip.content, resource.name); assert.equal(row.image.src, resource.media);
      assert.equal(row.text.getAttribute("aria-label"), row.text.title);
    }
    assert.equal(f.rows()[0].text.title, "Logs: Required 2,500 / Owned 0");
    assert.equal(f.menu.link.onclick, target.build); assert.equal(f.menu.requirements.textContent, "Native level requirement");
  }
  assert.equal(f.colourChanges.length, 0, "initial formatting preserves already-correct native affordability colours");
});

test("the returned shared refresh updates current stocks and affordability while unchanged rows keep their text and colours", () => {
  const f = fixture(); assert.equal(f.build(), "native costs"); const rows = [...f.rows()], images = rows.map(row => row.image), tooltips = rows.map(row => row.tooltip);
  const writes = rows.map(row => row.text.writes); f.update(); f.update(); assert.deepEqual(rows.map(row => row.text.writes), writes); assert.equal(f.colourChanges.length, 0);
  f.stock.set(f.items[0], 3000); f.currencies[0].amount = 1000; f.currencies[1].amount = 10; f.update();
  assert.deepEqual(rows.map(row => row.text.textContent), ["(2.5K/3K)", "(0/100K)", "(4.3K/1K)", "(1/10)"]);
  assert.deepEqual(f.colourChanges.map(([, success]) => success), [true, false, true]);
  assert.deepEqual(rows.map(row => row.image), images); assert.deepEqual(rows.map(row => row.tooltip), tooltips);
  const changes = f.colourChanges.length; f.stock.set(f.items[0], 4000); f.update(); assert.equal(f.colourChanges.length, changes, "stock changes within the same affordability state do not rewrite colours");
  assert.equal(rows[0].text.title, "Logs: Required 2,500 / Owned 4,000");
});

test("reused menus bind only the latest typed cost rows and free selections retain no stale material reads", () => {
  const f = fixture(); f.build(); const old = [...f.rows()];
  f.menu.setCosts([{ item: f.items[1], quantity: 20 }], [{ currency: f.currencies[1], quantity: 0 }]);
  assert.deepEqual(f.rows().map(row => row.text.textContent), ["(20/100K)", "(0/0)"]);
  f.stock.set(f.items[1], 0); f.reads.length = 0; f.update(); assert.deepEqual(f.reads, [f.items[1]]);
  assert.equal(f.rows()[0].text.textContent, "(20/0)"); assert.equal(old[1].text.textContent, "(0/100K)");
  f.menu.setCosts([], []); f.reads.length = 0; f.update(); assert.deepEqual(f.reads, []); assert.equal(f.rows().length, 0);
});

test("closed or hidden menus, hidden documents and offline/rendering-disabled frames read no stock and catch up on reopening", () => {
  const f = fixture(); f.modal.classList.remove("show"); f.build(); assert.equal(f.rows()[0].text.textContent, "(2.5K/0)", "the native cost build formats immediately before the modal opens");
  f.reads.length = 0; f.update(); assert.deepEqual(f.reads, []); f.modal.classList.add("show");
  for (const [skip, resume] of [
    [() => { document.visibilityState = "hidden"; }, () => { document.visibilityState = "visible"; }],
    [() => { f.game._isInOnlineLoop = false; }, () => { f.game._isInOnlineLoop = true; }],
    [() => { f.game.enableRendering = false; }, () => { f.game.enableRendering = true; }],
    [() => f.menu.classList.add("d-none"), () => f.menu.classList.remove("d-none")],
    [() => f.menu.remove(), () => f.modal.append(f.menu)],
  ]) { skip(); f.update(); assert.deepEqual(f.reads, []); resume(); }
  f.stock.set(f.items[0], 3000); f.update(); assert.equal(f.rows()[0].text.textContent, "(2.5K/3K)");
});

test("late native class definitions install once and character changes discard old cost bindings", () => {
  const f = fixture(true); assert.equal(f.patches.length, 0); f.ready(); f.register(); f.ready(); f.ready();
  assert.equal(f.patches.length, 1); assert.equal(f.patches[0][1], "setCosts", "the feature adds no independent render hook");
  f.build(); f.load(); f.reads.length = 0; f.stock.set(f.items[0], 999); f.update(); assert.deepEqual(f.reads, []); assert.equal(f.rows()[0].text.textContent, "(2.5K/0)");
  f.build(); assert.equal(f.rows()[0].text.textContent, "(2.5K/999)");
});
