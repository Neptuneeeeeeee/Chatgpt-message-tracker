(function () {
  "use strict";

  const Core = window.ChatGPTTrackerCore;
  let settings = null;
  let usage = null;

  const els = {
    activeMode: document.getElementById("active-mode"),
    autoTrack: document.getElementById("auto-track"),
    autoDetect: document.getElementById("auto-detect"),
    showWidget: document.getElementById("show-widget"),
    stats: document.getElementById("stats"),
    manualAdd: document.getElementById("manual-add"),
    undo: document.getElementById("undo"),
    openOptions: document.getElementById("open-options"),
    openChatgpt: document.getElementById("open-chatgpt"),
    windowRange: document.getElementById("window-range"),
    windowStats: document.getElementById("window-stats"),
    dailyMode: document.getElementById("daily-mode"),
    dailyStats: document.getElementById("daily-stats"),
    recentList: document.getElementById("recent-list"),
    exportJson: document.getElementById("export-json")
  };

  const SOURCE_LABELS = {
    "send-button": "自动 · 发送按钮",
    "enter-key": "自动 · 回车",
    "manual-widget": "手动 · 浮窗",
    "manual-popup": "手动 · 弹窗",
    manual: "手动"
  };

  function sourceLabel(source) {
    return SOURCE_LABELS[source] || "其他";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderModes() {
    els.activeMode.innerHTML = settings.modes
      .filter((mode) => mode.enabled)
      .map((mode) => {
        const selected = mode.id === settings.activeModeId ? "selected" : "";
        return `<option value="${escapeHtml(mode.id)}" ${selected}>${escapeHtml(mode.label)}</option>`;
      })
      .join("");
  }

  function renderStats() {
    const stats = Core.getModeStats(settings, usage);
    els.stats.innerHTML = stats
      .filter((stat) => stat.enabled)
      .map((stat) => {
        return `
          <article class="stat-card">
            <div class="stat-line">
              <strong>${escapeHtml(stat.label)}</strong>
              <b>${stat.count}</b>
            </div>
            <div class="meta">累计发送次数</div>
          </article>
        `;
      })
      .join("");
  }

  function renderWindowStats() {
    els.windowRange.innerHTML = Core.STATS_WINDOWS.map((window) => {
      const selected = window.id === settings.statsWindow ? "selected" : "";
      return `<option value="${escapeHtml(window.id)}" ${selected}>${escapeHtml(window.label)}</option>`;
    }).join("");

    const windowDef =
      Core.STATS_WINDOWS.find((window) => window.id === settings.statsWindow) || Core.STATS_WINDOWS[0];
    const stats = Core.getModeStats(settings, usage, Date.now() - windowDef.ms).filter((stat) => stat.enabled);
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);

    els.windowStats.innerHTML =
      stats
        .map((stat) => {
          return `
            <div class="win-row">
              <span>${escapeHtml(stat.label)}</span>
              <b>${stat.count}</b>
            </div>
          `;
        })
        .join("") +
      `
        <div class="win-row win-total">
          <span>合计</span>
          <b>${total}</b>
        </div>
      `;
  }

  function renderDailyStats() {
    els.dailyMode.innerHTML = settings.modes
      .filter((mode) => mode.enabled)
      .map((mode) => {
        const selected = mode.id === settings.dailyModeId ? "selected" : "";
        return `<option value="${escapeHtml(mode.id)}" ${selected}>${escapeHtml(mode.label)}</option>`;
      })
      .join("");

    const dailyStats = Core.getDailyModeStats(settings, usage, settings.dailyModeId, settings.statsWindow);

    els.dailyStats.innerHTML = dailyStats.rows
      .map((row) => {
        return `
          <div class="daily-row">
            <span>${escapeHtml(row.date)}</span>
            <b>${row.count}</b>
          </div>
        `;
      })
      .join("");
  }

  function renderRecent() {
    const modeLabels = new Map(settings.modes.map((mode) => [mode.id, mode.label]));
    const entries = usage.entries
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8);

    if (!entries.length) {
      els.recentList.innerHTML = '<div class="meta">暂无记录</div>';
      return;
    }

    els.recentList.innerHTML = entries
      .map((entry) => {
        return `
          <div class="recent-row">
            <div class="recent-info">
              <strong>${escapeHtml(modeLabels.get(entry.modeId) || entry.modeId)}</strong>
              <span class="meta">${escapeHtml(Core.formatDateTime(entry.ts))} · ${escapeHtml(sourceLabel(entry.source))}</span>
            </div>
            <button type="button" class="recent-remove" data-entry-id="${escapeHtml(entry.id)}" title="删除这条记录">✕</button>
          </div>
        `;
      })
      .join("");

    els.recentList.querySelectorAll(".recent-remove").forEach((button) => {
      button.addEventListener("click", async (event) => {
        await Core.removeUsageEntry(event.currentTarget.dataset.entryId);
        await refresh();
      });
    });
  }

  function render() {
    renderModes();
    els.autoTrack.checked = settings.autoTrack;
    els.autoDetect.checked = settings.autoDetectMode;
    els.showWidget.checked = settings.showWidget;
    renderStats();
    renderWindowStats();
    renderDailyStats();
    renderRecent();
  }

  async function refresh() {
    settings = await Core.getSettings();
    usage = await Core.getUsage();
    render();
  }

  async function saveSettingPatch(patch) {
    settings = await Core.saveSettings(Object.assign({}, settings, patch));
    render();
  }

  async function onManualAdd() {
    await Core.addUsage(settings.activeModeId, "manual-popup");
    await refresh();
  }

  async function onUndo() {
    await Core.removeLastUsage(settings.activeModeId);
    await refresh();
  }

  async function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: await Core.getSettings(),
      usage: await Core.getUsage()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chatgpt-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    els.activeMode.addEventListener("change", async (event) => {
      await saveSettingPatch({ activeModeId: event.target.value });
    });

    els.autoTrack.addEventListener("change", async (event) => {
      await saveSettingPatch({ autoTrack: event.target.checked });
    });

    els.autoDetect.addEventListener("change", async (event) => {
      await saveSettingPatch({ autoDetectMode: event.target.checked });
    });

    els.showWidget.addEventListener("change", async (event) => {
      await saveSettingPatch({ showWidget: event.target.checked });
    });

    els.windowRange.addEventListener("change", async (event) => {
      await saveSettingPatch({ statsWindow: event.target.value });
    });

    els.dailyMode.addEventListener("change", async (event) => {
      await saveSettingPatch({ dailyModeId: event.target.value });
    });

    els.exportJson.addEventListener("click", exportData);
    els.manualAdd.addEventListener("click", onManualAdd);
    els.undo.addEventListener("click", onUndo);
    els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
    els.openChatgpt.addEventListener("click", () => chrome.tabs.create({ url: "https://chatgpt.com/" }));

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && (changes[Core.SETTINGS_KEY] || changes[Core.USAGE_KEY])) {
        refresh();
      }
    });
  }

  bindEvents();
  refresh().catch((error) => {
    document.body.textContent = `Tracker failed to load: ${error.message}`;
  });
})();
