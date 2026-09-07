import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BRIDGE = new URL("../../../../tools/sibyl_bridge.py", import.meta.url).pathname;

/**
 * These exercise the real bridge against the real client when a Python with
 * `sibyl-memory-client` is configured, and are skipped when it is not.
 *
 * Skipped, not mocked. A mock here would assert that our own fake behaves,
 * which is exactly the kind of test that let a fabricated Sibyl client sit in
 * the tree looking integrated.
 */
const python = process.env.SIBYL_PYTHON;
const hasRuntime = Boolean(
  python &&
    existsSync(python) &&
    (() => {
      try {
        execFileSync(python, ["-c", "import sibyl_memory_client"], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    })(),
);

/* The bridge reads as a named tenant and refuses to guess one, so every call
   here names it. Sibyl isolates by tenant: reading as the wrong one answers
   "not found" for records that exist, which is the quietest failure available
   in this whole path. */
const TENANT = process.env.AGENT_ID ?? "agent_buyer_1";

const bridge = (args: string[], dbPath: string): Record<string, unknown> =>
  JSON.parse(
    execFileSync(python!, [BRIDGE, ...args], {
      env: { ...process.env, SIBYL_DB_PATH: dbPath, SIBYL_TENANT_ID: TENANT },
      encoding: "utf8",
    }),
  ) as Record<string, unknown>;

const bridgeWithoutTenant = (dbPath: string): Record<string, unknown> => {
  const env: NodeJS.ProcessEnv = { ...process.env, SIBYL_DB_PATH: dbPath };
  delete env.SIBYL_TENANT_ID;
  return JSON.parse(
    execFileSync(python!, [BRIDGE, "status"], { env, encoding: "utf8" }),
  ) as Record<string, unknown>;
};

describe.skipIf(!hasRuntime)("the Sibyl bridge, against the real client", () => {
  it("refuses to read without a tenant rather than guessing one", () => {
    const dbPath = process.env.SIBYL_DB_PATH;
    if (!dbPath) return;
    // A guessed tenant answers from a store nobody asked about, and the result
    // looks exactly like an honest empty one.
    const result = bridgeWithoutTenant(dbPath);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("tenant_missing");
  });

  it("reports an absent database rather than creating an empty one", () => {
    const result = bridge(["status"], "/tmp/aura-sibyl-does-not-exist.db");
    // `MemoryClient.local` would create the file. Letting it would turn "no
    // memory here" into "a memory with nothing in it", which is a claim.
    expect(result.ok).toBe(false);
    expect(result.code).toBe("db_absent");
    expect(existsSync("/tmp/aura-sibyl-does-not-exist.db")).toBe(false);
  });

  it("reports the tier and schema Sibyl itself returns", () => {
    const dbPath = process.env.SIBYL_DB_PATH;
    if (!dbPath || !existsSync(dbPath.replace("~", process.env.HOME ?? ""))) return;
    const result = bridge(["status"], dbPath);
    expect(result.ok).toBe(true);
    // Not asserted against a fixture: these come from the installed client.
    expect(typeof result.tier).toBe("string");
    expect(typeof result.schemaVersion).toBe("number");
    expect(typeof result.dbSizeBytes).toBe("number");
  });
});

describe("the Sibyl status contract", () => {
  it("has a runtime configured, or says why it does not", async () => {
    const { getSibylStatus } = await import("./sibyl.js");
    const status = await getSibylStatus();
    // Either way it must never look like an answer from memory: an
    // unreachable Sibyl reports a code, never a zeroed entity count.
    if (!status.reachable) {
      expect(status.code).toBeTruthy();
      expect(status.entityCount).toBeUndefined();
    } else {
      expect(typeof status.tier).toBe("string");
    }
  });
});

describe.skipIf(!hasRuntime)("retrieval keeps its three outcomes apart", () => {
  it("reads a profile Sibyl actually holds", () => {
    const dbPath = process.env.SIBYL_DB_PATH;
    if (!dbPath) return;
    /* The key is taken from the store rather than hardcoded. A fixed key ties
       the test to whichever database the developer happens to be pointed at,
       which is how it started failing the moment the path moved from a probe
       file to the real one. */
    const listed = bridge(["entities", "counterparty"], dbPath);
    expect(listed.ok).toBe(true);
    const entities = (listed.entities ?? []) as { name?: string }[];
    if (entities.length === 0) return;

    const name = entities[0]?.name;
    expect(typeof name).toBe("string");
    const result = bridge(["retrieve", "counterparty", name!], dbPath);
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
  });

  it("calls an unknown counterparty not-found, never a failed lookup", () => {
    const dbPath = process.env.SIBYL_DB_PATH;
    if (!dbPath) return;
    // The client raises for an unknown entity. Letting that surface as an error
    // would report a counterparty we have never met as a lookup that broke,
    // which is the one conflation this product may never make.
    const result = bridge(["retrieve", "counterparty", "virtuals:agent:never-met"], dbPath);
    expect(result.ok).toBe(true);
    expect(result.found).toBe(false);
  });

  it("calls an unreadable store a failure, never an empty history", () => {
    const result = bridge(["retrieve", "counterparty", "anyone"], "/tmp/aura-no-sibyl.db");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("db_absent");
  });
});
