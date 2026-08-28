import type { ReactNode } from "react";

/**
 * The standard operator surface. `active` adds a soft glow, which is
 * atmosphere only: it never encodes state that is not also written out.
 */
export function Panel({
  title,
  meta,
  active = false,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`panel${active ? " panel--active" : ""}`}>
      {title || meta ? (
        <header className="panel__head">
          {title ? <h2 className="panel__title">{title}</h2> : null}
          {meta ? <div className="panel__meta">{meta}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
