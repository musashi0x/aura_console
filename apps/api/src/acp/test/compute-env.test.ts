import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMPUTE_BASE_URL,
  isComputeConfigured,
  parseComputeEnv,
} from "../compute/env.js";

const validEnv = {
  ACP_API_KEY: "acp-db745c76c907b33680cd",
} satisfies NodeJS.ProcessEnv;

describe("parseComputeEnv", () => {
  it("accepts a key alone and defaults the endpoint", () => {
    const result = parseComputeEnv(validEnv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.ACP_API_KEY).toBe(validEnv.ACP_API_KEY);
    expect(result.env.ACP_COMPUTE_BASE_URL).toBe(DEFAULT_COMPUTE_BASE_URL);
  });

  it("takes an endpoint override, because the dashboard issues one per agent", () => {
    const result = parseComputeEnv({
      ...validEnv,
      ACP_COMPUTE_BASE_URL: "https://compute.example.test/v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.ACP_COMPUTE_BASE_URL).toBe("https://compute.example.test/v1");
  });

  /**
   * The four credentials in this repository are easy to transpose, and three of
   * them are secrets. Each of these is a paste that would otherwise fail as an
   * opaque 401 from the gateway.
   */
  it.each([
    ["a Privy authorization key", `wallet-auth:${"A".repeat(60)}==`],
    ["an EOA private key", `0x${"a".repeat(64)}`],
    ["a Privy wallet id", "kf7m2q9x4p1v8n3b6c0d5g2h"],
    ["an empty value", ""],
  ])("rejects %s in ACP_API_KEY", (_label, value) => {
    const result = parseComputeEnv({ ACP_API_KEY: value });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_API_KEY");
  });

  it("rejects an endpoint that is not http", () => {
    const result = parseComputeEnv({ ...validEnv, ACP_COMPUTE_BASE_URL: "compute.virtuals.io" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_COMPUTE_BASE_URL");
  });

  it("never echoes the key in a failure message", () => {
    const secret = "acp-shouldnotappear";
    const result = parseComputeEnv({ ACP_API_KEY: secret, ACP_COMPUTE_BASE_URL: "nope" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain(secret);
  });
});

describe("isComputeConfigured", () => {
  it("separates unconfigured from misconfigured for the caller", () => {
    expect(isComputeConfigured({})).toBe(false);
    expect(isComputeConfigured(validEnv)).toBe(true);
  });
});
