import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleErrorState } from "@/features/console/components/console-states";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Policies — Aura Console" };

export default async function PoliciesPage() {
  const health = await apiClient.dbHealth();
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Policies" readiness={readiness}>
      <h1 className="cs__title">Policies</h1>
      {/* Policy is enforced on the server whether or not this surface can read
          it. Absence here is not absence of policy. */}
      <ConsoleErrorState
        domain="Policy"
        detail="No policy endpoint exists in v0.1, so Aura cannot show the operator policy or its version. Policy still applies on the server, and this surface will never display an assumed value."
      />
      <p className="cs__deferred">Tracked by task #30.</p>
    </ConsoleShell>
  );
}
