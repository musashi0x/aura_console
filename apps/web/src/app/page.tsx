import { FirstRunGate } from "@/features/onboarding/components/first-run-gate";
import { LandingPage } from "@/features/landing/components/landing-page";
import { apiClient } from "@/lib/api-client";

// Readiness must reflect the current state on every request, never a build
// time snapshot, because the header reports it as verified.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await apiClient.dbHealth();

  return (
    <>
      {/* A genuinely new browser session is still routed through onboarding.
          A returning operator gets the landing page. */}
      <FirstRunGate />
      <LandingPage ready={result.ok} />
    </>
  );
}
