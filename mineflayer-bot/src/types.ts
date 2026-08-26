import type { Bot } from "mineflayer";
import type { BotSettings, Position, Region } from "./config.js";
import type { TaskQueue } from "./task-queue.js";

export type BotState =
  | "DISCONNECTED"
  | "IDLE"
  | "WORKING"
  | "COMBAT"
  | "FLEEING"
  | "RETURNING_HOME"
  | "DEPOSITING"
  | "DEAD";

export type BotLike = Bot & {
  autoEat?: {
    options?: Record<string, unknown>;
    disable?: () => void;
    enable?: () => void;
  };
  armorManager?: { equipAll?: () => Promise<void> };
  pvp?: { attack: (entity: unknown) => void; stop: () => void };
  health?: number;
  food?: number;
  foodSaturation?: number;
};

export type RuntimeContext = {
  bot: BotLike;
  settings: BotSettings;
  queue: TaskQueue;
  getState: () => BotState;
  setState: (state: BotState, reason: string) => void;
  isInterrupted: () => boolean;
  goHome: () => Promise<void>;
  positionInRegion: (position: Position, region: Region) => boolean;
  inventoryFullness: () => number;
  ensureInventory: () => Promise<boolean>;
};