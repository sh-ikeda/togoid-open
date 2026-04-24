// background.js — Service Worker

importScripts("databases.js");

async function sendToActiveTab(type, payload = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.startsWith("http")) return;

  const msg = { type, ...payload };

  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["databases.js", "content.js"]
    });
    await new Promise(r => setTimeout(r, 80));
    try {
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch (e) {
      console.error("TogoID: sendMessage failed", e);
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-togoid") return;

  // Toggle: if popup is open, close it
  const isOpen = await sendToActiveTab("query-popup");
  if (isOpen) {
    await sendToActiveTab("close-popup");
    return;
  }

  // Determine initial tab based on whether text is selected
  const hasSelection = await sendToActiveTab("query-selection");
  await sendToActiveTab("show-popup", { initialTab: hasSelection ? "open" : "examples" });
});
