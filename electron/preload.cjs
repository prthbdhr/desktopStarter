const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "desktopAPI",
  Object.freeze({
    platform: process.platform,

    getAppName: () => "DesktopStarter",

    // Backend API
    getBackendUrl: () =>
      ipcRenderer.invoke("backend:get-url"),

    // Auto-update API
    getUpdaterStatus: () =>
      ipcRenderer.invoke("updater:get-status"),

    checkForUpdates: () =>
      ipcRenderer.invoke("updater:check"),

    installUpdate: () =>
      ipcRenderer.invoke("updater:install"),

    onUpdaterStatus: (callback) => {
      const listener = (_event, status) => {
        callback(status);
      };

      ipcRenderer.on("updater:status", listener);

      // Return cleanup function to remove the listener.
      return () => {
        ipcRenderer.removeListener(
          "updater:status",
          listener
        );
      };
    },
  })
);