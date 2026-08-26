import { error, log } from "./logger.js";
import { asVec3, sleep } from "./utils.js";
import type { BotLike, RuntimeContext } from "./types.js";

export class InventoryModule {
  private bot: BotLike | null = null;
  private context: RuntimeContext | null = null;
  private handling = false;

  attach(bot: BotLike, context: RuntimeContext): void {
    this.bot = bot;
    this.context = context;
    if (!context.settings.modules.inventory.enabled) log("[Inventory]", "disabled by settings");
  }

  detach(): void {
    this.bot = null;
    this.context = null;
    this.handling = false;
  }

  async ensureCapacity(): Promise<boolean> {
    if (!this.bot || !this.context || this.handling) return true;
    const settings = this.context.settings.modules.inventory;
    if (!settings.enabled || this.context.inventoryFullness() < settings.fullnessThreshold) return true;
    if (this.context.getState() === "FLEEING" || this.context.getState() === "COMBAT") return false;
    this.handling = true;
    this.context.setState("RETURNING_HOME", "inventory fullness threshold reached");
    try {
      await this.context.goHome();
      if (this.context.getState() === "FLEEING" || this.context.getState() === "COMBAT") return false;
      await this.deposit();
      this.context.setState("IDLE", "inventory deposit complete");
      return true;
    } catch (cause) {
      error("[Inventory]", "deposit cycle failed", cause);
      return false;
    } finally {
      this.handling = false;
    }
  }

  private async deposit(): Promise<void> {
    if (!this.bot || !this.context) return;
    const chestBlock = this.bot.blockAt(asVec3(this.context.settings.home.chest));
    if (!chestBlock || chestBlock.name !== "chest" && chestBlock.name !== "trapped_chest") {
      throw new Error("Configured home.chest does not contain a chest");
    }
    this.context.setState("DEPOSITING", "opening home chest");
    const chest = await this.bot.openChest(chestBlock);
    try {
      const keep = new Map(this.context.settings.modules.inventory.keepItems.map((item) => [item.name, item.count]));
      for (const item of [...this.bot.inventory.items()]) {
        const allowed = keep.get(item.name) ?? 0;
        const current = this.bot.inventory.items()
          .filter((candidate) => candidate.name === item.name)
          .reduce((total, candidate) => total + candidate.count, 0);
        const amount = Math.max(0, current - allowed);
        if (amount > 0) await chest.deposit(item.type, null, Math.min(amount, item.count));
      }
    } finally {
      chest.close();
    }
    await sleep(500);
    log("[Inventory]", "items deposited while preserving keep list");
  }
}