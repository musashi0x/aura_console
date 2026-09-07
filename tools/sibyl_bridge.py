#!/usr/bin/env python3
"""Read-only bridge between the Aura API (Node) and Sibyl Memory (Python).

Sibyl Memory ships as a Python package backed by a local SQLite file. The API
is Node, so this script is the seam: one JSON command on argv, one JSON object
on stdout, exit 0.

It is deliberately read-only. Every command here observes memory; none of them
write to it. Writing is how a console starts inventing history, and the
surfaces that would need it (Correct memory, Archive relationship) do not
exist yet.

Every command reads as the tenant named in `SIBYL_TENANT_ID`, which the API
sets from its own `AGENT_ID`. Sibyl isolates by tenant, so reading as the wrong
one answers "not found" for records that exist.

It never invents a value. If the client is missing, the database is absent, or
a call raises, it says so with a code the API turns into an explicit
unavailable state — the product's distinction between "we could not look" and
"we looked and there is nothing" only survives if this layer keeps it.
"""
from __future__ import annotations

import json
import os
import sys


def fail(code: str, detail: str) -> None:
    json.dump({"ok": False, "code": code, "detail": detail}, sys.stdout)
    sys.stdout.write("\n")
    sys.exit(0)


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "status"

    try:
        from sibyl_memory_client import MemoryClient, NotFoundError
    except ImportError as error:
        fail("client_missing", f"sibyl-memory-client is not importable: {error}")

    # Sibyl isolates by tenant, and reading as the wrong one is the quietest
    # failure available here: the records exist, the recall is clean, and it
    # answers "not found" forever. Nothing is defaulted — a guessed tenant
    # would report an honest-looking empty store for a store nobody asked
    # about. The API sends its own AGENT_ID.
    tenant = os.environ.get("SIBYL_TENANT_ID", "").strip()
    if not tenant:
        fail(
            "tenant_missing",
            "SIBYL_TENANT_ID is unset, so there is no tenant to read as.",
        )

    db_path = os.environ.get("SIBYL_DB_PATH", "~/.sibyl-memory/memory.db")
    expanded = os.path.expanduser(db_path)

    # MemoryClient.local creates the file if it is absent. For a read-only
    # bridge that would turn "no memory here" into "an empty memory", which are
    # different claims, so absence is reported rather than repaired.
    if not os.path.exists(expanded):
        fail("db_absent", f"No Sibyl database at {expanded}")

    try:
        client = MemoryClient.local(expanded, tenant_id=tenant)
    except Exception as error:  # noqa: BLE001 - reported, never swallowed
        fail("client_error", f"{type(error).__name__}: {error}")

    try:
        if command == "status":
            status = client.free_tier_status()
            payload = {
                "ok": True,
                "dbPath": expanded,
                "tier": client.get_tier(),
                "schemaVersion": client.schema_version(),
                "dbSizeBytes": status.get("db_size_bytes"),
                "softCapBytes": status.get("soft_cap_bytes"),
                "atOrAboveCap": status.get("at_or_above_cap"),
                "entityCount": len(client.list_entities()),
            }
        elif command == "retrieve":
            # One counterparty's relationship profile.
            #
            # `found: false` is NOT an error and must not be reported as one:
            # "this counterparty is new to us" is a real answer. Every failure
            # path above exits through fail(), so reaching here at all means
            # Sibyl was read successfully.
            category = sys.argv[2] if len(sys.argv) > 2 else "counterparty"
            name = sys.argv[3] if len(sys.argv) > 3 else ""
            if not name:
                fail("missing_name", "retrieve needs a counterparty key")
            # get_entity RAISES for an unknown entity rather than returning
            # None. Letting that reach the generic handler reported a
            # counterparty we have never met as a failed lookup, which is the
            # one conflation this product may never make.
            try:
                entity = client.get_entity(category, name)
            except NotFoundError:
                entity = None
            payload = {
                "ok": True,
                "found": entity is not None,
                "body": (entity or {}).get("body"),
                "updatedAt": (entity or {}).get("updated_at"),
            }
        elif command == "entities":
            category = sys.argv[2] if len(sys.argv) > 2 else None
            entities = client.list_entities(category) if category else client.list_entities()
            payload = {"ok": True, "entities": entities}
        else:
            fail("unknown_command", f"{command} is not a bridge command")
    except Exception as error:  # noqa: BLE001
        fail("call_failed", f"{type(error).__name__}: {error}")

    json.dump(payload, sys.stdout, default=str)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
