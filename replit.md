# Mineflayer Worker Bot

An autonomous Minecraft bot that performs bounded worker tasks while protecting itself and responding to trusted chat commands.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/mineflayer-bot run dev` — run the Minecraft worker bot (copy and configure `mineflayer-bot/settings.example.json` first)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `mineflayer-bot/settings.example.json` — source-of-truth configuration template for server, home, bounded regions, thresholds, and module toggles
- `mineflayer-bot/src/controller.ts` — connection lifecycle, state machine, task queue execution, chat commands, and reconnect behavior
- `mineflayer-bot/src/` — independent survival, combat, mining, inventory, and farming modules

## Architecture decisions

- The bot is a separate workspace package because it is a long-running Minecraft process, not a web artifact.
- The task queue retains the active task when combat or fleeing interrupts it, allowing work to resume after the safety event.
- Mining and farming receive explicit bounded regions from settings and do not perform exploration outside those bounds.
- The health server runs in the same process so hosting keep-alive behavior and bot status share one lifecycle.

## Product

The worker bot can survive unattended, defend itself, mine configured ores, harvest and replant configured crops, deposit excess inventory at a home chest, and accept commands from a whitelist.

## User preferences

The bot should be built in modules, with configurable server/account details and no hardcoded credentials.

## Gotchas

- `mineflayer-bot/settings.json` is required at runtime and is intentionally not committed.
- The Minecraft server must permit the selected auth mode; use `microsoft` for online-mode accounts and `offline` only for servers configured for offline authentication.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
