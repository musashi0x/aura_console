import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";

import { ConsoleShell } from "../components/console-shell";
import {
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleLoadingState,
  ConsoleTransportLabel,
  ConsoleUnavailableMemory,
} from "../components/console-states";

const shell = (
  readiness: "ready" | "degraded" | "checking" = "ready",
  surface = "Missions",
) =>
  render(
    <ConsoleShell surface={surface} readiness={readiness}>
      <h1>{surface}</h1>
    </ConsoleShell>,
  );

describe("navigation", () => {
  it("offers the operator's five destinations", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Console" });
    // Missions, Agents, Network, Guardrails, Docs. These are the operator's
    // words for the same routes; `Run` stays the system word in the event
    // stream and is not renamed to change a label on screen.
    for (const label of ["Missions", "Agents", "Network", "Guardrails", "Docs"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("is one group, with no Chat destination and no Reference shelf", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Console" });
    // A rail item called Chat implies a place to go and talk to an assistant
    // that is not doing the work: conversation is a mode inside a Mission.
    // Example Run, Readiness and Back to landing left with it — the example
    // Mission belongs in Missions, readiness belongs to Network and its status
    // chip, and the landing page is reachable from the brand mark.
    for (const gone of ["Chat", "Example Run", "Readiness", "Back to landing"]) {
      expect(within(nav).queryByRole("link", { name: gone })).not.toBeInTheDocument();
    }
  });

  it("marks the current surface for assistive technology", () => {
    shell("ready", "Missions");
    expect(screen.getByRole("link", { name: "Missions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
    const { rerender } = shell("ready");
    expect(screen.getByText("SYSTEM READY")).toBeInTheDocument();
    rerender(
      <ConsoleShell surface="Runs" readiness="degraded">
        <h1>Runs</h1>
      </ConsoleShell>,
    );
    expect(screen.queryByText("SYSTEM READY")).not.toBeInTheDocument();
    expect(screen.getByText("SYSTEM DEGRADED")).toBeInTheDocument();
  });

  it("never borrows READY while a check is still running", () => {
    shell("checking");
    expect(screen.getByText("CHECKING")).toBeInTheDocument();
    expect(screen.queryByText("SYSTEM READY")).not.toBeInTheDocument();
  });

  it("shows a Run reference only when one is selected", () => {
    const { rerender } = shell();
    expect(screen.queryByText("run_42")).not.toBeInTheDocument();
    rerender(
      <ConsoleShell surface="Runs" readiness="ready" runRef="run_42">
        <h1>Runs</h1>
      </ConsoleShell>,
    );
    // Two places name it now, and both should: the context bar says which Run
    // the surface is about, and the chat says which Run it is scoped to. A
    // chat scoped to a different Run than the page would be the bug worth
    // catching here, so assert they agree rather than that only one exists.
    const shown = screen.getAllByText("run_42");
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector(".cs__run-ref")).toHaveTextContent("run_42");
    expect(screen.getByRole("complementary", { name: "Agent chat" })).toHaveTextContent(
      "run_42",
    );
  });
});

describe("state surfaces", () => {
  it("explains what a Mission is instead of only saying there are none", () => {
    const { container } = render(<ConsoleEmptyState exampleAvailable createAvailable />);
    expect(screen.getByText(/one economic objective from start to finish/i)).toBeInTheDocument();
    // This surface renders only after the API answered with an empty list, so
    // it may say there are none. What it must not do is borrow the error
    // state's claim: "we could not look" belongs to the branch that knows it.
    expect(container.textContent).not.toMatch(/cannot be listed|could not be read/i);
  });

  it("offers only destinations that exist", () => {
    const { rerender } = render(<ConsoleEmptyState exampleAvailable createAvailable />);
    expect(screen.getByRole("link", { name: /open the demo mission/i })).toHaveAttribute(
      "href",
      "/runs/example",
    );
    expect(screen.getByRole("link", { name: /start a mission/i })).toHaveAttribute(
      "href",
      "/runs/new",
    );

    // The flags still govern it. A destination that does not exist is labelled
    // rather than linked, so the control never opens nothing.
    rerender(<ConsoleEmptyState exampleAvailable={false} createAvailable={false} />);
    expect(screen.queryByRole("link", { name: /start a mission/i })).not.toBeInTheDocument();
    expect(screen.getByText(/start a mission · not yet available/i)).toBeInTheDocument();
  });

  it("loads without inventing a status value", () => {
    const { container } = render(<ConsoleLoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent(/checking readiness/i);
    expect(container.textContent).not.toMatch(/ready|healthy|ok\b/i);
  });

  it("names the failed dependency, the consequence, and a retry", () => {
    render(
      <ConsoleErrorState domain="Event store" detail="Postgres is unreachable." retryHref="/runs" />,
    );
    expect(screen.getByText("Event store")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM DEGRADED")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retry/i })).toHaveAttribute("href", "/runs");
  });

  it("states unavailable memory without inventing history", () => {
    const { container } = render(<ConsoleUnavailableMemory />);
    expect(screen.getByText("MEMORY UNAVAILABLE")).toBeInTheDocument();
    expect(screen.getByText(/no historical conclusion was inferred/i)).toBeInTheDocument();
    // No provider, amount, or outcome may appear in place of missing memory.
    expect(container.textContent).not.toMatch(/USDC|selected|succeeded|failed \d/i);
  });

  it("keeps live, paused and history distinct", () => {
    const { rerender } = render(<ConsoleTransportLabel mode="LIVE" />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    rerender(<ConsoleTransportLabel mode="PAUSED" />);
    expect(screen.getByText("PAUSED")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    rerender(<ConsoleTransportLabel mode="HISTORY" atTime="2026-08-29T10:00:04Z" />);
    // History always carries its timestamp so it cannot read as current.
    expect(screen.getByText(/HISTORY · 2026-08-29T10:00:04Z/)).toBeInTheDocument();
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

describe("responsive and motion rules", () => {
  const css = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../app/globals.css"),
    "utf8",
  );

  /* The single-column collapse and the scrolling nav strip were rules this file
     used to assert. AppShell owns both now, so the assertions went with the
     CSS: what remains here is the motion rule this repo still writes. */

  it("disables shell transitions under reduced motion", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) {\s*\*,\s*\*::before,\s*\*::after {[^}]*transition-duration: 0\.01ms !important/,
    );
  });
});
