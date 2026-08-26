import { goals } from "./pathfinder.js";
import { error, log } from "./logger.js";
import { asVec3, inside, nearbyHazard, sleep, voidRisk } from "./utils.js";
import type { Task } from "./task-queue.js";
import type { BotLike, RuntimeContext } from "./types.js";

export class MiningModule {
  private bot: BotLike | null = null;
  private context: RuntimeContext | null = null;

  attach(bot: BotLike, context: RuntimeContext): void {
    this.bot = bot;
    this.context = context;
    if (!context.settings.modules.mining.enabled) log("[Mining]", "disabled by settings");
  }

  detach(): void {
    this.bot = null;
    this.context = null;
  }

  async run(task: Extract<Task, { kind: "mine" }>): Promise<void> {
    if (!this.bot || !this.context) return;
    const settings = this.context.settings.modules.mining;
    if (!settings.enabled) throw new Error("Mining module is disabled");
    const blockNames = task.blockName === "*" ? settings.targetBlocks : [task.blockName];
    const blockIds = blockNames
      .map((name) => this.bot!.registry.blocksByName[name]?.id)
      .filter((id): id is number => typeof id === "number");
    if (blockIds.length === 0) throw new Error(`No registered block matches: ${blockNames.join(", ")}`);
    let mined = 0;
    while (!this.context.isInterrupted()) {
      if (this.context.getState() === "COMBAT") return;
      if (!(await this.context.ensureInventory())) return;
      if (this.context.getState() === "COMBAT") return;
      const target = this.findNearest(blockIds, settings.region, settings.maxDistance);
      if (!target) {
        log("[Mining]", "region exhausted", { mined });
        return;
      }
      if (nearbyHazard(this.bot, target.position) || voidRisk(this.bot, target.position)) {
        log("[Mining]", "skipping hazardous target", target.position);
        await sleep(settings.pauseMs);
        continue;
      }
      this.context.setState("WORKING", `mining ${target.name}`);
      await this.bot.pathfinder.goto(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2));
      if (
        this.context.isInterrupted() ||
        nearbyHazard(this.bot, target.position) ||
        voidRisk(this.bot, target.position)
      ) continue;
      await this.bot.dig(target);
      mined += 1;
      await sleep(settings.pauseMs);
    }
  }

  private findNearest(blockIds: number[], region: any, maxDistance: number): any | null {
    if (!this.bot) return null;
    const blocks = this.bot.findBlocks({
      matching: blockIds,
      maxDistance,
      count: 128,
    });
    let nearest: any | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const position of blocks) {
      if (!inside(position, region)) continue;
      const block = this.bot.blockAt(position);
      if (!block || !blockNamesMatch(block, blockIds)) continue;
      const currentDistance = this.bot.entity.position.distanceTo(position);
      if (currentDistance < nearestDistance) {
        nearest = block;
        nearestDistance = currentDistance;
      }
    }
    return nearest;
  }
}

function blockNamesMatch(block: { type?: number }, ids: number[]): boolean {
  return typeof block.type === "number" && ids.includes(block.type);
}