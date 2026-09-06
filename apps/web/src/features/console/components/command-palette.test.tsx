import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Inlined by vitest.config.ts (`define`) — see cssRaw there.
declare const __GLOBALS_CSS__: string;

import { expectNoAxeViolations } from "@/test/axe";
import { routerPushes } from "@/test/setup";

import { console_ } from "../copy";
import { __resetMemoryView, getMemoryViewEnabled } from "../memory-view-state";
import { CommandPalette } from "./command-palette";

/**
 * Every destination the palette is allowed to reach, written out here rather
 * than imported from the registry: an independent list is what makes this an
 * assertion instead of a restatement of the code under test.
 */
const NAVIGATION_ONLY = [
  "/runs",
  "/runs/new",
  "/runs/example",
  "/system",
  "/policies",
  "/counterparties",
];

const openWithShortcut = () =>
  fireEvent.keyDown(window, { key: "k", metaKey: true });

beforeEach(() => {
  __resetMemoryView();
});

describe("command palette", () => {
  it("opens on the shortcut and puts focus in the search field", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).toBeNull();
    openWithShortcut();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(console_.palette.placeholder)).toHaveFocus();
  });

  it("shows the shortcut so it can be found without being told", () => {
    render(<CommandPalette />);
    expect(screen.getByRole("button", { name: /command palette/i })).toHaveTextContent("K");
  });

  it("navigates from the keyboard alone", () => {
    render(<CommandPalette />);
    openWithShortcut();
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(routerPushes).toEqual(["/runs"]);
  });

  it("moves the selection with the arrow keys and marks it visibly", () => {
    render(<CommandPalette />);
    openWithShortcut();
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    // The marker is not :hover. A keyboard operator never produces one, so
    // selection has to be visible in the markup itself.
    const active = document.querySelectorAll('[data-active="true"]');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent(console_.palette.commands.newRun);
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(routerPushes).toEqual(["/runs/new"]);
  });

  it("closes on Escape and gives focus back to the control that opened it", () => {
    render(<CommandPalette />);
    const trigger = screen.getByRole("button", { name: /command palette/i });
    trigger.focus();
    openWithShortcut();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // Focus must land somewhere real. Leaving it on the removed dialog drops a
    // keyboard operator at the top of the document.
    expect(trigger).toHaveFocus();
  });

  it("toggles the Memory view without navigating anywhere", () => {
    render(<CommandPalette />);
    openWithShortcut();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(console_.palette.commands.memoryToggle, "i") }));
    expect(getMemoryViewEnabled()).toBe(false);
    expect(routerPushes).toEqual([]);
  });

  it("reports which way the Memory view is currently set", () => {
    render(<CommandPalette />);
    openWithShortcut();
    expect(screen.getByText(console_.memoryView.on)).toBeInTheDocument();
  });
});

describe("the palette cannot spend", () => {
  it("every command only navigates or changes a view", () => {
    // A command that could execute would have to reach the network. Nothing
    // here may, so the assertion is that running all of them touches neither
    // fetch nor any destination outside the navigation list.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<CommandPalette />);
    openWithShortcut();
    for (const button of screen.getAllByRole("button")) {
      if (button.classList.contains("cs__palette-item")) fireEvent.click(button);
      openWithShortcut();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const href of routerPushes) expect(NAVIGATION_ONLY).toContain(href);
    fetchSpy.mockRestore();
  });

  it("says so where the operator reads it", () => {
    render(<CommandPalette />);
    openWithShortcut();
    expect(screen.getByText(console_.palette.readOnly)).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no axe violations while open", async () => {
    const { container } = render(<CommandPalette />);
    openWithShortcut();
    await expectNoAxeViolations(container);
  });
});

describe("reduced motion", () => {
  /**
   * The palette and the drawer appear in final position. There is no reveal to
   * suppress, so the guard is that no transition or animation ever creeps into
   * these blocks — otherwise a later change would introduce motion that
   * prefers-reduced-motion is not switching off.
   */
  const blockFor = (selector: string) => {
    const css = __GLOBALS_CSS__;
    const start = css.indexOf(selector + " {");
    expect(start).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  };

  it("opens the palette with no animation to remove", () => {
    for (const selector of [".cs__palette", ".cs__palette-scrim", ".cs__palette-item"]) {
      expect(blockFor(selector)).not.toMatch(/transition|animation/);
    }
  });

  it("opens the drawer with no animation to remove", () => {
    for (const selector of [".cs__drawer", ".cs__drawer-scrim"]) {
      expect(blockFor(selector)).not.toMatch(/transition|animation/);
    }
  });

  it("draws no spine node in", () => {
    for (const selector of [".cs__spine-node", ".cs__spine-list"]) {
      expect(blockFor(selector)).not.toMatch(/transition|animation/);
    }
  });
});
