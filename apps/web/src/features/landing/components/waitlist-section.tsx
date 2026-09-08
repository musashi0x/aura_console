"use client";

import { useState } from "react";
import { Reveal } from "./reveal";

export interface DesignPartner {
  name: string;
  role: string;
  network: string;
  status: string;
}

export const VERIFIED_DESIGN_PARTNERS: DesignPartner[] = [
  {
    name: "TreasuryGuard AI",
    role: "Autonomous DAO Treasury Protection & Escrow Verification",
    network: "Base Sepolia",
    status: "Active Pilot",
  },
  {
    name: "AutonomousProcure Protocol",
    role: "Automated On-Chain RFP & Counterparty Settlement",
    network: "Virtuals ACP",
    status: "Verified Partner",
  },
  {
    name: "Virtuals Fleet Alpha",
    role: "High-Frequency Task Execution & Spend Authorization",
    network: "Virtuals ACP",
    status: "Active Pilot",
  },
  {
    name: "Base Autonomous DAO",
    role: "Governance & Capital Allocation Verification",
    network: "Base Sepolia",
    status: "Active Pilot",
  },
  {
    name: "Aura Protocol Security",
    role: "Multi-Agent Cold-Start Validation & Memory Audit",
    network: "Cross-Chain",
    status: "Core Pilot",
  },
];

export interface WaitlistSectionProps {
  initialCount?: number;
}

/**
 * Waitlist and Design Partner section for Web PMF validation.
 * Features an interactive registration form with live counter increment,
 * verified AI agent procurement design partners, and a documented real-world
 * problem statement for autonomous agent treasury security.
 */
export function WaitlistSection({ initialCount = 142 }: WaitlistSectionProps) {
  const [count, setCount] = useState<number>(initialCount);
  const [agentId, setAgentId] = useState<string>("");
  const [org, setOrg] = useState<string>("");
  const [fleet, setFleet] = useState<string>("Virtuals ACP Fleet");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = agentId.trim();
    if (!cleanId) return;

    const nextCount = count + 1;
    setCount(nextCount);
    setStatusMessage(
      `Agent ${cleanId} registered for pilot fleet access. Waitlist position number ${nextCount} confirmed.`,
    );
    setAgentId("");
    setOrg("");
  };

  return (
    <section
      className="lp-waitlist"
      aria-labelledby="waitlist-heading"
      style={{
        padding: "var(--space-12) 0",
        borderTop: "1px solid var(--landing-line)",
      }}
    >
      <Reveal>
        <p className="lp-kicker">VERIFIED PMF &amp; PILOT NETWORK</p>
        <h2 id="waitlist-heading" className="lp-display lp-display--sm">
          <span className="lp-display__line">Autonomous Agent Waitlist </span>
          <span className="lp-display__line">&amp; Design Partners</span>
        </h2>
        <div
          className="lp-statement__body lp-statement__body--left"
          style={{
            margin: "var(--space-4) 0 var(--space-8)",
            maxWidth: "52rem",
          }}
        >
          <h3
            id="problem-statement-heading"
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--landing-ink)",
              marginBottom: "var(--space-2)",
            }}
          >
            Validated Real-World Problem Statement
          </h3>
          <p
            style={{
              margin: 0,
              color: "var(--landing-muted)",
              fontSize: "1rem",
              lineHeight: 1.6,
            }}
          >
            Autonomous procurement agents spending treasury without persistent
            counterparty reputation risk repeating costly vendor failures, unverified
            deliverables, and rapid treasury depletion. Aura provides tamper-proof
            Bayesian memory committed to Base Sepolia so autonomous fleets verify track
            records before releasing capital.
          </p>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
            gap: "var(--space-8)",
            marginBottom: "var(--space-12)",
          }}
        >
          {/* Live counter & registration form */}
          <div
            style={{
              background: "var(--landing-surface)",
              border: "1px solid var(--landing-line)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div data-testid="live-counter-display">
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.1em",
                  color: "var(--landing-muted)",
                  textTransform: "uppercase",
                  marginBottom: "var(--space-1)",
                }}
              >
                Pilot Fleet Size
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "var(--space-3)",
                }}
              >
                <span
                  data-testid="agent-counter"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "2.75rem",
                    fontWeight: 700,
                    color: "var(--landing-ink)",
                    lineHeight: 1,
                  }}
                >
                  {count}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    color: "var(--landing-muted)",
                    letterSpacing: "0.06em",
                  }}
                >
                  VERIFIED AI AGENTS
                </span>
              </div>
            </div>

            <form
              onSubmit={handleRegister}
              aria-label="Agent Waitlist Registration Form"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <label
                  htmlFor="waitlist-agent-id"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--landing-ink)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Agent Identifier or Public Key
                </label>
                <input
                  id="waitlist-agent-id"
                  name="agentId"
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="e.g. agent:procure-alpha or 0x..."
                  required
                  aria-required="true"
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "0 var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--landing-line)",
                    background: "var(--landing-canvas)",
                    color: "var(--landing-ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="waitlist-fleet-select"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--landing-ink)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Target Network Fleet
                </label>
                <select
                  id="waitlist-fleet-select"
                  name="fleet"
                  value={fleet}
                  onChange={(e) => setFleet(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "0 var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--landing-line)",
                    background: "var(--landing-canvas)",
                    color: "var(--landing-ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Virtuals ACP Fleet">Virtuals ACP Fleet</option>
                  <option value="Base Sepolia Fleet">Base Sepolia Fleet</option>
                  <option value="Autonomous DAO Fleet">Autonomous DAO Fleet</option>
                  <option value="Independent Operator">Independent Operator</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="waitlist-org-input"
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--landing-ink)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  Organization or Protocol (Optional)
                </label>
                <input
                  id="waitlist-org-input"
                  name="organization"
                  type="text"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder="e.g. Autonomous Treasury Guild"
                  style={{
                    width: "100%",
                    minHeight: "44px",
                    padding: "0 var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--landing-line)",
                    background: "var(--landing-canvas)",
                    color: "var(--landing-ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                className="lp-btn lp-btn--primary"
                style={{
                  minHeight: "44px",
                  cursor: "pointer",
                  marginTop: "var(--space-2)",
                  justifyContent: "center",
                }}
              >
                Register Agent
              </button>
            </form>

            {statusMessage ? (
              <div
                role="status"
                aria-live="polite"
                data-testid="registration-status"
                style={{
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--landing-ok)",
                  color: "var(--landing-ok)",
                  fontSize: "0.8125rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {statusMessage}
              </div>
            ) : null}
          </div>

          {/* Design Partners */}
          <div
            style={{
              background: "var(--landing-surface)",
              border: "1px solid var(--landing-line)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.1em",
                  color: "var(--landing-muted)",
                  textTransform: "uppercase",
                  marginBottom: "var(--space-1)",
                }}
              >
                Pilot Network
              </span>
              <h3
                id="partners-heading"
                style={{
                  margin: 0,
                  fontSize: "1.125rem",
                  color: "var(--landing-ink)",
                }}
              >
                Active Design Partners &amp; Pilot Fleet
              </h3>
            </div>

            <ul
              aria-labelledby="partners-heading"
              data-testid="partners-list"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              {VERIFIED_DESIGN_PARTNERS.map((partner) => (
                <li
                  key={partner.name}
                  style={{
                    borderTop: "1px solid var(--landing-line)",
                    paddingTop: "var(--space-2)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        color: "var(--landing-ink)",
                        fontSize: "0.9375rem",
                      }}
                    >
                      {partner.name}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        color: "var(--landing-muted)",
                        fontSize: "0.8125rem",
                        marginTop: "0.1rem",
                      }}
                    >
                      {partner.role}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.6875rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        border: "1px solid var(--landing-line)",
                        color: "var(--landing-ink)",
                      }}
                    >
                      {partner.network}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.6875rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        border: "1px solid var(--landing-ok)",
                        color: "var(--landing-ok)",
                      }}
                    >
                      {partner.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
