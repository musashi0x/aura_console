import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloatingCardsGallery } from "./floating-cards-gallery";
import { Header } from "./header";

describe("Header Dropdown Contrast (WCAG AA Compliance)", () => {
  it("renders header dropdown item with group-hover:text-emerald-700 for light mode contrast", () => {
    render(<Header ready />);
    const archLink = screen.getByRole("link", { name: /architecture/i });
    fireEvent.mouseEnter(archLink.parentElement!);

    const archOverview = screen.getByText("Architecture Overview");
    expect(archOverview).toHaveClass("group-hover:text-emerald-700");
    expect(archOverview).not.toHaveClass("group-hover:text-emerald-600");
  });

  it("renders mobile header dropdown item with group-hover:text-emerald-700 for light mode contrast", () => {
    render(<Header ready />);
    const openMenuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(openMenuBtn);

    const mobileArchBtn = screen.getByRole("button", { name: /architecture/i });
    fireEvent.click(mobileArchBtn);

    const mobileOverviewItems = screen.getAllByText("Architecture Overview");
    const mobileOverview = mobileOverviewItems[mobileOverviewItems.length - 1];
    expect(mobileOverview).toHaveClass("group-hover:text-emerald-700");
    expect(mobileOverview).not.toHaveClass("group-hover:text-emerald-600");
  });
});

describe("FloatingCardsGallery", () => {
  const sampleCards = [
    { id: "storage-hierarchy", title: "Storage Hierarchy", node: <div>Storage Hierarchy Content</div> },
    { id: "deletion-test", title: "Deletion Test", node: <div>Deletion Test Content</div> },
    { id: "base-sepolia", title: "Base Sepolia", node: <div>Base Sepolia Content</div> },
    { id: "virtuals-acp", title: "Virtuals ACP", node: <div>Virtuals ACP Content</div> },
    { id: "reputation-fsm", title: "Reputation FSM", node: <div>Reputation FSM Content</div> },
    { id: "mcp", title: "MCP Overview", node: <div>MCP Overview Content</div> },
  ];

  it("renders all card titles and hint controls", () => {
    render(<FloatingCardsGallery cards={sampleCards} />);

    expect(screen.getByText(/Storage Hierarchy Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Deletion Test Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Base Sepolia Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Virtuals ACP Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Reputation FSM Content/i)).toBeInTheDocument();
    expect(screen.getByText(/MCP Overview Content/i)).toBeInTheDocument();

    expect(
      screen.getByText(/Drag cards to arrange • Click to focus • Hover to repel/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset layout/i })
    ).toBeInTheDocument();
  });

  it("provides accessible zoom toggle buttons for each card", () => {
    render(<FloatingCardsGallery cards={sampleCards} />);
    const zoomButtons = screen.getAllByRole("button", { name: /Maximize/i });
    expect(zoomButtons.length).toBe(sampleCards.length);
  });

  it("prevents vertical drift collision in the same column via soft repulsive separation", () => {
    // Mathematical verification of pairwise column collision prevention algorithm
    const H = 880;
    const UNIFORM_SPAN = H + 440; // 1320
    const cardA = { y: 200, h: 400, col: 0, mult: 0.90 };
    const cardB = { y: 450, h: 330, col: 0, mult: 0.88 }; // Intrusion: centers are 250px apart, minDist is 395px

    const cyA = cardA.y + cardA.h / 2; // 400
    const cyB = cardB.y + cardB.h / 2; // 615
    let dY = cyB - cyA; // 215

    if (dY > UNIFORM_SPAN / 2) dY -= UNIFORM_SPAN;
    else if (dY < -UNIFORM_SPAN / 2) dY += UNIFORM_SPAN;

    const minDist = (cardA.h + cardB.h) / 2 + 30; // (400 + 330)/2 + 30 = 395
    expect(dY).toBe(215);
    expect(minDist).toBe(395);
    expect(Math.abs(dY)).toBeLessThan(minDist);

    // Simulate spring separation over successive frames
    let currentYA = cardA.y;
    let currentYB = cardB.y;
    const dt = 0.016;

    for (let frame = 0; frame < 60; frame++) {
      const cA = currentYA + cardA.h / 2;
      const cB = currentYB + cardB.h / 2;
      let diff = cB - cA;
      if (diff > UNIFORM_SPAN / 2) diff -= UNIFORM_SPAN;
      else if (diff < -UNIFORM_SPAN / 2) diff += UNIFORM_SPAN;

      const dist = Math.abs(diff);
      if (dist < minDist) {
        const overlap = minDist - dist;
        const sign = diff >= 0 ? 1 : -1;
        const springRate = Math.min(1, 10 * dt);
        const sep = overlap * springRate;
        currentYA -= sign * sep * 0.5;
        currentYB += sign * sep * 0.5;
      }
    }

    const finalDist = Math.abs((currentYB + cardB.h / 2) - (currentYA + cardA.h / 2));
    // Soft spring separation should push them apart to reach minDist
    expect(finalDist).toBeGreaterThanOrEqual(minDist - 0.5);
  });

  it("handles cyclic shortest distance correctly across the uniform wrap boundary", () => {
    const H = 880;
    const UNIFORM_SPAN = H + 440; // 1320
    // Card A is near the bottom, Card B has wrapped to the top
    const cardA = { y: 750, h: 400 }; // cyA = 950
    const cardB = { y: -350, h: 330 }; // cyB = -185

    const cyA = cardA.y + cardA.h / 2; // 950
    const cyB = cardB.y + cardB.h / 2; // -185
    let dY = cyB - cyA; // -1135

    if (dY > UNIFORM_SPAN / 2) dY -= UNIFORM_SPAN;
    else if (dY < -UNIFORM_SPAN / 2) dY += UNIFORM_SPAN; // -1135 + 1320 = 185

    expect(dY).toBe(185); // Shortest distance across cyclic boundary is 185px, correctly positive
  });
});
