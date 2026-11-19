import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
  const controller = new AbortController();

  async function fetchBackendMessage() {
    try {
      // Wait for Electron to provide the backend URL.
      const backendUrl = await window.desktopAPI?.getBackendUrl?.();

      // Development uses Vite proxy.
      // Production uses Electron's dynamically assigned backend URL.
      const endpoint = backendUrl
        ? `${backendUrl}/api/hello`
        : "/api/hello";

      const response = await fetch(endpoint, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (typeof data.message !== "string") {
        throw new Error("Backend response did not include a message");
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

  const platform = window.desktopAPI?.platform || navigator.platform || "Browser";
  const appName = window.desktopAPI?.getAppName?.() || "DesktopStarter";

  return (
    <main className="app">
      <p className="eyebrow">Desktop development starter</p>
      <h1>DesktopStarter</h1>

      <section className="backend-card" aria-live="polite">
        <h2>Backend connection</h2>
        {status === "loading" && <p role="status">Connecting to the backend...</p>}
        {status === "success" && <p className="success-message">{message}</p>}
        {status === "error" && (
          <p className="error-message" role="alert">
            Backend connection failed: {error}.
          </p>
        )}
      </section>

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