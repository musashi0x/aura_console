"use client";

import { landing } from "../copy";
import { DrawablyLink } from "./drawably-link";
import { Reveal } from "./reveal";

/** Scene 7. Back to an almost empty canvas, with hand-drawn CTA buttons. */
export function FinalCta() {
  return (
    <section className="lp-cta" aria-labelledby="cta-heading">
      <Reveal>
        <h2
          id="cta-heading"
          className="lp-display"
          aria-label={landing.cta.headline.join(" ")}
        >
          {landing.cta.headline.map((line) => (
            <span key={line} className="lp-display__line">
              {line}{" "}
            </span>
          ))}
        </h2>
        <div className="lp-cta__actions">
          <DrawablyLink href="/runs/example" variant="solid" className="lp-btn lp-btn--primary">
            {landing.cta.primary}
          </DrawablyLink>
          <DrawablyLink href="/runs/new" variant="outline" className="lp-btn">
            {landing.cta.secondary}
          </DrawablyLink>
        </div>
        {/* Following either link creates nothing. Said plainly, not in a tooltip. */}
        <p className="lp-cta__note">{landing.cta.note}</p>
      </Reveal>
    </section>
  );
}
