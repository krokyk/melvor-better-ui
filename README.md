# Kroky's Better UI

Version: **1.1.0**.

Page header pinning, responsive desktop card grids and optional recipe item sources and uses for Melvor Idle, including Kroky's Workforce layouts when installed.
The mod works independently of Workforce.

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

Open **Mod Settings → Kroky's Better UI → General → Show Sources and Uses on Recipe Icons** to add a small blue **?** to item output and ingredient icons on native and Workforce skill cards.
The setting defaults to off and is saved per character.
Clicking **?** opens the item's dialog from [Show Item Sources And Uses](https://mod.io/g/melvoridle/m/show-item-sources-and-uses); ordinary icon clicks keep their existing behavior.
Ingredients with a gold shop-coin overlay keep Quick Buy without a **?**.
Currencies, XP and spell artwork without a specific item do not receive a **?**.
Sources and uses are calculated only when clicked.
This integration is optional and does not add a hard dependency.
If Show Item Sources And Uses is missing, disabled or lacks the required API, the toggle is disabled with an explanation while retaining your saved preference.
Install or enable a compatible version and reload the game to make the toggle available.

## Installation

Load this folder with Melvor's Creator Toolkit, or import `krokys-better-ui-1.1.0.zip` through **Creator Toolkit → Local Mods**.
Enable the mod and reload the game.
The release archive contains `manifest.json`, `setup.mjs`, `page-pinning.mjs`, `wide-layout.mjs` and `item-sources-and-uses.mjs` at its root.
Ready-to-paste listing text and release notes are in [MOD_IO.md](MOD_IO.md).

## Development checks

Run the dependency-free checks with Node.js:

```powershell
node --test
```
