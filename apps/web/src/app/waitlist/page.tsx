import type { Metadata } from "next";

import { SkipLink } from "@/components/skip-link";
import { SiteFooter } from "@/features/landing/components/site-footer";
import { SiteHeader } from "@/features/landing/components/site-header";
import { WaitlistSection } from "@/features/landing/components/waitlist-section";
import { apiClient } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Waitlist & Design Partners — Aura Console",
  description:
    "Autonomous agent procurement waitlist and verified design partners for treasury protection.",
};

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const result = await apiClient.dbHealth();

  return (
    <div className="lp">
      <div className="lp-dots" aria-hidden="true" />
      <SiteHeader ready={result.ok} />
      <SkipLink />
      <main
        id="main"
        className="lp-main"
        style={{
          maxWidth: "68rem",
          margin: "0 auto",
          padding: "var(--space-8) var(--space-6) var(--space-16)",
        }}
      >
        <WaitlistSection />
      </main>
      <SiteFooter />
    </div>
  );
}
