import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { NewRunForm } from "@/features/console/components/new-run-form";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Start a Run — Aura Console" };

/**
 * Create a Run against the real endpoint.
 *
 * Readiness is checked first and disables the form when the store cannot be
 * read, so the operator learns before typing rather than after submitting. A
 * Run is only reported as created once the server has said so.
 */
export default async function NewRunPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Runs" readiness={health.ok ? "ready" : "degraded"}>
      <h1 className="cs__title">Start a Run</h1>
      <p className="cs__lede">
        A Run is one economic objective from start to finish. Creating it records the objective and
        its ceiling. It does not authorize spending and takes no economic action.
      </p>
      <NewRunForm disabled={!health.ok} />
    </ConsoleShell>
  );
}
