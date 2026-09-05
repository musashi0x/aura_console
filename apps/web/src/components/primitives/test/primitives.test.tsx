import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";

import { Button, EmptyState, MonoRef, Panel, StatusBadge } from "..";
import type { StatusTone } from "../status-badge";

const TONES: StatusTone[] = ["neutral", "ready", "pending", "warning", "error"];

describe("StatusBadge", () => {
  it.each(TONES)("carries a glyph as well as a colour for %s", (tone) => {
    const { container } = render(<StatusBadge tone={tone}>{tone}</StatusBadge>);
    const glyph = container.querySelector(".status-badge__glyph");
    // Without this, the tone is colour-only and unreadable for many operators.
    expect(glyph?.textContent?.trim()).not.toBe("");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the readable label out of the decorative glyph", () => {
    render(<StatusBadge tone="ready">Ready</StatusBadge>);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("exposes the tone for styling without encoding meaning in class order", () => {
    const { container } = render(<StatusBadge tone="error">Unavailable</StatusBadge>);
    expect(container.querySelector(".status-badge")).toHaveAttribute("data-tone", "error");
  });
});

describe("MonoRef", () => {
  it("renders the value in a code element so identifiers are selectable", () => {
    const { container } = render(<MonoRef label="Run">run_42</MonoRef>);
    expect(container.querySelector("code")).toHaveTextContent("run_42");
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("works without a label", () => {
    const { container } = render(<MonoRef>evt_01</MonoRef>);
    expect(container.querySelector(".mono-ref__label")).toBeNull();
  });
});

describe("Panel", () => {
  it("renders a heading when given a title", () => {
    render(<Panel title="Readiness">body</Panel>);
    expect(screen.getByRole("heading", { name: "Readiness" })).toBeInTheDocument();
  });

  it("omits the header entirely when there is nothing to put in it", () => {
    const { container } = render(<Panel>body</Panel>);
    expect(container.querySelector(".panel__head")).toBeNull();
  });

  it("treats active as decoration, not as state", () => {
    const { container } = render(<Panel active>body</Panel>);
    const panel = container.querySelector(".panel");
    expect(panel).toHaveClass("panel--active");
    // Glow must not be the only thing telling an operator something is active.
    expect(panel).not.toHaveAttribute("aria-current");
    expect(panel).not.toHaveAttribute("role");
  });
});

describe("EmptyState", () => {
  it("names what is missing and what to do", () => {
    render(
      <EmptyState
        title="No economic runs yet"
        body="Start a run or connect an external agent."
        action={<Button variant="primary">New Run</Button>}
      />,
    );
    expect(screen.getByText("No economic runs yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Run" })).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("defaults to type button so it never submits a form by accident", () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("type", "button");
  });

  it("still allows an explicit submit", () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("merges a caller class rather than dropping it", () => {
    const { container } = render(<Button className="extra">x</Button>);
    expect(container.querySelector("button")).toHaveClass("btn", "btn--secondary", "extra");
  });
});

describe("accessibility", () => {
  it("has no axe violations across the primitive set", async () => {
    const { container } = render(
      <Panel title="Readiness" meta={<MonoRef label="Run">run_42</MonoRef>}>
        <StatusBadge tone="ready">Ready</StatusBadge>
        <StatusBadge tone="error">Unavailable</StatusBadge>
        <EmptyState title="Nothing yet" body="Start a run." action={<Button>New Run</Button>} />
      </Panel>,
    );
    await expectNoAxeViolations(container);
  });
});
