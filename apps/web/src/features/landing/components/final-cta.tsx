import Link from "next/link";

import { landing } from "../copy";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="cta" aria-labelledby="cta-heading">
      <Reveal>
        <h2 id="cta-heading" className="cta__headline">
          {landing.cta.headline.map((line) => (
            <span key={line} className="cta__line">
              {line}
            </span>
          ))}
        </h2>
        <div className="cta__actions">
          <Link href="/runs/new" className="btn btn--primary">
            {landing.cta.primary}
          </Link>
          <Link href="/runs/example" className="btn">
            {landing.cta.secondary}
          </Link>
        </div>
        {/* Stated plainly: following either link creates nothing. */}
        <p className="cta__note">{landing.cta.note}</p>
      </Reveal>
    </section>
  );
}
