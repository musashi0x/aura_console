import { MonoRef, StatusBadge } from "@/components/primitives";

import { landing } from "../copy";
import { Reveal } from "./reveal";

/**
 * Static illustration of a Run. It is labelled a preview twice, in the badge
 * and in the note, because an operator must never mistake it for live data or
 * believe a Run exists. Real data replaces this once the Console shell lands.
 */
export function PreviewPanel() {
  const { preview } = landing;

  return (
    <section className="preview" aria-labelledby="preview-heading">
      <Reveal>
        <h2 id="preview-heading" className="visually-hidden">
          Static preview of a Run
        </h2>
        <div className="preview__frame">
          <div className="preview__bar">
            <MonoRef label="RUN">{preview.runId}</MonoRef>
            <StatusBadge tone="neutral">{preview.label}</StatusBadge>
          </div>

          <dl className="preview__rows">
            {preview.rows.map((row) => (
              <div key={row.key} className="preview__row">
                <dt>{row.key}</dt>
                <dd>
                  <StatusBadge tone={row.tone}>{row.value}</StatusBadge>
                </dd>
              </div>
            ))}
          </dl>

          <ol className="preview__timeline">
            {preview.timeline.map((entry, index) => (
              <li key={entry} className="preview__event">
                <span className="preview__index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {entry}
              </li>
            ))}
          </ol>

          <p className="preview__note">{preview.note}</p>
        </div>
      </Reveal>
    </section>
  );
}
