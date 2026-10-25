import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createItemStatsPreview } from "../item-stats.mjs";

afterEach(() => {
  for (const name of ["document", "customElements", "EquipmentItem", "WeaponItem", "EquipmentStats", "Equipment", "assets", "getLangString", "formatPercent", "formatNumber", "numberWithCommas", "templateLangString", "viewItemStats", "SwalLocale"])
    delete globalThis[name];
});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.dataset = {}; this.style = {};
    this.className = ""; this.hidden = false;
    this.classList = {
      contains: name => this.className.split(" ").includes(name),
      add: (...names) => { for (const name of names) if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: (...names) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
      toggle: (name, force) => { const enabled = force ?? !this.classList.contains(name); this.classList[enabled ? "add" : "remove"](name); return enabled; },
    };
  }
  append(...nodes) { for (let node of nodes) { if (typeof node === "string") { const text = new Element("text"); text.textContent = node; node = text; } node.remove(); this.children.push(node); node.parentElement = this; } }
  prepend(...nodes) { for (const node of [...nodes].reverse()) { node.remove(); this.children.unshift(node); node.parentElement = this; } }
  replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = undefined; }
  setAttribute(name, value) { this.attributes[name] = `${value}`; if (name.startsWith("data-")) this.dataset[name.slice(5)] = `${value}`; }
  getAttribute(name) { return name.startsWith("data-") ? this.dataset[name.slice(5)] ?? this.attributes[name] ?? null : this.attributes[name] ?? null; }
  matches(selector) {
    const parts = selector.trim().split(/\s+/);
    if (parts.length > 1) {
      if (!this.matches(parts.pop())) return false;
      let ancestor = this.parentElement;
      while (parts.length && ancestor) { if (ancestor.matches(parts.at(-1))) parts.pop(); ancestor = ancestor.parentElement; }
      return parts.length === 0;
    }
    const attribute = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
    if (attribute) return attribute[2] === undefined ? this.getAttribute(attribute[1]) !== null : this.getAttribute(attribute[1]) === attribute[2];
    return selector.startsWith(".") ? this.classList.contains(selector.slice(1)) : this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  get textContent() { return (this.ownText ?? "") + this.children.map(node => node.textContent).join(""); }
  set textContent(value) { this.ownText = `${value}`; this.replaceChildren(); }
  set innerHTML(value) { this.textContent = `${value}`.replace(/<[^>]*>/g, ""); }
}

const numericKeys = ["attackSpeed", "stabAttackBonus", "slashAttackBonus", "blockAttackBonus", "rangedAttackBonus", "magicAttackBonus", "meleeStrengthBonus", "rangedStrengthBonus", "magicDamageBonus", "meleeDefenceBonus", "rangedDefenceBonus", "magicDefenceBonus"];

function fixture() {
  globalThis.EquipmentStats = class {
    constructor(stats = []) { for (const key of numericKeys) this[key] = 0; this.resistances = new Map(); this.addStats(stats); }
    addStats(stats) { for (const stat of stats) { if (stat.key === "resistance") this.resistances.set(stat.damageType, this.getResistance(stat.damageType) + stat.value); else this[stat.key] = (this[stat.key] ?? 0) + stat.value; } }
    subtractStats(stats) { this.addStats(stats.map(stat => ({ ...stat, value: -stat.value }))); }
    addItemStats(item) { this.addStats(item.equipmentStats); }
    remItemStats(item) { this.subtractStats(item.equipmentStats); }
    getResistance(type) { return this.resistances.get(type) ?? 0; }
  };
  globalThis.EquipmentItem = class {
    constructor(name, equipmentStats = [], validSlots = []) { this.id = `test:${name}`; this.name = name; this.equipmentStats = equipmentStats; this.validSlots = validSlots; this.occupiesSlots = []; this.equipRequirements = []; this.specialAttacks = []; }
    occupiesSlot(id) { return this.occupiesSlots.some(slot => slot.id === id); }
  };
  globalThis.WeaponItem = class extends EquipmentItem {};
  globalThis.Equipment = class { static getEquipStatDescription(stat) { return `${stat.key}: ${stat.value}`; } };
  const calls = { tooltip: [], removed: [], modal: 0 }, elements = [];
  class Tooltip extends Element {
    constructor() {
      super("equipment-tooltip"); this.itemName = new Element("span"); this.itemDamageType = new Element("span");
      this.append(this.itemName, this.itemDamageType);
    }
    setItem(item, showStats) {
      calls.tooltip.push({ item, showStats });
      this.itemName.textContent = item.name; this.itemDamageType.textContent = item.damageType?.name ?? "";
      if (showStats) for (const stat of item.equipmentStats) { const line = new Element("small"); line.textContent = Equipment.getEquipStatDescription(stat); this.append(line); }
      if (item.hasDescription) { const line = new Element("small"); line.innerHTML = item.modifiedDescription; this.append(line); }
    }
  }
  globalThis.document = { createElement(tag) { const element = tag === "equipment-tooltip" ? new Tooltip() : new Element(tag); elements.push(element); return element; } };
  globalThis.customElements = { get: tag => tag === "equipment-tooltip" ? Tooltip : undefined };
  globalThis.assets = { getURI: path => `media:${path}` };
  const labels = { COMBAT_MISC_42: "Offensive Stats", COMBAT_MISC_91: "Defensive Stats", EQUIPMENT_STAT_ATTACK_INTERVAL: "Attack Interval", EQUIPMENT_STAT_STAB_BONUS: "Stab Bonus", EQUIPMENT_STAT_SLASH_BONUS: "Slash Bonus", EQUIPMENT_STAT_BLOCK_BONUS: "Block Bonus", EQUIPMENT_STAT_STRENGTH_BONUS: "Strength Bonus", EQUIPMENT_STAT_ATTACK_BONUS: "Attack Bonus", EQUIPMENT_STAT_DAMAGE_BONUS: "Damage Bonus", EQUIPMENT_STAT_DEFENCE_BONUS: "Defence Bonus", DAMAGE_TYPE: "Damage Type" };
  globalThis.getLangString = key => labels[key] ?? key;
  globalThis.formatPercent = value => `${value}%`;
  globalThis.formatNumber = globalThis.numberWithCommas = value => `${value}`;
  globalThis.templateLangString = (key, values) => key === "MENU_TEXT_SECONDS_SHORT" ? `${values.seconds}s` : `${key} ${Object.values(values).join(" ")}`;
  globalThis.viewItemStats = () => { calls.modal++; assert.fail("preview cannot invoke the shared item modal"); };
  globalThis.SwalLocale = { fire() { calls.modal++; assert.fail("preview cannot open a popup"); } };
  const weapon = { id: "melvorD:Weapon", providesEquipStats: true }, shield = { id: "melvorD:Shield", providesEquipStats: true };
  const summon1 = { id: "melvorD:Summon1", providesEquipStats: true }, summon2 = { id: "melvorD:Summon2", providesEquipStats: true }, passive = { id: "melvorF:Passive", providesEquipStats: false };
  const normal = { id: "melvorD:Normal", name: "Normal Damage", resistanceName: "Damage Reduction", media: "normal.png", onlyShowIfUsing: false };
  const pure = { id: "melvorD:Pure", name: "Pure Damage", resistanceName: "Pure Resistance", media: "pure.png", onlyShowIfUsing: false };
  const abyssal = { id: "melvorItA:Abyssal", name: "Abyssal Damage", resistanceName: "Abyssal Resistance", media: "abyssal.png", onlyShowIfUsing: false };
  const hiddenType = { id: "mod:Arcane", name: "Arcane Damage", resistanceName: "Arcane Resistance", media: "arcane.png", onlyShowIfUsing: true };
  const ancientClaw = new WeaponItem("Ancient Claw", [{ key: "attackSpeed", value: 2200 }, { key: "stabAttackBonus", value: 71 }, { key: "slashAttackBonus", value: 71 }, { key: "blockAttackBonus", value: 71 }, { key: "meleeStrengthBonus", value: 75 }], [weapon]);
  ancientClaw.damageType = normal;
  const currentShield = new EquipmentItem("Shield", [{ key: "meleeDefenceBonus", value: 39 }], [shield]);
  const candidate = new WeaponItem("Ultima Godsword", [{ key: "attackSpeed", value: 3800 }, { key: "stabAttackBonus", value: -3 }, { key: "slashAttackBonus", value: 174 }, { key: "blockAttackBonus", value: 174 }, { key: "meleeStrengthBonus", value: 365 }, { key: "meleeDefenceBonus", value: 30 }, { key: "resistance", damageType: normal, value: 8 }], [weapon]);
  candidate.damageType = normal; candidate.occupiesSlots = [shield]; candidate.hasDescription = true; candidate.modifiedDescription = "Long special attack details";
  const equippedItems = Object.create(null);
  const empty = { id: "test:Empty", name: "Empty", equipmentStats: [] };
  for (const slot of [weapon, shield, summon1, summon2, passive]) equippedItems[slot.id] = { slot, item: empty, isEmpty: true, providesStats: false };
  function wear(slot, item) { equippedItems[slot.id] = { slot, item, isEmpty: false, providesStats: true }; }
  wear(weapon, ancientClaw); wear(shield, currentShield);
  const equipment = {
    equippedItems,
    get equippedArray() { return Object.values(equippedItems); },
    getEquippedInSlot: slot => equippedItems[slot.id],
    getRootSlot(slot) { return equippedItems[slot.id].occupiedBy ?? slot; },
    getSlotOfItem(item) { return Object.values(equippedItems).find(entry => entry.item === item && !entry.occupiedBy)?.slot; },
    addEquipmentStats(stats) { for (const equipped of Object.values(equippedItems)) if (equipped.providesStats && equipped.slot.providesEquipStats) stats.addItemStats(equipped.item); },
    getSlotsToUnequip(item, slot = item.validSlots[0]) { return [...new Set([slot, ...item.occupiesSlots].map(required => this.getRootSlot(required)))].filter(required => !equippedItems[required.id].isEmpty); },
    getItemsAddedOnEquip(item, slot = item.validSlots[0]) { calls.removed.push({ item, slot }); return this.getSlotsToUnequip(item, slot).map(required => ({ item: equippedItems[required.id].item, quantity: 1 })); },
  };
  const game = { normalDamage: normal, damageTypes: [normal, pure, abyssal, hiddenType], combat: { player: { equipment }, isDamageTypeInUse: () => false }, itemCharges: { getCharges: () => 0 } };
  const preview = (item = candidate, slot = weapon) => createItemStatsPreview(item, game, { fullStats: true, equipment, slot });
  return { calls, elements, game, equipment, equippedItems, wear, weapon, shield, summon1, summon2, passive, normal, pure, abyssal, hiddenType, ancientClaw, currentShield, candidate, preview };
}

function row(preview, key) { const element = preview.element.querySelectorAll("[data-stat]").find(element => element.dataset.stat === key); assert.ok(element, `missing native stats row: ${key}`); return element; }
function value(preview, key) { return row(preview, key).querySelector(".kroky-equipment-stat-value"); }
function difference(preview, key) { return row(preview, key).querySelector(".kroky-equipment-stat-difference"); }

test("full equipment preview includes native offensive and defensive tables with zero-valued stats", () => {
  const f = fixture(), result = f.preview();
  assert.match(result.element.textContent, /Offensive Stats/);
  assert.match(result.element.textContent, /Defensive Stats/);
  assert.ok(result.element.classList.contains("kroky-item-stats-compact"));
  assert.ok(result.element.classList.contains("kroky-item-stats-with-tables"));
  const details = result.element.querySelector(".kroky-equipment-item-details"), tables = result.element.querySelector(".kroky-equipment-stats-tables");
  assert.equal(details.parentElement, result.element); assert.equal(tables.parentElement, result.element);
  assert.equal(result.element.children.indexOf(details), 0, "details and the stacked tables occupy separate Compact columns");
  assert.equal(result.hasStats, true);
  for (const key of numericKeys) assert.ok(value(result, key));
  assert.equal(value(result, "rangedAttackBonus").textContent, "0");
  assert.equal(value(result, "magicDefenceBonus").textContent, "0");
  assert.ok(f.calls.tooltip.some(call => call.showStats === false), "native descriptions do not repeat the compact numeric list");
  assert.equal(f.calls.modal, 0);
});

test("stats keep inspected values and equipped differences in separate stable numeric columns", () => {
  const f = fixture(), result = f.preview();
  for (const line of result.element.querySelectorAll("[data-stat]")) {
    if (line.dataset.stat === "damageType") {
      assert.equal(line.children.length, 2, "categorical damage type uses one cell across the numeric columns");
      assert.equal(line.children[1].colSpan, 2);
      continue;
    }
    assert.equal(line.children.length, 3, `${line.dataset.stat} keeps label, item value and difference columns`);
    const [label, inspected, change] = line.children;
    assert.equal(label.tagName, "TH");
    assert.equal(inspected.tagName, "TD"); assert.equal(change.tagName, "TD");
    assert.ok(inspected.classList.contains("kroky-equipment-stat-value-cell"));
    assert.ok(change.classList.contains("kroky-equipment-stat-difference-cell"));
    const absolute = line.querySelector(".kroky-equipment-stat-value"), delta = line.querySelector(".kroky-equipment-stat-difference");
    assert.ok(absolute, "every numeric row shows the inspected item value");
    assert.ok(delta, "every numeric row shows its change from equipped gear");
    assert.equal(absolute.parentElement, inspected, "item values never share the delta cell");
    assert.equal(delta.parentElement, change, "colored deltas have a dedicated column");
  }
  assert.equal(value(result, "meleeStrengthBonus").textContent, "365");
  assert.equal(difference(result, "meleeStrengthBonus").textContent, "+290");
  assert.equal(value(result, "rangedAttackBonus").textContent, "0");
  const zero = difference(result, "rangedAttackBonus");
  assert.equal(zero.textContent, "0");
  assert.equal(zero.classList.contains("text-danger"), false);
  assert.equal(zero.classList.contains("text-success"), false);
});

test("Compact and Vanilla both include complete item artwork and lore beside the same comparison tables", () => {
  const f = fixture();
  f.candidate.media = "ultima-godsword.png";
  const create = layout => createItemStatsPreview(f.candidate, f.game, { fullStats: true, layout, equipment: f.equipment, slot: f.weapon });
  const compact = create("compact"), vanilla = create("vanilla");
  assert.equal(compact.element.classList.contains("kroky-item-stats-vanilla"), false);
  assert.equal(compact.element.classList.contains("kroky-item-stats-compact"), true);
  assert.equal(vanilla.element.classList.contains("kroky-item-stats-vanilla"), true);
  for (const result of [vanilla, compact]) {
    const details = result.element.querySelector(".kroky-equipment-item-details");
    const tables = result.element.querySelector(".kroky-equipment-stats-tables");
    assert.ok(details, "full previews retain a dedicated item-details section");
    assert.ok(tables);
    assert.equal(details.parentElement, result.element); assert.equal(tables.parentElement, result.element);
    assert.ok(result.element.children.indexOf(details) < result.element.children.indexOf(tables), "both layouts place the complete details beside the tables");
    assert.match(details.textContent, /Ultima Godsword/);
    assert.match(details.textContent, /Long special attack details/);
    assert.equal(details.querySelector(".kroky-equipment-preview-name").textContent, f.candidate.name);
    const artwork = details.querySelector(".kroky-equipment-preview-art");
    assert.ok(artwork); assert.equal(artwork.tagName, "IMG"); assert.equal(artwork.src, f.candidate.media);
    const nativeTooltip = details.querySelector("equipment-tooltip");
    assert.equal(nativeTooltip.itemName.hidden, true, "the preview header is the visible item name");
    assert.equal(nativeTooltip.itemDamageType.hidden, true, "the offensive table already shows damage type");
  }
  const stats = result => result.element.querySelectorAll("[data-stat]").map(line => ({
    key: line.dataset.stat,
    value: line.querySelector(".kroky-equipment-stat-value")?.textContent,
    difference: line.querySelector(".kroky-equipment-stat-difference")?.textContent,
    color: line.querySelector(".kroky-equipment-stat-difference")?.className,
  }));
  assert.deepEqual(stats(vanilla), stats(compact), "layout does not change values, comparison math or delta colors");
  assert.equal(f.calls.modal, 0, "Vanilla is inline and never invokes the shared item-stats modal");
});

test("two-handed comparison removes both displaced items and marks slower attacks as a loss", () => {
  const f = fixture(), before = Object.values(f.equippedItems).map(entry => [entry.slot.id, entry.item, entry.isEmpty]);
  const result = f.preview();
  assert.match(value(result, "attackSpeed").textContent, /3\.8(?:0)?s/);
  assert.match(difference(result, "attackSpeed").textContent, /^\+1\.6(?:0)?s$/);
  assert.ok(difference(result, "attackSpeed").classList.contains("text-danger"));
  assert.equal(difference(result, "stabAttackBonus").textContent, "-74");
  assert.ok(difference(result, "stabAttackBonus").classList.contains("text-danger"));
  assert.equal(difference(result, "slashAttackBonus").textContent, "+103");
  assert.ok(difference(result, "slashAttackBonus").classList.contains("text-success"));
  assert.equal(difference(result, "meleeDefenceBonus").textContent, "-9");
  assert.equal(f.calls.removed.at(-1).slot, f.weapon);
  assert.deepEqual(Object.values(f.equippedItems).map(entry => [entry.slot.id, entry.item, entry.isEmpty]), before, "comparison must not mutate the equipment");
});

test("comparisons use the picker slot for secondary summons and preserve weapon speed on non-weapons", () => {
  const f = fixture(), first = new EquipmentItem("First Summon", [{ key: "meleeStrengthBonus", value: 10 }], [f.summon1, f.summon2]);
  const second = new EquipmentItem("Second Summon", [{ key: "meleeStrengthBonus", value: 20 }], [f.summon1, f.summon2]);
  const replacement = new EquipmentItem("New Summon", [{ key: "meleeStrengthBonus", value: 25 }], [f.summon1, f.summon2]);
  f.wear(f.summon1, first); f.wear(f.summon2, second);
  const result = f.preview(replacement, f.summon2);
  assert.equal(difference(result, "meleeStrengthBonus").textContent, "+5");
  assert.equal(f.calls.removed.at(-1).slot, f.summon2);
  const speed = result.element.querySelectorAll("[data-stat]").find(element => element.dataset.stat === "attackSpeed");
  assert.equal(speed, undefined, "non-weapons do not show an item attack interval");
});

test("passive slots show item values without pretending their combat stats change the equipped set", () => {
  const f = fixture(), worn = new EquipmentItem("Passive Old", [{ key: "meleeStrengthBonus", value: 50 }], [f.passive]);
  const candidate = new EquipmentItem("Passive New", [{ key: "meleeStrengthBonus", value: 100 }], [f.passive]);
  f.wear(f.passive, worn);
  const result = f.preview(candidate, f.passive);
  assert.equal(value(result, "meleeStrengthBonus").textContent, "100");
  const delta = row(result, "meleeStrengthBonus").querySelector(".kroky-equipment-stat-difference");
  assert.ok(!delta || /^\+?0$/.test(delta.textContent), "non-stat passive equipment must have no strength gain");
});

test("weapon comparison uses native unarmed speed and exposes native percentage resistances", () => {
  const f = fixture();
  f.equippedItems[f.weapon.id] = { slot: f.weapon, item: { id: "test:Empty", equipmentStats: [] }, isEmpty: true, providesStats: false };
  f.candidate.equipmentStats.push({ key: "resistance", damageType: f.hiddenType, value: 4 });
  const result = f.preview();
  assert.match(difference(result, "attackSpeed").textContent, /^-0\.2(?:0)?s$/);
  assert.ok(difference(result, "attackSpeed").classList.contains("text-success"));
  for (const type of [f.normal, f.pure, f.abyssal, f.hiddenType]) {
    const resistance = result.element.querySelectorAll("[data-stat]").find(element => element.dataset.stat.includes(type.id));
    assert.ok(resistance, `missing resistance row: ${type.resistanceName}`);
    const actual = resistance.querySelector(".kroky-equipment-stat-value").textContent;
    assert.match(actual, /%$/);
    assert.equal(actual, type === f.normal ? "8%" : type === f.hiddenType ? "4%" : "0%");
  }
});

test("inactive conditional resistance rows stay hidden until used by the item, equipment or combat", () => {
  const f = fixture();
  const hidden = result => result.element.querySelectorAll("[data-stat]").some(element => element.dataset.stat.includes(f.hiddenType.id));
  assert.equal(hidden(f.preview()), false);
  f.currentShield.equipmentStats.push({ key: "resistance", damageType: f.hiddenType, value: 7 });
  const compared = f.preview();
  assert.equal(hidden(compared), true, "displaced equipment with resistance must expose its loss");
  const resistance = compared.element.querySelectorAll("[data-stat]").find(element => element.dataset.stat.includes(f.hiddenType.id));
  assert.equal(resistance.querySelector(".kroky-equipment-stat-difference").textContent, "-7%");
  assert.ok(resistance.querySelector(".kroky-equipment-stat-difference").classList.contains("text-danger"));
  f.currentShield.equipmentStats.pop();
  f.game.combat.isDamageTypeInUse = type => type === f.hiddenType;
  assert.equal(hidden(f.preview()), true, "currently used damage types retain their zero resistance row");
});

test("name-only fallback remains available for items with no stats", () => {
  const f = fixture(), plain = { id: "test:Plain", name: "Plain Item" };
  const result = createItemStatsPreview(plain, f.game, { fullStats: true, equipment: f.equipment, slot: f.weapon });
  assert.equal(result.hasStats, false); assert.equal(result.element.textContent, "Plain Item");
});

test("equipment previews retain name and artwork without stats or the native stats aggregation API", () => {
  const f = fixture(), plain = { id: "test:Plain", name: "Plain Item", media: "plain.png" };
  for (const layout of ["compact", "vanilla"]) {
    const result = createItemStatsPreview(plain, f.game, { fullStats: true, layout });
    assert.equal(result.hasStats, false);
    assert.ok(result.element.classList.contains(`kroky-item-stats-${layout}`));
    assert.equal(result.element.classList.contains("kroky-item-stats-with-tables"), false);
    assert.equal(result.element.querySelector(".kroky-equipment-preview-name").textContent, plain.name);
    assert.equal(result.element.querySelector(".kroky-equipment-preview-art").src, plain.media);
    assert.equal(result.element.querySelector(".kroky-equipment-stats-tables"), null);
  }
  delete globalThis.EquipmentStats;
  f.candidate.media = "ultima-godsword.png";
  const result = createItemStatsPreview(f.candidate, f.game, { fullStats: true, layout: "compact" });
  assert.equal(result.hasStats, true);
  assert.equal(result.element.classList.contains("kroky-item-stats-with-tables"), false);
  assert.equal(result.element.querySelector(".kroky-equipment-preview-art").src, f.candidate.media);
  assert.match(result.element.querySelector(".kroky-equipment-item-details").textContent, /meleeStrengthBonus: 365/);
  assert.equal(result.element.querySelector(".kroky-equipment-stats-tables"), null);
  assert.equal(f.calls.modal, 0);
});
