import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBetterMoving } from "../better-moving.mjs";

afterEach(() => {
  for (const name of ["document", "Bank", "BankTabMenuElement", "Game"]) delete globalThis[name];
});

class Element {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.childNodes = [];
    this.attributes = new Map();
    this.events = new Map();
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => {
        const value = force ?? !this.classList.contains(name);
        value ? this.classList.add(name) : this.classList.remove(name);
        return value;
      },
    };
  }
  get className() { return this.getAttribute("class") ?? ""; }
  set className(value) { this.setAttribute("class", value); }
  get children() { return this.childNodes.filter(node => node instanceof Element); }
  get textContent() { return this.childNodes.map(node => typeof node === "string" ? node : node.textContent).join(""); }
  set textContent(value) { this.replaceChildren(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) {
    for (const node of nodes) {
      if (node instanceof Element) { node.remove(); node.parentElement = this; }
      this.childNodes.push(node);
    }
  }
  prepend(node) { node.remove(); node.parentElement = this; this.childNodes.unshift(node); }
  before(node) {
    const parent = this.parentElement;
    node.remove(); node.parentElement = parent;
    parent.childNodes.splice(parent.childNodes.indexOf(this), 0, node);
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.childNodes.splice(this.parentElement.childNodes.indexOf(this), 1);
    this.parentElement = null;
  }
  replaceChildren(...nodes) { for (const node of this.children) node.remove(); this.childNodes = []; this.append(...nodes); }
  replaceWith(node) { this.before(node); this.remove(); }
  querySelector(selector) {
    for (const child of this.children) {
      if (selector.startsWith(".") ? child.classList.contains(selector.slice(1)) : child.tagName === selector) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  addEventListener(name, callback) { this.events.set(name, callback); }
}

function fixture() {
  const hooks = {}, fields = new Map(), values = new Map();
  const root = new Element(), options = new Element(), buttons = new Element(), tools = new Element("ul");
  const button = (text, className) => {
    const node = new Element("button"); node.textContent = text; node.className = className; buttons.append(node); return node;
  };
  options.sortButton = button("Sort Bank", "btn btn-info m-1");
  options.moveModeButton = button("Toggle Move Mode", "btn btn-secondary m-1");
  options.sellModeButton = button("Toggle Sell Mode", "btn btn-danger m-1");
  options.append(buttons);
  const moveMenu = new Element(), status = new Element("p"), alert = new Element();
  status.textContent = "Select items to move"; alert.className = "alert alert-secondary"; moveMenu.append(status, alert);
  globalThis.Bank = class {
    itemSelectionMode = 0;
    selectedBankTab = 0;
    selectedItems = new Set();
    items = new Map();
    tabCount = 2;
    moves = [];
    setItemSelectionMode(mode) { this.itemSelectionMode = mode; if (mode === 0) this.selectedItems.clear(); }
    toggleItemSelected() {}
    removeItemQuantity() {}
    moveSelectedItemsToTab(tabID) { this.moves.push(tabID); this.setItemSelectionMode(0); }
    moveItemToNewTab() {}
  };
  globalThis.BankTabMenuElement = class extends Element {
    tabs = [0, 1].map(() => ({ tabLink: new Element("a") }));
    updateTabCount() {}
    selectTab(tabID, bank) { bank.selectedBankTab = tabID; }
  };
  const tabs = new BankTabMenuElement();
  globalThis.Game = class { bank = new Bank(); gp = { media: "assets/gp.svg" }; decode() {} };
  const game = new Game();
  const sortClick = () => "native sort";
  options.sortButton.addEventListener("click", sortClick);
  const nodes = new Map([["bank-container", root], ["main-bank-options", options], ["main-bank-move-mode", moveMenu], ["bank-tab-menu", tabs]]);
  globalThis.document = {
    head: new Element("head"),
    createElement: tagName => new Element(tagName),
    createComment: () => new Element("#comment"),
    getElementById: id => nodes.get(id),
    querySelector: selector => selector === "#bank-tab-menu .bg-dark-bank-info ul" ? tools : null,
  };
  const ctx = {
    settings: { section: () => ({
      add(config) { fields.set(config.name, config); values.set(config.name, config.default); },
      get: name => values.get(name),
    }) },
    onCharacterLoaded(callback) { hooks.character = callback; },
    onInterfaceReady(callback) { hooks.interface = callback; },
    patch(Class, name) {
      const original = Class.prototype[name];
      return {
        after(callback) { Class.prototype[name] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; }; },
        replace(callback) { Class.prototype[name] = function (...args) { return callback.call(this, original.bind(this), ...args); }; },
      };
    },
  };
  installBetterMoving(ctx, game);
  const set = (name, value) => { fields.get(name).onChange(value); values.set(name, value); };
  return { hooks, fields, values, set, root, options, buttons, tools, tabs, game, sortClick };
}

test("compact Bank controls restore native nodes and remain independent of Better Moving across mode and character changes", () => {
  const f = fixture(), compact = "compact-bank-controls-enabled", moving = "better-moving-enabled";
  const { sortButton: sort, moveModeButton: move, sellModeButton: sell } = f.options;
  const originalSort = [...sort.childNodes], originalClass = sort.className;
  assert.equal(f.fields.get(compact).default, false);
  assert.equal(f.fields.get(moving).default, false);
  assert.equal(typeof f.fields.get(compact).onChange("true"), "string");
  f.hooks.interface();
  assert.equal(sort.parentElement, f.buttons);
  assert.equal(move.textContent, "Toggle Move Mode");
  f.set(compact, true);
  assert.equal(f.root.classList.contains("kroky-compact-bank-controls"), true);
  assert.equal(f.tools.children[0].children[0], sort);
  assert.equal(sort.classList.contains("btn-info"), true);
  assert.equal(sort.getAttribute("aria-label"), "Sort Bank");
  assert.equal(sort.children[0].className, "fa fa-exchange-alt");
  assert.equal(sort.events.get("click"), f.sortClick);
  assert.equal(move.textContent, "Move Mode");
  assert.equal(move.children[0].className, "fa fa-arrows-alt");
  assert.equal(sell.textContent, "Sell Mode");
  assert.equal(sell.children[0].src, f.game.gp.media);
  assert.equal(sell.children[0].alt, "");
  assert.equal(move.getAttribute("aria-pressed"), "false");
  const moveIcon = move.children[0], sortEntry = f.tools.children[0];
  f.tabs.updateTabCount(); f.tabs.updateTabCount();
  assert.equal(f.tools.children.length, 1);
  assert.equal(f.tools.children[0], sortEntry);
  assert.equal(move.children[0], moveIcon, "routine updates retain the icon nodes");
  for (const [mode, active, inactive] of [[1, move, sell], [2, sell, move]]) {
    f.game.bank.setItemSelectionMode(mode);
    assert.equal(active.children[0].className, "fa fa-times text-danger");
    assert.equal(active.getAttribute("aria-pressed"), "true");
    assert.equal(inactive.getAttribute("aria-pressed"), "false");
  }
  const selected = { item: {}, tab: 0 };
  f.game.bank.items.set(selected.item, selected); f.game.bank.selectedItems.add(selected);
  f.set(compact, false);
  assert.equal(f.game.bank.selectedItems.has(selected), true, "layout changes preserve item selection");
  assert.equal(f.game.bank.itemSelectionMode, 2);
  assert.equal(f.root.classList.contains("kroky-compact-bank-controls"), false);
  assert.equal(sort.parentElement, f.buttons);
  assert.equal(f.buttons.children[0], sort);
  assert.deepEqual(sort.childNodes, originalSort);
  assert.equal(sort.className, originalClass);
  assert.equal(sort.getAttribute("aria-label"), null);
  assert.equal(sort.getAttribute("title"), null);
  assert.equal(move.textContent, "Toggle Move Mode");
  assert.equal(sell.textContent, "Toggle Sell Mode");
  assert.equal(sell.getAttribute("aria-pressed"), null);
  assert.equal(f.tools.children.length, 0);
  f.set(moving, true);
  assert.equal(sell.textContent, "Cancel Sell Mode");
  const deselect = f.buttons.children.at(-1);
  assert.equal(deselect.textContent, "Deselect All");
  assert.equal(deselect.hidden, false);
  assert.equal(deselect.disabled, false);
  f.set(compact, true);
  assert.equal(sell.textContent, "Sell Mode");
  f.set(compact, false);
  assert.equal(sell.textContent, "Cancel Sell Mode");
  assert.equal(sell.getAttribute("aria-pressed"), null);
  f.game.bank.setItemSelectionMode(1);
  assert.equal(move.textContent, "Cancel Move Mode");
  f.game.bank.moveSelectedItemsToTab(1);
  assert.deepEqual(f.game.bank.moves, [1]);
  assert.equal(f.game.bank.itemSelectionMode, 1, "Better Moving retains Move Mode after a move");
  f.game.bank.selectedItems.add(selected); f.tabs.updateTabCount();
  deselect.events.get("click")();
  assert.equal(f.game.bank.selectedItems.size, 0);
  assert.equal(f.game.bank.itemSelectionMode, 1);
  assert.equal(deselect.disabled, true);
  f.set(compact, true);
  f.values.set(compact, false); f.values.set(moving, false); f.game.decode();
  assert.equal(sort.parentElement, f.buttons);
  assert.equal(move.textContent, "Toggle Move Mode");
  assert.equal(f.game.bank.itemSelectionMode, 0);
  assert.equal(deselect.hidden, true);
  f.values.set(compact, true); f.hooks.character();
  assert.equal(f.tools.children[0].children[0], sort);
  assert.equal(move.textContent, "Move Mode");
  assert.equal(deselect.hidden, true, "compact controls do not enable Better Moving");
});
