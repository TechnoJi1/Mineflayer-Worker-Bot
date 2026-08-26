import { Vec3 } from "vec3";
import type { BotLike } from "./types.js";
import type { Position, Region } from "./config.js";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function asVec3(position: Position): Vec3 {
  return new Vec3(position.x, position.y, position.z);
}

export function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export function inside(position: Position, region: Region): boolean {
  return (
    position.x >= Math.min(region.min.x, region.max.x) &&
    position.x <= Math.max(region.min.x, region.max.x) &&
    position.y >= Math.min(region.min.y, region.max.y) &&
    position.y <= Math.max(region.min.y, region.max.y) &&
    position.z >= Math.min(region.min.z, region.max.z) &&
    position.z <= Math.max(region.min.z, region.max.z)
  );
}

export function itemCount(bot: BotLike, names: string[]): number {
  return bot.inventory.items().reduce(
    (total, item) => (names.includes(item.name) ? total + item.count : total),
    0,
  );
}

export function isHazardBlock(block: { name?: string } | null): boolean {
  return Boolean(block && ["lava", "flowing_lava", "fire", "soul_fire", "cactus"].includes(block.name ?? ""));
}

export function nearbyHazard(bot: BotLike, position: Position): boolean {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (isHazardBlock(bot.blockAt(new Vec3(position.x + dx, position.y + dy, position.z + dz)))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function voidRisk(bot: BotLike, position: Position): boolean {
  const minY = Number((bot.game as { minY?: number } | undefined)?.minY ?? -64);
  if (position.y <= minY + 2) return true;
  const below = bot.blockAt(new Vec3(position.x, position.y - 1, position.z));
  return !below || below.name === "air" || below.name === "cave_air" || below.name === "void_air";
}

export function isMatureCrop(
  block: { name?: string; metadata?: number } | null,
  crop: { matureAge: number },
): boolean {
  return Boolean(block && block.name && Number(block.metadata ?? 0) >= crop.matureAge);
}