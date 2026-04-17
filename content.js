// content.js — injected into pages
// Shows the TogoID popup when triggered by hotkey (via background.js message).

// Guard against double-injection
if (!window.__togoIdLoaded) {
  window.__togoIdLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "show-popup") {
      showPopup();
    }
  });
}

// ── Popup ─────────────────────────────────────────────────────────────────────

async function showPopup() {
  removePopup();

  const selectedText = window.getSelection()?.toString()?.trim() ?? "";
  const candidates = await getCandidates(selectedText);

  const popup = document.createElement("div");
  popup.id = "togoid-popup";
  Object.assign(popup.style, {
    position: "fixed",
    zIndex: "2147483647",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "#ffffff",
    border: "1.5px solid #cccccc",
    borderRadius: "8px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: "14px",
    minWidth: "300px",
    maxWidth: "480px",
    padding: "0",
    overflow: "hidden",
    color: "#1a1a1a"
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    background: "#1a5276",
    color: "#ffffff",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: "10px"
  });

  const title = document.createElement("span");
  Object.assign(title.style, { fontWeight: "600", fontSize: "13px", letterSpacing: "0.03em" });
  title.textContent = "TogoID Open";

  const idLabel = document.createElement("span");
  Object.assign(idLabel.style, {
    fontSize: "12px",
    background: "rgba(255,255,255,0.15)",
    padding: "2px 8px",
    borderRadius: "4px",
    fontFamily: "monospace",
    flex: "1",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  });
  idLabel.textContent = selectedText || "(no selection)";

  const closeBtn = document.createElement("button");
  Object.assign(closeBtn.style, {
    background: "none", border: "none", color: "#fff",
    fontSize: "18px", cursor: "pointer", padding: "0", lineHeight: "1", opacity: "0.8"
  });
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", removePopup);

  header.appendChild(title);
  header.appendChild(idLabel);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // Body
  const body = document.createElement("div");
  body.style.padding = "8px 0";

  if (!selectedText) {
    body.appendChild(makeMessage("テキストが選択されていません。"));
  } else if (candidates.length === 0) {
    body.appendChild(makeMessage(`"${selectedText}" に一致するデータベースが見つかりませんでした。`));
  } else {
    for (const c of candidates) {
      const needsQualifier = c.db.prefix.length > 1;
      const itemLabel = needsQualifier ? `${c.db.label} (${c.prefix.label})` : c.db.label;
      const url = c.prefix.uri + selectedText;

      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex", alignItems: "center",
        padding: "8px 14px", cursor: "pointer", gap: "8px"
      });
      row.addEventListener("mouseover", () => { row.style.background = "#eaf2fb"; });
      row.addEventListener("mouseout",  () => { row.style.background = ""; });
      row.addEventListener("click", () => {
        window.open(url, "_blank", "noopener");
        removePopup();
      });

      const icon = document.createElement("span");
      Object.assign(icon.style, { fontSize: "13px", opacity: "0.5", flexShrink: "0" });
      icon.textContent = "↗";

      const labelEl = document.createElement("span");
      labelEl.style.flex = "1";
      labelEl.textContent = itemLabel;

      const urlEl = document.createElement("span");
      Object.assign(urlEl.style, {
        fontSize: "11px", color: "#888", fontFamily: "monospace",
        maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
      });
      urlEl.textContent = url;

      row.appendChild(icon);
      row.appendChild(labelEl);
      row.appendChild(urlEl);
      body.appendChild(row);
    }
  }

  popup.appendChild(body);

  // Footer
  const footer = document.createElement("div");
  Object.assign(footer.style, {
    padding: "6px 14px", fontSize: "11px", color: "#aaa",
    borderTop: "1px solid #eee", textAlign: "right"
  });
  footer.textContent = "Esc または外側クリックで閉じる";
  popup.appendChild(footer);

  document.body.appendChild(popup);

  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

function makeMessage(text) {
  const el = document.createElement("div");
  Object.assign(el.style, { padding: "12px 14px", color: "#666" });
  el.textContent = text;
  return el;
}

function onEscKey(e) {
  if (e.key === "Escape") removePopup();
}

function onOutsideClick(e) {
  const popup = document.getElementById("togoid-popup");
  if (popup && !popup.contains(e.target)) removePopup();
}

function removePopup() {
  document.getElementById("togoid-popup")?.remove();
  document.removeEventListener("keydown", onEscKey);
  document.removeEventListener("mousedown", onOutsideClick);
}
