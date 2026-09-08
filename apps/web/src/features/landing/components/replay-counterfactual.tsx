import { landing } from "../copy";
import { Reveal } from "./reveal";

/**
 * Scene 6. The unavailable side says unavailable. It never fills the gap with
 * invented history, which is the whole point of showing the pair.
 */
export function ReplayCounterfactual() {
  const { replay } = landing;
  const { counterfactual } = replay;

  return (
    <section className="lp-replay" aria-labelledby="replay-heading">
      <Reveal>
        <p className="lp-kicker">{replay.kicker}</p>
        <h2
          id="replay-heading"
          className="lp-display lp-display--sm"
          aria-label={replay.headline.join(" ")}
        >
          {replay.headline.map((line) => (
            <span key={line} className="lp-display__line">
              {line}{" "}
            </span>
          ))}
        </h2>
        <p className="lp-statement__body lp-statement__body--left">{replay.body}</p>
      </Reveal>

      <Reveal delay={80}>
        <div className="lp-modes">
          {replay.modes.map((mode) => (
            <div key={mode.key} className="lp-mode">
              <span className="lp-mode__key">{mode.key}</span>
              <span className="lp-mode__value">{mode.value}</span>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="lp-window lp-window--console lp-counterfactual">
          <span className="lp-window__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <p className="lp-counterfactual__title">{counterfactual.title}</p>
          <div className="lp-counterfactual__pair">
            {[counterfactual.available, counterfactual.unavailable].map((side) => (
              <div key={side.label} className="lp-counterfactual__side">
                <span className={`lp-console__value lp-console__value--${side.tone}`}>
                  <span aria-hidden="true">{side.tone === "ready" ? "✓ " : "! "}</span>
                  {side.label}
                </span>
                <p className="lp-counterfactual__provider">{side.provider}</p>
                <p className="lp-counterfactual__amount">{side.amount}</p>
                <p className="lp-counterfactual__reason">{side.reason}</p>
              </div>
            ))}
          </div>
          <p className="lp-console__note">{counterfactual.note}</p>
        </div>
      </Reveal>
    </section>
  );
}
