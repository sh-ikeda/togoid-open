// background.js — Service Worker

importScripts("databases.js");

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-togoid") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.startsWith("http")) return;

  // Ask content script whether text is selected
  async function sendMsg(type) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type });
    } catch {
      // Inject scripts and retry
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["databases.js", "content.js"] });
      await new Promise(r => setTimeout(r, 80));
      try { await chrome.tabs.sendMessage(tab.id, { type }); } catch (e) {
        console.error("TogoID: sendMessage failed after injection", e);
      }
    }
  }

  // Query selection state from content script first
  let hasSelection = false;
  try {
    hasSelection = await chrome.tabs.sendMessage(tab.id, { type: "query-selection" });
  } catch {
    // Content script not loaded yet; inject then query
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["databases.js", "content.js"] });
    await new Promise(r => setTimeout(r, 80));
    try { hasSelection = await chrome.tabs.sendMessage(tab.id, { type: "query-selection" }); } catch {}
  }

  await sendMsg(hasSelection ? "show-popup" : "show-browser");
});
