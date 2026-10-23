# mod.io listing

## Name

Kroky's Better UI

## Summary

Keep page headers and controls visible while scrolling, with optional pinning across the game.

## Description

**Kroky's Better UI** adds a **Pin / Unpin** button to the main page header.
Keep skill statistics, equipment, realm selectors and category controls visible while scrolling through cards.
One shared pin choice follows you across skills, Combat, Bank, Shop, Settings, Farming and Township.

The pinned stack uses at most half the screen height and scrolls internally when necessary.
Combat's native XP table stays connected, and dropdown menus remain accessible outside scrolling sections.
On desktop, the pinned Bank joins its top controls seamlessly to the fixed item-details sidebar on the right while the inventory scrolls independently on the left.
Tall item details scroll within the sidebar so every item action remains accessible.
Narrow screens retain the game's native Bank layout.

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

- Pin page headers and controls across skills, Combat, Bank, Shop, Settings, Farming and Township.
- Enable or disable page pinning in mod settings while retaining the browser's pin preference.
- Restore existing Workforce pin preferences automatically.
- Keep pinned content within half the viewport height and retain native Combat and dropdown behavior.
- Keep the Bank's item-details sidebar stationary while its inventory scrolls independently on desktop.

## Upload

Upload **krokys-better-ui-1.0.0.zip** with `manifest.json`, `setup.mjs` and `page-pinning.mjs` at the archive root.
