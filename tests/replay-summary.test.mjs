import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installReplaySummaryKeyboard } from "../replay-speed.mjs";

afterEach(() => { delete globalThis.Swal; delete globalThis.SwalLocale; });

function fixture() {
  const state = { calls: [], result: Promise.resolve("dismissed") };
  globalThis.Swal = class {
    static fire(...args) {
      state.calls.push({ receiver: this, args });
      if (state.failure) throw state.failure;
      return state.result;
    }
  };
  globalThis.SwalLocale = class extends Swal {};
  const game = { _isInOnlineLoop: true };
  installReplaySummaryKeyboard(game);
  return { state, game };
}

test("Escape is enabled for the completed replay summary without changing its callbacks or caller options", () => {
  const { state } = fixture(), didOpen = () => {};
  const options = { html: { tagName: "OFFLINE-PROGRESS" }, allowEscapeKey: false, allowOutsideClick: false, allowEnterKey: false, didOpen };
  assert.equal(SwalLocale.fire(options, "extra"), state.result);
  const call = state.calls[0];
  assert.equal(call.receiver, SwalLocale); assert.equal(call.args[1], "extra");
  assert.deepEqual(call.args[0], { ...options, allowEscapeKey: true });
  assert.equal(options.allowEscapeKey, false, "the queued native options remain unchanged");
  assert.equal(call.args[0].didOpen, didOpen);
});

test("processing, errors, other dialogs and other SweetAlert mixins retain their native keyboard rules", () => {
  const { state, game } = fixture(), summary = { html: { tagName: "OFFLINE-PROGRESS" }, allowEscapeKey: false };
  game._isInOnlineLoop = false; SwalLocale.fire(summary);
  assert.equal(state.calls.at(-1).args[0], summary);
  game._isInOnlineLoop = true;
  for (const options of [{ html: { tagName: "OFFLINE-LOADING" }, allowEscapeKey: false }, { icon: "error", allowEscapeKey: false }, "title"]) {
    SwalLocale.fire(options); assert.equal(state.calls.at(-1).args[0], options);
  }
  Swal.fire(summary); assert.equal(state.calls.at(-1).args[0], summary);
  class OtherMixin extends Swal {}
  OtherMixin.fire(summary); assert.equal(state.calls.at(-1).args[0], summary);
});

test("a recreated language mixin is covered and native fire errors remain intact", () => {
  const { state } = fixture();
  globalThis.SwalLocale = class extends Swal {};
  const options = { html: { tagName: "OFFLINE-PROGRESS" }, allowEscapeKey: false };
  SwalLocale.fire(options); assert.equal(state.calls.at(-1).args[0].allowEscapeKey, true);
  state.failure = new Error("native modal failure");
  assert.throws(() => SwalLocale.fire(options), error => error === state.failure);
});

test("missing SweetAlert support leaves startup available", () => {
  delete globalThis.Swal; delete globalThis.SwalLocale;
  assert.doesNotThrow(() => installReplaySummaryKeyboard({}));
});
