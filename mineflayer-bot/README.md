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