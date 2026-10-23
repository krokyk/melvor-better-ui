import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installPagePinning } from "../page-pinning.mjs";

afterEach(() => {
  for (const name of ["document", "window", "getComputedStyle", "ResizeObserver", "$"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.className = "";
    this.attributes = {};
    this.listeners = {};
    this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] ?? ""; } };
    this.height = 40;
    this.width = 300;
    this.moves = 0;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      toggle: (name, flag) => { if (flag === undefined) flag = !this.classList.contains(name); flag ? this.classList.add(name) : this.classList.remove(name); },
    };
  }
  get children() { return this.childNodes.filter(node => node.tagName !== "#COMMENT"); }
  get parentElement() { return this.parentNode; }
  get firstElementChild() { return this.children[0]; }
  get scrollHeight() { return this.hidden ? 0 : Math.max(this.height, this.children.reduce((height, node) => height + node.scrollHeight, 0)); }
  getBoundingClientRect() { return { top: 100, left: 40, height: this.hidden ? 0 : this.height, width: this.width }; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  prepend(node) { this.insertBefore(node, this.childNodes[0] ?? null); }
  insertBefore(node, next) {
    if (next === node) return;
    node.remove();
    this.childNodes.splice(next ? this.childNodes.indexOf(next) : this.childNodes.length, 0, node);
    node.parentNode = this;
    node.moves++;
  }
  before(node) { this.parentNode.insertBefore(node, this); }
  after(node) { const next = this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1]; this.parentNode.insertBefore(node, next); }
  remove() {
    if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1);
    this.parentNode = undefined;
  }
  replaceWith(node) { this.before(node); this.remove(); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  click() { if (!this.disabled) this.listeners.click?.(); }
  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)); }
  matches(selector) {
    return selector.split(",").some(part => {
      if (part.startsWith("#")) return this.id === part.slice(1);
      if (part.startsWith(".")) return part.slice(1).split(".").every(name => this.classList.contains(name));
      return this.tagName.toLowerCase() === part;
    });
  }
  querySelectorAll(selector) { return this.childNodes.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  compareDocumentPosition(node) {
    let top = this;
    while (top.parentNode) top = top.parentNode;
    const walk = current => [current, ...current.childNodes.flatMap(walk)];
    const all = walk(top);
    return all.indexOf(this) < all.indexOf(node) ? 4 : 2;
  }
}

function fixture(initialStorage = [], initialPage = true, isEnabled = () => true) {
  const html = new Element("html"), head = new Element("head"), body = new Element("body");
  const root = new Element(); root.id = "page-container";
  const main = new Element("main"); main.id = "main-container";
  const header = new Element("header"); header.id = "page-header"; header.height = 64;
  const theme = new Element(); theme.id = "header-theme";
  const left = new Element(); theme.append(left); header.append(theme);
  html.append(head, body); body.append(root); root.append(main); main.append(header);
  const storage = new Map(initialStorage), events = new Map(), observers = [];
  globalThis.document = {
    documentElement: html, head, body,
    createElement: tag => new Element(tag), createComment: () => new Element("#COMMENT"),
    getElementById: id => html.querySelector(`#${id}`),
  };
  globalThis.window = { innerHeight: 800, innerWidth: 1000,
    addEventListener: (name, callback) => events.set(name, callback),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  };
  globalThis.getComputedStyle = node => ({ display: node.style.display ?? "block",
    paddingTop: node.style.paddingTop ?? "0px", paddingLeft: node.style.paddingLeft ?? "0px", paddingRight: node.style.paddingRight ?? "0px" });
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); observers.push(this); }
    observe(node) { this.nodes.add(node); }
    disconnect() { this.nodes.clear(); }
  };
  const jqueryEvents = new Map();
  globalThis.$ = () => ({ on: (name, callback) => jqueryEvents.set(name, callback) });
  const page = (name, skill = true) => {
    const node = new Element(); node.id = `${name}-container`; main.append(node);
    const info = new Element(); info.className = "skill-info";
    const progress = new Element("skill-header"); info.append(progress);
    const row = new Element(); row.className = "row";
    const realm = new Element("realm-select-menu"), cards = new Element(); cards.id = "cards";
    if (skill) node.append(info);
    node.append(row); row.append(realm, cards);
    return { node, info, row, realm, cards, page: { id: `melvorD:${name}`, containerID: node.id } };
  };
  const skill = page("Smithing"), game = { openPage: initialPage ? skill.page : undefined };
  const update = installPagePinning({}, game, isEnabled);
  update();
  const button = header.querySelector(".kroky-page-pin");
  return { html, root, main, header, theme, left, storage, events, observers, jqueryEvents, page, skill, game, update, button,
    pinned: () => skill.node.querySelector(".kroky-page-pin-controls") };
}

test("default stays unpinned with a labelled accessible phone-sized button", () => {
  const f = fixture();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.button.getAttribute("aria-label"), "Pin headers throughout the game");
  assert.equal(f.button.querySelector("span").textContent, "Pin");
  assert.equal(f.button.querySelector("i").getAttribute("aria-hidden"), "true");
  assert.equal(f.button.classList.contains("btn-dual"), true);
  assert.equal(f.button.classList.contains("btn-info"), false);
  assert.equal(f.pinned(), null);
  assert.deepEqual(f.skill.node.children, [f.skill.info, f.skill.row]);
  assert.equal(f.skill.realm.parentNode, f.skill.row);
  assert.equal(f.header.parentNode, f.main);
  assert.equal(f.update.offset, 0);
  assert.match(document.head.children[0].textContent, /min-width: 32px; min-height: 32px/);
  assert.match(document.head.children[0].textContent, /\[aria-pressed="false"\] > i \{ transform: rotate\(-45deg\); \}/);
});

test("Pin and Unpin labels, native button colours and icon states stay distinct at every screen width", () => {
  const f = fixture();
  const label = f.button.querySelector("span"), icon = f.button.querySelector("i");
  for (const width of [390, 844, 1200]) {
    window.innerWidth = width;
    f.update();
    assert.equal(label.textContent, "Pin");
    assert.equal(f.button.getAttribute("aria-pressed"), "false");
    f.button.click();
    assert.equal(label.textContent, "Unpin");
    assert.equal(f.button.getAttribute("aria-label"), "Unpin headers throughout the game");
    assert.equal(f.button.getAttribute("aria-pressed"), "true");
    assert.equal(f.button.classList.contains("btn-info"), true);
    assert.equal(f.button.classList.contains("btn-dual"), false);
    assert.equal(f.button.classList.contains("text-combat-smoke"), false);
    assert.equal(f.button.querySelector("i"), icon);
    f.button.click();
    assert.equal(label.textContent, "Pin");
    assert.equal(f.button.classList.contains("btn-dual"), true);
    assert.equal(f.button.classList.contains("btn-info"), false);
  }
  assert.equal(label.className, "", "action text has no responsive hiding class");
  assert.match(document.head.children[0].textContent, /white-space: nowrap/);
});

test("pinning preserves original nodes, callbacks, order and cards, and unpin restores exact positions", () => {
  const f = fixture();
  const action = () => {};
  f.skill.realm.onclick = action;
  const originalHeaderParent = f.header.parentNode;
  f.button.click();
  const wrapper = f.pinned();
  assert.ok(wrapper);
  assert.deepEqual(wrapper.children, [f.skill.info, f.skill.realm]);
  assert.equal(f.skill.info.children[0].tagName, "SKILL-HEADER");
  assert.equal(f.skill.realm.onclick, action);
  assert.equal(f.skill.cards.parentNode, f.skill.row);
  assert.equal(f.header.parentNode, originalHeaderParent);
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.root.classList.contains("kroky-page-pinned"), true);
  const moves = f.skill.realm.moves;
  f.update(); f.update();
  assert.equal(f.skill.realm.moves, moves, "render updates must not reconnect native custom elements");
  f.button.click();
  assert.deepEqual(f.skill.node.children, [f.skill.info, f.skill.row]);
  assert.deepEqual(f.skill.row.children, [f.skill.realm, f.skill.cards]);
  assert.equal(f.skill.node.querySelector(".kroky-page-pin-controls"), null);
  assert.equal(f.root.classList.contains("kroky-page-pinned"), false);
  assert.equal(f.update.offset, 0);
});

test("one local pin preference follows page changes, survives installation, and restores outgoing nodes", () => {
  const f = fixture();
  f.button.click();
  const bank = f.page("Bank", false);
  f.game.openPage = bank.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.skill.realm.parentNode, f.skill.row);
  assert.equal(f.skill.node.querySelector(".kroky-page-pin-controls"), null);
  assert.equal(f.storage.get("kroky-better-ui:pin"), "true");
  assert.equal([...f.storage.keys()].some(key => key.startsWith("kroky-workforce:pin:")), false);
  assert.ok(bank.node.querySelector(".kroky-page-pin-controls"));
  f.game.openPage = f.skill.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.skill.realm.parentNode, f.pinned());
  f.button.click();
  assert.equal(f.storage.get("kroky-better-ui:pin"), "false");
  f.game.openPage = bank.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(bank.node.querySelector(".kroky-page-pin-controls"), null);
  assert.equal(f.skill.realm.parentNode, f.skill.row);
  const nextInstallation = installPagePinning({}, f.game); nextInstallation();
  assert.equal(f.root.classList.contains("kroky-page-pinned"), false);
  const restored = fixture(f.storage);
  assert.equal(restored.button.getAttribute("aria-pressed"), "false");
  restored.button.click();
  const pinnedInstallation = fixture(restored.storage);
  assert.equal(pinnedInstallation.button.getAttribute("aria-pressed"), "true");
  assert.ok(pinnedInstallation.pinned());
});

test("legacy migration waits for the first real page and uses its saved preference globally", () => {
  const f = fixture([
    ["kroky-workforce:pin:melvorD:Smithing", "true"],
    ["kroky-workforce:pin:melvorD:Bank", "false"],
  ], false);
  assert.equal(f.button.disabled, true);
  assert.equal(f.storage.has("kroky-better-ui:pin"), false);
  f.game.openPage = f.skill.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.storage.get("kroky-better-ui:pin"), "true");
  const bank = f.page("Bank", false);
  f.game.openPage = bank.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true", "other legacy pages cannot replace the migrated global preference");
  f.button.click();
  assert.equal(f.storage.get("kroky-better-ui:pin"), "false");
  assert.equal(f.storage.get("kroky-workforce:pin:melvorD:Smithing"), "true", "old preferences do not need to be modified");
});

test("saved global false wins over legacy true and remains off on other pages", () => {
  const f = fixture([
    ["kroky-better-ui:pin", "false"],
    ["kroky-workforce:pin", "true"],
    ["kroky-workforce:pin:melvorD:Smithing", "true"],
    ["kroky-workforce:pin:melvorD:Bank", "true"],
  ]);
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.pinned(), null);
  f.game.openPage = f.page("Bank", false).page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.storage.get("kroky-better-ui:pin"), "false");
});

test("Workforce's global preference migrates once without changing the original value", () => {
  for (const value of ["true", "false"]) {
    const f = fixture([["kroky-workforce:pin", value], ["kroky-workforce:pin:melvorD:Smithing", "true"]]);
    assert.equal(f.button.getAttribute("aria-pressed"), value);
    assert.equal(f.storage.get("kroky-better-ui:pin"), value);
    f.button.click();
    assert.equal(f.storage.get("kroky-workforce:pin"), value);
    const restored = fixture(f.storage);
    assert.equal(restored.button.getAttribute("aria-pressed"), String(value !== "true"));
  }
});

test("disabled pinning hides and disables its button until enabled, retaining the saved preference", () => {
  let enabled = false;
  const f = fixture([["kroky-workforce:pin", "true"]], true, () => enabled);
  assert.equal(f.button.classList.contains("d-none"), true);
  assert.equal(f.button.disabled, true);
  assert.equal(f.pinned(), null);
  f.button.click();
  assert.equal(f.storage.has("kroky-better-ui:pin"), false);
  enabled = true; f.update();
  assert.equal(f.button.classList.contains("d-none"), false);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.ok(f.pinned());
});

test("disabling pinned headers restores controls and dropdowns immediately and re-enabling resumes pinning", () => {
  let enabled = true;
  const f = fixture([["kroky-better-ui:pin", "true"]], true, () => enabled);
  const owner = new Element(), menu = new Element(); menu.className = "dropdown-menu show";
  owner.append(menu); f.skill.info.append(owner);
  f.jqueryEvents.get("shown.bs.dropdown.krokyPagePin")({ target: owner });
  assert.equal(menu.parentNode, document.body);
  f.root.classList.add("page-header-fixed-mobile"); window.innerWidth = 390;
  enabled = false; f.update();
  assert.equal(f.pinned(), null);
  assert.equal(f.root.classList.contains("kroky-page-pinned"), false);
  assert.equal(f.button.classList.contains("d-none"), true);
  assert.equal(f.button.disabled, true);
  assert.equal(menu.parentNode, owner);
  assert.deepEqual(f.skill.node.children, [f.skill.info, f.skill.row]);
  assert.equal(f.skill.realm.parentNode, f.skill.row);
  assert.equal(f.update.offset, 64);
  assert.equal(f.storage.get("kroky-better-ui:pin"), "true");
  enabled = true; f.update();
  assert.ok(f.pinned());
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.header.querySelectorAll(".kroky-page-pin").length, 1);
});

test("default and legacy unpinned choices settle once instead of changing with another page's legacy pin", () => {
  for (const initial of [[], [["kroky-workforce:pin:melvorD:Smithing", "false"]]]) {
    const f = fixture([...initial, ["kroky-workforce:pin:melvorD:Bank", "true"]]);
    assert.equal(f.button.getAttribute("aria-pressed"), "false");
    f.game.openPage = f.page("Bank", false).page; f.update();
    assert.equal(f.button.getAttribute("aria-pressed"), "false");
    assert.equal(f.root.classList.contains("kroky-page-pinned"), false);
  }
});

test("hidden native-view ancestors remain hidden and changing views restores their nodes", () => {
  const f = fixture();
  f.skill.row.classList.add("d-none");
  const toolbar = new Element(); toolbar.className = "kroky-production-toolbar";
  const tabs = new Element(); tabs.className = "kroky-production-tabs";
  const summary = new Element(); summary.className = "kroky-activity-summary";
  f.skill.node.append(tabs, toolbar, summary);
  f.button.click();
  assert.deepEqual(f.pinned().children, [f.skill.info, tabs, toolbar, summary]);
  assert.equal(f.skill.realm.parentNode, f.skill.row);
  f.skill.row.classList.remove("d-none");
  toolbar.classList.add("d-none"); tabs.hidden = true; summary.hidden = true;
  f.update();
  assert.deepEqual(f.pinned().children, [f.skill.info, f.skill.realm]);
  assert.equal(toolbar.parentNode, f.skill.node);
  assert.equal(tabs.parentNode, f.skill.node);
  assert.equal(summary.parentNode, f.skill.node);
  f.skill.row.classList.add("d-none"); f.update();
  assert.equal(f.skill.realm.parentNode, f.skill.row);
});

test("newly mounted controls enter their original document order while pinned", () => {
  const f = fixture();
  f.button.click();
  const toolbar = new Element(); toolbar.className = "kroky-gathering-toolbar";
  f.skill.row.before(toolbar);
  const summary = new Element(); summary.className = "kroky-activity-summary";
  const controls = new Element(); controls.className = "kroky-activity-controls";
  const release = new Element("button");
  let releases = 0;
  release.addEventListener("click", () => releases++); controls.append(release);
  toolbar.before(summary); summary.after(controls);
  f.update();
  assert.deepEqual(f.pinned().children, [f.skill.info, summary, controls, toolbar, f.skill.realm]);
  release.click(); assert.equal(releases, 1);
  f.button.click();
  assert.deepEqual(f.skill.node.children, [f.skill.info, summary, controls, toolbar, f.skill.row]);
  release.click(); assert.equal(releases, 2);
});

test("viewport resize and content growth share a half-screen cap and publish the exact scroll offset", () => {
  const f = fixture();
  f.button.click();
  f.pinned().height = 600;
  f.events.get("resize")();
  assert.equal(f.update.offset, 400);
  window.innerHeight = 360;
  f.events.get("resize")();
  assert.equal(f.update.offset, 180);
  assert.equal(f.html.style.getPropertyValue("--kroky-page-pin-cap"), "180px");
  assert.equal(f.html.style.getPropertyValue("--kroky-page-pin-header-height"), "64px");
  f.header.height = 250;
  f.theme.height = 250;
  f.header.append(new Element());
  f.observers[0].callback();
  assert.equal(f.header.classList.contains("kroky-page-pin-overflow"), true);
  assert.equal(f.update.offset, 180);
  assert.match(document.head.children[0].textContent, /position: static !important; top: auto !important/);
});

test("an open absolute character dropdown does not turn an ordinary header into a clipped scroller", () => {
  const f = fixture();
  window.innerWidth = 390;
  const owner = new Element();
  const menu = new Element(); menu.className = "dropdown-menu show"; menu.height = 500;
  owner.append(menu); f.theme.append(owner);
  f.header.height = 109; f.theme.height = 109;
  f.button.click();
  assert.ok(f.header.scrollHeight > window.innerHeight / 2);
  assert.equal(f.header.classList.contains("kroky-page-pin-overflow"), false);
  f.jqueryEvents.get("shown.bs.dropdown.krokyPagePin")({ target: owner });
  f.observers[0].callback();
  assert.equal(f.header.classList.contains("kroky-page-pin-overflow"), false);
  assert.equal(menu.parentNode, owner, "ordinary global dropdowns keep their native placement");
  f.theme.height = 600;
  f.observers[0].callback();
  assert.equal(f.header.classList.contains("kroky-page-pin-overflow"), true, "genuinely tall header content still scrolls");
});

test("unpinned phones publish the native sticky header offset without changing the native layout", () => {
  const f = fixture();
  f.root.classList.add("page-header-fixed-mobile");
  window.innerWidth = 390;
  f.update();
  assert.equal(f.update.offset, 64);
  assert.equal(f.root.classList.contains("kroky-page-pinned"), false);
  assert.equal(f.pinned(), null);
  assert.deepEqual(f.skill.node.children, [f.skill.info, f.skill.row]);
  f.header.height = 108;
  f.observers[0].callback();
  assert.equal(f.update.offset, 108, "native wrapping updates the jump offset");
  f.button.click(); f.button.click();
  assert.equal(f.update.offset, 108, "unpin restores the native mobile offset");
  window.innerWidth = 1200;
  f.events.get("resize")();
  assert.equal(f.update.offset, 0);
});

test("Combat's destructive XP-table disconnect lifecycle is avoided while its navigation is pinned", () => {
  const f = fixture();
  const combat = f.page("Combat", false);
  combat.row.remove();
  const top = new Element(); top.id = "combat-top-menu"; top.height = 120;
  const table = new Element("combat-skill-progress-table"); top.append(table);
  const nav = new Element("category-menu"); nav.id = "combat-area-category-menu";
  combat.node.append(top, nav, combat.cards);
  const originalMoves = top.moves;
  f.game.openPage = combat.page; f.update(); f.button.click();
  const wrapper = combat.node.querySelector(".kroky-page-pin-controls");
  assert.deepEqual(combat.node.children, [top, wrapper, combat.cards]);
  assert.equal(top.parentNode, combat.node);
  assert.equal(top.moves, originalMoves);
  assert.equal(table.parentNode, top);
  assert.equal(nav.parentNode, wrapper);
  assert.ok(top.classList.contains("kroky-page-pin-static"));
  f.button.click();
  assert.deepEqual(combat.node.children, [top, nav, combat.cards]);
  assert.equal(top.moves, originalMoves);
  assert.equal(top.classList.contains("kroky-page-pin-static"), false);
});

test("short landscape Combat keeps both native sections scrollable within the half-screen cap", () => {
  const f = fixture();
  const combat = f.page("Combat", false);
  combat.row.remove();
  const top = new Element(); top.id = "combat-top-menu"; top.height = 160;
  const table = new Element("combat-skill-progress-table"); table.height = 0; top.append(table);
  const nav = new Element("category-menu"); nav.height = 100;
  combat.node.append(top, nav, combat.cards);
  const originalMoves = top.moves;
  window.innerHeight = 390; window.innerWidth = 844;
  f.header.height = 100; f.theme.height = 100;
  f.game.openPage = combat.page; f.update(); f.button.click();
  const wrapper = combat.node.querySelector(".kroky-page-pin-controls");
  const variable = name => parseFloat(f.html.style.getPropertyValue(`--kroky-page-pin-${name}`)) || 0;
  const allocatedHeight = (node, reserve) => Math.min(node.scrollHeight, Math.max(0, variable("cap") - variable("header-height") - variable(reserve)));
  top.getBoundingClientRect = () => ({ height: allocatedHeight(top, "reserved-height") });
  wrapper.getBoundingClientRect = () => ({ height: allocatedHeight(wrapper, "static-height") });
  for (const [topHeight, navHeight] of [[160, 100], [20, 100], [160, 20], [160, 0]]) {
    top.height = topHeight; nav.height = navHeight; wrapper.height = 0;
    f.events.get("resize")();
    const fixed = variable("static-height"), controls = wrapper.getBoundingClientRect().height;
    assert.ok(fixed > 0, "the unchanged native XP/equipment segment must remain visible");
    if (navHeight > 0) assert.ok(controls > 0, "navigation must retain a visible scrolling area");
    assert.ok(fixed + controls <= 95, "both sections share the 95 pixels left below the header");
    assert.equal(f.update.offset, 100 + fixed + controls);
    if (topHeight === 20) assert.equal(fixed, 20, "short content leaves its unused allocation to navigation");
    if (navHeight === 20) assert.equal(controls, 20, "short navigation leaves its unused allocation to the native segment");
    assert.equal(top.moves, originalMoves);
    assert.equal(table.parentNode, top);
  }
  f.button.click();
  assert.deepEqual(combat.node.children, [top, nav, combat.cards]);
  assert.equal(top.moves, originalMoves);
});

test("pinned Combat offsets follow the native container padding as the viewport changes", () => {
  const f = fixture();
  const combat = f.page("Combat", false);
  combat.row.remove();
  const top = new Element(); top.id = "combat-top-menu";
  const table = new Element("combat-skill-progress-table"); top.append(table);
  const nav = new Element("category-menu"); nav.id = "combat-area-category-menu";
  combat.node.append(top, nav, combat.cards);
  Object.assign(combat.node.style, { paddingTop: "30px", paddingLeft: "30px", paddingRight: "30px" });
  window.innerWidth = 844;
  f.game.openPage = combat.page; f.update(); f.button.click();
  const padding = side => f.html.style.getPropertyValue(`--kroky-page-pin-content-${side}`);
  assert.deepEqual([padding("top"), padding("left"), padding("right")], ["30px", "30px", "30px"]);
  window.innerWidth = 390;
  Object.assign(combat.node.style, { paddingTop: "12px", paddingLeft: "8px", paddingRight: "10px" });
  f.events.get("resize")();
  assert.deepEqual([padding("top"), padding("left"), padding("right")], ["12px", "8px", "10px"]);
  delete combat.node.style.paddingTop; delete combat.node.style.paddingLeft; delete combat.node.style.paddingRight;
  f.observers[0].callback();
  assert.deepEqual([padding("top"), padding("left"), padding("right")], ["0px", "0px", "0px"]);
  assert.equal(top.parentNode, combat.node, "measuring responsive padding does not reconnect Combat's XP table");
  assert.equal(table.parentNode, top);
});

test("all pages including Township, Farming, Bank, Settings and Shop share the same pin choice", () => {
  const f = fixture();
  f.button.click();
  for (const name of ["Township", "Farming", "Bank", "Settings", "Shop", "Combat", "Statistics"]) {
    const page = f.page(name, name === "Township" || name === "Farming");
    f.game.openPage = page.page; f.update();
    assert.equal(f.button.disabled, false);
    assert.equal(f.button.getAttribute("aria-pressed"), "true");
    assert.equal(f.storage.get("kroky-better-ui:pin"), "true");
    assert.equal(f.storage.has(`kroky-workforce:pin:melvorD:${name}`), false);
    assert.ok(page.node.querySelector(".kroky-page-pin-controls"));
  }
  f.button.click();
  f.game.openPage = f.skill.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.pinned(), null);
});

test("storage denial retains one usable session preference across pages without touching character saves", () => {
  const f = fixture([], false);
  window.localStorage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  f.game.openPage = f.skill.page;
  f.update(); f.button.click();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  const bank = f.page("Bank", false);
  f.game.openPage = bank.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.ok(bank.node.querySelector(".kroky-page-pin-controls"));
  f.button.click();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  f.game.openPage = f.skill.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.pinned(), null);
  assert.equal(f.storage.size, 0);
});

test("write denial preserves a migrated pin and later session changes", () => {
  const f = fixture([["kroky-workforce:pin:melvorD:Smithing", "true"]], false);
  window.localStorage.setItem = () => { throw new Error("denied"); };
  f.game.openPage = f.skill.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.storage.has("kroky-better-ui:pin"), false);
  const bank = f.page("Bank", false);
  f.game.openPage = bank.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  f.button.click();
  f.game.openPage = f.skill.page; f.update();
  assert.equal(f.button.getAttribute("aria-pressed"), "false", "a failed write cannot resurrect the old true preference");
});

test("dropdowns escape the scrolling cap and restore their original styles and position after closing", () => {
  const f = fixture();
  const owner = new Element();
  const menu = new Element(); menu.className = "dropdown-menu show";
  menu.setAttribute("style", "transform: translate3d(2px, 4px, 0)");
  owner.append(menu); f.skill.info.append(owner);
  f.button.click();
  f.jqueryEvents.get("shown.bs.dropdown.krokyPagePin")({ target: owner });
  assert.equal(menu.parentNode, document.body);
  assert.equal(menu.style.position, "fixed");
  assert.equal(menu.style.zIndex, "1055");
  f.jqueryEvents.get("hidden.bs.dropdown.krokyPagePin")({ target: owner });
  assert.equal(menu.parentNode, owner);
  assert.equal(menu.getAttribute("style"), "transform: translate3d(2px, 4px, 0)");
  f.jqueryEvents.get("shown.bs.dropdown.krokyPagePin")({ target: owner });
  f.button.click();
  assert.equal(menu.parentNode, owner, "unpinning also restores an open dropdown");
});

test("genuinely oversized global headers portal their own dropdowns without intercepting ordinary page menus", () => {
  const f = fixture();
  f.theme.height = 600;
  const owner = new Element(), menu = new Element(); menu.className = "dropdown-menu show";
  owner.append(menu); f.theme.append(owner);
  const cardOwner = new Element(), cardMenu = new Element(); cardMenu.className = "dropdown-menu show";
  cardOwner.append(cardMenu); f.skill.cards.append(cardOwner);
  f.button.click();
  assert.equal(f.header.classList.contains("kroky-page-pin-overflow"), true);
  const show = f.jqueryEvents.get("shown.bs.dropdown.krokyPagePin");
  show({ target: cardOwner });
  assert.equal(cardMenu.parentNode, cardOwner);
  show({ target: owner });
  assert.equal(menu.parentNode, document.body);
  f.button.click();
  assert.equal(menu.parentNode, owner);
});
