import { useEffect, useState } from "react";
import "./App.css";

function App() {
  // Backend connection state
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Application version
  const [appVersion, setAppVersion] = useState("Loading...");

  // Updater state
  const [updateStatus, setUpdateStatus] = useState({
    state: "idle",
    message: "Updates have not been checked yet.",
  });

  const [isChecking, setIsChecking] = useState(false);

  // Backend connection
  useEffect(() => {
    const controller = new AbortController();

    async function fetchBackendMessage() {
      try {
        const backendUrl =
          await window.desktopAPI?.getBackendUrl?.();

        const endpoint = backendUrl
          ? `${backendUrl}/api/hello`
          : "/api/hello";

        const response = await fetch(endpoint, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Backend returned HTTP ${response.status}`,
          );
        }

        const data = await response.json();

        if (typeof data.message !== "string") {
          throw new Error(
            "Backend response did not include a message",
          );
        }

        setMessage(data.message);
        setStatus("success");
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(requestError.message);
        setStatus("error");
      }
    }

    fetchBackendMessage();

    return () => controller.abort();
  }, []);

  // Application version and updater status
  useEffect(() => {
    let isMounted = true;

    async function initializeUpdater() {
      try {
        const version =
          await window.desktopAPI?.getAppVersion?.();

        const currentStatus =
          await window.desktopAPI?.getUpdaterStatus?.();

        if (!isMounted) return;

        setAppVersion(version || "Development");

        if (currentStatus) {
          setUpdateStatus(currentStatus);
        }
      } catch (error) {
        if (isMounted) {
          setUpdateStatus({
            state: "error",
            message: error.message || "Unable to initialize updater.",
          });
        }
      }
    }

    initializeUpdater();

    const unsubscribe =
      window.desktopAPI?.onUpdaterStatus?.((newStatus) => {
        if (isMounted) {
          setUpdateStatus(newStatus);
          setIsChecking(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // Check for updates
  async function handleCheckForUpdates() {
    if (!window.desktopAPI?.checkForUpdates) {
      setUpdateStatus({
        state: "unavailable",
        message: "Update functionality is available only in the desktop app.",
      });
      return;
    }

    setIsChecking(true);

    try {
      const result =
        await window.desktopAPI.checkForUpdates();

      if (!result.ok) {
        setUpdateStatus({
          state: "error",
          message: result.message,
        });

        setIsChecking(false);
      }
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message: error.message || "Unable to check for updates.",
      });

      setIsChecking(false);
    }
  }

  // Install downloaded update
  async function handleInstallUpdate() {
    try {
      const result =
        await window.desktopAPI?.installUpdate?.();

      if (!result?.ok) {
        setUpdateStatus({
          state: "error",
          message:
            result?.message || "Unable to install the update.",
        });
      }
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message: error.message || "Update installation failed.",
      });
    }
  }

  const platform =
    window.desktopAPI?.platform ||
    navigator.platform ||
    "Browser";

  const appName =
    window.desktopAPI?.getAppName?.() ||
    "DesktopStarter";

  const isMacOS = platform === "darwin";

  const canCheckForUpdates =
    isMacOS && Boolean(window.desktopAPI?.checkForUpdates);

  return (
    <main className="app">
      <p className="eyebrow">Desktop development starter</p>

      <h1>DesktopStarter</h1>

      {/* Backend connection */}
      <section className="backend-card" aria-live="polite">
        <h2>Backend connection</h2>

        {status === "loading" && (
          <p role="status">Connecting to the backend...</p>
        )}

        {status === "success" && (
          <p className="success-message">{message}</p>
        )}

        {status === "error" && (
          <p className="error-message" role="alert">
            Backend connection failed: {error}.
          </p>
        )}
      </section>

      {/* Application information */}
      <section className="update-card">
        <h2>Application Updates</h2>

        <div className="version-info">
          <span>Current version</span>
          <strong>{appVersion}</strong>
        </div>

        <p className="update-message" aria-live="polite">
          {updateStatus.message}
        </p>

        {updateStatus.state === "downloading" && (
          <div className="download-progress">
            <progress
              value={updateStatus.percent || 0}
              max="100"
            />

            <span>{updateStatus.percent || 0}%</span>
          </div>
        )}

        <div className="update-actions">
          <button
            type="button"
            onClick={handleCheckForUpdates}
            disabled={!canCheckForUpdates || isChecking}
          >
            {isChecking ? "Checking..." : "Check for Updates"}
          </button>

          {updateStatus.state === "downloaded" && (
            <button
              type="button"
              className="install-button"
              onClick={handleInstallUpdate}
            >
              Restart and Install
            </button>
          )}
        </div>

        {!canCheckForUpdates && (
          <p className="update-note">
            Update checks are available in packaged macOS applications.
          </p>
        )}
      </section>

      {/* Runtime information */}
      <dl className="runtime-details">
        <div>
          <dt>Platform</dt>
          <dd>{platform}</dd>
        </div>

        <div>
          <dt>Application</dt>
          <dd>{appName}</dd>
        </div>
      </dl>
    </main>
  );
}

export default App;