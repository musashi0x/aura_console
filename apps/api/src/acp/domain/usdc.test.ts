import { describe, expect, it } from "vitest";

import { usdcRawFromString, usdcString, usdcStringFromRaw } from "./usdc.js";

describe("usdc formatting", () => {
  it("renders six decimals", () => {
    expect(usdcString(1.5)).toBe("1.500000");
    expect(usdcString(0)).toBe("0.000000");
  });

  it("refuses a non-finite amount rather than storing NaN", () => {
    expect(() => usdcString(Number.NaN)).toThrow(/non-finite/);
  });

  it("converts a raw integer without going through a float", () => {
    expect(usdcStringFromRaw(1_500_000n)).toBe("1.500000");
    expect(usdcStringFromRaw(1n)).toBe("0.000001");
    expect(usdcStringFromRaw(0n)).toBe("0.000000");
    // Beyond Number.MAX_SAFE_INTEGER: a float round-trip would lose this.
    expect(usdcStringFromRaw(9_007_199_254_740_993_000_000n)).toBe("9007199254740993.000000");
  });
});

describe("usdcRawFromString", () => {
  it("converts by integer arithmetic, never through a double", () => {
    expect(usdcRawFromString("1.250000")).toBe(1_250_000n);
    expect(usdcRawFromString("1.234567")).toBe(1_234_567n);
    expect(usdcRawFromString("0.000001")).toBe(1n);
    expect(usdcRawFromString("10")).toBe(10_000_000n);
  });

  it("round-trips against usdcStringFromRaw", () => {
    for (const raw of [0n, 1n, 1_234_567n, 9_007_199_254_740_993_000_000n]) {
      expect(usdcRawFromString(usdcStringFromRaw(raw))).toBe(raw);
    }
  });

  it("refuses anything that is not a USDC decimal amount", () => {
    for (const bad of ["", "abc", "-1.0", "1.2345678", "1e6", "1,000"]) {
      expect(() => usdcRawFromString(bad), bad).toThrow(/Not a USDC decimal amount/);
    }
  });
});
