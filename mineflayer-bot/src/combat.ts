import { error, log } from "./logger.js";
import { sleep } from "./utils.js";
import type { BotLike, RuntimeContext } from "./types.js";

export class CombatModule {
  private bot: BotLike | null = null;
  private context: RuntimeContext | null = null;
  private timer: NodeJS.Timeout | null = null;
  private target: any = null;
  private running = false;

  attach(bot: BotLike, context: RuntimeContext): void {
    this.detach();
    this.bot = bot;
    this.context = context;
    const settings = context.settings.modules.combat;
    if (!settings.enabled) {
      log("[Combat]", "disabled by settings");
      return;
    }
    this.timer = setInterval(() => void this.scan(), settings.scanIntervalMs);
    log("[Combat]", `enabled with ${settings.radius}-block aggro radius`);
  }

  detach(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stop();
    this.bot = null;
    this.context = null;
  }

  stop(): void {
    if (this.bot?.pvp) {
      try {
        this.bot.pvp.stop();
      } catch (cause) {
        error("[Combat]", "combat stop failed", cause);
      }
    }
    this.target = null;
    this.running = false;
  }

  private async scan(): Promise<void> {
    if (!this.bot || !this.context || this.running || this.context.getState() === "FLEEING") return;
    const settings = this.context.settings.modules.combat;
    const target = this.bot.nearestEntity((entity) => {
      const name = entity.name ?? entity.mobType;
      return (
        entity.type === "mob" &&
        typeof name === "string" &&
        settings.hostileNames.includes(name) &&
        entity.position.distanceTo(this.bot!.entity.position) <= settings.radius
      );
    });
    if (!target) return;
    this.target = target;
    this.running = true;
    this.context.setState("COMBAT", `target ${target.name ?? target.mobType ?? "hostile"}`);
    log("[Combat]", "engaging hostile", { name: target.name ?? target.mobType });
    try {
      if (this.bot.pvp) {
        this.bot.pvp.attack(target);
        while (
          this.bot &&
          target.isValid &&
          this.context.getState() === "COMBAT" &&
          !this.context.isInterrupted()
        ) {
          if ((this.bot.health ?? 0) / 20 * 100 <= this.context.settings.modules.survival.fleeBelowHealthPercent) {
            this.stop();
            return;
          }
          await sleep(250);
        }
        this.stop();
      } else {
        this.bot.attack(target);
        await sleep(500);
      }
    } catch (cause) {
      error("[Combat]", "combat loop failed", cause);
      this.stop();
    } finally {
      if (this.context?.getState() === "COMBAT") this.context.setState("IDLE", "combat ended");
      this.running = false;
    }
  }
}