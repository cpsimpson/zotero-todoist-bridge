const ZTB_PREF_TOKEN = "extensions.zotero-todoist-bridge.todoistToken";
const ZTB_PREF_TEMPLATES = "extensions.zotero-todoist-bridge.templates";

const ZTB_DEFAULT_TEMPLATES = [
  {
    name: "Reading Queue",
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

  init() {
    this.tokenInput = document.getElementById("ztb-token");
    this.templatesInput = document.getElementById("ztb-templates");
    this.statusLabel = document.getElementById("ztb-status");
    document.getElementById("ztb-save").addEventListener("command", () => this.save());
    document.getElementById("ztb-reset").addEventListener("command", () => this.resetToDefaults());
    this.load();
  },

  load() {
    this.tokenInput.value = Zotero.Prefs.get(ZTB_PREF_TOKEN, true) || "";
    let rawTemplates = Zotero.Prefs.get(ZTB_PREF_TEMPLATES, true) || "";
    if (!rawTemplates.trim()) {
      rawTemplates = JSON.stringify(ZTB_DEFAULT_TEMPLATES, null, 2);
      Zotero.Prefs.set(ZTB_PREF_TEMPLATES, rawTemplates, true);
    }
    this.templatesInput.value = rawTemplates;
    this.setStatus("");
  },

  save() {
    try {
      const parsed = JSON.parse(this.templatesInput.value || "[]");
      const validated = this.validateTemplates(parsed);
      const normalized = JSON.stringify(validated, null, 2);
      Zotero.Prefs.set(ZTB_PREF_TOKEN, this.tokenInput.value.trim(), true);
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
    if (!Array.isArray(candidate)) {
      throw new Error("Template config must be a JSON array.");
    }
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

  setStatus(message, isError) {
    this.statusLabel.value = message;
    this.statusLabel.style.color = isError ? "#cc3333" : "";
  },
};
