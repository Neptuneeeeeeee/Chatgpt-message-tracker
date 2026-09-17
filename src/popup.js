(function () {
  "use strict";
  const Core = window.ChatGPTTrackerCore;
  const I = window.ChatGPTTrackerI18n;
  const $ = id => document.getElementById(id);
  const h = I.escapeHtml;
  let settings = null;
  let usage = null;
  let refreshVersion = 0;
  let queue = Promise.resolve();
  const t = (key, params) => I.t(key, settings, params);
  const n = value => I.number(value, settings);
  const label = mode => I.modeLabel(mode, settings);
  const sourceKeys = {"send-button":"sourceSend","enter-key":"sourceEnter","dom-observed":"sourceDOM","manual-widget":"sourceWidget","manual-popup":"sourcePopup",manual:"sourceManual"};

  function fail(error) {
    $("popup-error").hidden = false;
    $("popup-error").textContent = t("error", {error:error.message || String(error)});
  }
  function run(task) {
    queue = queue.then(task).catch(fail);
    return queue;
  }
  function options(selected) {
    return settings.modes.filter(mode => mode.enabled).map(mode => I.option(mode, selected, settings)).join("");
  }
  function render() {
    I.apply(document, settings);
    $("active-mode").innerHTML = options(settings.activeModeId);
    $("active-mode").dir = I.direction(settings.modeLabelLanguage);
    $("auto-track").checked = settings.autoTrack;
    $("auto-detect").checked = settings.autoDetectMode;
    $("show-widget").checked = settings.showWidget;
    const stats = Core.getModeStats(settings, usage, settings.resetAt).filter(stat => stat.enabled);
    $("stats").innerHTML = stats.map(stat => `<article class="stat-card">
      <div class="stat-line"><strong dir="auto">${h(label(stat))}</strong><b>${h(n(stat.count))}</b></div>
      <div class="meta">${h(t("roundCount"))}</div></article>`).join("");
    $("count-since").textContent = settings.resetAt ? t("countSince", {date:I.dateTime(settings.resetAt,settings)}) : t("countEarliest");

    $("window-range").innerHTML = Core.STATS_WINDOWS.map(window => `<option value="${window.id}" ${window.id === settings.statsWindow ? "selected" : ""}>${h(t("window"+window.id))}</option>`).join("");
    const windowDef = Core.STATS_WINDOWS.find(window => window.id === settings.statsWindow) || Core.STATS_WINDOWS[0];
    const recent = Core.getModeStats(settings,usage,Date.now()-windowDef.ms).filter(stat => stat.enabled);
    $("window-stats").innerHTML = recent.map(stat => `<div class="win-row"><span dir="auto">${h(label(stat))}</span><b>${h(n(stat.count))}</b></div>`).join("") +
      `<div class="win-row win-total"><span>${h(t("total"))}</span><b>${h(n(recent.reduce((sum,stat)=>sum+stat.count,0)))}</b></div>`;
    $("daily-mode").innerHTML = `<option value="${Core.DAILY_TOTAL_ID}" ${settings.dailyModeId === Core.DAILY_TOTAL_ID ? "selected" : ""}>${h(t("allModes"))}</option>` + options(settings.dailyModeId);
    const daily = Core.getDailyModeStats(settings,usage,settings.dailyModeId,settings.statsWindow);
    $("daily-stats").innerHTML = daily.rows.map(row => `<div class="daily-row"><span>${h(I.date(row.date,settings))}</span><b>${h(n(row.count))}</b></div>`).join("");

    const entries = usage.entries.slice().sort((a,b)=>b.ts-a.ts).slice(0,8);
    const modes = new Map(settings.modes.map(mode=>[mode.id,mode]));
    $("recent-list").innerHTML = entries.length ? entries.map(entry => `<div class="recent-row">
      <div class="recent-info"><strong dir="auto">${h(modes.has(entry.modeId) ? label(modes.get(entry.modeId)) : entry.modeId)}</strong>
      <span class="meta">${h(I.dateTime(entry.ts,settings))} · ${h(t(sourceKeys[entry.source] || "sourceOther"))}</span></div>
      <button type="button" class="recent-remove" data-entry-id="${h(entry.id)}" title="${h(t("deleteEntry"))}" aria-label="${h(t("deleteEntry"))}">✕</button></div>`).join("") : `<div class="meta">${h(t("noRecords"))}</div>`;
  }
  async function refresh() {
    const version = ++refreshVersion;
    const [nextSettings,nextUsage] = await Promise.all([Core.getSettings(),Core.getUsage()]);
    if (version !== refreshVersion) return;
    settings = nextSettings;
    usage = nextUsage;
    render();
  }
  async function patch(value) {
    await Core.patchSettings(value);
    await refresh();
  }
  function bindEvents() {
    for (const [id,key,checkbox] of [["active-mode","activeModeId",false],["auto-track","autoTrack",true],["auto-detect","autoDetectMode",true],["show-widget","showWidget",true],["window-range","statsWindow",false],["daily-mode","dailyModeId",false]]) {
      $(id).addEventListener("change", event => {
        const value = checkbox ? event.target.checked : event.target.value;
        run(() => patch({[key]:value}));
      });
    }
    $("manual-add").addEventListener("click", () => run(async () => { await Core.addUsage(settings.activeModeId,"manual-popup");await refresh(); }));
    $("undo").addEventListener("click", () => run(async () => { await Core.removeLastUsage(settings.activeModeId,settings.resetAt);await refresh(); }));
    $("reset-counts").addEventListener("click", () => run(async () => { if (window.confirm(t("confirmReset"))) await patch({resetAt:Date.now()}); }));
    $("export-json").addEventListener("click", () => run(() => I.exportData(Core)));
    $("open-options").addEventListener("click", () => run(() => chrome.runtime.openOptionsPage()));
    $("open-chatgpt").addEventListener("click", () => run(() => chrome.tabs.create({url:"https://chatgpt.com/"})));
    $("recent-list").addEventListener("click", event => {
      const button = event.target.closest("[data-entry-id]");
      if (button) { const id=button.dataset.entryId;run(async () => {await Core.removeUsageEntry(id);await refresh();}); }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes[Core.SETTINGS_KEY] || changes[Core.USAGE_KEY])) refresh().catch(fail);
    });
  }
  refresh().then(bindEvents).catch(fail);
})();
