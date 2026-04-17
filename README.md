# TogoID Open — Chrome Extension

> 日本語版: [README.ja.md](README.ja.md)

A Chrome extension that opens life science database record pages by selecting an ID on any webpage.

## Installation

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `togoid-open/` folder

## Usage

### Hotkey: `Alt+Shift+O`

**When text is selected on the page:**
1. Select an ID (e.g. `CHEMBL121649`, `GO:0005643`, `3PFQ`)
2. Press `Alt+Shift+O`
3. A popup appears near the selection
   - Single candidate → click to open directly
   - Multiple prefixes for a DB → click `▶ DB name (N)` to expand, then choose

**When no text is selected:**
1. Press `Alt+Shift+O`
2. A database browser popup appears
3. Type to search for a database, then click it
4. Example IDs are listed with **Copy** and **Open URL** buttons
   - Multiple ID series → accordion; click the header to expand
   - If a DB has multiple URL prefixes, a chooser appears on **Open URL**

Press `Esc` or click outside to dismiss any popup.

### Hotkey configuration
Go to `chrome://extensions/shortcuts` to change the hotkey.

## ID → URL resolution

Named capture groups in the regex determine what gets appended to the URI prefix:

| Pattern | Example input | Resolved ID |
|---------|--------------|-------------|
| `(?<id>\d{7})` | `GO:0005643` | `0005643` |
| `(?<id1>…)\|(?<id2>…)` | `P12345` | first matching group |
| `([0-9][A-Za-z0-9]{3})` | `3PFQ` | `3PFQ` (group 1) |

## Adding databases

Edit `dataset.yaml` to add default databases. User customisations are stored separately in `chrome.storage.sync` and merged at runtime — the default file is never modified.

```yaml
chebi:
  label: ChEBI
  regex: '^CHEBI:(?<id>\d+)$'
  prefix:
    - label: EBI
      uri: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:'
  examples:
    - ["CHEBI:15422","CHEBI:17234","CHEBI:16541"]
```

## Options page

Right-click the extension icon → **Options**.

| Feature | Description |
|---------|-------------|
| Database list | Collapsible; search by name or key |
| Enable/disable | Checkbox per DB and per prefix |
| Add prefix | `＋ prefix` button on each default DB card |
| Add database | Form at the bottom of the Databases tab |
| Edit / Delete | Available on custom DB cards |
| Language | EN / JA toggle in the sidebar |
| Hotkey | Link to `chrome://extensions/shortcuts` |

## File structure

| File | Role |
|------|------|
| `manifest.json` | Extension config (permissions, hotkey, options page) |
| `dataset.yaml` | Default database definitions |
| `databases.js` | YAML loader, named-capture URL resolution, candidate filtering |
| `background.js` | Service worker: hotkey dispatch, content script injection |
| `content.js` | Open popup & browser popup UI |
| `options.html/css/js` | Options page |
| `i18n.js` | EN/JA string table for the options page |
