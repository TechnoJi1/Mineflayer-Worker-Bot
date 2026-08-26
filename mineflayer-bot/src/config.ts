import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Position = { x: number; y: number; z: number };
export type Region = { min: Position; max: Position };
export type KeepItem = { name: string; count: number };

export type BotSettings = {
  server: {
    host: string;
    port: number;
    version: string | false;
    auth: "offline" | "mojang" | "microsoft";
  };
  bot: {
    username: string;
    password?: string;
    reconnect: { enabled: boolean; delayMs: number; maxDelayMs: number };
  };
  health: {
    port: number;
    selfPing: { enabled: boolean; url: string; intervalMs: number };
  };
  access: { commandUsernames: string[] };
  home: {
    coordinates: Position;
    chest: Position;
    fleeDistance: number;
    arriveDistance: number;
  };
  modules: {
    survival: {
      enabled: boolean;
      eatBelowFood: number;
      fleeBelowHealthPercent: number;
      resumeAboveHealthPercent: number;
      fleeSafeDistance: number;
      equipArmorOnSpawn: boolean;
    };
    combat: {
      enabled: boolean;
      radius: number;
      scanIntervalMs: number;
      hostileNames: string[];
    };
    mining: {
      enabled: boolean;
      targetBlocks: string[];
      region: Region;
      maxDistance: number;
      fullnessThreshold: number;
      pauseMs: number;
    };
    inventory: {
      enabled: boolean;
      fullnessThreshold: number;
      keepItems: KeepItem[];
    };
    farming: {
      enabled: boolean;
      region: Region;
      crops: Record<string, { matureAge: number; seeds: string[] }>;
      pauseMs: number;
    };
  };
};

const defaultSettings: BotSettings = {
  server: { host: "", port: 25565, version: false, auth: "offline" },
  bot: {
    username: "",
    password: "",
    reconnect: { enabled: true, delayMs: 10000, maxDelayMs: 120000 },
  },
  health: {
    port: 3000,
    selfPing: { enabled: false, url: "", intervalMs: 240000 },
  },
  access: { commandUsernames: [] },
  home: {
    coordinates: { x: 0, y: 64, z: 0 },
    chest: { x: 1, y: 64, z: 0 },
    fleeDistance: 16,
    arriveDistance: 3,
  },
  modules: {
    survival: {
      enabled: true,
      eatBelowFood: 14,
      fleeBelowHealthPercent: 30,
      resumeAboveHealthPercent: 60,
      fleeSafeDistance: 16,
      equipArmorOnSpawn: true,
    },
    combat: {
      enabled: true,
      radius: 12,
      scanIntervalMs: 1500,
      hostileNames: [],
    },
    mining: {
      enabled: false,
      targetBlocks: [],
      region: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
      maxDistance: 32,
      fullnessThreshold: 0.8,
      pauseMs: 250,
    },
    inventory: { enabled: false, fullnessThreshold: 0.8, keepItems: [] },
    farming: {
      enabled: false,
      region: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
      crops: {},
      pauseMs: 250,
    },
  },
};

function merge<T>(base: T, override: Partial<T>): T {
  if (!override || typeof override !== "object") return base;
  const output = { ...(base as object) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override as object)) {
    const current = output[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      output[key] = merge(current, value as object);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}

function validate(settings: BotSettings): void {
  if (!settings.server.host.trim()) {
    throw new Error("server.host is required in mineflayer-bot/settings.json");
  }
  if (!settings.bot.username.trim()) {
    throw new Error("bot.username is required in mineflayer-bot/settings.json");
  }
  if (settings.access.commandUsernames.length === 0) {
    throw new Error(
      "access.commandUsernames must contain at least one trusted Minecraft username",
    );
  }
  if (settings.modules.mining.enabled && settings.modules.mining.targetBlocks.length === 0) {
    throw new Error("modules.mining.targetBlocks cannot be empty when mining is enabled");
  }
  if (settings.modules.farming.enabled && Object.keys(settings.modules.farming.crops).length === 0) {
    throw new Error("modules.farming.crops cannot be empty when farming is enabled");
  }
}

export function loadSettings(): BotSettings {
  const path = resolve(process.cwd(), "settings.json");
  let parsed: Partial<BotSettings>;
  if (existsSync(path)) {
    parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<BotSettings>;
  } else if (process.env.MINECRAFT_SETTINGS_JSON) {
    parsed = JSON.parse(process.env.MINECRAFT_SETTINGS_JSON) as Partial<BotSettings>;
  } else {
    throw new Error(
      "Missing mineflayer-bot/settings.json. Copy settings.example.json to settings.json, or set MINECRAFT_SETTINGS_JSON for Railway.",
    );
  }
  const settings = merge(defaultSettings, parsed);
  validate(settings);
  return settings;
}