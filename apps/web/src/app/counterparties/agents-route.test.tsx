import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { console_ } from "@/features/console/copy";

const dbHealth = vi.fn();
const listSibylCounterparties = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    dbHealth: () => dbHealth(),
    listSibylCounterparties: () => listSibylCounterparties(),
    agentHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    sibylHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
  },
}));

const { default: CounterpartiesPage } = await import("./page");

const profile = (over: Record<string, unknown> = {}) => ({
  counterpartyKey: "virtuals:agent:alpha",
  hasProfile: true,
  relationshipStatus: "PREFERRED",
  memoryVersion: 13,
  episodesUsed: 2,
  overallReliability: 88,
  taskFit: 91,
  confidence: 76,
  updatedAt: "2026-09-05T13:19:14.916Z",
  ...over,
});

beforeEach(() => {
  dbHealth.mockReset();
  listSibylCounterparties.mockReset();
  dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 1 } });
});

/**
 * The three outcomes of asking Sibyl are not interchangeable. This surface used
 * to render "unavailable" unconditionally while nothing was wired up, which was
 * honest then and would be a lie now.
 */
describe("Agents, from Sibyl", () => {
  it("renders the profile Sibyl actually returned", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });

    render(await CounterpartiesPage());

    expect(screen.getByText("virtuals:agent:alpha")).toBeInTheDocument();
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("says memory could not be read rather than showing an empty page", async () => {
    listSibylCounterparties.mockResolvedValue({
      ok: false,
      error: { code: "db_absent", message: "No Sibyl database at /nowhere" },
    });

    render(await CounterpartiesPage());

    // "We could not look" must never render as "we looked and there is nobody".
    expect(screen.getByText("No Sibyl database at /nowhere")).toBeInTheDocument();
    expect(screen.queryByText(console_.agents.empty)).toBeNull();
  });

  it("claims an empty memory only because Sibyl answered with one", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [] } });

    render(await CounterpartiesPage());

    expect(screen.getByText(console_.agents.empty)).toBeInTheDocument();
    expect(screen.queryByText("MEMORY UNAVAILABLE")).toBeNull();
  });

  it("lists a counterparty with no profile without inventing one", async () => {
    listSibylCounterparties.mockResolvedValue({
      ok: true,
      data: {
        items: [
          profile({
            counterpartyKey: "atlas-agent",
            hasProfile: false,
            relationshipStatus: null,
            memoryVersion: null,
            episodesUsed: null,
            overallReliability: null,
            taskFit: null,
            confidence: null,
          }),
        ],
      },
    });

    const { container } = render(await CounterpartiesPage());

    expect(screen.getByText("atlas-agent")).toBeInTheDocument();
    expect(screen.getByText(console_.agents.noProfile)).toBeInTheDocument();
    // A missing score is not a zero, and an absent profile renders no numbers
    // at all rather than a row of them.
    expect(container.textContent).not.toMatch(/Memory version/);
  });
});
