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

const bridge = (args: string[], dbPath: string): Record<string, unknown> =>
  JSON.parse(
    execFileSync(python!, [BRIDGE, ...args], {
      env: { ...process.env, SIBYL_DB_PATH: dbPath },
      encoding: "utf8",
    }),
  ) as Record<string, unknown>;

describe.skipIf(!hasRuntime)("the Sibyl bridge, against the real client", () => {
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
