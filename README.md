# TogoID Open — Chrome Extension

> 日本語版: [README.ja.md](README.ja.md)

A Chrome extension for working with life science database IDs directly on any webpage. Press a single hotkey to either open a database record for a selected ID, or browse example IDs across hundreds of databases.

## Features

- **Open selected** — Select an ID on any page and open the corresponding database record in a new tab. Supports hundreds of databases via pattern matching. When multiple URL destinations exist for a database, the top one opens with a single click; others are reachable via a "More" toggle.
- **Show examples** — Browse databases by name, view example IDs, copy them to the clipboard, or open their records directly. Recently used databases are surfaced at the top.
- Both features are available as tabs in a single popup window triggered by one hotkey.

## Installation

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `togoid-open/` folder

## Usage

### Hotkey: `Alt+Shift+O`

- **Text selected** → popup opens on the **Open selected** tab, near the selection
- **No text selected** → popup opens on the **Show examples** tab, centered near the top of the viewport
- Press the hotkey again (or press `Esc`, or click outside) to close

### Open selected tab

1. Select an ID on the page (e.g. `CHEMBL121649`, `GO:0005643`, `3PFQ`)
2. Press `Alt+Shift+O` — or switch to this tab manually and type/paste an ID
3. Matching databases are listed as clickable rows
   - Single URL prefix → click the row to open
   - Multiple URL prefixes → row opens the first prefix; click **More ▾** to expand the rest

### Show examples tab

1. Type to search for a database (or pick one from **Recent** / **All**)
2. Click a database name to see its example IDs
3. Each ID has a **Copy** button and an **Open URL** button
   - If the database has multiple URL prefixes, choose one from the dropdown in the toolbar
   - Multiple ID series (e.g. upper/lowercase PDB IDs) are shown as collapsible sections
4. Click **← Back** to return to the database list

### Changing the hotkey

Open `chrome://extensions/shortcuts` and find **TogoID Open**.

## ID → URL resolution

Named capture groups in each database's regex determine which part of the ID is appended to the URI prefix:

| Regex pattern | Example input | Resolved ID |
|---------------|--------------|-------------|
| `(?<id>\d{7})` | `GO:0005643` | `0005643` |
| `(?<id1>…)\|(?<id2>…)` | `P12345` | first matching group |
| `([0-9][A-Za-z0-9]{3})` | `3PFQ` | `3PFQ` (group 1) |

## Database definition files

| File | Origin | Notes |
|------|--------|-------|
| `dataset.yaml` | TogoID project | External; do not edit manually |
| `dataset-local.yaml` | TogoID Open | Local additions (TogoID, EBI OLS, …) |

User customisations (added/disabled databases and prefixes) are stored in `chrome.storage.sync` and merged at runtime — neither YAML file is modified.

To add a database to `dataset-local.yaml`:

```yaml
my_db:
  label: My Database
  regex: '^(?<id>PREFIX\d+)$'
  prefix:
    - label: main
      uri: 'https://example.com/record/'
  examples:
    - ["PREFIX001", "PREFIX002", "PREFIX003"]
```

## Options page

Right-click the extension icon → **Options** (or navigate to the options page from `chrome://extensions/`).

| Feature | Description |
|---------|-------------|
| Database list | Collapsible; filter by name or key |
| Enable / disable | Per-database and per-prefix checkboxes |
| Add prefix | **＋ prefix** button on each default DB card |
| Add database | Form at the bottom of the Databases tab |
| Edit / Delete | Available on custom DB cards |
| Language | EN / JA toggle in the sidebar |
| Hotkey | Link to `chrome://extensions/shortcuts` |

## File structure

| File | Role |
|------|------|
| `manifest.json` | Extension config (permissions, hotkey, options page) |
| `dataset.yaml` | Default database definitions (TogoID project) |
| `dataset-local.yaml` | Additional databases specific to TogoID Open |
| `databases.js` | YAML loader, named-capture URL resolution, candidate filtering |
| `background.js` | Service worker: hotkey dispatch, content script injection |
| `content.js` | Unified tabbed popup (Open selected + Show examples) |
| `options.html/css/js` | Options page |
| `i18n.js` | EN/JA string table for the options page |
| `CHANGELOG.md` | Version history |
