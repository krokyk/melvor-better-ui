export function installQuickBuyModal(ctx) {
  if (typeof document === "undefined" || typeof $ !== "function") return () => {};
  const style = document.createElement("style");
  style.textContent = "#modal-quick-buy-item { z-index: 1055; }";
  document.head.append(style);
  let parent, opener, quickBuy, focusParent, pending = false;
  const reset = () => { parent = opener = quickBuy = focusParent = undefined; pending = false; };
  const restoreFocus = () => {
    if (!pending || document.querySelector(".swal2-container")) return;
    const source = parent, target = opener, quick = quickBuy;
    reset();
    if (!source?.isConnected || !source.classList.contains("show") ||
        [...document.querySelectorAll(".modal.show")].some(modal => modal !== source)) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== source && active !== target && !quick?.contains(active)) return;
    focusParent = source;
    const destination = target?.isConnected && source.contains(target) ? target : source;
    if (active !== destination) destination.focus({ preventScroll: true });
  };
  $(document).on("show.bs.modal.krokyQuickBuy", "#modal-quick-buy-item", event => {
    focusParent = undefined; quickBuy = event.target;
    const shown = [...document.querySelectorAll(".modal.show")].filter(modal => modal !== quickBuy);
    parent = shown.find(modal => modal.contains(document.activeElement)) ?? shown.at(-1);
    opener = parent?.contains(document.activeElement) ? document.activeElement : parent;
    pending = false;
  });
  $(document).on("hidden.bs.modal.krokyQuickBuy", event => {
    if (event.target === focusParent) focusParent = undefined;
    if (event.target.id !== "modal-quick-buy-item") return;
    if (document.querySelectorAll(".modal.show").length) document.body.classList.add("modal-open");
    pending = !!parent;
    restoreFocus();
  });
  // Bootstrap removes its focus trap when the child closes, even while its parent remains open.
  $(document).on("focusin.krokyQuickBuy", event => {
    if (!focusParent?.isConnected || !focusParent.classList.contains("show")) { focusParent = undefined; return; }
    if (document.querySelector(".swal2-container") || [...document.querySelectorAll(".modal.show")].some(modal => modal !== focusParent)) return;
    if (event.target !== document && !focusParent.contains(event.target)) focusParent.focus({ preventScroll: true });
  });
  ctx.onCharacterLoaded(reset);
  return restoreFocus;
}
