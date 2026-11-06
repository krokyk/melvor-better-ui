export function installTownshipTaskOrder(ctx, game) {
  const township = game.township;
  if (!township?.tasks || !township.casualTasks) return;
  const lists = [
    { manager: township.tasks, map: "taskMap", container: "taskContainer", mode: 1, dirty: true },
    { manager: township.casualTasks, map: "casualTaskMap", container: "casualTaskContainer", mode: 2, dirty: true },
  ];
  const refresh = list => {
    if (!list.dirty || typeof townshipUI === "undefined" || townshipUI.currentPage !== 2 ||
        game.openPage?.action !== township || document.visibilityState === "hidden" ||
        game.enableRendering === false || game._isInOnlineLoop === false) return;
    const menu = townshipUI.tasks;
    if (menu.mode !== list.mode || menu.classList.contains("d-none")) return;
    const container = menu[list.container];
    if (container.classList.contains("d-none")) return;
    const ready = [], incomplete = [];
    // Native maps retain registration/current-task order even after their reused cards move.
    for (const node of menu[list.map].values()) {
      if (node.parentElement !== container || node.classList.contains("d-none")) continue;
      (node.completeButton.classList.contains("d-none") ? incomplete : ready).push(node);
    }
    [...ready, ...incomplete].forEach((node, index) => {
      const current = container.children[index];
      if (current !== node) container.insertBefore(node, current ?? null);
    });
    list.dirty = false;
  };
  let hooked = false;
  const installHooks = () => {
    if (hooked) return;
    const Class = customElements.get("township-tasks-menu");
    if (!Class) return;
    for (const [index, build, progress] of [[0, "showCategoryTasks", "updateTaskGoals"], [1, "setCasualTasks", "updateCasualTaskGoals"]]) {
      const list = lists[index];
      ctx.patch(Class, build).after(function () {
        if (typeof townshipUI === "undefined" || this !== townshipUI.tasks) return;
        list.dirty = true; refresh(list);
      });
      ctx.patch(Class, progress).after(function () {
        if (typeof townshipUI !== "undefined" && this === townshipUI.tasks) list.dirty = true;
      });
    }
    hooked = true;
  };
  installHooks();
  for (const list of lists) ctx.patch(list.manager.constructor, "render").after(function () {
    if (this === list.manager) refresh(list);
  });
  const reset = () => { for (const list of lists) list.dirty = true; };
  ctx.onCharacterLoaded(reset);
  ctx.patch(game.constructor, "decode").after(function () { if (this === game) reset(); });
  ctx.onInterfaceReady(() => { installHooks(); reset(); lists.forEach(refresh); });
}
