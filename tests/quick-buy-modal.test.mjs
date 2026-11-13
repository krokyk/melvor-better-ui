import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installQuickBuyModal } from "../quick-buy-modal.mjs";

afterEach(() => { for (const key of ["document", "$"]) delete globalThis[key]; });

class Element {
  constructor(id = "", parent) {
    this.id = id; this.parentElement = parent; this.isConnected = true; this.classes = new Set();
    this.classList = { contains: key => this.classes.has(key), add: key => this.classes.add(key), remove: key => this.classes.delete(key) };
  }
  contains(node) { for (; node; node = node.parentElement) if (node === this) return true; return false; }
  focus(options) { assert.equal(options.preventScroll, true); document.activeElement = this; this.focuses = (this.focuses ?? 0) + 1; }
}

function fixture() {
  const body = new Element(), recipe = new Element("modal-recipe-select", body), quick = new Element("modal-quick-buy-item", body);
  const opener = new Element("ingredient", recipe), quickInput = new Element("quantity", quick), outside = new Element("outside", body);
  const modals = [quick, recipe], styles = [], handlers = [], characterLoaded = [];
  let swal = null;
  recipe.classes.add("show"); body.classes.add("modal-open");
  globalThis.document = { body, activeElement: opener,
    createElement: () => ({ textContent: "" }), head: { append: node => styles.push(node) },
    getElementById: id => modals.find(node => node.id === id),
    querySelector: selector => { assert.equal(selector, ".swal2-container"); return swal; },
    querySelectorAll: selector => { assert.equal(selector, ".modal.show"); return modals.filter(node => node.classes.has("show")); },
  };
  globalThis.$ = node => ({ on(type, selector, handler) {
    assert.equal(node, document);
    if (typeof selector === "function") { handler = selector; selector = undefined; }
    else assert.equal(selector, "#modal-quick-buy-item");
    handlers.push({ type, selector, handler });
  } });
  const ctx = { onCharacterLoaded(callback) { characterLoaded.push(callback); } };
  const restoreFocus = installQuickBuyModal(ctx);
  const fire = (type, target = quick) => {
    for (const entry of handlers) if (entry.type.startsWith(type + ".") && (!entry.selector || entry.selector === `#${target.id}`)) entry.handler({ target });
  };
  return { body, recipe, quick, opener, quickInput, outside, styles, restoreFocus,
    open() { fire("show.bs.modal"); quick.classes.add("show"); document.activeElement = quickInput; },
    close() { quick.classes.delete("show"); body.classes.delete("modal-open"); fire("hidden.bs.modal"); },
    swal(value) { swal = value ? new Element("swal") : null; },
    landFocus(target) { document.activeElement = target; fire("focusin", target); },
    closeParent() { recipe.classes.delete("show"); fire("hidden.bs.modal", recipe); },
    reset() { characterLoaded.forEach(callback => callback()); },
    showOther() { const other = new Element("other", body); other.classes.add("show"); modals.push(other); return other; },
  };
}

test("Quick Buy paints above native recipes and below the native purchase confirmation", () => {
  const f = fixture(), css = f.styles.map(node => node.textContent).join("\n");
  const z = Number(css.match(/#modal-quick-buy-item\s*\{\s*z-index:\s*(\d+)/)?.[1] ?? 1050);
  assert.ok(z > 1050, "Quick Buy must be above the recipe despite earlier DOM order");
  assert.ok(z < 1060, "SweetAlert purchase confirmation stays above Quick Buy");
});

test("closing Quick Buy keeps its parent recipe modal open and returns focus without scrolling", () => {
  const f = fixture(); f.open(); f.close();
  assert.equal(f.body.classes.has("modal-open"), true, "native child hide must not re-enable page scrolling under the recipe");
  assert.equal(f.recipe.classes.has("show"), true); assert.equal(document.activeElement, f.opener);
  assert.equal(f.opener.focuses, 1); f.restoreFocus(); assert.equal(f.opener.focuses, 1, "focus recovery runs only once");
});

test("purchase confirmation closing defers the parent focus return until SweetAlert finishes", () => {
  const f = fixture(); f.open(); f.swal(true); f.close();
  assert.equal(f.body.classes.has("modal-open"), true); assert.equal(f.opener.focuses, undefined);
  document.activeElement = document.body; f.swal(false); f.restoreFocus();
  assert.equal(document.activeElement, f.opener); assert.equal(f.opener.focuses, 1);
});

test("closing dialogs and character changes do not steal focus or revive stale parents", () => {
  for (const change of [f => f.recipe.classes.delete("show"), f => { f.recipe.isConnected = false; }, f => f.showOther(), f => { document.activeElement = f.outside; }, f => f.reset()]) {
    const f = fixture(); f.open(); f.swal(true); f.close(); change(f); f.swal(false); f.restoreFocus();
    assert.equal(f.opener.focuses, undefined);
  }
  const f = fixture(); f.recipe.classes.delete("show"); f.open(); f.close();
  assert.equal(f.body.classes.has("modal-open"), false); assert.equal(f.opener.focuses, undefined);
});


test("restored recipe contains keyboard focus until it closes and yields to higher dialogs", () => {
  const f = fixture(); f.open(); f.close(); f.landFocus(f.outside);
  assert.equal(document.activeElement, f.recipe, "Tab landing outside the remaining recipe returns to its modal");
  f.landFocus(f.opener); assert.equal(document.activeElement, f.opener, "inside fields keep focus");
  f.swal(true); f.landFocus(f.outside); assert.equal(document.activeElement, f.outside, "SweetAlert has priority");
  f.swal(false); const higher = f.showOther(); f.landFocus(higher); assert.equal(document.activeElement, higher);
  higher.classes.delete("show"); f.landFocus(f.outside); assert.equal(document.activeElement, f.recipe);
  f.closeParent(); f.landFocus(f.outside); assert.equal(document.activeElement, f.outside, "closed recipes cannot trap focus");
  const reset = fixture(); reset.open(); reset.close(); reset.reset(); reset.landFocus(reset.outside);
  assert.equal(document.activeElement, reset.outside, "character changes clear focus containment");
});
