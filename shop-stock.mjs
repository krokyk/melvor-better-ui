export function installShopStock(ctx) {
  const badges = new WeakMap();
  function update() {
    const { currencies, items } = this.purchase.costs;
    items.forEach(({ item }, index) => {
      const cost = this.costElements[currencies.length + index];
      let badge = badges.get(cost);
      if (!badge) {
        const wrapper = document.createElement("span");
        wrapper.className = "kroky-shop-cost-icon d-inline-flex flex-column align-items-center align-middle mr-1";
        badge = document.createElement("small");
        badge.className = "font-size-xs badge-pill bg-primary text-white";
        cost.image.before(wrapper);
        wrapper.append(cost.image, badge);
        badges.set(cost, badge);
      }
      const quantity = this.game.bank.getQty(item);
      badge.textContent = formatNumber(quantity);
      badge.title = `${item.name} in Bank: ${numberWithCommas(quantity)}`;
      badge.setAttribute("aria-label", badge.title);
    });
  }
  ctx.patch(ShopCostsAndUnlock, "createCostElements").after(update);
  ctx.patch(ShopCostsAndUnlock, "updateCostElements").after(update);
  ctx.patch(ShopCostsAndUnlock, "setToBuyLimit").after(function () {
    for (const cost of this.costElements) {
      const badge = badges.get(cost);
      if (badge) badge.parentElement.classList.replace("d-inline-flex", "d-none");
    }
  });
}
