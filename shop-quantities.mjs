export function installShopQuantities(ctx, game, restoreQuickBuyFocus) {
  if (typeof Shop !== "function" || typeof ShopMenu !== "function" || typeof ShopConfirmModalItem !== "function" || typeof ShopBuyQuantityMenu !== "function") return;
  const singleItems = game.shop.purchases.allObjects.filter(purchase => !purchase.allowQuantityPurchase && !purchase.isModded &&
    purchase.contains.items.length > 0 && Object.keys(purchase.contains).length === 1);
  const updateBulk = () => {
    for (const purchase of singleItems) purchase.allowQuantityPurchase = purchase.getBuyLimit(game.currentGamemode) > 1;
  };
  updateBulk();
  ctx.onCharacterLoaded(updateBulk);
  if (typeof Game === "function" && typeof Game.prototype.decode === "function")
    ctx.patch(Game, "decode").after(function () { if (this === game) updateBulk(); });
  let active;
  const refresh = () => {
    if (!active || active.popup !== Swal.getPopup()) return;
    const { view } = active, purchase = view.purchase, quantity = view.buyQty;
    Swal.getTitle().textContent = templateLangString("SHOP_MISC_10", { qty: numberWithCommas(quantity), shopName: purchase.name });
    view.costContainer.previousElementSibling.innerHTML = purchase.getTemplatedDescription(game.shop);
    const canBuy = Number.isSafeInteger(quantity) && quantity > 0 && !game.shop.isPurchaseAtBuyLimit(purchase) &&
      game.shop.getPurchaseCosts(purchase, quantity).checkIfOwned() && game.checkRequirements(purchase.purchaseRequirements);
    Swal.getConfirmButton().disabled = !canBuy;
  };
  if (typeof $ === "function") $(document).on("focusin.krokyShopQuantities", ".kroky-shop-quantity-confirm", event => {
    // Keep Bootstrap's underlying Quick Buy modal from stealing the quantity input's focus.
    if (active?.popup === event.currentTarget && document.querySelector(".modal.show")) event.stopPropagation();
  });
  ctx.patch(Shop, "buyItemOnClick").replace(function (original, purchase, confirmed = false) {
    if (this !== game.shop || confirmed || !purchase.allowQuantityPurchase || !game.settings.showShopConfirmations ||
        !game.tutorial.complete && !game.tutorial.allowedShopPurchases.has(purchase) || this.isPurchaseAtBuyLimit(purchase))
      return original(purchase, confirmed);
    // An unaffordable shared quantity must still open a chooser; the confirmed purchase retains every native check.
    return shopMenu.showConfirmBuyPrompt(purchase);
  });
  ctx.patch(ShopMenu, "showConfirmBuyPrompt").after(function (_result, purchase) {
    if (this.game !== game || !this.confirmBuyItem) return;
    if (restoreQuickBuyFocus) Swal.update({ didClose: restoreQuickBuyFocus });
    if (!purchase.allowQuantityPurchase) return;
    const view = this.confirmBuyItem, popup = view.parent.closest(".swal2-popup");
    const row = document.createElement("div"); row.className = "d-flex justify-content-center mt-3";
    view.parent.append(row); view.quantityMenu = new ShopBuyQuantityMenu(row);
    Swal.getHtmlContainer().style.overflow = "visible";
    Swal.getHtmlContainer().style.zIndex = "2";
    popup.classList.add("kroky-shop-quantity-confirm"); active = { view, popup, menu: this };
    game.shop.updateBuyQuantity(game.shop.buyQuantity);
  });
  for (const method of ["updateForBuyQtyChange", "updateForCostChange", "updateForRequirementChange"])
    ctx.patch(ShopMenu, method).after(function () { if (active?.menu === this) refresh(); });
  ctx.patch(ShopConfirmModalItem, "destroy").after(function () {
    if (active?.view !== this) return;
    this.quantityMenu.destroy(); active = undefined;
  });
}
