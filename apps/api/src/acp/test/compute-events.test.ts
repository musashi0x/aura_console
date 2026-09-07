import { describe, expect, it } from "vitest";

import { computeCompletedEvent, computeFailedEvent } from "../domain/events.js";

const completedAt = new Date("2026-09-07T12:00:00.000Z");

const completed = {
  model: "anthropic/claude-fable-5",
  provider: "Azure",
  finishReason: "stop",
  promptTokens: 9,
  completionTokens: 11,
  reasoningTokens: 5,
  costUsdc: "0.000360",
  completedAt,
};

describe("computeCompletedEvent", () => {
  it("records the spend and the token split", () => {
    const event = computeCompletedEvent(completed);

    expect(event.type).toBe("acp.compute.completed");
    expect(event.eventTime).toEqual(completedAt);
    expect(event.data).toMatchObject({
      model: "anthropic/claude-fable-5",
      provider: "Azure",
      finish_reason: "stop",
      reasoning_tokens: 5,
      cost_usdc: "0.000360",
    });
  });

  /**
   * The model's output is the caller's to keep. Copying it into an append-only
   * table would put text that can never be edited or redacted into history.
   */
  it("does not carry the completion text", () => {
    const event = computeCompletedEvent(completed);

    expect(event.data).not.toHaveProperty("content");
  });

  it("keeps cost a string, so no float can rewrite it", () => {
    const event = computeCompletedEvent({ ...completed, costUsdc: "0.000340" });

    expect(event.data.cost_usdc).toBe("0.000340");
  });

  /**
   * Two identical calls are two charges, not one re-delivered fact, so the id
   * cannot collapse them the way a re-delivered stream entry collapses.
   */
  it("gives two identical completions distinct ids", () => {
    const first = computeCompletedEvent(completed);
    const second = computeCompletedEvent({ ...completed, completedAt: new Date(completedAt.getTime() + 1) });

    expect(first.eventId).not.toBe(second.eventId);
  });

  it("is stable for the same completion at the same instant", () => {
    expect(computeCompletedEvent(completed).eventId).toBe(computeCompletedEvent(completed).eventId);
  });
});

describe("computeFailedEvent", () => {
  it("records why, so a billed failure is not invisible", () => {
    const event = computeFailedEvent({
      model: "anthropic-claude-fable-5",
      code: "compute_http_402",
      reason: "insufficient compute balance",
      failedAt: completedAt,
    });

    expect(event.type).toBe("acp.compute.failed");
    expect(event.data).toMatchObject({
      code: "compute_http_402",
      reason: "insufficient compute balance",
    });
  });
});
