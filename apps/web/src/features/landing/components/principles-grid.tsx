"use client";

import { DrawablyBadge, DrawablyCard } from "drawably/react";

import { landing } from "../copy";
import { Reveal } from "./reveal";

/**
 * Scene 3. Principles enhanced with hand-drawn physical cards and sketched index badges.
 */
export function PrinciplesGrid() {
  return (
    <section className="lp-principles" aria-labelledby="principles-heading">
      <h2 id="principles-heading" className="visually-hidden">
        How Aura Console works
      </h2>
      <div className="lp-principles__grid">
        {landing.principles.map((principle, i) => (
          <Reveal key={principle.index} delay={i * 90}>
            <article className="lp-principle" aria-labelledby={`principle-${principle.index}`}>
              <DrawablyCard className="lp-principle-card">
                <p className="lp-principle__index">
                  <DrawablyBadge variant="outline" className="lp-principle__badge">
                    {principle.index}
                  </DrawablyBadge>
                </p>
                <h3
                  id={`principle-${principle.index}`}
                  className="lp-principle__title"
                  aria-label={principle.title.join(" ")}
                >
                  {principle.title.map((line) => (
                    <span key={line} className="lp-principle__line">
                      {line}{" "}
                    </span>
                  ))}
                </h3>
                <p className="lp-principle__body">{principle.body}</p>
              </DrawablyCard>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
