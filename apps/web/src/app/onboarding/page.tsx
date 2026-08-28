import type { Metadata } from "next";

import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";

export const metadata: Metadata = {
  title: "Get started — Aura Console",
  description: "What Aura Console does, what is ready, and what Aura stores.",
};

export default function OnboardingPage() {
  return (
    <main id="main">
      <OnboardingFlow />
    </main>
  );
}
