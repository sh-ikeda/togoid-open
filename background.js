// background.js — Service Worker
// Responsibilities:
//   - Listen for hotkey command → inject content script if needed, then trigger popup
// Context menu is no longer used.

importScripts("databases.js");

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-togoid") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // chrome:// and other restricted URLs cannot have content scripts injected
  if (!tab.url || !tab.url.startsWith("http")) return;

  // Try sending a message; if the content script is already loaded it will respond.
  // If not, inject it first, then send.
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "show-popup" });
  } catch (_e) {
    // Content script not yet present → inject programmatically, then send
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["databases.js", "content.js"]
    });
    // Small delay to let the scripts initialize
    await new Promise(r => setTimeout(r, 80));
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "show-popup" });
    } catch (e2) {
      console.error("TogoID: could not send message after injection", e2);
    }
  }
});
