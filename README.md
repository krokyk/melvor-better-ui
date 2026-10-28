# Kroky's Better UI

Version: **1.1.0**.

Page header pinning, responsive desktop card grids, shared equipment sets, manual equip quantities, up to six quick-equip slots and optional recipe item sources and uses for Melvor Idle, including Kroky's Workforce layouts when installed.
The mod works independently of Workforce.
The currently viewed skill has a lighter grey background in the left navigation.
The highlight follows navigation and works when page pinning is disabled.

Open **Mod Settings → Kroky's Better UI → General → Enable Page Pinning** to enable or disable the feature.
The setting defaults to on and is saved per character.
Disabling it hides the thumbtack button and restores the normal layout immediately while retaining the pin preference.

Use the thumbtack icon in the main page header to pin or unpin the header and controls.
The button keeps its native state colours and exposes its action through a tooltip and accessible label.
The choice applies across skills, Combat, Bank, Shop, Settings, Farming and Township, and is remembered in this browser on this device.
New users start unpinned.
Existing Workforce pin preferences migrate automatically without changing the original values.

The pinned stack uses at most half the viewport height and scrolls internally when necessary.
Page navigation applies the pinned layout before the browser paints, while routine updates retain a 200 ms cadence.
Combat's native XP table stays connected, and dropdown menus remain accessible outside scrolling sections.
Pinned skills show Level and XP progress bars, enhancement icons, Melvor and Abyssal mastery pools, their native actions, and Skill tree together in a dark row below the main page header.
**General → Enable Compact Skill Header** controls this arrangement independently of pinning and wide layouts.
It defaults to on and is saved per character.
Disabling it restores the native skill-header placement while keeping headers pinned.
Stats use the text labels Level and XP, and the native skill-tree button is labelled Skill tree.
Level, XP and Abyssal stat bars retain their native green, blue and red colours.
Level and mastery-pool bars have fixed widths, and XP bars use a wide fixed width below the level cap.
Capped XP bars fit the accumulated XP number and keep that width until its digit count changes.
Each mastery pool shows its actual current and maximum values inside its progress bar.
Its native mastery percentage follows the bar in white with two decimal places and regular-weight tabular numerals in the game's font.
Level and XP share a compact section, separated by a wider desktop gap from the section containing both mastery pools.
Mastery progress retains its native warning colours.
The native View Checkpoints and Spend Mastery Pool XP actions follow the mastery pools, with Upgrades immediately before Skill tree at the end.
Native action buttons retain their sizing and spacing.
Bars are thinner than the buttons, with labels, bars, icons and buttons vertically centred together.
Sections wrap first at the 30px gaps as the available width shrinks.
The four sections are Level/XP, mastery pools, the two mastery buttons, and Upgrades with Skill tree.
The mastery bars can wrap onto separate lines, while the two buttons stay side by side.
Enhancement icons show their names and effects on hover or keyboard focus.
Only the thumbtack joins the main page header.
Skill Boosts controls join the pinned controls when that optional mod is installed, including on Combat.
The mod has no dependency on Skill Boosts.
Progress calculations cover the visible skill and stat groups; hidden skills and realms are skipped.
On desktop, the pinned Bank has a compact full-width toolbar above its inventory and item-details columns.
Bank tabs and labelled Space, Bank and Tab totals stay above the inventory on the left.
The inventory and right-hand details panel fill the available viewport height and scroll independently.
Move and Sell mode panels stay mounted in the pinned toolbar so toggling them does not briefly collapse the inventory.
Narrow screens retain the game's native Bank layout.

**General → Better Moving** defaults to off and is saved per character.
Enable it to replace the Bank's grey **Move items to new Tab** button with **Toggle Move Mode**.
While enabled, the mode buttons read **Toggle Move Mode** and **Toggle Sell Mode** when inactive, changing to **Cancel Move Mode** and **Cancel Sell Mode** for the active mode.
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

Open **Mod Settings → Kroky's Better UI → General → Enable Wide Layout** to use the available desktop width independently of pinning.
The toggle defaults to on and is saved per character.
At viewport widths of 1,200 pixels and above, supported grids add columns according to their available content width.
Cards retain their controls and use these minimum and maximum widths:

| Layout | Minimum | Maximum |
| --- | --- | --- |
| Woodcutting | 20rem | 30rem |
| Mining and Workforce production recipes | 22rem | 30rem |
| Astrology | 24rem | 32rem |
| Archaeology | 28rem | 36rem |
| Thieving areas | 36rem | 52rem |
| Fishing areas | 32rem | 42rem |
| Shop | 24rem | 34rem |
| Farming plots | 20rem | 28rem |
| Township buildings | 18rem | 26rem |

Bank inventory uses the remaining width beside a details column bounded between 24rem and 36rem.
Township resource summaries use the expanded page width while building cards wrap in their own grid.
Workforce production recipe cards share one range across Smithing, Fletching, Crafting, Runecrafting, Herblore, Summoning and Alt. Magic.
Native production views, Combat, Cooking, Firemaking, Music and Agility retain their normal page widths.
Below 1,200 pixels the wide-layout setting leaves the existing layout unchanged.
Disabling the setting restores the normal widths immediately.

Open **Mod Settings → Kroky's Better UI → General → Show Sources and Uses on Recipe Icons** to add a small blue **?** just outside the top-right corner of ingredient and product item icons in Workforce recipe panels, mirroring the native shop-coin overlay.
It also covers Workforce's small Woodcutting, Mining and Fishing product/stock tiles and native Firemaking and Cooking recipe item icons.
The native Upgrade Item dialog includes these shortcuts on material-cost icons, including the base equipment item, bars and gems.
Coin and other currency costs and the large upgrade-result artwork remain unchanged.
Main card artwork receives no Sources and Uses **?**.
Produced Summoning tablets have no **?**; their ingredients and other skills' products retain their shortcuts.
Other native recipe-selection views, including Smithing and Fletching lists, stay unchanged.
The setting defaults to off and is saved per character.
Clicking **?** opens the item's dialog from [Show Item Sources And Uses](https://mod.io/g/melvoridle/m/show-item-sources-and-uses); ordinary icon clicks keep their existing behavior.
Ingredients with a gold shop-coin overlay keep Quick Buy without a **?**.
Currencies, XP and spell artwork without a specific item do not receive a **?**.
Sources and uses are calculated only when clicked.
This integration is optional and does not add a hard dependency.
If Show Item Sources And Uses is missing, disabled or lacks the required API, the toggle is disabled with an explanation while retaining your saved preference.
Install or enable a compatible version and reload the game to make the toggle available.

**General → Show Item Stats in Skills** chooses one way to inspect the main item artwork on skill cards that offer View Item Stats.
The options are **As top-right corner icon**, **By clicking on item** and **By hovering over item**.
Click is the default, and the selection is saved per character.
The corner option uses the existing stats icon.
Radio choices are indented beneath their setting headings.
These controls apply only to main artwork; recipe Sources and Uses buttons, ingredient navigation and gold-coin Quick Buy actions retain their existing behavior.

Inactive equipment sets remember item references, while only the active set holds real equipped gear.
One owned copy can serve several sets, and switching returns outgoing gear to Bank before equipping the requested layout.
**Copy From** beside the set buttons in Combat and the top-bar equipment menu copies another set's equipment layout into the current set.
The dropdown lists the other set numbers, keeps the current set selected and applies the normal equipment and Bank checks before replacing its layout.
The copy includes all six quick-equip shortcuts for every equipment slot, including hidden extra shortcuts.
A stack shared by both sets carries only its remaining equipped quantity.
Additional or newly produced stock stays in Bank until a manual top-up or a new equip from Bank.
A stack entering the active layout takes its available Bank stock.
When a stack runs out, its reference stays remembered and its active slot becomes empty.
Switching is rejected if a required non-stackable item is unavailable or equipment, area or Bank-capacity restrictions prevent the change.
Migration adds every real inactive copy and stack to Bank, preserving total holdings and active equipped quantities.
When the mod is disabled, active gear and Bank stock remain in the native save, and inactive sets are empty.
Migration requires enough Bank capacity; if it cannot complete, physical holdings are retained and loadout switching is unavailable.
Equipment-set behavior works independently of Enhanced Equipment Menu.
Consumption, depletion and combat stopping use vanilla behavior, including offline progress.
Equipment references add no consumption or offline-progress hooks.
Food, runes, item charges and Golbin Raid retain their native behavior.

**General → Enhanced Equipment Menu** controls the equipment menu changes, defaults to on and is saved per character.
Equipped-item hovers highlight the slot and show stats beside the whole equipment grid: left in the top-bar dropdown and right in Combat.
Leaving the slot closes the hover preview immediately, and the preview cannot intercept clicks.
Opening quick equip highlights its slot until the menu closes and hides the hover preview.
The Bank picker keeps the quick-equip menu centered as it expands.
Disabling it immediately restores the native three shortcuts, Set buttons and popup unequip X while retaining all native and additional shortcut assignments.
With the setting enabled, click an equipment slot in Combat or the top-bar equipment menu to open a three-column quick-equip grid.
**General → Enable 3 Extra Quick Slots** defaults to on and is saved per character.
It adds a second row of three shortcuts for six slots in total.
Disabling it keeps the three native shortcuts and Bank picker while retaining the additional assignments for re-enabling.
The native Set buttons are replaced by a **Bank** chest button beside the shortcuts.
Open it to search bank items that are compatible with the equipment slot and meet their equip requirements.
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
Use Equip selected to equip the selected item through the game's normal equipment checks without assigning a shortcut.
The button is dimmed and disabled when no item is selected or the selected item is unavailable to equip.
Hovering an item temporarily previews its stats; leaving the item restores the selected item's preview or hides the preview when nothing is selected.
**General → Equip button behavior** selects whether a successful Equip selected closes the equip menu, closes just Bank and item stats, or keeps everything open.
The default closes just Bank and item stats while keeping quick equip open, and the choice is saved per character.
Failed equips keep the selection and stats available.
With Keeps everything open selected, equipping preserves the selected item's stats even if the last copy leaves the bank list under the game's normal inventory behavior.
An open picker refreshes after equipment changes while preserving its search and selection and updating stat comparisons, using the native equipment-change event without timers or polling.
Drag an item onto a shortcut to assign or replace it without equipping it.
**General → Equipment Stats Layout** selects **Vanilla** or **Compact**, defaults to Compact and is saved per character.
Both layouts inspect the item beside the picker without opening another dialog.
The setting also applies to skill and equipped-item hover previews, every View Item Stats dialog and total equipment stats.
Skill artwork shows one full stats preview without the inherited stock-count tooltip; the quantity badge retains its stock tooltip.
Vanilla uses the game's three-column View Item Stats format with artwork and descriptions, offensive stats and defensive stats side by side.
Compact uses two columns, with the name, artwork, description, special attacks and requirements on the left and offensive stats above defensive stats on the right.
The preview opens on the left when the right side has no room and above or below the picker on narrow screens, using the available space.
Each preview box fits the width and height of its own content, independently of the bank list.
The viewport limits its maximum size, with scrolling only when necessary.
The inspected item's name appears in the preview header.
Items without available stats retain their name and artwork when present.
Both layouts include complete offensive and defensive tables with zero values and applicable damage resistances.
The inspected item's values and changes from equipped gear occupy separate numeric columns.
Item previews and View Item Stats dialogs share one renderer and comparison logic.
Comparisons use the active equipment set and the picker's equipment slot, including items displaced by two-handed equipment.
Improvements appear green and reductions red, with a lower attack interval treated as an improvement.
For keyboard assignment, focus a bank item and press Space, then focus a target shortcut and press Enter or Space.
Click an assigned shortcut to equip its item through the game's normal equipment checks.
**General → Show Unequip Button on Equipment Icons** defaults to off and is saved per character.
**Unequip Current** always appears beside **Bank** in the enhanced quick-equip popup, regardless of this setting.
For an empty equipment slot, the popup button stays visible but is dimmed and disabled.
Enabling the setting adds a red minus in a red outlined square just outside the equipped item's top-right corner.
The setting only shows or hides these equipment-icon controls.
Both controls use the game's normal unequip checks and preserve shortcut assignments.
There is no shortcut-delete action; dropping another item replaces the assignment.
The first three shortcuts retain their native save data.
The additional three are saved with Better UI character data separately for each equipment set and equipment slot.

## Installation

Load this folder with Melvor's Creator Toolkit, or import `krokys-better-ui-1.1.0.zip` through **Creator Toolkit → Local Mods**.
Enable the mod and reload the game.
The release archive contains `manifest.json`, `setup.mjs`, `page-pinning.mjs`, `wide-layout.mjs`, `better-moving.mjs`, `item-stats.mjs`, `loadout-plan.mjs`, `loadout-transaction.mjs`, `equipment-loadouts.mjs`, `quick-equip.mjs` and `item-sources-and-uses.mjs` at its root.
Ready-to-paste listing text and release notes are in [MOD_IO.md](MOD_IO.md).

## Development checks

Run the dependency-free checks with Node.js:

```powershell
node --test
```
