export async function setup(ctx) {
  const { installPagePinning } = await ctx.loadModule("page-pinning.mjs");
  const { installWideLayout } = await ctx.loadModule("wide-layout.mjs");
  const { installItemStats, createItemStatsPreview } = await ctx.loadModule("item-stats.mjs");
  const loadoutPlanner = await ctx.loadModule("loadout-plan.mjs");
  const { applyEquipmentTransaction } = await ctx.loadModule("loadout-transaction.mjs");
  const { installEquipmentLoadouts } = await ctx.loadModule("equipment-loadouts.mjs");
  const { installQuickEquip } = await ctx.loadModule("quick-equip.mjs");
  const { installItemSourcesAndUses } = await ctx.loadModule("item-sources-and-uses.mjs");
  const { installBetterMoving } = await ctx.loadModule("better-moving.mjs");
  const { installBankKeyboard } = await ctx.loadModule("bank-keyboard.mjs");
  const { installBankTabOrder } = await ctx.loadModule("bank-tab-order.mjs");
  const { installBankItemType } = await ctx.loadModule("bank-item-type.mjs");
  const { installBackgroundRendering } = await ctx.loadModule("background-rendering.mjs");
  const { installShopStock } = await ctx.loadModule("shop-stock.mjs");
  const { installQuickBuyModal } = await ctx.loadModule("quick-buy-modal.mjs");
  const { installShopQuantities } = await ctx.loadModule("shop-quantities.mjs");
  const { installUpgradeStock } = await ctx.loadModule("upgrade-stock.mjs");
  const { installAgilityCostStock } = await ctx.loadModule("agility-cost-stock.mjs");
  const { installTownshipTaskOrder } = await ctx.loadModule("township-task-order.mjs");
  const { installSkillTreeSpendAll } = await ctx.loadModule("skill-tree-spend-all.mjs");
  const { installSkillTreeGlow } = await ctx.loadModule("skill-tree-glow.mjs");
  const { installReplaySpeed, installReplaySummaryKeyboard } = await ctx.loadModule("replay-speed.mjs");
  ctx.onModsLoaded(() => {
    const settings = ctx.settings.section("General");
    const settingName = "page-pinning-enabled";
    const wideSettingName = "wide-layout-enabled";
    const compactSettingName = "compact-skill-header-enabled";
    let enabled = true, interfacePrepared = false, interfaceReady = false, nextUpdate = 0;
    let lastPage, pageObserver;
    let wideEnabled = true, compactEnabled = true;
    const updatePinning = installPagePinning(ctx, game, () => enabled, () => compactEnabled);
    const updateWideLayout = installWideLayout(ctx, game, () => wideEnabled);
    const refreshPinning = () => {
      flushBackgroundRendering();
      lastPage = game.openPage;
      nextUpdate = performance.now() + 200;
      updatePinning();
    };
    const canRefresh = () => interfaceReady && game.enableRendering !== false && game._isInOnlineLoop !== false &&
      (typeof document === "undefined" || document.visibilityState !== "hidden");
    settings.add({
      type: "switch", name: settingName, label: "Enable Page Pinning", default: true,
      hint: "Show the thumbtack button in the page header. Disable to restore the normal layout while keeping your pin preference.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        enabled = value;
        if (interfacePrepared) updatePinning();
      },
    });
    settings.add({
      type: "switch", name: compactSettingName, label: "Enable Compact Skill Header", default: true,
      hint: "Group Level and XP progress, Upgrades, mastery pools and their actions, and Skill tree in a dark row below the main header while pinned. Disable to keep their normal placement.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        compactEnabled = value;
        if (interfacePrepared) updatePinning();
      },
    });
    settings.add({
      type: "switch", name: wideSettingName, label: "Enable Wide Layout", default: true,
      hint: "Expand desktop card grids within readable minimum and maximum card widths. Narrow screens keep their normal layout.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        wideEnabled = value;
        if (interfacePrepared) updateWideLayout();
      },
    });
    let quickEquip;
    installEquipmentLoadouts(ctx, game, loadoutPlanner, applyEquipmentTransaction,
      (source, target) => quickEquip?.prepareSetCopy(source, target));
    quickEquip = installQuickEquip(ctx, game, createItemStatsPreview);
    const getStatsLayout = quickEquip?.getStatsLayout;
    installItemStats(ctx, game, getStatsLayout);
    installItemSourcesAndUses(ctx, game);
    const updateBankFilters = installBetterMoving(ctx, game);
    installBankKeyboard(ctx, game);
    installBankTabOrder(ctx, game);
    installBankItemType(ctx, game);
    const flushBackgroundRendering = installBackgroundRendering(ctx, game);
    installShopStock(ctx);
    const restoreQuickBuyFocus = installQuickBuyModal(ctx);
    installShopQuantities(ctx, game, restoreQuickBuyFocus);
    installUpgradeStock(ctx, game);
    const updateAgilityCosts = installAgilityCostStock(ctx, game);
    installTownshipTaskOrder(ctx, game);
    installSkillTreeSpendAll(ctx, game);
    installSkillTreeGlow(ctx, game);
    installReplaySummaryKeyboard(game);
    installReplaySpeed(ctx, game);
    // Native Abyss clears omit the Area Info pet-status refresh.
    game.combat?.on("abyssDepthCompleted", ({ depth }) => {
      if (depth.pet) game.combat.renderQueue.petStatus.add(depth);
    });
    const restore = () => {
      enabled = settings.get(settingName) !== false;
      wideEnabled = settings.get(wideSettingName) !== false;
      compactEnabled = settings.get(compactSettingName) !== false;
      if (interfacePrepared) { refreshPinning(); updateWideLayout(); }
    };
    const prepare = () => {
      interfacePrepared = true;
      restore();
      if (pageObserver || typeof MutationObserver !== "function" || !game.pages?.forEach) return;
      // Page visibility changes finish before this callback runs and before the browser paints.
      pageObserver = new MutationObserver(() => {
        if (!canRefresh() || game.openPage === lastPage) return;
        const page = document.getElementById(game.openPage?.containerID);
        if (page && !page.classList.contains("d-none")) refreshPinning();
      });
      game.pages.forEach(page => {
        const node = document.getElementById(page.containerID);
        if (node) pageObserver.observe(node, { attributes: true, attributeFilter: ["class"] });
      });
    };
    ctx.onCharacterLoaded(prepare);
    ctx.onInterfaceReady(() => { interfaceReady = true; prepare(); });
    // Workforce may prepare its controls later in the same awaited character-loading sequence.
    if (typeof document !== "undefined") document.addEventListener?.("kroky-workforce-layout-ready", () => {
      if (interfacePrepared) refreshPinning();
    });
    ctx.patch(Game, "decode").after(restore);
    ctx.patch(Game, "render").after(() => {
      if (!canRefresh()) return;
      const now = performance.now();
      if (game.openPage === lastPage && now < nextUpdate) return;
      refreshPinning();
      updateAgilityCosts();
      updateBankFilters();
    });
  });
}
