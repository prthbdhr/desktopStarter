import { createServer } from "node:http";
import app from "./app.js";

export function startServer({
  host = "127.0.0.1",
  port = 0,
} = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);

    const handleError = (error) => {
      reject(error);
    };

    server.once("error", handleError);

    server.listen(port, host, () => {
      server.removeListener("error", handleError);

      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine backend address."));
        return;
      }

      const actualPort = address.port;
      const url = `http://${host}:${actualPort}`;

      console.log(`Backend running at ${url}`);

      resolve({
        server,
        host,
        port: actualPort,
        url,
        stopServer: () =>
          new Promise((resolveStop, rejectStop) => {
            if (!server.listening) {
              resolveStop();
              return;
            }

            server.close((error) => {
              if (error) {
                rejectStop(error);
                return;
              }

              console.log("Backend stopped.");
              resolveStop();
            });
          }),
      });
    });
  });
}