var ZTB_PREF_TOKEN = "extensions.zotero-todoist-bridge.todoistToken";
var ZTB_PREF_TEMPLATES = "extensions.zotero-todoist-bridge.templates";

var ZTB_DEFAULT_TEMPLATES = [
  {
    name: "Add to Reading Queue",
    text: "Read {{title}} {{url}} #Reading",
  },
  {
    name: "Review Tomorrow",
    text: "Review {{title}} {{url}} tomorrow #Reading p2",
  },
];

var ZoteroTodoistBridgePrefs = {
  tokenInput: null,
  templatesInput: null,
  statusLabel: null,
  initialized: false,

  init() {
    if (this.initialized) {
      return;
    }
    this.tokenInput = document.getElementById("ztb-token");
    this.templatesInput = document.getElementById("ztb-templates");
    this.statusLabel = document.getElementById("ztb-status");
    let saveButton = document.getElementById("ztb-save");
    let resetButton = document.getElementById("ztb-reset");
    if (!this.tokenInput || !this.templatesInput || !this.statusLabel || !saveButton || !resetButton) {
      return;
    }
    saveButton.addEventListener("command", () => this.save());
    resetButton.addEventListener("command", () => this.resetToDefaults());
    this.initialized = true;
    this.load();
  },

  load() {
    if (!this.initialized) {
      return;
    }
    this.tokenInput.value = Zotero.Prefs.get(ZTB_PREF_TOKEN, true) || "";
    let rawTemplates = Zotero.Prefs.get(ZTB_PREF_TEMPLATES, true);
    if (typeof rawTemplates !== "string" || !rawTemplates.trim()) {
      rawTemplates = JSON.stringify(ZTB_DEFAULT_TEMPLATES, null, 2);
      Zotero.Prefs.set(ZTB_PREF_TEMPLATES, rawTemplates, true);
    }
    this.templatesInput.value = rawTemplates;

    const { error } = this.parseTemplateConfigs(rawTemplates);
    if (error) {
      this.setStatus(`Templates JSON has errors and was preserved: ${error}`, true);
    } else {
      this.setStatus("");
    }
  },

  save() {
    Zotero.Prefs.set(ZTB_PREF_TOKEN, this.tokenInput.value.trim(), true);
    try {
      const { templates, error } = this.parseTemplateConfigs(this.templatesInput.value || "");
      if (error) {
        throw new Error(error);
      }
      const normalized = JSON.stringify(templates, null, 2);
      Zotero.Prefs.set(ZTB_PREF_TEMPLATES, normalized, true);
      this.templatesInput.value = normalized;
      this.setStatus("Saved");
    } catch (error) {
      this.setStatus(`Invalid template JSON: ${String(error.message || error)}`, true);
    }
  },

  resetToDefaults() {
    const defaultsText = JSON.stringify(ZTB_DEFAULT_TEMPLATES, null, 2);
    this.templatesInput.value = defaultsText;
    Zotero.Prefs.set(ZTB_PREF_TEMPLATES, defaultsText, true);
    this.setStatus("Defaults restored");
  },

  validateTemplates(candidate) {
    const templates = [];
    for (let i = 0; i < candidate.length; i++) {
      const template = candidate[i];
      if (!template || typeof template !== "object") {
        throw new Error(`Template ${i + 1} must be an object.`);
      }
      const name = typeof template.name === "string" ? template.name.trim() : "";
      const text = typeof template.text === "string" ? template.text.trim() : "";
      if (!name) {
        throw new Error(`Template ${i + 1} is missing a non-empty "name".`);
      }
      if (!text) {
        throw new Error(`Template ${i + 1} is missing a non-empty "text".`);
      }
      templates.push({ name, text });
    }
    return templates;
  },

  parseTemplateConfigs(raw) {
    if (typeof raw !== "string") {
      return { templates: [], error: "Template config must be text." };
    }
    if (!raw.trim()) {
      return { templates: [], error: "Template config must not be empty." };
    }
    try {
      const parsed = JSON.parse(raw);
      const candidate = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === "object" && Array.isArray(parsed.templates))
          ? parsed.templates
          : null;

      if (!candidate) {
        return {
          templates: [],
          error: "Template config must be a JSON array or an object with a templates array.",
        };
      }

      const templates = this.validateTemplates(candidate);
      if (!templates.length) {
        return { templates: [], error: "At least one template is required." };
      }

      return { templates, error: null };
    } catch (error) {
      return { templates: [], error: String(error.message || error) };
    }
  },

  setStatus(message, isError) {
    if (!this.statusLabel) {
      return;
    }
    this.statusLabel.value = message;
    this.statusLabel.style.color = isError ? "#cc3333" : "";
  },
};
