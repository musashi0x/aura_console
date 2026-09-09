import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FloatingCardsGallery,
  applyPairwiseColumnConstraints,
  type Particle,
} from "./floating-cards-gallery";
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

  it("toggles zoom when clicking zoom button", () => {
    render(<FloatingCardsGallery cards={sampleCards} />);
    const maxButtons = screen.getAllByRole("button", { name: /Maximize/i });
    fireEvent.click(maxButtons[0]!);

    expect(
      screen.getByRole("button", { name: /Minimize Storage Hierarchy/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Minimize Storage Hierarchy/i }));
    expect(
      screen.queryByRole("button", { name: /Minimize Storage Hierarchy/i })
    ).not.toBeInTheDocument();
  });

  it("deep-link focuses and zooms matching card on hashchange", () => {
    render(<FloatingCardsGallery cards={sampleCards} />);

    act(() => {
      window.location.hash = "#deletion-test";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      screen.getByRole("button", { name: /Minimize Deletion Test/i })
    ).toBeInTheDocument();

    act(() => {
      window.location.hash = "#architecture";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      screen.getByRole("button", { name: /Minimize Storage Hierarchy/i })
    ).toBeInTheDocument();
  });

  it("prevents vertical drift collision in the same column via applyPairwiseColumnConstraints", () => {
    const H = 880;
    const UNIFORM_SPAN = H + 440; // 1320
    const particles: Particle[] = [
      { x: 20, y: 200, dx: 0, dy: 0, z: 0, targetZ: 0, w: 370, h: 400, mult: 0.90, vx: 0, vy: 0, col: 0 },
      { x: 20, y: 450, dx: 0, dy: 0, z: 0, targetZ: 0, w: 370, h: 330, mult: 0.88, vx: 0, vy: 0, col: 0 },
    ];

    const cardA = particles[0]!;
    const cardB = particles[1]!;
    const minDist = (cardA.h + cardB.h) / 2 + 30; // (400 + 330)/2 + 30 = 395

    // Simulate spring separation over 60 frames (1 second at 60fps)
    for (let frame = 0; frame < 60; frame++) {
      applyPairwiseColumnConstraints(particles, {
        dt: 0.016,
        containerHeight: H,
        uniformSpan: UNIFORM_SPAN,
        zoomedIdx: null,
        heldIdx: null,
      });
    }

    const finalDist = Math.abs((cardB.y + cardB.h / 2) - (cardA.y + cardA.h / 2));
    // Soft spring separation should push them apart until minDist is satisfied
    expect(finalDist).toBeGreaterThanOrEqual(minDist - 0.5);
  });

  it("leaves held or zoomed card stationary while repelling free card in the same column", () => {
    const H = 880;
    const UNIFORM_SPAN = H + 440;
    const initialZoomedY = 200;
    const particles: Particle[] = [
      { x: 20, y: initialZoomedY, dx: 0, dy: 0, z: 1, targetZ: 1, w: 370, h: 400, mult: 0.90, vx: 0, vy: 0, col: 0 },
      { x: 20, y: 350, dx: 0, dy: 0, z: 0, targetZ: 0, w: 370, h: 330, mult: 0.88, vx: 0, vy: 0, col: 0 },
    ];

    const cardA = particles[0]!;
    const cardB = particles[1]!;
    const initialCardBY = cardB.y;

    // Card 0 is zoomed (zoomedIdx = 0)
    for (let frame = 0; frame < 30; frame++) {
      applyPairwiseColumnConstraints(particles, {
        dt: 0.016,
        containerHeight: H,
        uniformSpan: UNIFORM_SPAN,
        zoomedIdx: 0,
        heldIdx: null,
      });
    }

    // Zoomed card 0 must NOT move
    expect(cardA.y).toBe(initialZoomedY);
    // Free card 1 must be pushed away (moving downwards)
    expect(cardB.y).toBeGreaterThan(initialCardBY);
  });

  it("handles cyclic shortest distance correctly across the uniform wrap boundary", () => {
    const H = 880;
    const UNIFORM_SPAN = H + 440; // 1320
    // Card A is near the bottom, Card B has wrapped to the top
    const particles: Particle[] = [
      { x: 20, y: 750, dx: 0, dy: 0, z: 0, targetZ: 0, w: 370, h: 400, mult: 0.90, vx: 0, vy: 0, col: 0 }, // cyA = 950
      { x: 20, y: -350, dx: 0, dy: 0, z: 0, targetZ: 0, w: 370, h: 330, mult: 0.88, vx: 0, vy: 0, col: 0 }, // cyB = -185
    ];

    const cardA = particles[0]!;
    const cardB = particles[1]!;
    const initialYA = cardA.y;
    const initialYB = cardB.y;

    // Center distance across cyclic boundary is: -185 - 950 = -1135 -> +1320 = +185px
    // minDist is 395px, so cardB is cyclic-forward relative to cardA by 185px.
    // Pairwise separation should push cardA backward (upwards) and cardB forward (downwards).
    applyPairwiseColumnConstraints(particles, {
      dt: 0.016,
      containerHeight: H,
      uniformSpan: UNIFORM_SPAN,
      zoomedIdx: null,
      heldIdx: null,
    });

    expect(cardA.y).toBeLessThan(initialYA);
    expect(cardB.y).toBeGreaterThan(initialYB);
  });
});
