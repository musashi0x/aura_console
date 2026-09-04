import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { getDb, schema } from "@aura/db";
import type { JobRoomEntry, JobSession } from "@virtuals-protocol/acp-node-v2";
import { describe, expect, it } from "vitest";

import { AcpBridge } from "./bridge.js";

/**
 * The five session methods that move money or commit to a price, plus
 * executeTool, which reaches all five by name.
 */
const FORBIDDEN = ["fund", "complete", "reject", "setBudget", "submit", "executeTool"] as const;

/**
 * Every file that a stream entry can reach. `agent.ts` is included because it
 * is where a handler could be swapped for one that acts.
 */
const HANDLER_PATH = ["./worker.ts", "./bridge.ts", "./translate.ts", "./agent.ts"];

const read = (relative: string) =>
  readFile(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Strips comments so prose about what we never call is not mistaken for a call. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const lifecycle: JobRoomEntry[] = (
  [
    { type: "job.created", jobId: "7", client: "0xc", provider: "0xp", evaluator: "0xe", expiredAt: "1767312000", hook: "0xh" },
    { type: "budget.set", jobId: "7", amount: 3 },
    { type: "job.funded", jobId: "7", client: "0xc", amount: 3 },
    { type: "job.submitted", jobId: "7", provider: "0xp", deliverableHash: "0xh", deliverable: "done" },
    { type: "job.completed", jobId: "7", evaluator: "0xe", reason: "ok" },
    { type: "job.expired", jobId: "7" },
  ] as const satisfies readonly Extract<JobRoomEntry, { kind: "system" }>["event"][]
).map((event, index) => ({
  kind: "system",
  onChainJobId: "7",
  chainId: 84_532,
  event,
  timestamp: 1_767_225_600_000 + index,
}));

describe("the runtime never acts on its own", () => {
  it("touches no money-moving session method across a whole job lifecycle", async () => {
    const touched: string[] = [];

    const session = new Proxy(
      {},
      {
        get(_target, property) {
          const name = String(property);
          touched.push(name);
          return () => {
            throw new Error(`The runtime called session.${name}()`);
          };
        },
      },
    ) as unknown as JobSession;

    const bridge = new AcpBridge({
      fetchJobDescription: async () => "lifecycle probe",
      log: () => {},
    });

    // The exact composition worker.ts registers as its entry handler.
    const handler = (_session: JobSession, entry: JobRoomEntry) => bridge.handleEntry(entry);

    for (const entry of lifecycle) {
      await handler(session, entry);
    }

    expect(touched.filter((name) => FORBIDDEN.includes(name as (typeof FORBIDDEN)[number]))).toEqual(
      [],
    );

    // It did do its actual job: the whole lifecycle is on record.
    const runs = await getDb().select().from(schema.runs);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.budgetUsdc).toBeNull();
  });

  it("names no forbidden method anywhere a stream entry can reach", async () => {
    for (const file of HANDLER_PATH) {
      const source = code(await read(file));

      for (const method of FORBIDDEN) {
        expect(source, `${file} calls ${method}`).not.toMatch(
          new RegExp(`\\.\\s*${method}\\s*\\(`),
        );
      }
    }
  });

  it("keeps job creation out of the handler path", async () => {
    for (const file of HANDLER_PATH) {
      const source = code(await read(file));

      expect(source, `${file} creates jobs`).not.toMatch(/\.\s*create(Job|FundTransferJob)/);
    }
  });
});
