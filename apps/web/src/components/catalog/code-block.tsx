"use client";

/**
 * A code block in a catalog guide page. Renders the standard mono `<pre>`
 * treatment used across the docs shell.
 *
 * `tabIndex` because the block scrolls sideways on a narrow screen and holds
 * nothing focusable, so a keyboard could not reach the rest of the line. axe
 * reports it as scrollable-region-focusable; `aria-label` gives the stop a name
 * rather than announcing an unlabelled region.
 */
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label="Code sample"
      className="overflow-x-auto rounded-lg border border-line bg-raised p-4 font-mono text-xs text-ink "
    >
      <code>{children}</code>
    </pre>
  );
}
