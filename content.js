// content.js

if (!window.__togoIdLoaded) {
  window.__togoIdLoaded = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "show-popup") {
      showPopup(message.initialTab || "open");
      return;
    }
    if (message.type === "close-popup")   { removePopup(); return; }
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
  tabOpen:           "Open selected",
  tabExamples:       "Show examples",
  noMatch:           (t) => `No database matched "${t}".`,
  escHint:           "Esc or click outside to close",
  copy:              "Copy",
  copied:            "Copied!",
  openUrl:           "Open URL",
  back:              "← Back",
  searchPlaceholder: "Search databases…",
  idPlaceholder:     "Enter or paste an ID…",
  noDbFound:         "No databases found.",
  examples:          "Examples",
  selectPrefix:      "URL:",
  more:              "More ▾",
  less:              "Less ▴",
  recentSection:     "Recent",
  allSection:        "All",
};

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  brand:      "#1ab3c8",
  brandDark:  "#00838f",
  brandLight: "#e0f7fa",
  brandMid:   "#b2ebf2",
  hoverBg:    "#e0f7fa",
  headerBg:   "#f0fbfc",
  tabActive:  "#fff",
  tabBorder:  "#b2ebf2",
  text:       "#1a1a1a",
  sub:        "#666",
  white:      "#fff",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function msgEl(text) {
  return el("div", {
    style: css({ padding: "12px 14px", color: C.sub }),
    textContent: text
  });
}

function onEscKey(e)  { if (e.key === "Escape") removePopup(); }
function onOutsideClick(e) {
  const p = document.getElementById("togoid-popup");
  if (p && !p.contains(e.target)) removePopup();
}
function removePopup() {
  document.getElementById("togoid-popup")?.remove();
  document.removeEventListener("keydown", onEscKey);
  document.removeEventListener("mousedown", onOutsideClick);
}

// ── extractId (mirrors databases.js) ─────────────────────────────────────────
function extractId(match) {
  const groups = match.groups || {};
  if (groups.id !== undefined) return groups.id;
  for (let i = 1; i <= 9; i++) {
    if (groups[`id${i}`] !== undefined) return groups[`id${i}`];
  }
  return match[1] !== undefined ? match[1] : match[0];
}

// ── Recent DB history (chrome.storage.local) ──────────────────────────────────
async function getRecentDbs() {
  try {
    const r = await chrome.storage.local.get("recentDbs");
    return r.recentDbs || [];
  } catch { return []; }
}
async function pushRecentDb(key) {
  try {
    const cur = await getRecentDbs();
    const next = [key, ...cur.filter(k => k !== key)].slice(0, 3);
    await chrome.storage.local.set({ recentDbs: next });
  } catch {}
}

// ── Row builders ──────────────────────────────────────────────────────────────
function dbRowEl(label, onClick) {
  const row = el("div", {
    style: css({ display: "flex", alignItems: "center", padding: "8px 14px", cursor: "pointer", gap: "8px" })
  });
  row.addEventListener("mouseover", () => { row.style.background = C.hoverBg; });
  row.addEventListener("mouseout",  () => { row.style.background = ""; });
  row.addEventListener("click", onClick);
  const nameEl = el("span", { style: css({ flex: "1", fontWeight: "500" }), textContent: label });
  const arrow  = el("span", { style: css({ fontSize: "12px", color: C.brand }), textContent: "›" });
  row.append(nameEl, arrow);
  return row;
}

function openRowEl(label, url, isIndented) {
  const row = el("div", {
    style: css({
      display: "flex", alignItems: "center",
      padding: isIndented ? "7px 14px 7px 36px" : "8px 14px",
      gap: "8px"
    })
  });
  row.addEventListener("mouseover", () => { row.style.background = C.hoverBg; });
  row.addEventListener("mouseout",  () => { row.style.background = ""; });
  row.addEventListener("click", () => { window.open(url, "_blank", "noopener"); removePopup(); });

  const icon = el("span", { style: css({ fontSize: "12px", color: C.brand, flexShrink: "0" }), textContent: "↗" });
  const labelEl = el("span", { style: css({ flex: "1", cursor: "pointer" }), textContent: label });
  const urlEl = el("span", {
    style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace",
      maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
    textContent: url
  });
  row.append(icon, labelEl, urlEl);
  return row;
}

// ── Main popup shell ──────────────────────────────────────────────────────────
function showPopup(initialTab) {
  removePopup();

  const selection = window.getSelection();
  const selectedText = selection?.toString()?.trim() ?? "";
  let anchorRect = null;
  if (selection?.rangeCount > 0) anchorRect = selection.getRangeAt(0).getBoundingClientRect();

  // ── Outer popup ──
  const popup = el("div", {
    id: "togoid-popup",
    style: css({
      position: "fixed", zIndex: "2147483647",
      background: C.white,
      border: `1.5px solid ${C.brand}`,
      borderRadius: "8px",
      boxShadow: "0 4px 20px rgba(26,179,200,0.18), 0 2px 8px rgba(0,0,0,0.10)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "14px", width: "400px",
      color: C.text, display: "flex", flexDirection: "column",
      top: "-9999px", left: "-9999px",
    })
  });

  // ── Header (title only) ──
  const header = el("div", {
    style: css({
      background: C.headerBg, borderBottom: `1px solid ${C.brandMid}`,
      padding: "8px 14px", display: "flex", alignItems: "center",
      gap: "8px", flexShrink: "0"
    })
  });
  const titleSpan = el("span", {
    style: css({ fontWeight: "700", fontSize: "13px", letterSpacing: "0.05em", color: C.brandDark, flex: "1" }),
    textContent: T.title
  });
  const closeBtn = el("button", {
    style: css({ background: "none", border: "none", color: C.brandDark, fontSize: "20px", cursor: "pointer", padding: "0", lineHeight: "1" }),
    textContent: "×"
  });
  closeBtn.addEventListener("click", removePopup);
  header.append(titleSpan, closeBtn);
  popup.appendChild(header);

  // ── Tabs ──
  const tabBar = el("div", {
    style: css({
      display: "flex", flexShrink: "0",
      borderBottom: `1px solid ${C.tabBorder}`,
      background: C.headerBg,
    })
  });

  function makeTab(id, label) {
    const tab = el("button", {
      style: css({
        flex: "1", padding: "7px 0", fontSize: "12px", fontWeight: "600",
        border: "none", borderBottom: "2px solid transparent",
        background: "none", cursor: "pointer", color: C.sub,
        transition: "color 0.15s, border-color 0.15s",
      }),
      textContent: label
    });
    tab.dataset.tabId = id;
    return tab;
  }

  const tabOpen     = makeTab("open",     T.tabOpen);
  const tabExamples = makeTab("examples", T.tabExamples);
  tabBar.append(tabOpen, tabExamples);
  popup.appendChild(tabBar);

  // ── Body (scrollable) ──
  const body = el("div", {
    style: css({ overflowY: "auto", maxHeight: "62vh", display: "flex", flexDirection: "column" })
  });
  popup.appendChild(body);

  // ── Footer ──
  const footer = el("div", {
    style: css({
      padding: "5px 14px", fontSize: "11px", color: "#aaa",
      borderTop: `1px solid ${C.brandLight}`, textAlign: "right", flexShrink: "0"
    }),
    textContent: T.escHint
  });
  popup.appendChild(footer);

  // ── Tab switching ──
  let activeTab = null;

  function activateTab(id) {
    if (activeTab === id) return;
    activeTab = id;

    [tabOpen, tabExamples].forEach(t => {
      const isActive = t.dataset.tabId === id;
      t.style.color       = isActive ? C.brandDark : C.sub;
      t.style.borderBottom = isActive ? `2px solid ${C.brand}` : "2px solid transparent";
      t.style.background  = isActive ? C.white : "none";
    });

    body.innerHTML = "";
    if (id === "open")     renderOpenTab(body, selectedText);
    if (id === "examples") renderExamplesTab(body);
  }

  tabOpen.addEventListener("click",     () => activateTab("open"));
  tabExamples.addEventListener("click", () => activateTab("examples"));

  // Place popup in DOM before measuring
  document.body.appendChild(popup);
  activateTab(initialTab);

  // ── Position ──
  const pw = popup.offsetWidth, ph = popup.offsetHeight;
  const vw = window.innerWidth,  vh = window.innerHeight;
  const M = 8;
  let top, left;

  if (initialTab === "open" && anchorRect && anchorRect.width > 0) {
    // Near selection
    top  = anchorRect.bottom + M;
    left = anchorRect.left;
    if (top + ph > vh - M) top = anchorRect.top - ph - M;
    left = Math.max(M, Math.min(left, vw - pw - M));
    if (top < M) top = Math.max(M, (vh - ph) / 2);
  } else {
    // Upper-center
    top  = Math.max(M, Math.floor(vh * 0.12));
    left = Math.max(M, Math.floor((vw - pw) / 2));
  }
  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;

  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Tab: Open selected ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderOpenTab(container, initialText) {
  // Search input
  const inputWrap = el("div", {
    style: css({ padding: "8px 10px 4px", borderBottom: `1px solid ${C.brandLight}` })
  });
  const input = el("input", {
    type: "text",
    value: initialText,
    placeholder: T.idPlaceholder,
    style: css({
      width: "100%", padding: "6px 10px",
      border: `1px solid ${C.brandMid}`, borderRadius: "6px",
      fontSize: "13px", outline: "none", boxSizing: "border-box",
      fontFamily: "monospace",
    })
  });
  input.addEventListener("focus", () => { input.style.borderColor = C.brand; });
  input.addEventListener("blur",  () => { input.style.borderColor = C.brandMid; });
  inputWrap.appendChild(input);
  container.appendChild(inputWrap);

  const resultWrap = el("div", { style: css({ padding: "4px 0" }) });
  container.appendChild(resultWrap);

  let debounceTimer = null;
  async function update(text) {
    resultWrap.innerHTML = "";
    if (!text.trim()) return;

    const flat = await getCandidates(text.trim());
    // Group by db.key
    const grouped = new Map();
    for (const c of flat) {
      if (!grouped.has(c.db.key)) grouped.set(c.db.key, { db: c.db, items: [] });
      grouped.get(c.db.key).items.push({ prefix: c.prefix, resolvedId: c.resolvedId });
    }

    if (grouped.size === 0) {
      resultWrap.appendChild(msgEl(T.noMatch(text.trim())));
      return;
    }

    for (const [, { db, items }] of grouped) {
      if (items.length === 1) {
        const { prefix, resolvedId } = items[0];
        resultWrap.appendChild(openRowEl(db.label, prefix.uri + resolvedId, false));
      } else {
        // First prefix: direct open row; rest: More toggle
        const first = items[0];
        const rest  = items.slice(1);
        const section = el("div");

        const topRow = el("div", {
          style: css({ display: "flex", alignItems: "center", padding: "8px 14px", gap: "8px" })
        });
        const icon     = el("span", { style: css({ fontSize: "12px", color: C.brand, flexShrink: "0" }), textContent: "↗" });
        const dbLabel  = el("span", { style: css({ flex: "1", cursor: "pointer" }), textContent: db.label });
        const firstUrl = el("span", {
          style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace",
            maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }),
          textContent: first.prefix.uri + first.resolvedId
        });
        const moreBtn = el("span", {
          style: css({ fontSize: "11px", color: C.brandDark, background: C.brandLight,
            padding: "1px 8px", borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: "0", userSelect: "none" }),
          textContent: T.more
        });
        topRow.append(icon, dbLabel, firstUrl, moreBtn);
        topRow.addEventListener("mouseover", () => { topRow.style.background = C.hoverBg; });
        topRow.addEventListener("mouseout",  () => { topRow.style.background = ""; });
        topRow.addEventListener("click", e => {
          if (e.target === moreBtn || moreBtn.contains(e.target)) return;
          window.open(first.prefix.uri + first.resolvedId, "_blank", "noopener");
          removePopup();
        });

        const subList = el("div", { style: css({ display: "none" }) });
        for (const { prefix, resolvedId } of rest) {
          subList.appendChild(openRowEl(prefix.label, prefix.uri + resolvedId, true));
        }
        let open = false;
        moreBtn.addEventListener("click", e => {
          e.stopPropagation();
          open = !open;
          moreBtn.textContent = open ? T.less : T.more;
          subList.style.display = open ? "block" : "none";
        });

        section.append(topRow, subList);
        resultWrap.appendChild(section);
      }
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => update(input.value), 120);
  });

  // Initial render
  update(initialText);

  // Focus input
  setTimeout(() => { input.focus(); if (initialText) input.select(); }, 50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Tab: Show examples ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderExamplesTab(container) {
  // ── View A: DB search ──
  async function showDbSearch() {
    container.innerHTML = "";

    const searchWrap = el("div", {
      style: css({ padding: "8px 10px 4px", borderBottom: `1px solid ${C.brandLight}` })
    });
    const searchInput = el("input", {
      type: "text", placeholder: T.searchPlaceholder,
      style: css({
        width: "100%", padding: "6px 10px",
        border: `1px solid ${C.brandMid}`, borderRadius: "6px",
        fontSize: "13px", outline: "none", boxSizing: "border-box",
      })
    });
    searchInput.addEventListener("focus", () => { searchInput.style.borderColor = C.brand; });
    searchInput.addEventListener("blur",  () => { searchInput.style.borderColor = C.brandMid; });
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    const listWrap = el("div", { style: css({ padding: "4px 0" }) });
    container.appendChild(listWrap);

    const [allDbs, recentKeys] = await Promise.all([getAllDbs(), getRecentDbs()]);

    function renderDbList(q) {
      listWrap.innerHTML = "";
      const filtered = q
        ? allDbs.filter(d => d.label.toLowerCase().includes(q) || d.key.toLowerCase().includes(q))
        : null;

      if (filtered) {
        // Flat search results
        if (filtered.length === 0) { listWrap.appendChild(msgEl(T.noDbFound)); return; }
        for (const db of filtered) listWrap.appendChild(dbRowEl(db.label, () => showExamples(db)));
        return;
      }

      // No query: Recent + All sections
      if (recentKeys.length > 0) {
        listWrap.appendChild(sectionHeader(T.recentSection));
        const recentDbs = recentKeys.map(k => allDbs.find(d => d.key === k)).filter(Boolean);
        for (const db of recentDbs) listWrap.appendChild(dbRowEl(db.label, () => showExamples(db)));
        listWrap.appendChild(el("div", { style: css({ borderTop: `1px solid ${C.brandLight}`, margin: "4px 0" }) }));
      }
      listWrap.appendChild(sectionHeader(T.allSection));
      for (const db of allDbs) listWrap.appendChild(dbRowEl(db.label, () => showExamples(db)));
    }

    searchInput.addEventListener("input", () => renderDbList(searchInput.value.trim().toLowerCase()));
    renderDbList("");
    setTimeout(() => searchInput.focus(), 50);
  }

  function sectionHeader(label) {
    return el("div", {
      style: css({ padding: "4px 14px 2px", fontSize: "11px", fontWeight: "700",
        color: C.brandDark, letterSpacing: "0.06em", textTransform: "uppercase" }),
      textContent: label
    });
  }

  // ── View B: Examples for a DB ──
  async function showExamples(db) {
    await pushRecentDb(db.key);
    container.innerHTML = "";

    // Get active prefixes
    const storage = await chrome.storage.sync.get("disabled");
    const disabled = storage.disabled || {};
    const activePrefixes = (db.prefix || []).filter(p => !disabled[`${db.key}__${p.label}`]);

    // Toolbar: Back + prefix selector
    const toolbar = el("div", {
      style: css({
        padding: "6px 10px", borderBottom: `1px solid ${C.brandLight}`,
        display: "flex", alignItems: "center", gap: "8px", flexShrink: "0",
        background: "#fafffe"
      })
    });

    const backBtn = el("button", {
      style: css({ background: "none", border: "none", color: C.brandDark, cursor: "pointer", fontSize: "13px", padding: "2px 6px", borderRadius: "4px" }),
      textContent: T.back
    });
    backBtn.addEventListener("mouseover", () => { backBtn.style.background = C.brandLight; });
    backBtn.addEventListener("mouseout",  () => { backBtn.style.background = ""; });
    backBtn.addEventListener("click", showDbSearch);

    const dbNameEl = el("span", {
      style: css({ fontWeight: "600", fontSize: "13px", flex: "1", color: C.brandDark }),
      textContent: db.label
    });
    toolbar.append(backBtn, dbNameEl);

    let selectedPrefixIndex = 0;
    if (activePrefixes.length > 1) {
      const sep = el("span", { style: css({ color: C.brandMid }), textContent: "|" });
      const prefixLabel = el("span", { style: css({ fontSize: "12px", color: C.sub }), textContent: T.selectPrefix });
      const select = el("select", {
        style: css({
          fontSize: "12px", border: `1px solid ${C.brandMid}`, borderRadius: "4px",
          padding: "2px 6px", background: C.white, color: C.brandDark, cursor: "pointer", outline: "none"
        })
      });
      activePrefixes.forEach((p, i) => {
        select.appendChild(el("option", { value: String(i), textContent: p.label }));
      });
      select.addEventListener("change", () => { selectedPrefixIndex = parseInt(select.value); });
      toolbar.append(sep, prefixLabel, select);
    }
    container.appendChild(toolbar);

    const examples = db.examples || [];
    if (examples.length === 0) {
      container.appendChild(msgEl("No examples available."));
      return;
    }

    const listWrap = el("div", { style: css({ padding: "4px 0" }) });
    container.appendChild(listWrap);

    function openWithPrefix(id) {
      if (activePrefixes.length === 0) return;
      const match = id.match(db.regex);
      const resolvedId = match ? extractId(match) : id;
      window.open(activePrefixes[selectedPrefixIndex].uri + resolvedId, "_blank", "noopener");
    }

    if (examples.length === 1) {
      for (const id of examples[0]) listWrap.appendChild(exampleRowEl(id, false, openWithPrefix));
    } else {
      for (const series of examples) {
        if (!series.length) continue;
        const section = el("div");
        const hdrBtn = el("div", {
          style: css({ display: "flex", alignItems: "center", padding: "7px 14px", cursor: "pointer", gap: "8px", userSelect: "none", background: "#f9fefe" })
        });
        const arrow = el("span", { style: css({ fontSize: "11px", color: C.brand, transition: "transform 0.15s" }), textContent: "▶" });
        const firstId = el("code", {
          style: css({ fontFamily: "monospace", fontSize: "13px", flex: "1", color: C.brandDark }),
          textContent: series[0]
        });
        const cntBadge = el("span", {
          style: css({ fontSize: "11px", color: C.brandDark, background: C.brandLight, padding: "1px 6px", borderRadius: "10px" }),
          textContent: `${series.length}`
        });
        hdrBtn.append(arrow, firstId, cntBadge);
        hdrBtn.addEventListener("mouseover", () => { hdrBtn.style.background = C.hoverBg; });
        hdrBtn.addEventListener("mouseout",  () => { hdrBtn.style.background = "#f9fefe"; });

        const subList = el("div", { style: css({ display: "none" }) });
        for (const id of series) subList.appendChild(exampleRowEl(id, true, openWithPrefix));

        let open = false;
        hdrBtn.addEventListener("click", () => {
          open = !open;
          arrow.style.transform = open ? "rotate(90deg)" : "";
          subList.style.display = open ? "block" : "none";
        });
        section.append(hdrBtn, subList);
        listWrap.appendChild(section);
      }
    }
  }

  showDbSearch();
}

// ── Example row ───────────────────────────────────────────────────────────────
function exampleRowEl(id, isIndented, openFn) {
  const row = el("div", {
    style: css({
      display: "flex", alignItems: "center",
      padding: isIndented ? "5px 14px 5px 30px" : "6px 14px",
      gap: "8px", borderBottom: `1px solid #f0f0f0`
    })
  });
  const idEl = el("code", {
    style: css({ flex: "1", fontFamily: "monospace", fontSize: "13px", color: C.text }),
    textContent: id
  });
  const copyBtn = el("button", {
    style: css({ fontSize: "11px", padding: "2px 8px", border: `1px solid ${C.brandMid}`,
      borderRadius: "4px", background: C.white, color: C.brandDark, cursor: "pointer", whiteSpace: "nowrap" }),
    textContent: T.copy
  });
  copyBtn.addEventListener("click", async e => {
    e.stopPropagation();
    await navigator.clipboard.writeText(id);
    copyBtn.textContent = T.copied;
    setTimeout(() => { copyBtn.textContent = T.copy; }, 1500);
  });
  const openBtn = el("button", {
    style: css({ fontSize: "11px", padding: "2px 8px", border: `1px solid ${C.brand}`,
      borderRadius: "4px", background: C.brandLight, color: C.brandDark, cursor: "pointer", whiteSpace: "nowrap" }),
    textContent: T.openUrl
  });
  openBtn.addEventListener("click", e => { e.stopPropagation(); openFn(id); });
  row.append(idEl, copyBtn, openBtn);
  return row;
}
