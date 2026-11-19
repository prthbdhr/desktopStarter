import { startServer } from "./server.js";

let backend;
let isShuttingDown = false;

async function start() {
  try {
    backend = await startServer({
      host: "127.0.0.1",
      port: Number(process.env.PORT || 5000),
    });
  } catch (error) {
    console.error("Backend failed to start:", error);
    process.exitCode = 1;
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received; shutting down backend...`);

  try {
    await backend?.stopServer();
  } catch (error) {
    console.error("Backend shutdown failed:", error);
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();