(function () {
  "use strict";

  // 防重复注入：清单注入与后台 re-inject 偶尔会同时落到同一隔离环境，重复会造成双重计数。
  // 该标记存在隔离环境的 window 上，扩展重载时随旧上下文清空，不影响重载后的复活。
  if (window.__cmtTrackerInjected) return;
  window.__cmtTrackerInjected = true;

  const Core = window.ChatGPTTrackerCore;
  const WIDGET_ID = "cmt-widget";
  const TRACK_DEBOUNCE_MS = 1000;
  const DETECT_DEBOUNCE_MS = 1500;

  let settings = null;
  let usage = null;
  let lastTrackedAt = 0;
  let refreshTimer = 0;
  let detectTimer = 0;
  let observer = null;
  let extensionAvailable = true;

  // 扩展被重新加载后，旧标签页里的脚本变成孤儿：chrome.runtime.id 会变为 undefined，
  // 再访问 chrome.storage 就抛 "reading 'local'"。用它主动判断，比匹配错误字符串可靠。
  function extensionContextValid() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  function isExtensionContextError(error) {
    const message = String((error && error.message) || error || "");
    return (
      message.includes("Extension context invalidated") ||
      message.includes("context invalidated") ||
      !extensionContextValid()
    );
  }

  function teardown() {
    if (!extensionAvailable) return;
    extensionAvailable = false;
    try {
      if (observer) observer.disconnect();
    } catch (error) {
      // observer 可能已失效，忽略
    }
    window.clearTimeout(refreshTimer);
    window.clearTimeout(detectTimer);
    const root = widgetRoot();
    if (root) root.remove();
  }

  function handleAsyncError(error) {
    if (isExtensionContextError(error)) {
      teardown();
      return;
    }
    console.warn("[ChatGPT Tracker]", error);
  }

  function runAsync(task) {
    Promise.resolve()
      .then(task)
      .catch(handleAsyncError);
  }

  function getActiveMode() {
    if (!settings) return null;
    return settings.modes.find((mode) => mode.id === settings.activeModeId) || settings.modes[0];
  }

  function getComposer(target) {
    if (!target || !(target instanceof Element)) return null;
    return (
      target.closest("#prompt-textarea") ||
      target.closest('[data-testid="prompt-textarea"]') ||
      target.closest("textarea") ||
      target.closest('[contenteditable="true"]')
    );
  }

  function composerHasText(composer) {
    if (!composer) return false;
    const text = composer instanceof HTMLTextAreaElement ? composer.value : composer.textContent;
    return Boolean(String(text || "").trim());
  }

  function isSendButton(target) {
    if (!target || !(target instanceof Element)) return false;
    const button = target.closest("button");
    if (!button) return false;
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return false;

    const label = [
      button.getAttribute("aria-label"),
      button.getAttribute("data-testid"),
      button.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (label.includes("stop") || label.includes("停止")) return false;
    if (label.includes("send") || label.includes("发送") || label.includes("submit")) return true;
    if (button.matches('[data-testid="send-button"], button[type="submit"]')) return true;
    return false;
  }

  async function trackUsage(source) {
    if (!extensionAvailable) return;
    if (!settings || !settings.autoTrack) return;

    const now = Date.now();
    if (now - lastTrackedAt < TRACK_DEBOUNCE_MS) return;

    // 在发送瞬间（捕获阶段，早于页面处理）读取页面上选中的模式，比后台同步的结果更准
    const detected = settings.autoDetectMode ? detectCurrentMode() : null;
    const mode = detected || getActiveMode();
    if (!mode || !mode.enabled) return;

    console.debug(
      `[ChatGPT Tracker] +1 ${mode.id} (${detected ? "detected" : "fallback"}, ${source})`
    );

    lastTrackedAt = now;

    if (mode.id !== settings.activeModeId) {
      settings.activeModeId = mode.id;
      settings = await Core.saveSettings(settings);
    }

    usage = await Core.addUsage(mode.id, source);
    renderWidget();
    pulseWidget();
  }

  function queueRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => runAsync(async () => {
      if (!extensionAvailable) return;
      settings = await Core.getSettings();
      usage = await Core.getUsage();
      renderWidget();
    }), 60);
  }

  function widgetRoot() {
    return document.getElementById(WIDGET_ID);
  }

  function statText(stat) {
    return `${stat.count}`;
  }

  function matchesWholeWord(text, term) {
    if (!term) return false;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
  }

  function findModeByText(text) {
    const normalizedText = String(text || "").toLowerCase();
    if (!normalizedText) return null;

    return settings.modes
      .filter((mode) => mode.enabled)
      .slice()
      .sort((a, b) => b.label.length - a.label.length)
      .find((mode) => {
        const id = mode.id.toLowerCase();
        const label = mode.label.toLowerCase();
        return matchesWholeWord(normalizedText, label) || matchesWholeWord(normalizedText, id);
      });
  }

  function isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
  }

  function elementText(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ");
  }

  function findModeByExactText(element) {
    const sources = [element.textContent, element.getAttribute("aria-label")];

    for (const raw of sources) {
      const text = String(raw || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!text) continue;
      const mode = settings.modes
        .filter((candidate) => candidate.enabled)
        .find((candidate) => {
          return text === candidate.label.toLowerCase() || text === candidate.id.toLowerCase();
        });
      if (mode) return mode;
    }

    return null;
  }

  function getComposerRoot() {
    const input = document.querySelector('#prompt-textarea, [data-testid="prompt-textarea"]');
    if (!input) return null;
    return input.closest("form") || input.parentElement;
  }

  function findCheckedMenuMode() {
    const checked = document.querySelectorAll(
      '[role="menuitemradio"][aria-checked="true"], [aria-selected="true"], [data-state="checked"]'
    );
    for (const element of checked) {
      if (!isVisibleElement(element)) continue;
      const mode = findModeByText(elementText(element));
      if (mode) return mode;
    }
    return null;
  }

  function composerCandidates() {
    const root = getComposerRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll('button, [role="button"], [aria-haspopup="menu"], [data-testid]'))
      .slice(0, 40)
      .filter(isVisibleElement);
  }

  function modelSwitcherCandidates() {
    return Array.from(
      document.querySelectorAll('[data-testid*="model-switcher"], [data-testid*="model"], button[aria-label*="model" i]')
    )
      .slice(0, 12)
      .filter(isVisibleElement);
  }

  // 识别按可信度分层：菜单勾选项 > 输入框区域 > 顶部模型选择器（Pro 这类模型级选择可能只显示在那里）。
  // 每个区域内：文本恰好等于模式名 > 包含模式词（取最长的模式名，防止 High 抢走 Extra High）。
  function detectCurrentMode() {
    const checkedMode = findCheckedMenuMode();
    if (checkedMode) return checkedMode;

    const groups = [composerCandidates(), modelSwitcherCandidates()];

    for (const candidates of groups) {
      for (const element of candidates) {
        const mode = findModeByExactText(element);
        if (mode) return mode;
      }

      let best = null;
      for (const element of candidates) {
        const mode = findModeByText(elementText(element));
        if (mode && (!best || mode.label.length > best.label.length)) {
          best = mode;
        }
      }
      if (best) return best;
    }

    return null;
  }

  async function syncDetectedMode() {
    if (!extensionAvailable) return null;
    if (!settings || !settings.autoDetectMode) return null;
    // 后台标签页不许写全局模式：多个 ChatGPT 标签页各自检测会互相覆盖 activeModeId
    if (document.hidden) return null;
    const detected = detectCurrentMode();
    if (!detected) return null;
    if (detected.id !== settings.activeModeId) {
      settings.activeModeId = detected.id;
      settings = await Core.saveSettings(settings);
      renderWidget();
    }
    return detected;
  }

  function renderWidget() {
    if (!settings || !usage || !settings.showWidget) {
      const existing = widgetRoot();
      if (existing) existing.remove();
      return;
    }

    let root = widgetRoot();
    if (!root) {
      root = document.createElement("aside");
      root.id = WIDGET_ID;
      document.documentElement.appendChild(root);
    }

    const stats = Core.getModeStats(settings, usage, settings.resetAt);
    const activeStat = stats.find((stat) => stat.id === settings.activeModeId) || stats[0];

    root.innerHTML = `
      <div class="cmt-head">
        <strong>ChatGPT 计数器</strong>
        <button type="button" class="cmt-icon" data-cmt-action="toggle" aria-label="折叠计数器">
          ${settings.widgetCollapsed ? "+" : "-"}
        </button>
      </div>
      <div class="cmt-body ${settings.widgetCollapsed ? "is-hidden" : ""}">
        <label class="cmt-label" for="cmt-mode-select">模式</label>
        <select id="cmt-mode-select" class="cmt-select">
          ${settings.modes
            .filter((mode) => mode.enabled)
            .map((mode) => {
              const selected = mode.id === settings.activeModeId ? "selected" : "";
              return `<option value="${escapeHtml(mode.id)}" ${selected}>${escapeHtml(mode.label)}</option>`;
            })
            .join("")}
        </select>
        <div class="cmt-metric">
          <span>${escapeHtml(activeStat.label)}</span>
          <b>${escapeHtml(statText(activeStat))}</b>
        </div>
        <div class="cmt-sub">本轮发送次数</div>
        <div class="cmt-actions">
          <button type="button" data-cmt-action="add">+1</button>
          <button type="button" data-cmt-action="undo">撤销</button>
        </div>
      </div>
    `;

    root.querySelector('[data-cmt-action="toggle"]').addEventListener("click", () => runAsync(onToggle));
    const select = root.querySelector("#cmt-mode-select");
    if (select) select.addEventListener("change", (event) => runAsync(() => onModeChange(event)));
    root.querySelector('[data-cmt-action="add"]').addEventListener("click", () => runAsync(onManualAdd));
    root.querySelector('[data-cmt-action="undo"]').addEventListener("click", () => runAsync(onUndo));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function onToggle() {
    if (!extensionAvailable) return;
    settings.widgetCollapsed = !settings.widgetCollapsed;
    settings = await Core.saveSettings(settings);
    renderWidget();
  }

  async function onModeChange(event) {
    if (!extensionAvailable) return;
    settings.activeModeId = event.target.value;
    settings = await Core.saveSettings(settings);
    renderWidget();
  }

  async function onManualAdd() {
    if (!extensionAvailable) return;
    const mode = getActiveMode();
    if (!mode) return;
    usage = await Core.addUsage(mode.id, "manual-widget");
    renderWidget();
    pulseWidget();
  }

  async function onUndo() {
    if (!extensionAvailable) return;
    const mode = getActiveMode();
    if (!mode) return;
    await Core.removeLastUsage(mode.id, settings.resetAt);
    usage = await Core.getUsage();
    renderWidget();
  }

  function pulseWidget() {
    const root = widgetRoot();
    if (!root) return;
    root.classList.remove("is-pulsing");
    window.requestAnimationFrame(() => {
      root.classList.add("is-pulsing");
      window.setTimeout(() => root.classList.remove("is-pulsing"), 420);
    });
  }

  function bindEvents() {
    document.addEventListener(
      "click",
      (event) => {
        window.setTimeout(() => runAsync(syncDetectedMode), 200);
        if (isSendButton(event.target)) {
          runAsync(() => trackUsage("send-button"));
        }
      },
      true
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.isComposing) return;
        if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
        const composer = getComposer(event.target);
        if (!composerHasText(composer)) return;
        runAsync(() => trackUsage("enter-key"));
      },
      true
    );

    observer = new MutationObserver(() => {
      window.clearTimeout(detectTimer);
      detectTimer = window.setTimeout(() => runAsync(syncDetectedMode), DETECT_DEBOUNCE_MS);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) runAsync(syncDetectedMode);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[Core.SETTINGS_KEY] || changes[Core.USAGE_KEY]) {
        queueRefresh();
      }
    });
  }

  async function init() {
    settings = await Core.getSettings();
    usage = await Core.getUsage();
    renderWidget();
    bindEvents();

    // ChatGPT 首屏渲染晚于 document_idle，轮询到第一次识别成功为止，之后交给 MutationObserver
    for (let attempt = 0; attempt < 15; attempt += 1) {
      if (!extensionAvailable) break;
      if (await syncDetectedMode()) break;
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
  }

  init().catch((error) => {
    handleAsyncError(error);
  });
})();
