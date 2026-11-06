import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installBankItemType } from "../bank-item-type.mjs";

afterEach(() => { for (const name of ["document", "customElements"]) delete globalThis[name]; });

function fixture(late = false) {
  class Element {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase(); this.children = []; this.className = ""; this.writes = 0; this.classWrites = 0;
      this.classList = { add: (...names) => { this.classWrites++; this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); } };
    }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    after(node) { node.parentElement = this.parentElement; this.parentElement.children.splice(this.parentElement.children.indexOf(this) + 1, 0, node); }
    set textContent(value) { this.text = value; this.writes++; }
    get textContent() { return this.text ?? ""; }
  }
  const classes = new Map(), patches = [], ready = [];
  const game = { bank: {} };
  class SelectedMenu extends Element {
    constructor() {
      super("bank-selected-item-menu"); this.nativeCalls = [];
      this.selectedItemContainer = new Element(); this.nameCard = new Element(); this.artCard = new Element();
      this.nameCard.className = "block block-rounded-double bg-combat-inner-dark p-2";
      this.itemImage = new Element("img"); this.itemName = new Element("span"); this.itemDescription = new Element("small"); this.viewStatsButton = new Element("h5");
      this.artCard.append(this.itemImage); this.nameCard.append(this.itemName, this.itemDescription, this.viewStatsButton);
      this.selectedItemContainer.append(this.artCard, this.nameCard); this.append(this.selectedItemContainer);
    }
    // Native setItem updates name/description/stats in this card and reuses the original nodes.
    setItem(bankItem, bank) {
      const item = bankItem.item; this.nativeCalls.push({ bankItem, bank }); this.selectedItemContainer.hidden = false;
      this.itemName.textContent = item.name; this.itemDescription.innerHTML = item.modifiedDescription; this.itemImage.src = item.media;
      this.viewStatsButton.hidden = !item.equipment; this.viewStatsButton.onclick = item.equipment ? () => item : undefined;
      return "native selected item";
    }
    setUnselected() { this.selectedItemContainer.hidden = true; }
  }
  if (!late) classes.set("bank-selected-item-menu", SelectedMenu);
  globalThis.customElements = { get: tag => classes.get(tag) };
  globalThis.document = { createElement: tag => new Element(tag) };
  const ctx = {
    patch(Class, method) {
      assert.equal(Class, SelectedMenu); assert.equal(method, "setItem");
      return { after(callback) {
        patches.push([Class, method]); const original = Class.prototype[method];
        Class.prototype[method] = function (...args) { const result = original.apply(this, args); callback.call(this, result, ...args); return result; };
      } };
    },
    onInterfaceReady: callback => ready.push(callback),
  };
  installBankItemType(ctx, game);
  const label = menu => menu.nameCard.children.find(node => node.className.includes("kroky-bank-item-type"));
  return { game, menu: new SelectedMenu(), SelectedMenu, patches, ready, label, register: () => classes.set("bank-selected-item-menu", SelectedMenu) };
}

test("selected bank items expose their exact native type at the text card bottom below View Item Stats without rebuilding native contents", () => {
  const f = fixture(), menu = f.menu;
  const original = [...menu.nameCard.children], art = menu.itemImage;
  const equipment = { item: { type: "Magic Armour", name: "Hat", equipment: true, media: "hat.png", modifiedDescription: "Native bonuses" }, quantity: 4 };
  assert.equal(menu.setItem(equipment, f.game.bank), "native selected item");
  const label = f.label(menu);
  assert.equal(label.tagName, "SMALL"); assert.equal(label.textContent, "Type: Magic Armour");
  assert.equal(label.className.includes("mt-auto"), true, "auto top margin pins the type to the stretched card bottom");
  assert.equal(menu.nameCard.className, "block block-rounded-double bg-combat-inner-dark p-2 d-flex flex-column");
  assert.equal(menu.artCard.className, "", "the sibling artwork card layout is untouched");
  assert.deepEqual(menu.nameCard.children, [...original, label], "the type follows the stats link within the text card beside the artwork");
  assert.equal(menu.itemImage, art); assert.equal(art.src, "hat.png"); assert.equal(menu.itemDescription.innerHTML, "Native bonuses");
  assert.equal(menu.viewStatsButton.onclick(), equipment.item); assert.equal(menu.viewStatsButton.hidden, false);
  menu.setItem({ ...equipment, quantity: 5 }, f.game.bank);
  assert.equal(f.label(menu), label); assert.equal(label.writes, 1, "unchanged type causes no additional text writes");
  assert.equal(menu.nameCard.classWrites, 1, "the native card utilities are added only when the label is created");
  const ordinary = { item: { type: "Logs", name: "Logs", media: "logs.png", modifiedDescription: "Can be burned" }, quantity: 20 };
  menu.setUnselected(); assert.equal(menu.selectedItemContainer.hidden, true);
  menu.setItem(ordinary, f.game.bank);
  assert.equal(menu.selectedItemContainer.hidden, false); assert.equal(menu.viewStatsButton.hidden, true);
  assert.equal(label.textContent, "Type: Logs", "ordinary items and reused sidebars receive their own native type");
  assert.equal(menu.nameCard.children.length, original.length + 1); assert.equal(label.writes, 2);
  menu.setItem({ item: { ...ordinary.item, type: "<b>Modded type</b>" } }, f.game.bank);
  assert.equal(label.textContent, "Type: <b>Modded type</b>"); assert.equal(label.innerHTML, undefined, "type is rendered as text");
  assert.equal(f.patches.length, 1, "no render, timer, character or gameplay hooks are installed");
});

test("late native element registration installs exactly once and other bank owners remain untouched", () => {
  const f = fixture(true), item = { item: { type: "Food", name: "Fish", modifiedDescription: "Heals" } };
  f.menu.setItem(item, f.game.bank); assert.equal(f.label(f.menu), undefined); assert.equal(f.patches.length, 0);
  f.register(); f.ready[0](); f.ready[0]();
  f.menu.setItem(item, {}); assert.equal(f.label(f.menu), undefined);
  f.menu.setItem(item, f.game.bank); assert.equal(f.label(f.menu).textContent, "Type: Food");
  const replacement = new f.SelectedMenu(); replacement.setItem({ item: { ...item.item, type: "Rune" } }, f.game.bank);
  assert.equal(f.label(replacement).textContent, "Type: Rune"); assert.notEqual(f.label(replacement), f.label(f.menu));
  f.game.bank = {}; f.menu.setItem({ item: { ...item.item, type: "Potion" } }, f.game.bank);
  assert.equal(f.label(f.menu).textContent, "Type: Potion", "the current character bank is resolved when selecting");
  assert.equal(f.patches.length, 1);
});
