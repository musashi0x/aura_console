import { describe, expect, it } from "vitest";

import { evaluatorOptions, NO_EVALUATOR_ADDRESS, parseCreateJobArgs } from "./create-job.js";

const provider = "0x1111111111111111111111111111111111111111";

describe("parseCreateJobArgs", () => {
  it("reads an offering, a provider and a JSON requirement", () => {
    expect(parseCreateJobArgs([" Meme Generation", provider, '{"prompt":"a cat"}'])).toEqual({
      offeringName: " Meme Generation",
      providerAddress: provider,
      requirement: { prompt: "a cat" },
    });
  });

  it.each([[[]], [["only-offering"]], [["offering", provider]]])(
    "refuses an incomplete invocation %p",
    (argv) => {
      expect(() => parseCreateJobArgs(argv)).toThrow(/Missing argument/);
    },
  );

  it("refuses a provider address that is not an address", () => {
    expect(() => parseCreateJobArgs(["offering", "provider", "{}"])).toThrow(/20-byte address/);
  });

  it("refuses a requirement that is not a JSON object", () => {
    expect(() => parseCreateJobArgs(["offering", provider, "not json"])).toThrow(/valid JSON/);
    expect(() => parseCreateJobArgs(["offering", provider, "[1,2]"])).toThrow(/JSON object/);
  });
});

describe("evaluatorOptions", () => {
  it("passes an explicit evaluator through", () => {
    expect(evaluatorOptions(provider)).toEqual({ evaluatorAddress: provider });
  });

  it("refuses the no-evaluator sentinel, in any casing", () => {
    expect(() => evaluatorOptions(NO_EVALUATOR_ADDRESS)).toThrow(/releases escrow/);
    expect(() => evaluatorOptions(NO_EVALUATOR_ADDRESS.toUpperCase().replace("0X", "0x"))).toThrow(
      /releases escrow/,
    );
  });

  it("refuses an empty or malformed evaluator rather than defaulting", () => {
    expect(() => evaluatorOptions("")).toThrow(/20-byte address/);
    expect(() => evaluatorOptions("0xabc")).toThrow(/20-byte address/);
  });
});
