// content.js

if (!window.__togoIdLoaded) {
  window.__togoIdLoaded = true;
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "show-popup") showPopup();
  });
}

// ── Popup ─────────────────────────────────────────────────────────────────────

async function showPopup() {
  removePopup();

  const selection = window.getSelection();
  const selectedText = selection?.toString()?.trim() ?? "";

  // Get selection bounding rect for positioning
  let anchorRect = null;
  if (selection && selection.rangeCount > 0) {
    anchorRect = selection.getRangeAt(0).getBoundingClientRect();
  }

  const flat = await getCandidates(selectedText);

  // Group by db.key
  const grouped = new Map();
  for (const c of flat) {
    if (!grouped.has(c.db.key)) grouped.set(c.db.key, { db: c.db, items: [] });
    grouped.get(c.db.key).items.push({ prefix: c.prefix, resolvedId: c.resolvedId });
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────

  const popup = el("div", {
    id: "togoid-popup",
    style: css({
      position: "fixed",
      zIndex: "2147483647",
      background: "#fff",
      border: "1.5px solid #1ab3c8",
      borderRadius: "8px",
      boxShadow: "0 4px 20px rgba(26,179,200,0.18), 0 2px 8px rgba(0,0,0,0.10)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "14px",
      width: "380px",
      overflow: "hidden",
      color: "#1a1a1a",
      display: "flex",
      flexDirection: "column",
      // top/left set after measuring below
      top: "-9999px", left: "-9999px",
    })
  });

  // Header
  const header = el("div", {
    style: css({
      background: "#e0f7fa",
      borderBottom: "1px solid #b2ebf2",
      padding: "9px 14px",
      display: "flex", alignItems: "center", gap: "10px",
      flexShrink: "0"
    })
  });
  const titleSpan = el("span", {
    style: css({ fontWeight: "700", fontSize: "13px", letterSpacing: "0.05em", color: "#00838f" }),
    textContent: "TogoID Open"
  });
  const idBadge = el("span", {
    style: css({
      fontSize: "12px",
      background: "#fff",
      color: "#00697a",
      border: "1px solid #80deea",
      padding: "1px 8px", borderRadius: "4px", fontFamily: "monospace",
      flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    }),
    textContent: selectedText || "(no selection)"
  });
  const closeBtn = el("button", {
    style: css({
      background: "none", border: "none", color: "#00838f",
      fontSize: "20px", cursor: "pointer", padding: "0", lineHeight: "1"
    }),
    textContent: "×"
  });
  closeBtn.addEventListener("click", removePopup);
  header.append(titleSpan, idBadge, closeBtn);
  popup.appendChild(header);

  // Scrollable body
  const body = el("div", {
    style: css({ overflowY: "auto", maxHeight: "60vh", padding: "6px 0" })
  });

  if (!selectedText) {
    body.appendChild(msgEl("テキストが選択されていません。"));
  } else if (grouped.size === 0) {
    body.appendChild(msgEl(`"${selectedText}" に一致するデータベースが見つかりませんでした。`));
  } else {
    for (const [, { db, items }] of grouped) {
      if (items.length === 1) {
        const { prefix, resolvedId } = items[0];
        body.appendChild(dbRow(db.label, prefix.uri + resolvedId, false));
      } else {
        const section = el("div");
        const dbBtn = el("div", {
          style: css({
            display: "flex", alignItems: "center",
            padding: "8px 14px", cursor: "pointer", gap: "8px", userSelect: "none"
          })
        });
        const arrow = el("span", {
          style: css({ fontSize: "11px", color: "#1ab3c8", transition: "transform 0.15s", flexShrink: "0" }),
          textContent: "▶"
        });
        const dbLabel = el("span", { style: css({ flex: "1" }), textContent: db.label });
        const countBadge = el("span", {
          style: css({
            fontSize: "11px", color: "#00838f", background: "#e0f7fa",
            padding: "1px 6px", borderRadius: "10px"
          }),
          textContent: `${items.length}`
        });
        dbBtn.append(arrow, dbLabel, countBadge);
        dbBtn.addEventListener("mouseover", () => { dbBtn.style.background = "#f0fbfc"; });
        dbBtn.addEventListener("mouseout",  () => { dbBtn.style.background = ""; });

        const subList = el("div", { style: css({ display: "none" }) });
        for (const { prefix, resolvedId } of items) {
          subList.appendChild(dbRow(prefix.label, prefix.uri + resolvedId, true));
        }

        let open = false;
        dbBtn.addEventListener("click", () => {
          open = !open;
          arrow.style.transform = open ? "rotate(90deg)" : "";
          subList.style.display = open ? "block" : "none";
        });

        section.append(dbBtn, subList);
        body.appendChild(section);
      }
    }
  }

  popup.appendChild(body);

  const footer = el("div", {
    style: css({
      padding: "5px 14px", fontSize: "11px", color: "#aaa",
      borderTop: "1px solid #e0f7fa", textAlign: "right", flexShrink: "0"
    }),
    textContent: "Esc または外側クリックで閉じる"
  });
  popup.appendChild(footer);

  document.body.appendChild(popup);

  // ── Position near selection ───────────────────────────────────────────────
  // Measure popup size after it's in the DOM (but off-screen)
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const MARGIN = 8;

  let top, left;

  if (anchorRect && anchorRect.width > 0) {
    // Prefer: just below the selection, left-aligned to selection start
    top  = anchorRect.bottom + MARGIN;
    left = anchorRect.left;

    // Flip above if it would go off the bottom
    if (top + ph > vh - MARGIN) top = anchorRect.top - ph - MARGIN;

    // Clamp horizontally
    left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN));
    // Clamp vertically (fallback: center)
    if (top < MARGIN) top = Math.max(MARGIN, (vh - ph) / 2);
  } else {
    // No selection rect → center
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function dbRow(label, url, isIndented) {
  const row = el("div", {
    style: css({
      display: "flex", alignItems: "center",
      padding: isIndented ? "7px 14px 7px 36px" : "8px 14px",
      cursor: "pointer", gap: "8px"
    })
  });
  row.addEventListener("mouseover", () => { row.style.background = "#e0f7fa"; });
  row.addEventListener("mouseout",  () => { row.style.background = ""; });
  row.addEventListener("click", () => { window.open(url, "_blank", "noopener"); removePopup(); });

  const icon = el("span", {
    style: css({ fontSize: "12px", color: "#1ab3c8", flexShrink: "0" }),
    textContent: "↗"
  });
  const labelEl = el("span", { style: css({ flex: "1" }), textContent: label });
  const urlEl = el("span", {
    style: css({
      fontSize: "11px", color: "#aaa", fontFamily: "monospace",
      maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    }),
    textContent: url
  });
  row.append(icon, labelEl, urlEl);
  return row;
}

function msgEl(text) {
  return el("div", { style: css({ padding: "12px 14px", color: "#888" }), textContent: text });
}

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
