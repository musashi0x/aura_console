"use client";

import type { ReactNode } from "react";

/**
 * The bordered card that holds a live component demo in the catalog pages —
 * the sona-ui component-showcase equivalent. The demo renders inside; the card
 * is neutral-50/900 so a light component reads on either theme.
 */
export function Showcase({ children }: { children: ReactNode }) {
  return (
    <div className="mb-12 rounded-xl border border-line bg-raised p-1">
      <div className="grid min-h-[16rem] place-items-center rounded-[10px] bg-surface p-6">
        {children}
      </div>
    </div>
  );
}
