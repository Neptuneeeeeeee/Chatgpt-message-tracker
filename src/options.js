(function () {
  "use strict";

  const Core = window.ChatGPTTrackerCore;
  let settings = null;
  let usage = null;

  const els = {
    list: document.getElementById("mode-list"),
    addMode: document.getElementById("add-mode"),
    save: document.getElementById("save"),
    export: document.getElementById("export"),
    resetActive: document.getElementById("reset-active"),
    resetAll: document.getElementById("reset-all")
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    els.list.innerHTML = settings.modes
      .map((mode) => {
        return `
          <div class="mode-row" data-mode-id="${escapeHtml(mode.id)}">
            <div class="field">
              <label>名称</label>
              <input data-field="label" value="${escapeHtml(mode.label)}" maxlength="40">
            </div>
            <label class="enabled-field">
              <input data-field="enabled" type="checkbox" ${mode.enabled ? "checked" : ""}>
              启用
            </label>
            <button type="button" data-action="remove">删除</button>
          </div>
        `;
      })
      .join("");

    els.list.querySelectorAll('[data-action="remove"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        const row = event.target.closest(".mode-row");
        row.remove();
      });
    });
  }

  function readRows() {
    const rows = Array.from(els.list.querySelectorAll(".mode-row"));
    const modes = rows.map((row, index) => {
      const label = row.querySelector('[data-field="label"]').value.trim() || `Mode ${index + 1}`;
      return {
        id: row.dataset.modeId || Core.slugify(label, `mode-${index + 1}`),
        label,
        enabled: row.querySelector('[data-field="enabled"]').checked
      };
    });

    return Core.normalizeSettings(Object.assign({}, settings, { modes }));
  }

  async function save() {
    const next = readRows();
    settings = await Core.saveSettings(next);
    render();
  }

  function addMode() {
    settings = readRows();
    settings.modes.push({
      id: `custom-${Date.now()}`,
      label: "自定义模式",
      enabled: true
    });
    render();
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

  async function resetActiveMode() {
    const active = settings.modes.find((mode) => mode.id === settings.activeModeId) || settings.modes[0];
    if (!active) return;
    if (!window.confirm(`永久删除 ${active.label} 的全部历史记录？此操作不可撤销，「更多功能」里也会一并消失。\n\n若只想归零计数，请用弹窗里的「清零计数」。`)) return;
    usage = await Core.resetMode(active.id);
  }

  async function resetAll() {
    if (!window.confirm("永久删除所有模式的全部历史记录？此操作不可撤销。\n\n若只想归零计数，请用弹窗里的「清零计数」。")) return;
    usage = await Core.saveUsage({ entries: [] });
  }

  async function init() {
    settings = await Core.getSettings();
    usage = await Core.getUsage();
    render();

    els.addMode.addEventListener("click", addMode);
    els.save.addEventListener("click", save);
    els.export.addEventListener("click", exportData);
    els.resetActive.addEventListener("click", resetActiveMode);
    els.resetAll.addEventListener("click", resetAll);
  }

  init().catch((error) => {
    document.body.textContent = `Tracker failed to load: ${error.message}`;
  });
})();
