// background.js — service worker
// Manages context menu items and handles tab opening.

importScripts("databases.js");

// ── Context menu setup ────────────────────────────────────────────────────────

// We rebuild context menu items every time the selection changes.
// The content script sends us the selected text via a message.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "togoid-root",
    title: "TogoID Open",
    contexts: ["selection"]
  });
});

// Listen for selection change messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "selection-changed") {
    rebuildContextMenu(message.text);
  }
  if (message.type === "open-url") {
    chrome.tabs.create({ url: message.url });
  }
});

// Rebuild context menu children based on current selection
function rebuildContextMenu(selectedText) {
  // Remove all children of root first
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "togoid-root",
      title: "TogoID Open",
      contexts: ["selection"]
    });

    if (!selectedText || !selectedText.trim()) return;

    const candidates = getCandidates(selectedText.trim());

    if (candidates.length === 0) {
      chrome.contextMenus.create({
        id: "togoid-none",
        parentId: "togoid-root",
        title: "(No matching database)",
        contexts: ["selection"],
        enabled: false
      });
      return;
    }

    candidates.forEach((c, i) => {
      // Label: if db has only one prefix → show db.label only
      //        if db has multiple prefixes → show "db.label (prefix.label)"
      const needsQualifier = c.db.prefix.length > 1;
      const itemLabel = needsQualifier
        ? `${c.db.label} (${c.prefix.label})`
        : c.db.label;

      const url = c.prefix.uri + selectedText.trim();

      chrome.contextMenus.create({
        id: `togoid-item-${i}`,
        parentId: "togoid-root",
        title: itemLabel,
        contexts: ["selection"]
      });

      // Store mapping: item id → url (use session storage via a global map)
      _menuUrlMap[`togoid-item-${i}`] = url;
    });
  });
}

// Map from context menu item id → URL to open
const _menuUrlMap = {};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = _menuUrlMap[info.menuItemId];
  if (url) {
    chrome.tabs.create({ url });
  }
});

// ── Hotkey ────────────────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-togoid") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "show-popup" });
      }
    });
  }
});
