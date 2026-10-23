import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installWideLayout } from "../wide-layout.mjs";

afterEach(() => { delete globalThis.document; });

test("wide layout waits for the interface and restores native layout without moving cards", () => {
  let root, enabled = true;
  const classes = new Set(), styles = [];
  globalThis.document = {
    getElementById: () => root,
    createElement: () => ({}),
    head: { append: style => styles.push(style) },
  };
  const update = installWideLayout({}, {}, () => enabled);
  update();
  assert.equal(styles.length, 0);
  root = { classList: { toggle(name, value) { value ? classes.add(name) : classes.delete(name); } } };
  update(); update();
  assert.equal(classes.has("kroky-wide-layout"), true);
  assert.equal(styles.length, 1);
  enabled = false; update();
  assert.equal(classes.has("kroky-wide-layout"), false);
  assert.equal(styles.length, 1);
  assert.match(styles[0].textContent, /@media \(min-width: 1200px\)/);
  assert.doesNotMatch(styles[0].textContent, /#(?:combat|cooking|firemaking)-container/);
});
