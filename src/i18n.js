(function (root) {
  "use strict";
  const dictionaries = root.ChatGPTTrackerUILocales;
  const site = root.ChatGPTTrackerSiteLocales;
  const ENGLISH_MODES = {instant:"Instant", medium:"Medium", high:"High", "extra-high":"Extra High", pro:"Pro"};
  // Autonyms make it possible to recover from an accidentally selected interface language.
  const LANGUAGES = [
    ["en-US","English"], ["zh-CN","简体中文"], ["zh-TW","繁體中文（台灣）"], ["zh-HK","繁體中文（香港）"],
    ["es-ES","Español (España)"], ["es-419","Español (Latinoamérica)"], ["pt-BR","Português (Brasil)"], ["pt-PT","Português (Portugal)"],
    ["fr-FR","Français (France)"], ["fr-CA","Français (Canada)"], ["de-DE","Deutsch"], ["ja-JP","日本語"], ["ko-KR","한국어"],
    ["ar","العربية"], ["hi-IN","हिन्दी"], ["ru-RU","Русский"], ["id-ID","Bahasa Indonesia"], ["it-IT","Italiano"],
    ["tr-TR","Türkçe"], ["vi-VN","Tiếng Việt"], ["th-TH","ไทย"]
  ];
  function locale(value) {
    return typeof value === "string" && Object.hasOwn(dictionaries, value) ? value : "en-US";
  }
  function uiLocale(settings) { return locale(settings?.uiLanguage); }
  function modeLocale(settings) { return locale(settings?.modeLabelLanguage); }
  function direction(language) { return language === "ar" ? "rtl" : "ltr"; }
  function t(key, settings, params = {}) {
    const value = dictionaries[uiLocale(settings)][key] ?? dictionaries["en-US"][key];
    if (typeof value !== "string") throw new Error(`Unknown UI message: ${key}`);
    return value.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(params, name) ? String(params[name]) : token);
  }
  function modeLabel(mode, settings) {
    if (!mode) return "";
    const original = ENGLISH_MODES[mode.id];
    // Do not migrate display translations into stored labels or overwrite a user rename.
    if (!original || mode.label !== original) return String(mode.label || mode.id);
    return site[modeLocale(settings)]?.modes[mode.id]?.[0] || original;
  }
  function number(value, settings) { return new Intl.NumberFormat(uiLocale(settings)).format(value); }
  function dateTime(value, settings) {
    if (!value) return "";
    return new Intl.DateTimeFormat(uiLocale(settings), {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  }
  function date(key, settings) {
    const [year, month, day] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(uiLocale(settings), {year:"numeric",month:"short",day:"numeric"}).format(new Date(year, month - 1, day));
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
  }
  function option(mode, selected, settings) {
    return `<option value="${escapeHtml(mode.id)}" ${mode.id === selected ? "selected" : ""} lang="${modeLocale(settings)}" dir="${direction(modeLocale(settings))}">${escapeHtml(modeLabel(mode,settings))}</option>`;
  }
  function apply(container, settings) {
    const owner = container.nodeType === 9 ? container.documentElement : container;
    // Call with the widget root on ChatGPT. Never rewrite the host page's lang or dir.
    owner.lang = uiLocale(settings);
    owner.dir = direction(uiLocale(settings));
    container.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n, settings); });
    container.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle, settings); });
    container.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria, settings)); });
  }
  function languageOptions(select, selected) {
    select.replaceChildren(...LANGUAGES.map(([id, name]) => {
      const option = select.ownerDocument.createElement("option");
      option.value = id; option.textContent = name; option.lang = id; option.dir = "auto"; option.selected = id === selected;
      return option;
    }));
  }
  async function exportData(Core) {
    const data = {exportedAt:new Date().toISOString(),settings:await Core.getSettings(),usage:await Core.getUsage()};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a = root.document.createElement("a"); a.href = url; a.download = `chatgpt-tracker-${new Date().toISOString().slice(0,10)}.json`; a.click();
    root.setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  root.ChatGPTTrackerI18n = {LANGUAGES,ENGLISH_MODES,locale,uiLocale,modeLocale,direction,t,modeLabel,number,dateTime,date,escapeHtml,option,apply,languageOptions,exportData};
})(typeof window !== "undefined" ? window : globalThis);
