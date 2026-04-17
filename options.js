// options.js
// Manages the options page UI and persists settings to chrome.storage.sync.
//
// Storage schema:
//   "disabled":      { "<dbKey>": true, "<dbKey>__<prefixLabel>": true, ... }
//                    Keys present and true = excluded from popup
//   "customDbs":     [ { key, label, regex, prefix:[{label,uri}] }, ... ]

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    item.classList.add("active");
    document.getElementById("tab-" + item.dataset.tab).classList.add("active");
  });
});

// ── Hotkey page ───────────────────────────────────────────────────────────────

document.getElementById("open-shortcuts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// ── Database list ─────────────────────────────────────────────────────────────

async function renderDbList() {
  const [defaultDbs, { disabled = {}, customDbs = [] }] = await Promise.all([
    loadDatabases(),
    chrome.storage.sync.get(["disabled", "customDbs"])
  ]);

  const allDbs = [
    ...defaultDbs.map(db => ({ ...db, isCustom: false })),
    ...customDbs.map(db => ({
      ...db,
      regex: new RegExp(db.regexStr),
      isCustom: true
    }))
  ];

  const container = document.getElementById("db-list");
  container.innerHTML = "";

  for (const db of allDbs) {
    const dbDisabled = !!disabled[db.key];
    const card = document.createElement("div");
    card.className = "db-card";

    // Header row
    const hdr = document.createElement("div");
    hdr.className = "db-card-header";

    const dbCb = checkbox(!dbDisabled, async (checked) => {
      await setDisabled(db.key, !checked);
      // Also visually toggle prefix checkboxes
      card.querySelectorAll(".prefix-item input[type=checkbox]").forEach(c => {
        c.disabled = !checked;
        if (!checked) c.checked = false;
      });
    });

    const nameEl = document.createElement("span");
    nameEl.className = "db-name";
    nameEl.textContent = db.label;

    const keyEl = document.createElement("span");
    keyEl.className = "db-key";
    keyEl.textContent = db.key;

    const regexEl = document.createElement("span");
    regexEl.className = "db-regex";
    regexEl.textContent = db.regex.toString();

    hdr.append(dbCb, nameEl, keyEl, regexEl);

    if (db.isCustom) {
      const badge = document.createElement("span");
      badge.className = "badge-custom";
      badge.textContent = "カスタム";
      hdr.appendChild(badge);

      const delBtn = document.createElement("button");
      delBtn.className = "btn-delete";
      delBtn.textContent = "削除";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`"${db.label}" を削除しますか？`)) return;
        const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
        await chrome.storage.sync.set({ customDbs: cur.filter(d => d.key !== db.key) });
        renderDbList();
      });
      hdr.appendChild(delBtn);
    }

    card.appendChild(hdr);

    // Prefix list
    if (db.prefix && db.prefix.length > 0) {
      const pl = document.createElement("div");
      pl.className = "prefix-list";
      for (const p of db.prefix) {
        const storageKey = `${db.key}__${p.label}`;
        const prefixDisabled = !!disabled[storageKey] || dbDisabled;
        const pi = document.createElement("div");
        pi.className = "prefix-item";

        const pcb = checkbox(!prefixDisabled, async (checked) => {
          await setDisabled(storageKey, !checked);
        });
        pcb.disabled = dbDisabled;

        const lbl = document.createElement("span");
        lbl.className = "prefix-label";
        lbl.textContent = p.label;

        const uri = document.createElement("span");
        uri.className = "prefix-uri";
        uri.textContent = p.uri;

        pi.append(pcb, lbl, uri);
        pl.appendChild(pi);
      }
      card.appendChild(pl);
    }

    container.appendChild(card);
  }
}

function checkbox(checked, onChange) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => onChange(cb.checked));
  return cb;
}

async function setDisabled(key, isDisabled) {
  const { disabled = {} } = await chrome.storage.sync.get("disabled");
  if (isDisabled) {
    disabled[key] = true;
  } else {
    delete disabled[key];
  }
  await chrome.storage.sync.set({ disabled });
}

// ── Add database form ─────────────────────────────────────────────────────────

document.getElementById("btn-add-prefix-row").addEventListener("click", () => {
  addPrefixInputRow();
});

// Allow removing dynamically added prefix rows
document.getElementById("new-prefixes").addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-prefix")) {
    const rows = document.querySelectorAll("#new-prefixes .prefix-row-input");
    if (rows.length > 1) {
      e.target.closest(".prefix-row-input").remove();
    }
  }
});

function addPrefixInputRow() {
  const row = document.createElement("div");
  row.className = "prefix-row-input";
  row.innerHTML = `
    <input type="text" class="pi-label" placeholder="ラベル（例: rdf）">
    <input type="text" class="pi-uri" placeholder="URI プレフィックス（例: https://example.com/）">
    <button class="btn-icon remove-prefix" title="削除">×</button>
  `;
  document.getElementById("new-prefixes").appendChild(row);
}

document.getElementById("btn-add-db").addEventListener("click", async () => {
  const errEl = document.getElementById("add-error");
  errEl.textContent = "";

  const key     = document.getElementById("new-key").value.trim();
  const label   = document.getElementById("new-label").value.trim();
  const regexStr = document.getElementById("new-regex").value.trim();

  // Validation
  if (!key)   { errEl.textContent = "キーを入力してください。"; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(key)) { errEl.textContent = "キーは英数字とアンダースコアのみ使用できます。"; return; }
  if (!label) { errEl.textContent = "表示名を入力してください。"; return; }
  if (!regexStr) { errEl.textContent = "正規表現を入力してください。"; return; }
  try { new RegExp(regexStr); } catch { errEl.textContent = "正規表現が不正です。"; return; }

  const prefixRows = document.querySelectorAll("#new-prefixes .prefix-row-input");
  const prefix = [];
  for (const row of prefixRows) {
    const l = row.querySelector(".pi-label").value.trim();
    const u = row.querySelector(".pi-uri").value.trim();
    if (l || u) {
      if (!l || !u) { errEl.textContent = "prefix のラベルと URI を両方入力してください。"; return; }
      prefix.push({ label: l, uri: u });
    }
  }
  if (prefix.length === 0) { errEl.textContent = "prefix を 1 つ以上追加してください。"; return; }

  // Check duplicate key
  const [defaultDbs, { customDbs: cur = [] }] = await Promise.all([
    loadDatabases(),
    chrome.storage.sync.get("customDbs")
  ]);
  if ([...defaultDbs, ...cur].some(d => d.key === key)) {
    errEl.textContent = `キー "${key}" は既に使用されています。`;
    return;
  }

  const newDb = { key, label, regexStr, prefix };
  await chrome.storage.sync.set({ customDbs: [...cur, newDb] });

  // Clear form
  document.getElementById("new-key").value = "";
  document.getElementById("new-label").value = "";
  document.getElementById("new-regex").value = "";
  document.getElementById("new-prefixes").innerHTML = `
    <div class="prefix-row-input">
      <input type="text" class="pi-label" placeholder="ラベル（例: rdf）">
      <input type="text" class="pi-uri" placeholder="URI プレフィックス（例: https://example.com/）">
      <button class="btn-icon remove-prefix" title="削除">×</button>
    </div>
  `;

  renderDbList();
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderDbList();
