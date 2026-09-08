import { landing } from "../copy";
import { Reveal } from "./reveal";

/**
 * Scene 3. Structure comes from whitespace and alignment, not from borders.
 * Deliberately not feature cards.
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
              <p className="lp-principle__index" aria-hidden="true">
                {principle.index}
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
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
