# mod.io listing

## Name

Kroky's Better UI

## Summary

Keep headers visible, fit more readable cards across wide screens, use six quick-equip shortcuts, and optionally inspect recipe item sources and uses.

## Description

**Kroky's Better UI** adds a thumbtack button to pin or unpin the main page header.
Keep skill statistics, equipment, realm selectors and category controls visible while scrolling through cards.
One shared pin choice follows you across skills, Combat, Bank, Shop, Settings, Farming and Township.
The currently viewed skill has a lighter grey background in the left navigation, independently of page pinning.

The pinned stack uses at most half the screen height and scrolls internally when necessary.
Combat's native XP table stays connected, and dropdown menus remain accessible outside scrolling sections.
Pinned skills show Level and XP progress bars, enhancement icons, Melvor and Abyssal mastery pools, their native actions, and Skill tree in one dark row below the main page header.
**General → Enable Compact Skill Header** independently controls this arrangement, defaults to on and is saved per character.
Disabling it restores native skill-header placement while retaining pinning and wide-layout settings.
Level, XP and Skill tree retain visible text labels.
Level and mastery-pool bars have fixed widths, while XP bars stay wide below the level cap and fit accumulated XP at the cap.
Capped XP bars keep a stable width until the number of digits changes.
Mastery pools show actual current and maximum values and retain their native warning colours.
Each mastery bar has its native percentage beside it in white with two decimal places and regular-weight tabular numerals in the game's font.
Level and XP share a compact section with a wider desktop gap before the section containing both mastery pools.
The native View Checkpoints and Spend Mastery Pool XP actions follow the mastery pools, with Upgrades immediately before Skill tree at the end.
Native action buttons retain their sizing and spacing, with thinner bars and vertically centred labels, icons and controls.
Sections wrap first at their 30px gaps; controls inside each section wrap only when the section is wider than the viewport.
The four sections are Level/XP, the mastery bars, the two mastery buttons, and Upgrades with Skill tree.
Upgrades show their names and effects on hover or keyboard focus.
Only the thumbtack joins the main page header.
Optional Skill Boosts controls are pinned across skills and Combat without requiring that mod.
On desktop, the pinned Bank has a compact full-width toolbar above its inventory and item-details columns.
Bank tabs and labelled Space, Bank and Tab totals stay above the inventory on the left.
The inventory and right-hand details panel fill the available viewport height and scroll independently.
Narrow screens retain the game's native Bank layout.

**Enable Wide Layout** uses the available desktop width for Woodcutting, Fishing, Mining, Astrology, Archaeology, Thieving, Shop, Bank, Farming and Township.
It also expands Workforce's production recipe grids when installed.
Each card layout has its own readable minimum and maximum width, so wider screens fit more columns.
Bank keeps compact inventory icons beside a bounded details column.
The setting works independently of pinning, defaults to on and is saved per character.
It applies at viewport widths of 1,200 pixels and above; narrower screens keep their existing layout.
Native production views, Combat, Cooking, Firemaking, Music and Agility retain their normal page widths.

**General → Show Sources and Uses on Recipe Icons** adds a small blue **?** just outside the top-right corner of ingredient and product item icons in Workforce recipe panels, mirroring the native shop-coin overlay.
It also covers Workforce's small Woodcutting, Mining and Fishing product/stock tiles and native Firemaking and Cooking recipe item icons.
Main card artwork stays plain.
Produced Summoning tablets have no **?**; their ingredients and other skills' products retain their shortcuts.
Other native views, including Smithing and Fletching recipe-selection lists, stay unchanged.
It defaults to off and is saved per character.
Clicking **?** opens the item's dialog from [Show Item Sources And Uses](https://mod.io/g/melvoridle/m/show-item-sources-and-uses), calculating the information only when clicked.
Ordinary icon clicks keep their existing behavior, and ingredients with a gold shop-coin overlay keep Quick Buy without a **?**.
Currencies, XP and spell artwork without a specific item do not receive a **?**.
The integration is optional, with no hard dependency.
If Show Item Sources And Uses is missing, disabled or lacks the required API, the toggle is disabled with an explanation while retaining your saved preference.
Install or enable a compatible version and reload the game to make it available.

**General → Enable Quick Equip Rework** controls the equipment menu changes, defaults to on and is saved per character.
Disabling it immediately restores the native three shortcuts, Set buttons and popup unequip X while retaining all native and additional shortcut assignments.
With the setting enabled, equipment slots in Combat and the top-bar equipment menu have six quick-equip shortcuts in a three-column, two-row grid.
The **Bank** chest button beside them opens a searchable picker of compatible bank equipment that meets its equip requirements.
Drag an item onto a shortcut to assign or replace it without equipping it.
For keyboard or touch input, select a bank item and then activate the target shortcut.
Click a shortcut to equip its item with the native equipment checks.
The native unequip **X** moves just outside the equipped item's top-right corner, and Set buttons are removed.
There is no shortcut-delete action; assign another item to replace one.
Existing three-slot assignments are preserved, and the additional three are saved per character, equipment set and equipment slot in Better UI data.

Open **Mod Settings → Kroky's Better UI → General → Enable Page Pinning** to enable or disable the feature.
The toggle defaults to on.
Disabling it hides the button and restores the normal layout while retaining your pin preference.

The pin choice starts unpinned for new users and is remembered in this browser on this device.
Existing Workforce pin preferences migrate automatically.
The mod works independently of Workforce and also pins Workforce's controls and activity summaries when installed.

## Version

1.1.0

## Changelog

### 1.1.0

- Expand equipment-slot quick equip to six shortcuts in Combat and the top-bar equipment menu.
- Replace Set buttons with a searchable bank picker for assigning compatible equipment by drag and drop or keyboard and touch selection.
- Move the native unequip X onto the equipped item's top-right corner and preserve existing shortcuts and native equipment checks.
- Enable or disable the quick-equip rework per character, restoring the native menu immediately while retaining all shortcut assignments.
- Highlight the currently viewed skill in the left navigation with a lighter grey background.
- Add an optional, per-character toggle for blue **?** buttons just outside recipe item icons' top-right corners, mirroring the native shop-coin overlay.
- Include Workforce's small Woodcutting, Mining and Fishing product/stock tiles and native Firemaking and Cooking recipe item icons.
- Keep main card artwork and other native views unchanged.
- Open the existing Show Item Sources And Uses dialog on demand without changing ordinary icon actions.
- Keep gold shop-coin ingredients on Quick Buy and skip icons without a specific item.
- Disable the toggle with an explanation when the optional provider is unavailable or incompatible, while preserving its saved preference.

### 1.0.0

- Pin page headers and controls with an icon-only thumbtack across skills, Combat, Bank, Shop, Settings, Farming and Township.
- Enable or disable page pinning in mod settings while retaining the browser's pin preference.
- Restore existing Workforce pin preferences automatically.
- Keep pinned content within half the viewport height and retain native Combat and dropdown behavior.
- Keep the desktop Bank's labelled totals, compact toolbar, wrapping tabs and full-height inventory and details panels.
- Use an independent wide-layout toggle and bounded card widths for supported desktop grids.
- Group skill progress bars, enhancements, mastery pools and their native actions, followed by Skill tree, in a compact row below the main header with an independent per-character toggle.
- Preserve enhancement tooltip contents and pin optional Skill Boosts controls, including on Combat.

## Upload

Upload **krokys-better-ui-1.1.0.zip** with `manifest.json`, `setup.mjs`, `page-pinning.mjs`, `wide-layout.mjs`, `quick-equip.mjs` and `item-sources-and-uses.mjs` at the archive root.
