#!/usr/bin/env bash
set -e

echo ""
echo "==========================================================="
echo "   AURA MEMORY — DEMO RESTART PROTOCOL (CAMERA ONE-TAKE)"
echo "==========================================================="
echo "  Wiping Postgres event store while preserving Sibyl memory.db"
echo "-----------------------------------------------------------"

pnpm --filter @aura/api exec tsx ../../scripts/wipe-event-store.ts
pnpm --filter @aura/db db:migrate

echo "✓ Event store wiped clean."
echo "✓ Persistent Sibyl memory database preserved at ~/.sibyl-memory/memory.db"
echo ""
echo "Session B is ready to launch on camera."
echo "==========================================================="
