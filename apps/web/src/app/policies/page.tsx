import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { DataUnavailable } from "@/features/console/components/data-unavailable";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Policies — Aura Console" };

export default async function PoliciesPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Policies" ready={health.ok}>
      <h1 className="cs__title">Policies</h1>
      {/* Policy is enforced on the server regardless of whether this surface
          can read it. Absence here is not absence of policy. */}
      <DataUnavailable
        title="Policy is not readable from the browser"
        body="No policy endpoint exists in v0.1, so Aura cannot show the operator policy or its version. Policy still applies on the server; this surface simply cannot verify it, and it will never display an assumed value."
        owner="task #30"
      />
    </ConsoleShell>
  );
}
