"use client";

import Link from "next/link";

export type TocSection = {
  id: string;
  title: string;
  level?: 2 | 3;
};

/**
 * The "On this page" rail. Anchors are the `id`s on the catalog `Section`
 * components.
 *
 * `sections` is REQUIRED, and there is no default. It used to fall back to a
 * component-page outline inherited from the catalog this shell was borrowed
 * from — introduction / install / usage / api / props / accessibility — none of
 * which exist on any page here. Every "On this page" link on every docs page
 * pointed at an anchor that was not in the document. A page that forgets to
 * pass its sections now renders nothing, which is visibly missing rather than
 * quietly wrong.
 */
export function TableOfContents({ sections }: { sections: TocSection[] }) {
  if (sections.length === 0) return null;
  return (
    <aside className="hidden w-48 shrink-0 xl:block" aria-label="Page contents">
      <div className="sticky top-20">
        {/* h2, not h4. The article's own sections are h2, so an h4 here skipped
            two levels and axe reported heading-order on every docs page. The
            size is a utility class, not the level — the level is what a screen
            reader navigates by. */}
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          On this page
        </h2>
        <nav className="flex flex-col gap-1 border-l border-line pl-3">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`#${section.id}`}
              className={`text-xs text-muted transition-colors hover:text-ink   ${
                section.level === 3 ? "ml-3" : ""
              }`}
            >
              {section.title}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
