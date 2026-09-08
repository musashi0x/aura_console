import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { GuardrailsDashboard } from "@/features/console/components/guardrails-dashboard";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Guardrails & Policies — Aura Console" };

export default async function PoliciesPage() {
  const [health, grounding] = await Promise.all([apiClient.dbHealth(), readGrounding()]);
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Guardrails" readiness={readiness} grounding={grounding}>
      <h1 className="cs__title">Guardrails & Policies</h1>
      <p className="cs__lede">
        Runtime economic barriers, execution sandbox boundaries, and cryptographic verification policies governing agent operations.
      </p>

      <GuardrailsDashboard />
    </ConsoleShell>
  );
}
