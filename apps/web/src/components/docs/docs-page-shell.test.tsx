import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { stoneTheme } from "@/themes/stone/stone.js";
import DocsLayoutShell from "./docs-layout-shell";
import { DocsPageShell } from "./docs-page-shell";

describe("DocsPageShell — Stone Theme", () => {
  it("renders with Stone theme active", () => {
    const { container } = render(
      <DocsLayoutShell>
        <DocsPageShell>
          <article>
            <h1>Documentation</h1>
          </article>
        </DocsPageShell>
      </DocsLayoutShell>,
    );

    const themedRoot = container.querySelector("[data-astryx-theme]");
    expect(themedRoot).toBeInTheDocument();
    expect(themedRoot?.getAttribute("data-astryx-theme")).toBe(stoneTheme.name);
    expect(themedRoot?.getAttribute("data-theme")).toBe("light");
    expect(
      screen.getByRole("heading", { level: 1, name: "Documentation" }),
    ).toBeInTheDocument();
  });

  it("renders with dark mode when dark class is active", () => {
    document.documentElement.classList.add("dark");
    try {
      const { container } = render(
        <DocsLayoutShell>
          <DocsPageShell>
            <article>
              <h1>Documentation</h1>
            </article>
          </DocsPageShell>
        </DocsLayoutShell>,
      );

      const themedRoot = container.querySelector("[data-astryx-theme]");
      expect(themedRoot).toBeInTheDocument();
      expect(themedRoot?.getAttribute("data-astryx-theme")).toBe(stoneTheme.name);
      expect(themedRoot?.getAttribute("data-theme")).toBe("dark");
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  it("passes axe accessibility audits", async () => {
    const { container } = render(
      <DocsLayoutShell>
        <DocsPageShell>
          <article>
            <h1>Documentation</h1>
            <p>Welcome to Aura documentation.</p>
          </article>
        </DocsPageShell>
      </DocsLayoutShell>,
    );
    await expectNoAxeViolations(container);
  });
});
