import express from "express";
import type { Server } from "node:http";
import type { BotController } from "./controller.js";
import { error, log } from "./logger.js";

export function startHealthServer(controller: BotController, port: number): Server {
  const app = express();
  app.get("/healthz", (_request, response) => {
    const status = controller.status();
    response.status(status.connected ? 200 : 503).json({ ok: status.connected, ...status });
  });
  app.get("/status", (_request, response) => response.json(controller.status()));
  const server = app.listen(port, () => log("[Health]", `listening on port ${port}`));
  server.on("error", (cause) => error("[Health]", "server error", cause));
  return server;
}

export function startSelfPing(url: string, intervalMs: number): NodeJS.Timeout {
  const timer = setInterval(() => {
    void fetch(url).catch((cause) => error("[Health]", "self-ping failed", cause));
  }, intervalMs);
  timer.unref();
  return timer;
}