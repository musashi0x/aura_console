/**
 * Reading a card's facts out of an event payload.
 *
 * Every accessor is named and typed. Nothing here spreads a payload into a
 * view: a spread would put whatever a later producer adds in front of the
 * operator without anyone reviewing it, and this is the layer where an
 * unreviewed field would become a claim about money.
 *
 * A missing value is null, never a default. `0` is a number an event reported;
 * `null` is one it did not, and the two must not render the same.
 */
export type Payload = Record<string, unknown> | undefined;

export function text(data: Payload, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function number(data: Payload, key: string): number | null {
  const value = data?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Money stays a string all the way to the screen.
 *
 * The event reports an amount; the Console never parses it into a float and
 * never adds anything up. A rounding error here is a wrong number about
 * someone's money.
 */
export function amount(data: Payload, key: string): string | null {
  const value = data?.[key];
  if (typeof value === "string" && value.length > 0) return value;
  // A number is accepted but not reformatted: it is rendered as the producer
  // wrote it, so nothing is invented in the conversion.
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function list(data: Payload, key: string): string[] {
  const value = data?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}
