import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import type { SpineNode } from "../projection/spine";
import { EvidenceDrawer } from "./evidence-drawer";
import { StreamlinedDecisionCard } from "./streamlined-decision-card";

describe("Challenger M4.2: Console Drawer Interactions, Keyboard Navigation & Invariants", () => {
  describe("1. Secondary Navigation Strips: Drawer Opening & Closing Stress Test", () => {
    it("opens and closes Technical Traces drawer via button, header X, footer Close, and backdrop click", async () => {
      const user = userEvent.setup();
      const onViewTrace = vi.fn();
      render(<StreamlinedDecisionCard onViewTrace={onViewTrace} />);

      // Initially no dialog
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Open Technical Traces drawer
      const traceTrigger = screen.getByRole("button", { name: "Open Technical Traces drawer" });
      await user.click(traceTrigger);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByRole("heading", { name: "Technical Traces & Audit Spine" }),
      ).toBeInTheDocument();
      expect(within(dialog).getByText(/Every state transition in this mission is recorded/i)).toBeInTheDocument();

      // Test onViewTrace action button inside drawer
      const fullTraceBtn = within(dialog).getByRole("button", { name: "Open Full Trace View" });
      await user.click(fullTraceBtn);
      expect(onViewTrace).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Re-open and close via header X
      await user.click(traceTrigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      const headerCloseBtn = screen.getByRole("button", { name: "Close drawer" });
      await user.click(headerCloseBtn);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Re-open and close via footer Close button
      await user.click(traceTrigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      const footerCloseBtn = screen.getByRole("button", { name: "Close" });
      await user.click(footerCloseBtn);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Re-open and close via backdrop click
      await user.click(traceTrigger);
      const backdrop = screen.getByRole("dialog");
      await user.click(backdrop);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("omits Full Trace View button in Technical Traces drawer when onViewTrace is not provided", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      await user.click(screen.getByRole("button", { name: "Open Technical Traces drawer" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByRole("button", { name: "Open Full Trace View" })).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
    });

    it("opens and closes Operator Guardrails drawer cleanly with ceiling formatting", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard budgetUsdc="25.000000" />);

      const guardrailsTrigger = screen.getByRole("button", { name: "Open Guardrails drawer" });
      await user.click(guardrailsTrigger);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByRole("heading", { name: "Operator Guardrails & Policy Ceilings" }),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("Declared Ceiling:")).toBeInTheDocument();
      expect(within(dialog).getByText("25.00 USDC")).toBeInTheDocument();
      expect(within(dialog).getByText("OPERATOR_APPROVAL")).toBeInTheDocument();
      expect(within(dialog).getByText("HALT ON DISCONNECT")).toBeInTheDocument();

      // Clicking inside drawer should NOT close it (stopPropagation)
      const modalContent = within(dialog).getByText("Declared Ceiling:").closest("div");
      if (modalContent) {
        await user.click(modalContent);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      }

      await user.click(within(dialog).getByRole("button", { name: "Close drawer" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("falls back to default 15.00 USDC budget ceiling in Guardrails drawer when budget is null", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard budgetUsdc={null} />);

      await user.click(screen.getByRole("button", { name: "Open Guardrails drawer" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("15.00 USDC")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
    });

    it("opens and closes System Readiness drawer cleanly", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      const readinessTrigger = screen.getByRole("button", { name: "Open Readiness drawer" });
      await user.click(readinessTrigger);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByRole("heading", { name: "System & Memory Store Readiness" }),
      ).toBeInTheDocument();
      expect(within(dialog).getByText("Sibyl Memory Store")).toBeInTheDocument();
      expect(within(dialog).getByText(/~[/\\]\.sibyl-memory[/\\]memory\.db/i)).toBeInTheDocument();
      expect(within(dialog).getByText("Event Store (WAL)")).toBeInTheDocument();
      expect(within(dialog).getByText("Verifier Agent")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens and closes Evidence (Why This Provider) drawer cleanly", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      const evidenceTrigger = screen.getByRole("button", { name: /Why this provider\?/i });
      await user.click(evidenceTrigger);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByRole("heading", { name: "Why This Provider: Evidence & Provenance" }),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Close drawer" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("survives rapid opening, closing, and sequential strip transitions without duplicate modals or state leaks", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      const triggers = [
        { name: "Open Technical Traces drawer", expectedTitle: "Technical Traces & Audit Spine" },
        { name: "Open Guardrails drawer", expectedTitle: "Operator Guardrails & Policy Ceilings" },
        { name: "Open Readiness drawer", expectedTitle: "System & Memory Store Readiness" },
        { name: /Why this provider\?/i, expectedTitle: "Why This Provider: Evidence & Provenance" },
      ];

      // Rapid cycle through all triggers
      for (const { name, expectedTitle } of triggers) {
        const trigger = screen.getByRole("button", { name });
        await user.click(trigger);

        const dialogs = screen.getAllByRole("dialog");
        expect(dialogs).toHaveLength(1);
        expect(screen.getByRole("heading", { name: expectedTitle })).toBeInTheDocument();

        // Close via close button
        await user.click(screen.getByRole("button", { name: "Close drawer" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      }
    });

    it("ignores non-Escape keydown events while drawer is open", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      await user.click(screen.getByRole("button", { name: "Open Technical Traces drawer" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Press other keys
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.keyboard("{Space}");
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Press Escape to confirm close
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("2. Escape Key Closing, ARIA Roles, Focus Containment, and Accessibility Audits", () => {
    it.each([
      { stripName: "Open Technical Traces drawer", expectedTitle: "Technical Traces & Audit Spine" },
      { stripName: "Open Guardrails drawer", expectedTitle: "Operator Guardrails & Policy Ceilings" },
      { stripName: "Open Readiness drawer", expectedTitle: "System & Memory Store Readiness" },
      { stripName: /Why this provider\?/i, expectedTitle: "Why This Provider: Evidence & Provenance" },
    ])("closes '$expectedTitle' drawer on Escape key press", async ({ stripName, expectedTitle }) => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      await user.click(screen.getByRole("button", { name: stripName }));
      expect(screen.getByRole("heading", { name: expectedTitle })).toBeInTheDocument();

      // Press Escape
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: expectedTitle })).not.toBeInTheDocument();
    });

    it("verifies ARIA dialog roles, modal attribute, and accessible labelling across all drawer variants", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      const strips = [
        { btn: "Open Technical Traces drawer", id: "drawer-title", title: "Technical Traces & Audit Spine" },
        { btn: "Open Guardrails drawer", id: "drawer-title", title: "Operator Guardrails & Policy Ceilings" },
        { btn: "Open Readiness drawer", id: "drawer-title", title: "System & Memory Store Readiness" },
        { btn: /Why this provider\?/i, id: "drawer-title", title: "Why This Provider: Evidence & Provenance" },
      ];

      for (const { btn, id, title } of strips) {
        await user.click(screen.getByRole("button", { name: btn }));

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby", id);

        const heading = screen.getByRole("heading", { name: title });
        expect(heading).toHaveAttribute("id", id);
        expect(heading.textContent).toBe(title);

        await user.keyboard("{Escape}");
      }
    });

    it("passes axe accessibility audits while each drawer variant is actively open", async () => {
      const user = userEvent.setup();
      const { container } = render(<StreamlinedDecisionCard />);

      const triggers = [
        "Open Technical Traces drawer",
        "Open Guardrails drawer",
        "Open Readiness drawer",
        /Why this provider\?/i,
      ];

      for (const trigger of triggers) {
        await user.click(screen.getByRole("button", { name: trigger }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        // Run axe audit on the open dialog DOM
        await expectNoAxeViolations(container);

        await user.keyboard("{Escape}");
      }
    });

    it("empirically audits modal focus containment and Tab traversal behavior", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      const traceBtn = screen.getByRole("button", { name: "Open Technical Traces drawer" });
      traceBtn.focus();
      expect(traceBtn).toHaveFocus();

      // Open drawer via Enter
      await user.keyboard("{Enter}");
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();

      // Finding: In StreamlinedDecisionCard, focus is NOT automatically captured by the modal dialog on open.
      // The focus remains on the triggering button behind the backdrop scrim.
      const initialFocusInside = dialog.contains(document.activeElement);
      expect(initialFocusInside).toBe(false);

      // Finding: When pressing Tab, focus traverses background elements instead of wrapping inside modal
      await user.tab();
      const afterTabInside = dialog.contains(document.activeElement);
      expect(afterTabInside).toBe(false);

      // Close drawer via Escape
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("verifies EvidenceDrawer sibling component also adheres to ARIA dialog role and Escape listener", async () => {
      const onClose = vi.fn();
      const mockNode: SpineNode = {
        stage: "DECISION",
        state: "REACHED",
        firstSequence: 1,
        lastSequence: 1,
        firstTime: "2026-09-10T10:00:00Z",
        lastTime: "2026-09-10T10:00:00Z",
        hiddenByMemoryOff: 0,
        entries: [
          {
            eventId: "e1",
            sequence: 1,
            type: "decision.made",
            eventTime: "2026-09-10T10:00:00Z",
            stage: "DECIDE",
            support: "SUPPORTED",
            summary: "Selected Beta Labs over Alpha",
            data: {},
          },
        ],
      };

      const { container } = render(
        <EvidenceDrawer node={mockNode} envelope={null} onClose={onClose} />,
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      // EvidenceDrawer focuses its close button on mount
      const closeBtn = screen.getByRole("button", { name: /close/i });
      expect(closeBtn).toHaveFocus();

      // Escape triggers onClose
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();

      // Passes axe check
      await expectNoAxeViolations(container);
    });
  });

  describe("3. Candidate Risk Comparison (Alpha CRITICAL vs Beta LOW)", () => {
    it("ensures Alpha's CRITICAL risk digest and MISSING_CITATIONS badge contrast sharply with Beta's LOW risk digest in StreamlinedDecisionCard", async () => {
      const user = userEvent.setup();
      render(<StreamlinedDecisionCard />);

      // Open Evidence Drawer
      await user.click(screen.getByRole("button", { name: /Why this provider\?/i }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();

      // 1. Alpha Research (Penalized Candidate) Assertions
      const alphaTitle = within(dialog).getByText("Alpha Research (Prior Defect)");
      expect(alphaTitle).toBeInTheDocument();
      expect(alphaTitle.className).toContain("text-rose-400");

      const alphaRiskBadge = within(dialog).getByText("RISK: CRITICAL");
      expect(alphaRiskBadge).toBeInTheDocument();

      const alphaActionToken = within(dialog).getByText("Action: DO_NOT_HIRE");
      expect(alphaActionToken).toBeInTheDocument();

      const alphaDefectToken = within(dialog).getByText("MISSING_CITATIONS");
      expect(alphaDefectToken).toBeInTheDocument();

      expect(
        within(dialog).getByText(
          /Executive Risk Digest: Alpha Research: 1 failure due to unverified citations, 0 successful deliveries, currently under WATCH status \(Reliability: 33\.3%, Confidence: 16\.7%\)\./i,
        ),
      ).toBeInTheDocument();

      expect(within(dialog).getByText("Reflected Lesson (R1):")).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          /Failed Competitor Intelligence Report on 2026-09-09\. Deliverable lacked required citation URLs\. Evaluator gave score 0\.20\. Root Cause: Alpha omits mandatory competitor citation URLs\./i,
        ),
      ).toBeInTheDocument();

      // 2. Beta Research (Recommended Candidate) Assertions
      const betaTitle = within(dialog).getByText("Beta Research (Verified Deliverable)");
      expect(betaTitle).toBeInTheDocument();
      expect(betaTitle.className).toContain("text-emerald-400");

      const betaRiskBadge = within(dialog).getByText("RISK: LOW");
      expect(betaRiskBadge).toBeInTheDocument();

      const betaActionToken = within(dialog).getByText("Action: HIRE");
      expect(betaActionToken).toBeInTheDocument();

      const betaCleanToken = within(dialog).getByText("Clean Verification");
      expect(betaCleanToken).toBeInTheDocument();

      expect(
        within(dialog).getByText(
          /Executive Risk Digest: Beta Research: 100% verified deliveries, zero defects, currently PREFERRED \(Reliability: 91\.0%, Confidence: 90\.0%\)\./i,
        ),
      ).toBeInTheDocument();

      expect(within(dialog).getByText("Consolidated Dossier (R2):")).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          /Completed market deliverables with verified citations and schema conformity\. 100% on-time track record across episodes\./i,
        ),
      ).toBeInTheDocument();

      // 3. Sharp contrast validation:
      // Alpha has DO_NOT_HIRE and CRITICAL risk; Beta has HIRE and LOW risk.
      expect(alphaRiskBadge).not.toHaveTextContent("LOW");
      expect(betaRiskBadge).not.toHaveTextContent("CRITICAL");
      expect(alphaActionToken).not.toHaveTextContent("Action: HIRE");
      expect(betaActionToken).not.toHaveTextContent("Action: DO_NOT_HIRE");
    });

    it("verifies Candidate Memory & Risk Evaluation in EvidenceDrawer also displays sharp Alpha vs Beta contrast", () => {
      const mockNode: SpineNode = {
        stage: "DECISION",
        state: "REACHED",
        firstSequence: null,
        lastSequence: null,
        firstTime: null,
        lastTime: null,
        hiddenByMemoryOff: 0,
        entries: [],
      };

      render(<EvidenceDrawer node={mockNode} envelope={null} onClose={vi.fn()} />);

      const section = screen.getByRole("region", { name: "Candidate Memory & Risk Evaluation" });
      expect(section).toBeInTheDocument();

      // Alpha assertions
      expect(within(section).getByText("Alpha Research (Penalized)")).toBeInTheDocument();
      expect(within(section).getByText("CRITICAL RISK")).toBeInTheDocument();
      expect(within(section).getByText("MISSING_CITATIONS")).toBeInTheDocument();
      expect(
        within(section).getByText(
          /Executive Risk Digest: 1 failure due to unverified citations, 0 successful deliveries\. Under WATCH status\./i,
        ),
      ).toBeInTheDocument();
      expect(
        within(section).getByText(
          /Lesson: Alpha repeatedly omits mandatory citation sources/i,
        ),
      ).toBeInTheDocument();

      // Beta assertions
      expect(within(section).getByText("Beta Labs (Selected)")).toBeInTheDocument();
      expect(within(section).getByText("LOW RISK")).toBeInTheDocument();
      expect(within(section).getByText("VERIFIED")).toBeInTheDocument();
      expect(
        within(section).getByText(
          /Executive Risk Digest: 100% verified deliveries, zero defects, PREFERRED status\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("4. Design Token Compliance: Regex Scans Across Counterparties Feature", () => {
    it("guarantees zero literal hex color strings in apps/web/src/features/counterparties/", () => {
      const counterpartiesDir = join(process.cwd(), "src/features/counterparties");
      const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;

      function scanDir(dir: string): { file: string; matches: string[] }[] {
        const results: { file: string; matches: string[] }[] = [];
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            results.push(...scanDir(fullPath));
          } else if (/\.(tsx?|css)$/.test(entry)) {
            const content = readFileSync(fullPath, "utf-8");
            const matches = content.match(hexPattern) || [];
            if (matches.length > 0) {
              results.push({ file: fullPath, matches });
            }
          }
        }
        return results;
      }

      const violations = scanDir(counterpartiesDir);
      expect(violations).toEqual([]);
    });

    it("guarantees zero literal hex color strings in apps/web/src/app/counterparties/page.tsx", () => {
      const pagePath = join(process.cwd(), "src/app/counterparties/page.tsx");
      const content = readFileSync(pagePath, "utf-8");
      const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
      const matches = content.match(hexPattern) || [];

      expect(matches).toEqual([]);
    });

    it("guarantees zero literal hex color strings in StreamlinedDecisionCard component file", () => {
      const cardPath = join(
        process.cwd(),
        "src/features/console/components/streamlined-decision-card.tsx",
      );
      const content = readFileSync(cardPath, "utf-8");
      const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
      const matches = content.match(hexPattern) || [];

      expect(matches).toEqual([]);
    });

    it("guarantees zero literal hex color strings in EvidenceDrawer component file", () => {
      const drawerPath = join(
        process.cwd(),
        "src/features/console/components/evidence-drawer.tsx",
      );
      const content = readFileSync(drawerPath, "utf-8");
      const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
      const matches = content.match(hexPattern) || [];

      expect(matches).toEqual([]);
    });
  });
});
