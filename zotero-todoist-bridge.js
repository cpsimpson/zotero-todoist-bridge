const ZTB_PREF_TOKEN = "extensions.zotero-todoist-bridge.todoistToken";
const ZTB_PREF_TEMPLATES = "extensions.zotero-todoist-bridge.templates";
const ZTB_MENU_ID = "zotero-todoist-bridge-item-menu";
const ZTB_PREFERENCE_PANE_ID = "zotero-prefpane-todoist-bridge";
const TODOIST_QUICK_ADD_URL = "https://api.todoist.com/api/v1/tasks/quick";

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

ZoteroTodoistBridge = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  menuID: null,
  preferenceObserverID: null,
  prefPaneRegistered: false,

  init({ id, version, rootURI }) {
    if (this.initialized) {
      return;
    }
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  },

  log(message) {
    Zotero.debug(`Zotero Todoist Bridge: ${message}`);
  },

  async registerPreferencePane() {
    if (this.prefPaneRegistered) {
      return;
    }
    await Zotero.PreferencePanes.register({
      pluginID: this.id,
      id: ZTB_PREFERENCE_PANE_ID,
      src: `${this.rootURI}preferences.xhtml`,
      scripts: [`${this.rootURI}preferences.js`],
    });
    this.prefPaneRegistered = true;
  },

  startup() {
    this.ensureDefaultTemplatePref();
    this.registerMenus();
    this.preferenceObserverID = Zotero.Prefs.registerObserver(
      ZTB_PREF_TEMPLATES,
      () => this.rebuildMenus(),
      true
    );
  },

  shutdown() {
    this.unregisterMenus();
    if (this.preferenceObserverID) {
      Zotero.Prefs.unregisterObserver(this.preferenceObserverID);
      this.preferenceObserverID = null;
    }
  },

  addToWindow(window) {
    window.MozXULElement.insertFTLIfNeeded("zotero-todoist-bridge.ftl");
  },

  addToAllWindows() {
    for (let win of Zotero.getMainWindows()) {
      if (!win.ZoteroPane) {
        continue;
      }
      this.addToWindow(win);
    }
  },

  removeFromWindow(window) {
    window.document
      .querySelector('[href="zotero-todoist-bridge.ftl"]')
      ?.remove();
  },

  removeFromAllWindows() {
    for (let win of Zotero.getMainWindows()) {
      if (!win.ZoteroPane) {
        continue;
      }
      this.removeFromWindow(win);
    }
  },

  ensureDefaultTemplatePref() {
    const current = Zotero.Prefs.get(ZTB_PREF_TEMPLATES, true);
    if (typeof current === "string" && current.trim()) {
      return;
    }
    Zotero.Prefs.set(
      ZTB_PREF_TEMPLATES,
      JSON.stringify(ZTB_DEFAULT_TEMPLATES, null, 2),
      true
    );
  },

  getTemplateConfigs() {
    const raw = Zotero.Prefs.get(ZTB_PREF_TEMPLATES, true);
    try {
      const parsed = JSON.parse(raw);
      const templates = this.validateTemplateConfigs(parsed);
      if (templates.length) {
        return templates;
      }
    } catch (error) {
      this.log(`Template parse failed: ${error}`);
    }
    return ZTB_DEFAULT_TEMPLATES;
  },

  validateTemplateConfigs(candidate) {
    if (!Array.isArray(candidate)) {
      return [];
    }
    const templates = [];
    for (let i = 0; i < candidate.length; i++) {
      const template = candidate[i];
      if (!template || typeof template !== "object") {
        continue;
      }
      const name = typeof template.name === "string" ? template.name.trim() : "";
      const text = typeof template.text === "string" ? template.text.trim() : "";
      if (!name || !text) {
        continue;
      }
      templates.push({ name, text });
    }
    return templates;
  },

  registerMenus() {
    const templates = this.getTemplateConfigs();
    const templateMenus = templates.map((template, index) => ({
      menuType: "menuitem",
      l10nID: "zotero-todoist-menu-template",
      l10nArgs: JSON.stringify({ name: template.name }),
      onShowing: (event, context) => {
        context.setL10nArgs(JSON.stringify({ name: template.name }));
        context.setEnabled(this.getRegularItemsFromSelection(context.items).length > 0);
      },
      onCommand: async (event, context) => {
        await this.sendSelectionToTodoist(context.items, template, index);
      },
    }));

    templateMenus.push({
      menuType: "menuitem",
      l10nID: "zotero-todoist-menu-open-settings",
      onCommand: () => this.openPreferences(),
    });

    this.menuID = Zotero.MenuManager.registerMenu({
      menuID: ZTB_MENU_ID,
      pluginID: this.id,
      target: "main/library/item",
      menus: [
        {
          menuType: "submenu",
          l10nID: "zotero-todoist-menu-root",
          onShowing: (event, context) => {
            context.setVisible(Array.isArray(context.items) && context.items.length > 0);
            context.setEnabled(this.getRegularItemsFromSelection(context.items).length > 0);
          },
          menus: templateMenus,
        },
      ],
    });
  },

  rebuildMenus() {
    this.unregisterMenus();
    this.registerMenus();
  },

  unregisterMenus() {
    if (this.menuID) {
      Zotero.MenuManager.unregisterMenu(this.menuID);
      this.menuID = null;
    }
  },

  openPreferences() {
    Zotero.Utilities.Internal.openPreferences(ZTB_PREFERENCE_PANE_ID);
  },

  getToken() {
    return (Zotero.Prefs.get(ZTB_PREF_TOKEN, true) || "").trim();
  },

  async sendSelectionToTodoist(rawSelection, template, templateIndex) {
    const token = this.getToken();
    if (!token) {
      Services.prompt.alert(
        null,
        "Zotero Todoist Bridge",
        "Set your Todoist API token in Zotero Settings -> Zotero Todoist Bridge."
      );
      this.openPreferences();
      return;
    }

    const items = this.getRegularItemsFromSelection(rawSelection);
    if (!items.length) {
      return;
    }

    let sent = 0;
    let firstError = null;

    for (let item of items) {
      const payloadText = this.renderTemplate(template.text, this.getTemplateVariables(item));
      if (!payloadText) {
        continue;
      }
      try {
        await this.quickAddTask(token, payloadText);
        sent++;
      } catch (error) {
        if (!firstError) {
          firstError = error;
        }
        this.log(
          `Quick add failed for template index ${templateIndex}, item ${item.id}: ${error}`
        );
      }
    }

    if (sent > 0 && !firstError) {
      return;
    }

    const title = "Zotero Todoist Bridge";
    if (!sent && firstError) {
      Services.prompt.alert(
        null,
        title,
        `Failed to create Todoist task. ${String(firstError.message || firstError)}`
      );
      return;
    }

    if (firstError) {
      Services.prompt.alert(
        null,
        title,
        `Created ${sent} task(s), but some failed. ${String(firstError.message || firstError)}`
      );
    }
  },

  async quickAddTask(token, text) {
    const response = await fetch(TODOIST_QUICK_ADD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Todoist API ${response.status}: ${detail.slice(0, 300)}`);
    }
  },

  getRegularItemsFromSelection(selection) {
    if (!Array.isArray(selection)) {
      return [];
    }
    const byID = new Map();
    for (let value of selection) {
      const item = this.resolveRegularItem(value);
      if (item && item.id && !byID.has(item.id)) {
        byID.set(item.id, item);
      }
    }
    return [...byID.values()];
  },

  resolveRegularItem(value) {
    if (!value || typeof value.isRegularItem !== "function") {
      return null;
    }
    if (value.isRegularItem()) {
      return value;
    }
    const parentItemID = value.parentItemID || value.parentID;
    if (parentItemID) {
      const parent = Zotero.Items.get(parentItemID);
      if (parent && typeof parent.isRegularItem === "function" && parent.isRegularItem()) {
        return parent;
      }
    }
    return null;
  },

  renderTemplate(templateText, vars) {
    const rendered = templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      if (!(key in vars)) {
        return "";
      }
      return String(vars[key] ?? "");
    });
    return rendered
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },

  getTemplateVariables(item) {
    const creators = item
      .getCreators()
      .map((creator) => [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim())
      .filter(Boolean);

    const date = item.getField("date") || "";
    const year = item.getField("year") || this.extractYear(date);
    const library = Zotero.Libraries.get(item.libraryID);

    return {
      title: item.getDisplayTitle() || "",
      key: item.key || "",
      item_id: item.id || "",
      item_type: Zotero.ItemTypes.getName(item.itemTypeID) || "",
      first_creator: item.getField("firstCreator") || creators[0] || "",
      creators: creators.join(", "),
      year: year || "",
      date: date || "",
      doi: item.getField("DOI") || "",
      url: item.getField("url") || "",
      abstract: item.getField("abstractNote") || "",
      zotero_uri: Zotero.URI.getItemURI(item) || "",
      zotero_select: this.getSelectURI(library, item),
    };
  },

  extractYear(dateValue) {
    const match = (dateValue || "").match(/\b(\d{4})\b/);
    return match ? match[1] : "";
  },

  getSelectURI(library, item) {
    if (!library || library.libraryType === "user") {
      return `zotero://select/library/items/${item.key}`;
    }
    if (library.libraryType === "group") {
      return `zotero://select/groups/${library.groupID}/items/${item.key}`;
    }
    return `zotero://select/items/${item.key}`;
  },
};
