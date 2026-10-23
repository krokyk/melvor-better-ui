import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installPagePinning } from "../page-pinning.mjs";

afterEach(() => {
  for (const name of ["document", "window", "getComputedStyle", "ResizeObserver", "$", "tippy"]) delete globalThis[name];
});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.className = "";
    this.attributes = {};
    this.listeners = {};
    this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] ?? ""; }, removeProperty(name) { const value = this[name] ?? ""; delete this[name]; return value; } };
    this.height = 40;
    this.width = 300;
    this.moves = 0;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      toggle: (name, flag) => {
        const present = this.classList.contains(name);
        if (flag === undefined) flag = !present;
        if (flag !== present) flag ? this.classList.add(name) : this.classList.remove(name);
        return flag;
      },
    };
  }
  get children() { return this.childNodes.filter(node => node.tagName !== "#COMMENT"); }
  get parentElement() { return this.parentNode; }
  get firstElementChild() { return this.children[0]; }
  get scrollHeight() { return this.hidden ? 0 : Math.max(this.height, this.children.reduce((height, node) => height + node.scrollHeight, 0)); }
  getBoundingClientRect() { return { top: 100, left: 40, height: this.hidden ? 0 : this.height, width: this.width }; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
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

function fixture(initialStorage = [], initialPage = true, isEnabled = () => true, isCompactHeaderEnabled = () => true) {
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
  const update = installPagePinning({}, game, isEnabled, isCompactHeaderEnabled);
  update();
  const button = header.querySelector(".kroky-page-pin");
  return { html, root, main, header, theme, left, storage, events, observers, jqueryEvents, page, skill, game, update, button,
    pinned: () => skill.node.querySelector(".kroky-page-pin-controls") };
}

function nativeSkillHeader(skill, charges = true) {
  const header = skill.info.querySelector("skill-header");
  const block = new Element(); block.className = "block";
  const upper = new Element(); upper.className = "row bg-dark";
  header.upperContainer = upper;
  for (const [name, text, value] of [["skillLevel", "Skill Level", "120 / 120"], ["skillXp", "Skill XP", "248,739,822"], ["abyssalLevel", "Abyssal Level", "60 / 60"], ["abyssalXp", "Abyssal XP", "42,000,000"]]) {
    const group = new Element(); group.className = "col-12 col-md-3";
    const label = new Element("lang-string"); label.textContent = text;
    const span = new Element("span"); span.textContent = value;
    const valueParent = name.endsWith("Xp") ? new Element() : group;
    valueParent.append(label, span);
    if (valueParent !== group) group.append(valueParent);
    header[name] = span; upper.append(group);
  }
  const upgrades = new Element(); upgrades.className = "col-12 col-md-3";
  const chain = new Element("upgrade-chain-display");
  chain.upgradeName = new Element("span"); chain.upgradeName.textContent = "Dragon Pickaxe";
  chain.upgradeImg = new Element("img");
  chain.append(chain.upgradeName, chain.upgradeImg); upgrades.append(chain);
  header.upgradeChainContainer = upgrades; upper.append(upgrades);
  const items = new Element(); items.className = "col-12 col-md-3";
  if (charges) items.append(new Element("item-charge-display"));
  else items.classList.add("d-none");
  header.itemChargeContainer = items; upper.append(items);
  const mastery = new Element("mastery-skill-options");
  const masteryButtons = new Element();
  mastery.viewCheckpointsButton = new Element("button"); mastery.viewCheckpointsButton.textContent = "View Checkpoints";
  mastery.spendMasteryButton = new Element("button"); mastery.spendMasteryButton.textContent = "Spend Mastery Pool XP";
  masteryButtons.append(mastery.viewCheckpointsButton, mastery.spendMasteryButton); mastery.append(masteryButtons);
  const tree = new Element("skill-tree-button"), treeAction = new Element("button");
  const treeLabel = new Element("lang-string"); treeLabel.textContent = "View Skill Tree";
  treeAction.textContent = "View Skill Tree";
  treeAction.append(treeLabel);
  tree.append(treeAction); header.skillTreeButton = tree;
  block.append(upper, mastery, tree); header.append(block);
  return { header, block, upper, upgrades, chain, items, mastery, masteryButtons, tree, treeAction };
}

test("default stays unpinned with an accessible icon-only phone-sized button", () => {
  const f = fixture();
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.button.getAttribute("aria-label"), "Pin headers throughout the game");
  assert.equal(f.button.title, "Pin headers throughout the game");
  assert.equal(f.button.querySelector("span"), null);
  assert.equal(f.button.children.length, 1);
  assert.equal(f.button.querySelector("i").className, "fa fa-thumbtack");
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

test("icon-only pin action retains accessible names, native colours and icon identity at every screen width", () => {
  const f = fixture();
  const icon = f.button.querySelector("i");
  for (const width of [390, 844, 1200]) {
    window.innerWidth = width;
    f.update();
    assert.equal(f.button.querySelector("span"), null);
    assert.equal(f.button.getAttribute("aria-label"), "Pin headers throughout the game");
    assert.equal(f.button.title, "Pin headers throughout the game");
    assert.equal(f.button.getAttribute("aria-pressed"), "false");
    f.button.click();
    assert.equal(f.button.querySelector("span"), null);
    assert.equal(f.button.getAttribute("aria-label"), "Unpin headers throughout the game");
    assert.equal(f.button.title, "Unpin headers throughout the game");
    assert.equal(f.button.getAttribute("aria-pressed"), "true");
    assert.equal(f.button.classList.contains("btn-info"), true);
    assert.equal(f.button.classList.contains("btn-dual"), false);
    assert.equal(f.button.classList.contains("text-combat-smoke"), false);
    assert.equal(f.button.querySelector("i"), icon);
    f.button.click();
    assert.equal(f.button.querySelector("span"), null);
    assert.equal(f.button.classList.contains("btn-dual"), true);
    assert.equal(f.button.classList.contains("btn-info"), false);
  }
  assert.match(document.head.children[0].textContent, /white-space: nowrap/);
});

test("skill summary stays below the main header with native controls and restorable mastery actions", () => {
  const f = fixture(), native = nativeSkillHeader(f.skill);
  native.chain.upgradeImg.setAttribute("alt", "Native pickaxe");
  native.chain.upgradeImg.setAttribute("tabindex", "-1");
  const originalGroups = [...native.upper.children];
  const spans = [native.header.skillLevel, native.header.skillXp, native.header.abyssalLevel, native.header.abyssalXp];
  const xpParent = native.header.skillXp.parentElement;
  const labels = [...spans.map(span => span.parentElement.querySelector("lang-string")), native.treeAction.querySelector("lang-string")];
  const compactLabels = ["Level", "XP", "Abyssal Level", "Abyssal XP", "Skill tree"];
  let treeClicks = 0;
  native.treeAction.addEventListener("click", () => treeClicks++);
  let checkpoints = 0, spends = 0;
  native.mastery.viewCheckpointsButton.className = "btn btn-info mr-2";
  native.mastery.viewCheckpointsButton.style.setProperty("margin-left", "3px");
  native.mastery.spendMasteryButton.className = "btn btn-warning";
  native.mastery.spendMasteryButton.style.setProperty("padding", ".375rem .75rem");
  native.mastery.viewCheckpointsButton.addEventListener("click", () => checkpoints++);
  native.mastery.spendMasteryButton.addEventListener("click", () => spends++);
  f.game.shop = { renderQueue: { upgrades: false } };
  f.button.click();
  assert.ok(native.upper.parentNode === native.block, "the summary retains its native block parent");
  assert.equal(f.header.contains(native.upper), false);
  assert.equal(native.upper.classList.contains("kroky-page-header-details"), true);
  assert.equal(native.header.classList.contains("kroky-skill-header-compact"), true);
  assert.equal(native.tree.parentNode, native.upper);
  const actions = native.upper.querySelector(".kroky-summary-actions");
  const stats = native.upper.querySelector(".kroky-summary-stats"), pools = native.upper.querySelector(".kroky-summary-pools");
  assert.ok(actions);
  assert.ok(stats);
  assert.deepEqual(stats.children, originalGroups.filter(group => group !== native.upgrades && group !== native.items));
  assert.ok(spans.every(span => stats.contains(span)));
  assert.ok(native.header.skillXp.parentElement === xpParent, "the native XP value wrapper is preserved");
  const summaryOrder = [stats, ...(pools ? [pools] : []), actions, native.upgrades, native.items, native.tree];
  assert.equal(native.upper.children.length, summaryOrder.length);
  assert.ok(native.upper.children.every((group, index) => group === summaryOrder[index]), "enhancements follow mastery actions immediately before Skill tree");
  assert.deepEqual(actions.children, [native.mastery.viewCheckpointsButton, native.mastery.spendMasteryButton]);
  assert.ok(native.upper.children.at(-1) === native.tree, "Skill tree follows both mastery actions at the end of the summary");
  assert.equal(native.mastery.viewCheckpointsButton.className, "btn btn-info mr-2");
  assert.equal(native.mastery.viewCheckpointsButton.style.getPropertyValue("margin-left"), "3px");
  assert.equal(native.mastery.spendMasteryButton.className, "btn btn-warning");
  assert.equal(native.mastery.spendMasteryButton.style.getPropertyValue("padding"), ".375rem .75rem");
  assert.equal(native.mastery.parentNode, native.block);
  assert.equal(native.mastery.classList.contains("kroky-summary-mastery-native"), true);
  assert.equal(f.pinned().contains(native.mastery), true);
  assert.equal(f.header.contains(native.mastery), false, "mastery progress remains below the main header");
  assert.equal(native.chain.parentNode, native.upgrades);
  assert.equal(native.chain.upgradeImg.getAttribute("alt"), "Dragon Pickaxe");
  assert.equal(native.chain.upgradeImg.getAttribute("tabindex"), "0");
  assert.equal(native.treeAction.getAttribute("title"), "View Skill Tree");
  assert.deepEqual(labels.map(label => label.textContent), compactLabels);
  assert.equal(f.game.shop.renderQueue.upgrades, true, "moving native upgrade displays requests tooltip recreation");
  assert.ok(spans.every(span => native.upper.contains(span)));
  native.header.skillXp.textContent = "248,739,999";
  native.treeAction.click(); assert.equal(treeClicks, 1);
  native.mastery.viewCheckpointsButton.click(); native.mastery.spendMasteryButton.click();
  assert.deepEqual([checkpoints, spends], [1, 1]);
  const moves = [native.upper, native.tree, native.chain, ...spans].map(node => node.moves);
  f.game.shop.renderQueue.upgrades = false;
  labels[0].textContent = "Skill Level";
  labels[4].textContent = "View Skill Tree";
  f.update(); f.update();
  assert.deepEqual(labels.map(label => label.textContent), compactLabels, "native retranslation retains the compact visible labels");
  assert.deepEqual([native.upper, native.tree, native.chain, ...spans].map(node => node.moves), moves);
  assert.equal(f.game.shop.renderQueue.upgrades, false, "ordinary updates do not reconnect native tooltips");
  f.button.click();
  assert.deepEqual(native.block.children, [native.upper, native.mastery, native.tree]);
  assert.deepEqual(native.upper.children, originalGroups);
  assert.equal(native.upper.querySelector(".kroky-summary-stats"), null);
  assert.equal(native.upper.querySelector(".kroky-summary-pools"), null);
  assert.deepEqual(native.masteryButtons.children, [native.mastery.viewCheckpointsButton, native.mastery.spendMasteryButton]);
  assert.equal(native.mastery.viewCheckpointsButton.className, "btn btn-info mr-2");
  assert.equal(native.mastery.viewCheckpointsButton.style.getPropertyValue("margin-left"), "3px");
  assert.equal(native.mastery.spendMasteryButton.style.getPropertyValue("padding"), ".375rem .75rem");
  assert.equal(native.mastery.classList.contains("kroky-summary-mastery-native"), false);
  assert.equal(native.upper.classList.contains("kroky-page-header-details"), false);
  assert.equal(native.header.classList.contains("kroky-skill-header-compact"), false);
  assert.equal(f.skill.info.parentNode, f.skill.node);
  assert.equal(native.header.skillXp.textContent, "248,739,999");
  assert.equal(native.chain.upgradeImg.getAttribute("alt"), "Native pickaxe");
  assert.equal(native.chain.upgradeImg.getAttribute("tabindex"), "-1");
  assert.equal(native.treeAction.getAttribute("title"), null);
  assert.deepEqual(labels.map(label => label.textContent), ["Skill Level", "Skill XP", "Abyssal Level", "Abyssal XP", "View Skill Tree"]);
  native.treeAction.click(); assert.equal(treeClicks, 2);
  native.mastery.viewCheckpointsButton.click(); native.mastery.spendMasteryButton.click();
  assert.deepEqual([checkpoints, spends], [2, 2]);
  assert.equal(f.game.shop.renderQueue.upgrades, true);
});

test("header details restore before page changes and config changes without requiring enhancements or Shop", () => {
  let enabled = true;
  const f = fixture([], true, () => enabled), first = nativeSkillHeader(f.skill, false);
  const next = f.page("Mining"), second = nativeSkillHeader(next, false);
  second.header.upgradeChainContainer.classList.add("d-none");
  second.header.skillTreeButton.classList.add("d-none");
  second.treeAction.setAttribute("title", "Native tree tooltip");
  f.button.click();
  assert.ok(first.upper.parentNode === first.block, "the first summary retains its native block parent");
  f.game.openPage = next.page; f.update();
  assert.deepEqual(first.block.children, [first.upper, first.mastery, first.tree]);
  assert.equal(first.upper.classList.contains("kroky-page-header-details"), false);
  assert.equal(first.header.skillLevel.parentElement.querySelector("lang-string").textContent, "Skill Level");
  assert.equal(first.treeAction.querySelector("lang-string").textContent, "View Skill Tree");
  assert.ok(second.upper.parentNode === second.block, "the next summary retains its native block parent");
  assert.equal(second.treeAction.getAttribute("title"), "Native tree tooltip");
  assert.equal(f.header.contains(first.upper), false);
  assert.equal(f.header.contains(second.mastery), false);
  assert.equal(second.items.classList.contains("d-none"), true);
  assert.equal(second.tree.classList.contains("d-none"), true);
  enabled = false; f.update();
  assert.deepEqual(second.block.children, [second.upper, second.mastery, second.tree]);
  assert.equal(second.header.classList.contains("kroky-skill-header-compact"), false);
  assert.equal(next.info.parentNode, next.node);
  assert.equal(f.left.children.includes(second.upper), false);
  assert.equal(second.chain.upgradeImg.getAttribute("alt"), null);
  assert.equal(second.chain.upgradeImg.getAttribute("tabindex"), null);
  assert.equal(second.treeAction.getAttribute("title"), "Native tree tooltip");
  assert.equal(second.header.skillLevel.parentElement.querySelector("lang-string").textContent, "Skill Level");
  assert.equal(second.treeAction.querySelector("lang-string").textContent, "View Skill Tree");
  enabled = true; f.update();
  assert.ok(second.upper.parentNode === second.block, "the resumed summary retains its native block parent");
  f.game.openPage = f.page("Shop", false).page; f.update();
  assert.deepEqual(second.block.children, [second.upper, second.mastery, second.tree]);
  assert.equal(f.header.querySelector(".kroky-page-header-details"), null);
});

test("compact-header config restores native details independently while page controls remain pinned", () => {
  let compact = true;
  const f = fixture([], true, () => true, () => compact), native = nativeSkillHeader(f.skill);
  const boosts = new Element("skillboost-menu"); f.skill.node.append(boosts);
  native.chain.upgradeImg.setAttribute("alt", "Native pickaxe");
  native.chain.upgradeImg.setAttribute("tabindex", "-1");
  const levelLabel = native.header.skillLevel.parentElement.querySelector("lang-string");
  const xpLabel = native.header.skillXp.parentElement.querySelector("lang-string");
  const treeLabel = native.treeAction.querySelector("lang-string");
  f.button.click();
  const wrapper = f.pinned();
  assert.ok(native.upper.parentNode === native.block, "the summary retains its native block parent");
  assert.equal(boosts.parentNode, wrapper);
  compact = false; f.update();
  assert.deepEqual(native.block.children, [native.upper, native.mastery, native.tree]);
  assert.equal(native.header.classList.contains("kroky-skill-header-compact"), false);
  assert.equal(native.upper.classList.contains("kroky-page-header-details"), false);
  assert.deepEqual([levelLabel.textContent, xpLabel.textContent, treeLabel.textContent], ["Skill Level", "Skill XP", "View Skill Tree"]);
  assert.equal(native.chain.upgradeImg.getAttribute("alt"), "Native pickaxe");
  assert.equal(native.chain.upgradeImg.getAttribute("tabindex"), "-1");
  assert.equal(native.treeAction.getAttribute("title"), null);
  assert.deepEqual(native.masteryButtons.children, [native.mastery.viewCheckpointsButton, native.mastery.spendMasteryButton]);
  assert.equal(f.pinned(), wrapper);
  assert.equal(f.root.classList.contains("kroky-page-pinned"), true);
  assert.equal(f.button.getAttribute("aria-pressed"), "true");
  assert.equal(f.storage.get("kroky-better-ui:pin"), "true");
  assert.equal(f.skill.info.parentNode, wrapper);
  assert.equal(boosts.parentNode, wrapper);
  const moves = [native.upper.moves, native.tree.moves];
  f.update(); f.update();
  assert.deepEqual([native.upper.moves, native.tree.moves], moves);
  compact = true; f.update();
  assert.ok(native.upper.parentNode === native.block, "the summary retains its native block parent");
  assert.equal(native.tree.parentNode, native.upper);
  assert.deepEqual([levelLabel.textContent, xpLabel.textContent, treeLabel.textContent], ["Level", "XP", "Skill tree"]);
  assert.equal(native.mastery.parentNode, native.block);
  assert.equal(f.header.contains(native.mastery), false);
  assert.equal(f.pinned(), wrapper);
  assert.equal(boosts.parentNode, wrapper);
});

test("disabled compact header leaves native details mounted through pinning config changes until enabled", () => {
  let pinning = true, compact = false;
  const f = fixture([], true, () => pinning, () => compact), native = nativeSkillHeader(f.skill);
  const moves = [native.upper.moves, native.tree.moves];
  f.button.click();
  const check = () => {
    assert.deepEqual(native.block.children, [native.upper, native.mastery, native.tree]);
    assert.deepEqual([native.upper.moves, native.tree.moves], moves);
    assert.equal(native.header.classList.contains("kroky-skill-header-compact"), false);
    assert.equal(native.header.skillLevel.parentElement.querySelector("lang-string").textContent, "Skill Level");
    assert.equal(native.treeAction.querySelector("lang-string").textContent, "View Skill Tree");
  };
  check();
  f.update(); check();
  pinning = false; f.update(); check();
  assert.equal(f.pinned(), null);
  pinning = true; f.update(); check();
  assert.ok(f.pinned());
  assert.equal(f.storage.get("kroky-better-ui:pin"), "true");
  compact = true; f.update();
  assert.ok(native.upper.parentNode === native.block, "the summary retains its native block parent");
  assert.equal(native.tree.parentNode, native.upper);
  assert.equal(native.header.skillLevel.parentElement.querySelector("lang-string").textContent, "Level");
  assert.equal(native.treeAction.querySelector("lang-string").textContent, "Skill tree");
  assert.equal(f.header.contains(native.mastery), false);
});

test("skill summary progress follows live native skill values and restores its original decoration", () => {
  let compact = true;
  const f = fixture([], true, () => true, () => compact), native = nativeSkillHeader(f.skill);
  const skill = {
    level: 1, currentLevelCap: 120, nextLevelProgress: 25,
    abyssalLevel: 1, currentAbyssalLevelCap: 60, nextAbyssalLevelProgress: 40,
    getRealmsWithMastery: () => [],
  };
  native.header.setAttribute("data-skill-id", "melvorD:Smithing");
  f.game.skills = { getObjectByID: id => id === "melvorD:Smithing" ? skill : undefined };
  native.header.skillLevel.textContent = "1 / 120";
  native.header.skillXp.textContent = "2,345 / 3,000";
  native.header.abyssalLevel.textContent = "1 / 60";
  native.header.abyssalXp.textContent = "4,567 / 8,000";
  native.header.skillXp.style.setProperty("--kroky-summary-fill", "19%");
  native.header.skillXp.style.setProperty("--kroky-summary-xp-chars", "7");
  native.header.skillXp.setAttribute("role", "note");
  native.header.skillXp.setAttribute("aria-valuenow", "19");
  const fill = field => native.header[field].style.getPropertyValue("--kroky-summary-fill");
  f.button.click();
  assert.deepEqual([fill("skillLevel"), fill("skillXp"), fill("abyssalLevel"), fill("abyssalXp")], ["0%", "25%", "0%", "40%"]);
  assert.equal(native.header.skillXp.getAttribute("role"), "progressbar");
  assert.equal(native.header.skillXp.getAttribute("aria-valuenow"), "25");
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-progress"), true);
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-xp-capped"), false);
  assert.equal(native.header.skillXp.textContent, "2,345 / 3,000");
  skill.level = 120; skill.abyssalLevel = 60;
  skill.nextLevelProgress = 1; skill.nextAbyssalLevelProgress = 2;
  native.header.skillLevel.textContent = "120 / 120";
  native.header.skillXp.textContent = "999,999,999";
  f.update();
  assert.deepEqual([fill("skillLevel"), fill("skillXp"), fill("abyssalLevel"), fill("abyssalXp")], ["100%", "100%", "100%", "100%"]);
  assert.equal(native.header.skillXp.textContent, "999,999,999", "native updates remain the source of displayed XP text");
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-xp-capped"), true);
  assert.equal(native.header.skillXp.style.getPropertyValue("--kroky-summary-xp-chars"), String(native.header.skillXp.textContent.length));
  const style = native.header.skillXp.style, setProperty = style.setProperty;
  const addClass = native.header.skillXp.classList.add;
  let widthWrites = 0;
  let classWrites = 0;
  style.setProperty = function(name, value) { if (name === "--kroky-summary-xp-chars") widthWrites++; setProperty.call(this, name, value); };
  native.header.skillXp.classList.add = (...names) => { classWrites++; addClass(...names); };
  native.header.skillXp.textContent = "999,999,998";
  f.update(); f.update();
  assert.equal(widthWrites, 0, "a new XP value with the same digit count does not resize the capped bar");
  assert.equal(classWrites, 0, "stable XP progress leaves its classes untouched");
  native.header.skillXp.textContent = "1,000,000,000"; f.update();
  assert.equal(widthWrites, 1);
  assert.equal(style.getPropertyValue("--kroky-summary-xp-chars"), String(native.header.skillXp.textContent.length));
  skill.level = 119; f.update();
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-xp-capped"), false);
  assert.equal(style.getPropertyValue("--kroky-summary-xp-chars"), "");
  compact = false; f.update();
  assert.equal(fill("skillXp"), "19%");
  assert.equal(fill("skillLevel"), "");
  assert.equal(native.header.skillXp.getAttribute("role"), "note");
  assert.equal(native.header.skillXp.getAttribute("aria-valuenow"), "19");
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-progress"), false);
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-xp-capped"), false);
  assert.equal(style.getPropertyValue("--kroky-summary-xp-chars"), "7");
  assert.equal(native.header.skillXp.textContent, "1,000,000,000");
});

test("mastery summary orders visible realms, retains full over-cap counts and updates without remounting", () => {
  const f = fixture(), native = nativeSkillHeader(f.skill);
  const melvor = { id: "melvorD:Melvor", name: "Melvor", media: "melvor.png", isUnlocked: true };
  const abyssal = { id: "melvorItA:Abyssal", name: "Abyssal", media: "abyssal.png", isUnlocked: true };
  const other = { id: "mod:Realm", name: "Other realm", media: "other.png", isUnlocked: true };
  const hidden = { id: "mod:Hidden", name: "Hidden realm", media: "hidden.png", isUnlocked: false, showIfLocked: false };
  const shown = { id: "mod:Shown", name: "Shown realm", media: "shown.png", isUnlocked: false, showIfLocked: true };
  const amounts = new Map([[melvor.id, 1500], [abyssal.id, 2500], [other.id, 500], [shown.id, 200]]);
  const baseCaps = new Map();
  f.game.openPage.action = {
    level: 50, currentLevelCap: 120, nextLevelProgress: 30,
    getRealmsWithMastery: () => [other, hidden, abyssal, shown, melvor],
    getMasteryPoolXP: realm => {
      assert.ok(realm.isUnlocked || realm.showIfLocked, "hidden realm XP is not recomputed");
      return amounts.get(realm.id) ?? 0;
    },
    getMasteryPoolCap: realm => {
      assert.ok(realm.isUnlocked || realm.showIfLocked, "hidden realm caps are not recomputed");
      return realm === melvor || realm === abyssal ? 2000 : 1000;
    },
    getBaseMasteryPoolCap: realm => {
      assert.ok(realm.isUnlocked || realm.showIfLocked, "hidden realm base caps are not recomputed");
      return baseCaps.get(realm.id);
    },
  };
  f.button.click();
  const groups = native.upper.querySelectorAll(".kroky-summary-pool");
  assert.deepEqual(groups.map(group => group.getAttribute("data-realm-id")), [melvor.id, abyssal.id, other.id, shown.id]);
  const actions = native.upper.querySelector(".kroky-summary-actions"), children = native.upper.children;
  const stats = native.upper.querySelector(".kroky-summary-stats"), pools = native.upper.querySelector(".kroky-summary-pools");
  assert.ok(children[0] === stats && children[1] === pools, "Level and XP share the first section followed by a separate mastery section");
  assert.ok(groups.every(group => group.parentElement === pools));
  assert.ok(children.indexOf(pools) < children.indexOf(actions), "mastery pool mirrors precede their action buttons");
  assert.ok(children.indexOf(actions) < children.indexOf(native.upgrades), "enhancements follow the mastery buttons");
  assert.ok(children.slice(-3).every((group, index) => group === [native.upgrades, native.items, native.tree][index]), "enhancements and Skill tree finish the row");
  const progress = group => group.querySelector(".kroky-summary-progress");
  const percent = group => group.querySelector(".kroky-summary-percent");
  assert.ok(groups.every(group => group.querySelector("img")));
  assert.ok(groups.every(group => group.children[2] === percent(group)), "the percentage follows each mastery bar");
  assert.deepEqual(groups.map(group => percent(group)?.textContent), ["75.00%", "125.00%", "50.00%", "20.00%"]);
  assert.deepEqual(groups.map(group => progress(group).style.getPropertyValue("--kroky-summary-fill")), ["75%", "100%", "50%", "20%"]);
  assert.equal(progress(groups[1]).textContent.replaceAll(",", ""), "2500 / 2000");
  const moves = groups.map(group => group.moves);
  amounts.set(melvor.id, 2000); amounts.set(abyssal.id, 3000);
  baseCaps.set(other.id, 2000);
  f.update(); f.update();
  assert.deepEqual(native.upper.querySelectorAll(".kroky-summary-pool"), groups);
  assert.deepEqual(groups.map(group => group.moves), moves);
  assert.equal(progress(groups[0]).style.getPropertyValue("--kroky-summary-fill"), "100%");
  assert.equal(progress(groups[1]).textContent.replaceAll(",", ""), "3000 / 2000");
  assert.equal(progress(groups[1]).getAttribute("aria-valuenow"), "100");
  assert.deepEqual(groups.map(group => percent(group).textContent), ["100.00%", "150.00%", "25.00%", "20.00%"]);
  assert.equal(progress(groups[2]).style.getPropertyValue("--kroky-summary-fill"), "50%", "native base-cap percentage is independent of the bar capacity");
  melvor.isUnlocked = false; f.update();
  assert.deepEqual(native.upper.querySelectorAll(".kroky-summary-pool"), groups.slice(1));
  assert.deepEqual(groups.slice(1).map(group => group.moves), moves.slice(1));
  melvor.isUnlocked = true; f.update();
  const restored = native.upper.querySelectorAll(".kroky-summary-pool");
  assert.deepEqual(restored.map(group => group.getAttribute("data-realm-id")), [melvor.id, abyssal.id, other.id, shown.id]);
  assert.deepEqual(restored.slice(1), groups.slice(1), "visible realm groups retain their native DOM identity");
  assert.deepEqual(restored.slice(1).map(group => group.moves), moves.slice(1));
  f.button.click();
  assert.equal(native.upper.querySelector(".kroky-summary-pool"), null);
  assert.equal(native.upper.querySelector(".kroky-summary-actions"), null);
  assert.equal(native.upper.querySelector(".kroky-summary-stats"), null);
  assert.equal(native.upper.querySelector(".kroky-summary-pools"), null);
  assert.deepEqual(native.masteryButtons.children, [native.mastery.viewCheckpointsButton, native.mastery.spendMasteryButton]);
  assert.equal(native.mastery.classList.contains("kroky-summary-mastery-native"), false);
});

test("masteryless skills need no mastery APIs and a level-one cap remains complete", () => {
  const f = fixture(), native = nativeSkillHeader(f.skill, false);
  native.mastery.remove();
  f.game.openPage.action = { level: 1, currentLevelCap: 1, nextLevelProgress: Number.NaN };
  f.button.click();
  assert.ok(native.upper.parentNode === native.block);
  assert.equal(native.upper.querySelector(".kroky-summary-pool"), null);
  assert.equal(native.upper.querySelector(".kroky-summary-actions"), null);
  assert.equal(native.header.skillLevel.style.getPropertyValue("--kroky-summary-fill"), "100%");
  assert.equal(native.header.skillXp.style.getPropertyValue("--kroky-summary-fill"), "100%");
  assert.equal(native.header.abyssalLevel.classList.contains("kroky-summary-progress"), false);
  f.update(); f.update();
  f.button.click();
  assert.deepEqual(native.block.children, [native.upper, native.tree]);
  assert.equal(native.header.skillLevel.classList.contains("kroky-summary-progress"), false);
});

test("hidden and unrelated skill headers never resolve or read their skill calculations", () => {
  const f = fixture(), hidden = nativeSkillHeader(f.skill);
  const other = f.page("Mining"), shown = nativeSkillHeader(other);
  hidden.header.setAttribute("data-skill-id", "melvorD:Smithing");
  shown.header.setAttribute("data-skill-id", "melvorD:Mining");
  hidden.header.hidden = true;
  const hiddenSkill = {};
  Object.defineProperty(hiddenSkill, "level", { get() { assert.fail("hidden fallback skill must not be calculated"); } });
  f.game.openPage.action = hiddenSkill;
  const visibleSkill = { level: 10, currentLevelCap: 100, nextLevelProgress: 35 };
  const lookups = [];
  f.game.skills = { getObjectByID(id) {
    lookups.push(id);
    assert.equal(id, "melvorD:Mining", "unrelated and hidden skill records are not resolved");
    return visibleSkill;
  } };
  f.button.click(); f.update();
  assert.deepEqual(lookups, []);
  f.game.openPage = other.page; f.update();
  assert.deepEqual(lookups, ["melvorD:Mining"]);
  assert.equal(shown.header.skillXp.style.getPropertyValue("--kroky-summary-fill"), "35%");
  shown.header.hidden = true;
  Object.defineProperty(visibleSkill, "level", { get() { assert.fail("a hidden current skill must not be calculated"); } });
  f.update(); f.update();
  assert.deepEqual(lookups, ["melvorD:Mining"]);
});

test("hidden stat groups skip their numeric getters and stable visible progress does not rewrite its style", () => {
  const f = fixture(), native = nativeSkillHeader(f.skill);
  native.mastery.remove();
  for (const field of ["skillXp", "abyssalLevel", "abyssalXp"]) native.header[field].parentElement.classList.add("d-none");
  const skill = { level: 61, currentLevelCap: 121 };
  for (const field of ["nextLevelProgress", "abyssalLevel", "currentAbyssalLevelCap", "nextAbyssalLevelProgress"]) {
    Object.defineProperty(skill, field, { get() { assert.fail(`hidden ${field} must not be calculated`); } });
  }
  f.game.openPage.action = skill;
  const style = native.header.skillLevel.style, setProperty = style.setProperty;
  let writes = 0;
  style.setProperty = function(name, value) { writes++; setProperty.call(this, name, value); };
  f.button.click();
  assert.equal(style.getPropertyValue("--kroky-summary-fill"), "50%");
  assert.equal(native.header.skillXp.classList.contains("kroky-summary-progress"), false);
  const initialWrites = writes;
  f.update(); f.update();
  assert.equal(writes, initialWrites, "unchanged progress leaves the DOM style untouched");
  native.header.skillLevel.parentElement.classList.add("d-none");
  for (const field of ["level", "currentLevelCap"]) {
    Object.defineProperty(skill, field, { get() { assert.fail(`hidden ${field} must not be calculated`); } });
  }
  f.update(); f.update();
  assert.equal(writes, initialWrites);
});

test("native charged-enhancement tooltips recover after every relocation and remain untouched on stable updates", () => {
  let enabled = true;
  const f = fixture([], true, () => enabled), native = nativeSkillHeader(f.skill);
  const display = native.items.querySelector("item-charge-display");
  const item = { id: "melvorD:Coating", description: "+10% Mining XP" };
  display.setAttribute("data-item-id", item.id);
  let disconnects = 0, repairs = 0, tooltip = item.description;
  display.setItem = actual => {
    assert.equal(actual, item);
    repairs++;
    tooltip = actual.description;
  };
  f.game.items = { getObjectByID: id => id === item.id ? item : undefined };
  for (const node of [native.upper, native.items, f.skill.info]) {
    node.remove = function() {
      if (this.parentNode && this.contains(display)) { disconnects++; tooltip = ""; }
      Element.prototype.remove.call(this);
    };
  }
  const check = () => {
    assert.equal(tooltip, item.description);
    assert.equal(repairs, disconnects, "each native disconnect is followed by one setItem repair");
    const count = repairs;
    f.update(); f.update();
    assert.equal(repairs, count, "ordinary rendering does not recreate charge tooltips");
  };
  f.button.click(); check();
  assert.ok(disconnects > 0);
  f.button.click(); check();
  assert.deepEqual(native.block.children, [native.upper, native.mastery, native.tree]);
  f.button.click(); check();
  enabled = false; f.update(); check();
  assert.deepEqual(native.block.children, [native.upper, native.mastery, native.tree]);
});

test("native mastery realm tooltips recover once per ancestor disconnect without stable-update repairs", () => {
  let enabled = true;
  const f = fixture([], true, () => enabled), native = nativeSkillHeader(f.skill);
  const pool = new Element("mastery-pool-display"); native.mastery.append(pool);
  const realm = { id: "melvorD:Melvor", name: "Melvor" }, image = new Element("img");
  pool.append(image);
  const tooltip = () => ({ state: { isDestroyed: false }, destroy() { this.state.isDestroyed = true; } });
  const display = { realmImage: image, realmTooltip: tooltip() };
  pool.realmDisplayMap = new Map([[realm, display]]);
  let disconnects = 0, repairs = 0;
  globalThis.tippy = (target, options) => {
    assert.equal(target, image);
    assert.deepEqual(options, { content: "Melvor", placement: "bottom", allowHTML: false, interactive: false, animation: false });
    repairs++;
    return tooltip();
  };
  f.skill.info.remove = function() {
    if (this.parentNode) { disconnects++; display.realmTooltip.destroy(); }
    Element.prototype.remove.call(this);
  };
  const check = () => {
    assert.equal(display.realmTooltip.state.isDestroyed, false);
    assert.equal(repairs, disconnects, "each native ancestor disconnect repairs its destroyed realm tooltip once");
    const count = repairs;
    f.update(); f.update();
    assert.equal(repairs, count, "ordinary rendering leaves live realm tooltips intact");
  };
  f.button.click(); check();
  assert.equal(disconnects, 1);
  f.button.click(); check();
  assert.equal(pool.parentNode, native.mastery);
  f.button.click(); check();
  enabled = false; f.update(); check();
  assert.equal(pool.parentNode, native.mastery);
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

test("Bank inventory and item details stay in their native columns through pinning and disabling", () => {
  let enabled = true;
  const f = fixture([], true, () => enabled);
  const bank = f.page("Bank", false);
  bank.row.remove();
  const controls = new Element("bank-options-menu");
  const row = new Element(); row.className = "row row-deck gutters-tiny";
  const inventory = new Element("bank-tab-menu"); inventory.id = "bank-tab-menu";
  const block = new Element(); block.className = "block tabbable";
  const tabs = new Element("ul"); tabs.className = "nav nav-tabs sticky-div-mobile";
  const summary = new Element(); summary.className = "bg-dark-bank-info";
  const labels = new Element("span"); labels.textContent = "Space: 1,337 / 1,455 | Bank: 109B GP | Tab: 49B GP";
  summary.append(labels);
  const items = new Element(); items.className = "block-content tab-content";
  block.append(tabs, summary, items); inventory.append(block);
  const column = new Element(); column.className = "col-12 col-lg-5 col-xl-4";
  const box = new Element(); box.id = "bank-item-box";
  const details = new Element("bank-sidebar-menu"); details.id = "main-bank-sidebar";
  const modes = ["move", "sell"].map(mode => {
    const menu = new Element(`bank-${mode}-mode-menu`); menu.id = `main-bank-${mode}-mode`; menu.className = "col-12 d-none";
    row.append(menu);
    return menu;
  });
  box.append(details); column.append(box); row.append(inventory, column); bank.node.append(controls, row);
  const moves = [inventory.moves, box.moves, details.moves];
  f.game.openPage = bank.page; f.update(); f.button.click();
  assert.equal(controls.parentNode.className, "kroky-page-pin-controls");
  assert.equal(inventory.parentNode, row);
  assert.equal(box.parentNode, column);
  assert.equal(details.parentNode, box);
  for (const width of [1200, 991, 992, 390, 1200]) {
    window.innerWidth = width; f.update(); f.update();
    assert.ok(tabs.parentNode === block && summary.parentNode === block && items.parentNode === block,
      "Bank labels retain their native text-color ancestor at every width");
    assert.equal(labels.parentNode, summary);
    assert.equal(labels.textContent, "Space: 1,337 / 1,455 | Bank: 109B GP | Tab: 49B GP");
    assert.equal(controls.parentNode === bank.node, width < 992, "narrow Bank controls remain in native flow");
  }
  for (const menu of modes) {
    menu.classList.remove("d-none"); f.update();
    assert.equal(menu.parentNode, controls.parentNode);
    const moves = menu.moves;
    f.update(); f.update();
    assert.equal(menu.moves, moves, "periodic updates keep the visible mode menu mounted");
    menu.classList.add("d-none"); f.update();
    assert.equal(menu.parentNode, row);
  }
  enabled = false; f.update();
  assert.equal(f.root.classList.contains("kroky-page-pinned"), false);
  assert.deepEqual(bank.node.children, [controls, row]);
  assert.deepEqual([inventory.moves, box.moves, details.moves], moves);
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

test("optional Skill Boosts joins pinned Combat controls and restores without reconnecting the XP table", () => {
  const f = fixture(), combat = f.page("Combat", false);
  combat.row.remove();
  const top = new Element(); top.id = "combat-top-menu";
  const table = new Element("combat-skill-progress-table"); top.append(table);
  const boosts = new Element("skillboost-menu"), boostAction = new Element("button");
  boosts.append(boostAction);
  const nav = new Element("category-menu"); nav.id = "combat-area-category-menu";
  combat.node.append(top, boosts, nav, combat.cards);
  const tableMoves = table.moves, topMoves = top.moves;
  let boostClicks = 0;
  boostAction.addEventListener("click", () => boostClicks++);
  f.game.openPage = combat.page; f.update(); f.button.click();
  const wrapper = combat.node.querySelector(".kroky-page-pin-controls");
  assert.deepEqual(wrapper.children, [boosts, nav]);
  assert.equal(table.parentNode, top);
  assert.deepEqual([table.moves, top.moves], [tableMoves, topMoves]);
  boostAction.click(); assert.equal(boostClicks, 1);
  const moves = boosts.moves;
  f.update(); f.update();
  assert.equal(boosts.moves, moves);
  boosts.classList.add("d-none"); f.update();
  assert.equal(boosts.parentNode, combat.node, "hidden optional controls retain native placement");
  boosts.classList.remove("d-none"); f.update();
  assert.deepEqual(wrapper.children, [boosts, nav]);
  f.button.click();
  assert.deepEqual(combat.node.children, [top, boosts, nav, combat.cards]);
  assert.deepEqual([table.moves, top.moves], [tableMoves, topMoves]);
  boostAction.click(); assert.equal(boostClicks, 2);
  boosts.remove();
  f.button.click();
  assert.deepEqual(combat.node.querySelector(".kroky-page-pin-controls").children, [nav]);
  assert.deepEqual([table.moves, top.moves], [tableMoves, topMoves]);
  f.button.click();
  assert.deepEqual(combat.node.children, [top, nav, combat.cards]);
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

test("generic pinned controls follow actual page padding, including Cartography's unpadded container", () => {
  const f = fixture();
  const padding = side => f.html.style.getPropertyValue(`--kroky-page-pin-content-${side}`);
  const actual = () => [padding("top"), padding("left"), padding("right")];
  Object.assign(f.skill.node.style, { paddingTop: "30px", paddingLeft: "30px", paddingRight: "30px" });
  f.button.click();
  assert.deepEqual(actual(), ["30px", "30px", "30px"]);
  window.innerWidth = 390;
  Object.assign(f.skill.node.style, { paddingTop: "12px", paddingLeft: "8px", paddingRight: "10px" });
  f.events.get("resize")();
  assert.deepEqual(actual(), ["12px", "8px", "10px"]);
  const cartography = f.page("Cartography");
  Object.assign(cartography.node.style, { paddingTop: "0px", paddingLeft: "0px", paddingRight: "0px" });
  f.game.openPage = cartography.page; f.update();
  assert.deepEqual(actual(), ["0px", "0px", "0px"], "unpadded pages do not inherit another page's edge expansion");
  assert.ok(cartography.node.querySelector(".kroky-page-pin-controls"));
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
