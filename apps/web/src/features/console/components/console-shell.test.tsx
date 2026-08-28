import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

import { ConsoleShell } from "./console-shell";
import { DataUnavailable } from "./data-unavailable";

const shell = (ready = true) =>
  render(
    <ConsoleShell surface="Runs" ready={ready}>
      <h1>Runs</h1>
    </ConsoleShell>,
  );

describe("navigation", () => {
  it("offers the three product destinations", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Console" });
    for (const label of ["Runs", "Counterparties", "Policies"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("keeps System as a secondary destination outside the main list", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Console" });
    const list = within(nav).getByRole("list");
    expect(within(nav).getByRole("link", { name: "System" })).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: "System" })).not.toBeInTheDocument();
  });

  it("marks the current surface for assistive technology", () => {
    shell();
    expect(screen.getByRole("link", { name: "Runs" })).toHaveAttribute("aria-current", "page");
  });
});

describe("product boundaries", () => {
  it("offers no account, workspace, or billing surface", () => {
    const { container } = shell();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(
      /sign in|log in|sign out|account|profile|workspace|organi[sz]ation|team|billing|upgrade|plan/i,
    );
  });

  it("declares the environment as non-mainnet", () => {
    shell();
    expect(screen.getByText("NON-MAINNET")).toBeInTheDocument();
  });

  it("reports readiness from the real check rather than asserting it", () => {
    const { rerender } = shell(true);
    expect(screen.getByText("SYSTEM READY")).toBeInTheDocument();
    rerender(
      <ConsoleShell surface="Runs" ready={false}>
        <h1>Runs</h1>
      </ConsoleShell>,
    );
    expect(screen.queryByText("SYSTEM READY")).not.toBeInTheDocument();
    expect(screen.getByText("SYSTEM DEGRADED")).toBeInTheDocument();
  });
});

describe("unavailable data", () => {
  it("says nothing was queried rather than claiming an empty result", () => {
    render(
      <DataUnavailable
        title="No Runs endpoint yet"
        body="Aura cannot list Runs because the run skeleton is not implemented."
        owner="task #30"
      />,
    );
    expect(screen.getByText("No Runs endpoint yet")).toBeInTheDocument();
    expect(screen.getByText("task #30")).toBeInTheDocument();
    // "No runs yet" would assert a verified empty list that was never fetched.
    expect(screen.queryByText(/no runs yet/i)).not.toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = shell();
    await expectNoAxeViolations(container);
  });

  it("exposes a main landmark and a labelled nav", () => {
    shell();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Console" })).toBeInTheDocument();
  });
});
