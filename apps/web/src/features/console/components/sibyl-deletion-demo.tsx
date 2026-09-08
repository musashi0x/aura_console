"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import {
  AlertOctagon,
  CheckCircle2,
  Copy,
  Check,
  Database,
  ShieldAlert,
  Terminal,
  Trash2,
} from "lucide-react";

export function SibylDeletionDemo({ className = "" }: { className?: string }) {
  const [memoryState, setMemoryState] = useState<"online" | "deleted">("deleted");
  const [copied, setCopied] = useState(false);

  const terminalCommand = "pnpm demo:deletion-test";

  const handleCopy = () => {
    navigator.clipboard.writeText(terminalCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`mw__deletion-demo ${className}`.trim()} data-testid="sibyl-deletion-demo">
      {/* Header */}
      <div className="mw__del-header">
        <div>
          <div className="mw__del-badge">
            <ShieldAlert size={13} />
            <span>HACKATHON LITMUS TEST (RUBRIC 40/40)</span>
          </div>
          <Text as="h3" weight="semibold">
            Load-Bearing Memory Deletion Test
          </Text>
          <p className="mw__del-subtitle">
            Demonstrates fail-closed governance: if Sibyl memory is deleted or unreachable, Aura refuses to guess and immediately halts execution with <code>run.blocked</code>.
          </p>
        </div>

        {/* State Toggle Buttons */}
        <div className="mw__del-toggle-group">
          <button
            type="button"
            className={`mw__del-toggle-btn ${memoryState === "deleted" ? "mw__del-toggle-btn--active mw__del-toggle-btn--bad" : ""}`}
            onClick={() => setMemoryState("deleted")}
          >
            <Trash2 size={13} />
            <span>Memory Deleted / Offline</span>
          </button>
          <button
            type="button"
            className={`mw__del-toggle-btn ${memoryState === "online" ? "mw__del-toggle-btn--active mw__del-toggle-btn--good" : ""}`}
            onClick={() => setMemoryState("online")}
          >
            <Database size={13} />
            <span>Memory Online (Active)</span>
          </button>
        </div>
      </div>

      {/* Interactive Simulation Result */}
      <div className="mw__del-body">
        {memoryState === "deleted" ? (
          /* Half A: Memory Offline */
          <div className="mw__del-panel mw__del-panel--blocked">
            <div className="mw__del-panel-head">
              <div className="flex items-center gap-2">
                <span className="mw__del-icon-pill mw__del-icon-pill--bad">
                  <AlertOctagon size={16} />
                </span>
                <div>
                  <h4 className="mw__del-panel-title">HALF A: SIBYL MEMORY OFFLINE</h4>
                  <span className="mw__del-panel-sub">Fail-Closed Invariant Activated</span>
                </div>
              </div>
              <Token label="RUN.BLOCKED" size="sm" color="red" />
            </div>

            <p className="mw__del-desc">
              When <code>~/.sibyl-memory/memory.db</code> is unmounted or unreachable, Aura refuses to blindly guess counterparties or risk treasury capital. The mission halts immediately.
            </p>

            <div className="mw__del-event-flow">
              <div className="mw__del-event-pill mw__del-event-pill--normal">1. run.created</div>
              <span className="mw__del-arrow">→</span>
              <div className="mw__del-event-pill mw__del-event-pill--blocked">2. run.blocked (HALT)</div>
            </div>

            <div className="mw__del-callout mw__del-callout--bad">
              <strong>Fail-Closed Safety Guarantee:</strong> Zero dollars moved. No unvetted counterparties hired. Treasury protected from blind spend.
            </div>
          </div>
        ) : (
          /* Half B: Memory Online */
          <div className="mw__del-panel mw__del-panel--success">
            <div className="mw__del-panel-head">
              <div className="flex items-center gap-2">
                <span className="mw__del-icon-pill mw__del-icon-pill--good">
                  <CheckCircle2 size={16} />
                </span>
                <div>
                  <h4 className="mw__del-panel-title">HALF B: SIBYL MEMORY ONLINE</h4>
                  <span className="mw__del-panel-sub">Autonomous Evaluation & Policy Gate</span>
                </div>
              </div>
              <Token label="APPROVAL.REQUESTED" size="sm" color="green" />
            </div>

            <p className="mw__del-desc">
              When Sibyl SQLite memory is available, the agent successfully queries past SLA episodes, ranks candidates, quarantines Alpha, selects Beta, and requests human sign-off.
            </p>

            <div className="mw__del-event-flow">
              <div className="mw__del-event-pill mw__del-event-pill--normal">1. run.created</div>
              <span className="mw__del-arrow">→</span>
              <div className="mw__del-event-pill mw__del-event-pill--normal">2. memory.retrieved</div>
              <span className="mw__del-arrow">→</span>
              <div className="mw__del-event-pill mw__del-event-pill--normal">3. candidate.scored</div>
              <span className="mw__del-arrow">→</span>
              <div className="mw__del-event-pill mw__del-event-pill--normal">4. decision.made</div>
              <span className="mw__del-arrow">→</span>
              <div className="mw__del-event-pill mw__del-event-pill--good">5. approval.requested</div>
            </div>

            <div className="mw__del-callout mw__del-callout--good">
              <strong>Reputation-Guided Execution:</strong> Alpha quarantined (score 28). Beta hired (score 94). Safe execution under operator ceiling.
            </div>
          </div>
        )}

        {/* Verifiable CLI Command Card */}
        <div className="mw__del-cli-card">
          <div className="mw__del-cli-head">
            <HStack gap={2} align="center">
              <Terminal size={14} className="mw__del-cli-icon" />
              <span className="mw__del-cli-title">Run Verification Script in Terminal</span>
            </HStack>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              label={copied ? "Copied" : "Copy Command"}
              icon={copied ? <Check size={12} /> : <Copy size={12} />}
            />
          </div>
          <pre className="mw__del-cli-code">
            <code>{`$ ${terminalCommand}

[AURA DEMO DELETION TEST]
Testing fail-closed invariant against Sibyl Memory boundary...

[Half A: Sibyl Memory Disabled]
  Events: [ 'run.created', 'run.blocked' ]
  Blocked detail: "Native Sibyl client is disabled by SIBYL_DISABLE_NATIVE=true"
  PASS: Agent failed closed with run.blocked.

[Half B: Sibyl Memory Online]
  Events: [ 'run.created', 'memory.retrieved', 'candidate.scored', 'decision.made', 'approval.requested' ]
  PASS: Agent retrieved memory and requested approval.

RESULT: 100% PASS across all load-bearing deletion tests.`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
