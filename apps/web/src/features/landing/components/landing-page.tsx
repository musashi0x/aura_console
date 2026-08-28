import { ConsoleStory } from "./console-story";
import { EditorialStatement } from "./editorial-statement";
import { FinalCta } from "./final-cta";
import { OpeningWindow } from "./opening-window";
import { PrinciplesGrid } from "./principles-grid";
import { ReplayCounterfactual } from "./replay-counterfactual";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Seven scenes, one story. The page canvas is a bright editorial surface; the
 * dark Console styling is confined to the product window inside it.
 */
export function LandingPage({ ready }: { ready: boolean }) {
  return (
    <div className="lp">
      {/* Decorative dotted canvas. Ignored by assistive technology. */}
      <div className="lp-dots" aria-hidden="true" />
      <SiteHeader ready={ready} />
      <main id="main" className="lp-main">
        <OpeningWindow />
        <EditorialStatement />
        <PrinciplesGrid />
        <ConsoleStory />
        <ReplayCounterfactual />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
