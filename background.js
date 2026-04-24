// background.js — Service Worker

importScripts("databases.js");

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.startsWith("http")) return;

  async function tryInject() {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["databases.js", "content.js"]
    });
    await new Promise(r => setTimeout(r, 80));
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch {
    await tryInject();
    try {
      return await chrome.tabs.sendMessage(tab.id, { type });
    } catch (e) {
      console.error("TogoID: sendMessage failed after injection", e);
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-selected") {
    // Toggle: if popup is open, close it; otherwise open
    const isOpen = await sendToActiveTab("query-popup");
    if (isOpen) {
      await sendToActiveTab("close-popup");
    } else {
      await sendToActiveTab("show-popup");
    }
  }

  if (command === "show-examples") {
    const isOpen = await sendToActiveTab("query-popup");
    if (isOpen) {
      await sendToActiveTab("close-popup");
    } else {
      await sendToActiveTab("show-browser");
    }
  }
});
