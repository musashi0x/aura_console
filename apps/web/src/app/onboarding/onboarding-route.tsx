"use client";

import { useRouter } from "next/navigation";

import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";

/** Wires the flow to real destinations. The flow itself stays router-free. */
export function OnboardingRoute() {
  const router = useRouter();

  return (
    <OnboardingFlow
      onSkip={() => router.push("/")}
      onFinish={(destination) =>
        router.push(destination === "run" ? "/runs/new" : "/runs/example")
      }
    />
  );
}
