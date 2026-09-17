// 把内容脚本补注入到已经打开的 ChatGPT 标签页。
// 扩展重载 / 更新 / 禁用后再启用时，旧标签页里的内容脚本会变成孤儿（chrome.* API 被拆掉），
// 计数会悄悄停掉，直到手动刷新页面。内容脚本自带接管机制，重复注入是安全的。

const TARGET_MATCHES = ["https://chatgpt.com/*", "https://chat.openai.com/*"];

let reinjected = false;

function reinjectAll() {
  // service worker 启动和 onInstalled 可能先后触发，同一次生命周期只做一遍
  if (reinjected) return;
  reinjected = true;
  chrome.tabs.query({ url: TARGET_MATCHES }, (tabs) => {
    if (chrome.runtime.lastError || !Array.isArray(tabs)) return;
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.scripting
        .insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] })
        .catch(() => {});
      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: ["src/shared.js", "src/site-locales.js", "src/site-detection.js", "src/content.js"] })
        .catch(() => {});
    }
  });
}

chrome.runtime.onInstalled.addListener(reinjectAll);
// onInstalled 只在安装 / 更新 / 重载时触发，禁用后再启用不会触发；
// 但 service worker 每次被拉起（包括启用）都会跑一遍顶层代码，所以这里也补一次。
reinjectAll();
