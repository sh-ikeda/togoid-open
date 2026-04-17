// databases.js
// Loads dataset.yaml at runtime and exposes getCandidates(text).
// Compatible with both Service Worker (background.js) and content script contexts.

// ── Minimal YAML parser (subset sufficient for dataset.yaml) ─────────────────

function parseDatasetYaml(src) {
  const lines = src.split("\n");
  const result = {};
  let currentTopKey = null;
  let currentListKey = null;
  let currentListItem = null;

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.trimStart().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const content = line.trimStart();

    // List item "  - key: value"
    if (content.startsWith("- ")) {
      if (currentListItem && currentListKey && currentTopKey) {
        result[currentTopKey][currentListKey].push(currentListItem);
      }
      currentListItem = {};
      const rest = content.slice(2);
      const ci = rest.indexOf(":");
      if (ci !== -1) {
        currentListItem[rest.slice(0, ci).trim()] = unquote(rest.slice(ci + 1).trim());
      }
      continue;
    }

    const ci = content.indexOf(":");
    if (ci === -1) continue;
    const key = content.slice(0, ci).trim();
    const value = unquote(content.slice(ci + 1).trim());

    if (indent === 0) {
      if (currentListItem && currentListKey && currentTopKey) {
        result[currentTopKey][currentListKey].push(currentListItem);
        currentListItem = null; currentListKey = null;
      }
      currentTopKey = key;
      result[currentTopKey] = {};
    } else if (indent === 2) {
      if (currentListItem && currentListKey && currentTopKey) {
        result[currentTopKey][currentListKey].push(currentListItem);
        currentListItem = null;
      }
      if (value === "") {
        result[currentTopKey][key] = [];
        currentListKey = key;
      } else {
        result[currentTopKey][key] = value;
        currentListKey = null;
      }
    } else if (indent >= 4 && currentListItem !== null) {
      // continuation key inside a list item
      currentListItem[key] = value;
    }
  }
  if (currentListItem && currentListKey && currentTopKey) {
    result[currentTopKey][currentListKey].push(currentListItem);
  }
  return result;
}

function unquote(s) {
  if ((s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

// ── Database loading ──────────────────────────────────────────────────────────

let _databases = null;

async function loadDatabases() {
  if (_databases) return _databases;
  const url = chrome.runtime.getURL("dataset.yaml");
  const res = await fetch(url);
  const text = await res.text();
  const parsed = parseDatasetYaml(text);
  _databases = Object.entries(parsed).map(([key, entry]) => ({
    key,
    label: entry.label,
    regex: new RegExp(entry.regex),
    prefix: Array.isArray(entry.prefix) ? entry.prefix : []
  }));
  return _databases;
}

async function getCandidates(text) {
  const dbs = await loadDatabases();
  const trimmed = text.trim();
  const results = [];
  for (const db of dbs) {
    if (db.regex.test(trimmed)) {
      for (const prefix of db.prefix) {
        results.push({ db, prefix });
      }
    }
  }
  return results;
}
