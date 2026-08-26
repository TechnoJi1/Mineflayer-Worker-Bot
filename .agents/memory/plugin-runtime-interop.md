---
name: Mineflayer plugin runtime interop
description: Mineflayer ecosystem packages may expose CommonJS objects even when TypeScript declarations show named exports.
---

When running Mineflayer plugins under Node's native ESM loader, prefer importing the package namespace through a local compatibility module and reading its exported plugin object, rather than relying on runtime named exports. This is especially relevant for older CommonJS packages such as mineflayer-pathfinder.

**Why:** Node 24 rejected a declared named export from a CommonJS plugin at runtime even though TypeScript accepted the import.

**How to apply:** If a Mineflayer plugin fails with “does not provide an export named”, inspect its package entry point and normalize the import boundary before changing application logic.