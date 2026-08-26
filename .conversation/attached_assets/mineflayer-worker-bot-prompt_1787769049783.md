# Prompt for Replit AI — Mineflayer Autonomous Worker Bot

Copy everything below into Replit AI (or any AI coding assistant) as your starting prompt.

---

## Project Context

I have an existing Mineflayer (Node.js) Minecraft bot built on:
- `mineflayer`
- `mineflayer-pathfinder`
- Express server (health check + self-ping, for free-tier hosting)
- A `settings.json` config file for server IP, bot account, and behavior toggles

Currently it only does passive AFK behavior (idle movement, anti-kick). I want to extend it into a **task-driven worker bot** that can mine, fight, farm, and manage inventory autonomously while I'm offline.

## Goal

Build a **state-machine + task-queue based bot** with these modules, in this priority order:

### 1. Survival module (build first)
- Integrate `mineflayer-auto-eat` — auto-eats when hunger drops below a configurable threshold.
- Integrate `mineflayer-armor-manager` — auto-equips best available armor from inventory.
- Health monitor: if HP drops below a configurable % (default 30%), interrupt whatever the bot is doing and switch to a `FLEEING` state (run away from nearest hostile, or path back to `home` coordinates).

### 2. Combat module
- Integrate `mineflayer-pvp`.
- Auto-detect hostile mobs within a configurable radius and engage.
- Must respect the health monitor — break off combat and flee if HP drops too low mid-fight.
- Configurable: can be toggled on/off, and radius/aggro-range should be adjustable in settings.

### 3. Mining module
- Given a target block type (e.g. `iron_ore`, `coal_ore`, `diamond_ore`) and a **bounded 3D region** (min/max x,y,z coordinates — I will define this manually, the bot should NOT wander outside it), the bot should:
  - Use `bot.findBlock()` to locate the nearest matching block within the bounded region.
  - Path to it using `mineflayer-pathfinder`.
  - Mine it with `bot.dig()`.
  - Avoid pathing into lava/void — check for hazards before digging/moving.
  - Repeat until inventory is ~80% full or the region is exhausted.

### 4. Inventory management module
- When inventory hits a configurable fullness threshold, interrupt current task.
- Path back to a configured "home" chest location.
- Open the chest (`bot.openChest()`) and deposit all items except a configurable "keep" list (e.g. always keep 1 pickaxe, 1 sword, food).
- Return to previous task afterward.

### 5. Task queue + chat command system
- Maintain an in-memory queue of tasks, e.g.: `["mine:iron_ore", "farm:wheat", "guard:home"]`.
- Listen on `bot.on('chat', ...)` for commands from a whitelisted username (mine — specify in settings), such as:
  - `!mine <block_type>` — enqueue a mining task
  - `!farm` — enqueue farming task
  - `!guard` — stay near home and fight anything hostile
  - `!stop` — clear queue, return to idle
  - `!status` — bot replies in chat with current task, HP, inventory fullness
- The state machine should always allow combat/flee to interrupt any current task, but not the reverse.

### 6. Farming module (build last — most fragile)
- Within a bounded region, scan for mature crops (check block metadata/age state).
- Harvest mature crops with `bot.dig()`.
- Replant from inventory seeds immediately after harvesting the same spot.
- Skip if out of seed inventory rather than erroring out.

## Technical requirements

- All new modules must be **toggleable independently** via `settings.json` (e.g. `modules.mining.enabled`, `modules.combat.enabled`), so I can turn features on/off without touching code.
- All bounded regions (mining area, farm area, home coordinates) should be configurable via `settings.json`, not hardcoded.
- Add try/catch and reconnection-safe cleanup around every module — if the bot disconnects mid-task, it should resume gracefully after reconnecting rather than crashing or double-running loops.
- Keep the existing Express health-check + self-ping server intact — I use it for hosting keep-alive.
- Log every task transition to console with a `[TaskQueue]` or `[Module]` prefix consistent with my existing logging style (e.g. `[Bot]`, `[Cleanup]`).
- Add a `death` handler: on death, the bot should respawn and path back to `home` coordinates rather than sitting wherever it died.
- Be mindful of CPU/memory — this will run on a free-tier host (Railway/Render), so avoid unnecessary tight-interval loops; use event-driven logic where possible over polling.

## What NOT to do

- Don't try to build all 6 modules in one giant file dump — build and confirm module 1 (survival) works, then move to module 2, etc.
- Don't add "intelligent" pathfinding/exploration beyond the bounded regions I configure — I'll define mining/farming areas manually.
- Don't hardcode my server IP, username, or any credentials — read everything from `settings.json`.

## Deliverable format

For each module, give me:
1. The new/modified code as a clear diff or full file.
2. Any new npm packages I need to install.
3. Any new fields to add to `settings.json`, with example values.
4. A short note on how to test that specific module in-game before moving to the next.

Start with **Module 1 (Survival)** only. Wait for me to confirm it works before continuing to Module 2.
