import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import * as MemoryCommitmentService from "../services/memory-commitment.js";
import * as SibylService from "../services/sibyl.js";

describe("commitments route (/api/commitments)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("rejects invalid subject key", async () => {
    const res = await app.request("/api/commitments/%20");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid_subject_key");
  });

  it("rejects invalid version query param", async () => {
    const res = await app.request("/api/commitments/virtuals:agent:alpha?version=invalid");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid_version");
  });

  it("returns commitment status and never exposes private salt", async () => {
    vi.spyOn(MemoryCommitmentService, "getSaltFromSibyl").mockResolvedValue("0xprivate-salt-123456");
    vi.spyOn(SibylService, "retrieveFromSibyl").mockResolvedValue({
      status: "AVAILABLE",
      counterpartyKey: "virtuals:agent:alpha",
      displayName: "Alpha",
      memoryVersion: 2,
      episodesUsed: 5,
      relationshipStatus: "PREFERRED",
      overallReliability: 0.94,
      taskFit: 0.9,
      confidence: 0.88,
      riskNote: null,
      isFixture: false,
    });

    const res = await app.request("/api/commitments/virtuals:agent:alpha?version=2");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.subjectKey).toBe("virtuals:agent:alpha");
    expect(body.version).toBe(2);
    expect(body.status).toBe("CONFIRMED");
    expect(body.network).toBe("base-sepolia");
    expect(body.chainId).toBe(84532);
    expect(body.hasSaltStored).toBe(true);
    expect(body.verified).toBe(true);

    // CRITICAL SECURITY ASSERTION: salt value must never be present in the public response
    expect(JSON.stringify(body)).not.toContain("0xprivate-salt-123456");
  });

  it("returns 503 when Sibyl memory runtime is unavailable", async () => {
    vi.spyOn(MemoryCommitmentService, "getSaltFromSibyl").mockResolvedValue(null);
    vi.spyOn(SibylService, "retrieveFromSibyl").mockResolvedValue({
      status: "ERROR",
      counterpartyKey: "virtuals:agent:alpha",
      retryable: true,
    });

    const res = await app.request("/api/commitments/virtuals:agent:alpha");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("memory_unavailable");
  });

  it("verifies commitment successfully when expected commitment matches", async () => {
    vi.spyOn(MemoryCommitmentService, "verifyMemoryCommitment").mockResolvedValue({
      verified: true,
      computedCommitment: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      saltFound: true,
      details: "Memory commitment verified successfully against Base Sepolia calldata!",
    });

    const res = await app.request("/api/commitments/virtuals:agent:alpha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        expectedCommitment: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.verified).toBe(true);
    expect(body.state).toBe("VERIFIED");
    expect(body.network).toBe("base-sepolia");
  });

  it("returns MISMATCH state when expected commitment does not match", async () => {
    vi.spyOn(MemoryCommitmentService, "verifyMemoryCommitment").mockResolvedValue({
      verified: false,
      computedCommitment: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      saltFound: true,
      details: "Commitment mismatch",
    });

    const res = await app.request("/api/commitments/virtuals:agent:alpha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        expectedCommitment: "0x9999999999999999999999999999999999999999999999999999999999999999",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.verified).toBe(false);
    expect(body.state).toBe("MISMATCH");
  });
});
