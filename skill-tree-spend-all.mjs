export function installSkillTreeSpendAll(ctx, game) {
  const views = new Map();
  const dialogMenus = new WeakMap();
  const openDialog = (menu, options) => SwalLocale.fire({ ...options, willOpen(popup) {
    dialogMenus.set(popup, menu); popup.classList.add("kroky-skill-tree-spend-dialog");
  } });
  if (typeof $ === "function") $(document).on("focusin.krokySkillTreeSpendAll", ".kroky-skill-tree-spend-dialog", function (event) {
    // jQuery delegates precede Bootstrap's document focus trap, including simulated focusin events.
    if (dialogMenus.get(this)?.closest(".modal.show")) event.stopPropagation();
  });
  let generation = 0;
  const visible = menu => (typeof document === "undefined" || document.visibilityState !== "hidden") && menu.getClientRects().length > 0;
  const invalidate = view => { view.version++; view.operation = undefined; view.button.disabled = true; };
  const refresh = (menu, view) => {
    const tree = menu.currentSkillTree;
    if (!tree || tree !== view.tree) { view.dirty = false; return; }
    if (!visible(menu)) { view.dirty = true; return; }
    const disabled = !!view.operation || !tree.canAffordAnyNode();
    if (view.button.disabled !== disabled) view.button.disabled = disabled;
    view.dirty = false;
  };
  const spend = async (menu, view) => {
    const tree = menu.currentSkillTree;
    if (view.operation || !tree || tree !== view.tree || !visible(menu) || !tree.canAffordAnyNode()) return;
    const operation = { generation, version: view.version };
    const limit = tree.nodes.allObjects.length;
    const current = () => generation === operation.generation && view.version === operation.version &&
      view.operation === operation && menu.currentSkillTree === tree && visible(menu);
    view.operation = operation; view.button.disabled = true;
    let purchased = 0, failed = false, failure;
    try {
      const result = await openDialog(menu, {
        icon: "question", title: "Spend all available points?",
        text: `${tree.skill.name} — ${tree.name}\nAvailable points: ${tree.points}.\nUnlock affordable nodes in this tree, cheapest point cost first. Normal item and currency costs also apply.`,
        showConfirmButton: true, showCancelButton: true, confirmButtonText: "Spend All", cancelButtonText: "Cancel",
      });
      if (result?.isConfirmed && current()) for (let attempt = 0; attempt < limit && current(); attempt++) {
        let next;
        for (const node of tree.nodes.allObjects) {
          if (!node.isUnlocked && node.canUnlock && tree.canAffordNode(node) && (!next || node.costs.points < next.costs.points)) next = node;
        }
        if (!next) break;
        const wasLocked = !next.isUnlocked;
        try { tree.unlockNode(next); }
        finally { if (wasLocked && next.isUnlocked) purchased++; }
        if (!next.isUnlocked) break;
      }
    } catch (error) { failed = true; failure = error; }
    finally {
      if (purchased) try { game.scheduleSave(); }
      catch (error) { if (!failed) { failed = true; failure = error; } }
      if (view.operation === operation) { view.operation = undefined; view.dirty = true; }
    }
    if (failed) {
      try {
        console.error("[Better UI] Spend all skill tree points stopped.", failure);
        openDialog(menu, { icon: "error", title: "Spend all stopped",
          text: `Some nodes may have been unlocked.\n\n${failure instanceof Error ? failure.message : String(failure)}`,
          showConfirmButton: true, showCancelButton: false, confirmButtonText: "Close" });
      } finally { throw failure; }
    }
  };
  ctx.patch(SkillTreeMenuElement, "setSkillTree").replace(function (original, tree, owner, ...args) {
    let view = views.get(this);
    if (view) invalidate(view);
    const result = original(tree, owner, ...args);
    if (owner !== game) return result;
    if (!view) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "btn btn-success ml-2"; button.textContent = "Spend All";
      button.title = "Unlock affordable nodes in this tree, cheapest point cost first. Normal costs apply.";
      button.disabled = true; this.pointsCount.parentElement.classList.add("align-items-center"); this.pointsCount.after(button);
      view = { button, version: 0 }; views.set(this, view);
      button.addEventListener("click", () => spend(this, view));
    }
    view.tree = tree; view.dirty = true;
    view.extraCosts = tree.nodes.allObjects.some(node => {
      const costs = tree.getNodeCosts(node);
      return costs.getItemQuantityArray().length > 0 || costs.getCurrencyQuantityArray().length > 0;
    });
    view.extraRequirements = tree.nodes.allObjects.some(node => node.requirements.length > 0);
    refresh(this, view);
    return result;
  });
  ctx.patch(SkillTreeMenuElement, "render").replace(function (original, ...args) {
    const view = views.get(this), queue = this.renderQueue;
    const dirty = view && (view.dirty || queue.currentPoints || view.extraCosts && queue.costs || view.extraRequirements && queue.requirements);
    const result = original(...args);
    if (dirty) refresh(this, view);
    return result;
  });
  ctx.patch(SkillTreeMenuElement, "onClose").replace(function (original, ...args) {
    const view = views.get(this);
    if (view) { invalidate(view); view.dirty = false; }
    return original(...args);
  });
  ctx.onCharacterLoaded(() => {
    generation++;
    for (const view of views.values()) { invalidate(view); view.dirty = true; }
  });
}
