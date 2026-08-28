import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

import { ConsoleShell } from "./console-shell";
import {
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleLoadingState,
  ConsoleTransportLabel,
  ConsoleUnavailableMemory,
} from "./console-states";

const shell = (readiness: "ready" | "degraded" | "checking" = "ready") =>
  render(
    <ConsoleShell surface="Runs" readiness={readiness}>
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

  it("keeps secondary destinations out of the primary list", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Console" });
    const [primary] = within(nav).getAllByRole("list");
    for (const label of ["Example Run", "Readiness", "Back to landing"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
      expect(within(primary!).queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("offers a way back to the landing page", () => {
    shell();
    expect(screen.getByRole("link", { name: "Back to landing" })).toHaveAttribute("href", "/");
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
    expect(screen.getByText("run_42")).toBeInTheDocument();
  });
});

describe("state surfaces", () => {
  it("explains what a Run is instead of only saying there are none", () => {
    const { container } = render(<ConsoleEmptyState exampleAvailable createAvailable={false} />);
    expect(screen.getByText(/one economic objective from start to finish/i)).toBeInTheDocument();
    // No endpoint was queried, so a verified empty list may not be claimed.
    expect(container.textContent).not.toMatch(/no runs yet|you have no runs|0 runs/i);
  });

  it("offers only destinations that exist", () => {
    render(<ConsoleEmptyState exampleAvailable createAvailable={false} />);
    expect(screen.getByRole("link", { name: /open example run/i })).toHaveAttribute(
      "href",
      "/runs/example",
    );
    // The create destination is not real, so it is labelled, not linked.
    expect(screen.queryByRole("link", { name: /start a new run/i })).not.toBeInTheDocument();
    expect(screen.getByText(/start a new run · not yet available/i)).toBeInTheDocument();
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

  const mobileBlock = () => {
    const start = css.lastIndexOf("@media (max-width: 47.99rem)");
    return css.slice(start, css.indexOf("\n}\n", css.indexOf(".cs__surface", start)));
  };

  it("collapses the shell to a single column on narrow viewports", () => {
    expect(mobileBlock()).toMatch(/\.cs__body\s*{\s*grid-template-columns: minmax\(0, 1fr\)/);
  });

  it("scrolls navigation inside its own strip rather than the page", () => {
    // overflow-x on the nav keeps a long destination list from widening the body.
    expect(mobileBlock()).toMatch(/\.cs__nav\s*{[^}]*overflow-x: auto/);
  });

  it("disables shell transitions under reduced motion", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) {\s*\*,\s*\*::before,\s*\*::after {[^}]*transition-duration: 0\.01ms !important/,
    );
  });
});
