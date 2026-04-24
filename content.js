// content.js

if (!window.__togoIdLoaded) {
  window.__togoIdLoaded = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "show-popup")    { showOpenPopup();    return; }
    if (message.type === "show-browser")  { showBrowserPopup(); return; }
    if (message.type === "close-popup")   { removePopup();      return; }
    if (message.type === "query-popup") {
      sendResponse(!!document.getElementById("togoid-popup"));
      return true;
    }
    if (message.type === "query-selection") {
      sendResponse((window.getSelection()?.toString()?.trim() ?? "").length > 0);
      return true;
    }
  });
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  title:             "TogoID Open",
  noSelection:       "(no selection)",
  noMatch:           (t) => `No database matched "${t}".`,
  escHint:           "Esc or click outside to close",
  copy:              "Copy",
  copied:            "Copied!",
  openUrl:           "Open URL",
  back:              "← Back",
  searchPlaceholder: "Search databases…",
  noDbFound:         "No databases found.",
  examples:          "Examples",
  selectPrefix:      "Destination:",
  more:              "More ▾",
  less:              "Less ▴",
  recent:            "Recent",
  all:               "All",
  typeToSearch:      "Type an ID to match databases…",
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function el(tag, props = {}) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "style") node.setAttribute("style", v);
    else node[k] = v;
  }
  return node;
}

function css(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, m => "-" + m.toLowerCase())}:${v}`)
    .join(";");
}

const COLORS = {
  brand:      "#1ab3c8",
  brandDark:  "#00838f",
  brandDeep:  "#006064",
  brandLight: "#e0f7fa",
  brandMid:   "#b2ebf2",
  headerBg:   "#e0f7fa",
  headerBorder:"#b2ebf2",
  hoverBg:    "#e0f7fa",
  text:       "#1a1a1a",
  sub:        "#666",
  white:      "#fff",
  border:     "#b2ebf2",
  sectionHdr: "#f0fbfc",
};

function makePopupShell(kind) {
  const popup = el("div", {
    id: "togoid-popup",
    style: css({
      position: "fixed", zIndex: "2147483647",
      background: COLORS.white,
      border: `1.5px solid ${COLORS.brand}`,
      borderRadius: "8px",
      boxShadow: "0 4px 20px rgba(26,179,200,0.18), 0 2px 8px rgba(0,0,0,0.10)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "14px", width: "400px", overflow: "hidden",
      color: COLORS.text, display: "flex", flexDirection: "column",
      top: "-9999px", left: "-9999px",
    })
  });
  popup.dataset.kind = kind;

  const header = el("div", {
    style: css({
      background: COLORS.headerBg, borderBottom: `1px solid ${COLORS.headerBorder}`,
      padding: "9px 14px", display: "flex", alignItems: "center", gap: "10px", flexShrink: "0"
    })
  });
  const titleSpan = el("span", {
    style: css({ fontWeight: "700", fontSize: "13px", letterSpacing: "0.05em", color: COLORS.brandDark, flexShrink: "0" }),
    textContent: T.title
  });
  const closeBtn = el("button", {
    style: css({ background: "none", border: "none", color: COLORS.brandDark, fontSize: "20px", cursor: "pointer", padding: "0", lineHeight: "1", flexShrink: "0" }),
    textContent: "×"
  });
  closeBtn.addEventListener("click", removePopup);
  header.append(titleSpan, closeBtn);
  popup.appendChild(header);

  const body = el("div", { style: css({ overflowY: "auto", maxHeight: "65vh", padding: "6px 0" }) });
  popup.appendChild(body);

  const footer = el("div", {
    style: css({ padding: "5px 14px", fontSize: "11px", color: "#aaa", borderTop: `1px solid ${COLORS.brandLight}`, textAlign: "right", flexShrink: "0" }),
    textContent: T.escHint
  });
  popup.appendChild(footer);

  return { popup, header, titleSpan, closeBtn, body };
}

function placePopup(popup, anchorRect) {
  document.body.appendChild(popup);
  const pw = popup.offsetWidth, ph = popup.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  const M = 8;
  let top, left;
  if (anchorRect && anchorRect.width > 0) {
    top  = anchorRect.bottom + M;
    left = anchorRect.left;
    if (top + ph > vh - M) top = anchorRect.top - ph - M;
    left = Math.max(M, Math.min(left, vw - pw - M));
    if (top < M) top = Math.max(M, (vh - ph) / 2);
  } else {
    top  = Math.max(M, Math.floor(vh * 0.20));
    left = Math.max(M, Math.floor((vw - pw) / 2));
  }
  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;
  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

function placeBrowserPopup(popup) {
  document.body.appendChild(popup);
  const vw = window.innerWidth, vh = window.innerHeight;
  const M = 12;
  const pw = popup.offsetWidth;
  const bodyEl = popup.querySelector("[data-scrollbody]");
  if (bodyEl) {
    const maxBodyH = Math.floor(vh * 0.70) - 120;
    bodyEl.style.maxHeight = `${Math.max(200, maxBodyH)}px`;
  }
  const ph = popup.offsetHeight;
  const top  = Math.max(M, Math.floor(vh * 0.10));
  const left = Math.max(M, Math.min(Math.floor((vw - pw) / 2), vw - pw - M));
  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;
  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

function msgEl(text) {
  return el("div", { style: css({ padding: "10px 14px", color: COLORS.sub, fontSize: "13px" }), textContent: text });
}

function sectionHeader(text) {
  const hdr = el("div", {
    style: css({
      padding: "4px 14px 2px",
      fontSize: "11px", fontWeight: "700", letterSpacing: "0.06em",
      color: COLORS.brandDark, textTransform: "uppercase",
      background: COLORS.sectionHdr, borderTop: `1px solid ${COLORS.brandMid}`,
    }),
    textContent: text
  });
  return hdr;
}

function rowEl(label, url, isIndented) {
  const row = el("div", {
    style: css({
      display: "flex", alignItems: "center",
      padding: isIndented ? "7px 14px 7px 36px" : "8px 14px",
      cursor: "pointer", gap: "8px"
    })
  });
  const icon = el("span", { style: css({ fontSize: "12px", color: COLORS.brand, flexShrink: "0" }), textContent: "↗" });
  const labelEl = el("span", { style: css({ flex: "1" }), textContent: label });
  const urlEl = el("span", {
    style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
    textContent: url
  });
  row.append(icon, labelEl, urlEl);
  row.addEventListener("mouseover", () => { row.style.background = COLORS.hoverBg; });
  row.addEventListener("mouseout",  () => { row.style.background = ""; });
  row.addEventListener("click", () => { window.open(url, "_blank", "noopener"); removePopup(); });
  return row;
}

function onEscKey(e) { if (e.key === "Escape") removePopup(); }
function onOutsideClick(e) {
  const p = document.getElementById("togoid-popup");
  if (p && !p.contains(e.target)) removePopup();
}
function removePopup() {
  document.getElementById("togoid-popup")?.remove();
  document.removeEventListener("keydown", onEscKey);
  document.removeEventListener("mousedown", onOutsideClick);
}

// ── ① Open selected ───────────────────────────────────────────────────────────

async function showOpenPopup() {
  removePopup();

  const selection = window.getSelection();
  const initialText = selection?.toString()?.trim() ?? "";
  let anchorRect = null;
  if (selection?.rangeCount > 0) anchorRect = selection.getRangeAt(0).getBoundingClientRect();

  const { popup, header, titleSpan, body } = makePopupShell("show-popup");

  // Replace badge with editable input in header
  const inputBox = el("input", {
    type: "text",
    style: css({
      flex: "1",
      fontSize: "12px", fontFamily: "monospace",
      background: COLORS.white, color: COLORS.brandDark,
      border: `1px solid ${COLORS.brandMid}`, borderRadius: "4px",
      padding: "2px 8px", outline: "none",
      minWidth: "0"
    }),
    value: initialText,
    placeholder: T.typeToSearch,
  });
  inputBox.addEventListener("focus", () => { inputBox.style.borderColor = COLORS.brand; });
  inputBox.addEventListener("blur",  () => { inputBox.style.borderColor = COLORS.brandMid; });

  // Insert input between title and close button
  const closeBtn = header.querySelector("button");
  header.insertBefore(inputBox, closeBtn);

  // Render candidates based on current input value
  async function renderCandidates(text) {
    body.innerHTML = "";
    if (!text) {
      body.appendChild(msgEl(T.typeToSearch));
      return;
    }
    const flat = await getCandidates(text);
    const grouped = new Map();
    for (const c of flat) {
      if (!grouped.has(c.db.key)) grouped.set(c.db.key, { db: c.db, items: [] });
      grouped.get(c.db.key).items.push({ prefix: c.prefix, resolvedId: c.resolvedId });
    }
    if (grouped.size === 0) {
      body.appendChild(msgEl(T.noMatch(text)));
      return;
    }

    for (const [, { db, items }] of grouped) {
      if (items.length === 1) {
        const { prefix, resolvedId } = items[0];
        body.appendChild(rowEl(db.label, prefix.uri + resolvedId, false));
      } else {
        const section = el("div");
        const first = items[0], rest = items.slice(1);

        const topRow = el("div", {
          style: css({ display: "flex", alignItems: "center", padding: "8px 14px", gap: "8px" })
        });
        const icon       = el("span", { style: css({ fontSize: "12px", color: COLORS.brand, flexShrink: "0" }), textContent: "↗" });
        const dbLabelEl  = el("span", { style: css({ flex: "1", cursor: "pointer" }), textContent: db.label });
        const firstUrlEl = el("span", {
          style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }),
          textContent: first.prefix.uri + first.resolvedId
        });
        const moreBtn = el("span", {
          style: css({ fontSize: "11px", color: COLORS.brandDark, background: COLORS.brandLight, padding: "1px 8px", borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: "0", userSelect: "none" }),
          textContent: T.more
        });

        const openFirst = () => { window.open(first.prefix.uri + first.resolvedId, "_blank", "noopener"); removePopup(); };
        topRow.append(icon, dbLabelEl, firstUrlEl, moreBtn);
        topRow.addEventListener("mouseover", () => { topRow.style.background = COLORS.hoverBg; });
        topRow.addEventListener("mouseout",  () => { topRow.style.background = ""; });
        topRow.addEventListener("click", (e) => {
          if (e.target === moreBtn || moreBtn.contains(e.target)) return;
          openFirst();
        });

        const subList = el("div", { style: css({ display: "none" }) });
        for (const { prefix, resolvedId } of rest) {
          subList.appendChild(rowEl(prefix.label, prefix.uri + resolvedId, true));
        }

        let open = false;
        moreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          open = !open;
          moreBtn.textContent = open ? T.less : T.more;
          subList.style.display = open ? "block" : "none";
        });

        section.append(topRow, subList);
        body.appendChild(section);
      }
    }
  }

  // Debounce input
  let debounceTimer = null;
  inputBox.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderCandidates(inputBox.value.trim()), 120);
  });

  await renderCandidates(initialText);
  placePopup(popup, anchorRect);
  // Focus the input for immediate editing
  setTimeout(() => inputBox.focus(), 30);
}

// ── ② Show examples (browser) ─────────────────────────────────────────────────

// Recent DBs: stored in chrome.storage.local as array of db keys (max 3)
async function getRecentDbKeys() {
  try {
    const r = await chrome.storage.local.get("recentDbs");
    return Array.isArray(r.recentDbs) ? r.recentDbs : [];
  } catch { return []; }
}
async function pushRecentDb(key) {
  try {
    const cur = await getRecentDbKeys();
    const updated = [key, ...cur.filter(k => k !== key)].slice(0, 3);
    await chrome.storage.local.set({ recentDbs: updated });
  } catch {}
}

async function showBrowserPopup() {
  removePopup();
  const { popup, header, body } = makePopupShell("show-browser");

  // Add badge label to header (read-only)
  const badge = el("span", {
    style: css({
      flex: "1", fontSize: "12px", background: COLORS.white, color: COLORS.brandDark,
      border: `1px solid ${COLORS.brandMid}`, padding: "2px 8px", borderRadius: "4px",
      fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    }),
    textContent: T.examples
  });
  const closeBtn = header.querySelector("button");
  header.insertBefore(badge, closeBtn);
  body.dataset.scrollbody = "1";

  // ── View A: DB search with Recent / All ──
  async function showDbSearch() {
    body.innerHTML = "";
    badge.textContent = T.examples;

    const searchWrap = el("div", {
      style: css({ padding: "8px 10px 4px", borderBottom: `1px solid ${COLORS.brandLight}`, flexShrink: "0" })
    });
    const searchInput = el("input", {
      type: "text",
      placeholder: T.searchPlaceholder,
      style: css({
        width: "100%", padding: "6px 10px", border: `1px solid ${COLORS.brandMid}`,
        borderRadius: "6px", fontSize: "13px", outline: "none", boxSizing: "border-box"
      })
    });
    searchInput.addEventListener("focus", () => { searchInput.style.borderColor = COLORS.brand; });
    searchInput.addEventListener("blur",  () => { searchInput.style.borderColor = COLORS.brandMid; });
    searchWrap.appendChild(searchInput);
    body.appendChild(searchWrap);

    const listWrap = el("div", { style: css({ padding: "0" }) });
    body.appendChild(listWrap);

    const [allDbs, recentKeys] = await Promise.all([getAllDbs(), getRecentDbKeys()]);
    const recentDbs = recentKeys.map(k => allDbs.find(d => d.key === k)).filter(Boolean);

    function dbListRow(db) {
      const row = el("div", {
        style: css({ display: "flex", alignItems: "center", padding: "8px 14px", cursor: "pointer", gap: "8px" })
      });
      row.addEventListener("mouseover", () => { row.style.background = COLORS.hoverBg; });
      row.addEventListener("mouseout",  () => { row.style.background = ""; });
      const nameEl = el("span", { style: css({ flex: "1", fontWeight: "500" }), textContent: db.label });
      const keyEl  = el("span", { style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace" }), textContent: db.key });
      const arrow  = el("span", { style: css({ fontSize: "12px", color: COLORS.brand }), textContent: "›" });
      row.append(nameEl, keyEl, arrow);
      row.addEventListener("click", async () => {
        await pushRecentDb(db.key);
        showExamples(db);
      });
      return row;
    }

    function renderDbList(q) {
      listWrap.innerHTML = "";
      const filtered = q
        ? allDbs.filter(d => d.label.toLowerCase().includes(q) || d.key.toLowerCase().includes(q))
        : null;

      if (q) {
        // Search active: flat filtered list, no sections
        if (filtered.length === 0) { listWrap.appendChild(msgEl(T.noDbFound)); return; }
        filtered.forEach(db => listWrap.appendChild(dbListRow(db)));
      } else {
        // No search: Recent + All sections
        if (recentDbs.length > 0) {
          listWrap.appendChild(sectionHeader(T.recent));
          recentDbs.forEach(db => listWrap.appendChild(dbListRow(db)));
        }
        listWrap.appendChild(sectionHeader(T.all));
        if (allDbs.length === 0) { listWrap.appendChild(msgEl(T.noDbFound)); return; }
        allDbs.forEach(db => listWrap.appendChild(dbListRow(db)));
      }
    }

    searchInput.addEventListener("input", () => renderDbList(searchInput.value.trim().toLowerCase()));
    renderDbList("");
    setTimeout(() => searchInput.focus(), 50);
  }

  // ── View B: Examples for a DB ──
  async function showExamples(db) {
    body.innerHTML = "";
    badge.textContent = db.label;

    const storage = await chrome.storage.sync.get("disabled");
    const disabled = storage.disabled || {};
    const activePrefixes = (db.prefix || []).filter(p => !disabled[`${db.key}__${p.label}`]);

    // Toolbar: Back + prefix selector
    const toolbar = el("div", {
      style: css({
        padding: "6px 10px", borderBottom: `1px solid ${COLORS.brandLight}`,
        display: "flex", alignItems: "center", gap: "8px", flexShrink: "0"
      })
    });
    const backBtn = el("button", {
      style: css({ background: "none", border: "none", color: COLORS.brandDark, cursor: "pointer", fontSize: "13px", padding: "2px 6px", borderRadius: "4px" }),
      textContent: T.back
    });
    backBtn.addEventListener("mouseover", () => { backBtn.style.background = COLORS.brandLight; });
    backBtn.addEventListener("mouseout",  () => { backBtn.style.background = ""; });
    backBtn.addEventListener("click", showDbSearch);
    toolbar.appendChild(backBtn);

    let selectedPrefixIndex = 0;
    if (activePrefixes.length > 1) {
      toolbar.appendChild(el("span", { style: css({ color: COLORS.brandMid, fontSize: "12px" }), textContent: "|" }));
      toolbar.appendChild(el("span", { style: css({ fontSize: "12px", color: COLORS.sub }), textContent: T.selectPrefix }));
      const select = el("select", {
        style: css({
          fontSize: "12px", border: `1px solid ${COLORS.brandMid}`, borderRadius: "4px",
          padding: "2px 6px", background: COLORS.white, color: COLORS.brandDark, cursor: "pointer", outline: "none"
        })
      });
      activePrefixes.forEach((p, i) => {
        select.appendChild(el("option", { value: String(i), textContent: p.label }));
      });
      select.addEventListener("change", () => { selectedPrefixIndex = parseInt(select.value); });
      toolbar.appendChild(select);
    }
    body.appendChild(toolbar);

    const examples = db.examples || [];
    if (examples.length === 0) {
      body.appendChild(msgEl("No examples available."));
      return;
    }

    function openWithSelectedPrefix(id) {
      if (activePrefixes.length === 0) return;
      const match = id.match(db.regex);
      const resolvedId = match ? extractId(match) : id;
      window.open(activePrefixes[selectedPrefixIndex].uri + resolvedId, "_blank", "noopener");
    }

    const listWrap = el("div", { style: css({ padding: "4px 0" }) });
    body.appendChild(listWrap);

    if (examples.length === 1) {
      examples[0].forEach(id => listWrap.appendChild(exampleRow(id, false, openWithSelectedPrefix)));
    } else {
      examples.forEach(series => {
        if (!series.length) return;
        const section = el("div");
        const hdrBtn = el("div", {
          style: css({ display: "flex", alignItems: "center", padding: "7px 14px", cursor: "pointer", gap: "8px", userSelect: "none", background: "#f9fefe" })
        });
        const arrow   = el("span", { style: css({ fontSize: "11px", color: COLORS.brand, transition: "transform 0.15s" }), textContent: "▶" });
        const firstId = el("code", { style: css({ fontFamily: "monospace", fontSize: "13px", flex: "1", color: COLORS.brandDark }), textContent: series[0] });
        const cntBadge = el("span", { style: css({ fontSize: "11px", color: COLORS.brandDark, background: COLORS.brandLight, padding: "1px 6px", borderRadius: "10px" }), textContent: `${series.length}` });
        hdrBtn.append(arrow, firstId, cntBadge);
        hdrBtn.addEventListener("mouseover", () => { hdrBtn.style.background = COLORS.hoverBg; });
        hdrBtn.addEventListener("mouseout",  () => { hdrBtn.style.background = "#f9fefe"; });

        const subList = el("div", { style: css({ display: "none" }) });
        series.forEach(id => subList.appendChild(exampleRow(id, true, openWithSelectedPrefix)));

        let open = false;
        hdrBtn.addEventListener("click", () => {
          open = !open;
          arrow.style.transform = open ? "rotate(90deg)" : "";
          subList.style.display = open ? "block" : "none";
        });
        section.append(hdrBtn, subList);
        listWrap.appendChild(section);
      });
    }
  }

  function exampleRow(id, isIndented, openFn) {
    const row = el("div", {
      style: css({
        display: "flex", alignItems: "center",
        padding: isIndented ? "5px 14px 5px 30px" : "6px 14px",
        gap: "8px", borderBottom: `1px solid #f0f0f0`
      })
    });
    const idEl = el("code", { style: css({ flex: "1", fontFamily: "monospace", fontSize: "13px", color: COLORS.text }), textContent: id });
    const copyBtn = el("button", {
      style: css({ fontSize: "11px", padding: "2px 8px", border: `1px solid ${COLORS.brandMid}`, borderRadius: "4px", background: COLORS.white, color: COLORS.brandDark, cursor: "pointer", whiteSpace: "nowrap" }),
      textContent: T.copy
    });
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(id);
      copyBtn.textContent = T.copied;
      setTimeout(() => { copyBtn.textContent = T.copy; }, 1500);
    });
    const openBtn = el("button", {
      style: css({ fontSize: "11px", padding: "2px 8px", border: `1px solid ${COLORS.brand}`, borderRadius: "4px", background: COLORS.brandLight, color: COLORS.brandDark, cursor: "pointer", whiteSpace: "nowrap" }),
      textContent: T.openUrl
    });
    openBtn.addEventListener("click", (e) => { e.stopPropagation(); openFn(id); });
    row.append(idEl, copyBtn, openBtn);
    return row;
  }

  showDbSearch();
  placeBrowserPopup(popup);
}

// ── extractId ─────────────────────────────────────────────────────────────────
function extractId(match) {
  const groups = match.groups || {};
  if (groups.id !== undefined) return groups.id;
  for (let i = 1; i <= 9; i++) {
    if (groups[`id${i}`] !== undefined) return groups[`id${i}`];
  }
  return match[1] !== undefined ? match[1] : match[0];
}
