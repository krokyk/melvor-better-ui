import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createItemStatsPreview, installSkillItemStats } from "../item-stats.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "Game", "EquipmentItem", "Equipment", "tippy", "numberWithCommas", "templateLangString"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = [];
    this.attributes = {}; this.className = ""; this.listeners = new Map(); this.hidden = false;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: (...names) => { for (const name of names) if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => { const value = force ?? !this.classList.contains(name); this.classList[value ? "add" : "remove"](name); return value; },
    };
  }
  append(...nodes) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentElement = this; } }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
  setAttribute(name, value) { this.attributes[name] = `${value}`; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  matches(selector) {
    const parts = selector.trim().split(/\s+/);
    if (parts.length > 1) {
      if (!this.matches(parts.pop())) return false;
      let ancestor = this.parentElement;
      while (parts.length && ancestor) {
        if (ancestor.matches(parts.at(-1))) parts.pop();
        ancestor = ancestor.parentElement;
      }
      return parts.length === 0;
    }
    return selector.startsWith(".") ? this.classList.contains(selector.slice(1))
      : selector.startsWith("#") ? this.id === selector.slice(1) : this.tagName.toLowerCase() === selector;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
  dispatch(name, event = {}) {
    const state = { target: this, stopped: false, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...event };
    for (const callback of this.listeners.get(name) ?? []) callback(state);
    this[`on${name}`]?.(state);
    if (!state.stopped) this.parentElement?.dispatch(name, state);
    return state;
  }
  click() { return this.dispatch("click"); }
  get textContent() { return (this.ownText ?? "") + this.children.map(node => node.textContent).join(""); }
  set textContent(text) { this.ownText = `${text}`; for (const child of [...this.children]) child.remove(); }
}

function fixture(saved = "click", { nativePreview = true } = {}) {
  const root = new Element("html"), head = new Element("head"), body = new Element("body"), page = new Element();
  page.id = "page-container"; root.append(head, body); body.append(page);
  const calls = { nativePreview: [], previews: [], nativeStats: [], navigation: 0, source: 0, quickBuy: 0, scans: 0, patches: [] };
  const fields = new Map(), values = new Map([["skill-item-stats-mode", saved]]), hooks = {}, items = new Map();
  globalThis.EquipmentItem = class {
    constructor(name, stats = [{ key: "meleeStrengthBonus", value: 12 }]) {
      this.id = `test:${name}`; this.name = name; this.equipmentStats = stats; this.equipRequirements = []; this.specialAttacks = [];
      items.set(this.id, this);
    }
  };
  globalThis.Equipment = class { static getEquipStatDescription(stat) { return `${stat.key}: ${stat.value}`; } };
  class NativePreview extends Element {
    constructor() { super("equipment-tooltip"); }
    setItem(item, showStats) {
      calls.nativePreview.push({ item, showStats });
      this.textContent = item.name;
      for (const stat of item.equipmentStats) {
        const line = new Element("small"); line.textContent = Equipment.getEquipStatDescription(stat); this.append(line);
      }
      if (item.hasDescription) { const description = new Element("small"); description.innerHTML = item.modifiedDescription; this.append(description); }
    }
  }
  const nativeTooltip = () => ({ state: { isEnabled: true, isDestroyed: false }, hides: 0, disables: 0, enables: 0,
    hide() { this.hides++; }, disable() { this.disables++; this.state.isEnabled = false; },
    enable() { this.enables++; this.state.isEnabled = true; }, destroy() { this.state.isDestroyed = true; },
  });
  class CurrentIcon extends Element {
    constructor() {
      super("item-current-icon"); this.container = new Element(); this.container.className = "info-icon"; this.container.setAttribute("role", "img");
      this.itemImage = new Element("img"); this.container.append(this.itemImage); this.append(this.container); this.tooltip = nativeTooltip();
    }
    setItem(item) { this.item = item; this.itemImage.src = item.media; this.container.onclick = null; }
    updateQuantity() { this.quantityUpdates = (this.quantityUpdates ?? 0) + 1; }
    disconnectedCallback() { this.tooltip.destroy(); }
  }
  const classes = new Map([["item-current-icon", CurrentIcon]]);
  if (nativePreview) classes.set("equipment-tooltip", NativePreview);
  globalThis.customElements = { get: tag => classes.get(tag) };
  globalThis.document = {
    body, head,
    createElement: tag => classes.has(tag) ? new (classes.get(tag))() : new Element(tag),
    getElementById: id => root.querySelector(`#${id}`),
    querySelectorAll(selector) { calls.scans++; return root.querySelectorAll(selector); },
  };
  globalThis.Game = class { decode(value) { values.set("skill-item-stats-mode", value); } render() {} };
  globalThis.tippy = (image, props) => {
    const preview = { image, props, shows: 0, hides: 0, destroyed: false,
      setContent(element) { this.content = element; }, show() { this.shows++; }, hide() { this.hides++; }, destroy() { this.destroyed = true; },
    };
    calls.previews.push(preview); return preview;
  };
  const game = new Game(); game.items = { getObjectByID: id => items.get(id) };
  const ctx = {
    settings: { section(name) { assert.equal(name, "General"); return { add(config) { fields.set(config.name, config); }, get: name => values.get(name) }; } },
    onCharacterLoaded(callback) { hooks.character = callback; }, onInterfaceReady(callback) { hooks.interface = callback; },
    patch(Class, method) { calls.patches.push({ Class, method }); return { after(callback) {
      const original = Class.prototype[method];
      Class.prototype[method] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; };
    } }; },
  };
  installSkillItemStats(ctx, game);
  function card(item, available = true) {
    const card = new Element("article"), icon = new CurrentIcon(), stats = new Element("button");
    card.className = "kroky-production-card"; icon.itemImage.className = "kroky-production-image";
    stats.className = "kroky-production-view-stats kroky-production-stats-overlay"; stats.hidden = !available;
    stats.addEventListener("click", event => event.stopPropagation());
    const setItem = next => { stats.onclick = () => calls.nativeStats.push(next); icon.setItem(next); };
    card.append(icon, stats); page.append(card); setItem(item);
    return { card, icon, image: icon.itemImage, stats, setItem };
  }
  const setMode = value => {
    const field = fields.get("skill-item-stats-mode"), result = field.onChange(value);
    if (result === undefined || result === true) values.set(field.name, value);
    return result;
  };
  return { game, calls, fields, values, hooks, root, page, items, card, setMode, CurrentIcon, nativeTooltip };
}

test("preview reuses native stats rendering and current requirements and charges without opening the global item modal", () => {
  const f = fixture(), item = new EquipmentItem("Charged Ring");
  item.equipRequirements = [{ getNodes() { const line = new Element("span"); line.textContent = "Requires Defence 30"; return [line]; }, isMet: () => true }];
  item.consumesChargesOn = {};
  let charges = 17; f.game.itemCharges = { getCharges: () => charges };
  const first = createItemStatsPreview(item, f.game);
  assert.equal(first.hasStats, true);
  assert.equal(f.calls.nativePreview[0].item, item); assert.equal(f.calls.nativePreview[0].showStats, true);
  assert.match(first.element.textContent, /Requires Defence 30/); assert.match(first.element.textContent, /17 charges remaining/);
  charges = 9;
  assert.match(createItemStatsPreview(item, f.game).element.textContent, /9 charges remaining/);
  assert.deepEqual(f.calls.nativeStats, [], "side previews do not call View Item Stats or open its modal");
});

test("preview has a safe name-only fallback and can format available stats without the native component", () => {
  const f = fixture("click", { nativePreview: false });
  const plain = { id: "test:Plain", name: "Plain Ingredient" };
  const fallback = createItemStatsPreview(plain, f.game);
  assert.equal(fallback.hasStats, false); assert.equal(fallback.element.textContent, plain.name);
  const item = new EquipmentItem("Ring", [{ key: "defence", value: 5 }, { key: "attack", value: -2 }, { key: "unused", value: 0 }]);
  const stats = createItemStatsPreview(item, f.game);
  assert.equal(stats.hasStats, true); assert.match(stats.element.textContent, /defence: 5/); assert.match(stats.element.textContent, /attack: -2/);
  assert.doesNotMatch(stats.element.textContent, /unused/);
});

test("click is the default radio choice and invokes only the main artwork's existing View Item Stats action", () => {
  const f = fixture(undefined), ring = new EquipmentItem("Ring"), main = f.card(ring), field = f.fields.get("skill-item-stats-mode");
  assert.equal(field.label, "Show Item Stats in Skills"); assert.equal(field.type, "radio-group"); assert.equal(field.default, "click");
  assert.deepEqual(field.options.map(option => option.value), ["icon", "click", "hover"]);
  main.image.click(); assert.deepEqual(f.calls.nativeStats, [], "controls wait for interface readiness");
  f.hooks.character(); f.hooks.interface();
  assert.equal(main.image.getAttribute("role"), "button"); assert.equal(main.image.getAttribute("tabindex"), "0");
  assert.equal(main.icon.container.getAttribute("role"), "group");
  main.image.click(); main.image.dispatch("keydown", { key: "Enter" }); main.image.dispatch("keydown", { key: " " });
  assert.deepEqual(f.calls.nativeStats, [ring, ring, ring]); assert.equal(f.calls.previews.length, 0);
  const recipe = new f.CurrentIcon(); recipe.container.onclick = () => f.calls.navigation++; main.card.append(recipe); recipe.itemImage.click();
  const source = new Element("button"); source.className = "kroky-item-source-button"; source.onclick = () => f.calls.source++; main.card.append(source); source.click();
  const shop = new Element("button"); shop.onclick = () => f.calls.quickBuy++; main.card.append(shop); shop.click();
  assert.equal(f.calls.navigation, 1); assert.equal(f.calls.source, 1); assert.equal(f.calls.quickBuy, 1);
  assert.equal(f.calls.nativeStats.length, 3, "recipe and shop actions never become artwork stats actions");
});

test("icon mode retains the existing stats icon and restores artwork accessibility while unsupported artwork stays plain", () => {
  const f = fixture(), item = new EquipmentItem("Ring"), main = f.card(item), plain = f.card(new EquipmentItem("No Stats", []), false);
  f.hooks.interface();
  assert.equal(plain.image.getAttribute("role"), null); plain.image.click(); assert.equal(f.calls.nativeStats.length, 0);
  f.setMode("icon");
  assert.equal(main.image.getAttribute("role"), null); assert.equal(main.image.getAttribute("tabindex"), null);
  assert.equal(main.icon.container.getAttribute("role"), "img");
  main.image.click(); assert.equal(f.calls.nativeStats.length, 0);
  main.stats.click(); assert.deepEqual(f.calls.nativeStats, [item]);
  assert.equal(main.stats.hidden, false, "the native icon's eligibility is retained");
  assert.equal(f.page.classList.contains("kroky-skill-stats-click"), false); assert.equal(f.page.classList.contains("kroky-skill-stats-hover"), false);
});

test("hover previews are lazy, follow live item changes, restore the native tooltip, and keep keyboard access to full stats", () => {
  const f = fixture("hover"), first = new EquipmentItem("First Ring"), second = new EquipmentItem("Second Ring"), main = f.card(first);
  f.hooks.interface(); assert.equal(f.calls.previews.length, 0);
  main.image.dispatch("mouseenter");
  assert.equal(f.calls.previews.length, 1); assert.equal(f.calls.previews[0].shows, 1);
  assert.equal(f.calls.nativePreview.at(-1).item, first); assert.equal(main.icon.tooltip.state.isEnabled, false);
  assert.equal(f.calls.nativeStats.length, 0, "hover never opens a modal");
  main.image.dispatch("mouseleave"); assert.equal(main.icon.tooltip.state.isEnabled, true); assert.equal(f.calls.previews[0].hides, 1);
  main.image.dispatch("mouseenter");
  const hides = f.calls.previews[0].hides;
  main.setItem(second);
  assert.equal(f.calls.previews[0].hides, hides + 1, "changing artwork items invalidates an already open preview");
  assert.equal(main.icon.tooltip.state.isEnabled, true);
  main.image.dispatch("focus");
  assert.equal(f.calls.previews.length, 1, "the same artwork reuses its one tooltip shell"); assert.equal(f.calls.nativePreview.at(-1).item, second);
  main.image.dispatch("keydown", { key: "Enter" }); assert.deepEqual(f.calls.nativeStats, [second]);
  assert.equal(main.icon.tooltip.state.isEnabled, true);
  main.image.dispatch("mouseenter"); main.icon.disconnectedCallback();
  assert.equal(f.calls.previews[0].destroyed, true); assert.equal(main.icon.tooltip.state.isDestroyed, true);
});

test("radio changes and native decode restore safely without per-render work or duplicate handlers", () => {
  const f = fixture("broken"), item = new EquipmentItem("Ring"), main = f.card(item); f.hooks.interface();
  assert.equal(f.page.classList.contains("kroky-skill-stats-click"), true, "invalid saved choices fall back to click");
  const scans = f.calls.scans;
  for (let index = 0; index < 40; index++) main.icon.updateQuantity();
  assert.equal(f.calls.scans, scans, "stock updates do not scan cards");
  assert.equal(f.calls.patches.some(entry => entry.method === "render"), false);
  assert.equal(typeof f.setMode("invalid"), "string");
  for (let index = 0; index < 4; index++) { f.setMode("icon"); f.setMode("click"); main.image.click(); }
  assert.equal(f.calls.nativeStats.length, 4, "mode changes do not duplicate click listeners");
  f.game.decode("hover"); assert.equal(f.page.classList.contains("kroky-skill-stats-hover"), true);
  f.game.decode("icon"); main.image.click(); assert.equal(f.calls.nativeStats.length, 4);
  const added = f.card(new EquipmentItem("Added Later"));
  f.game.decode("click"); added.image.click(); assert.equal(f.calls.nativeStats.at(-1).name, "Added Later");
});

test("hover mode preserves a tooltip disabled by another feature and ignores artwork without a live native stats action", () => {
  const f = fixture("hover"), item = new EquipmentItem("Ring"), main = f.card(item); f.hooks.interface();
  main.icon.tooltip.state.isEnabled = false;
  main.image.dispatch("mouseenter"); main.image.dispatch("mouseleave");
  assert.equal(main.icon.tooltip.state.isEnabled, false);
  main.stats.hidden = true; main.image.dispatch("mouseenter"); main.image.click();
  assert.equal(f.calls.previews[0].shows, 1); assert.equal(f.calls.nativeStats.length, 0);
  main.stats.hidden = false; main.stats.classList.add("d-none"); main.image.click(); assert.equal(f.calls.nativeStats.length, 0);
});

test("Abyssal text stats controls become an accessible corner icon on the same main artwork", () => {
  const f = fixture("icon"), item = new EquipmentItem("Abyssal Ring"), main = f.card(item);
  main.stats.className = "kroky-production-view-stats btn btn-outline-info align-self-center m-1";
  main.stats.textContent = "View Item Stats";
  f.hooks.interface();
  assert.equal(main.stats.parentElement, main.icon.container);
  assert.equal(main.icon.container.children[0], main.image, "native direct-child image sizing stays intact");
  assert.equal(main.stats.classList.contains("kroky-production-stats-overlay"), true);
  assert.equal(main.stats.classList.contains("btn-outline-info"), false);
  assert.equal(main.stats.querySelector("i").className, "fa fa-list");
  assert.equal(main.stats.getAttribute("aria-label"), "View Item Stats");
  assert.equal(main.icon.container.getAttribute("role"), "group", "image roles must not hide the new corner button");
  assert.equal(main.image.getAttribute("role"), null);
  main.stats.click(); assert.deepEqual(f.calls.nativeStats, [item]);
  f.setMode("click"); main.image.click(); assert.deepEqual(f.calls.nativeStats, [item, item]);
  f.setMode("icon"); assert.equal(main.icon.container.getAttribute("role"), "group");
  assert.equal(main.icon.container.querySelectorAll(".kroky-production-view-stats").length, 1);
});
