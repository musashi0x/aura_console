"use client";

import type { ReactNode } from "react";

/**
 * A `<section>` in a catalog guide page. `id` doubles as the anchor target so
 * the table of contents can link to it. `scroll-mt-16` keeps the anchored
 * heading clear of the floating topbar.
 */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-16">
      <h2 className="mb-3 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}
