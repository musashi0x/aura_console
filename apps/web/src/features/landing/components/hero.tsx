import Link from "next/link";

import { landing } from "../copy";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <Reveal>
        <h1 id="hero-heading" className="hero__headline">
          {landing.hero.headline.map((line) => (
            <span key={line} className="hero__line">
              {line}
            </span>
          ))}
        </h1>
        <p className="hero__sub">{landing.hero.sub}</p>
        <div className="hero__actions">
          <Link href="/runs/example" className="btn btn--primary">
            {landing.hero.primary}
          </Link>
          <Link href="/onboarding" className="btn">
            {landing.hero.secondary}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
