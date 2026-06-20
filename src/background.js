// Re-inject the content script into already-open ChatGPT tabs whenever the
// extension is (re)loaded or updated. Without this, reloading the extension
// orphans the content scripts in open tabs (chrome APIs are torn down), so
// tracking silently stops until each tab is manually refreshed.

const TARGET_MATCHES = ["https://chatgpt.com/*", "https://chat.openai.com/*"];

function reinjectAll() {
  chrome.tabs.query({ url: TARGET_MATCHES }, (tabs) => {
    if (chrome.runtime.lastError || !Array.isArray(tabs)) return;
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.scripting
        .insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] })
        .catch(() => {});
      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: ["src/shared.js", "src/content.js"] })
        .catch(() => {});
    }
  });
}

chrome.runtime.onInstalled.addListener(reinjectAll);
