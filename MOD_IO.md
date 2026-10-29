# mod.io listing

## Name

Kroky's Better UI

## Summary

Pin headers, fit readable cards across wide screens, share equipment across sets, choose manual equip quantities, use up to six quick-equip shortcuts, and optionally inspect recipe item sources and uses.

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
Move and Sell mode panels stay mounted in the pinned toolbar so toggling them does not briefly collapse the inventory.
Narrow screens retain the game's native Bank layout.

**General → Enable Compact Bank Controls** groups the blue Sort icon with the cog and filter on the right, with Space, Bank and Tab totals on the left.
Move Mode, Sell Mode and Deselect All align with Search Bank.
Mode buttons use move and GP icons, with a red X for the active mode.
The setting defaults to off, is saved per character and works independently of pinning and Better Moving.
Disabling it restores the original control layout and labels.

**General → Better Moving** defaults to off and is saved per character.
Enable it to replace the Bank's grey **Move items to new Tab** button with **Toggle Move Mode**.
With Compact Bank Controls disabled, the mode buttons read **Toggle Move Mode** and **Toggle Sell Mode** when inactive, changing to **Cancel Move Mode** and **Cancel Sell Mode** for the active mode.
Both buttons keep the same width in either state so the toolbar does not shift.
Move Mode uses the same red alert style as Sell Mode and lets you select several items in the current tab without opening item details.
Shift-click selects the visible range from the last normally clicked item in either direction while preserving existing selections.
With items selected, the other tabs pulse gold (#DAA664) every 1.4 seconds, fading from almost transparent to 50% opacity with a glow extending 3px outside each tab; click a destination tab or drag any selected item onto it to move every selected stack.
The glow remains visible along the top edge and above the selected tab's shadow.
Each move clears the selection, keeps you in the source tab and leaves Move Mode active for the next batch.
With nothing selected, tabs do not glow and clicking them switches tabs normally.
Focused tabs support Enter or Space for the same navigation and move actions.
Move Mode and Sell Mode cannot be active together.
The rightmost **Deselect All** button appears in either mode and clears the selection while keeping that mode active.
It uses the same blue as Workforce's **+1 Worker** controls and is disabled at 12% opacity when nothing is selected.
The old Select Tab and Confirm Move controls are hidden while Better Moving is enabled, and disabling the setting immediately restores the native behavior.
Reduced-motion preferences replace the pulse with a static amber highlight.

**Enable Wide Layout** uses the available desktop width for Woodcutting, Fishing, Mining, Astrology, Archaeology, Thieving, Shop, Bank, Farming and Township.
It also expands Workforce's production recipe grids when installed.
Each card layout has its own readable minimum and maximum width, so wider screens fit more columns.
Bank keeps compact inventory icons beside a bounded details column.
The setting works independently of pinning, defaults to on and is saved per character.
It applies at viewport widths of 1,200 pixels and above; narrower screens keep their existing layout.
Native production views, Combat, Cooking, Firemaking, Music and Agility retain their normal page widths.

**General → Show Sources and Uses on Recipe Icons** adds a small blue **?** just outside the top-right corner of ingredient and product item icons in Workforce recipe panels, mirroring the native shop-coin overlay.
It also covers Workforce's small Woodcutting, Mining and Fishing product/stock tiles and native Firemaking and Cooking recipe item icons.
The native Upgrade Item dialog includes these shortcuts on material-cost icons, including the base equipment item, bars and gems.
Coin and other currency costs and the large upgrade-result artwork remain unchanged.
Main card artwork receives no Sources and Uses **?**.
Produced Summoning tablets have no **?**; their ingredients and other skills' products retain their shortcuts.
Other native recipe-selection views, including Smithing and Fletching lists, stay unchanged.
It defaults to off and is saved per character.
Clicking **?** opens the item's dialog from [Show Item Sources And Uses](https://mod.io/g/melvoridle/m/show-item-sources-and-uses), calculating the information only when clicked.
Ordinary icon clicks keep their existing behavior, and ingredients with a gold shop-coin overlay keep Quick Buy without a **?**.
Currencies, XP and spell artwork without a specific item do not receive a **?**.
The integration is optional, with no hard dependency.
If Show Item Sources And Uses is missing, disabled or lacks the required API, the toggle is disabled with an explanation while retaining your saved preference.
Install or enable a compatible version and reload the game to make it available.

**General → Show Item Stats in Skills** chooses **As top-right corner icon**, **By clicking on item** or **By hovering over item** on the main artwork of skill cards that offer View Item Stats.
It defaults to click and is saved per character.
Radio choices are indented beneath their setting headings.
The corner option uses the existing stats icon, while recipe Sources and Uses buttons, ingredient navigation and gold-coin Quick Buy actions retain their existing behavior.

Inactive equipment sets remember item references, while only the active set holds real equipped gear.
One owned copy can serve several sets, and switching returns outgoing gear to Bank before equipping the requested layout.
**Copy From** beside the set buttons in Combat and the top-bar equipment menu copies another set's equipment layout into the current set.
The dropdown lists the other set numbers, keeps the current set selected and applies the normal equipment and Bank checks before replacing its layout.
The copy includes all six quick-equip shortcuts for every equipment slot, including hidden extra shortcuts.
A shared stack carries only its remaining equipped quantity between sets.
Additional or newly produced stock stays in Bank until a manual top-up or a new equip from Bank.
A stack entering the active layout takes its available Bank stock.
When a stack runs out, its reference stays remembered and its active slot becomes empty.
Switching is rejected if a required non-stackable item is unavailable or equipment, area or Bank-capacity restrictions prevent the change.
Migration adds every real inactive copy and stack to Bank, preserving total holdings and active equipped quantities.
When the mod is disabled, active gear and Bank stock remain in the native save, and inactive sets are empty.
It requires enough Bank capacity; if migration cannot complete, physical holdings are retained and loadout switching is unavailable.
These equipment-set features work independently of Enhanced Equipment Menu.

Consumption, depletion and combat stopping use vanilla behavior, including offline progress.
Equipment references add no consumption or offline-progress hooks.
Food, runes, item charges and Golbin Raid retain their native behavior.

**General → Enhanced Equipment Menu** controls the equipment menu changes, defaults to on and is saved per character.
Equipped-item hovers highlight the slot and show stats beside the whole equipment grid: left in the top-bar dropdown and right in Combat.
Leaving the slot closes the hover preview immediately, and the preview cannot intercept clicks.
Opening quick equip highlights its slot until the menu closes and hides the hover preview.
The Bank picker keeps the quick-equip menu centered as it expands.
Disabling it immediately restores the native three shortcuts, Set buttons and popup unequip X while retaining all native and additional shortcut assignments.
With the setting enabled, equipment slots in Combat and the top-bar equipment menu have a three-column quick-equip grid.
**General → Enable 3 Extra Quick Slots** defaults to on, is saved per character and adds a second row for six shortcuts in total.
Disabling it keeps the three native shortcuts and Bank picker while retaining the additional assignments for re-enabling.
The **Bank** chest button beside them opens a searchable picker of compatible bank equipment that meets its equip requirements.
The quick slots, **Bank**, **Equip selected** and **Unequip Current** controls stay visible and centred together above the item grid.
The solid green Bank button spans two quick-slot rows, with Bank text above the chest icon.
Beside it, the blue Equip selected button sits above the solid red Unequip Current button, each one quick-slot row high with white text.
When extra quick slots are disabled, the single row is vertically centred in the two-row control area.
Click a bank item to select it for equipping and preview its stats; click it again to clear the selection.
Clicking a bank item never equips it or assigns a shortcut.
Selecting stackable equipment shows the native Bank slider below Search Bank and above the item grid.
A single row beneath it contains the numeric input, All but 1 and All.
A new selection defaults to All available Bank stock.
All and All but 1 follow available stock, while manually entered amounts are preserved and clamped when stock shrinks.
All but 1 is disabled when only one Bank copy is available.
Hovering and searching retain the selected quantity mode.
Equip selected rejects invalid, fractional or unavailable amounts and moves the chosen quantity from Bank, adding it to an already equipped stack of the same item.
Use Equip selected to equip the selected item through the native equipment checks without assigning a shortcut.
The button is dimmed and disabled when no item is selected or the selected item is unavailable to equip.
Hovering an item temporarily previews its stats; leaving the item restores the selected item's preview or hides the preview when nothing is selected.
**General → Equip button behavior** selects whether a successful Equip selected closes the equip menu, closes just Bank and item stats, or keeps everything open.
The default closes just Bank and item stats while keeping quick equip open, and the choice is saved per character.
Failed equips keep the selection and stats available.
With Keeps everything open selected, equipping preserves the selected item's stats even if the last copy leaves the bank list under the game's normal inventory behavior.
An open picker refreshes after equipment changes while preserving its search and selection and updating stat comparisons, using the native equipment-change event without timers or polling.
Drag an item onto a shortcut to assign or replace it without equipping it.
**General → Equipment Stats Layout** selects **Vanilla** or **Compact**, defaults to Compact and is saved per character.
Both layouts show stats beside the picker without opening another dialog, with the inspected item's name in the preview header.
The setting also applies to skill and equipped-item hover previews, every View Item Stats dialog and total equipment stats.
Skill artwork shows one full stats preview without the inherited stock-count tooltip; the quantity badge retains its stock tooltip.
Vanilla uses the game's three-column View Item Stats format with artwork and descriptions, offensive stats and defensive stats side by side.
Compact uses two columns, with the name, artwork, description, special attacks and requirements on the left and offensive stats above defensive stats on the right.
The preview opens on the left when necessary and moves above or below the picker on narrow screens, using the available space.
Each preview box fits the width and height of its own content, independently of the bank list.
The viewport limits its maximum size, with scrolling only when necessary.
Items without available stats retain their name and artwork when present.
Both layouts include complete offensive and defensive tables with zero values and applicable damage resistances.
The inspected item's values and changes from equipped gear occupy separate numeric columns.
Item previews and View Item Stats dialogs share one renderer and comparison logic.
Comparisons use the active equipment set and the picker's equipment slot, including every item displaced by two-handed equipment.
Improvements appear green and reductions red, with a lower attack interval treated as an improvement.
For keyboard assignment, focus a bank item and press Space, then focus a target shortcut and press Enter or Space.
Click a shortcut to equip its item with the native equipment checks.
**General → Show Unequip Button on Equipment Icons** defaults to off and is saved per character.
**Unequip Current** always appears beside **Bank** in the enhanced quick-equip popup, regardless of this setting.
For an empty equipment slot, the popup button stays visible but is dimmed and disabled.
Enabling the setting adds a red minus in a red outlined square just outside the equipped item's top-right corner.
The setting only shows or hides these equipment-icon controls.
Both controls use the game's normal unequip checks and preserve shortcut assignments.
Native Set buttons are removed.
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

- Add optional Better Moving with persistent Move Mode and multiselected stack transfers by destination-tab click or drag and drop.
- Clear all selections in Move or Sell Mode with a blue Deselect All button that dims when the selection is empty.
- Select visible item ranges in either direction with Shift-click.
- Pulse destination tabs in gold (#DAA664) from almost transparent to 50% opacity every 1.4 seconds with a 3px outer glow only while items are selected, retaining ordinary tab navigation with no selection.
- Keep mode buttons the same width with active Cancel labels, match Move Mode's alert to Sell Mode, and draw destination glows above tab shadows.
- Share owned gear across equipment-set references while keeping real items in the active set and Bank.
- Preserve remaining shared stack quantities on switches and return real inactive holdings to Bank during migration.
- Choose the Bank quantity to equip with a native slider and exact numeric input.
- Expand equipment-slot quick equip to up to six shortcuts in Combat and the top-bar equipment menu.
- Enable or disable three extra quick slots per character while retaining the Bank picker and saved assignments.
- Replace Set buttons with a searchable bank picker for assigning compatible equipment by drag and drop or keyboard selection.
- Select or deselect bank equipment by clicking, preview other items while hovering, and use Equip selected to equip without assigning a shortcut.
- Keep the selected preview after equipping the last bank copy and refresh searches and comparisons after equipment changes.
- Choose a Vanilla three-column inline preview or a Compact two-column preview with complete item details and separate item-value and equipped-difference columns.
- Fit preview boxes to their content and centre the quick-equip controls above the bank grid.
- Indent radio choices beneath their setting headings.
- Choose a stats icon, click or hover on skill-card main artwork independently of recipe Sources and Uses and ingredient navigation.
- Centre shortcuts beside a tall green Bank button and stacked blue Equip selected and red Unequip Current buttons, with an optional per-character toggle for additional red minus-square controls on equipment icons.
- Enable or disable Enhanced Equipment Menu per character, restoring the native menu immediately while retaining all shortcut assignments.
- Highlight the currently viewed skill in the left navigation with a lighter grey background.
- Add an optional, per-character toggle for blue **?** buttons just outside recipe item icons' top-right corners, mirroring the native shop-coin overlay.
- Include Workforce's small Woodcutting, Mining and Fishing product/stock tiles and native Firemaking and Cooking recipe item icons.
- Include material-cost item icons in the native Upgrade Item dialog while retaining currency costs and large artwork unchanged.
- Keep recipe Sources and Uses shortcuts off main artwork and retain other native recipe-selection views.
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

Upload **krokys-better-ui-1.1.0.zip** with `manifest.json`, `setup.mjs`, `page-pinning.mjs`, `wide-layout.mjs`, `better-moving.mjs`, `item-stats.mjs`, `loadout-plan.mjs`, `loadout-transaction.mjs`, `equipment-loadouts.mjs`, `quick-equip.mjs` and `item-sources-and-uses.mjs` at the archive root.
