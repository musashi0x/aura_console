import Link from "next/link";

import { landing } from "../copy";
import { Reveal } from "./reveal";

/** Scene 7. Back to an almost empty canvas. */
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
          <Link href="/runs/example" className="lp-btn lp-btn--primary">
            {landing.cta.primary}
          </Link>
          <Link href="/runs/new" className="lp-btn">
            {landing.cta.secondary}
          </Link>
        </div>
        {/* Following either link creates nothing. Said plainly, not in a tooltip. */}
        <p className="lp-cta__note">{landing.cta.note}</p>
      </Reveal>
    </section>
  );
}
