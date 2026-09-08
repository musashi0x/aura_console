import type { Metadata } from "next";
import { Fragment } from "react";

import { Server, Database, Brain, Activity, Link2, ShieldCheck, Bot } from "lucide-react";
import { MonoRef, Panel, StatusBadge, type StatusTone } from "@/components/primitives";
import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { apiClient, type SibylHealth } from "@/lib/api-client";

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  "Aura API": <Server size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
  "Event store": <Database size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
  "Sibyl Memory": <Brain size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
  "Virtuals ACP": <Activity size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
  "Base L2": <Link2 size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
  "Policy": <ShieldCheck size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
  "Agent runtime": <Bot size={14} className="text-[var(--color-accent)] inline mr-1.5" />,
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Readiness — Aura Console" };

/**
 * A field Sibyl did not send.
 *
 * Every reading below is optional on the wire, so each one needs a way to say
 * it is missing. Falling back to 0 or to an empty string would put a number on
 * screen that nothing measured — a store reading "0.00 MB" is a claim that
 * Sibyl is empty, which is not what a missing field means.
 */
const NOT_REPORTED = "not reported";

const MEBIBYTE = 1_048_576;

/**
 * Bytes exactly as Sibyl reported them. Never called with a substituted value.
 *
 * The divisor is a mebibyte and the label stays "MB", which is what this row
 * has always printed. Changing the unit on screen is a separate decision from
 * reporting the fields, and silently switching it would make old screenshots
 * and this reading disagree about the same store.
 */
function megabytes(bytes: number): string {
  return `${(bytes / MEBIBYTE).toFixed(2)} MB`;
}

interface Reading {
  label: string;
  value: string;
}

interface ReadinessRow {
  id: string;
  label: string;
  domain: string;
  tone: StatusTone;
  state: string;
  detail: string;
  /**
   * Present only on a row that measured something. A row with no readings is
   * not a row reading zero — it is a row that did not take a measurement.
   */
  readings?: Reading[];
}

/**
 * What Sibyl said about itself, one reading per field it sent.
 *
 * Store and soft cap are separate readings rather than one "x of y" string so
 * that a missing cap cannot make the size look unbounded and a missing size
 * cannot make the cap look met. Neither is derived from the other.
 */
function sibylReadings(status: SibylHealth): Reading[] {
  return [
    { label: "TIER", value: status.tier ?? NOT_REPORTED },
    {
      label: "SCHEMA",
      value: status.schemaVersion === undefined ? NOT_REPORTED : `v${status.schemaVersion}`,
    },
    {
      label: "ENTITIES",
      value: status.entityCount === undefined ? NOT_REPORTED : String(status.entityCount),
    },
    {
      label: "STORE",
      value: status.dbSizeBytes === undefined ? NOT_REPORTED : megabytes(status.dbSizeBytes),
    },
    {
      label: "SOFT CAP",
      value: status.softCapBytes === undefined ? NOT_REPORTED : megabytes(status.softCapBytes),
    },
  ];
}

/**
 * The readiness surface, moved off the root route when that became the landing
 * page. Rows report only what was actually checked: dependencies with no
 * browser-readable endpoint say so rather than being omitted or assumed.
 */
export default async function SystemPage() {
  const [liveness, database, sibyl, grounding, base, acp, policy, agent] = await Promise.all([
    apiClient.health(),
    apiClient.dbHealth(),
    apiClient.sibylHealth(),
    readGrounding(),
    typeof apiClient.baseHealth === "function"
      ? apiClient.baseHealth()
      : Promise.resolve({ ok: false as const }),
    typeof apiClient.acpHealth === "function"
      ? apiClient.acpHealth()
      : Promise.resolve({ ok: false as const }),
    typeof apiClient.policyHealth === "function"
      ? apiClient.policyHealth()
      : Promise.resolve({ ok: false as const }),
    typeof apiClient.agentHealth === "function"
      ? apiClient.agentHealth()
      : Promise.resolve({ ok: false as const }),
  ]);

  /* Sibyl reports itself. Three outcomes, and they are not interchangeable:
     the API could not be asked, Sibyl is not wired up in this deployment, or
     Sibyl answered. Only the third one may show a number, because only the
     third one measured anything.

     The shape is annotated rather than inferred so the branch that carries
     readings and the two that cannot stay assignable to the same row. */
  const sibylRow: Pick<ReadinessRow, "tone" | "state" | "detail" | "readings"> = (() => {
    if (!sibyl.ok) {
      return {
        tone: "error" as const,
        state: "UNAVAILABLE",
        detail:
          "The Aura API could not be asked about Sibyl, so nothing is known about relationship memory.",
      };
    }
    const status = sibyl.data;
    if (status.reachable) {
      /* At or above the soft cap is Sibyl's own conclusion, so it is stated
         rather than recomputed from the two readings — which would disagree
         with Sibyl the moment either field went missing. An undefined flag is
         not read as headroom: READY here has always meant "Sibyl answered",
         and nothing below claims the store has room left. */
      const atSoftCap = status.atOrAboveCap === true;
      return {
        tone: atSoftCap ? ("warning" as const) : ("ready" as const),
        state: atSoftCap ? "AT SOFT CAP" : "READY",
        detail: atSoftCap
          ? "Sibyl answered and reports its store at or above the soft cap it was configured with. Every reading below is Sibyl's own."
          : "Sibyl answered. Every reading below is Sibyl's own report, not a value this console derived.",
        readings: sibylReadings(status),
      };
    }
    /* Reachability failed, so there is nothing to read. The reason takes the
       place of the readings; it never takes the shape of one. */
    return {
      tone: "neutral" as const,
      state: status.configured ? "UNAVAILABLE" : "NOT CONNECTED",
      detail:
        status.detail ??
        "Sibyl Memory is not reachable from this deployment, so no relationship history is available.",
    };
  })();

  const baseRow: Pick<ReadinessRow, "tone" | "state" | "detail" | "readings"> = (() => {
    if (!base.ok) {
      return {
        tone: "error" as const,
        state: "UNAVAILABLE",
        detail: "The Aura API could not be asked about Base RPC.",
      };
    }
    const status = base.data;
    if (status.reachable) {
      return {
        tone: "ready" as const,
        state: "READY",
        detail: status.detail ?? "Base RPC is healthy and responding.",
        readings: [
          { label: "NETWORK", value: status.network },
          ...(status.blockNumber !== undefined ? [{ label: "BLOCK", value: `#${status.blockNumber}` }] : []),
          ...(status.latencyMs !== undefined ? [{ label: "LATENCY", value: `${status.latencyMs} ms` }] : []),
        ],
      };
    }
    return {
      tone: "neutral" as const,
      state: status.configured ? "UNAVAILABLE" : "NOT CONFIGURED",
      detail: status.detail ?? "Base RPC is not reachable from this deployment.",
    };
  })();

  const acpRow: Pick<ReadinessRow, "tone" | "state" | "detail" | "readings"> = (() => {
    if (!acp.ok) {
      return {
        tone: "error" as const,
        state: "UNAVAILABLE",
        detail: "The Aura API could not be asked about Virtuals ACP.",
      };
    }
    const status = acp.data;
    if (status.reachable) {
      return {
        tone: "ready" as const,
        state: status.mode === "live" ? "CONNECTED" : "ACTIVE",
        detail: status.detail,
        readings: [
          { label: "PROTOCOL", value: status.protocol },
          { label: "MODE", value: status.mode },
        ],
      };
    }
    return {
      tone: "neutral" as const,
      state: status.configured ? "UNAVAILABLE" : "NOT CONFIGURED",
      detail: status.detail,
    };
  })();

  const policyRow: Pick<ReadinessRow, "tone" | "state" | "detail" | "readings"> = (() => {
    if (!policy.ok) {
      return {
        tone: "neutral" as const,
        state: "NOT CHECKED",
        detail:
          "v0.1 exposes no policy endpoint, so Aura cannot verify this. Policy still applies on the server.",
      };
    }
    const status = policy.data;
    if (status.reachable) {
      if (status.verified) {
        return {
          tone: "ready" as const,
          state: "ACTIVE",
          detail: status.detail ?? `Operator policy v${status.policyVersion ?? 1} verified from database for ${status.agentId}.`,
          readings: [
            ...(status.policyVersion != null ? [{ label: "VERSION", value: `v${status.policyVersion}` }] : []),
            ...(status.autoSpendLimitUsdc != null ? [{ label: "AUTO SPEND", value: `$${status.autoSpendLimitUsdc} USDC` }] : []),
            ...(status.humanApprovalAboveUsdc != null ? [{ label: "APPROVAL", value: `>$${status.humanApprovalAboveUsdc} USDC` }] : []),
            ...(status.minimumReliability != null ? [{ label: "MIN RELIABILITY", value: `${status.minimumReliability}%` }] : []),
          ],
        };
      }
      return {
        tone: "neutral" as const,
        state: "DEFAULT",
        detail: status.detail ?? `Default operator guardrails active for ${status.agentId}.`,
        readings: [
          { label: "AGENT", value: status.agentId },
          { label: "MODE", value: "manual-approval" },
        ],
      };
    }
    return {
      tone: "neutral" as const,
      state: status.configured ? "UNAVAILABLE" : "NOT CHECKED",
      detail: status.detail ?? "Operator policy could not be verified.",
    };
  })();

  const agentRow: Pick<ReadinessRow, "tone" | "state" | "detail" | "readings"> = (() => {
    if (!agent.ok) {
      return {
        tone: "neutral" as const,
        state: "NOT CHECKED",
        detail: "Provided by server configuration and not read by the browser in v0.1.",
      };
    }
    const status = agent.data;
    if (status.reachable) {
      return {
        tone: "ready" as const,
        state: "VERIFIED",
        detail: status.detail ?? `Agent identity ${status.agentId ?? "active"} runtime verified and responsive.`,
        readings: [
          ...(status.agentId ? [{ label: "AGENT ID", value: status.agentId }] : []),
          ...(status.runtime ? [{ label: "RUNTIME", value: status.runtime }] : []),
          ...(status.apps && status.apps.length > 0 ? [{ label: "APPS", value: status.apps.join(", ") }] : []),
        ],
      };
    }
    return {
      tone: "neutral" as const,
      state: status.configured ? "UNAVAILABLE" : "NOT CHECKED",
      detail: status.detail ?? "Provided by server configuration and not read by the browser in v0.1.",
    };
  })();

  const rows: ReadinessRow[] = [
    {
      id: "api",
      label: "API reachable",
      domain: "Aura API",
      tone: liveness.ok ? ("ready" as const) : ("error" as const),
      state: liveness.ok ? "READY" : "UNAVAILABLE",
      detail: liveness.ok
        ? "Responding."
        : "The Aura API is not responding, so no Run can be started or read. Start it with pnpm dev.",
    },
    {
      id: "database",
      label: "Database",
      domain: "Event store",
      tone: database.ok ? ("ready" as const) : ("error" as const),
      state: database.ok ? "READY" : "UNAVAILABLE",
      detail: database.ok
        ? `Responded in ${database.data.latencyMs} ms.`
        : "The API cannot reach Postgres, so Runs cannot be recorded or replayed.",
    },
    {
      id: "sibyl",
      label: "Relationship memory",
      domain: "Sibyl Memory",
      tone: sibylRow.tone,
      state: sibylRow.state,
      detail: sibylRow.detail,
      readings: sibylRow.readings,
    },
    {
      id: "acp",
      label: "Virtuals ACP",
      domain: "Virtuals ACP",
      tone: acpRow.tone,
      state: acpRow.state,
      detail: acpRow.detail,
      readings: acpRow.readings,
    },
    {
      id: "base",
      label: "Base RPC",
      domain: "Base L2",
      tone: baseRow.tone,
      state: baseRow.state,
      detail: baseRow.detail,
      readings: baseRow.readings,
    },
    {
      id: "policy",
      label: "Operator policy",
      domain: "Policy",
      tone: policyRow.tone,
      state: policyRow.state,
      detail: policyRow.detail,
      readings: policyRow.readings,
    },
    {
      id: "agent",
      label: "Agent identity",
      domain: "Agent runtime",
      tone: agentRow.tone,
      state: agentRow.state,
      detail: agentRow.detail,
      readings: agentRow.readings,
    },
  ];

  return (
    <ConsoleShell
      surface="Network"
      readiness={database.ok ? "ready" : "degraded"}
      grounding={grounding}
    >
      <h1 className="cs__title">Readiness</h1>
      <p className="cs__lede">
        Aura reports only what it verified. Anything it cannot check is listed as not checked
        rather than assumed.
      </p>

      <ul className="sys">
        {rows.map((row) => (
          <li key={row.id}>
            <Panel
              title={
                <span>
                  {DOMAIN_ICONS[row.domain]}
                  <span>{row.label}</span>
                </span>
              }
              meta={<MonoRef label="DOMAIN">{row.domain}</MonoRef>}
            >
              <p className="sys__state">
                <StatusBadge tone={row.tone}>{row.state}</StatusBadge>
              </p>
              <p className="sys__detail">{row.detail}</p>
              {row.readings ? (
                <p className="sys__detail">
                  {row.readings.map((reading, index) => (
                    <Fragment key={reading.label}>
                      {index > 0 ? " · " : null}
                      <MonoRef label={reading.label}>{reading.value}</MonoRef>
                    </Fragment>
                  ))}
                </p>
              ) : null}
            </Panel>
          </li>
        ))}
      </ul>
    </ConsoleShell>
  );
}
