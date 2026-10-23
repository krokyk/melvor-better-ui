# mod.io listing

## Name

Kroky's Better UI

## Summary

Keep headers visible while scrolling and fit more readable cards across wide desktop screens.

## Description

**Kroky's Better UI** adds a thumbtack button to pin or unpin the main page header.
Keep skill statistics, equipment, realm selectors and category controls visible while scrolling through cards.
One shared pin choice follows you across skills, Combat, Bank, Shop, Settings, Farming and Township.

The pinned stack uses at most half the screen height and scrolls internally when necessary.
Combat's native XP table stays connected, and dropdown menus remain accessible outside scrolling sections.
Pinned skill level, XP, enhancement icons and the native skill-tree control share a dark section beside the thumbtack.
Those groups wrap within the section on smaller screens.
Enhancements show their names and effects on hover or keyboard focus.
Mastery progress and its View Checkpoints and Spend Mastery Pool XP buttons stay below the main bar.
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

Open **Mod Settings → Kroky's Better UI → General → Enable Page Pinning** to enable or disable the feature.
The toggle defaults to on.
Disabling it hides the button and restores the normal layout while retaining your pin preference.

The pin choice starts unpinned for new users and is remembered in this browser on this device.
Existing Workforce pin preferences migrate automatically.
The mod works independently of Workforce and also pins Workforce's controls and activity summaries when installed.

## Version

1.0.0

## Changelog

### 1.0.0

- Pin page headers and controls with an icon-only thumbtack across skills, Combat, Bank, Shop, Settings, Farming and Township.
- Enable or disable page pinning in mod settings while retaining the browser's pin preference.
- Restore existing Workforce pin preferences automatically.
- Keep pinned content within half the viewport height and retain native Combat and dropdown behavior.
- Keep the desktop Bank's labelled totals, compact toolbar, wrapping tabs and full-height inventory and details panels.
- Use an independent wide-layout toggle and bounded card widths for supported desktop grids.
- Group native skill stats, enhancement icons and skill trees in the top bar while keeping mastery below it.
- Preserve enhancement tooltip contents and pin optional Skill Boosts controls, including on Combat.

## Upload

Upload **krokys-better-ui-1.0.0.zip** with `manifest.json`, `setup.mjs`, `page-pinning.mjs` and `wide-layout.mjs` at the archive root.
