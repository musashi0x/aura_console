import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Counterfactual } from "@/features/console/projection/counterfactual";
import { CounterfactualView } from "./counterfactual-view";

/**
 * "Memory changed this decision" is the most persuasive line the product has,
 * and therefore the one it must never say loosely.
 */

const CHANGED: Counterfactual = {
  status: "DECISION_CHANGED",
  withMemory: [{ key: "beta", score: 91 }, { key: "alpha", score: 72 }],
  withoutMemory: [{ key: "alpha", score: 96 }, { key: "beta", score: 85 }],
  explanation: "A previous Alpha failure applied a 24 point risk penalty.",
};

const HELD: Counterfactual = {
  status: "NO_MATERIAL_CHANGE",
  withMemory: [{ key: "beta", score: 91 }],
  withoutMemory: [{ key: "beta", score: 85 }],
};

describe("the no-memory comparison", () => {
  it("claims memory changed the decision only when the winner moved", async () => {
    render(<CounterfactualView counterfactual={CHANGED} />);
    await userEvent.click(screen.getByRole("button", { name: /compare without memory/i }));

    expect(screen.getByText("Memory changed this decision.")).toBeInTheDocument();
    expect(screen.getByText(CHANGED.explanation)).toBeInTheDocument();
  });

  it("reports an unchanged recommendation as the real result it is", async () => {
    render(<CounterfactualView counterfactual={HELD} />);
    await userEvent.click(screen.getByRole("button", { name: /compare without memory/i }));

    expect(screen.getByText(/recommendation unchanged/i)).toBeInTheDocument();
    expect(screen.queryByText("Memory changed this decision.")).not.toBeInTheDocument();
  });

  it("says the comparison is simulated and authorizes nothing", async () => {
    render(<CounterfactualView counterfactual={CHANGED} />);
    await userEvent.click(screen.getByRole("button", { name: /compare without memory/i }));
    expect(screen.getByText(/re-runs nothing and authorizes nothing/i)).toBeInTheDocument();
  });

  it("renders no control at all when there is nothing to compare", () => {
    // A button that opens onto "we could not work it out" is worse than none.
    const { container } = render(
      <CounterfactualView counterfactual={{ status: "UNAVAILABLE", reason: "no scoring" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
