// content.js — injected into every page
// 1. Watches selection changes → notifies background to rebuild context menu
// 2. On hotkey message → shows inline popup with candidate links

// ── Selection tracking ────────────────────────────────────────────────────────

let _lastSelection = "";

document.addEventListener("mouseup", () => {
  const sel = window.getSelection()?.toString() ?? "";
  if (sel !== _lastSelection) {
    _lastSelection = sel;
    chrome.runtime.sendMessage({ type: "selection-changed", text: sel });
  }
});

document.addEventListener("keyup", () => {
  const sel = window.getSelection()?.toString() ?? "";
  if (sel !== _lastSelection) {
    _lastSelection = sel;
    chrome.runtime.sendMessage({ type: "selection-changed", text: sel });
  }
});

// ── Popup ─────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "show-popup") {
    showPopup();
  }
});

function showPopup() {
  // Remove existing popup if any
  removePopup();

  const selectedText = window.getSelection()?.toString()?.trim() ?? "";
  const candidates = getCandidates(selectedText);

  // Build popup element
  const popup = document.createElement("div");
  popup.id = "togoid-popup";
  popup.setAttribute("style", [
    "position: fixed",
    "z-index: 2147483647",
    "top: 50%",
    "left: 50%",
    "transform: translate(-50%, -50%)",
    "background: #ffffff",
    "border: 1.5px solid #cccccc",
    "border-radius: 8px",
    "box-shadow: 0 4px 24px rgba(0,0,0,0.18)",
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-size: 14px",
    "min-width: 280px",
    "max-width: 460px",
    "padding: 0",
    "overflow: hidden",
    "color: #1a1a1a"
  ].join("; "));

  // Header
  const header = document.createElement("div");
  header.setAttribute("style", [
    "background: #1a5276",
    "color: #ffffff",
    "padding: 10px 14px",
    "display: flex",
    "align-items: center",
    "justify-content: space-between"
  ].join("; "));

  const title = document.createElement("span");
  title.setAttribute("style", "font-weight: 600; font-size: 13px; letter-spacing: 0.03em;");
  title.textContent = "TogoID Open";

  const idLabel = document.createElement("span");
  idLabel.setAttribute("style", [
    "font-size: 12px",
    "background: rgba(255,255,255,0.15)",
    "padding: 2px 8px",
    "border-radius: 4px",
    "font-family: monospace",
    "max-width: 200px",
    "overflow: hidden",
    "text-overflow: ellipsis",
    "white-space: nowrap"
  ].join("; "));
  idLabel.textContent = selectedText || "(no selection)";

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("style", [
    "background: none",
    "border: none",
    "color: #ffffff",
    "font-size: 18px",
    "cursor: pointer",
    "padding: 0 0 0 12px",
    "line-height: 1",
    "opacity: 0.8"
  ].join("; "));
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", removePopup);

  header.appendChild(title);
  header.appendChild(idLabel);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // Body
  const body = document.createElement("div");
  body.setAttribute("style", "padding: 8px 0;");

  if (!selectedText) {
    body.appendChild(makeMessage("テキストが選択されていません。"));
  } else if (candidates.length === 0) {
    body.appendChild(makeMessage(`"${selectedText}" に一致するデータベースが見つかりませんでした。`));
  } else {
    candidates.forEach((c) => {
      const needsQualifier = c.db.prefix.length > 1;
      const itemLabel = needsQualifier
        ? `${c.db.label} (${c.prefix.label})`
        : c.db.label;
      const url = c.prefix.uri + selectedText;

      const row = document.createElement("div");
      row.setAttribute("style", [
        "display: flex",
        "align-items: center",
        "padding: 7px 14px",
        "cursor: pointer",
        "transition: background 0.1s"
      ].join("; "));
      row.addEventListener("mouseover", () => { row.style.background = "#eaf2fb"; });
      row.addEventListener("mouseout",  () => { row.style.background = ""; });
      row.addEventListener("click", () => {
        window.open(url, "_blank", "noopener");
        removePopup();
      });

      const icon = document.createElement("span");
      icon.setAttribute("style", "margin-right: 8px; font-size: 13px; opacity: 0.5;");
      icon.textContent = "↗";

      const labelEl = document.createElement("span");
      labelEl.setAttribute("style", "flex: 1;");
      labelEl.textContent = itemLabel;

      const urlEl = document.createElement("span");
      urlEl.setAttribute("style", [
        "font-size: 11px",
        "color: #888",
        "font-family: monospace",
        "margin-left: 8px",
        "max-width: 180px",
        "overflow: hidden",
        "text-overflow: ellipsis",
        "white-space: nowrap"
      ].join("; "));
      urlEl.textContent = url;

      row.appendChild(icon);
      row.appendChild(labelEl);
      row.appendChild(urlEl);
      body.appendChild(row);
    });
  }

  popup.appendChild(body);

  // Footer hint
  const footer = document.createElement("div");
  footer.setAttribute("style", [
    "padding: 6px 14px",
    "font-size: 11px",
    "color: #aaa",
    "border-top: 1px solid #eee",
    "text-align: right"
  ].join("; "));
  footer.textContent = "Esc で閉じる";
  popup.appendChild(footer);

  document.body.appendChild(popup);

  // Dismiss on Escape or outside click
  setTimeout(() => {
    document.addEventListener("keydown", onEscKey);
    document.addEventListener("mousedown", onOutsideClick);
  }, 0);
}

function makeMessage(text) {
  const el = document.createElement("div");
  el.setAttribute("style", "padding: 12px 14px; color: #666;");
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
  const existing = document.getElementById("togoid-popup");
  if (existing) existing.remove();
  document.removeEventListener("keydown", onEscKey);
  document.removeEventListener("mousedown", onOutsideClick);
}
