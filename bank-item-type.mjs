export function installBankItemType(ctx, game) {
  const labels = new WeakMap();
  let hooked = false;
  const installHook = () => {
    if (hooked) return;
    const Class = customElements.get("bank-selected-item-menu");
    if (typeof Class?.prototype.setItem !== "function") return;
    ctx.patch(Class, "setItem").after(function (_result, bankItem, bank) {
      if (bank !== game.bank) return;
      let label = labels.get(this);
      if (!label) {
        label = document.createElement("small");
        label.className = "kroky-bank-item-type d-block font-size-sm font-w400 text-left text-bank-desc m-1 mt-auto";
        this.viewStatsButton.parentElement.classList.add("d-flex", "flex-column");
        this.viewStatsButton.after(label);
        labels.set(this, label);
      }
      const text = `Type: ${bankItem.item.type}`;
      if (label.textContent !== text) label.textContent = text;
    });
    hooked = true;
  };
  installHook();
  ctx.onInterfaceReady(installHook);
}
