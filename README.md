# Kroky's Better UI

Version: **1.1.0**.

Page header pinning, responsive desktop card grids, up to six quick-equip slots and optional recipe item sources and uses for Melvor Idle, including Kroky's Workforce layouts when installed.
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
Narrow screens retain the game's native Bank layout.

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
These controls apply only to main artwork; recipe Sources and Uses buttons, ingredient navigation and gold-coin Quick Buy actions retain their existing behavior.

**General → Enhanced Equipment Menu** controls the equipment menu changes, defaults to on and is saved per character.
Disabling it immediately restores the native three shortcuts, Set buttons and popup unequip X while retaining all native and additional shortcut assignments.
With the setting enabled, click an equipment slot in Combat or the top-bar equipment menu to open a three-column quick-equip grid.
**General → Enable 3 Extra Quick Slots** defaults to on and is saved per character.
It adds a second row of three shortcuts for six slots in total.
Disabling it keeps the three native shortcuts and Bank picker while retaining the additional assignments for re-enabling.
The native Set buttons are replaced by a **Bank** chest button beside the shortcuts.
Open it to search bank items that are compatible with the equipment slot and meet their equip requirements.
Drag an item onto a shortcut to assign or replace it without equipping it.
Click a bank item to inspect it in a preview beside the picker.
The preview opens on the left when the right side has no room, while narrow screens place it below the picker.
The selected item's name appears below Search Bank and above the item grid.
Items without available stats show only their name.
**General → Show Item Stats in Equipment** selects **By clicking on item** or **By hovering over item** for the preview.
Click is the default, and the selection is saved per character.
Inspecting an item does not assign or equip it.
For keyboard assignment, focus a bank item and press Space, then focus a target shortcut and press Enter or Space.
Click an assigned shortcut to equip its item through the game's normal equipment checks.
The **X** just outside the equipped item's top-right corner unequips the item through the native action.
There is no shortcut-delete action; dropping another item replaces the assignment.
The first three shortcuts retain their native save data.
The additional three are saved with Better UI character data separately for each equipment set and equipment slot.

## Installation

Load this folder with Melvor's Creator Toolkit, or import `krokys-better-ui-1.1.0.zip` through **Creator Toolkit → Local Mods**.
Enable the mod and reload the game.
The release archive contains `manifest.json`, `setup.mjs`, `page-pinning.mjs`, `wide-layout.mjs`, `item-stats.mjs`, `quick-equip.mjs` and `item-sources-and-uses.mjs` at its root.
Ready-to-paste listing text and release notes are in [MOD_IO.md](MOD_IO.md).

## Development checks

Run the dependency-free checks with Node.js:

```powershell
node --test
```
