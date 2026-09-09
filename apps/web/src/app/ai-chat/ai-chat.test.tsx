import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stoneTheme } from "@/themes/stone/stone.js";
import { expectNoAxeViolations } from "@/test-support/axe";
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

  it("hydrates saved messages from localStorage on mount", async () => {
    const savedMessages = [
      {
        id: "persisted-operator-1",
        role: "operator",
        text: "Please recall memory for Alpha",
        complete: true,
        citations: [],
      },
      {
        id: "persisted-agent-1",
        role: "agent",
        text: "Alpha Research has 98% reliability score.",
        complete: true,
        citations: [],
      },
    ];
    localStorage.setItem("aura:ai-chat:messages:v2", JSON.stringify(savedMessages));

    render(<AIChatPage />);
    expect(await screen.findByText("Please recall memory for Alpha")).toBeInTheDocument();
    expect(await screen.findByText("Alpha Research has 98% reliability score.")).toBeInTheDocument();
    localStorage.removeItem("aura:ai-chat:messages:v2");
  });

  it("renders MissionCard when mission_create is present in message tool calls", async () => {
    const savedWithMission = [
      {
        id: "op-1",
        role: "operator",
        text: "Create a mission to audit pool liquidity",
        complete: true,
        citations: [],
      },
      {
        id: "agent-1",
        role: "agent",
        text: "Mission created successfully.",
        complete: true,
        citations: [],
        toolCalls: [
          {
            name: "mission_create",
            args: {
              objective: "Audit pool liquidity on Base Sepolia",
              budgetUsdc: "15.00",
              source: "AGENT",
            },
            result: {
              created: true,
              runId: "run-test-abc-123",
              objective: "Audit pool liquidity on Base Sepolia",
              budgetUsdc: "15.000000",
              destination: "/runs/run-test-abc-123",
            },
          },
        ],
      },
    ];
    localStorage.setItem("aura:ai-chat:messages:v2", JSON.stringify(savedWithMission));

    render(<AIChatPage />);
    expect(await screen.findByText("Audit pool liquidity on Base Sepolia")).toBeInTheDocument();
    expect(await screen.findByText(/run-test-abc-123/)).toBeInTheDocument();
    expect(await screen.findByText("Open Mission Workspace")).toBeInTheDocument();
    localStorage.removeItem("aura:ai-chat:messages:v2");
  });

  it("renders NavigationCard without auto-redirecting when console_navigate is present", async () => {
    const savedWithNav = [
      {
        id: "op-2",
        role: "operator",
        text: "go to guardrails",
        complete: true,
        citations: [],
      },
      {
        id: "agent-2",
        role: "agent",
        text: "Here are the guardrail policies.",
        complete: true,
        citations: [],
        toolCalls: [
          {
            name: "console_navigate",
            args: { destination: "/policies" },
            result: { action: "navigate", destination: "/policies" },
          },
        ],
      },
    ];
    localStorage.setItem("aura:ai-chat:messages:v2", JSON.stringify(savedWithNav));

    render(<AIChatPage />);
    expect(await screen.findByText("Guardrails & Policies")).toBeInTheDocument();
    expect(await screen.findByText("Go to View")).toBeInTheDocument();
    localStorage.removeItem("aura:ai-chat:messages:v2");
  });

  it("resets messages and clears localStorage when New Chat button is clicked", async () => {
    const savedMessages = [
      {
        id: "temp-msg",
        role: "operator",
        text: "Temporary message before clear",
        complete: true,
        citations: [],
      },
    ];
    localStorage.setItem("aura:ai-chat:messages:v2", JSON.stringify(savedMessages));

    render(<AIChatPage />);
    expect(await screen.findByText("Temporary message before clear")).toBeInTheDocument();

    const newChatBtns = screen.getAllByRole("button", { name: /New Chat/i });
    expect(newChatBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(newChatBtns[0]!);

    expect(screen.queryByText("Temporary message before clear")).not.toBeInTheDocument();
    expect(screen.getByText(/Can you review these auth files/i)).toBeInTheDocument();
    expect(localStorage.getItem("aura:ai-chat:messages:v2")).toBeNull();
  });

  it("passes axe accessibility audits", async () => {
    const { container } = render(<AIChatPage />);
    await expectNoAxeViolations(container);
  });
});
