import { describe, expect, it } from "vitest";
import {
  ACTIVE_COUNTERPARTIES,
  getRouteChatContext,
} from "./route-chat-context";

describe("route-chat-context", () => {
  describe("counterparties / agents surface", () => {
    it("matches /counterparties pathname", () => {
      const ctx = getRouteChatContext(undefined, "/counterparties");
      expect(ctx.surfaceId).toBe("counterparties");
      expect(ctx.scopeLabel).toBe("COUNTERPARTIES & AGENTS");
      expect(ctx.activeSummary).toContain("Alpha, Beta, Charlie");
      expect(ctx.entities).toEqual(ACTIVE_COUNTERPARTIES);
      expect(ctx.suggestionGroups[0]?.suggestions.length).toBeGreaterThan(0);
      expect(
        ctx.suggestionGroups[0]?.suggestions.some((s) =>
          s.prompt.includes("Bayesian prior"),
        ),
      ).toBe(true);
    });

    it("matches surface='Agents' or surface='Counterparties'", () => {
      const ctx = getRouteChatContext("Agents", "/some-unknown-path");
      expect(ctx.surfaceId).toBe("counterparties");
      expect(ctx.entities?.length).toBe(3);
    });
  });

  describe("runs / missions surface", () => {
    it("matches /runs pathname without runId", () => {
      const ctx = getRouteChatContext(undefined, "/runs");
      expect(ctx.surfaceId).toBe("runs");
      expect(ctx.scopeLabel).toBe("MISSION TELEMETRY");
    });

    it("matches specific runId", () => {
      const ctx = getRouteChatContext(undefined, "/runs/run_99", "run_99");
      expect(ctx.surfaceId).toBe("runs");
      expect(ctx.scopeLabel).toBe("MISSION RUN");
      expect(ctx.activeSummary).toBe("Run run_99");
    });

    it("matches surface='Missions'", () => {
      const ctx = getRouteChatContext("Missions");
      expect(ctx.surfaceId).toBe("runs");
    });
  });

  describe("policies / guardrails surface", () => {
    it("matches /policies pathname", () => {
      const ctx = getRouteChatContext(undefined, "/policies");
      expect(ctx.surfaceId).toBe("policies");
      expect(ctx.scopeLabel).toBe("GUARDRAILS & POLICIES");
      expect(ctx.activeSummary).toContain("Auto-Spend");
      expect(
        ctx.suggestionGroups[0]?.suggestions.some((s) =>
          s.id.includes("spend-ceilings"),
        ),
      ).toBe(true);
    });

    it("matches surface='Guardrails'", () => {
      const ctx = getRouteChatContext("Guardrails");
      expect(ctx.surfaceId).toBe("policies");
    });
  });

  describe("system / readiness surface", () => {
    it("matches /system pathname", () => {
      const ctx = getRouteChatContext(undefined, "/system");
      expect(ctx.surfaceId).toBe("system");
      expect(ctx.scopeLabel).toBe("NETWORK READINESS");
      expect(ctx.badge).toContain("MULTI-RUNTIME");
    });

    it("matches surface='Network Readiness'", () => {
      const ctx = getRouteChatContext("Network Readiness");
      expect(ctx.surfaceId).toBe("system");
    });
  });

  describe("docs surface", () => {
    it("matches /docs pathname", () => {
      const ctx = getRouteChatContext(undefined, "/docs");
      expect(ctx.surfaceId).toBe("docs");
      expect(ctx.scopeLabel).toBe("DOCUMENTATION");
    });
  });

  describe("chat surface", () => {
    it("matches /chat pathname", () => {
      const ctx = getRouteChatContext(undefined, "/chat");
      expect(ctx.surfaceId).toBe("chat");
      expect(ctx.scopeLabel).toBe("ASSISTANT CONSOLE");
    });
  });

  describe("boost surface", () => {
    it("matches /boost pathname", () => {
      const ctx = getRouteChatContext(undefined, "/boost");
      expect(ctx.surfaceId).toBe("boost");
      expect(ctx.scopeLabel).toBe("BOOST SHOWCASE");
    });
  });

  describe("general fallback", () => {
    it("returns general for unmapped path and surface", () => {
      const ctx = getRouteChatContext(undefined, "/unknown");
      expect(ctx.surfaceId).toBe("general");
      expect(ctx.scopeLabel).toBe("AURA CONSOLE");
    });
  });
});
