/**
 * USDC amounts, as strings and integers, never as floats.
 *
 * Three conversions live here because they are the whole of this module's
 * money handling, and each one is a different honesty claim about precision.
 */

export const USDC_DECIMALS = 6;

/**
 * From the SDK's `number`.
 *
 * `BudgetSetEvent.amount` and `JobFundedEvent.amount` are typed `number`, so
 * the float has already happened before we see the value. Converting once, at
 * the boundary, stops the loss compounding across every later read; it does
 * not restore precision we never received. Prefer an exact source (a job's
 * `budget` string, an `AssetToken` raw bigint) wherever one exists.
 */
export function usdcString(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`Refusing to record a non-finite USDC amount: ${amount}`);
  }
  return amount.toFixed(USDC_DECIMALS);
}

/** Raw on-chain integer to a six-decimal string, with no float in between. */
export function usdcStringFromRaw(rawAmount: bigint): string {
  const negative = rawAmount < 0n;
  const digits = (negative ? -rawAmount : rawAmount).toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = digits.slice(0, -USDC_DECIMALS);
  const fraction = digits.slice(-USDC_DECIMALS);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Decimal string to raw on-chain integer, by integer arithmetic only.
 *
 * `Number(amount) * 1e6` would put the value through a double on the way to
 * the chain, which is the one place this repository's string rule is actually
 * protecting something: the SDK's own `AssetToken.usdc` takes a `number`, so
 * the exact path is to build the bigint here and use `usdcFromRaw`.
 */
export function usdcRawFromString(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) {
    throw new Error(`Not a USDC decimal amount: ${amount}`);
  }
  const [, whole = "0", fraction = ""] = match;
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
}
