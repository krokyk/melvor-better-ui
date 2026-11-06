const settingName = "speedupFactor";
const recoveryKey = "speedup-replay-previous-factor";
const isMultiplier = value => Number.isFinite(value) && value > 0;
const tickInterval = 50;

export function installReplaySpeed(ctx, game) {
  if (typeof mod === "undefined") return;
  let settings, version;
  try {
    const speedup = mod.getContext("SpeedupPP");
    version = speedup.version;
    settings = speedup.settings.section("Speed options");
    settings.get(settingName);
  } catch {
    return;
  }

  const storage = ctx.characterStorage;
  let ready = false, replay, running;
  const clearReplay = () => {
    if (replay && game.OFFLINE_EXIT_TIME === 0) game.OFFLINE_EXIT_TIME = replay.exitTolerance;
    replay = running = undefined;
  };
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
    clearReplay(); ready = true; restore();
  });
  ctx.patch(game.constructor, "decode").replace(function (original, ...args) {
    if (this !== game || !ready) return original(...args);
    clearReplay(); restore();
    const result = original(...args);
    restore(true);
    return result;
  });
  game.on("offlineLoopEntered", clearReplay);
  game.on("offlineLoopExited", clearReplay);

  if (version !== "1.0.4") {
    console.warn("[Better UI] Accelerated replay compatibility requires Speedup++ 1.0.4; its replay behavior is unchanged.");
    return;
  }
  ctx.patch(game.constructor, "tick").after(function () {
    if (this === game && running) running.ticks++;
  });

  ctx.patch(game.constructor, "loopOffline").replace(function (original, loopTime) {
    if (this !== game || !ready || this._isInOnlineLoop !== false) return original(loopTime);
    const info = this._offlineInfo;
    try {
      const factor = settings.get(settingName);
      if (!isMultiplier(factor)) throw new Error("Speedup++ has an invalid replay multiplier.");
      if (replay?.info !== info) {
        clearReplay();
        replay = { info, duration: Math.max(0, Math.min(loopTime - info.startTime, this.MAX_OFFLINE_TIME)), exitTolerance: this.OFFLINE_EXIT_TIME };
        // The native 500 ms early exit would skip 500 seconds of training at ×1000.
        this.OFFLINE_EXIT_TIME = 0;
      }
      if (replay.factor !== factor) {
        replay.factor = factor; replay.baseTime = info.timeProcessed;
        replay.targetTicks = Math.max(0, Math.floor((replay.duration - replay.baseTime) * factor / tickInterval + 1e-9));
        replay.ticks = 0;
      }
      const fps = settings.get("minFPS");
      replay.budget = Number.isFinite(fps) && fps > 0 ? Math.min(16, 1000 / fps) : 16;
      const left = replay.targetTicks - replay.ticks;
      if (left <= 0) { clearReplay(); this.exitOfflineLoop(loopTime); return; }
      const start = performance.now(), deadline = start + replay.budget, scope = replay, toRun = Math.min(info.tickRate, left);
      let completed = 0;
      running = scope;
      try {
        do {
          const requested = Math.min(16, toRun - completed), before = scope.ticks;
          // Each public call gets a fresh SDK replacement chain and preserves Speedup++'s runner.
          const actual = this.runTicks(requested);
          if (!Number.isSafeInteger(actual) || actual < 0 || actual > requested || actual !== scope.ticks - before)
            throw new Error("Speedup++ returned an invalid completed tick count.");
          completed += actual;
          if (actual < requested) break;
        } while (completed < toRun && performance.now() < deadline);
      } finally {
        running = undefined;
        // Whole ticks include successful work in a native batch that subsequently throws.
        info.timeProcessed = scope.baseTime + scope.ticks * tickInterval / factor;
      }
      if (replay !== scope || this._isInOnlineLoop !== false) return;
      const rate = completed / Math.max(performance.now() - start, 1);
      info.tickRate = Math.max(1, Math.floor(rate * tickInterval * this.OFFLINE_GC_RATIO));
      offlineLoading.updateProgress(info.timeProcessed, replay.duration, rate * 1000);
      if (replay.ticks >= replay.targetTicks) {
        clearReplay(); this.exitOfflineLoop(loopTime);
      }
    } catch (error) {
      running = undefined;
      const modError = mod.getModErrorFromError(error);
      const errorLog = this.getErrorLog(error, "An error occurred while processing ticks offline:", modError);
      offlineLoading.setError(error, modError, errorLog);
      this.activeAction?.stop();
    }
  });
}