import { landing } from "../copy";

/**
 * The dark operational surface, embedded in the bright page. This is the only
 * place Console styling appears on the landing page.
 *
 * `activeIndex` only changes emphasis. Every event stays legible at all times,
 * because content must not depend on scroll position to be readable.
 */
export function ConsolePreview({ activeIndex = -1 }: { activeIndex?: number }) {
  const { console: c } = landing;

  return (
    <div className="lp-window lp-window--console">
      <span className="lp-window__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>

      <div className="lp-console__bar">
        <span className="lp-console__run">{c.runId}</span>
        <span className="lp-console__label">{c.label}</span>
      </div>

      <dl className="lp-console__rows">
        {c.rows.map((row) => (
          <div key={row.key} className="lp-console__row">
            <dt>{row.key}</dt>
            <dd className={`lp-console__value lp-console__value--${row.tone}`}>
              <span aria-hidden="true">{row.tone === "ready" ? "✓ " : "– "}</span>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <ol className="lp-console__events">
        {c.events.map((event, index) => (
          <li
            key={event.title}
            className="lp-console__event"
            data-active={index === activeIndex ? "true" : "false"}
          >
            <span className="lp-console__seq" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="lp-console__event-body">
              <span className="lp-console__event-title">{event.title}</span>
              <span className="lp-console__event-detail">{event.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="lp-console__note">{c.note}</p>
    </div>
  );
}
