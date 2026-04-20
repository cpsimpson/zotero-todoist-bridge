var ZoteroTodoistBridge;

function log(message) {
  Zotero.debug(`Zotero Todoist Bridge: ${message}`);
}

function install() {
  log("Installed");
}

async function startup({ id, version, rootURI }) {
  log(`Starting ${version}`);

  Services.scriptloader.loadSubScript(`${rootURI}zotero-todoist-bridge.js`);
  ZoteroTodoistBridge.init({ id, version, rootURI });
  await ZoteroTodoistBridge.registerPreferencePane();
  ZoteroTodoistBridge.addToAllWindows();
  ZoteroTodoistBridge.startup();
}

function onMainWindowLoad({ window }) {
  ZoteroTodoistBridge?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  ZoteroTodoistBridge?.removeFromWindow(window);
}

function shutdown() {
  log("Shutting down");
  ZoteroTodoistBridge?.shutdown();
  ZoteroTodoistBridge?.removeFromAllWindows();
  ZoteroTodoistBridge = undefined;
}

function uninstall() {
  log("Uninstalled");
}
