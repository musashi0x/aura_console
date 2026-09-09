import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import DocsLayoutShell from "@/components/docs/docs-layout-shell";
import InstallationPage from "./page";

describe("InstallationPage — Sibyl Setup & Walkthrough", () => {
  it("renders the 4-step setup guide with official commands and copy", () => {
    render(
      <DocsLayoutShell>
        <InstallationPage />
      </DocsLayoutShell>,
    );

    // Kicker, title, and lede
    expect(screen.getByText(/GETTING STARTED \/ WALKTHROUGH/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Sibyl Memory Setup" })).toBeInTheDocument();
    expect(screen.getAllByText(/Give your AI a memory, in about two minutes/i).length).toBeGreaterThanOrEqual(1);

    // Step 1: Install it
    expect(screen.getByRole("heading", { level: 2, name: /Step 1: Install it/i })).toBeInTheDocument();
    expect(screen.getAllByText(/pip install 'sibyl-memory-cli\[mcp\]'/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/curl -fsSL https:\/\/sibyllabs.org\/install \| sh/i)).toBeInTheDocument();

    // Step 2: Sign in
    expect(screen.getByRole("heading", { level: 2, name: /Step 2: Sign in/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sibyl init/i).length).toBeGreaterThanOrEqual(1);

    // Step 3: Connect it to your AI
    expect(screen.getByRole("heading", { level: 2, name: /Step 3: Connect it to your AI/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sibyl setup/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Claude Code/i).length).toBeGreaterThanOrEqual(1);

    // Step 4: Test it works
    expect(screen.getByRole("heading", { level: 2, name: /Step 4: Test it works/i })).toBeInTheDocument();
    expect(screen.getAllByText(/remember that I like short, direct answers\./i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/how do I like my answers\?/i).length).toBeGreaterThanOrEqual(1);

    // Troubleshooting: If something did not work
    expect(screen.getByRole("heading", { level: 2, name: /If something did not work/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Externally managed environment/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/python3 -m venv ~\/\.sibyl-memory\/venv/i).length).toBeGreaterThanOrEqual(1);

    // 5-Tier Memory Architecture
    expect(screen.getByRole("heading", { level: 2, name: /5-Tier memory architecture/i })).toBeInTheDocument();

    // Open source links
    expect(screen.getByRole("heading", { level: 2, name: /Open source & resources/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on GitHub →/i })).toHaveAttribute(
      "href",
      "https://github.com/Sibyl-Labs/Sibyl-Memory",
    );
  });

  it("passes axe accessibility audits", async () => {
    const { container } = render(
      <DocsLayoutShell>
        <InstallationPage />
      </DocsLayoutShell>,
    );
    await expectNoAxeViolations(container);
  });
});
