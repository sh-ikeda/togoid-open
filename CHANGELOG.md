# Changelog

All notable changes to TogoID Open are documented here.

---

## v1.10.0
- Unified **Open selected** and **Show examples** into a single tabbed popup window
- Single hotkey (`Alt+Shift+O`) now opens the appropriate tab based on whether text is selected
- Header simplified to title only; ID input field moved into the Open selected tab body
- Updated `manifest.json` description to mention both features
- Updated README (EN/JA) to reflect current functionality

## v1.9.0
- Renamed `dataset-togoid.yaml` → `dataset-local.yaml` to clarify that `dataset.yaml` originates from the TogoID project
- Added **EBI OLS** (`ols`) entry to `dataset-local.yaml`
- Split hotkey into two independent commands: `open-selected` (`Alt+Shift+O`) and `show-examples` (`Alt+Shift+I`)
- **Open selected**: pressing the hotkey when no text is selected now opens the popup with an empty input field
- **Show examples**: pressing the hotkey when the popup is already open now closes it (toggle behaviour)
- Added toggle-close behaviour for both hotkeys
- Updated options page hotkey tab to list both commands

## v1.8.0
- Renamed `dataset-togoid.yaml` → `dataset-local.yaml` (preparation; later finalised in v1.9.0)
- Split hotkey commands into `open-selected` and `show-examples` (`Ctrl+Alt+I` at this stage)
- **Open selected**: header ID badge made editable; candidate list updates dynamically as user types (120 ms debounce)
- **Show examples**: database list split into **Recent** (up to 3, persisted in `chrome.storage.local`) and **All** sections

## v1.7.0
- **Show examples**: replaced per-row inline prefix chooser with a dropdown selector in the toolbar (defaults to first prefix)
- **Show examples**: popup repositioned to upper-centre of viewport (previously vertically centred); body is now scrollable
- Added arrow overlay to extension icons (16/48/128 px) indicating "open in new tab"
- Icon background made transparent by removing near-black pixels

## v1.6.0
- Added `dataset-local.yaml` alongside `dataset.yaml` for TogoID Open–specific database entries
- Added **TogoID** (`togoid`) entry: `https://togoid.dbcls.jp/?ids=`
- `loadDatabases()` now loads and merges both YAML files in parallel

## v1.5.0
- **Open selected**: prefix groups with multiple URLs now show the first URL as a direct-click row; remaining URLs revealed via a **More ▾** / **Less ▴** toggle
- **Show examples** feature introduced: browse databases, view example IDs, copy to clipboard, open URLs
  - Single ID series: flat list; multiple series: accordion with first ID as header
  - Per-row **Copy** and **Open URL** buttons
- Hotkey now dispatches `show-popup` (text selected) or `show-browser` (no selection) from background script
- `databases.js`: added `getAllDbs()` and `examples` field parsing from YAML inline arrays

## v1.4.0
- Icon updated to use uploaded logo image (transparent background, 16/48/128 px)
- Color scheme changed from dark/black to light teal (`#1ab3c8` / `#00838f`) throughout popup and options page
- **Open selected** popup now appears near the selected text (`getBoundingClientRect`) rather than at screen centre
- Options page: database list made collapsible with a search/filter bar (partial match on name and key)
- Options page: **＋ prefix** button added to each default database card for inline prefix addition
- Options page: **Edit** button added to custom database cards (modal editor for label, regex, prefixes)
- Options page: EN / JA language toggle added to sidebar (persisted in `localStorage`)
- `i18n.js` introduced with full EN/JA string tables for the options page
- `dataset.yaml`: `examples` field added (inline array syntax)

## v1.3.0
- Named capture groups (`(?<id>…)`, `(?<id1>…)`, `(?<id2>…)`, …) now used for URL construction
  - The captured ID portion (not the full matched string) is appended to the URI prefix
  - Fallback: first capture group, then full match
- `extractId()` helper added to `databases.js`
- Icon regenerated with transparent background

## v1.2.0
- Options page added (`options.html/css/js`) with database management and hotkey link
  - Collapsible database list with per-DB and per-prefix enable/disable checkboxes
  - Custom database addition form (key, label, regex, prefixes)
  - Custom database deletion
  - Link to `chrome://extensions/shortcuts` for hotkey configuration
- `chrome.storage.sync` used to persist disabled flags and custom databases
- `databases.js` now reads disabled/custom settings from storage when building candidates
- `manifest.json`: added `storage` permission and `options_ui`

## v1.1.0
- `dataset.yaml` introduced as external database definition file (replaces inline JS)
- Minimal YAML parser implemented in `databases.js` (supports nested keys, object lists, inline arrays)
- `databases.js` and `content.js` registered as `web_accessible_resources` so `fetch()` can load the YAML
- Context menu removed (Chrome's one-level submenu limitation made it impractical)
- Hotkey-only trigger retained (`Alt+Shift+O`)
- Fixed "Could not establish connection" error: `background.js` now uses `chrome.scripting.executeScript` to inject content scripts on demand, with a double-injection guard (`window.__togoIdLoaded`) in `content.js`

## v1.0.0
- Initial release
- **Open selected**: select a database ID on any page and open the corresponding record
  - ID pattern matched against hardcoded database definitions in `databases.js`
  - Multiple matching databases presented as a flat list in a popup
- Hotkey trigger (`Alt+Shift+O`) and right-click context menu
- Popup appears at screen centre
- Three databases defined: ChEMBL compound, ChEMBL target, PDB (PDBj / RCSB PDB / PDBe)
