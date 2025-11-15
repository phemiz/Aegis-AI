import http from "node:http";
import { loadConfigFromEnv } from "./config.js";
import { logger } from "./logger.js";

export function startHttpServer(): void {
  const config = loadConfigFromEnv();
  const port = config.HTTP_PORT;

  if (!port || port <= 0) {
    logger.info("HTTP transport disabled (HTTP_PORT not set)");
    return;
  }

  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    const method = req.method || "GET";

    const send = (status: number, body: unknown) => {
      const payload = JSON.stringify(body);
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(payload);
    };

    const requireAuth = () => {
      const token = config.HTTP_AUTH_TOKEN;
      if (!token) return true; // no auth configured

      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        send(401, { error: "unauthorized" });
        return false;
      }
      const provided = authHeader.slice("Bearer ".length);
      if (provided !== token) {
        send(403, { error: "forbidden" });
        return false;
      }
      return true;
    };

    // Only allow GET for these endpoints
    if (method !== "GET") {
      send(405, { error: "method_not_allowed" });
      return;
    }

    if (url === "/healthz") {
      if (!requireAuth()) return;
      send(200, { status: "ok" });
      return;
    }

    if (url === "/metrics") {
      if (!requireAuth()) return;
      // Placeholder metrics; can be extended with real counters.
      send(200, {
        status: "ok",
        uptimeSeconds: process.uptime(),
      });
      return;
    }

    send(404, { error: "not_found" });
  });

  server.on("error", (err) => {
    logger.error("HTTP server error", { error: String(err) });
  });

  server.listen(port, () => {
    logger.info("HTTP server listening", { port });
    logger.info("HTTP transport enabled");
  });
}
