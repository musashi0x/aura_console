#!/usr/bin/env bash
set -e

echo ""
echo "==========================================================="
echo "   AURA MEMORY — DEMO ENVIRONMENT RESET"
echo "==========================================================="

pnpm --filter @aura/api exec tsx ../../scripts/wipe-event-store.ts
pnpm --filter @aura/db db:migrate

if [ -f ".venv-sibyl/bin/python" ]; then
  echo "--> Re-seeding clean baseline into Sibyl memory..."
  SIBYL_TENANT_ID=agent_buyer_1 .venv-sibyl/bin/python tools/sibyl_seed.py --reset 2>/dev/null || true
fi

echo "✓ Postgres schema and memory baseline reset. Ready for Demo recording."
echo "==========================================================="
