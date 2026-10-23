export async function setup(ctx) {
  const { installPagePinning } = await ctx.loadModule("page-pinning.mjs");
  const { installWideLayout } = await ctx.loadModule("wide-layout.mjs");
  ctx.onModsLoaded(() => {
    const settings = ctx.settings.section("General");
    const settingName = "page-pinning-enabled";
    const wideSettingName = "wide-layout-enabled";
    const compactSettingName = "compact-skill-header-enabled";
    let enabled = true, interfaceReady = false, nextUpdate = 0;
    let wideEnabled = true, compactEnabled = true;
    const updatePinning = installPagePinning(ctx, game, () => enabled, () => compactEnabled);
    const updateWideLayout = installWideLayout(ctx, game, () => wideEnabled);
    settings.add({
      type: "switch", name: settingName, label: "Enable Page Pinning", default: true,
      hint: "Show the thumbtack button in the page header. Disable to restore the normal layout while keeping your pin preference.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        enabled = value;
        if (interfaceReady) updatePinning();
      },
    });
    settings.add({
      type: "switch", name: compactSettingName, label: "Enable Compact Skill Header", default: true,
      hint: "Group Level and XP progress, Enhancements, mastery pools and their actions, and Skill tree in a dark row below the main header while pinned. Disable to keep their normal placement.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        compactEnabled = value;
        if (interfaceReady) updatePinning();
      },
    });
    settings.add({
      type: "switch", name: wideSettingName, label: "Enable Wide Layout", default: true,
      hint: "Expand desktop card grids within readable minimum and maximum card widths. Narrow screens keep their normal layout.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        wideEnabled = value;
        if (interfaceReady) updateWideLayout();
      },
    });
    const restore = () => {
      enabled = settings.get(settingName) !== false;
      wideEnabled = settings.get(wideSettingName) !== false;
      compactEnabled = settings.get(compactSettingName) !== false;
      if (interfaceReady) { updatePinning(); updateWideLayout(); }
    };
    ctx.onCharacterLoaded(restore);
    ctx.onInterfaceReady(() => { interfaceReady = true; restore(); });
    ctx.patch(Game, "decode").after(restore);
    ctx.patch(Game, "render").after(() => {
      if (!interfaceReady || performance.now() < nextUpdate) return;
      nextUpdate = performance.now() + 200;
      updatePinning();
    });
  });
}
