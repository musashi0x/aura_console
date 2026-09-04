"use client";

import type { ReactNode } from "react";

import { DocsPageShell } from "@/components/docs/docs-page-shell";
import { TableOfContents, type TocSection } from "@/components/docs/table-of-contents";

/**
 * The standard guide page for the component catalog. Renders the docs/design
 * center-article template: kicker, title, lede, the component showcase card,
 * then the doc sections. `DocsLayoutShell` is provided by the `/docs` route
 * layout; `/demo/*` pages wrap this in the shell themselves.
 */
export function CatalogPage({
  kicker,
  title,
  lede,
  children,
  rightPanel,
  toc,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
  rightPanel?: ReactNode;
  /** The page's own sections. Required: see TableOfContents for why there is
   *  no default. */
  toc: TocSection[];
}) {
  return (
    <DocsPageShell rightPanel={rightPanel}>
      <article className="h-full w-full overflow-y-auto p-5 pt-[5.5rem] md:p-10 md:pt-16 lg:p-14 lg:pt-16">
        {/* 82ch is the measure of the prose column alone. The rail (w-48) and the
 gap are added on top, otherwise the article loses a third of its width
 on xl and reflows when the rail drops out below it. */}
        <div className="mx-auto flex w-full max-w-[calc(82ch+14.5rem)] gap-10">
          <div className="mx-auto w-full min-w-0 max-w-[82ch] flex-1">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {kicker}
            </p>
            <h1 className="mb-2 text-3xl font-semibold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mb-8 text-sm text-muted">{lede}</p>
            {children}
          </div>
          {/* Sticky in-page navigation on wide screens. */}
          <div className="hidden shrink-0 xl:block">
            <TableOfContents sections={toc} />
          </div>
        </div>
      </article>
    </DocsPageShell>
  );
}
