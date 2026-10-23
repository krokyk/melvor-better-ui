# Kroky's Better UI

Page header pinning for Melvor Idle, including skill statistics, equipment, realm and category controls, and Kroky's Workforce activity summaries when installed.
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

## Installation

Load this folder with Melvor's Creator Toolkit, or package `manifest.json`, `setup.mjs` and `page-pinning.mjs` at the root of a mod archive.

## Development checks

Run the dependency-free checks with Node.js:

```powershell
node --test
```
