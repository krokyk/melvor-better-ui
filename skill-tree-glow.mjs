const glowClass = "kroky-skill-tree-ready";
const styles = `
a.kroky-skill-tree-ready, button.kroky-skill-tree-ready { position: relative; }
.kroky-skill-tree-ready::after { content: ""; position: absolute; inset: 0; border-radius: inherit; outline: 2px solid #daa664; box-shadow: 0 0 10px 6px rgba(218,166,100,.75); pointer-events: none; z-index: 1; animation: kroky-skill-tree-glow 1.4s ease-in-out infinite; }
a.kroky-skill-tree-ready::after { inset: 4px 6px; border-radius: 4px; }
@keyframes kroky-skill-tree-glow { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .kroky-skill-tree-ready::after { animation: none; opacity: 1; } }
`;

export function installSkillTreeGlow(ctx, game) {
  const records = new Map(), states = new WeakMap(), pending = new Set();
  let sidebar, readyCount = 0, purchasing = 0;
  const safe = callback => {
    try { return callback(); }
    catch (error) { try { console.error("[Better UI] Skill tree glow could not refresh.", error); } catch {} }
  };
  const paint = (node, ready) => {
    if (!node || states.get(node) === ready) return;
    if (node.classList.contains(glowClass) !== ready) node.classList.toggle(glowClass, ready);
    states.set(node, ready);
  };
  const refresh = record => safe(() => {
    const ready = record.tree.points >= record.minimum && record.tree.canAffordAnyNode();
    if (ready === record.ready) return;
    readyCount += ready ? 1 : -1; record.ready = ready;
    for (const node of record.targets) paint(node, ready);
    paint(sidebar, readyCount > 0);
  });
  const request = record => { if (record) purchasing ? pending.add(record) : refresh(record); };
  const recordFor = skill => {
    let record = records.get(skill);
    if (record) return record;
    const tree = skill?.skillTrees?.getObjectByID("melvorItA:Abyssal");
    if (!tree) return;
    const nodes = tree.nodes.allObjects;
    record = { tree, targets: new Set(), ready: false, minimum: nodes.reduce((minimum, node) => Math.min(minimum, node.costs.points), Infinity) };
    records.set(skill, record);
    const extraCosts = nodes.some(node => {
      const costs = tree.getNodeCosts(node);
      return costs.getItemQuantityArray().length > 0 || costs.getCurrencyQuantityArray().length > 0;
    });
    if (extraCosts) {
      game.bank.on("itemChanged", () => request(record));
      game.currencies.forEach(currency => currency.on("amountChanged", () => request(record)));
    }
    let genericRequirements = false;
    for (const requirement of new Set(nodes.flatMap(node => node.requirements))) {
      if (typeof requirement.assignHandler === "function") requirement.assignHandler(() => request(record));
      else genericRequirements = true;
    }
    if (genericRequirements) game.on("requirementChange", () => request(record));
    return record;
  };
  const target = (skill, node) => {
    const record = recordFor(skill);
    if (!record || !node) return;
    record.targets.add(node); paint(node, record.ready);
  };
  const initial = () => safe(() => {
    if (!sidebar && typeof document !== "undefined") sidebar = document.querySelector(`#sidebar img[src="${assets.getURI("assets/media/main/skill_tree.png")}"]`)?.closest("a");
    game.skills.forEach(skill => {
      target(skill, skill.header?.skillTreeButton?.viewBtn);
      if (typeof skillTreeMenu !== "undefined") target(skill, skillTreeMenu.dropdownItemMap.get(skill)?.parentElement);
      request(recordFor(skill));
    });
    paint(sidebar, readyCount > 0);
  });
  if (typeof document !== "undefined" && !document.getElementById("kroky-skill-tree-glow-style")) {
    const style = document.createElement("style"); style.id = "kroky-skill-tree-glow-style"; style.textContent = styles; document.head.append(style);
  }
  ctx.patch(SkillTreeButtonElement, "setSkill").replace(function (original, skill, ...args) {
    const result = original(skill, ...args); safe(() => target(skill, this.viewBtn)); return result;
  });
  ctx.patch(SkillTreeMenuElement, "createDropdownItem").replace(function (original, skill, ...args) {
    const result = original(skill, ...args); safe(() => target(skill, this.dropdownItemMap.get(skill)?.parentElement)); return result;
  });
  ctx.patch(SkillTree, "addPoints").replace(function (original, ...args) {
    const result = original(...args);
    if (this.game === game) safe(() => { const record = recordFor(this.skill); if (record?.tree === this) request(record); });
    return result;
  });
  ctx.patch(SkillTree, "unlockNode").replace(function (original, ...args) {
    if (this.game !== game) return original(...args);
    purchasing++;
    try { return original(...args); }
    finally {
      // Availability sees consumed resources and completed native stats, even after a partial failure.
      safe(() => { const record = recordFor(this.skill); if (record?.tree === this) request(record); });
      purchasing--;
      if (!purchasing) { const batch = [...pending]; pending.clear(); for (const record of batch) refresh(record); }
    }
  });
  ctx.onCharacterLoaded(initial); ctx.onInterfaceReady(initial);
  ctx.patch(game.constructor, "decode").replace(function (original, ...args) {
    const result = original(...args); if (this === game) initial(); return result;
  });
}
