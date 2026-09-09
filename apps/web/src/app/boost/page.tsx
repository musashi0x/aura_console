import { LandingPage } from "@/features/landing/components/landing-page";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function BoostLandingPage() {
  const result = await apiClient.dbHealth();

  return <LandingPage ready={result.ok} />;
}
