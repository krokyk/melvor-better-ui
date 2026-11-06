export function installAgilityCostStock(ctx, game) {
  const menus = new Map();
  let hooked = false;
  const paint = rows => {
    for (const row of rows) {
      const stock = row.item ? game.bank.getQty(row.item) : row.currency.amount;
      if (row.stock === stock) continue;
      row.stock = stock;
      const text = `(${formatNumber(row.required)}/${formatNumber(stock)})`;
      if (row.element.text.textContent !== text) row.element.text.textContent = text;
      const title = `${(row.item ?? row.currency).name}: Required ${numberWithCommas(row.required)} / Owned ${numberWithCommas(stock)}`;
      if (row.element.text.title !== title) {
        row.element.text.title = title;
        row.element.text.setAttribute("aria-label", title);
      }
      const affordable = stock >= row.required;
      if (row.affordable !== affordable) { toggleDangerSuccess(row.element, affordable); row.affordable = affordable; }
    }
  };
  const installHook = () => {
    if (hooked) return;
    const Class = customElements.get("agility-obstacle-selection");
    if (typeof Class?.prototype.setCosts !== "function") return;
    ctx.patch(Class, "setCosts").after(function (_result, items, currencies) {
      const costs = [...items, ...currencies], rows = [];
      costs.forEach(({ item, currency, quantity }, index) => {
        const element = this.costContainer.children[index];
        if (element?.text) rows.push({ element, item, currency, required: quantity, affordable: element.classList.contains("text-success") });
      });
      menus.set(this, rows); paint(rows);
    });
    hooked = true;
  };
  installHook();
  ctx.onInterfaceReady(installHook);
  ctx.onCharacterLoaded(() => menus.clear());
  return () => {
    if (menus.size === 0 || document.visibilityState === "hidden" || game.enableRendering === false || game._isInOnlineLoop === false) return;
    const modal = document.getElementById("modal-select-agility-obstacle");
    if (!modal?.classList.contains("show")) return;
    for (const [menu, rows] of menus) if (!menu.classList.contains("d-none") && modal.contains(menu)) paint(rows);
  };
}
