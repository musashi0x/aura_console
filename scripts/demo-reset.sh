#!/usr/bin/env bash
set -e

echo ""
echo "==========================================================="
echo "   AURA MEMORY — DEMO ENVIRONMENT RESET"
echo "==========================================================="

pnpm --filter @aura/api exec tsx ../../scripts/wipe-event-store.ts
pnpm --filter @aura/db db:migrate

PYTHON_BIN="${SIBYL_PYTHON:-.venv-sibyl/bin/python}"
if [ -x "$PYTHON_BIN" ] || [ -f "$PYTHON_BIN" ]; then
  echo "--> Re-seeding clean baseline into Sibyl memory..."
  SIBYL_TENANT_ID=agent_buyer_1 "$PYTHON_BIN" tools/sibyl_seed.py --reset 2>/dev/null || true
fi

echo "✓ Postgres schema and memory baseline reset. Ready for Demo recording."
echo "==========================================================="
