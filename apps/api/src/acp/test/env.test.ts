import { describe, expect, it, vi } from "vitest";

import { BASE_SEPOLIA_CHAIN_ID, loadAcpEnv, parseAcpEnv } from "../connection/env.js";

const validEnv = {
  ACP_CHAIN_ID: String(BASE_SEPOLIA_CHAIN_ID),
  ACP_WALLET_ADDRESS: "0x1111111111111111111111111111111111111111",
  ACP_WALLET_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  ACP_RPC_URL: "https://sepolia.base.org",
  ACP_SERVER_URL: "https://api-dev.acp.virtuals.io",
} satisfies NodeJS.ProcessEnv;

describe("parseAcpEnv", () => {
  it("accepts a complete Base Sepolia configuration", () => {
    const result = parseAcpEnv(validEnv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.ACP_CHAIN_ID).toBe(BASE_SEPOLIA_CHAIN_ID);
    expect(result.env.ACP_WALLET_ADDRESS).toBe(validEnv.ACP_WALLET_ADDRESS);
  });

  it.each([
    "ACP_CHAIN_ID",
    "ACP_WALLET_ADDRESS",
    "ACP_WALLET_PRIVATE_KEY",
    "ACP_RPC_URL",
    "ACP_SERVER_URL",
  ] as const)("names %s when it is missing", (variable) => {
    const { [variable]: _omitted, ...rest } = validEnv;

    const result = parseAcpEnv(rest);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(variable);
  });

  it("rejects a chain that is not Base Sepolia", () => {
    const result = parseAcpEnv({ ...validEnv, ACP_CHAIN_ID: "8453" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_CHAIN_ID");
    expect(result.message).toContain("non-mainnet");
  });

  it("rejects a malformed private key", () => {
    const result = parseAcpEnv({ ...validEnv, ACP_WALLET_PRIVATE_KEY: "0xdeadbeef" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_WALLET_PRIVATE_KEY");
  });

  it("never echoes the private key back in an error", () => {
    const secret = `0x${"a".repeat(64)}`;

    const result = parseAcpEnv({
      ...validEnv,
      ACP_WALLET_PRIVATE_KEY: secret,
      ACP_RPC_URL: "not-a-url",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain(secret);
  });
});

describe("loadAcpEnv", () => {
  it("exits 1 and prints the offending variable", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(((): never => {
      throw new Error("exited");
    }) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => loadAcpEnv({ ...validEnv, ACP_WALLET_ADDRESS: "nope" })).toThrow("exited");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls[0]?.[0]).toContain("ACP_WALLET_ADDRESS");

    exit.mockRestore();
    error.mockRestore();
  });

  it("returns the parsed environment when it is valid", () => {
    expect(loadAcpEnv(validEnv).ACP_SERVER_URL).toBe(validEnv.ACP_SERVER_URL);
  });
});
