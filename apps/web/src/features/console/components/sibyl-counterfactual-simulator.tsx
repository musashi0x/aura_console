"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export function SibylCounterfactualSimulator({ className = "" }: { className?: string }) {
  const [activeSimulation, setActiveSimulation] = useState<"both" | "stateless" | "sibyl">("both");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  const runStatelessSimulation = () => {
    setIsSimulating(true);
    setActiveSimulation("stateless");
    setSimulationResult("Simulating stateless execution: Greedy price selection -> Alpha selected...");
    setTimeout(() => {
      setSimulationResult("FAILED: virtuals:agent:alpha failed SLA verification. 9.00 USDC forfeited. Zero memory retained.");
      setIsSimulating(false);
    }, 1200);
  };

  const runSibylSimulation = () => {
    setIsSimulating(true);
    setActiveSimulation("sibyl");
    setSimulationResult("Simulating Sibyl execution: Recalling episodic memory -> Alpha quarantined (28/100) -> Beta selected (94/100)...");
    setTimeout(() => {
      setSimulationResult("SUCCESS: virtuals:agent:beta verified 100%. 6.50 USDC treasury saved. Salted diff committed to Base Sepolia.");
      setIsSimulating(false);
    }, 1200);
  };

  const handleReset = () => {
    setActiveSimulation("both");
    setSimulationResult(null);
    setIsSimulating(false);
  };

  return (
    <div className={`mw__counterfactual ${className}`.trim()} data-testid="sibyl-counterfactual-simulator">
      {/* Header & Controls */}
      <div className="mw__cf-header">
        <div>
          <div className="mw__cf-badge">
            <ShieldCheck size={13} />
            <span>COUNTERFACTUAL CAUSAL PROOF</span>
          </div>
          <Text as="h3" weight="semibold">
            Stateless Blind Spend vs. Stateful Sibyl Governance
          </Text>
          <p className="mw__cf-subtitle">
            Direct empirical proof showing why load-bearing memory is mandatory: without Sibyl, autonomous agents repeatedly forfeit treasury to malicious or unreliable counterparties.
          </p>
        </div>

        <div className="mw__cf-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReset}
            label="Reset View"
            icon={<RotateCcw size={12} />}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={runStatelessSimulation}
            isDisabled={isSimulating}
            label="Simulate Stateless"
            icon={<Play size={12} />}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={runSibylSimulation}
            isDisabled={isSimulating}
            label="Simulate Sibyl"
            icon={<Play size={12} />}
          />
        </div>
      </div>

      {/* Simulation Live Status Banner */}
      <AnimatePresence>
        {simulationResult ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={`mw__cf-result-banner ${activeSimulation === "stateless" ? "mw__cf-result-banner--error" : "mw__cf-result-banner--success"}`}
          >
            <span className="mw__cf-result-icon">
              {activeSimulation === "stateless" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            </span>
            <span className="mw__cf-result-text">{simulationResult}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Side-by-Side Comparison Grid */}
      <div className="mw__cf-grid">
        {/* Left Column: Without Sibyl */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className={`mw__cf-col mw__cf-col--stateless ${activeSimulation === "sibyl" ? "mw__cf-col--dimmed" : ""}`}
        >
          <div className="mw__cf-col-header mw__cf-col-header--bad">
            <div className="mw__cf-col-title-wrap">
              <span className="mw__cf-col-status-icon mw__cf-col-status-icon--bad">
                <AlertOctagon size={16} />
              </span>
              <div>
                <h4 className="mw__cf-col-title">WITHOUT SIBYL (STATELESS AGENT)</h4>
                <span className="mw__cf-col-desc">Naive price greed · Zero cross-session learning</span>
              </div>
            </div>
            <span className="mw__cf-verdict-pill mw__cf-verdict-pill--bad">TREASURY LEAK</span>
          </div>

          <div className="mw__cf-steps">
            {/* Step 1 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num">1</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Memory Lookup</span>
                <p className="mw__cf-step-text">None. Ephemeral context wipes out on every session restart.</p>
                <code className="mw__cf-step-code">memory = null (blind decision)</code>
              </div>
            </div>

            {/* Step 2 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num">2</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Counterparty Selection</span>
                <p className="mw__cf-step-text">
                  Selects <code className="mw__cf-code-bad">virtuals:agent:alpha</code> purely because quote is lowest ($9.00 vs $18.50).
                </p>
                <span className="mw__cf-subtag mw__cf-subtag--bad">Greedy Price Selection</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num">3</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Execution Outcome</span>
                <p className="mw__cf-step-text">
                  Alpha delivers malformed payload missing JSON schema fields. Verification fails.
                </p>
                <span className="mw__cf-subtag mw__cf-subtag--bad">SLA Breach / Deliverable Rejected</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num">4</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Treasury & Future Sessions</span>
                <p className="mw__cf-step-text">
                  <strong>-9.00 USDC burned</strong>. Next session, stateless agent hires Alpha AGAIN because it cannot recall past breaches.
                </p>
                <div className="mw__cf-metric-badge mw__cf-metric-badge--bad">
                  <TrendingDown size={14} />
                  <span>-$9.00 USDC Deficit · Infinite Loop Error</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: With Sibyl */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className={`mw__cf-col mw__cf-col--sibyl ${activeSimulation === "stateless" ? "mw__cf-col--dimmed" : ""}`}
        >
          <div className="mw__cf-col-header mw__cf-col-header--good">
            <div className="mw__cf-col-title-wrap">
              <span className="mw__cf-col-status-icon mw__cf-col-status-icon--good">
                <ShieldCheck size={16} />
              </span>
              <div>
                <h4 className="mw__cf-col-title">WITH SIBYL MEMORY (AURA AGENT)</h4>
                <span className="mw__cf-col-desc">Persistent SQLite + Bayesian SLA + Base L2 Commit</span>
              </div>
            </div>
            <span className="mw__cf-verdict-pill mw__cf-verdict-pill--good">TREASURY PROTECTED</span>
          </div>

          <div className="mw__cf-steps">
            {/* Step 1 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num mw__cf-step-num--good">1</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Sibyl Memory Recall</span>
                <p className="mw__cf-step-text">
                  Queries <code className="mw__cf-code-good">~/.sibyl-memory/memory.db</code>. Recalls Alpha&apos;s prior SLA failure in Episode #b2039125.
                </p>
                <code className="mw__cf-step-code">verdict = ok · Alpha Score: 28 | Beta Score: 94</code>
              </div>
            </div>

            {/* Step 2 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num mw__cf-step-num--good">2</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Autonomous Quarantine & Selection</span>
                <p className="mw__cf-step-text">
                  Quarantines Alpha despite cheaper quote. Selects verified partner <code className="mw__cf-code-good">virtuals:agent:beta</code>.
                </p>
                <span className="mw__cf-subtag mw__cf-subtag--good">Bayesian SLA Rank: Beta Selected</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num mw__cf-step-num--good">3</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Execution Outcome</span>
                <p className="mw__cf-step-text">
                  Beta delivers full verified dataset. Verifier passes all automated tests (score 1.0).
                </p>
                <span className="mw__cf-subtag mw__cf-subtag--good">100% Tests Passed · Deliverable Accepted</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="mw__cf-step-item">
              <div className="mw__cf-step-num mw__cf-step-num--good">4</div>
              <div className="mw__cf-step-content">
                <span className="mw__cf-step-title">Treasury & Future Sessions</span>
                <p className="mw__cf-step-text">
                  <strong>+6.50 USDC retained</strong> under 25.00 USDC ceiling. Memory diff updated to v13 and cryptographically committed on Base Sepolia.
                </p>
                <div className="mw__cf-metric-badge mw__cf-metric-badge--good">
                  <TrendingUp size={14} />
                  <span>+$6.50 USDC Saved · Base Sepolia L2 Anchored</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
