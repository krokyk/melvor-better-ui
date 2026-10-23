# Kroky's Better UI

Version: **1.0.0**.

Page header pinning and responsive desktop card grids for Melvor Idle, including Kroky's Workforce layouts when installed.
The mod works independently of Workforce.

Open **Mod Settings → Kroky's Better UI → General → Enable Page Pinning** to enable or disable the feature.
The setting defaults to on and is saved per character.
Disabling it hides the Pin / Unpin button and restores the normal layout immediately while retaining the pin preference.

Use **Pin** in the main page header to keep the header and controls visible while scrolling.
Use **Unpin** to restore the normal layout.
The choice applies across skills, Combat, Bank, Shop, Settings, Farming and Township, and is remembered in this browser on this device.
New users start unpinned.
Existing Workforce pin preferences migrate automatically without changing the original values.

The pinned stack uses at most half the viewport height and scrolls internally when necessary.
Combat's native XP table stays connected, and dropdown menus remain accessible outside scrolling sections.
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

## Installation

Load this folder with Melvor's Creator Toolkit, or import `krokys-better-ui-1.0.0.zip` through **Creator Toolkit → Local Mods**.
Enable the mod and reload the game.
The release archive contains `manifest.json`, `setup.mjs`, `page-pinning.mjs` and `wide-layout.mjs` at its root.
Ready-to-paste listing text and release notes are in [MOD_IO.md](MOD_IO.md).

## Development checks

Run the dependency-free checks with Node.js:

```powershell
node --test
```
