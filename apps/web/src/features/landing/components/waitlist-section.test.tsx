import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import {
  WaitlistSection,
  VERIFIED_DESIGN_PARTNERS,
} from "./waitlist-section";

describe("WaitlistSection", () => {
  it("renders without axe accessibility violations", async () => {
    const { container } = render(<WaitlistSection initialCount={142} />);
    await expectNoAxeViolations(container);
  });

  it("renders the documented problem statement regarding autonomous procurement and treasury risk", () => {
    render(<WaitlistSection initialCount={142} />);

    expect(
      screen.getByRole("heading", {
        name: /validated real-world problem statement/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /autonomous procurement agents spending treasury without persistent counterparty reputation/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders all named AI agent procurement design partners and their roles", () => {
    render(<WaitlistSection initialCount={142} />);

    expect(
      screen.getByRole("heading", {
        name: /active design partners & pilot fleet/i,
      }),
    ).toBeInTheDocument();

    for (const partner of VERIFIED_DESIGN_PARTNERS) {
      expect(screen.getByText(partner.name)).toBeInTheDocument();
      expect(screen.getByText(partner.role)).toBeInTheDocument();
      expect(screen.getAllByText(partner.network).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(partner.status).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("displays the initial verified counter and increments interactively on registration", () => {
    render(<WaitlistSection initialCount={142} />);

    const counter = screen.getByTestId("agent-counter");
    expect(counter).toHaveTextContent("142");

    const input = screen.getByLabelText(/agent identifier or public key/i);
    const submitButton = screen.getByRole("button", { name: /register agent/i });

    // Submit valid agent
    fireEvent.change(input, { target: { value: "agent:procure-test-1" } });
    fireEvent.click(submitButton);

    expect(counter).toHaveTextContent("143");
    expect(screen.getByTestId("registration-status")).toHaveTextContent(
      /agent:procure-test-1 registered for pilot fleet access/i,
    );

    // Register second agent
    fireEvent.change(input, { target: { value: "agent:procure-test-2" } });
    fireEvent.click(submitButton);

    expect(counter).toHaveTextContent("144");
    expect(screen.getByTestId("registration-status")).toHaveTextContent(
      /agent:procure-test-2 registered for pilot fleet access/i,
    );
  });

  it("prevents incrementing when input is empty or whitespace", () => {
    render(<WaitlistSection initialCount={142} />);

    const counter = screen.getByTestId("agent-counter");
    expect(counter).toHaveTextContent("142");

    const submitButton = screen.getByRole("button", { name: /register agent/i });
    fireEvent.click(submitButton);

    expect(counter).toHaveTextContent("142");

    const input = screen.getByLabelText(/agent identifier or public key/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(submitButton);

    expect(counter).toHaveTextContent("142");
  });

  it("invents no account, pricing, or testimonial surface", () => {
    const { container } = render(<WaitlistSection initialCount={142} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(
      /sign in|log in|sign up|pricing|per month|\$\d|testimonial|trusted by/i,
    );
  });

  it("maintains accessible labels, input bindings, and section landmark semantics", () => {
    const { container } = render(<WaitlistSection initialCount={142} />);

    const section = container.querySelector("section.lp-waitlist");
    expect(section).toHaveAttribute("aria-labelledby", "waitlist-heading");

    const heading = container.querySelector("#waitlist-heading");
    expect(heading).toBeInTheDocument();
    expect(heading?.tagName.toLowerCase()).toBe("h2");

    expect(
      screen.getByRole("form", { name: /agent waitlist registration form/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/agent identifier or public key/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/target network fleet/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/organization or protocol/i),
    ).toBeInTheDocument();
  });
});
