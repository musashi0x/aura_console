import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stoneTheme } from "@/themes/stone/stone.js";
import { expectNoAxeViolations } from "@/test/axe";
import AIChatPage from "./page";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3000",
  },
}));

describe("AIChatPage — Stone Theme & Conversational Workspace", () => {
  beforeAll(() => {
    if (typeof HTMLDialogElement !== "undefined") {
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      });
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      });
    }
  });

  it("renders with Stone theme active in dark mode", () => {
    const { container } = render(<AIChatPage />);
    const themedRoot = container.querySelector("[data-astryx-theme]");
    expect(themedRoot).toBeInTheDocument();
    expect(themedRoot?.getAttribute("data-astryx-theme")).toBe(stoneTheme.name);
    expect(themedRoot?.getAttribute("data-theme")).toBe("dark");
  });

  it("renders topbar and navigation with Chat Console label", () => {
    render(<AIChatPage />);
    expect(screen.getAllByText("Chat Console").length).toBeGreaterThanOrEqual(1);
  });

  it("renders initial demo messages, tool calls, and artifact card", () => {
    render(<AIChatPage />);
    expect(screen.getByText(/Can you review these auth files/i)).toBeInTheDocument();
    expect(screen.getByText(/Found the issue/i)).toBeInTheDocument();
    expect(screen.getAllByText("read").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("JWT Token Refresh: Design & Rollout").length).toBeGreaterThanOrEqual(1);
  });

  it("toggles the artifact panel when close and card open are clicked", () => {
    render(<AIChatPage />);
    expect(screen.getByRole("heading", { level: 1, name: "JWT Token Refresh: Design & Rollout" })).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close document" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("heading", { level: 1, name: "JWT Token Refresh: Design & Rollout" })).not.toBeInTheDocument();

    const openCard = screen.getByRole("button", { name: /Open JWT Token Refresh: Design & Rollout/i });
    fireEvent.click(openCard);
    expect(screen.getByRole("heading", { level: 1, name: "JWT Token Refresh: Design & Rollout" })).toBeInTheDocument();
  });

  it("contains no cyan or electric blue in inline CSS", () => {
    const { container } = render(<AIChatPage />);
    const styleTags = container.querySelectorAll("style");
    let allCss = "";
    styleTags.forEach((s) => {
      allCss += s.textContent || "";
    });

    expect(allCss).not.toContain("#48d7ff");
    expect(allCss).not.toContain("rgba(72, 215, 255");
    expect(allCss).toContain("var(--color-accent)");
    expect(allCss).toContain("var(--color-canvas)");
    expect(allCss).toContain("var(--color-surface)");
  });

  it("passes axe accessibility audits", async () => {
    const { container } = render(<AIChatPage />);
    await expectNoAxeViolations(container);
  });
});
