import { loadSettings } from "./config.js";
import { BotController } from "./controller.js";
import { error, log } from "./logger.js";
import { startHealthServer, startSelfPing } from "./server.js";

try {
  const settings = loadSettings();
  const controller = new BotController(settings);
  const healthServer = startHealthServer(controller, Number(process.env.PORT ?? settings.health.port));
  const selfPing =
    settings.health.selfPing.enabled && settings.health.selfPing.url
      ? startSelfPing(settings.health.selfPing.url, settings.health.selfPing.intervalMs)
      : null;
  controller.connect();

  const shutdown = (): void => {
    void controller.shutdown().finally(() => {
      selfPing?.unref();
      healthServer.close();
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (cause) {
  error("[Bot]", "startup failed", cause);
  process.exitCode = 1;
}