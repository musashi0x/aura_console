import { describe, expect, it, vi } from "vitest";

import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  loadAcpEnv,
  parseAcpEnv,
} from "../connection/env.js";

const validEnv = {
  ACP_CHAIN_ID: String(BASE_SEPOLIA_CHAIN_ID),
  ACP_WALLET_ADDRESS: "0x1111111111111111111111111111111111111111",
  ACP_PRIVY_WALLET_ID: "kf7m2q9x4p1v8n3b6c0d5g2h",
  ACP_PRIVY_AUTHORIZATION_KEY: `wallet-auth:${"A".repeat(60)}==`,
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
    expect(result.env.ACP_PRIVY_WALLET_ID).toBe(validEnv.ACP_PRIVY_WALLET_ID);
  });

  it.each([
    "ACP_CHAIN_ID",
    "ACP_WALLET_ADDRESS",
    "ACP_PRIVY_WALLET_ID",
    "ACP_PRIVY_AUTHORIZATION_KEY",
    "ACP_RPC_URL",
    "ACP_SERVER_URL",
  ] as const)("names %s when it is missing", (variable) => {
    const { [variable]: _omitted, ...rest } = validEnv;

    const result = parseAcpEnv(rest);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(variable);
  });

  it("treats ACP_PRIVY_APP_ID as optional", () => {
    const result = parseAcpEnv(validEnv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.ACP_PRIVY_APP_ID).toBeUndefined();
  });

  it("accepts Base mainnet, which the operator has to write out in full", () => {
    const result = parseAcpEnv({
      ...validEnv,
      ACP_CHAIN_ID: String(BASE_MAINNET_CHAIN_ID),
      ACP_RPC_URL: "https://mainnet.base.org",
      ACP_SERVER_URL: "https://api.acp.virtuals.io",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.ACP_CHAIN_ID).toBe(BASE_MAINNET_CHAIN_ID);
  });

  it("rejects a chain that is neither Base nor Base Sepolia", () => {
    const result = parseAcpEnv({ ...validEnv, ACP_CHAIN_ID: "1" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_CHAIN_ID");
    expect(result.message).toContain(String(BASE_SEPOLIA_CHAIN_ID));
    expect(result.message).toContain(String(BASE_MAINNET_CHAIN_ID));
  });

  it("accepts an authorization key without the wallet-auth prefix", () => {
    const result = parseAcpEnv({
      ...validEnv,
      ACP_PRIVY_AUTHORIZATION_KEY: "B".repeat(64),
    });

    expect(result.ok).toBe(true);
  });

  /**
   * The mistake this names is the one people actually make: a Privy-managed
   * agent wallet has no exportable EOA key, so an operator who goes looking for
   * one ends up pasting some other wallet's key here.
   */
  it("says an EOA private key is the wrong kind of key", () => {
    const result = parseAcpEnv({
      ...validEnv,
      ACP_PRIVY_AUTHORIZATION_KEY: `0x${"1".repeat(64)}`,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_PRIVY_AUTHORIZATION_KEY");
    expect(result.message).toContain("not a 0x EOA private key");
  });

  it("rejects a malformed authorization key", () => {
    const result = parseAcpEnv({ ...validEnv, ACP_PRIVY_AUTHORIZATION_KEY: "short" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ACP_PRIVY_AUTHORIZATION_KEY");
  });

  it("never echoes the authorization key back in an error", () => {
    const secret = `wallet-auth:${"Z".repeat(60)}==`;

    const result = parseAcpEnv({
      ...validEnv,
      ACP_PRIVY_AUTHORIZATION_KEY: secret,
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
