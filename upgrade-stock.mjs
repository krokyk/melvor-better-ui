export function installUpgradeStock(ctx, game) {
  const bindings = new Map(), dirty = new Set();
  let modal, hooked = false;
  const refresh = () => {
    for (const item of dirty) {
      const quantity = game.bank.getQty(item);
      for (const binding of bindings.get(item) ?? []) {
        if (binding.quantity === quantity) continue;
        binding.quantity = quantity;
        binding.badge.textContent = formatNumber(quantity);
        binding.badge.title = `${item.name} in Bank: ${numberWithCommas(quantity)}`;
        binding.badge.setAttribute("aria-label", binding.badge.title);
      }
    }
    dirty.clear();
  };
  const bind = (item, badge) => {
    const records = bindings.get(item) ?? [];
    records.push({ badge }); bindings.set(item, records); dirty.add(item);
  };
  const installHook = () => {
    if (hooked) return;
    const Class = customElements.get("item-upgrade-menu");
    if (typeof Class?.prototype.setUpgradeCosts !== "function") return;
    ctx.patch(Class, "setUpgradeCosts").after(function (_result, upgrade, bank, actualGame) {
      if (actualGame !== game || bank !== game.bank) return;
      modal = this.closest("#modal-item-upgrade"); bindings.clear(); dirty.clear();
      if (!document.getElementById("kroky-upgrade-stock-style")) {
        const style = document.createElement("style"); style.id = "kroky-upgrade-stock-style";
        style.textContent = `
          .kroky-upgrade-stock-icon { position: relative; display: inline-block; vertical-align: middle; margin-bottom: .5rem; }
          .kroky-upgrade-stock-icon > img { margin: 0!important; }
          .kroky-upgrade-stock { position: absolute; bottom: calc(-.35rem - 5px); left: 50%; transform: translateX(-50%); white-space: nowrap; }
          .kroky-upgrade-result-stock { display: block; width: fit-content; margin: 0 auto; white-space: nowrap; }
        `;
        document.head.append(style);
      }
      const images = this.itemCosts.querySelectorAll("img");
      upgrade.itemCosts.forEach(({ item }, index) => {
        const image = images[index];
        if (!image) return;
        let wrapper = image.parentElement;
        if (!wrapper.classList.contains("kroky-upgrade-cost-icon")) {
          wrapper = document.createElement("span"); wrapper.className = "kroky-upgrade-cost-icon skill-icon-sm mr-1";
          image.before(wrapper); wrapper.append(image);
        }
        wrapper.classList.add("kroky-upgrade-stock-icon");
        let badge = wrapper.querySelector(".kroky-upgrade-stock");
        if (!badge) {
          badge = document.createElement("small"); badge.className = "kroky-upgrade-stock font-size-xs badge-pill bg-primary text-white";
          wrapper.append(badge);
        }
        bind(item, badge);
      });
      let resultBadge = this.itemImage.parentElement.querySelector(".kroky-upgrade-result-stock");
      if (!resultBadge) {
        resultBadge = document.createElement("small");
        resultBadge.className = "kroky-upgrade-result-stock font-size-xs badge-pill bg-primary text-white";
        this.itemImage.after(resultBadge);
      }
      bind(upgrade.upgradedItem, resultBadge);
      refresh();
    });
    hooked = true;
  };
  installHook();
  ctx.onInterfaceReady(installHook);
  ctx.onCharacterLoaded(() => { modal = undefined; bindings.clear(); dirty.clear(); });
  ctx.patch(game.bank.constructor, "render").before(function () {
    if (this !== game.bank || bindings.size === 0) return;
    for (const item of bindings.keys()) if (this.renderQueue.items.has(item)) dirty.add(item);
    if (dirty.size === 0 || document.visibilityState === "hidden" || game.enableRendering === false || game._isInOnlineLoop === false ||
        !modal?.classList.contains("show")) return;
    refresh();
  });
}
