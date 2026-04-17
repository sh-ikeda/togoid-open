// options.js

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    item.classList.add("active");
    document.getElementById("tab-" + item.dataset.tab).classList.add("active");
  });
});

// ── Hotkey ────────────────────────────────────────────────────────────────────
document.getElementById("open-shortcuts").addEventListener("click", e => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// ── Collapsible DB list ───────────────────────────────────────────────────────
let dbListOpen = false;
document.getElementById("db-toggle").addEventListener("click", () => {
  dbListOpen = !dbListOpen;
  document.getElementById("db-list-inner").style.display = dbListOpen ? "block" : "none";
  document.getElementById("db-toggle-arrow").classList.toggle("open", dbListOpen);
  document.getElementById("db-toggle-label").textContent =
    dbListOpen ? "データベース一覧を隠す" : "データベース一覧を表示";
});

// ── Search / filter ───────────────────────────────────────────────────────────
document.getElementById("db-search").addEventListener("input", filterCards);

function filterCards() {
  const q = document.getElementById("db-search").value.trim().toLowerCase();
  const cards = document.querySelectorAll("#db-cards .db-card");
  let shown = 0;
  cards.forEach(card => {
    const text = card.dataset.searchText || "";
    const match = !q || text.includes(q);
    card.style.display = match ? "" : "none";
    if (match) shown++;
  });
  const total = cards.length;
  document.getElementById("search-count").textContent =
    q ? `${shown} / ${total} 件` : `${total} 件`;
}

// ── Render DB list ────────────────────────────────────────────────────────────
async function renderDbList() {
  const [defaultDbs, { disabled = {}, customDbs = [] }] =
    await Promise.all([loadDatabases(), chrome.storage.sync.get(["disabled", "customDbs"])]);

  const allDbs = [
    ...defaultDbs.map(db => ({ ...db, isCustom: false })),
    ...customDbs.map(db => ({ ...db, regex: new RegExp(db.regexStr), isCustom: true }))
  ];

  // Also collect custom prefixes added to default DBs
  const customPrefixes = {}; // dbKey -> [{label,uri}]
  for (const c of customDbs) {
    if (defaultDbs.find(d => d.key === c.key)) {
      // This custom entry augments an existing default DB's prefixes
      customPrefixes[c.key] = c.prefix || [];
    }
  }

  const container = document.getElementById("db-cards");
  container.innerHTML = "";

  for (const db of allDbs) {
    const dbDisabled = !!disabled[db.key];
    const card = document.createElement("div");
    card.className = "db-card";
    card.dataset.searchText = `${db.label} ${db.key}`.toLowerCase();

    // ── Card header ──
    const hdr = document.createElement("div");
    hdr.className = "db-card-header";

    const dbCb = mkCheckbox(!dbDisabled, async checked => {
      await setDisabled(db.key, !checked);
      card.querySelectorAll(".prefix-item input[type=checkbox]").forEach(c => {
        c.disabled = !checked;
      });
    });

    const nameEl = mkEl("span", { className: "db-name", textContent: db.label });
    const keyEl  = mkEl("span", { className: "db-key",  textContent: db.key });
    const regexEl = mkEl("span", { className: "db-regex", textContent: db.regexStr || db.regex.toString() });

    hdr.append(dbCb, nameEl, keyEl, regexEl);

    const actions = mkEl("div", { className: "card-actions" });

    if (db.isCustom) {
      const badge = mkEl("span", { className: "badge-custom", textContent: "カスタム" });
      hdr.appendChild(badge);

      const editBtn = mkEl("button", { className: "btn-card", textContent: "編集" });
      editBtn.addEventListener("click", () => openEditModal(db));
      const delBtn = mkEl("button", { className: "btn-card danger", textContent: "削除" });
      delBtn.addEventListener("click", async () => {
        if (!confirm(`"${db.label}" を削除しますか？`)) return;
        const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
        await chrome.storage.sync.set({ customDbs: cur.filter(d => d.key !== db.key) });
        renderDbList();
      });
      actions.append(editBtn, delBtn);
    } else {
      // Add prefix button for default DBs
      const addPBtn = mkEl("button", { className: "btn-card primary", textContent: "＋ prefix" });
      addPBtn.addEventListener("click", () => {
        const form = card.querySelector(".inline-add-prefix");
        form.classList.toggle("visible");
      });
      actions.appendChild(addPBtn);
    }

    hdr.appendChild(actions);
    card.appendChild(hdr);

    // ── Prefix list ──
    const pl = document.createElement("div");
    pl.className = "prefix-list";

    const allPrefixes = [
      ...(db.prefix || []).map(p => ({ ...p, isCustom: false })),
      ...(customPrefixes[db.key] || []).map(p => ({ ...p, isCustom: true }))
    ];

    for (const p of allPrefixes) {
      const storageKey = `${db.key}__${p.label}`;
      const prefDisabled = !!disabled[storageKey] || dbDisabled;
      const pi = mkEl("div", { className: "prefix-item" });
      const pcb = mkCheckbox(!prefDisabled, async checked => {
        await setDisabled(storageKey, !checked);
      });
      pcb.disabled = dbDisabled;
      const lbl = mkEl("span", { className: "prefix-label", textContent: p.label });
      const uri = mkEl("span", { className: "prefix-uri",   textContent: p.uri });
      pi.append(pcb, lbl, uri);
      if (p.isCustom) {
        pi.appendChild(mkEl("span", { className: "prefix-badge-custom", textContent: "カスタム" }));
        const delP = mkEl("button", { className: "btn-card danger", textContent: "削除", style: "font-size:10px;padding:1px 6px;" });
        delP.addEventListener("click", async () => {
          const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
          // Remove this prefix from custom storage entry for this dbKey
          const updated = cur.map(c => {
            if (c.key !== db.key) return c;
            return { ...c, prefix: (c.prefix || []).filter(pp => pp.label !== p.label) };
          }).filter(c => c.prefix === undefined || c.prefix.length > 0 || c.isFullCustom);
          await chrome.storage.sync.set({ customDbs: updated });
          renderDbList();
        });
        pi.appendChild(delP);
      }
      pl.appendChild(pi);
    }
    card.appendChild(pl);

    // ── Inline add-prefix form (for default DBs) ──
    if (!db.isCustom) {
      const inlineForm = mkEl("div", { className: "inline-add-prefix" });
      inlineForm.innerHTML = `
        <div class="row">
          <input type="text" class="pi-label" placeholder="ラベル（例: mysite）" style="width:120px">
          <input type="text" class="pi-uri" placeholder="URI プレフィックス" style="flex:1">
        </div>
        <div class="row-actions">
          <button class="btn-primary" style="font-size:12px;padding:5px 12px">追加</button>
          <button class="btn-ghost"   style="font-size:12px;padding:5px 12px">キャンセル</button>
          <span class="error-msg" style="font-size:12px"></span>
        </div>`;
      const [addBtn, cancelBtn] = inlineForm.querySelectorAll("button");
      cancelBtn.addEventListener("click", () => inlineForm.classList.remove("visible"));
      addBtn.addEventListener("click", async () => {
        const label = inlineForm.querySelector(".pi-label").value.trim();
        const uri   = inlineForm.querySelector(".pi-uri").value.trim();
        const errEl = inlineForm.querySelector(".error-msg");
        errEl.textContent = "";
        if (!label || !uri) { errEl.textContent = "ラベルと URI を入力してください。"; return; }

        const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
        // Find existing custom entry for this dbKey, or create new stub
        const existing = cur.find(c => c.key === db.key);
        let updated;
        if (existing) {
          updated = cur.map(c => c.key === db.key
            ? { ...c, prefix: [...(c.prefix || []), { label, uri }] }
            : c);
        } else {
          updated = [...cur, {
            key: db.key, label: db.label,
            regexStr: db.regexStr || db.regex.source,
            prefix: [{ label, uri }],
            isFullCustom: false
          }];
        }
        await chrome.storage.sync.set({ customDbs: updated });
        inlineForm.classList.remove("visible");
        renderDbList();
      });
      card.appendChild(inlineForm);
    }

    container.appendChild(card);
  }

  filterCards();
}

// ── Edit modal ────────────────────────────────────────────────────────────────
let _editingKey = null;

function openEditModal(db) {
  _editingKey = db.key;
  document.getElementById("modal-title").textContent = `編集: ${db.label}`;
  document.getElementById("modal-label").value = db.label;
  document.getElementById("modal-regex").value = db.regexStr || db.regex.source;
  document.getElementById("modal-error").textContent = "";

  const list = document.getElementById("modal-prefix-list");
  list.innerHTML = "";
  for (const p of db.prefix || []) {
    list.appendChild(modalPrefixRow(p.label, p.uri));
  }
  document.getElementById("edit-modal").style.display = "flex";
}

function modalPrefixRow(labelVal = "", uriVal = "") {
  const row = mkEl("div", { className: "modal-prefix-row" });
  row.innerHTML = `
    <input type="text" class="pi-label-in" placeholder="ラベル" value="${esc(labelVal)}">
    <input type="text" class="pi-uri-in"   placeholder="URI プレフィックス" value="${esc(uriVal)}" style="flex:1">
    <button class="btn-icon">×</button>`;
  row.querySelector(".btn-icon").addEventListener("click", () => {
    if (document.querySelectorAll("#modal-prefix-list .modal-prefix-row").length > 1)
      row.remove();
  });
  return row;
}

document.getElementById("modal-add-prefix-row").addEventListener("click", () => {
  document.getElementById("modal-prefix-list").appendChild(modalPrefixRow());
});

document.getElementById("modal-cancel").addEventListener("click", () => {
  document.getElementById("edit-modal").style.display = "none";
});

document.getElementById("modal-save").addEventListener("click", async () => {
  const errEl = document.getElementById("modal-error");
  errEl.textContent = "";
  const label    = document.getElementById("modal-label").value.trim();
  const regexStr = document.getElementById("modal-regex").value.trim();
  if (!label)    { errEl.textContent = "表示名を入力してください。"; return; }
  if (!regexStr) { errEl.textContent = "正規表現を入力してください。"; return; }
  try { new RegExp(regexStr); } catch { errEl.textContent = "正規表現が不正です。"; return; }

  const rows = document.querySelectorAll("#modal-prefix-list .modal-prefix-row");
  const prefix = [];
  for (const row of rows) {
    const l = row.querySelector(".pi-label-in").value.trim();
    const u = row.querySelector(".pi-uri-in").value.trim();
    if (l || u) {
      if (!l || !u) { errEl.textContent = "各 prefix のラベルと URI を両方入力してください。"; return; }
      prefix.push({ label: l, uri: u });
    }
  }
  if (prefix.length === 0) { errEl.textContent = "prefix を 1 つ以上追加してください。"; return; }

  const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
  const updated = cur.map(c => c.key === _editingKey
    ? { ...c, label, regexStr, prefix, isFullCustom: true }
    : c);
  await chrome.storage.sync.set({ customDbs: updated });
  document.getElementById("edit-modal").style.display = "none";
  renderDbList();
});

// Close modal on overlay click
document.getElementById("edit-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = "none";
});

// ── Add new DB form ───────────────────────────────────────────────────────────
document.getElementById("btn-add-prefix-row").addEventListener("click", () => {
  const row = mkEl("div", { className: "prefix-row-input" });
  row.innerHTML = `
    <input type="text" class="pi-label" placeholder="ラベル">
    <input type="text" class="pi-uri"   placeholder="URI プレフィックス">
    <button class="btn-icon remove-prefix">×</button>`;
  document.getElementById("new-prefixes").appendChild(row);
});

document.getElementById("new-prefixes").addEventListener("click", e => {
  if (e.target.classList.contains("remove-prefix")) {
    const rows = document.querySelectorAll("#new-prefixes .prefix-row-input");
    if (rows.length > 1) e.target.closest(".prefix-row-input").remove();
  }
});

document.getElementById("btn-add-db").addEventListener("click", async () => {
  const errEl = document.getElementById("add-error");
  errEl.textContent = "";
  const key      = document.getElementById("new-key").value.trim();
  const label    = document.getElementById("new-label").value.trim();
  const regexStr = document.getElementById("new-regex").value.trim();

  if (!key)      { errEl.textContent = "キーを入力してください。"; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(key)) { errEl.textContent = "キーは英数字とアンダースコアのみ使用できます。"; return; }
  if (!label)    { errEl.textContent = "表示名を入力してください。"; return; }
  if (!regexStr) { errEl.textContent = "正規表現を入力してください。"; return; }
  try { new RegExp(regexStr); } catch { errEl.textContent = "正規表現が不正です。"; return; }

  const prefixRows = document.querySelectorAll("#new-prefixes .prefix-row-input");
  const prefix = [];
  for (const row of prefixRows) {
    const l = row.querySelector(".pi-label").value.trim();
    const u = row.querySelector(".pi-uri").value.trim();
    if (l || u) {
      if (!l || !u) { errEl.textContent = "各 prefix のラベルと URI を両方入力してください。"; return; }
      prefix.push({ label: l, uri: u });
    }
  }
  if (prefix.length === 0) { errEl.textContent = "prefix を 1 つ以上追加してください。"; return; }

  const [defaultDbs, { customDbs: cur = [] }] =
    await Promise.all([loadDatabases(), chrome.storage.sync.get("customDbs")]);
  if ([...defaultDbs, ...cur].some(d => d.key === key)) {
    errEl.textContent = `キー "${key}" は既に使用されています。`; return;
  }

  await chrome.storage.sync.set({ customDbs: [...cur, { key, label, regexStr, prefix, isFullCustom: true }] });

  document.getElementById("new-key").value = "";
  document.getElementById("new-label").value = "";
  document.getElementById("new-regex").value = "";
  document.getElementById("new-prefixes").innerHTML = `
    <div class="prefix-row-input">
      <input type="text" class="pi-label" placeholder="ラベル">
      <input type="text" class="pi-uri"   placeholder="URI プレフィックス">
      <button class="btn-icon remove-prefix">×</button>
    </div>`;

  renderDbList();
  // Auto-open list if closed
  if (!dbListOpen) document.getElementById("db-toggle").click();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function setDisabled(key, isDisabled) {
  const { disabled = {} } = await chrome.storage.sync.get("disabled");
  if (isDisabled) disabled[key] = true; else delete disabled[key];
  await chrome.storage.sync.set({ disabled });
}

function mkCheckbox(checked, onChange) {
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = checked;
  cb.addEventListener("change", () => onChange(cb.checked));
  return cb;
}

function mkEl(tag, props = {}) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (props.style) node.setAttribute("style", props.style);
  return node;
}

function esc(s) { return (s || "").replace(/"/g, "&quot;"); }

// ── Init ──────────────────────────────────────────────────────────────────────
renderDbList();
