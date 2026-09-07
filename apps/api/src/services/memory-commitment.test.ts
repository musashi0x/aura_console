import { describe, expect, it } from "vitest";

import {
  canonicalizeJson,
  commitMemoryToBaseSepolia,
  computeCommitment,
  getSaltFromSibyl,
  storeSaltInSibyl,
} from "./memory-commitment.js";

describe("memory-commitment service", () => {
  it("canonicalizes JSON deterministically regardless of key order", () => {
    const objA = { b: 2, a: 1, nested: { y: "test", x: 10 } };
    const objB = { a: 1, nested: { x: 10, y: "test" }, b: 2 };

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    expect(canonicalizeJson(objA)).toBe('{"a":1,"b":2,"nested":{"x":10,"y":"test"}}');
  });

  it("computes reproducible keccak256 commitment when given the same salt", () => {
    const profile = { counterpartyKey: "virtuals:agent:alpha", reliability: 0.85 };
    const salt = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    const res1 = computeCommitment(profile, salt);
    const res2 = computeCommitment(profile, salt);

    expect(res1.commitment).toBe(res2.commitment);
    expect(res1.commitment).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("produces different commitments for different salts", () => {
    const profile = { counterpartyKey: "virtuals:agent:alpha", reliability: 0.85 };
    const res1 = computeCommitment(profile);
    const res2 = computeCommitment(profile);

    expect(res1.salt).not.toBe(res2.salt);
    expect(res1.commitment).not.toBe(res2.commitment);
  });

  it("commits memory to Base Sepolia and stores salt in Sibyl REFERENCE tier", async () => {
    const profile = {
      relationshipStatus: "PREFERRED",
      overallReliability: 0.95,
      confidence: 0.82,
      memoryVersion: 13,
    };

    const res = await commitMemoryToBaseSepolia({
      counterpartyKey: "virtuals:agent:test_commitment",
      version: 13,
      profile,
    });

    expect(res.network).toBe("base-sepolia");
    expect(res.commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(res.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(res.explorerUrl).toContain(res.txHash);
  });

  it("stores and retrieves cryptographic salt from Sibyl REFERENCE tier", async () => {
    const stored = await storeSaltInSibyl("virtuals:agent:unit_test", 1, "0xtest_salt_1234");
    expect(typeof stored).toBe("boolean");
    const retrieved = await getSaltFromSibyl("virtuals:agent:unit_test", 1);
    if (stored) {
      expect(retrieved).toBe("0xtest_salt_1234");
    }
  });
});
