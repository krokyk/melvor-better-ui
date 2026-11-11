# mod.io listing

## Name

Kroky's Better UI

## Summary

Pinned headers, readable card grids, smarter Bank filters and keyboard navigation, shared equipment sets, quick-equip shortcuts, stock badges and skill-tree controls.

## Description

Make Melvor's menus easier to navigate and its information easier to see.
Works independently of Workforce.

- **Pinned headers:** keep skill statistics, realm selectors and controls visible while scrolling.
- **Readable layouts:** fit more cards on wide screens and choose compact or vanilla item-stat previews.
- **Bank tools:** combine category filters with search, highlight matching tabs, reorder tabs by dragging and navigate items with arrow keys.
- **Better Moving:** persistent Move Mode, multi-selection, Shift-click ranges and Escape cancellation with selection retained.
- **Equipment:** share owned gear between remembered sets, copy loadouts, choose stack quantities and use up to six quick-equip shortcuts with a searchable Bank picker.
- **Stock information:** see Bank quantities in Shop and upgrade costs, `(required/stock)` in Agility, and item types in Bank details.
- **Skill trees:** highlight affordable upgrades and use **Spend All** to buy the displayed tree's cheapest available upgrades after one confirmation.
- **Convenience:** show completable Township tasks first, close completed replay summaries with Escape and refresh Abyss pet-location status.
- **Less background work:** defer hidden-page and replay presentation until it can be viewed.

Settings let you enable or disable the main interface features.
Better Moving and recipe Sources and Uses shortcuts are optional settings.

### Equipment-set behavior

Shared sets keep real items in Bank or the active set and remember inactive loadouts.
Leave enough free Bank space for the initial migration of inactive gear.
Disabling Better UI keeps active gear and Bank stock; inactive equipment sets are empty.

### Optional integrations

No third-party mod is required.
The integrations below extend those mods rather than replace them.

- **Kroky's Workforce:** pinned worker controls, readable recipe grids and enhanced item icons.
- **Skill Boosts:** its controls join the pinned header.
- **[Show Item Sources And Uses](https://mod.io/g/melvoridle/m/show-item-sources-and-uses):** item **?** shortcuts on supported recipe, upgrade and Agility material icons.
- **Speedup++ 1.0.4:** preserve the selected multiplier during offline replay and process the captured away window in small native tick batches.
- **[Myth] Combat Simulator 3.2.0:** import remembered inactive equipment sets without changing real equipment or Bank stock.

Reload after changing optional mods.

## Version

1.1.0

## Changelog

- Add Bank categories, matching-tab glows, keyboard navigation and drag-to-reorder tabs.
- Preserve item selection when entering and cancelling Move or Sell mode and restore grid focus after item dialogs.
- Add shared equipment sets, quantity controls and up to six quick-equip shortcuts.
- Add live stock badges, Agility cost quantities and completable Township task ordering.
- Add affordable skill-tree glows and cheapest-first Spend All.
- Reduce hidden and replay display work, stabilize Sources and Uses dialogs and support accelerated offline replay with Speedup++ 1.0.4.
- Add the matching navy-and-gold configuration icon.

## Release assets

- **ZIP:** `krokys-better-ui-1.1.0.zip`.
- **Cover:** `assets/cover.png`.
- **Configuration icon:** `icon.svg`, declared by `manifest.json`.

The ZIP contains the manifest, configuration icon and runtime `.mjs` files at its root.
The listing cover is uploaded separately.
