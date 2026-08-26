import { goals } from "./pathfinder.js";
import { error, log } from "./logger.js";
import { asVec3, inside, isMatureCrop, sleep } from "./utils.js";
import type { BotLike, RuntimeContext } from "./types.js";

export class FarmingModule {
  private bot: BotLike | null = null;
  private context: RuntimeContext | null = null;

  attach(bot: BotLike, context: RuntimeContext): void {
    this.bot = bot;
    this.context = context;
    if (!context.settings.modules.farming.enabled) log("[Farming]", "disabled by settings");
  }

  detach(): void {
    this.bot = null;
    this.context = null;
  }

  async run(): Promise<void> {
    if (!this.bot || !this.context) return;
    const settings = this.context.settings.modules.farming;
    if (!settings.enabled) throw new Error("Farming module is disabled");
    let harvested = 0;
    for (let x = settings.region.min.x; x <= settings.region.max.x; x += 1) {
      for (let y = settings.region.min.y; y <= settings.region.max.y; y += 1) {
        for (let z = settings.region.min.z; z <= settings.region.max.z; z += 1) {
          if (this.context.isInterrupted()) return;
          if (this.context.getState() === "COMBAT") return;
          if (!(await this.context.ensureInventory())) return;
          const position = { x, y, z };
          if (!inside(position, settings.region)) continue;
          const block = this.bot.blockAt(asVec3(position));
          const crop = block?.name ? settings.crops[block.name] : undefined;
          if (!crop || !isMatureCrop(block, crop)) continue;
          if (!block) continue;
          this.context.setState("WORKING", `harvesting ${block.name}`);
          await this.bot.pathfinder.goto(new goals.GoalNear(x, y, z, 2));
          await this.bot.dig(block);
          await this.replant(position, crop.seeds);
          harvested += 1;
          await sleep(settings.pauseMs);
        }
      }
    }
    log("[Farming]", "farm pass complete", { harvested });
  }

  private async replant(position: { x: number; y: number; z: number }, seeds: string[]): Promise<void> {
    if (!this.bot) return;
    const seed = this.bot.inventory.items().find((item) => seeds.includes(item.name));
    if (!seed) {
      log("[Farming]", "out of seed; skipping replant", { position });
      return;
    }
    const soil = this.bot.blockAt(asVec3({ x: position.x, y: position.y - 1, z: position.z }));
    if (!soil) return;
    try {
      await this.bot.equip(seed, "hand");
      await this.bot.placeBlock(soil, new (await import("vec3")).Vec3(0, 1, 0));
    } catch (cause) {
      error("[Farming]", "replant failed", cause);
    }
  }
}