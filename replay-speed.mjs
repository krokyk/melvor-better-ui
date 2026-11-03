const settingName = "speedupFactor";
const recoveryKey = "speedup-replay-previous-factor";
const isMultiplier = value => Number.isFinite(value) && value > 0;

export function installReplaySpeed(ctx, game) {
  if (typeof mod === "undefined") return;
  let settings;
  try {
    settings = mod.getContext("SpeedupPP").settings.section("Speed options");
    settings.get(settingName);
  } catch {
    return;
  }

  const storage = ctx.characterStorage;
  let ready = false;
  const restore = (syncDecodedSetting = false) => {
    if (!ready) return;
    try {
      const previous = storage.getItem(recoveryKey);
      if (previous === undefined && !syncDecodedSetting) return;
      const current = settings.get(settingName);
      if (isMultiplier(previous) && current === 1) {
        settings.set(settingName, previous);
        if (settings.get(settingName) !== previous) throw new Error("Speedup++ rejected its previous multiplier.");
      } else if (syncDecodedSetting && isMultiplier(current)) {
        // Save decoding restores the setting without running Speedup++'s change callback.
        settings.set(settingName, current);
      }
      if (previous !== undefined) storage.removeItem(recoveryKey);
    } catch (error) {
      console.warn("[Better UI] Could not restore the Speedup++ multiplier.", error);
    }
  };

  ctx.onCharacterLoaded(() => {
    ready = true;
    restore();
  });
  ctx.patch(game.constructor, "decode").replace(function (original, ...args) {
    if (this !== game || !ready) return original(...args);
    restore();
    const result = original(...args);
    restore(true);
    return result;
  });
  game.on("offlineLoopEntered", () => {
    if (!ready) return;
    try {
      const previous = settings.get(settingName);
      if (!isMultiplier(previous) || previous === 1) return;
      // Save recovery data before changing a setting that can be serialized during replay.
      storage.setItem(recoveryKey, previous);
      settings.set(settingName, 1);
    } catch (error) {
      console.warn("[Better UI] Could not set Speedup++ to ×1 for offline replay.", error);
    }
  });
  game.on("offlineLoopExited", () => restore());
}
