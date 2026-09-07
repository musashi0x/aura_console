#!/usr/bin/env bash
set -e

echo ""
echo "==========================================================="
echo "   AURA MEMORY — DEMO ENVIRONMENT RESET"
echo "==========================================================="

pnpm --filter @aura/db db:migrate

echo "✓ Postgres schema reset and ready for Demo recording."
echo "==========================================================="
