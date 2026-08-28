import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeProgress } from "../acknowledgement";
import { FirstRunGate } from "./first-run-gate";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
});

describe("first visit", () => {
  it("sends a genuinely first-time operator to onboarding", async () => {
    render(<FirstRunGate />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("says what it is doing rather than showing a blank page", async () => {
    render(<FirstRunGate />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/opening onboarding/i));
  });
});

describe("after skipping", () => {
  beforeEach(() => {
    writeProgress({ step: "readiness", acknowledgedAt: null, skippedAt: "2026-08-28T00:00:00Z" });
  });

  it("does not redirect again, so the operator cannot be trapped in a loop", async () => {
    render(<FirstRunGate />);
    await waitFor(() => expect(screen.getByRole("complementary")).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers onboarding as a banner instead", async () => {
    render(<FirstRunGate />);
    expect(await screen.findByRole("link", { name: /open onboarding/i })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("can be dismissed for the session", async () => {
    const user = userEvent.setup();
    render(<FirstRunGate />);
    await user.click(await screen.findByRole("button", { name: /not now/i }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("after acknowledging", () => {
  it("renders nothing and never redirects", async () => {
    writeProgress({ step: "complete", acknowledgedAt: "2026-08-28T00:00:00Z", skippedAt: null });
    const { container } = render(<FirstRunGate />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(replace).not.toHaveBeenCalled();
  });
});
