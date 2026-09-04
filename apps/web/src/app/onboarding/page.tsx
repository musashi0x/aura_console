import type { Metadata } from "next";

import { SkipLink } from "@/components/skip-link";

import { OnboardingRoute } from "./onboarding-route";

export const metadata: Metadata = {
  title: "Get started — Aura Console",
  description: "What Aura Console does, what is ready, and what Aura stores.",
};

export default function OnboardingPage() {
  return (
    <>
      <SkipLink />
      <main id="main">
        <OnboardingRoute />
      </main>
    </>
  );
}
