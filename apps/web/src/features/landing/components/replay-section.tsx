import { landing } from "../copy";
import { Reveal } from "./reveal";

export function ReplaySection() {
  const { replay } = landing;

  return (
    <section className="capability" id="section-04" aria-labelledby="section-04-heading">
      <Reveal>
        <p className="capability__kicker">
          <span className="capability__index">{replay.index}</span>
          {replay.kicker}
        </p>
        <h2 id="section-04-heading" className="capability__headline">
          {replay.headline.map((line) => (
            <span key={line} className="capability__line">
              {line}
            </span>
          ))}
        </h2>
        <p className="capability__body">{replay.body}</p>
        <dl className="capability__points">
          {replay.states.map((state) => (
            <div key={state.key} className="capability__point">
              <dt>{state.key}</dt>
              <dd>{state.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
