# Mineflayer Worker Bot

An autonomous Minecraft worker bot with survival protection, combat, bounded mining, inventory deposits, farming, a task queue, and trusted chat commands.

## Quick start

1. Copy `settings.example.json` to `settings.json`.
2. Set `server.host`, `server.port`, `server.auth`, `bot.username`, and `access.commandUsernames`.
3. Configure the home chest and bounded mining/farming regions.
4. Start the bot:

```bash
pnpm --filter @workspace/mineflayer-bot run dev
```

## Railway deployment

This repository is a pnpm workspace. Do not use `npm install` or `npm start`.

There are two supported Railway setups:

### Recommended: set the Railway root directory to `mineflayer-bot`

- Root directory: `mineflayer-bot`
- Install command: `pnpm install --ignore-workspace`
- Start command: `pnpm start`
- Node version: 24 or newer

The package includes its own `packageManager` declaration, so Railway can select pnpm even though the bot is nested in the larger repository.

Because `settings.json` is intentionally git-ignored, set the Railway variable `MINECRAFT_SETTINGS_JSON` to the complete JSON configuration instead of committing account credentials. The value should have the same shape as `settings.example.json`.

### Workspace-root setup

If Railway uses the repository root, the included root `railway.json` installs the workspace lockfile and starts:

```bash
pnpm --filter @workspace/mineflayer-bot start
```

The bot package remains the only long-running service needed for Railway. The `artifacts/`, `lib/`, and `scripts/` directories are development scaffold content; they are not used by the bot start command.

The bot also exposes:

- `GET /healthz` — returns HTTP 200 only while connected to Minecraft.
- `GET /status` — returns the current state, task, health, food, position, and inventory fullness.

Set `PORT` to override the configured health port.

## Chat commands

Only names in `access.commandUsernames` can control the bot:

- `!mine <block_name>` — queue a bounded mining task. `!mine` uses all configured target blocks.
- `!farm` — queue a bounded mature-crop harvest and replant pass.
- `!guard` — stay near home while combat protection runs.
- `!stop` — clear the queue and stop the active worker.
- `!status` — report state, current task, health, and inventory fullness.

## Safety boundaries

- Mining and farming never search outside their configured regions.
- Pathfinding avoids lava and fire blocks.
- Low health interrupts work and sends the bot home.
- Inventory deposit preserves the configured keep list.
- Disconnects clean up timers/listeners and reconnect with backoff.
- `settings.json` is ignored by git so server/account configuration stays local.

The modules are intentionally independent. Disable any module in `settings.json` without changing code.