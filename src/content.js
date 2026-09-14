(function () {
  "use strict";

  const Core = window.ChatGPTTrackerCore;
  const WIDGET_ID = "cmt-widget";
  const TAKEOVER_EVENT = "cmt-tracker:takeover";
  const COMPOSER_SELECTOR = '#prompt-textarea, [data-testid="prompt-textarea"]';
  const USER_MESSAGE_SELECTOR = '[data-message-author-role="user"]';
  const SEND_BUTTON_SELECTOR = '[data-testid="send-button"], #composer-submit-button, button[type="submit"]';
  const DETECT_DEBOUNCE_MS = 1500;
  // 发送意图（回车 / 点发送）之后，多久之内出现的新用户消息算作这次发送
  const INTENT_WINDOW_MS = 10000;
  // 意图之后等这么久还没在页面上看到新消息，就做一次兜底判断
  const FALLBACK_DELAY_MS = 4000;
  // 同一段文字在这段时间内只记一次，防止页面把同一条消息重挂一遍造成双计
  const DEDUPE_MS = 3000;
  // 草稿超过这个时间没更新就不再拿来匹配
  const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

  // 每个实例一个标识：分辨浮窗归谁，避免旧实例退场时拆掉新实例的浮窗
  const instanceToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  // document 上的监听都挂在这个 signal 上，teardown 时一次性摘掉
  const abort = new AbortController();

  let settings = null;
  let usage = null;
  let refreshTimer = 0;
  let detectTimer = 0;
  let observer = null;
  let extensionAvailable = true;

  // ---- 发送识别状态 ----
  // 已经见过的用户消息节点 / id：只有“新冒出来的”才可能是这次发送
  const knownUserMessages = new WeakSet();
  const knownUserMessageIds = new Set();
  // 最近一次发送意图：{ at, mode, source, draft, hadContent, composer, timer }
  let pendingIntent = null;
  // 输入框里最近一次非空内容（去掉空白），用来和新出现的用户消息对文字
  let lastDraft = { text: "", at: 0 };
  let lastCounted = { text: "", at: 0 };

  // 接管：同一页面里可能已经有更早的实例（清单注入和后台补注入撞车，或扩展重载后留下的孤儿）。
  // DOM 事件能跨隔离环境传递，用它通知旧实例退场，比挂在 window 上的标记可靠。
  // 先派发再监听，自己不会收到自己的事件。
  document.dispatchEvent(new Event(TAKEOVER_EVENT));
  document.addEventListener(TAKEOVER_EVENT, () => teardown(), { signal: abort.signal });

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
    abort.abort();
    try {
      if (observer) observer.disconnect();
    } catch (error) {
      // observer 可能已失效，忽略
    }
    window.clearTimeout(refreshTimer);
    window.clearTimeout(detectTimer);
    clearPendingIntent();
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch (error) {
      // 孤儿上下文里 chrome.* 已不可用，忽略
    }
    const root = widgetRoot();
    // 只拆自己的浮窗：孤儿实例可能很晚才发现自己失效，不能把接班实例的浮窗一起拆掉
    if (root && root.dataset.cmtInstance === instanceToken) root.remove();
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

  // 意图里存的模式对象可能来自旧的 settings 快照，按 id 换成当前的
  function resolveMode(mode) {
    if (!settings || !mode) return null;
    const current = settings.modes.find((candidate) => candidate.id === mode.id);
    return current && current.enabled ? current : null;
  }

  function getComposerElement() {
    return document.querySelector(COMPOSER_SELECTOR);
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

  function readText(element) {
    if (!element) return "";
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return String(element.value || "");
    }
    return String(element.textContent || "");
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, "");
  }

  function composerHasText(composer) {
    return Boolean(normalizeText(readText(composer)));
  }

  // 记下输入框当前内容。发送时 ChatGPT 会马上清空输入框，所以必须在那之前（按键、点击的捕获阶段）留底
  function sampleDraft(element) {
    const text = normalizeText(readText(element || getComposerElement()));
    if (text) lastDraft = { text, at: Date.now() };
  }

  function getComposerRoot() {
    const input = getComposerElement();
    if (!input) return null;
    return input.closest("form") || input.parentElement;
  }

  // 只带附件没有文字时，输入框是空的，但发送按钮是亮的（生成中的“停止”按钮不算）
  function sendButtonReady() {
    const root = getComposerRoot();
    if (!root) return false;
    const button = root.querySelector(SEND_BUTTON_SELECTOR);
    return Boolean(button && isSendButton(button));
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

  // ---- 发送识别：意图 + 页面确认 ----
  // 以前是回车 / 点发送就直接 +1，结果是：输入法选字的回车、生成中按的回车会多记，
  // 而 Cmd+Enter、听写发送、被页面拦掉的按键又会漏记。现在改成两步：
  //   1. 回车 / 点发送只算“意图”，趁页面还没处理这个事件，把当前模式和输入内容记下来；
  //   2. 页面上真的多出一条用户消息（或输入框被清空）才真正计数。
  // 即使意图没捕捉到，只要新消息文字和输入框留底的草稿对得上，也能补记。

  function clearPendingIntent() {
    if (!pendingIntent) return;
    window.clearTimeout(pendingIntent.timer);
    pendingIntent = null;
  }

  function noteIntent(source, composer) {
    if (!extensionAvailable || !settings || !settings.autoTrack) return;
    const element = composer || getComposerElement();
    sampleDraft(element);
    const draft = normalizeText(readText(element));
    const detected = settings.autoDetectMode ? detectCurrentMode() : null;
    clearPendingIntent();
    pendingIntent = {
      at: Date.now(),
      mode: detected || getActiveMode(),
      source,
      draft,
      hadContent: Boolean(draft) || sendButtonReady(),
      composer: element,
      timer: window.setTimeout(() => runAsync(resolvePendingIntent), FALLBACK_DELAY_MS)
    };
    console.debug(
      `[ChatGPT Tracker] intent ${source} mode=${pendingIntent.mode ? pendingIntent.mode.id : "?"}`
    );
  }

  function rememberUserMessage(element) {
    knownUserMessages.add(element);
    const id = element.getAttribute("data-message-id");
    if (id) knownUserMessageIds.add(id);
  }

  function isKnownUserMessage(element) {
    if (knownUserMessages.has(element)) return true;
    const id = element.getAttribute("data-message-id");
    return Boolean(id && knownUserMessageIds.has(id));
  }

  function snapshotUserMessages() {
    document.querySelectorAll(USER_MESSAGE_SELECTOR).forEach(rememberUserMessage);
  }

  function collectUserMessages(nodes) {
    const found = [];
    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches(USER_MESSAGE_SELECTOR)) found.push(node);
      node.querySelectorAll(USER_MESSAGE_SELECTOR).forEach((element) => found.push(element));
    }
    return found;
  }

  function isLastUserMessage(element) {
    const all = document.querySelectorAll(USER_MESSAGE_SELECTOR);
    return all.length > 0 && all[all.length - 1] === element;
  }

  function textMatchesDraft(messageText, draft) {
    if (!messageText || !draft) return false;
    // 消息节点里可能还带附件名之类的文字，所以看“包含草稿开头”而不是完全相等
    return messageText === draft || messageText.includes(draft.slice(0, 500));
  }

  // 页面上新出现了用户消息节点：判断它是不是刚才这次发送
  function handleNewUserMessages(candidates) {
    if (!extensionAvailable) return;
    const fresh = [];
    for (const element of candidates) {
      if (isKnownUserMessage(element)) continue;
      rememberUserMessage(element);
      fresh.push(element);
    }
    if (!fresh.length) return;

    // 一次冒出多条：是在打开 / 切换会话渲染历史记录，不是发送
    if (fresh.length > 1) return;

    const element = fresh[0];
    // 刚发送的消息一定排在会话最后；往上滚动补渲染出来的旧消息不算
    if (!element.isConnected || !isLastUserMessage(element)) return;

    const now = Date.now();
    const text = normalizeText(element.textContent);
    const intent = pendingIntent && now - pendingIntent.at <= INTENT_WINDOW_MS ? pendingIntent : null;
    const draftFresh = Boolean(lastDraft.text) && now - lastDraft.at <= DRAFT_MAX_AGE_MS;
    const matchesDraft =
      textMatchesDraft(text, intent ? intent.draft : "") ||
      (draftFresh && textMatchesDraft(text, lastDraft.text));

    // 既没有发送意图、文字也对不上草稿：多半是切到只有一条消息的会话之类的渲染，忽略
    if (!intent && !matchesDraft) return;
    if (text && text === lastCounted.text && now - lastCounted.at < DEDUPE_MS) return;

    commitSend(intent ? intent.mode : null, intent ? intent.source : "dom-observed", text);
  }

  function commitSend(mode, source, text) {
    clearPendingIntent();
    lastCounted = { text, at: Date.now() };
    lastDraft = { text: "", at: 0 };
    runAsync(() => trackUsage(mode, source));
  }

  // 意图之后过了 FALLBACK_DELAY_MS 还没确认：先补扫一遍页面，再决定要不要兜底记数
  function resolvePendingIntent() {
    const intent = pendingIntent;
    if (!intent) return;

    // 补扫：MutationObserver 万一漏掉（比如整块子树被替换），这里还能捞到
    handleNewUserMessages(Array.from(document.querySelectorAll(USER_MESSAGE_SELECTOR)));
    if (pendingIntent !== intent) return; // 补扫时已经确认并计数

    clearPendingIntent();
    if (!intent.hadContent) return;

    // 页面能渲染用户消息，却一直没有新的出现：这次没发出去（比如生成中按了回车），不记
    if (document.querySelector(USER_MESSAGE_SELECTOR)) {
      console.debug(`[ChatGPT Tracker] drop ${intent.source}: no new message appeared`);
      return;
    }

    // 页面上一条用户消息都找不到（ChatGPT 改版换了结构？）：退回到“输入框被清空即视为已发送”
    const composer = intent.composer;
    const cleared = !composer || !composer.isConnected || !composerHasText(composer);
    if (!cleared) return;
    commitSend(intent.mode, intent.source, intent.draft);
  }

  async function trackUsage(preferredMode, source) {
    if (!extensionAvailable) return;
    if (!settings || !settings.autoTrack) return;

    // 优先用意图那一刻读到的模式（发送前页面上选中的那个），没有再现场识别
    const preferred = resolveMode(preferredMode);
    const detected = preferred || (settings.autoDetectMode ? detectCurrentMode() : null);
    const mode = detected || getActiveMode();
    if (!mode || !mode.enabled) return;

    console.debug(
      `[ChatGPT Tracker] +1 ${mode.id} (${preferred ? "intent" : detected ? "detected" : "fallback"}, ${source})`
    );

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

  function onStorageChanged(changes, areaName) {
    if (!extensionAvailable) return;
    if (areaName !== "local") return;
    if (changes[Core.SETTINGS_KEY] || changes[Core.USAGE_KEY]) {
      queueRefresh();
    }
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

  // 模式名可能和模型号拼在同一个按钮里：Pro 档时输入框旁的按钮显示 "6Pro"，是 "6" 和 "Pro" 两个 span；
  // 其他档位（Instant / Medium / High / Extra High）按钮文字就是模式名本身。
  // 所以除了整个按钮的文字，还要看每个叶子节点的文字，以及去掉开头模型号之后的文字。
  function exactTextCandidates(element) {
    const raws = [element.textContent, element.getAttribute("aria-label")];
    element.querySelectorAll("*").forEach((child) => {
      if (!child.children.length) raws.push(child.textContent);
    });

    const texts = [];
    for (const raw of raws) {
      const text = String(raw || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!text) continue;
      texts.push(text);
      const stripped = text.replace(/^(?:gpt-?)?\d+(?:\.\d+)?\s*/, "");
      if (stripped && stripped !== text) texts.push(stripped);
    }
    return texts;
  }

  function findModeByExactText(element) {
    const enabled = settings.modes.filter((candidate) => candidate.enabled);
    for (const text of exactTextCandidates(element)) {
      const mode = enabled.find((candidate) => {
        return text === candidate.label.toLowerCase() || text === candidate.id.toLowerCase();
      });
      if (mode) return mode;
    }
    return null;
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
    if (!extensionAvailable) return;
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
    // 接手页面上已有的浮窗（可能是被接管的旧实例留下的），标成自己的
    root.dataset.cmtInstance = instanceToken;

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
    const capture = { capture: true, signal: abort.signal };

    document.addEventListener(
      "keydown",
      (event) => {
        if (!extensionAvailable) return;
        const composer = getComposer(event.target);
        if (!composer) return;
        // 每次按键都刷新草稿，保证发送前一刻的内容已经留底
        sampleDraft(composer);
        // 输入法组合中的回车是在选字，不是发送
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key !== "Enter" || event.shiftKey) return;
        // Ctrl/Cmd+Enter 在 ChatGPT 里同样是发送；有没有真的发出去由后面的确认逻辑判断
        if (!composerHasText(composer) && !sendButtonReady()) return;
        noteIntent("enter-key", composer);
      },
      capture
    );

    document.addEventListener(
      "click",
      (event) => {
        if (!extensionAvailable) return;
        window.setTimeout(() => runAsync(syncDetectedMode), 200);
        if (isSendButton(event.target)) noteIntent("send-button", getComposerElement());
      },
      capture
    );

    observer = new MutationObserver((records) => {
      if (!extensionAvailable) return;
      try {
        // 输入框内容变化也会触发这里，顺手留底；发送后输入框为空，不会覆盖之前的草稿
        sampleDraft();
        const added = [];
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) added.push(node);
          }
        }
        if (added.length) {
          const candidates = collectUserMessages(added);
          if (candidates.length) handleNewUserMessages(candidates);
        }
      } catch (error) {
        handleAsyncError(error);
      }
      window.clearTimeout(detectTimer);
      detectTimer = window.setTimeout(() => runAsync(syncDetectedMode), DETECT_DEBOUNCE_MS);
    });
    // 观察 documentElement 而不是 body：后台补注入可能发生在 body 还没建好的时候
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) runAsync(syncDetectedMode);
      },
      { signal: abort.signal }
    );

    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  async function init() {
    settings = await Core.getSettings();
    usage = await Core.getUsage();
    // 读设置期间已被更新的实例接管，别再往页面上挂东西
    if (!extensionAvailable) return;
    // 页面上已有的历史消息不算发送
    snapshotUserMessages();
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
