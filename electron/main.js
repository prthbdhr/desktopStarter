import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} from "electron";

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startServer } from "../server/server.js";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

// ------------------------------------
// Path configuration
// ------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ------------------------------------
// Environment configuration
// ------------------------------------

const isProduction =
  app.isPackaged ||
  process.env.NODE_ENV === "production" ||
  process.env.ELECTRON_RENDERER_MODE === "production";

const isDevelopment = !isProduction;

// ------------------------------------
// Backend lifecycle state
// ------------------------------------

let backendHandle = null;
let backendStartupPromise = null;

// ------------------------------------
// Auto-update state
// ------------------------------------

let updateDownloaded = false;

let updaterStatus = {
  state: "idle",
  message: "Updates have not been checked yet.",
};

// ------------------------------------
// Application shutdown state
// ------------------------------------

let shutdownPromise = null;
let isQuitting = false;

// ------------------------------------
// IPC communication
// ------------------------------------

ipcMain.handle("backend:get-url", () => {
  if (!isProduction) {
    return null;
  }

  if (!backendHandle) {
    throw new Error("Backend is not running.");
  }

  return backendHandle.url;
});

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("updater:get-status", () => {
  return updaterStatus;
});

ipcMain.handle("updater:check", async () => {
  // Never check for updates in development or on unsupported platforms.
  if (!app.isPackaged || process.platform !== "darwin") {
    return {
      ok: false,
      message: "Updates are available only in packaged macOS builds.",
    };
  }

  try {
    await autoUpdater.checkForUpdates();

    return { ok: true };
  } catch (error) {
    console.error("Failed to check for updates:", error);

    return {
      ok: false,
      message: error.message || "Unable to check for updates.",
    };
  }
});

ipcMain.handle("updater:install", () => {
  if (!updateDownloaded) {
    return {
      ok: false,
      message: "No downloaded update is ready to install.",
    };
  }

  autoUpdater.quitAndInstall();

  return { ok: true };
});

// ------------------------------------
// Auto-update configuration and events
// ------------------------------------

autoUpdater.autoDownload = true;

// Require the user to choose when to restart and install.
autoUpdater.autoInstallOnAppQuit = false;

function sendUpdaterStatus(status) {
  updaterStatus = status;

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("updater:status", updaterStatus);
    }
  }
}

autoUpdater.on("checking-for-update", () => {
  sendUpdaterStatus({
    state: "checking",
    message: "Checking for updates...",
  });
});

autoUpdater.on("update-available", (info) => {
  sendUpdaterStatus({
    state: "available",
    version: info.version,
    message: `Version ${info.version} is available. Downloading...`,
  });
});

autoUpdater.on("update-not-available", (info) => {
  sendUpdaterStatus({
    state: "not-available",
    version: info.version,
    message: "You are using the latest version.",
  });
});

autoUpdater.on("download-progress", (progress) => {
  sendUpdaterStatus({
    state: "downloading",
    percent: Math.round(progress.percent),
    message: `Downloading update: ${Math.round(progress.percent)}%`,
  });
});

autoUpdater.on("update-downloaded", (info) => {
  updateDownloaded = true;

  sendUpdaterStatus({
    state: "downloaded",
    version: info.version,
    message: `Version ${info.version} is ready to install.`,
  });
});

autoUpdater.on("error", (error) => {
  console.error("Auto-update error:", error);

  sendUpdaterStatus({
    state: "error",
    message: error.message || "An unexpected update error occurred.",
  });
});

// ------------------------------------
// Create application window
// ------------------------------------

async function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,

    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDevelopment,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  try {
    if (isProduction) {
      const distIndexPath = resolve(
        __dirname,
        "../client/dist/index.html"
      );

      if (!existsSync(distIndexPath)) {
        win.destroy();

        dialog.showErrorBox(
          "Production Build Missing",
          `React production build not found:\n${distIndexPath}\n\nRun "npm run build" inside the client directory.`
        );

        app.quit();
        return;
      }

      await win.loadFile(distIndexPath);
    } else {
      const vitePort = process.env.VITE_PORT || 5173;

      await win.loadURL(
        `http://127.0.0.1:${vitePort}`
      );

      win.webContents.openDevTools();
    }
  } catch (error) {
    console.error(
      `Failed to load DesktopStarter in ${
        isProduction ? "production" : "development"
      } mode:`,
      error
    );

    if (!win.isDestroyed()) {
      win.destroy();
    }

    throw error;
  }
}

// ------------------------------------
// Application startup
// ------------------------------------

app.whenReady()
  .then(async () => {

    // Start backend only in production.
    if (isProduction) {
      backendStartupPromise = startServer({
        host: "127.0.0.1",
        port: 0,
      });

      backendHandle = await backendStartupPromise;

      console.log(
        "Production backend started:",
        backendHandle.url
      );
    }

    // Create application window.
    await createWindow();

    // macOS: recreate window without restarting backend.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch((error) => {
          console.error(
            "Failed to recreate DesktopStarter window:",
            error
          );

          app.quit();
        });
      }
    });
  })
  .catch((error) => {
    console.error("Failed to start DesktopStarter:", error);
    app.quit();
  });

// ------------------------------------
// Graceful backend shutdown
// ------------------------------------

app.on("before-quit", (event) => {

  // Allow the final quit request.
  if (isQuitting) {
    return;
  }

  // Prevent immediate application shutdown.
  event.preventDefault();

  // Avoid duplicate shutdown operations.
  if (shutdownPromise) {
    return;
  }

  shutdownPromise = (async () => {
    try {

      // Wait for backend startup if still pending.
      if (backendStartupPromise) {
        try {
          backendHandle = await backendStartupPromise;
        } catch (error) {
          console.error(
            "Backend startup failed before shutdown:",
            error
          );
        }
      }

      // Stop backend if it successfully started.
      if (backendHandle) {
        console.log("Stopping production backend...");

        await backendHandle.stopServer();

        backendHandle = null;
      }

      console.log("Backend shutdown completed.");

    } catch (error) {
      console.error(
        "Backend shutdown failed:",
        error
      );

    } finally {

      // Allow Electron to terminate.
      isQuitting = true;

      app.quit();
    }
  })();
});

// ------------------------------------
// Close application windows
// ------------------------------------

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

