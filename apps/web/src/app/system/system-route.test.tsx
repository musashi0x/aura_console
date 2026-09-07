import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApiResult, SibylHealth } from "@/lib/api-client";

/**
 * The readiness surface is where the product's central rule is most visible:
 * "we could not look" and "we looked and there is nothing" must never render as
 * each other. Sibyl has three outcomes that all produce no numbers — the API
 * could not be asked, Sibyl is not wired up, Sibyl was asked and failed — and a
 * row that filled any of them with a zero would claim a measurement nobody
 * took.
 *
 * These tests drive the Sibyl response and pin what the row is allowed to say.
 */

const state = vi.hoisted(() => ({
  sibyl: null as unknown as ApiResult<SibylHealth>,
  dbOk: true,
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    health: async () => ({ ok: true, data: { status: "ok", uptime: 1, timestamp: "" } }),
    dbHealth: async () =>
      state.dbOk
        ? { ok: true, data: { status: "ok", latencyMs: 3 } }
        : { ok: false, error: { code: "db_unreachable", message: "no" } },
    sibylHealth: async () => state.sibyl,
    /* `readGrounding` runs on every console surface now, and it asks about the
       agent as well as memory. Stubbed unreachable: these tests are about what
       the readiness rows report, and a grounded agent would only add a banner
       they say nothing about. */
    agentHealth: async () => ({
      ok: true as const,
      data: { configured: false, reachable: false, detail: "no agent in this test" },
    }),
  },
}));

const { default: SystemPage } = await import("./page");

const REACHABLE: SibylHealth = {
  configured: true,
  reachable: true,
  tier: "free",
  schemaVersion: 4,
  dbSizeBytes: 299_008,
  softCapBytes: 5_242_880,
  atOrAboveCap: false,
  entityCount: 2,
};

function answering(overrides: Partial<SibylHealth> = {}): void {
  state.sibyl = { ok: true, data: { ...REACHABLE, ...overrides } };
}

async function renderPage() {
  state.dbOk = true;
  render(await SystemPage());
}

/**
 * The Sibyl row alone.
 *
 * API, Database and Sibyl all render a StatusBadge and all three can read
 * READY, so an unscoped query matches a neighbour and a test can pass on the
 * wrong row. Scoping by the row's own label keeps each assertion about Sibyl.
 */
function sibylRow() {
  const row = screen.getByText("Relationship memory").closest("li");
  if (!row) throw new Error("the Sibyl readiness row is not rendered");
  return within(row);
}

describe("the readiness surface, when Sibyl answers", () => {
  it("reports every reading as Sibyl's own number", async () => {
    answering();
    await renderPage();

    const row = sibylRow();
    expect(row.getByText("READY")).toBeInTheDocument();
    expect(row.getByText("free")).toBeInTheDocument();
    expect(row.getByText("v4")).toBeInTheDocument();
    expect(row.getByText("2")).toBeInTheDocument();
    // 299008 / 1048576 = 0.29 MB, and 5242880 = 5.00 MB.
    expect(row.getByText("0.29 MB")).toBeInTheDocument();
    expect(row.getByText("5.00 MB")).toBeInTheDocument();
  });

  it("says a field is not reported rather than printing a zero for it", async () => {
    // A store reading "0.00 MB" is a claim that Sibyl is empty. An absent field
    // is not that claim, so it may not borrow its rendering.
    answering({ dbSizeBytes: undefined, entityCount: undefined, tier: undefined });
    await renderPage();

    expect(screen.queryByText("0.00 MB")).not.toBeInTheDocument();
    expect(screen.getAllByText(/not reported/i).length).toBeGreaterThanOrEqual(3);
  });

  it("states Sibyl's own soft-cap conclusion instead of recomputing it", async () => {
    // atOrAboveCap is Sibyl's verdict on its own store. Deriving it from the
    // two byte readings would disagree with Sibyl the moment one went missing.
    answering({ atOrAboveCap: true });
    await renderPage();

    const row = sibylRow();
    expect(row.getByText("AT SOFT CAP")).toBeInTheDocument();
    expect(row.queryByText("READY")).not.toBeInTheDocument();
  });

  it("does not read a missing cap flag as headroom", async () => {
    answering({ atOrAboveCap: undefined });
    await renderPage();

    const row = sibylRow();
    expect(row.queryByText("AT SOFT CAP")).not.toBeInTheDocument();
    expect(row.getByText("READY")).toBeInTheDocument();
  });
});

describe("the readiness surface, when Sibyl does not answer", () => {
  it("distinguishes a deployment with no Sibyl from one whose Sibyl failed", async () => {
    answering({ configured: false, reachable: false, detail: undefined });
    await renderPage();
    expect(sibylRow().getByText("NOT CONNECTED")).toBeInTheDocument();
  });

  it("carries Sibyl's own reason when it was configured and still failed", async () => {
    answering({
      configured: true,
      reachable: false,
      code: "bridge_unreachable",
      detail: "The Sibyl bridge could not be run.",
    });
    await renderPage();

    const row = sibylRow();
    expect(row.getByText("UNAVAILABLE")).toBeInTheDocument();
    expect(row.getByText(/The Sibyl bridge could not be run\./)).toBeInTheDocument();
  });

  it("shows no readings at all, so nothing reads as a measured empty store", async () => {
    // This is the invariant. A row that could not measure must carry no
    // numbers - not zeroes, and not the labels that would frame a zero.
    answering({ configured: true, reachable: false, detail: "unreachable" });
    await renderPage();

    const row = sibylRow();
    expect(row.queryByText("TIER")).not.toBeInTheDocument();
    expect(row.queryByText("ENTITIES")).not.toBeInTheDocument();
    expect(row.queryByText("STORE")).not.toBeInTheDocument();
    expect(row.queryByText(/MB$/)).not.toBeInTheDocument();
  });

  it("separates the API being unaskable from Sibyl being unreachable", async () => {
    // These are two different failures: one is our transport, one is Sibyl's.
    // Collapsing them would blame Sibyl for an API that never answered.
    state.sibyl = { ok: false, error: { code: "api_down", message: "no route" } };
    await renderPage();

    expect(sibylRow().getByText(/could not be asked about Sibyl/i)).toBeInTheDocument();
  });
});

describe("the readiness surface's unchecked rows", () => {
  it("says policy and agent identity were not checked rather than assuming them", async () => {
    answering();
    await renderPage();

    // Two rows have no browser-readable endpoint in v0.1. They are listed as
    // not checked rather than omitted, because omission reads as "fine".
    expect(screen.getAllByText("NOT CHECKED")).toHaveLength(2);
  });
});
