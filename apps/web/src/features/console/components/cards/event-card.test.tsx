import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";

import { console_ } from "@/features/console/copy";
import type { TimelineEntry } from "@/features/console/model/types";
import { EventCard } from "./event-card";

const entry = (type: string, data?: Record<string, unknown>): TimelineEntry => ({
  eventId: "evt_1",
  sequence: 1,
  type,
  eventTime: "2026-09-01T09:00:00Z",
  stage: null,
  support: "SUPPORTED",
  summary: "a summary",
  data,
});

/**
 * A card is a projection, never a message. These hold the line that carries the
 * Console's guarantees into a conversational surface: if a card could render a
 * value the stream does not contain, every one of them would leave through it.
 */
describe("event cards render only what the event carries", () => {
  it("shows a decision's choice and reasons from the event", () => {
    render(
      <EventCard
        entry={entry("decision.made", {
          counterparty_key: "beta_labs",
          authorization_mode: "OPERATOR_APPROVAL",
          reasons: ["Two prior settlements, both accepted."],
        })}
      />,
    );
    expect(screen.getByText("beta_labs")).toBeInTheDocument();
    expect(screen.getByText("OPERATOR_APPROVAL")).toBeInTheDocument();
    expect(screen.getByText("Two prior settlements, both accepted.")).toBeInTheDocument();
  });

  it("omits a field the event did not report rather than showing a blank", () => {
    const { container } = render(<EventCard entry={entry("decision.made")} />);
    // "Chose —" invites the reader to wonder what was chosen and hidden, when
    // the truth is that the event never said.
    expect(container.textContent).not.toMatch(/Chose/);
    expect(container.textContent).not.toMatch(/Authorization/);
  });

  it("never draws a policy gate as passing when no result was reported", () => {
    const { container } = render(<EventCard entry={entry("policy.evaluated", { rule: "v4" })} />);
    expect(container.textContent).not.toMatch(/PASSED|FAILED/);
  });

  it("draws a failed gate as failed rather than hiding it behind a summary", () => {
    render(<EventCard entry={entry("policy.evaluated", { rule: "v4", passed: false })} />);
    expect(screen.getByText(console_.cards.policy.failed)).toBeInTheDocument();
  });

  it("reports an outcome failure only because the event named one", () => {
    const { container } = render(<EventCard entry={entry("outcome.recorded", { result: "DELIVERED" })} />);
    expect(container.textContent).not.toMatch(/Failure/);

    render(
      <EventCard entry={entry("outcome.recorded", { failure_reason: "Rejected on acceptance" })} />,
    );
    expect(screen.getByText("Rejected on acceptance")).toBeInTheDocument();
  });

  it("keeps money as the string the event reported", () => {
    render(<EventCard entry={entry("acp.job.funded", { amount_usdc: "18.500000" })} />);
    // Never parsed into a float and never re-formatted: a rounding error here
    // is a wrong number about someone's money.
    expect(screen.getByText("18.500000")).toBeInTheDocument();
  });

  it("says what memory retrieval reported, and never that memory changed a decision", () => {
    const { container } = render(
      <EventCard entry={entry("memory.retrieved", { retrieval_status: "NO_HISTORY" })} />,
    );
    expect(screen.getByText(console_.cards.memory.status.NO_HISTORY)).toBeInTheDocument();
    // That line is a claim about a counterfactual the Console has not run.
    expect(container.textContent).not.toMatch(/memory changed this decision/i);
  });

  it("keeps NO_HISTORY and ERROR apart", () => {
    const { container: noHistory } = render(
      <EventCard entry={entry("memory.retrieved", { retrieval_status: "NO_HISTORY" })} />,
    );
    const { container: error } = render(
      <EventCard entry={entry("memory.retrieved", { retrieval_status: "ERROR" })} />,
    );
    expect(noHistory.textContent).not.toEqual(error.textContent);
    expect(error.textContent).toMatch(/unavailable/i);
  });

  it("approves nothing, and says so", () => {
    render(<EventCard entry={entry("approval.granted", { ceiling_usdc: "25.000000" })} />);
    expect(screen.getByText(console_.cards.approval.note)).toBeInTheDocument();
    // The only path to an economic action is an operator's own click. This
    // card reports one that already happened; it offers no control.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an unrecognised type as recorded rather than dropping or paraphrasing it", () => {
    render(
      <EventCard entry={{ ...entry("something.new"), support: "UNSUPPORTED_TYPE" }} />,
    );
    expect(screen.getByText("a summary")).toBeInTheDocument();
    expect(screen.getByText(console_.cards.raw.note)).toBeInTheDocument();
  });

  it("does not tell the operator a lifecycle event is missing a card", () => {
    // A lifecycle event has no stage in the decision story but is fully
    // understood — it is what moves the Run's status. Saying no card reads it
    // implies a gap that is not there.
    const { container } = render(<EventCard entry={entry("run.created")} />);
    expect(screen.getByText("a summary")).toBeInTheDocument();
    expect(container.textContent).not.toContain(console_.cards.raw.note);
  });

  it("renders ACP deliverable with evaluation controls for acp.job.submitted", () => {
    render(
      <EventCard
        entry={entry("acp.job.submitted", {
          provider: "0xProvider12345678901234567890123456789012",
          deliverable: "Model evaluation report artifact",
          deliverable_hash: "0x1234567890abcdef1234567890abcdef",
        })}
        runId="run-1"
      />,
    );
    expect(screen.getByText("ACP Deliverable")).toBeInTheDocument();
    expect(screen.getByText("Model evaluation report artifact")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("renders ACP job linked card with run and job details", () => {
    render(
      <EventCard
        entry={entry("acp.job.linked", {
          run_id: "acp-run-1234",
          job_id: "42",
          chain_id: 84532,
        })}
      />,
    );
    expect(screen.getByText("ACP Job Linked")).toBeInTheDocument();
    expect(screen.getByText("acp-run-1234")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders memory.commitment.confirmed as a Transaction card with BaseScan link and 0 axe violations", async () => {
    const txHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const commitmentHash = "0xb5217aa33d16ae634d94c72d6305bde3aaab252ac4d33e33f992fd99771b20e6";
    const { container } = render(
      <EventCard
        entry={entry("memory.commitment.confirmed", {
          summary: "Memory v1 committed to Base Sepolia",
          counterparty_key: "virtuals:agent:beta",
          memory_version: 1,
          network: "Base Sepolia",
          tx_hash: txHash,
          commitment: commitmentHash,
          explorer_url: `https://sepolia.basescan.org/tx/${txHash}`,
        })}
      />,
    );

    expect(screen.getByText(console_.cards.transaction.title)).toBeInTheDocument();
    expect(
      screen.getByText("Salted memory commitment published and confirmed on Base Sepolia."),
    ).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText(commitmentHash)).toBeInTheDocument();
    expect(screen.getByText("Base Sepolia")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    const basescanLinks = links.filter((l) =>
      l.getAttribute("href")?.includes(`sepolia.basescan.org/tx/${txHash}`),
    );
    expect(basescanLinks.length).toBeGreaterThanOrEqual(1);

    await expectNoAxeViolations(container);
  });

  it("renders memory.commitment.submitted as a Transaction card with BaseScan link and 0 axe violations", async () => {
    const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const { container } = render(
      <EventCard
        entry={entry("memory.commitment.submitted", {
          summary: "Memory v2 commitment submitted to Base Sepolia",
          counterparty_key: "virtuals:agent:beta",
          memory_version: 2,
          tx_hash: txHash,
        })}
      />,
    );

    expect(screen.getByText(console_.cards.transaction.title)).toBeInTheDocument();
    expect(
      screen.getByText("Salted memory commitment submitted to Base Sepolia."),
    ).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    const basescanLinks = links.filter((l) =>
      l.getAttribute("href")?.includes(`sepolia.basescan.org/tx/${txHash}`),
    );
    expect(basescanLinks.length).toBeGreaterThanOrEqual(1);

    await expectNoAxeViolations(container);
  });

  it("disclaims simulated transactions and does not link to fake BaseScan URLs", async () => {
    const fakeTx = "0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd";
    const { container } = render(
      <EventCard
        entry={entry("commitment.settled", {
          summary: "Payment approved (simulated settlement)",
          network: "base-sepolia",
          amount_usdc: "12.000000",
          counterparty_key: "virtuals:agent:beta",
          tx_hash: fakeTx,
          reference: fakeTx,
          simulated: true,
        })}
      />,
    );

    expect(screen.getByText("Payment Approved (Simulated)")).toBeInTheDocument();
    expect(
      screen.getByText("Payment approved (simulated settlement; no live funds moved)."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tx (Simulated)")).toBeInTheDocument();
    expect(screen.getByText("Simulated Settlement (No live Base Tx)")).toBeInTheDocument();

    const links = screen.queryAllByRole("link");
    const basescanLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("sepolia.basescan.org"),
    );
    expect(basescanLinks.length).toBe(0);

    await expectNoAxeViolations(container);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <EventCard entry={entry("decision.made", { counterparty_key: "beta_labs" })} />,
    );
    await expectNoAxeViolations(container);
  });
});

