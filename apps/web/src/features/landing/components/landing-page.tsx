import { landing } from "../copy";
import { CapabilitySection } from "./capability-section";
import { FinalCta } from "./final-cta";
import { Hero } from "./hero";
import { PreviewPanel } from "./preview-panel";
import { ReplaySection } from "./replay-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function LandingPage({ ready }: { ready: boolean }) {
  return (
    <>
      <SiteHeader ready={ready} />
      <main id="main" className="landing">
        <Hero />
        <PreviewPanel />
        {landing.capabilities.map((capability) => (
          <CapabilitySection key={capability.index} {...capability} />
        ))}
        <ReplaySection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
