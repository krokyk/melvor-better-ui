export async function setup(ctx) {
  const { installPagePinning } = await ctx.loadModule("page-pinning.mjs");
  ctx.onModsLoaded(() => {
    const settings = ctx.settings.section("General");
    const settingName = "page-pinning-enabled";
    let enabled = true, interfaceReady = false, nextUpdate = 0;
    const updatePinning = installPagePinning(ctx, game, () => enabled);
    settings.add({
      type: "switch", name: settingName, label: "Enable Page Pinning", default: true,
      hint: "Show the Pin / Unpin button in the page header. Disable to restore the normal layout while keeping your pin preference.",
      onChange(value) {
        if (typeof value !== "boolean") return "Choose enabled or disabled.";
        enabled = value;
        if (interfaceReady) updatePinning();
      },
    });
    const restore = () => {
      enabled = settings.get(settingName) !== false;
      if (interfaceReady) updatePinning();
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
