export function installShopStock(ctx) {
  const badges = new WeakMap(), products = new WeakMap();
  let confirmation;
  const updateProduct = (image, purchase, game) => {
    if (!image || purchase.contains.items.length !== 1 || Object.keys(purchase.contains).length !== 1) return;
    const item = purchase.contains.items[0].item;
    let binding = products.get(image);
    if (!binding) {
      const badge = document.createElement("small");
      badge.className = "kroky-shop-product-stock font-size-xs badge-pill bg-primary text-white";
      Object.assign(badge.style, { display: "block", width: "fit-content", margin: "0 auto", whiteSpace: "nowrap", justifySelf: "center" });
      if (image.classList.contains("swal2-image")) badge.style.marginTop = "-1rem";
      binding = { badge }; products.set(image, binding);
    }
    if (binding.badge.parentElement !== image.parentElement) image.after(binding.badge);
    const quantity = game.bank.getQty(item);
    if (binding.item === item && binding.quantity === quantity) return;
    binding.item = item; binding.quantity = quantity;
    binding.badge.textContent = formatNumber(quantity);
    binding.badge.title = `${item.name} in Bank: ${numberWithCommas(quantity)}`;
    binding.badge.setAttribute("aria-label", binding.badge.title);
  };
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
    if (confirmation?.view === this && Swal.getPopup() === confirmation.popup) updateProduct(Swal.getImage(), this.purchase, this.game);
    if (typeof QuickBuyItem === "function" && this instanceof QuickBuyItem && document.getElementById("modal-quick-buy-item")?.classList.contains("show"))
      updateProduct(this.image, this.purchase, this.game);
  }
  ctx.patch(ShopCostsAndUnlock, "createCostElements").after(update);
  ctx.patch(ShopCostsAndUnlock, "updateCostElements").after(update);
  ctx.patch(ShopCostsAndUnlock, "setToBuyLimit").after(function () {
    for (const cost of this.costElements) {
      const badge = badges.get(cost);
      if (badge) badge.parentElement.classList.replace("d-inline-flex", "d-none");
    }
  });
  if (typeof ShopMenu !== "function" || typeof ShopConfirmModalItem !== "function" || typeof Swal === "undefined") return;
  ctx.patch(ShopMenu, "showConfirmBuyPrompt").after(function () {
    confirmation = { view: this.confirmBuyItem, popup: Swal.getPopup() };
    updateProduct(Swal.getImage(), this.confirmBuyItem.purchase, this.game);
  });
  ctx.patch(ShopConfirmModalItem, "destroy").after(function () {
    if (confirmation?.view === this) confirmation = undefined;
  });
  ctx.patch(ShopMenu, "changeQuickBuyItem").after(function () {
    updateProduct(this.quickbuyMenu.image, this.quickbuyMenu.purchase, this.game);
  });
}
