#!/usr/bin/env bash
set -e

PYTHON_BIN="${SIBYL_PYTHON:-.venv-sibyl/bin/python}"
if [ -x "$PYTHON_BIN" ] || [ -f "$PYTHON_BIN" ]; then
  echo "--> Seeding Sibyl memory baseline..."
  SIBYL_TENANT_ID=agent_buyer_1 "$PYTHON_BIN" tools/sibyl_seed.py "$@"
else
  echo "Skipping seed: Python bridge ($PYTHON_BIN) not found."
fi
