// databases.js
// Loads dataset.yaml + customDbs from storage, applies disabled flags,
// and exposes getCandidates(text).
// Runs in both Service Worker and content script contexts.

// ── Minimal YAML parser ───────────────────────────────────────────────────────

function parseDatasetYaml(src) {
  const lines = src.split("\n");
  const result = {};
  let topKey = null, listKey = null, listItem = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trimStart();

    if (content.startsWith("- ")) {
      if (listItem && listKey && topKey) result[topKey][listKey].push(listItem);
      listItem = {};
      const rest = content.slice(2), ci = rest.indexOf(":");
      if (ci !== -1) listItem[rest.slice(0, ci).trim()] = unquote(rest.slice(ci + 1).trim());
      continue;
    }
    const ci = content.indexOf(":");
    if (ci === -1) continue;
    const key = content.slice(0, ci).trim();
    const value = unquote(content.slice(ci + 1).trim());

    if (indent === 0) {
      if (listItem && listKey && topKey) { result[topKey][listKey].push(listItem); listItem = null; listKey = null; }
      topKey = key; result[topKey] = {};
    } else if (indent === 2) {
      if (listItem && listKey && topKey) { result[topKey][listKey].push(listItem); listItem = null; }
      if (value === "") { result[topKey][key] = []; listKey = key; }
      else { result[topKey][key] = value; listKey = null; }
    } else if (indent >= 4 && listItem !== null) {
      listItem[key] = value;
    }
  }
  if (listItem && listKey && topKey) result[topKey][listKey].push(listItem);
  return result;
}

function unquote(s) {
  return (s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))
    ? s.slice(1, -1) : s;
}

// ── Default DB loading (from dataset.yaml) ────────────────────────────────────

let _defaultDbs = null;

async function loadDatabases() {
  if (_defaultDbs) return _defaultDbs;
  const url = chrome.runtime.getURL("dataset.yaml");
  const text = await fetch(url).then(r => r.text());
  const parsed = parseDatasetYaml(text);
  _defaultDbs = Object.entries(parsed).map(([key, entry]) => ({
    key,
    label: entry.label,
    regex: new RegExp(entry.regex),
    regexStr: entry.regex,
    prefix: Array.isArray(entry.prefix) ? entry.prefix : [],
    isCustom: false
  }));
  return _defaultDbs;
}

// ── getCandidates: merges default + custom, applies disabled flags ─────────────

async function getCandidates(text) {
  const trimmed = text.trim();
  const [defaultDbs, storage] = await Promise.all([
    loadDatabases(),
    chrome.storage.sync.get(["disabled", "customDbs"])
  ]);

  const disabled   = storage.disabled   || {};
  const customDbs  = storage.customDbs  || [];

  const allDbs = [
    ...defaultDbs,
    ...customDbs.map(d => ({
      ...d,
      regex: new RegExp(d.regexStr),
      isCustom: true
    }))
  ];

  const results = [];
  for (const db of allDbs) {
    if (disabled[db.key]) continue;          // entire DB disabled
    if (!db.regex.test(trimmed)) continue;
    for (const prefix of db.prefix) {
      const prefixKey = `${db.key}__${prefix.label}`;
      if (disabled[prefixKey]) continue;     // this prefix disabled
      results.push({ db, prefix });
    }
  }
  return results;
}
