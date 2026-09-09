import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import { setReducedMotion } from "@/test-support/setup";
import { LandingPreloader } from "../components/landing-preloader";

describe("LandingPreloader", () => {
  it("renders video element with all sources, poster, and accessible label", () => {
    const { container } = render(<LandingPreloader />);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("poster", "/preloader-poster.jpg");
    expect(video).toHaveAttribute("aria-label", "How do I give my agent lasting memory animation");

    const sources = container.querySelectorAll("video source");
    const srcList = Array.from(sources).map((s) => s.getAttribute("src"));
    expect(srcList).toContain("/preloader.webm");
    expect(srcList).toContain("/light-rails-0909-164913.webm");
    expect(srcList).toContain("/preloader.mp4");
  });

  it("renders branding telemetry and skip button", () => {
    render(<LandingPreloader />);
    expect(screen.getByText("AURA MEMORY")).toBeInTheDocument();
    expect(screen.getByText(/INITIALIZING 5-TIER MEMORY RECALL/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /skip preloader animation/i }),
    ).toBeInTheDocument();
  });

  it("dismisses when skip button is clicked", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LandingPreloader onComplete={onComplete} />);

      const skipButton = screen.getByRole("button", { name: /skip preloader animation/i });
      fireEvent.click(skipButton);

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
      expect(screen.queryByRole("region", { name: /aura memory preloader sequence/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses when Escape key is pressed", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LandingPreloader onComplete={onComplete} />);

      fireEvent.keyDown(window, { key: "Escape" });

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
      expect(screen.queryByRole("region", { name: /aura memory preloader sequence/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses when Space key is pressed and prevents default scrolling", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LandingPreloader onComplete={onComplete} />);

      const event = new KeyboardEvent("keydown", { key: " ", cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      act(() => {
        window.dispatchEvent(event);
      });


      expect(preventDefaultSpy).toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses automatically on video ended", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      const { container } = render(<LandingPreloader onComplete={onComplete} />);

      const video = container.querySelector("video");
      expect(video).toBeInTheDocument();
      fireEvent.ended(video!);

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses on video error", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      const { container } = render(<LandingPreloader onComplete={onComplete} />);

      const video = container.querySelector("video");
      expect(video).toBeInTheDocument();
      fireEvent.error(video!);

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses on fallback timeout when specified", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LandingPreloader fallbackTimeoutMs={3000} onComplete={onComplete} />);

      act(() => {
        vi.advanceTimersByTime(3000);
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses on default 6800ms fallback timeout when no prop is specified", () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LandingPreloader onComplete={onComplete} />);

      act(() => {
        vi.advanceTimersByTime(6800);
        vi.advanceTimersByTime(700);
      });

      expect(onComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("dismisses immediately without transition when prefers-reduced-motion is active", () => {
    setReducedMotion(true);
    const onComplete = vi.fn();
    render(<LandingPreloader onComplete={onComplete} />);

    expect(onComplete).toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: /aura memory preloader sequence/i }),
    ).not.toBeInTheDocument();
  });

  it("autoFocuses the skip button for keyboard users", () => {
    render(<LandingPreloader />);
    const skipButton = screen.getByRole("button", {
      name: /skip preloader animation/i,
    });
    expect(document.activeElement).toBe(skipButton);
  });

  it("has no axe violations", async () => {
    const { container } = render(<LandingPreloader />);
    await expectNoAxeViolations(container);
  });
});

