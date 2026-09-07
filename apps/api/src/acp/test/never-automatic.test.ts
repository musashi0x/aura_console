import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { getDb, schema } from "@aura/db";
import type { JobRoomEntry, JobSession } from "@virtuals-protocol/acp-node-v2";
import { describe, expect, it } from "vitest";

import { AcpBridge } from "../inbound/bridge.js";

/**
 * The five session methods that move money or commit to a price, plus
 * executeTool, which reaches all five by name.
 */
const FORBIDDEN = ["fund", "complete", "reject", "setBudget", "submit", "executeTool"] as const;

/**
 * Everything a stream entry can reach: the worker that registers the handler,
 * the inbound pipeline, the pure domain it calls, and the connection layer,
 * which is where a handler could be swapped for one that acts.
 *
 * `outbound/` is deliberately absent. It does call `fund`, but nothing an entry
 * does reaches it: its only input is an `acp_spend_intents` row that an
 * operator created, which is the whole point of the split.
 *
 * Directories rather than a list of filenames, on purpose. A list goes stale
 * the moment someone adds a file; a directory walk does not.
 */
const ENTRY_PATH_DIRS = ["inbound", "domain", "connection"] as const;
const ENTRY_PATH_FILES = ["worker.ts"] as const;

const resolve = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string) => readFile(resolve(relative), "utf8");

async function sourcesIn(dir: string): Promise<string[]> {
  const entries = await readdir(resolve(`../${dir}`));
  return entries
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => `../${dir}/${name}`);
}

async function entryPathSources(): Promise<string[]> {
  const nested = await Promise.all(ENTRY_PATH_DIRS.map(sourcesIn));
  return [...ENTRY_PATH_FILES.map((name) => `../${name}`), ...nested.flat()];
}

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
    const files = await entryPathSources();
    // A walk that found nothing would pass every assertion below it.
    expect(files.length).toBeGreaterThan(4);

    for (const file of files) {
      const source = code(await read(file));

      for (const method of FORBIDDEN) {
        expect(source, `${file} calls ${method}`).not.toMatch(
          new RegExp(`\\.\\s*${method}\\s*\\(`),
        );
      }
    }
  });

  it("keeps job creation out of the handler path", async () => {
    for (const file of await entryPathSources()) {
      const source = code(await read(file));

      expect(source, `${file} creates jobs`).not.toMatch(/\.\s*create(Job|FundTransferJob)/);
    }
  });

  it("lets nothing on the inbound side reach the spender", async () => {
    // No import edge means no call graph from an observed entry to
    // session.fund(), whatever anyone writes inside the bridge.
    for (const file of [
      ...(await sourcesIn("inbound")),
      ...(await sourcesIn("domain")),
      ...(await sourcesIn("connection")),
    ]) {
      expect(code(await read(file)), `${file} imports the spender`).not.toMatch(/spender/);
    }
  });

  it("reaches the spender only from an operator's instruction", async () => {
    // The worker holds it, and only builds one when the operator opted in.
    const worker = code(await read("../worker.ts"));
    expect(worker).toMatch(/ACP_SPEND_ENABLED/);
    expect(worker).toMatch(/env\.ACP_SPEND_ENABLED\s*\?/);
  });

  it("makes the spender act on an instruction row, not on an event", async () => {
    const spender = code(await read("../outbound/spender.ts"));

    // Reading run_events for something to do would make a forgeable event an
    // instruction. The only source of work is the intents table.
    expect(spender).toMatch(/acp_spend_intents|acpSpendIntents/);
    expect(spender).not.toMatch(/runEvents/);
    expect(spender).not.toMatch(/acp\.fund\.authorized/);
  });
});
