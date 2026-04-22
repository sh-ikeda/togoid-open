// content.js

if (!window.__togoIdLoaded) {
  window.__togoIdLoaded = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "show-popup")    { showOpenPopup();   return; }
    if (message.type === "show-browser")  { showBrowserPopup(); return; }
    if (message.type === "query-selection") {
      const sel = window.getSelection()?.toString()?.trim() ?? "";
      sendResponse(sel.length > 0);
      return true;
    }
  });
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  title:          "TogoID Open",
  noSelection:    "(no selection)",
  noMatch:        (t) => `No database matched "${t}".`,
  escHint:        "Esc or click outside to close",
  copy:           "Copy",
  copied:         "Copied!",
  openUrl:        "Open URL",
  back:           "← Back",
  searchPlaceholder: "Search databases…",
  noDbFound:      "No databases found.",
  examples:       "Examples",
  selectPrefix:   "Select destination:",
  more:           "More ▾",
  less:           "Less ▴",
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
  brandLight: "#e0f7fa",
  brandMid:   "#b2ebf2",
  headerBg:   "#e0f7fa",
  headerBorder:"#b2ebf2",
  hoverBg:    "#e0f7fa",
  text:       "#1a1a1a",
  sub:        "#666",
  white:      "#fff",
  border:     "#b2ebf2",
};

function makePopupShell(badgeText) {
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

  const header = el("div", {
    style: css({
      background: COLORS.headerBg, borderBottom: `1px solid ${COLORS.headerBorder}`,
      padding: "9px 14px", display: "flex", alignItems: "center", gap: "10px", flexShrink: "0"
    })
  });
  const titleSpan = el("span", {
    style: css({ fontWeight: "700", fontSize: "13px", letterSpacing: "0.05em", color: COLORS.brandDark }),
    textContent: T.title
  });
  const badge = el("span", {
    style: css({
      fontSize: "12px", background: COLORS.white, color: COLORS.brandDark,
      border: `1px solid ${COLORS.brandMid}`,
      padding: "1px 8px", borderRadius: "4px", fontFamily: "monospace",
      flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    }),
    textContent: badgeText
  });
  const closeBtn = el("button", {
    style: css({ background: "none", border: "none", color: COLORS.brandDark, fontSize: "20px", cursor: "pointer", padding: "0", lineHeight: "1" }),
    textContent: "×"
  });
  closeBtn.addEventListener("click", removePopup);
  header.append(titleSpan, badge, closeBtn);
  popup.appendChild(header);

  const body = el("div", { style: css({ overflowY: "auto", maxHeight: "65vh", padding: "6px 0" }) });
  popup.appendChild(body);

  const footer = el("div", {
    style: css({ padding: "5px 14px", fontSize: "11px", color: "#aaa", borderTop: `1px solid ${COLORS.brandLight}`, textAlign: "right", flexShrink: "0" }),
    textContent: T.escHint
  });
  popup.appendChild(footer);

  return { popup, header, badge, body };
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
    top  = (vh - ph) / 2;
    left = (vw - pw) / 2;
  }
  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;
  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

// Place browser popup: fixed width, positioned in upper area, scrollable body
function placeBrowserPopup(popup) {
  document.body.appendChild(popup);
  const vw = window.innerWidth, vh = window.innerHeight;
  const M = 12;
  const pw = popup.offsetWidth;

  // Cap popup height to 70% of viewport; body scrolls inside
  const maxH = Math.floor(vh * 0.70);
  const bodyEl = popup.querySelector("div[style*='overflow-y']");
  if (bodyEl) bodyEl.style.maxHeight = `${maxH - 120}px`; // subtract header+toolbar+footer

  const ph = Math.min(popup.offsetHeight, maxH);
  // Place at 12% from top (upper area, not center)
  const top  = Math.max(M, Math.floor(vh * 0.12));
  const left = Math.max(M, Math.min(Math.floor((vw - pw) / 2), vw - pw - M));

  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;

  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

function msgEl(text) {
  return el("div", { style: css({ padding: "12px 14px", color: COLORS.sub }), textContent: text });
}

function rowEl(label, url, isIndented, actions) {
  const row = el("div", {
    style: css({
      display: "flex", alignItems: "center",
      padding: isIndented ? "7px 14px 7px 36px" : "8px 14px",
      gap: "8px"
    })
  });
  const icon = el("span", { style: css({ fontSize: "12px", color: COLORS.brand, flexShrink: "0" }), textContent: "↗" });
  const labelEl = el("span", { style: css({ flex: "1" }), textContent: label });
  const urlEl = el("span", {
    style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
    textContent: url
  });
  row.append(icon, labelEl, urlEl);
  if (actions) row.append(...actions);
  row.style.cursor = "pointer";
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

// ── ① Open popup (existing feature: selected text → open URL) ─────────────────

async function showOpenPopup() {
  removePopup();
  const selection = window.getSelection();
  const selectedText = selection?.toString()?.trim() ?? "";
  let anchorRect = null;
  if (selection?.rangeCount > 0) anchorRect = selection.getRangeAt(0).getBoundingClientRect();

  const flat = await getCandidates(selectedText);
  const grouped = new Map();
  for (const c of flat) {
    if (!grouped.has(c.db.key)) grouped.set(c.db.key, { db: c.db, items: [] });
    grouped.get(c.db.key).items.push({ prefix: c.prefix, resolvedId: c.resolvedId });
  }

  const { popup, body } = makePopupShell(selectedText || T.noSelection);

  if (!selectedText) {
    body.appendChild(msgEl(T.noSelection));
  } else if (grouped.size === 0) {
    body.appendChild(msgEl(T.noMatch(selectedText)));
  } else {
    for (const [, { db, items }] of grouped) {
      if (items.length === 1) {
        // Single prefix: direct open row
        const { prefix, resolvedId } = items[0];
        body.appendChild(rowEl(db.label, prefix.uri + resolvedId, false));
      } else {
        // Multiple prefixes:
        //   - Top row: DB label (left) opens first prefix immediately
        //   - "More ▾" toggle (right) expands the remaining prefixes below
        const section = el("div");
        const first = items[0];
        const rest  = items.slice(1);

        // Top row
        const topRow = el("div", { style: css({ display: "flex", alignItems: "center", padding: "8px 14px", gap: "8px" }) });
        const icon = el("span", { style: css({ fontSize: "12px", color: COLORS.brand, flexShrink: "0" }), textContent: "↗" });
        const dbLabelEl = el("span", { style: css({ flex: "1", cursor: "pointer" }), textContent: db.label });
        const firstUrlEl = el("span", {
          style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }),
          textContent: first.prefix.uri + first.resolvedId
        });
        const moreBtn = el("span", {
          style: css({ fontSize: "11px", color: COLORS.brandDark, background: COLORS.brandLight, padding: "1px 8px", borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: "0", userSelect: "none" }),
          textContent: T.more
        });

        // Clicking DB label or URL part opens first prefix
        const openFirst = () => { window.open(first.prefix.uri + first.resolvedId, "_blank", "noopener"); removePopup(); };
        topRow.append(icon, dbLabelEl, firstUrlEl, moreBtn);
        topRow.addEventListener("mouseover", () => { topRow.style.background = COLORS.hoverBg; });
        topRow.addEventListener("mouseout",  () => { topRow.style.background = ""; });
        // Click on row body → open first; click on moreBtn → toggle
        topRow.addEventListener("click", (e) => {
          if (e.target === moreBtn || moreBtn.contains(e.target)) return;
          openFirst();
        });

        // Remaining prefixes (hidden until More is clicked)
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

  placePopup(popup, anchorRect);
}

// ── ② Browser popup (new feature: search DB → show examples) ─────────────────

async function showBrowserPopup() {
  removePopup();
  const { popup, badge, body } = makePopupShell(T.examples);
  badge.textContent = T.examples;

  // ── View A: DB search ──
  async function showDbSearch() {
    body.innerHTML = "";
    badge.textContent = T.examples;

    const searchWrap = el("div", { style: css({ padding: "8px 10px 4px", borderBottom: `1px solid ${COLORS.brandLight}` }) });
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

    const listWrap = el("div", { style: css({ padding: "4px 0" }) });
    body.appendChild(listWrap);

    const dbs = await getAllDbs();

    function renderDbList(q) {
      listWrap.innerHTML = "";
      const filtered = q ? dbs.filter(d => d.label.toLowerCase().includes(q) || d.key.toLowerCase().includes(q)) : dbs;
      if (filtered.length === 0) { listWrap.appendChild(msgEl(T.noDbFound)); return; }
      for (const db of filtered) {
        const row = el("div", {
          style: css({ display: "flex", alignItems: "center", padding: "8px 14px", cursor: "pointer", gap: "8px" })
        });
        row.addEventListener("mouseover", () => { row.style.background = COLORS.hoverBg; });
        row.addEventListener("mouseout",  () => { row.style.background = ""; });
        const nameEl = el("span", { style: css({ flex: "1", fontWeight: "500" }), textContent: db.label });
        const keyEl  = el("span", { style: css({ fontSize: "11px", color: "#aaa", fontFamily: "monospace" }), textContent: db.key });
        const arrow  = el("span", { style: css({ fontSize: "12px", color: COLORS.brand }), textContent: "›" });
        row.append(nameEl, keyEl, arrow);
        row.addEventListener("click", () => showExamples(db));
        listWrap.appendChild(row);
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

    // Get active prefixes for this DB (respecting disabled flags)
    const storage = await chrome.storage.sync.get("disabled");
    const disabled = storage.disabled || {};
    const activePrefixes = (db.prefix || []).filter(p => !disabled[`${db.key}__${p.label}`]);

    // ── Toolbar: Back button + prefix selector dropdown ──
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

    // Prefix selector (only shown when there are multiple active prefixes)
    let selectedPrefixIndex = 0;
    if (activePrefixes.length > 1) {
      const sep = el("span", { style: css({ color: COLORS.brandMid, fontSize: "12px" }), textContent: "|" });
      toolbar.appendChild(sep);

      const prefixLabel = el("span", { style: css({ fontSize: "12px", color: COLORS.sub }), textContent: T.selectPrefix });
      toolbar.appendChild(prefixLabel);

      const select = el("select", {
        style: css({
          fontSize: "12px", border: `1px solid ${COLORS.brandMid}`, borderRadius: "4px",
          padding: "2px 6px", background: COLORS.white, color: COLORS.brandDark,
          cursor: "pointer", outline: "none"
        })
      });
      activePrefixes.forEach((p, i) => {
        const opt = el("option", { value: String(i), textContent: p.label });
        select.appendChild(opt);
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

    const listWrap = el("div", { style: css({ padding: "4px 0" }) });
    body.appendChild(listWrap);

    // Helper: open URL using currently selected prefix
    function openWithSelectedPrefix(id) {
      if (activePrefixes.length === 0) return;
      const match = id.match(db.regex);
      const resolvedId = match ? extractId(match) : id;
      window.open(activePrefixes[selectedPrefixIndex].uri + resolvedId, "_blank", "noopener");
    }

    if (examples.length === 1) {
      for (const id of examples[0]) {
        listWrap.appendChild(exampleRow(id, false, openWithSelectedPrefix));
      }
    } else {
      for (const series of examples) {
        if (series.length === 0) continue;
        const section = el("div");

        const hdrBtn = el("div", {
          style: css({ display: "flex", alignItems: "center", padding: "7px 14px", cursor: "pointer", gap: "8px", userSelect: "none", background: "#f9fefe" })
        });
        const arrow = el("span", { style: css({ fontSize: "11px", color: COLORS.brand, transition: "transform 0.15s" }), textContent: "▶" });
        const firstId = el("code", {
          style: css({ fontFamily: "monospace", fontSize: "13px", flex: "1", color: COLORS.brandDark }),
          textContent: series[0]
        });
        const cntBadge = el("span", {
          style: css({ fontSize: "11px", color: COLORS.brandDark, background: COLORS.brandLight, padding: "1px 6px", borderRadius: "10px" }),
          textContent: `${series.length}`
        });
        hdrBtn.append(arrow, firstId, cntBadge);
        hdrBtn.addEventListener("mouseover", () => { hdrBtn.style.background = COLORS.hoverBg; });
        hdrBtn.addEventListener("mouseout",  () => { hdrBtn.style.background = "#f9fefe"; });

        const subList = el("div", { style: css({ display: "none" }) });
        for (const id of series) {
          subList.appendChild(exampleRow(id, true, openWithSelectedPrefix));
        }

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

  // ── Example row: id + copy + open ──
  // openFn(id): called when Open URL is clicked; uses currently selected prefix
  function exampleRow(id, isIndented, openFn) {
    const row = el("div", {
      style: css({
        display: "flex", alignItems: "center",
        padding: isIndented ? "5px 14px 5px 30px" : "6px 14px",
        gap: "8px", borderBottom: `1px solid #f0f0f0`
      })
    });

    const idEl = el("code", {
      style: css({ flex: "1", fontFamily: "monospace", fontSize: "13px", color: COLORS.text }),
      textContent: id
    });

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
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFn(id);
    });

    row.append(idEl, copyBtn, openBtn);
    return row;
  }

  showDbSearch();
  // Position: upper-center (not vertically centered — keeps popup in upper portion)
  placeBrowserPopup(popup);
}

// ── extractId (also needed in content.js for open-URL button) ─────────────────
function extractId(match) {
  const groups = match.groups || {};
  if (groups.id !== undefined) return groups.id;
  for (let i = 1; i <= 9; i++) {
    if (groups[`id${i}`] !== undefined) return groups[`id${i}`];
  }
  return match[1] !== undefined ? match[1] : match[0];
}
