(function () {
  "use strict";
  const Core = window.ChatGPTTrackerCore;
  const I = window.ChatGPTTrackerI18n;
  const $ = id => document.getElementById(id);
  const h = I.escapeHtml;
  let settings = null;
  let dirtyModes = false;
  let statusTimer = 0;
  let queue = Promise.resolve();
  const t = (key, params) => I.t(key, settings, params);
  function notify(error) {
    clearTimeout(statusTimer);
    $("settings-status").textContent = error ? t("error", {error:error.message || String(error)}) : t("saved");
    if (!error) statusTimer = setTimeout(() => { $("settings-status").textContent = ""; }, 2400);
  }
  function run(task) {
    queue = queue.then(task).catch(error => notify(error));
    return queue;
  }
  function readModes() {
    return Array.from($("mode-list").children).map((row, index) => {
      const input = row.querySelector('[data-field="label"]');
      const old = settings.modes.find(mode => mode.id === row.dataset.modeId);
      const text = input.value.trim();
      const original = I.ENGLISH_MODES[row.dataset.modeId];
      const label = text === input.dataset.renderedLabel ? old.label : text || original || t("modeNumber", {number:index+1});
      return {id:row.dataset.modeId, label, enabled:row.querySelector('[data-field="enabled"]').checked};
    });
  }
  function render() {
    I.apply(document, settings);
    document.title = `ChatGPT Tracker · ${t("settings")}`;
    I.languageOptions($("ui-language"), settings.uiLanguage);
    I.languageOptions($("mode-label-language"), settings.modeLabelLanguage);
    $("mode-list").innerHTML = settings.modes.map((mode, index) => {
      const label = I.modeLabel(mode, settings);
      return `<div class="mode-row" data-mode-id="${h(mode.id)}">
        <div class="field"><label for="mode-name-${index}">${h(t("name"))}</label>
        <input id="mode-name-${index}" data-field="label" dir="auto" value="${h(label)}" data-rendered-label="${h(label)}" maxlength="80"></div>
        <label class="enabled-field"><input data-field="enabled" type="checkbox" ${mode.enabled ? "checked" : ""}>${h(t("enabled"))}</label>
        <button type="button" data-action="remove">${h(t("delete"))}</button></div>`;
    }).join("");
  }
  async function setLanguage(key, value) {
    const draft = dirtyModes ? readModes() : null;
    settings = await Core.patchSettings({[key]:value});
    if (draft) settings.modes = draft;
    render();
    notify();
  }
  async function saveModes() {
    const modes = readModes();
    settings = await Core.patchSettings({modes});
    dirtyModes = false;
    render();
    notify();
  }
  function addMode() {
    settings.modes = readModes();
    settings.modes.push({id:`custom-${Date.now()}`, label:t("customMode"), enabled:true});
    dirtyModes = true;
    render();
  }
  async function deleteHistory(all) {
    const current = await Core.getSettings();
    const active = current.modes.find(mode => mode.id === current.activeModeId);
    if (!all && !active) return;
    const message = all ? t("confirmDeleteAll") : t("confirmDeleteMode", {mode:I.modeLabel(active, settings)});
    if (!window.confirm(message)) return;
    if (all) await Core.saveUsage({entries:[]}); else await Core.resetMode(active.id);
    notify();
  }
  async function init() {
    settings = await Core.getSettings();
    render();
    $("ui-language").addEventListener("change", event => { const value=event.target.value;run(() => setLanguage("uiLanguage",value)); });
    $("mode-label-language").addEventListener("change", event => { const value=event.target.value;run(() => setLanguage("modeLabelLanguage",value)); });
    $("mode-list").addEventListener("input", () => { dirtyModes=true; });
    $("mode-list").addEventListener("change", () => { dirtyModes=true; });
    $("mode-list").addEventListener("click", event => {
      const button = event.target.closest('[data-action="remove"]');
      if (button) { button.closest(".mode-row").remove(); dirtyModes=true; }
    });
    $("save").addEventListener("click", () => run(saveModes));
    $("add-mode").addEventListener("click", () => run(addMode));
    $("export").addEventListener("click", () => run(() => I.exportData(Core)));
    $("reset-active").addEventListener("click", () => run(() => deleteHistory(false)));
    $("reset-all").addEventListener("click", () => run(() => deleteHistory(true)));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[Core.SETTINGS_KEY]) return;
      run(async () => {
        const draft = dirtyModes ? readModes() : null;
        const next = await Core.getSettings();
        const changed = settings.uiLanguage !== next.uiLanguage || settings.modeLabelLanguage !== next.modeLabelLanguage || (!dirtyModes && JSON.stringify(settings.modes) !== JSON.stringify(next.modes));
        settings = next;
        if (draft) settings.modes = draft;
        if (changed) { $("settings-status").textContent=""; render(); }
      });
    });
  }
  init().catch(error => notify(error));
})();
