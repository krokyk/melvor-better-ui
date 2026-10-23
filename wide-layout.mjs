// Widths apply to outer cards; each card keeps its native controls and internal layout.
const layouts = [
  ["#woodcutting-tree-container", "woodcutting-tree", 20, 30],
  ["#mining-ores-container", "mining-rock", 22, 30],
  ["#astrology-container-content", "constellation-menu", 24, 32],
  ["#archaeology-dig-sites-container", "archaeology-dig-site-container", 28, 36],
  ["#thieving-npc-container", "thieving-area-panel", 36, 52],
  ["#fishing-area-menu-container", ":is(.kroky-fishing-section, fishing-area-menu)", 32, 42],
  [".kroky-production-grid", ".kroky-production-card", 22, 30],
  ["#new-shop .row.row-deck", ".col-12", 24, 34],
  ["#farming-plot-container", "farming-plot", 20, 28],
  ["#ts-town", "building-in-town", 18, 26],
];
const scope = "#page-container.kroky-wide-layout";
const styles = `
@media (min-width: 1200px) {
  ${scope} #main-container > :is(#woodcutting-container, #fishing-container, #mining-container, #astrology-container, #archaeology-container, #thieving-container, #shop-container, #farming-container, #township-container, #bank-container),
  ${scope} #main-container > .content:has(.kroky-production:not([hidden]) > div:not([hidden]) > details) { max-width: none; }
  ${layouts.map(([grid, card, min, max]) => `
  ${scope} ${grid} { --kroky-card-min: ${min}rem; --kroky-card-max: ${max}rem; display: grid; width: 100%; grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--kroky-card-min)), 1fr)); gap: 1rem; align-items: stretch; margin-left: 0; margin-right: 0; }
  ${scope} ${grid} > :not(${card}) { grid-column: 1 / -1; }
  ${scope} ${grid} > ${card} { flex: none !important; width: 100% !important; min-width: 0; max-width: var(--kroky-card-max) !important; margin-left: 0; margin-right: 0; justify-self: center; }
  ${scope} ${grid} > ${card}:not(.kroky-production-card, .kroky-fishing-section) { padding-left: 0 !important; padding-right: 0 !important; }
  ${scope} ${grid} > ${card} > .block { width: 100%; margin-bottom: 0; }
  `).join("")}
  ${scope} .kroky-production-grid > .kroky-production-card,
  ${scope} woodcutting-tree > .kroky-woodcutting-card { width: 100%; margin-left: 0; margin-right: 0; }
  ${scope} #bank-container > .row > bank-tab-menu { flex: 1 1 0; min-width: 0; max-width: none; }
  ${scope} #bank-container > .row > :has(> #bank-item-box) { flex: 0 0 clamp(24rem, 28%, 36rem); max-width: 36rem; }
  ${scope} #township-container > .skill-info > .row { margin-left: 0; margin-right: 0; }
}
`;

export function installWideLayout(ctx, game, isEnabled = () => true) {
  if (typeof document === "undefined") return () => {};
  let style;
  return () => {
    const root = document.getElementById("page-container");
    if (!root) return;
    if (!style) {
      style = document.createElement("style");
      style.textContent = styles;
      document.head.append(style);
    }
    root.classList.toggle("kroky-wide-layout", isEnabled());
  };
}
