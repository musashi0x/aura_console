import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

import { writeProgress } from "../acknowledgement";
import { OnboardingFlow } from "./onboarding-flow";

const health = vi.fn();
const dbHealth = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: { health: () => health(), dbHealth: () => dbHealth() },
}));

const ok = { ok: true as const, data: { status: "ok", latencyMs: 1.2, uptime: 5, timestamp: "" } };
const down = { ok: false as const, error: { code: "unreachable", message: "no" } };

beforeEach(() => {
  health.mockReset().mockResolvedValue(ok);
  dbHealth.mockReset().mockResolvedValue(ok);
});

const setup = () => userEvent.setup();
const toReadiness = (user: ReturnType<typeof setup>) =>
  user.click(screen.getByRole("button", { name: /check readiness/i }));
const toDisclosure = async (user: ReturnType<typeof setup>) => {
  await toReadiness(user);
  await user.click(screen.getByRole("button", { name: /^continue$/i }));
};

describe("first visit", () => {
  it("starts at welcome and says there is no sign-in", () => {
    render(<OnboardingFlow />);
    expect(screen.getByRole("heading", { name: "Aura Console" })).toBeInTheDocument();
    expect(screen.getByText(/there is no sign-in/i)).toBeInTheDocument();
  });

  it("reports every dependency, verified or not", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await toReadiness(user);
    await waitFor(() => expect(screen.getAllByText("Ready")).toHaveLength(2));
    expect(screen.getAllByText("Not checked")).toHaveLength(2);
  });

  it("never renders a dependency as ready without a successful response", async () => {
    dbHealth.mockResolvedValue(down);
    const user = setup();
    render(<OnboardingFlow />);
    await toReadiness(user);
    await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
    expect(screen.getAllByText("Ready")).toHaveLength(1);
    expect(screen.getByText(/cannot reach Postgres/i)).toBeInTheDocument();
  });
});

describe("failure and retry", () => {
  it("retries only the failed check", async () => {
    dbHealth.mockResolvedValueOnce(down).mockResolvedValue(ok);
    const user = setup();
    render(<OnboardingFlow />);
    await toReadiness(user);
    await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
    expect(health).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /retry database/i }));
    await waitFor(() => expect(screen.getAllByText("Ready")).toHaveLength(2));
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("lets the operator continue even when a dependency is unavailable", async () => {
    health.mockResolvedValue(down);
    dbHealth.mockResolvedValue(down);
    const user = setup();
    render(<OnboardingFlow />);
    await toReadiness(user);
    await waitFor(() => expect(screen.getAllByText("Unavailable")).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByRole("heading", { name: /what aura stores/i })).toBeInTheDocument();
  });
});

describe("acknowledgement", () => {
  it("gates completion until the operator acknowledges", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await toDisclosure(user);
    expect(screen.getByRole("button", { name: /start using aura/i })).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    // Ticking unlocks the action; it must not skip the step by itself.
    expect(screen.getByRole("heading", { name: /what aura stores/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /start using aura/i }));
    expect(screen.getByRole("heading", { name: /you are set up/i })).toBeInTheDocument();
  });

  it("calls it an acknowledgement and says it is browser-local", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await toDisclosure(user);
    expect(screen.getByText(/stored in this browser only/i)).toBeInTheDocument();
    expect(screen.getByText(/not a legal consent record/i)).toBeInTheDocument();
  });

  it("can be withdrawn without breaking the flow", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await toDisclosure(user);
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /start using aura/i })).toBeEnabled();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /start using aura/i })).toBeDisabled();
  });
});

describe("skip and resume", () => {
  it("skips from the first step", async () => {
    const onSkip = vi.fn();
    const user = setup();
    render(<OnboardingFlow onSkip={onSkip} />);
    await user.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("resumes at the step the operator left", async () => {
    writeProgress({ step: "disclosure", acknowledgedAt: null, skippedAt: "2026-08-28T00:00:00Z" });
    render(<OnboardingFlow />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /what aura stores/i })).toBeInTheDocument(),
    );
  });

  it("sends a returning acknowledged operator straight to the end", async () => {
    writeProgress({ step: "complete", acknowledgedAt: "2026-08-28T00:00:00Z", skippedAt: null });
    render(<OnboardingFlow />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /you are set up/i })).toBeInTheDocument(),
    );
  });

  it("hands off to a Run or the labelled example", async () => {
    const onFinish = vi.fn();
    writeProgress({ step: "complete", acknowledgedAt: "2026-08-28T00:00:00Z", skippedAt: null });
    const user = setup();
    render(<OnboardingFlow onFinish={onFinish} />);
    await waitFor(() => screen.getByRole("button", { name: /start a run/i }));
    await user.click(screen.getByRole("button", { name: /view example run/i }));
    expect(onFinish).toHaveBeenCalledWith("example");
    expect(screen.getByText(/not live commerce/i)).toBeInTheDocument();
  });
});

describe("invariants", () => {
  it("offers no spend, execution, or private memory surface in the flow", async () => {
    const user = setup();
    const { container } = render(<OnboardingFlow />);
    for (const step of [0, 1, 2]) {
      if (step === 1) await toReadiness(user);
      if (step === 2) await user.click(screen.getByRole("button", { name: /^continue$/i }));
      const labels = screen.getAllByRole("button").map((b) => b.textContent ?? "").join(" ");
      expect(labels).not.toMatch(/approve|fund|pay|execute|spend|authorize/i);
      expect(container.textContent ?? "").not.toMatch(/0x[0-9a-f]{6}/i);
    }
  });

  it("states that unavailable memory never becomes automatic approval", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await toDisclosure(user);
    expect(screen.getByText(/never runs the action automatically/i)).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no axe violations on any step", async () => {
    const user = setup();
    const { container } = render(<OnboardingFlow />);
    await expectNoAxeViolations(container);
    await toReadiness(user);
    await waitFor(() => expect(screen.getAllByText("Ready")).toHaveLength(2));
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    await expectNoAxeViolations(container);
  });

  it("moves focus to the step heading so keyboard users are not stranded", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await toReadiness(user);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /what is ready/i })).toHaveFocus(),
    );
  });

  it("is operable by keyboard alone", async () => {
    const user = setup();
    render(<OnboardingFlow />);
    await user.tab();
    expect(screen.getByRole("button", { name: /check readiness/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /what is ready/i })).toBeInTheDocument(),
    );
  });

  it("marks the current step for assistive technology", () => {
    render(<OnboardingFlow />);
    expect(screen.getByText("Welcome")).toHaveAttribute("aria-current", "step");
  });
});
