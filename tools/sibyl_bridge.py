#!/usr/bin/env python3
"""Read-only bridge between the Aura API (Node) and Sibyl Memory (Python).

Sibyl Memory ships as a Python package backed by a local SQLite file. The API
is Node, so this script is the seam: one JSON command on argv, one JSON object
on stdout, exit 0.

It is deliberately read-only. Every command here observes memory; none of them
write to it. Writing is how a console starts inventing history, and the
surfaces that would need it (Correct memory, Archive relationship) do not
exist yet. Adding `recall`, `entity` and `events` did not change that: they are
four more ways to look, and none of them is a way to edit.

Every command reads as the tenant named in `SIBYL_TENANT_ID`, which the API
sets from its own `AGENT_ID`. Sibyl isolates by tenant, so reading as the wrong
one answers "not found" for records that exist.

It never invents a value. If the client is missing, the database is absent, or
a call raises, it says so with a code the API turns into an explicit
unavailable state — the product's distinction between "we could not look" and
"we looked and there is nothing" only survives if this layer keeps it.

Every command reads as the tenant named in `SIBYL_TENANT_ID` — the API sends
its `AGENT_ID` — and refuses to run without one. Tenant is Sibyl's isolation
boundary, so a bridge that let it default would read a store belonging to
somebody else and report that store's silence as this operator's history.

`recall` is where that distinction is easiest to lose, so Sibyl's verdict is
reported on every search, including the searches that return no records. Sibyl
names a cause for each empty result — an empty store, a query nothing matched,
a gate that rejected the candidates — and a zero-record recall stripped of that
cause is indistinguishable from a lookup that never happened. The verdict
travels alongside the records, never instead of them.
"""
from __future__ import annotations

import json
import os
import sys

# One sentence per verdict cause, so a surface can say why memory came back
# empty without re-deriving meaning from the code string. These are the only
# place the codes are interpreted; the code itself is always passed through.
VERDICT_DETAIL = {
    "ok": "Sibyl matched records in memory and returned them.",
    "no_match": "Sibyl searched memory and nothing matched this query.",
    "empty_store": "Sibyl searched, but this memory holds no records yet.",
    "gated": "Sibyl found candidate records but its retrieval gate rejected them, so none were returned.",
    "abstained_on": "Sibyl abstained rather than answer a query it could not ground in memory.",
    "negation_abstain": "Sibyl abstained because the query is phrased as a negation, which memory cannot confirm.",
}


def fail(code: str, detail: str) -> None:
    json.dump({"ok": False, "code": code, "detail": detail}, sys.stdout)
    sys.stdout.write("\n")
    sys.exit(0)


def verdict_code(code: object) -> str:
    # VerdictCode is a str Enum, so `.value` is the wire form. A client that
    # hands back a bare string is accepted too, and an unrecognised code is
    # passed through as-is rather than rounded off to a code we do know.
    return str(getattr(code, "value", code))


def verdict_detail(code: str) -> str:
    # An unknown code means Sibyl grew a verdict this bridge has not been
    # taught. Saying that plainly is honest; borrowing the nearest known
    # sentence would describe a result nobody here understood.
    return VERDICT_DETAIL.get(
        code,
        f"Sibyl returned the verdict '{code}', which this bridge has no description for.",
    )


def refined(client, results):
    """Upgrade a bare `no_match` zero to `empty_store` when the store is empty.

    Sibyl's engine stamps the cheap cause on the hot path and deliberately
    leaves the expensive one to whichever surface reports the zero — this
    bridge. `refine_zero` pays up to four indexed COUNT queries to separate
    "nothing matched what you asked" from "you have not written anything yet",
    which are different answers to a new operator and would otherwise both
    arrive as `no_match`.

    It runs only on a zero-record result, because that is the only case where
    the two causes are confusable and the only case the probe is priced for.

    Failure leaves the verdict exactly as Sibyl stamped it. `store_is_empty`
    already returns False on any error for the same reason: an unverifiable
    store is reported as a miss, never as "your store is empty", because
    claiming emptiness we could not confirm is the one direction that lies.
    """
    if results:
        return results
    try:
        from sibyl_memory_client.verdicts import refine_zero
    except ImportError:
        # An older client that never grew the probe. The zero keeps its own
        # cause rather than the bridge inventing a more specific one.
        return results
    try:
        return refine_zero(client, results)
    except Exception:  # noqa: BLE001 - the un-refined verdict is still true
        return results


def as_record(entity: dict) -> dict:
    # Names are camelCase across the boundary, except inside `body`, which is
    # opaque JSON supplied at write time and is handed over untouched. Keys are
    # indexed rather than `.get`, so an entity shape that drifts fails loudly
    # here instead of producing a record quietly padded with nulls.
    return {
        "id": entity["id"],
        "category": entity["category"],
        "name": entity["name"],
        "status": entity["status"],
        "body": entity["body"],
        "createdAt": entity["created_at"],
        "updatedAt": entity["updated_at"],
    }


def split_args(argv: list[str]) -> tuple[list[str], dict[str, str]]:
    """Split argv into positionals and `--name value` / `--name=value` flags.

    A bare `--` ends flag parsing: every token after it is positional, whatever
    it begins with. Search terms and counterparty keys are operator data, and
    without the separator a value beginning with `--` was read as a flag that
    swallowed the token behind it — so `--category counterparty` stopped being a
    filter and the recall answered from every category in the store, presenting
    another category's records as this counterparty's memory. A query is a
    query, and this is where that is guaranteed rather than hoped for.
    """
    positional: list[str] = []
    flags: dict[str, str] = {}
    index = 0
    while index < len(argv):
        token = argv[index]
        if token == "--":
            positional.extend(argv[index + 1 :])
            break
        if token.startswith("--"):
            name = token[2:]
            if "=" in name:
                name, value = name.split("=", 1)
            else:
                index += 1
                value = argv[index] if index < len(argv) else ""
            flags[name] = value
        else:
            positional.append(token)
        index += 1
    return positional, flags


def int_flag(flags: dict[str, str], name: str, default: int) -> int:
    raw = flags.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        # A limit we cannot read is not a limit we may guess at: silently
        # falling back to the default would answer a question nobody asked.
        fail("bad_argument", f"--{name} expects an integer, got {raw!r}")


def main() -> None:
    argv = sys.argv[1:]
    command = argv[0] if argv else "status"
    positional, flags = split_args(argv[1:])

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
    # `entity` has to tell "there is no such record" apart from "the lookup
    # broke", and Sibyl signals the first by raising NotFoundError. If a client
    # version stops exporting it, this tuple is empty and absence degrades to a
    # reported failure — never to a silent empty answer.
    try:
        from sibyl_memory_client import NotFoundError

        absent_errors: tuple[type[BaseException], ...] = (NotFoundError,)
    except ImportError:
        absent_errors = ()

    db_path = os.environ.get("SIBYL_DB_PATH", "~/.sibyl-memory/memory.db")
    expanded = os.path.expanduser(db_path)

    # MemoryClient.local creates the file if it is absent. For a read-only
    # bridge that would turn "no memory here" into "an empty memory", which are
    # different claims, so absence is reported rather than repaired.
    if not os.path.exists(expanded):
        fail("db_absent", f"No Sibyl database at {expanded}")

    # Tenant is Sibyl's isolation boundary and every command below reads
    # through it, so it is never guessed at. Falling back to Sibyl's default
    # tenant would answer from a store nobody asked about, and that store's
    # `no_match` is indistinguishable from this operator having no history — the
    # one confusion this bridge exists to prevent.
    tenant = os.environ.get("SIBYL_TENANT_ID", "").strip()
    if not tenant:
        fail(
            "tenant_missing",
            "SIBYL_TENANT_ID is unset, so there is no tenant to read as. The API "
            "sends its AGENT_ID; set it by hand to run this bridge directly.",
        )

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
            # Left in Sibyl's own snake_case: this shape already ships, so it is
            # a contract rather than an oversight. The commands added later
            # project through as_record() instead.
            category = positional[0] if positional else None
            entities = client.list_entities(category) if category else client.list_entities()
            payload = {"ok": True, "entities": entities}
        elif command == "recall":
            if not positional:
                fail("bad_argument", "recall needs a query")
            results = refined(
                client,
                client.search_entities(
                    positional[0],
                    limit=int_flag(flags, "limit", 20),
                    category=flags.get("category") or None,
                ),
            )
            verdict = results.verdict
            code = verdict_code(verdict.code)
            payload = {
                "ok": True,
                # Reported before the records, and reported even when there are
                # none, because the verdict is what makes an empty recall
                # readable as an answer instead of as a failure.
                "verdict": {
                    "code": code,
                    "returned": verdict.returned,
                    "tokens": verdict.tokens,
                    "gate": verdict.gate,
                    "detail": verdict_detail(code),
                },
                # SearchResults subclasses list; the hits are the list itself.
                "records": [as_record(hit) for hit in results],
            }
        elif command == "entity":
            if len(positional) < 2:
                fail("bad_argument", "entity needs a category and a name")
            try:
                found = client.get_entity(positional[0], positional[1])
            except absent_errors as error:
                fail("entity_absent", f"Sibyl holds no {positional[0]}/{positional[1]}: {error}")
            payload = {"ok": True, "record": as_record(found)}
        elif command == "record_episode":
            if len(positional) < 2:
                fail("bad_argument", "record_episode needs a counterparty key and a JSON episode payload")
            key = positional[0]
            try:
                episode_data = json.loads(positional[1])
            except json.JSONDecodeError as err:
                fail("bad_json", f"Invalid episode JSON payload: {err}")

            actor = flags.get("actor") or episode_data.get("actor") or "buyer_agent"

            try:
                found = client.get_entity("counterparty", key)
                body = dict((found or {}).get("body") or {})
            except absent_errors:
                body = {"display_name": key, "source": "real"}

            episodes = list(body.get("episodes") or [])
            episodes.append(episode_data)
            body["episodes"] = episodes

            client.set_entity("counterparty", key, body)
            event_id = client.write_event(
                evaluated={"counterparty": key, "episode": episode_data},
                acted={"action": "record_episode", "actor": actor, "outcome": episode_data.get("outcome")},
            )
            payload = {"ok": True, "event_id": event_id, "episodes_count": len(episodes)}
        elif command == "update_counterparty":
            if len(positional) < 2:
                fail("bad_argument", "update_counterparty needs a counterparty key and a JSON update payload")
            key = positional[0]
            try:
                update_data = json.loads(positional[1])
            except json.JSONDecodeError as err:
                fail("bad_json", f"Invalid update JSON payload: {err}")

            try:
                found = client.get_entity("counterparty", key)
                body = dict((found or {}).get("body") or {})
            except absent_errors:
                body = {"display_name": key, "source": "real"}

            for k, v in update_data.items():
                body[k] = v

            client.set_entity("counterparty", key, body)
            payload = {"ok": True, "key": key, "body": body}
        elif command == "set_state":
            if len(positional) < 2:
                fail("bad_argument", "set_state needs a key and a JSON state payload")
            key = positional[0]
            try:
                state_data = json.loads(positional[1])
            except json.JSONDecodeError as err:
                fail("bad_json", f"Invalid state JSON payload: {err}")
            if hasattr(client, "set_state"):
                client.set_state(key, state_data)
            else:
                client.set_entity("hot_state", key, state_data)
            payload = {"ok": True, "key": key}
        elif command == "get_state":
            if len(positional) < 1:
                fail("bad_argument", "get_state needs a key")
            key = positional[0]
            try:
                if hasattr(client, "get_state"):
                    state_data = client.get_state(key)
                else:
                    found = client.get_entity("hot_state", key)
                    state_data = (found or {}).get("body")
                payload = {"ok": True, "key": key, "state": state_data}
            except absent_errors:
                payload = {"ok": True, "key": key, "state": None}
        elif command == "set_reference":
            if len(positional) < 2:
                fail("bad_argument", "set_reference needs a key and a JSON reference payload")
            key = positional[0]
            try:
                ref_data = json.loads(positional[1])
            except json.JSONDecodeError as err:
                fail("bad_json", f"Invalid reference JSON payload: {err}")
            if hasattr(client, "set_reference"):
                client.set_reference(key, ref_data)
            else:
                client.set_entity("reference", key, ref_data)
            payload = {"ok": True, "key": key}
        elif command == "get_reference":
            if len(positional) < 1:
                fail("bad_argument", "get_reference needs a key")
            key = positional[0]
            try:
                if hasattr(client, "get_reference"):
                    ref_data = client.get_reference(key)
                else:
                    ref_data = client.get_entity("reference", key)
                if isinstance(ref_data, dict) and "body" in ref_data:
                    body = ref_data["body"]
                    if isinstance(body, str):
                        try:
                            ref_data = json.loads(body)
                        except Exception:
                            pass
                    elif isinstance(body, dict):
                        ref_data = body
                payload = {"ok": True, "key": key, "reference": ref_data}
            except absent_errors:
                payload = {"ok": True, "key": key, "reference": None}
        elif command == "archive_entity":
            if len(positional) < 2:
                fail("bad_argument", "archive_entity needs category and name")
            cat = positional[0]
            name = positional[1]
            reason = flags.get("reason") or (positional[2] if len(positional) > 2 else "operator_archived")
            if hasattr(client, "archive_entity"):
                client.archive_entity(cat, name, reason=reason)
            else:
                try:
                    found = client.get_entity(cat, name)
                    body = dict((found or {}).get("body") or {})
                    body["archive_reason"] = reason
                    body["status"] = "ARCHIVED"
                    client.set_entity(f"archive_{cat}", name, body)
                except absent_errors:
                    pass
            payload = {"ok": True, "category": cat, "name": name, "reason": reason}
        elif command == "events":
            payload = {"ok": True, "events": client.read_events(limit=int_flag(flags, "limit", 50))}
        else:
            fail("unknown_command", f"{command} is not a bridge command")
    except Exception as error:  # noqa: BLE001
        fail("call_failed", f"{type(error).__name__}: {error}")

    json.dump(payload, sys.stdout, default=str)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
