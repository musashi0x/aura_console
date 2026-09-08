#!/usr/bin/env python3
"""Seed the Alpha/Beta relationship fixture into a real Sibyl Memory database.

This is the WRITE side, and it is deliberately a separate script from
`tools/sibyl_bridge.py`. The bridge the API talks to is read-only, and it stays
that way: a console that can write memory is a console that can invent history.
Seeding is an operator action run by hand, never something a request can reach.

Why a fixture exists at all. Tracker #36 needs one stable relationship story:
Session A learns Alpha failed, and Session B — a fresh process — therefore picks
Beta. Without records to recall, retrieval honestly answers NO_HISTORY forever
and the counterfactual has nothing to compare against.

What keeps this honest. The records written here are REAL records in a REAL
database, recalled through the same read path as any other memory. Nothing is
mocked and no surface is told to pretend. Every body carries
`"source": "fixture"` so a surface can badge it exactly like the FIXTURE origin
already badges the example Run. A fixture that is labelled is a demo; the same
fixture unlabelled would be the one lie this product cannot afford.

What the names have to be. Retrieval maps a `counterparty_key` verbatim to the
Sibyl entity name and recalls it under one category, so the fixture is only
reachable if its names ARE keys. They were `alpha_research` and `beta_labs`
until a recall of the canonical `virtuals:agent:alpha` came back `no_match` —
which retrieval correctly reads as "we looked and there is nothing", so the
fixture existed and could never be found. Keeping a display label is what
`display_name` in the body is for.

Tenant. Sibyl isolates by tenant, so the fixture must be written under the same
one the API reads as — its `AGENT_ID`. A mismatch is the quietest failure here:
the records exist, the recall is clean, and it answers `no_match` forever. So
the tenant is named rather than defaulted, and printed with everything else.

Usage:
    SIBYL_TENANT_ID=agent_buyer_1 \
      .venv-sibyl/bin/python tools/sibyl_seed.py [--db PATH] [--reset]
"""
from __future__ import annotations

import argparse
import os
import sys

CATEGORY = "counterparty"

# One failed delivery on Alpha is the whole point: it is the single recorded
# fact that moves the ranking, and therefore the thing the counterfactual
# removes to show Beta winning only because memory was consulted.
FIXTURE: list[tuple[str, dict]] = [
    (
        "virtuals:agent:alpha",
        {
            "source": "fixture",
            "display_name": "Alpha Research",
            "relationship_status": "WATCH",
            "overall_reliability": 0.42,
            "task_fit": 0.71,
            "confidence": 0.88,
            "observed_price_usdc": "9.00",
            "episodes": [
                {
                    "run": "98",
                    "task_type": "market-research",
                    "outcome": "rejected",
                    "note": "Delivered 41 hours late and the deliverable failed acceptance.",
                    "occurred_at": "2026-08-14T09:12:00Z",
                },
                {
                    "run": "104",
                    "task_type": "market-research",
                    "outcome": "accepted",
                    "note": "Delivered on time at the quoted price.",
                    "occurred_at": "2026-07-30T15:40:00Z",
                },
            ],
            "risk_note": "One acceptance failure inside the last 30 days applies a risk penalty.",
        },
    ),
    (
        "virtuals:agent:beta",
        {
            "source": "fixture",
            "display_name": "Beta Labs",
            "relationship_status": "PREFERRED",
            "overall_reliability": 0.91,
            "task_fit": 0.83,
            "confidence": 0.90,
            "observed_price_usdc": "12.00",
            "episodes": [
                {
                    "run": "116",
                    "task_type": "market-research",
                    "outcome": "accepted",
                    "note": "Delivered early; deliverable accepted without revision.",
                    "occurred_at": "2026-08-22T11:05:00Z",
                },
                {
                    "run": "121",
                    "task_type": "market-research",
                    "outcome": "accepted",
                    "note": "Delivered on time at the quoted price.",
                    "occurred_at": "2026-08-29T08:31:00Z",
                },
            ],
            "risk_note": "No acceptance failures on record.",
        },
    ),
]


SESSION_A_FIXTURE: list[tuple[str, dict]] = [
    (
        "virtuals:agent:alpha",
        {
            "source": "fixture",
            "display_name": "Alpha Research",
            "relationship_status": "NEW",
            "overall_reliability": 0.50,
            "task_fit": 0.50,
            "confidence": 0.0,
            "observed_price_usdc": "9.00",
            "episodes": [],
            "risk_note": "No previous interactions on record.",
        },
    ),
    (
        "virtuals:agent:beta",
        {
            "source": "fixture",
            "display_name": "Beta Labs",
            "relationship_status": "NEW",
            "overall_reliability": 0.50,
            "task_fit": 0.50,
            "confidence": 0.0,
            "observed_price_usdc": "9.50",
            "episodes": [],
            "risk_note": "No previous interactions on record.",
        },
    ),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        default=os.environ.get("SIBYL_DB_PATH", "~/.sibyl-memory/memory.db"),
        help="Sibyl database path (default: SIBYL_DB_PATH or Sibyl's own default)",
    )
    parser.add_argument(
        "--tenant",
        default=os.environ.get("SIBYL_TENANT_ID") or os.environ.get("AGENT_ID"),
        help="Sibyl tenant to write as; must match the API's AGENT_ID (default: SIBYL_TENANT_ID or AGENT_ID)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Archive the fixture counterparties before writing them again",
    )
    parser.add_argument(
        "--session-a",
        action="store_true",
        help="Seed clean baseline for Session A where both counterparties are unobserved (Alpha wins on price)",
    )
    args = parser.parse_args()

    # Guessing a tenant here writes a fixture the API will never read, and the
    # failure looks like an honest empty store rather than a mistake.
    if not args.tenant:
        print(
            "No tenant given. Pass --tenant, or set SIBYL_TENANT_ID or AGENT_ID, "
            "to the same value as AGENT_ID in .env.",
            file=sys.stderr,
        )
        return 1

    try:
        from sibyl_memory_client import MemoryClient
    except ImportError as error:
        print(f"sibyl-memory-client is not importable: {error}", file=sys.stderr)
        print("Install it first:  .venv-sibyl/bin/pip install sibyl-memory-client", file=sys.stderr)
        return 1

    path = os.path.expanduser(args.db)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    # Unlike the bridge, this script MAY create the database: seeding a store
    # that does not exist yet is the whole job, and there is no reader here to
    # mislead about whether memory was found.
    client = MemoryClient.local(path, tenant_id=args.tenant)

    fixture = SESSION_A_FIXTURE if args.session_a else FIXTURE
    for name, body in fixture:
        if args.reset:
            try:
                client.archive_entity(CATEGORY, name, reason="reseeding fixture")
            except Exception:  # noqa: BLE001 - absence is the normal first-run case
                pass
        client.set_entity(CATEGORY, name, body)
        episodes = len(body.get("episodes", []))
        print(f"seeded {CATEGORY}/{name}  status={body['relationship_status']}  episodes={episodes}")

    total = len(client.list_entities(CATEGORY))
    status = client.free_tier_status()
    print(f"\ndb          {path}")
    print(f"tenant      {args.tenant}")
    print(f"tier        {client.get_tier()}  schema v{client.schema_version()}")
    print(f"entities    {total} in category '{CATEGORY}'")
    print(f"size        {status.get('db_size_bytes')} of {status.get('soft_cap_bytes')} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
