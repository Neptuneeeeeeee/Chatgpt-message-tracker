(function () {
  "use strict";

  const SETTINGS_KEY = "cmt.settings";
  const USAGE_KEY = "cmt.usage";

  const STATS_WINDOWS = [
    { id: "3h", label: "最近 3 小时", ms: 3 * 60 * 60 * 1000 },
    { id: "24h", label: "最近 24 小时", ms: 24 * 60 * 60 * 1000 },
    { id: "7d", label: "最近 7 天", ms: 7 * 24 * 60 * 60 * 1000 },
    { id: "30d", label: "最近 30 天", ms: 30 * 24 * 60 * 60 * 1000 }
  ];

  const DEFAULT_SETTINGS = {
    version: 1,
    activeModeId: "instant",
    autoTrack: true,
    autoDetectMode: true,
    showWidget: true,
    widgetCollapsed: false,
    statsWindow: "24h",
    modes: [
      {
        id: "instant",
        label: "Instant",
        enabled: true
      },
      {
        id: "medium",
        label: "Medium",
        enabled: true
      },
      {
        id: "high",
        label: "High",
        enabled: true
      },
      {
        id: "extra-high",
        label: "Extra High",
        enabled: true
      },
      {
        id: "pro",
        label: "Pro",
        enabled: true
      }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  function slugify(value, fallback) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback || `mode-${Date.now()}`;
  }

  function normalizeModes(modes) {
    const seen = new Set();
    const source = Array.isArray(modes) && modes.length ? modes : DEFAULT_SETTINGS.modes;

    return source.map((mode, index) => {
      let id = slugify(mode.id || mode.label, `mode-${index + 1}`);
      while (seen.has(id)) {
        id = `${id}-${index + 1}`;
      }
      seen.add(id);

      return {
        id,
        label: String(mode.label || id).trim() || id,
        enabled: mode.enabled !== false
      };
    });
  }

  function normalizeSettings(settings) {
    const merged = Object.assign(clone(DEFAULT_SETTINGS), settings || {});
    merged.modes = normalizeModes(merged.modes);

    if (!merged.modes.some((mode) => mode.id === merged.activeModeId && mode.enabled)) {
      if (!merged.modes.some((mode) => mode.enabled)) {
        merged.modes[0].enabled = true;
      }
      const firstEnabled = merged.modes.find((mode) => mode.enabled) || merged.modes[0];
      merged.activeModeId = firstEnabled.id;
    }

    merged.autoTrack = merged.autoTrack !== false;
    merged.autoDetectMode = merged.autoDetectMode !== false;
    merged.showWidget = merged.showWidget !== false;
    merged.widgetCollapsed = merged.widgetCollapsed === true;
    if (!STATS_WINDOWS.some((window) => window.id === merged.statsWindow)) {
      merged.statsWindow = DEFAULT_SETTINGS.statsWindow;
    }
    merged.version = 1;
    return merged;
  }

  function normalizeUsage(usage) {
    const entries = Array.isArray(usage && usage.entries) ? usage.entries : [];

    return {
      version: 1,
      entries: entries
        .filter((entry) => entry && entry.modeId && Number.isFinite(Number(entry.ts)))
        .map((entry) => ({
          id: String(entry.id || `${entry.modeId}-${entry.ts}`),
          modeId: String(entry.modeId),
          ts: Number(entry.ts),
          source: String(entry.source || "unknown")
        }))
    };
  }

  async function getSettings() {
    const result = await storageGet([SETTINGS_KEY]);
    return normalizeSettings(result[SETTINGS_KEY]);
  }

  async function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    await storageSet({ [SETTINGS_KEY]: normalized });
    return normalized;
  }

  async function getUsage() {
    const result = await storageGet([USAGE_KEY]);
    return normalizeUsage(result[USAGE_KEY]);
  }

  async function saveUsage(usage) {
    const normalized = normalizeUsage(usage);
    await storageSet({ [USAGE_KEY]: normalized });
    return normalized;
  }

  function pruneEntries(entries, now) {
    const keepAfter = now - 1000 * 60 * 60 * 24 * 120;
    return entries.filter((entry) => entry.ts >= keepAfter);
  }

  async function addUsage(modeId, source) {
    const now = Date.now();
    const usage = await getUsage();
    usage.entries = pruneEntries(usage.entries, now);
    usage.entries.push({
      id: `${modeId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      modeId,
      ts: now,
      source: source || "manual"
    });
    return saveUsage(usage);
  }

  async function removeUsageEntry(entryId) {
    const usage = await getUsage();
    const index = usage.entries.findIndex((entry) => entry.id === String(entryId));
    if (index < 0) return false;
    usage.entries.splice(index, 1);
    await saveUsage(usage);
    return true;
  }

  async function removeLastUsage(modeId) {
    const usage = await getUsage();
    let latestIndex = -1;
    let latestTs = -1;

    usage.entries.forEach((entry, index) => {
      if (entry.modeId === modeId && entry.ts > latestTs) {
        latestIndex = index;
        latestTs = entry.ts;
      }
    });

    if (latestIndex >= 0) {
      usage.entries.splice(latestIndex, 1);
      await saveUsage(usage);
      return true;
    }

    return false;
  }

  function getModeStats(settings, usage, since) {
    const normalizedSettings = normalizeSettings(settings);
    const normalizedUsage = normalizeUsage(usage);

    return normalizedSettings.modes.map((mode) => {
      const count = normalizedUsage.entries.filter((entry) => {
        return entry.modeId === mode.id && (!since || entry.ts >= since);
      }).length;

      return {
        id: mode.id,
        label: mode.label,
        count,
        enabled: mode.enabled
      };
    });
  }

  async function resetMode(modeId) {
    const usage = await getUsage();
    usage.entries = usage.entries.filter((entry) => {
      return entry.modeId !== modeId;
    });
    return saveUsage(usage);
  }

  function formatDateTime(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  window.ChatGPTTrackerCore = {
    SETTINGS_KEY,
    USAGE_KEY,
    DEFAULT_SETTINGS,
    STATS_WINDOWS,
    normalizeSettings,
    normalizeUsage,
    getSettings,
    saveSettings,
    getUsage,
    saveUsage,
    addUsage,
    removeLastUsage,
    removeUsageEntry,
    resetMode,
    getModeStats,
    formatDateTime,
    slugify
  };
})();
