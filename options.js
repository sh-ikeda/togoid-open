// options.js

// ── Language switcher ─────────────────────────────────────────────────────────
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setLang(btn.dataset.lang);
    updateLangBtns();
    // Re-render DB list to refresh dynamic strings
    renderDbList();
  });
});

function updateLangBtns() {
  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === getLang());
  });
}

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
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
    dbListOpen ? t("dbToggleHide") : t("dbToggleShow");
});

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById("db-search").addEventListener("input", filterCards);

function filterCards() {
  const q = document.getElementById("db-search").value.trim().toLowerCase();
  const cards = document.querySelectorAll("#db-cards .db-card");
  let shown = 0;
  cards.forEach(card => {
    const match = !q || (card.dataset.searchText || "").includes(q);
    card.style.display = match ? "" : "none";
    if (match) shown++;
  });
  document.getElementById("search-count").textContent =
    t("searchCount", shown, cards.length, q);
}

// ── Render DB list ────────────────────────────────────────────────────────────
async function renderDbList() {
  const [defaultDbs, { disabled = {}, customDbs = [] }] =
    await Promise.all([loadDatabases(), chrome.storage.sync.get(["disabled", "customDbs"])]);

  const allDbs = [
    ...defaultDbs.map(db => ({ ...db, isCustom: false })),
    ...customDbs.map(db => ({ ...db, regex: new RegExp(db.regexStr), isCustom: true }))
  ];

  // Custom prefixes added to default DBs
  const customPrefixes = {};
  for (const c of customDbs) {
    if (defaultDbs.find(d => d.key === c.key)) {
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

    // Header
    const hdr = document.createElement("div");
    hdr.className = "db-card-header";

    const dbCb = mkCheckbox(!dbDisabled, async checked => {
      await setDisabled(db.key, !checked);
      card.querySelectorAll(".prefix-item input[type=checkbox]").forEach(c => { c.disabled = !checked; });
    });

    hdr.append(
      dbCb,
      mkEl("span", { className: "db-name",  textContent: db.label }),
      mkEl("span", { className: "db-key",   textContent: db.key }),
      mkEl("span", { className: "db-regex", textContent: db.regexStr || db.regex.toString() })
    );

    const actions = mkEl("div", { className: "card-actions" });

    if (db.isCustom) {
      hdr.appendChild(mkEl("span", { className: "badge-custom", textContent: t("badgeCustom") }));
      const editBtn = mkEl("button", { className: "btn-card", textContent: t("btnEdit") });
      editBtn.addEventListener("click", () => openEditModal(db));
      const delBtn  = mkEl("button", { className: "btn-card danger", textContent: t("btnDelete") });
      delBtn.addEventListener("click", async () => {
        if (!confirm(t("confirmDelete", db.label))) return;
        const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
        await chrome.storage.sync.set({ customDbs: cur.filter(d => d.key !== db.key) });
        renderDbList();
      });
      actions.append(editBtn, delBtn);
    } else {
      const addPBtn = mkEl("button", { className: "btn-card primary", textContent: t("btnAddPrefix") });
      addPBtn.addEventListener("click", () => {
        card.querySelector(".inline-add-prefix").classList.toggle("visible");
      });
      actions.appendChild(addPBtn);
    }

    hdr.appendChild(actions);
    card.appendChild(hdr);

    // Prefix list
    const pl = mkEl("div", { className: "prefix-list" });
    const allPrefixes = [
      ...(db.prefix || []).map(p => ({ ...p, isCustom: false })),
      ...(customPrefixes[db.key] || []).map(p => ({ ...p, isCustom: true }))
    ];

    for (const p of allPrefixes) {
      const storageKey = `${db.key}__${p.label}`;
      const prefDisabled = !!disabled[storageKey] || dbDisabled;
      const pi = mkEl("div", { className: "prefix-item" });
      const pcb = mkCheckbox(!prefDisabled, async checked => { await setDisabled(storageKey, !checked); });
      pcb.disabled = dbDisabled;
      pi.append(
        pcb,
        mkEl("span", { className: "prefix-label", textContent: p.label }),
        mkEl("span", { className: "prefix-uri",   textContent: p.uri })
      );
      if (p.isCustom) {
        pi.appendChild(mkEl("span", { className: "prefix-badge-custom", textContent: t("badgeCustom") }));
        const delP = mkEl("button", { className: "btn-card danger", textContent: t("btnDelete"), style: "font-size:10px;padding:1px 6px;" });
        delP.addEventListener("click", async () => {
          const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
          const updated = cur.map(c => c.key !== db.key ? c
            : { ...c, prefix: (c.prefix || []).filter(pp => pp.label !== p.label) }
          ).filter(c => (c.prefix?.length ?? 1) > 0 || c.isFullCustom);
          await chrome.storage.sync.set({ customDbs: updated });
          renderDbList();
        });
        pi.appendChild(delP);
      }
      pl.appendChild(pi);
    }
    card.appendChild(pl);

    // Inline add-prefix form (default DBs only)
    if (!db.isCustom) {
      const inlineForm = mkEl("div", { className: "inline-add-prefix" });
      inlineForm.innerHTML = `
        <div class="row">
          <input type="text" class="pi-label" placeholder="${t("piLabelPlaceholder")}" style="width:140px">
          <input type="text" class="pi-uri"   placeholder="${t("piUriPlaceholder")}" style="flex:1">
        </div>
        <div class="row-actions">
          <button class="btn-primary" style="font-size:12px;padding:5px 12px">${t("btnAddInline")}</button>
          <button class="btn-ghost"   style="font-size:12px;padding:5px 12px">${t("btnCancel")}</button>
          <span class="error-msg" style="font-size:12px"></span>
        </div>`;
      const [addBtn, cancelBtn] = inlineForm.querySelectorAll("button");
      cancelBtn.addEventListener("click", () => inlineForm.classList.remove("visible"));
      addBtn.addEventListener("click", async () => {
        const label = inlineForm.querySelector(".pi-label").value.trim();
        const uri   = inlineForm.querySelector(".pi-uri").value.trim();
        const errEl = inlineForm.querySelector(".error-msg");
        errEl.textContent = "";
        if (!label || !uri) { errEl.textContent = t("errLabelUri"); return; }
        const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
        const existing = cur.find(c => c.key === db.key);
        const updated = existing
          ? cur.map(c => c.key === db.key ? { ...c, prefix: [...(c.prefix || []), { label, uri }] } : c)
          : [...cur, { key: db.key, label: db.label, regexStr: db.regexStr || db.regex.source, prefix: [{ label, uri }], isFullCustom: false }];
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
  document.getElementById("modal-title").textContent = t("modalTitle", db.label);
  document.getElementById("modal-label").value  = db.label;
  document.getElementById("modal-regex").value  = db.regexStr || db.regex.source;
  document.getElementById("modal-error").textContent = "";
  const list = document.getElementById("modal-prefix-list");
  list.innerHTML = "";
  for (const p of db.prefix || []) list.appendChild(modalPrefixRow(p.label, p.uri));
  document.getElementById("edit-modal").style.display = "flex";
}

function modalPrefixRow(labelVal = "", uriVal = "") {
  const row = mkEl("div", { className: "modal-prefix-row" });
  row.innerHTML = `
    <input type="text" class="pi-label-in" placeholder="${t("phPiLabel")}" value="${esc(labelVal)}">
    <input type="text" class="pi-uri-in"   placeholder="${t("phPiUri")}"   value="${esc(uriVal)}" style="flex:1">
    <button class="btn-icon">×</button>`;
  row.querySelector(".btn-icon").addEventListener("click", () => {
    if (document.querySelectorAll("#modal-prefix-list .modal-prefix-row").length > 1) row.remove();
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
  if (!label)    { errEl.textContent = t("errLabelRequired"); return; }
  if (!regexStr) { errEl.textContent = t("errRegexRequired"); return; }
  try { new RegExp(regexStr); } catch { errEl.textContent = t("errRegexInvalid"); return; }
  const rows = document.querySelectorAll("#modal-prefix-list .modal-prefix-row");
  const prefix = [];
  for (const row of rows) {
    const l = row.querySelector(".pi-label-in").value.trim();
    const u = row.querySelector(".pi-uri-in").value.trim();
    if (l || u) {
      if (!l || !u) { errEl.textContent = t("errPrefixBoth"); return; }
      prefix.push({ label: l, uri: u });
    }
  }
  if (prefix.length === 0) { errEl.textContent = t("errPrefixMin"); return; }
  const { customDbs: cur = [] } = await chrome.storage.sync.get("customDbs");
  await chrome.storage.sync.set({ customDbs: cur.map(c => c.key === _editingKey ? { ...c, label, regexStr, prefix, isFullCustom: true } : c) });
  document.getElementById("edit-modal").style.display = "none";
  renderDbList();
});
document.getElementById("edit-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = "none";
});

// ── Add new DB ────────────────────────────────────────────────────────────────
document.getElementById("btn-add-prefix-row").addEventListener("click", () => {
  const row = mkEl("div", { className: "prefix-row-input" });
  row.innerHTML = `<input type="text" class="pi-label" placeholder="${t("phPiLabel")}"><input type="text" class="pi-uri" placeholder="${t("phPiUri")}"><button class="btn-icon remove-prefix">×</button>`;
  document.getElementById("new-prefixes").appendChild(row);
});
document.getElementById("new-prefixes").addEventListener("click", e => {
  if (e.target.classList.contains("remove-prefix")) {
    if (document.querySelectorAll("#new-prefixes .prefix-row-input").length > 1)
      e.target.closest(".prefix-row-input").remove();
  }
});
document.getElementById("btn-add-db").addEventListener("click", async () => {
  const errEl = document.getElementById("add-error");
  errEl.textContent = "";
  const key      = document.getElementById("new-key").value.trim();
  const label    = document.getElementById("new-label").value.trim();
  const regexStr = document.getElementById("new-regex").value.trim();
  if (!key)      { errEl.textContent = t("errKeyRequired"); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(key)) { errEl.textContent = t("errKeyInvalid"); return; }
  if (!label)    { errEl.textContent = t("errLabelRequired"); return; }
  if (!regexStr) { errEl.textContent = t("errRegexRequired"); return; }
  try { new RegExp(regexStr); } catch { errEl.textContent = t("errRegexInvalid"); return; }
  const prefixRows = document.querySelectorAll("#new-prefixes .prefix-row-input");
  const prefix = [];
  for (const row of prefixRows) {
    const l = row.querySelector(".pi-label").value.trim();
    const u = row.querySelector(".pi-uri").value.trim();
    if (l || u) {
      if (!l || !u) { errEl.textContent = t("errPrefixBoth"); return; }
      prefix.push({ label: l, uri: u });
    }
  }
  if (prefix.length === 0) { errEl.textContent = t("errPrefixMin"); return; }
  const [defaultDbs, { customDbs: cur = [] }] =
    await Promise.all([loadDatabases(), chrome.storage.sync.get("customDbs")]);
  if ([...defaultDbs, ...cur].some(d => d.key === key)) { errEl.textContent = t("errKeyDuplicate", key); return; }
  await chrome.storage.sync.set({ customDbs: [...cur, { key, label, regexStr, prefix, isFullCustom: true }] });
  ["new-key","new-label","new-regex"].forEach(id => { document.getElementById(id).value = ""; });
  document.getElementById("new-prefixes").innerHTML = `<div class="prefix-row-input"><input type="text" class="pi-label" placeholder="${t("phPiLabel")}"><input type="text" class="pi-uri" placeholder="${t("phPiUri")}"><button class="btn-icon remove-prefix">×</button></div>`;
  renderDbList();
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
  const styleVal = props.style;
  Object.assign(node, props);
  if (styleVal) node.setAttribute("style", styleVal);
  return node;
}
function esc(s) { return (s || "").replace(/"/g, "&quot;"); }

// ── Init ──────────────────────────────────────────────────────────────────────
applyI18n();
updateLangBtns();
renderDbList();
