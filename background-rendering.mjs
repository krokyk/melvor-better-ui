const installed = new WeakMap();
const thievingMethods = ["renderMenu", "renderProgressBar", "renderStopButton", "renderNPCUnlock", "renderAreaRealmVisibility"];

export function installBackgroundRendering(ctx, game) {
  if (installed.has(game)) return installed.get(game);
  const pending = new Map(), patched = new WeakMap(), etaClasses = new WeakSet();
  let ready = false, interfaceReady = false;
  const canPaint = () => game.enableRendering !== false && game._isInOnlineLoop !== false &&
    (typeof document === "undefined" || document.visibilityState !== "hidden");
  const visible = (page, target) => page === masteryVisible ? page(target) : !ready || game.isGolbinRaid || !game.openPage || canPaint() &&
    (typeof page === "function" ? page(target) : game.openPage.containerID === page || page === "thieving-container" && game.openPage.action === game.thieving);
  function masteryVisible(skill) {
    if (!ready && game._isInOnlineLoop !== false || game.isGolbinRaid) return true;
    if (!canPaint()) return false;
    const pages = game.getPagesForSkill?.(skill);
    if (!game.openPage || !pages?.length || game.openPage.action === skill || pages.some(page => page.containerID === game.openPage.containerID)) return true;
    const body = typeof document === "undefined" ? undefined : document.body?.classList;
    return !body || body.contains("modal-open") || body.contains("swal2-shown");
  }
  const forget = (target, method) => {
    const methods = pending.get(target);
    methods?.delete(method);
    if (methods?.size === 0) pending.delete(target);
  };
  const guard = (Class, getTarget, methods, page, bankValues = false) => {
    if (typeof Class !== "function") return;
    let names = patched.get(Class);
    if (!names) { names = new Set(); patched.set(Class, names); }
    for (const method of methods) {
      if (names.has(method) || typeof Class.prototype[method] !== "function") continue;
      names.add(method);
      ctx.patch(Class, method).replace(function (original, ...args) {
        if (page === masteryVisible && (method === "renderActionMastery" ? this.renderQueue?.actionMastery : this.renderQueue?.masteryPool)?.size === 0) return original(...args);
        if (this !== getTarget.call(this, ...args) || bankValues && args[0] !== game.bank) return original(...args);
        if (visible(page, this)) {
          const result = original(...args);
          forget(this, method);
          return result;
        }
        if (!pending.has(this)) pending.set(this, new Map());
        pending.get(this).set(method, { args, getTarget, page, bank: bankValues ? args[0] : undefined });
      });
    }
  };
  const bankIconTarget = bankItem => {
    const bank = game.bank;
    if (!bank || typeof document === "undefined" || bankItem?.bank !== bank || bank.items?.get(bankItem.item) !== bankItem) return;
    const menu = document.getElementById("bank-tab-menu"), icon = menu?.itemIcons?.get(bankItem.item);
    if (icon?.isConnected && icon.item === bankItem.item && icon.getAttribute("data-item-id") === bankItem.item.id && menu.contains(icon)) return icon;
  };
  const headerTarget = (actualGame, skill) => {
    if (actualGame !== game || typeof document === "undefined" || !skill?.id || game.skills?.getObjectByID(skill.id) !== skill) return;
    const header = skill.header;
    if (!header?.isConnected || header.getAttribute("data-skill-id") !== skill.id) return;
    if (game.getPagesForSkill?.(skill)?.some(page => document.getElementById(page.containerID)?.contains(header))) return header;
  };
  const headerVisible = header => document.getElementById(game.openPage.containerID)?.contains(header) ||
    !!header.closest(".modal.show, .swal2-container");
  const getETA = () => typeof mod === "undefined" ? undefined : mod.api?.ETA?.ETA;
  const installETA = () => {
    const Class = getETA()?.constructor;
    if (typeof Class?.prototype.computeAndInjectMultiHTML !== "function" || etaClasses.has(Class)) return;
    ctx.patch(Class, "computeAndInjectMultiHTML").replace(function (original, skill, ...args) {
      if (ready && this === getETA() && this.game === game && skill === game.woodcutting && !game.isGolbinRaid &&
          !game.currentGamemode?.enableInstantActions && typeof document !== "undefined" &&
          document.getElementById("woodcutting-grants")?.closest(".kroky-activity-native-panel")) return;
      return original(skill, ...args);
    });
    etaClasses.add(Class);
  };
  const hiddenMainSplash = manager => {
    if (!canPaint() || typeof document === "undefined" || visible("combat-container") ||
        game.openPage.action === game.combat || game.openPage.id === "melvorD:Combat" ||
        !document.getElementById("combat-container")?.classList.contains("d-none")) return false;
    const id = manager.container?.id;
    const owner = id === "combat-player-splash-container" ? game.combat?.player : id === "combat-enemy-splash-container" ? game.combat?.enemy : undefined;
    return owner?.splashManager === manager && manager.container === document.getElementById(id);
  };
  const installSplashes = () => {
    const Class = typeof SplashManager === "function" ? SplashManager : undefined;
    if (typeof Class?.prototype.render !== "function" || typeof Class.prototype.renderSplash !== "function") return;
    let names = patched.get(Class);
    if (!names) { names = new Set(); patched.set(Class, names); }
    for (const method of ["render", "renderSplash"]) {
      if (names.has(method)) continue;
      names.add(method);
      ctx.patch(Class, method).replace(function (original, ...args) {
        if (!hiddenMainSplash(this)) return original(...args);
        // Native render clears this visual queue after scheduling; hidden hits are discarded instead.
        if (method === "render") this.queue = [];
      });
    }
  };
  const install = () => {
    installSplashes();
    const Mastery = typeof SkillWithMastery === "function" ? SkillWithMastery : undefined;
    guard(Mastery, function () { return this.game === game && game.skills?.getObjectByID?.(this.id) === this ? this : undefined; },
      ["renderActionMastery", "renderMasteryPool"], masteryVisible);
    const Menu = typeof customElements === "undefined" ? undefined : customElements.get("bank-tab-menu");
    guard(Menu, () => typeof document === "undefined" ? undefined : document.getElementById("bank-tab-menu"), ["updateBankValue"], "bank-container", true);
    const Icon = typeof customElements === "undefined" ? undefined : customElements.get("bank-item-icon");
    guard(Icon, bankIconTarget, ["updateQuantity"], "bank-container");
    if (typeof Menu?.prototype.removeItemFromTab === "function" && !patched.get(Menu).has("removeItemFromTab")) {
      patched.get(Menu).add("removeItemFromTab");
      ctx.patch(Menu, "removeItemFromTab").before(function (item) {
        if (this === document.getElementById("bank-tab-menu")) forget(this.itemIcons.get(item), "updateQuantity");
      });
    }
    guard(game.thieving?.constructor, () => game.thieving, thievingMethods, "thieving-container");
    const Header = typeof customElements === "undefined" ? undefined : customElements.get("skill-header");
    guard(Header, headerTarget, ["updateXP", "updateLevel", "updateAbyssalXP", "updateAbyssalLevel"], headerVisible);
    const Bank = game.bank?.constructor;
    if (typeof Bank?.prototype.render !== "function") return;
    let names = patched.get(Bank);
    if (!names) { names = new Set(); patched.set(Bank, names); }
    if (!names.has("updateSpaceElement") && typeof Bank.prototype.updateSpaceElement === "function") {
      names.add("updateSpaceElement");
      ctx.patch(Bank, "updateSpaceElement").replace(function (original, element, ...args) {
        if (this === game.bank && typeof numberWithCommas === "function" && element?.classList) {
          const used = this.occupiedSlots, maximum = this.maximumSlots;
          if (element.textContent === `${numberWithCommas(used)} / ${numberWithCommas(maximum)}` &&
              element.classList.contains("text-danger") === (used >= maximum)) return;
        }
        return original(element, ...args);
      });
    }
    if (names.has("render")) return;
    names.add("render");
    ctx.patch(Bank, "render").replace(function (original, ...args) {
      try { return original(...args); }
      finally {
        if (this === game.bank && [...pending.values()].some(methods => methods.get("updateBankValue")?.bank === this)) this.renderQueue.bankValue = true;
      }
    });
  };
  const flush = () => {
    if (!ready || !canPaint() || game.isGolbinRaid) return;
    installETA();
    for (const [target, methods] of [...pending]) for (const [method, entry] of [...methods]) {
      if (target !== entry.getTarget.call(target, ...entry.args) || entry.bank && entry.bank !== game.bank) { forget(target, method); continue; }
      if (!visible(entry.page, target)) continue;
      // Invoke the current SDK pipeline; saved original callbacks retain mutable replacement state.
      const args = entry.getTarget === bankIconTarget ? [entry.args[0], game.settings.enableAccessibility] : entry.args;
      target[method](...args);
      if (entry.page === masteryVisible && (method === "renderActionMastery" ? target.renderQueue?.actionMastery : target.renderQueue?.masteryPool)?.size === 0) forget(target, method);
      if (entry.bank && !pending.get(target)?.has(method)) entry.bank.renderQueue.bankValue = false;
    }
  };
  const reset = () => { ready = false; pending.clear(); };
  ctx.onCharacterLoaded(() => { pending.clear(); ready = interfaceReady; });
  ctx.onInterfaceReady(() => { install(); installETA(); interfaceReady = ready = true; });
  if (typeof game.constructor.prototype.decode === "function") {
    ctx.patch(game.constructor, "decode").before(function () { if (this === game) reset(); });
    ctx.patch(game.constructor, "decode").after(function () { if (this === game) ready = interfaceReady; });
  }
  install();
  installed.set(game, flush);
  return flush;
}
