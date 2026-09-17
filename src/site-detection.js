(function (root) {
  "use strict";
  // The lexicon is generated from original ChatGPT UI resources, not translated by this extension.
  const locales = root.ChatGPTTrackerSiteLocales;
  const COMPOSER = '#prompt-textarea, [data-testid="prompt-textarea"]';
  const SWITCHER = '[data-testid*="model-switcher"]';
  const PICKER = '[data-testid="composer-intelligence-picker-content"]';
  const EXCLUDED = '#cmt-widget, [data-message-author-role], [data-testid*="attachment"], [data-testid*="file-pill"]';
  const CONTROL = 'button[aria-haspopup], button[aria-expanded], [role="combobox"], ' + SWITCHER;
  const CHECKED = '[role="menuitemradio"][aria-checked="true"], [role="radio"][aria-checked="true"], [role="option"][aria-selected="true"], [data-state="checked"]';
  const indices = new Map();
  function normalize(text) {
    return String(text || "").normalize("NFKC").replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/gu, " ").trim().toLowerCase();
  }
  function resolveLocale(value) {
    const tag = String(value || "").replace(/_/g, "-").toLowerCase();
    const exact = Object.keys(locales).find(key => key.toLowerCase() === tag);
    if (exact) return exact;
    if (/^zh(?:-|$)/.test(tag)) {
      if (/(?:^|-)hk(?:-|$)/.test(tag)) return "zh-HK";
      if (/(?:^|-)(?:hant|tw|mo)(?:-|$)/.test(tag)) return "zh-TW";
      return "zh-CN";
    }
    // Regional mappings copied from ChatGPT's own locale resolver, not browser preference.
    if (/^es-(?:419|ar|bo|cl|co|cr|cu|do|ec|gt|hn|mx|ni|pa|pe|pr|py|sv|us|uy|ve)(?:-|$)/.test(tag)) return "es-419";
    if (/^pt-(?:pt|ao|ch|cv|fr|gq|gw|lu|mo|mz|st|tl)(?:-|$)/.test(tag)) return "pt-PT";
    const defaults = {en:"en-US",es:"es-ES",pt:"pt-BR",fr:"fr-FR",de:"de-DE",ja:"ja-JP",ko:"ko-KR",ar:"ar",hi:"hi-IN",ru:"ru-RU",id:"id-ID",it:"it-IT",tr:"tr-TR",vi:"vi-VN",th:"th-TH"};
    // Deliberately never consult navigator.language: ChatGPT has its own language setting.
    return defaults[tag.split("-")[0]] || null;
  }
  function localeRows(locale) {
    return [...new Set([locale, "en-US"])].map(key => locales[key]).filter(Boolean);
  }
  function aliasIndex(modes, locale) {
    const key = JSON.stringify([locale, modes.map(m => [m.id, m.label, m.enabled])]);
    if (indices.has(key)) return indices.get(key);
    const index = new Map();
    for (const mode of modes.filter(m => m.enabled)) {
      const aliases = [mode.id, mode.label, ...localeRows(locale).flatMap(row => row.modes[mode.id] || [])];
      for (const raw of aliases) {
        const alias = normalize(raw); if (!alias) continue;
        if (!index.has(alias)) index.set(alias, new Set());
        index.get(alias).add(mode.id);
      }
    }
    if (indices.size >= 32) indices.delete(indices.keys().next().value);
    indices.set(key, index);
    return index;
  }
  function textMatch(text, modes, locale) {
    const normalized = normalize(text);
    const stripped = normalized.replace(/^(?:(?:chatgpt|gpt)\s*[-–]?\s*)?\d+(?:\.\d+)*\s*/, "");
    const index = aliasIndex(modes, locale);
    for (const candidate of [...new Set([normalized, stripped])]) {
      const ids = index.get(candidate);
      if (ids && ids.size === 1) return {id:[...ids][0], length:candidate.length};
      if (ids && ids.size > 1) return null; // Duplicate custom names must not silently pick the wrong bucket.
    }
    return null;
  }
  function matchText(text, modes, language) {
    const found = textMatch(text, modes, resolveLocale(language));
    return found ? modes.find(mode => mode.id === found.id) : null;
  }
  function createDetector(document) {
    const view = document.defaultView;
    function pageLocale() {
      return resolveLocale(document.documentElement.getAttribute("lang") || document.body?.getAttribute("lang") || "");
    }
    function composerRoot() {
      const input = document.querySelector(COMPOSER);
      return input?.closest("form") || input?.parentElement || null;
    }
    function visible(element) {
      if (!element || element.closest(EXCLUDED) || element.closest('[hidden], [aria-hidden="true"]')) return false;
      const rect = element.getBoundingClientRect();
      const style = view.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }
    function controlMatch(element, modes, locale) {
      if (element.disabled || element.getAttribute("aria-disabled") === "true") return null;
      // Keep direct text AND nested formatting in visual order. A leaf-only walk could
      // discard "Extra " in <span>Extra <b>High</b></span> and wrongly select High.
      const fragments = [];
      function visit(node) {
        if (fragments.length >= 32) return;
        if (node.nodeType === 3) {
          if (normalize(node.nodeValue)) fragments.push(node.nodeValue);
          return;
        }
        if (node.nodeType !== 1 || node.matches('svg, script, style, [hidden], [aria-hidden="true"]')) return;
        const style = view.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return;
        for (const child of node.childNodes) visit(child);
      }
      visit(element);
      for (const text of [fragments.join(""), fragments.join(" ")]) {
        const whole = textMatch(text, modes, locale);
        if (whole) return whole;
      }
      const aria = textMatch(element.getAttribute("aria-label"), modes, locale);
      if (aria) return aria;
      // Only prefixes, never arbitrary description fragments or substrings such as 高 in 极高.
      for (let size = Math.min(8, fragments.length); size >= 1; size--) {
        const match = textMatch(fragments.slice(0, size).join(" "), modes, locale);
        if (match) return match;
      }
      return null;
    }
    function triggers(container) {
      return container ? Array.from(container.querySelectorAll(CONTROL)).filter(visible).slice(0, 48) : [];
    }
    function isPickerTrigger(element, modes, locale) {
      if (element.matches(SWITCHER) || controlMatch(element, modes, locale)) return true;
      const names = [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent].map(normalize);
      return localeRows(locale).some(row => row.picker.some(label => names.includes(normalize(label))));
    }
    function pick(elements, modes, locale) {
      const ids = new Set();
      for (const el of elements.filter(visible)) {
        const match = controlMatch(el, modes, locale);
        if (match) ids.add(match.id);
      }
      return ids.size === 1 ? modes.find(mode => mode.id === [...ids][0]) : null;
    }
    function detect(modes) {
      const locale = pageLocale();
      const composer = triggers(composerRoot());
      const switchers = Array.from(document.querySelectorAll(SWITCHER)).filter(visible).slice(0, 16);
      const owners = [...new Set([...composer, ...switchers])].filter(el => isPickerTrigger(el, modes, locale));
      const panels = new Set(Array.from(document.querySelectorAll(PICKER)).filter(visible));
      for (const owner of owners) {
        for (const id of (owner.getAttribute("aria-controls") || "").split(/\s+/)) {
          const panel = document.getElementById(id);
          if (panel && visible(panel)) panels.add(panel);
        }
        if (owner.id) {
          for (const panel of document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]')) {
            if ((panel.getAttribute("aria-labelledby") || "").split(/\s+/).includes(owner.id) && visible(panel)) panels.add(panel);
          }
        }
      }
      const checked = [...panels].flatMap(panel => Array.from(panel.querySelectorAll(CHECKED))).filter(visible);
      const selected = pick(checked, modes, locale);
      // A present but unknown/ambiguous checked selection is stronger evidence than a
      // stale collapsed trigger. Report uncertainty rather than silently counting its old mode.
      if (checked.length) return {mode:selected, locale, source:selected ? "selected-menu" : "unrecognized-selection"};
      const current = pick(composer, modes, locale);
      if (current) return {mode:current, locale, source:"composer"};
      const header = pick(switchers, modes, locale);
      return {mode:header, locale, source:header ? "model-switcher" : "unrecognized"};
    }
    function isSendButton(target) {
      const element = target?.nodeType === 1 ? target : target?.parentElement;
      const button = element?.closest("button");
      const composer = composerRoot();
      if (!button || !composer?.contains(button) || !visible(button) || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
      const testid = button.getAttribute("data-testid");
      const labels = [button.getAttribute("aria-label"), button.getAttribute("title"), button.textContent].map(normalize).filter(Boolean);
      const rows = localeRows(pageLocale());
      // Stop must win even when the element retains the submit id/type or a stale send testid.
      if (testid === "stop-button" || rows.some(row => row.stop.some(label => labels.includes(normalize(label))))) return false;
      if (testid === "send-button") return true;
      return rows.some(row => row.send.some(label => labels.includes(normalize(label)))) || labels.includes("send") || labels.includes("submit");
    }
    function sendButtonReady() {
      const composer = composerRoot();
      return Boolean(composer && Array.from(composer.querySelectorAll("button")).some(isSendButton));
    }
    return {detect, isSendButton, sendButtonReady, pageLocale};
  }
  root.ChatGPTTrackerSiteDetection = {normalize, resolveLocale, matchText, createDetector};
})(typeof window !== "undefined" ? window : globalThis);
