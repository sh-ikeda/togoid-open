// content.js — injected into pages

if (!window.__togoIdLoaded) {
  window.__togoIdLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "show-popup") showPopup();
  });
}

// ── Popup ─────────────────────────────────────────────────────────────────────

async function showPopup() {
  removePopup();

  const selectedText = window.getSelection()?.toString()?.trim() ?? "";

  // getCandidates returns [{db, prefix}] — group by db
  const flat = await getCandidates(selectedText);

  // Build grouped structure: Map<dbKey, {db, prefixes:[]}>
  const grouped = new Map();
  for (const c of flat) {
    if (!grouped.has(c.db.key)) grouped.set(c.db.key, { db: c.db, prefixes: [] });
    grouped.get(c.db.key).prefixes.push(c.prefix);
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  const popup = el("div", {
    id: "togoid-popup",
    style: css({
      position: "fixed", zIndex: "2147483647",
      top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      background: "#fff", border: "1.5px solid #ccc", borderRadius: "8px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "14px", width: "360px", overflow: "hidden", color: "#1a1a1a",
      display: "flex", flexDirection: "column",
      // max-height set below after measuring viewport
    })
  });

  // Header
  const header = el("div", {
    style: css({
      background: "#1a5276", color: "#fff",
      padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px",
      flexShrink: "0"
    })
  });
  const titleSpan = el("span", {
    style: css({ fontWeight: "600", fontSize: "13px", letterSpacing: "0.03em" }),
    textContent: "TogoID Open"
  });
  const idBadge = el("span", {
    style: css({
      fontSize: "12px", background: "rgba(255,255,255,0.15)",
      padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace",
      flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    }),
    textContent: selectedText || "(no selection)"
  });
  const closeBtn = el("button", {
    style: css({
      background: "none", border: "none", color: "#fff",
      fontSize: "20px", cursor: "pointer", padding: "0", lineHeight: "1", opacity: "0.8"
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
    for (const [, { db, prefixes }] of grouped) {
      if (prefixes.length === 1) {
        // Single prefix → clicking DB name opens directly
        const url = prefixes[0].uri + selectedText;
        body.appendChild(dbRow(db.label, url, false));
      } else {
        // Multiple prefixes → accordion
        const section = el("div");

        const dbBtn = el("div", {
          style: css({
            display: "flex", alignItems: "center", padding: "8px 14px",
            cursor: "pointer", gap: "8px", userSelect: "none"
          })
        });
        const arrow = el("span", {
          style: css({ fontSize: "11px", opacity: "0.5", transition: "transform 0.15s", flexShrink: "0" }),
          textContent: "▶"
        });
        const dbLabel = el("span", { style: css({ flex: "1" }), textContent: db.label });
        const countBadge = el("span", {
          style: css({
            fontSize: "11px", color: "#888", background: "#f0f0f0",
            padding: "1px 6px", borderRadius: "10px"
          }),
          textContent: `${prefixes.length}`
        });
        dbBtn.append(arrow, dbLabel, countBadge);
        dbBtn.addEventListener("mouseover", () => { dbBtn.style.background = "#f5f5f5"; });
        dbBtn.addEventListener("mouseout",  () => { dbBtn.style.background = ""; });

        const subList = el("div", { style: css({ display: "none" }) });
        for (const prefix of prefixes) {
          const url = prefix.uri + selectedText;
          subList.appendChild(prefixRow(prefix.label, url));
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

  // Footer
  const footer = el("div", {
    style: css({
      padding: "6px 14px", fontSize: "11px", color: "#aaa",
      borderTop: "1px solid #eee", textAlign: "right", flexShrink: "0"
    }),
    textContent: "Esc または外側クリックで閉じる"
  });
  popup.appendChild(footer);

  document.body.appendChild(popup);

  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

// ── Row builders ──────────────────────────────────────────────────────────────

function dbRow(label, url, isIndented) {
  const row = el("div", {
    style: css({
      display: "flex", alignItems: "center",
      padding: isIndented ? "7px 14px 7px 36px" : "8px 14px",
      cursor: "pointer", gap: "8px"
    })
  });
  row.addEventListener("mouseover", () => { row.style.background = "#eaf2fb"; });
  row.addEventListener("mouseout",  () => { row.style.background = ""; });
  row.addEventListener("click", () => { window.open(url, "_blank", "noopener"); removePopup(); });

  const icon = el("span", { style: css({ fontSize: "12px", opacity: "0.4", flexShrink: "0" }), textContent: "↗" });
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

function prefixRow(label, url) {
  return dbRow(label, url, true);
}

function msgEl(text) {
  return el("div", { style: css({ padding: "12px 14px", color: "#666" }), textContent: text });
}

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
  return Object.entries(obj).map(([k, v]) => {
    const prop = k.replace(/([A-Z])/g, m => "-" + m.toLowerCase());
    return `${prop}:${v}`;
  }).join(";");
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
