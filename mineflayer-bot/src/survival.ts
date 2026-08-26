import type { BotSettings } from "./config.js";
import { error, log } from "./logger.js";
import { asVec3, distance, sleep } from "./utils.js";
import type { BotLike, RuntimeContext } from "./types.js";

export class SurvivalModule {
  private bot: BotLike | null = null;
  private fleeing = false;
  private boundHandlers: Array<() => void> = [];

  attach(bot: BotLike, context: RuntimeContext): void {
    this.detach();
    this.bot = bot;
    const settings = context.settings.modules.survival;
    if (!settings.enabled) {
      log("[Survival]", "disabled by settings");
      return;
    }

    if (bot.autoEat) {
      bot.autoEat.options = {
        priority: "foodPoints",
        startAt: settings.eatBelowFood,
        bannedFood: [],
      };
      log("[Survival]", `auto-eat enabled below food level ${settings.eatBelowFood}`);
    }

    const onSpawn = (): void => {
      void this.equipArmor(settings);
    };
    const onHealth = (): void => {
      void this.checkHealth(context);
    };
    bot.on("spawn", onSpawn);
    bot.on("health", onHealth);
    bot.on("physicsTick", onHealth);
    this.boundHandlers.push(
      () => bot.off("spawn", onSpawn),
      () => bot.off("health", onHealth),
      () => bot.off("physicsTick", onHealth),
    );
  }

  detach(): void {
    for (const remove of this.boundHandlers.splice(0)) remove();
    this.bot = null;
    this.fleeing = false;
  }

  private async equipArmor(settings: BotSettings["modules"]["survival"]): Promise<void> {
    if (!settings.equipArmorOnSpawn || !this.bot?.armorManager?.equipAll) return;
    try {
      await this.bot.armorManager.equipAll();
      log("[Survival]", "best available armor equipped");
    } catch (cause) {
      error("[Survival]", "armor equip failed", cause);
    }
  }

  private async checkHealth(context: RuntimeContext): Promise<void> {
    if (!this.bot || context.getState() === "DEAD") return;
    const settings = context.settings.modules.survival;
    const healthPercent = (this.bot.health ?? 0) / 20 * 100;
    if (!this.fleeing && healthPercent <= settings.fleeBelowHealthPercent) {
      this.fleeing = true;
      context.setState("FLEEING", `health ${Math.round(healthPercent)}%`);
      log("[Survival]", "health threshold reached; fleeing");
      await context.goHome();
      return;
    }
    if (
      this.fleeing &&
      healthPercent >= settings.resumeAboveHealthPercent &&
      distance(this.bot.entity.position, asVec3(context.settings.home.coordinates)) <= context.settings.home.arriveDistance + 2
    ) {
      this.fleeing = false;
      context.setState("IDLE", `health recovered to ${Math.round(healthPercent)}%`);
      log("[Survival]", "safe health restored");
    }
  }

  async waitUntilSafe(context: RuntimeContext): Promise<void> {
    while (this.fleeing && this.bot) {
      await sleep(1000);
      await this.checkHealth(context);
    }
  }

  get isFleeing(): boolean {
    return this.fleeing;
  }
}