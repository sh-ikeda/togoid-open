// databases.js
// Parses dataset.yaml (including examples), merges custom DBs from storage,
// applies disabled flags, and exposes getCandidates(text) + loadDatabases().

// ── YAML parser ───────────────────────────────────────────────────────────────
// Handles: top-level keys, 2-space nested keys, lists of objects, inline arrays.

function parseDatasetYaml(src) {
  const lines = src.split("\n");
  const result = {};
  let topKey = null, subKey = null, listKey = null, listItem = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trimStart();

    // Inline array: "    - [a,b,c]"  (indent>=4, starts with "- [")
    if (indent >= 4 && content.startsWith("- [")) {
      const arr = parseInlineArray(content.slice(2).trim());
      if (topKey && subKey && Array.isArray(result[topKey][subKey])) {
        result[topKey][subKey].push(arr);
      }
      continue;
    }

    // List item object: "    - key: value"
    if (indent >= 4 && content.startsWith("- ")) {
      if (listItem && listKey && topKey) result[topKey][listKey].push(listItem);
      listItem = {};
      const rest = content.slice(2), ci = rest.indexOf(":");
      if (ci !== -1) listItem[rest.slice(0, ci).trim()] = unquote(rest.slice(ci + 1).trim());
      continue;
    }

    // Continuation inside list item
    if (indent >= 6 && listItem !== null) {
      const ci = content.indexOf(":");
      if (ci !== -1) listItem[content.slice(0, ci).trim()] = unquote(content.slice(ci + 1).trim());
      continue;
    }

    const ci = content.indexOf(":");
    if (ci === -1) continue;
    const key = content.slice(0, ci).trim();
    const value = unquote(content.slice(ci + 1).trim());

    if (indent === 0) {
      if (listItem && listKey && topKey) { result[topKey][listKey].push(listItem); listItem = null; listKey = null; }
      topKey = key; subKey = null; result[topKey] = {};
    } else if (indent === 2) {
      if (listItem && listKey && topKey) { result[topKey][listKey].push(listItem); listItem = null; }
      subKey = key;
      if (value === "") { result[topKey][key] = []; listKey = key; listItem = null; }
      else { result[topKey][key] = value; listKey = null; }
    }
  }
  if (listItem && listKey && topKey) result[topKey][listKey].push(listItem);
  return result;
}

function parseInlineArray(s) {
  // e.g. '["a","b","c"]' or '[a,b,c]'
  const inner = s.replace(/^\[/, "").replace(/\]$/, "");
  return inner.split(",").map(x => unquote(x.trim()));
}

function unquote(s) {
  return (s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))
    ? s.slice(1, -1) : s;
}

// ── DB loading ────────────────────────────────────────────────────────────────

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
    examples: Array.isArray(entry.examples) ? entry.examples : [],
    isCustom: false
  }));
  return _defaultDbs;
}

// ── ID extraction from named capture groups ───────────────────────────────────

function extractId(match) {
  const groups = match.groups || {};
  if (groups.id !== undefined) return groups.id;
  for (let i = 1; i <= 9; i++) {
    if (groups[`id${i}`] !== undefined) return groups[`id${i}`];
  }
  return match[1] !== undefined ? match[1] : match[0];
}

// ── getCandidates ─────────────────────────────────────────────────────────────
// Returns [{db, prefix, resolvedId}]

async function getCandidates(text) {
  const trimmed = text.trim();
  const [defaultDbs, storage] = await Promise.all([
    loadDatabases(),
    chrome.storage.sync.get(["disabled", "customDbs"])
  ]);

  const disabled  = storage.disabled  || {};
  const customDbs = storage.customDbs || [];

  const allDbs = [
    ...defaultDbs,
    ...customDbs.map(d => ({ ...d, regex: new RegExp(d.regexStr), isCustom: true, examples: d.examples || [] }))
  ];

  const results = [];
  for (const db of allDbs) {
    if (disabled[db.key]) continue;
    const match = trimmed.match(db.regex);
    if (!match) continue;
    const resolvedId = extractId(match);
    for (const prefix of db.prefix) {
      if (disabled[`${db.key}__${prefix.label}`]) continue;
      results.push({ db, prefix, resolvedId });
    }
  }
  return results;
}

// ── getAllDbs: for browser/search UI ─────────────────────────────────────────
// Returns all DBs (default + custom), with disabled flag applied at DB level only.

async function getAllDbs() {
  const [defaultDbs, storage] = await Promise.all([
    loadDatabases(),
    chrome.storage.sync.get(["disabled", "customDbs"])
  ]);
  const disabled  = storage.disabled  || {};
  const customDbs = storage.customDbs || [];

  return [
    ...defaultDbs,
    ...customDbs.map(d => ({ ...d, regex: new RegExp(d.regexStr), isCustom: true, examples: d.examples || [] }))
  ].filter(db => !disabled[db.key]);
}
