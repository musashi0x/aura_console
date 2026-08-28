import { Reveal } from "./reveal";

export interface CapabilityPoint {
  key: string;
  value: string;
}

/**
 * One idea per section. The metadata rows are monospace because they stand in
 * for real identifiers and states, which is where the terminal character
 * belongs; the headline and body stay sans so they read as product prose.
 */
export function CapabilitySection({
  index,
  kicker,
  headline,
  body,
  points,
}: {
  index: string;
  kicker: string;
  headline: readonly string[];
  body: string;
  points: readonly CapabilityPoint[];
}) {
  const id = `section-${index}`;

  return (
    <section className="capability" id={id} aria-labelledby={`${id}-heading`}>
      <Reveal>
        <p className="capability__kicker">
          <span className="capability__index">{index}</span>
          {kicker}
        </p>
        <h2 id={`${id}-heading`} className="capability__headline">
          {headline.map((line) => (
            <span key={line} className="capability__line">
              {line}
            </span>
          ))}
        </h2>
        <p className="capability__body">{body}</p>
        <dl className="capability__points">
          {points.map((point) => (
            <div key={point.key} className="capability__point">
              <dt>{point.key}</dt>
              <dd>{point.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
