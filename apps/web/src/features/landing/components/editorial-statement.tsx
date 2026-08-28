import { landing } from "../copy";
import { Reveal } from "./reveal";

/** Scene 2. One idea, centred, given the whole viewport. */
export function EditorialStatement() {
  return (
    <section className="lp-statement" aria-labelledby="statement-heading">
      <Reveal>
        <h2
          id="statement-heading"
          className="lp-display"
          // Split lines render as separate spans, and the accessible name
          // algorithm drops the whitespace between them. Label it explicitly.
          aria-label={landing.statement.headline.join(" ")}
        >
          {landing.statement.headline.map((line) => (
            <span key={line} className="lp-display__line">
              {line}{" "}
            </span>
          ))}
        </h2>
        <p className="lp-statement__body">{landing.statement.body}</p>
      </Reveal>
    </section>
  );
}
