import { createBot } from "mineflayer";
import { pathfinder, Movements, goals } from "./pathfinder.js";
import armorManager from "mineflayer-armor-manager";
import { loader as autoEat } from "mineflayer-auto-eat";
import { plugin as pvp } from "mineflayer-pvp";
import { error, log } from "./logger.js";
import { TaskQueue, type Task } from "./task-queue.js";
import { asVec3, distance, inside } from "./utils.js";
import { SurvivalModule } from "./survival.js";
import { CombatModule } from "./combat.js";
import { InventoryModule } from "./inventory.js";
import { MiningModule } from "./mining.js";
import { FarmingModule } from "./farming.js";
import type { BotLike, BotState, RuntimeContext } from "./types.js";
import type { BotSettings } from "./config.js";

export class BotController {
  readonly queue = new TaskQueue();
  private bot: BotLike | null = null;
  private state: BotState = "DISCONNECTED";
  private taskLoopRunning = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay: number;
  private interrupted = false;
  private readonly survival = new SurvivalModule();
  private readonly combat = new CombatModule();
  private readonly inventory = new InventoryModule();
  private readonly mining = new MiningModule();
  private readonly farming = new FarmingModule();

  constructor(readonly settings: BotSettings) {
    this.reconnectDelay = settings.bot.reconnect.delayMs;
  }

  private setState(nextState: BotState, reason: string): void {
    if (this.state === nextState) return;
    const previous = this.state;
    this.state = nextState;
    log("[TaskQueue]", `state ${previous} -> ${nextState}`, { reason });
  }

  connect(): void {
    this.clearReconnect();
    this.state = "DISCONNECTED";
    log("[Bot]", `connecting to ${this.settings.server.host}:${this.settings.server.port}`);
    const bot = createBot({
      host: this.settings.server.host,
      port: this.settings.server.port,
      username: this.settings.bot.username,
      password: this.settings.bot.password || undefined,
      auth: this.settings.server.auth,
      version: this.settings.server.version || undefined,
      hideErrors: false,
    }) as BotLike;
    this.bot = bot;

    bot.loadPlugin(pathfinder);
    if (this.settings.modules.survival.enabled) {
      bot.loadPlugin(autoEat);
      bot.loadPlugin(armorManager);
    }
    if (this.settings.modules.combat.enabled) bot.loadPlugin(pvp);

    bot.once("spawn", () => {
      if (!this.bot) return;
      const movements = new Movements(bot);
      movements.canDig = true;
      movements.allow1by1towers = false;
      movements.allowFreeMotion = false;
      movements.blocksToAvoid.add(bot.registry.blocksByName.lava?.id ?? -1);
      movements.blocksToAvoid.add(bot.registry.blocksByName.fire?.id ?? -1);
      bot.pathfinder.setMovements(movements);
      this.reconnectDelay = this.settings.bot.reconnect.delayMs;
      this.setState("IDLE", "spawned");
      this.attachModules(bot);
      log("[Bot]", "spawned and ready");
      void this.runTasks();
    });

    bot.on("chat", (username, message) => this.handleChat(username, message));
    bot.on("death", () => {
      this.interrupted = true;
      this.combat.stop();
      this.setState("DEAD", "bot died");
      log("[Bot]", "death detected; waiting for respawn");
    });
    bot.on("respawn", () => {
      this.interrupted = false;
      this.setState("RETURNING_HOME", "respawned");
      void this.goHome().then(() => {
        this.setState("IDLE", "returned home after death");
        void this.runTasks();
      });
    });
    bot.on("kicked", (reason) => {
      log("[Bot]", "kicked from server", reason);
    });
    bot.on("end", (reason) => {
      this.detachModules();
      this.bot = null;
      this.setState("DISCONNECTED", `connection ended: ${reason}`);
      if (this.settings.bot.reconnect.enabled) this.scheduleReconnect();
    });
    bot.on("error", (cause) => error("[Bot]", "mineflayer error", cause));
  }

  status(): Record<string, unknown> {
    return {
      state: this.state,
      connected: Boolean(this.bot),
      currentTask: this.queue.current,
      pendingTasks: this.queue.pending,
      health: this.bot?.health ?? null,
      food: this.bot?.food ?? null,
      inventoryFullness: this.inventoryFullness(),
      position: this.bot?.entity.position ?? null,
    };
  }

  stopTasks(): void {
    this.interrupted = true;
    this.queue.clear();
    this.combat.stop();
    if (this.state !== "DISCONNECTED" && this.state !== "DEAD") this.setState("IDLE", "tasks stopped by command");
  }

  private attachModules(bot: BotLike): void {
    const context = this.context();
    this.survival.attach(bot, context);
    this.combat.attach(bot, context);
    this.inventory.attach(bot, context);
    this.mining.attach(bot, context);
    this.farming.attach(bot, context);
  }

  private detachModules(): void {
    this.survival.detach();
    this.combat.detach();
    this.inventory.detach();
    this.mining.detach();
    this.farming.detach();
  }

  private context(): RuntimeContext {
    if (!this.bot) throw new Error("Bot is not connected");
    return {
      bot: this.bot,
      settings: this.settings,
      queue: this.queue,
      getState: () => this.state,
      setState: (state, reason) => this.setState(state, reason),
        isInterrupted: () => this.interrupted || this.state === "FLEEING" || !this.bot,
      goHome: () => this.goHome(),
      positionInRegion: (position, region) => inside(position, region),
      inventoryFullness: () => this.inventoryFullness(),
        ensureInventory: () => this.inventory.ensureCapacity(),
    };
  }

  private async runTasks(): Promise<void> {
    if (this.taskLoopRunning || !this.bot) return;
    this.taskLoopRunning = true;
    this.interrupted = false;
    try {
      while (this.bot && this.state !== "DEAD") {
        if (this.state === "FLEEING" || this.state === "COMBAT") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        const task = this.queue.current ?? this.queue.next();
        if (!task) {
          if (this.state !== "IDLE") this.setState("IDLE", "task queue empty");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        this.interrupted = false;
        log("[TaskQueue]", "starting task", task);
        try {
          if (task.kind === "mine") await this.mining.run(task);
          if (task.kind === "farm") await this.farming.run();
          if (task.kind === "guard") await this.runGuard();
        } catch (cause) {
          error("[TaskQueue]", "task failed", cause);
        } finally {
          if (!["FLEEING", "COMBAT", "DEAD"].includes(this.state)) {
            this.queue.finish();
            this.setState("IDLE", "task finished");
          }
          log("[TaskQueue]", "task finished", task);
        }
      }
    } finally {
      this.taskLoopRunning = false;
    }
  }

  private async runGuard(): Promise<void> {
    this.interrupted = false;
    this.setState("WORKING", "guarding home");
    await this.goHome();
    while (this.bot && !this.interrupted && this.queue.current?.kind === "guard") {
      if (this.state === "FLEEING" || this.state === "COMBAT") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      if (distance(this.bot.entity.position, asVec3(this.settings.home.coordinates)) > this.settings.home.arriveDistance + 5) {
        await this.goHome();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async goHome(): Promise<void> {
    if (!this.bot) return;
    const home = this.settings.home.coordinates;
    try {
      this.bot.pathfinder.setGoal(new goals.GoalNear(home.x, home.y, home.z, this.settings.home.arriveDistance));
      await this.bot.pathfinder.goto(new goals.GoalNear(home.x, home.y, home.z, this.settings.home.arriveDistance));
    } catch (cause) {
      error("[Bot]", "could not path home", cause);
    }
  }

  private handleChat(username: string, message: string): void {
    if (!this.settings.access.commandUsernames.includes(username)) return;
    const [command, argument] = message.trim().split(/\s+/);
    if (!command?.startsWith("!")) return;
    if (command === "!mine") {
      const blockName = argument || "*";
      this.queue.enqueue({ kind: "mine", blockName });
      this.say(`Queued mining task: ${blockName}`);
    } else if (command === "!farm") {
      this.queue.enqueue({ kind: "farm" });
      this.say("Queued farming task.");
    } else if (command === "!guard") {
      this.queue.enqueue({ kind: "guard" });
      this.say("Queued guard task.");
    } else if (command === "!stop") {
      this.stopTasks();
      this.say("Stopped and cleared the task queue.");
    } else if (command === "!status") {
      this.say(this.statusMessage());
    }
    void this.runTasks();
  }

  private statusMessage(): string {
    const status = this.status();
    return `State: ${status.state} | Task: ${status.currentTask ? JSON.stringify(status.currentTask) : "none"} | HP: ${status.health ?? "offline"} | Inventory: ${Math.round(Number(status.inventoryFullness) * 100)}%`;
  }

  private say(message: string): void {
    try {
      this.bot?.chat(message);
    } catch (cause) {
      error("[Bot]", "could not send chat response", cause);
    }
  }

  private inventoryFullness(): number {
    if (!this.bot) return 0;
    const slots = this.bot.inventory.slots;
    const occupied = slots.filter((item) => item !== null).length;
    return slots.length === 0 ? 0 : occupied / slots.length;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    log("[Bot]", `reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectDelay = Math.min(
      Math.round(this.reconnectDelay * 1.75),
      this.settings.bot.reconnect.maxDelayMs,
    );
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  async shutdown(): Promise<void> {
    this.clearReconnect();
    this.stopTasks();
    this.detachModules();
    this.bot?.quit("Shutting down");
  }
}