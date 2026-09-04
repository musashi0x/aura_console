import { describe, expect, it } from "vitest";

import { canonicalJson, derivedEventId, uuidV5 } from "./ids.js";

describe("canonicalJson", () => {
  it("is stable under key reordering", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("does not conflate an omitted key with a null one", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 1, b: null }));
  });
});

describe("uuidV5", () => {
  it("produces a stable version 5 uuid", () => {
    const id = uuidV5("acp");

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV5("acp")).toBe(id);
    expect(uuidV5("acp!")).not.toBe(id);
  });
});

describe("derivedEventId", () => {
  it("is a uuidv5 over the canonicalised content", () => {
    expect(derivedEventId({ b: 1, a: 2 })).toBe(uuidV5(canonicalJson({ a: 2, b: 1 })));
  });

  it("is stable under key reordering, which is the whole point", () => {
    expect(derivedEventId({ a: 1, b: { c: 2, d: 3 } })).toBe(
      derivedEventId({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });
});
