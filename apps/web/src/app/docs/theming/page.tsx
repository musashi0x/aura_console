"use client";

import { CatalogPage, CodeBlock, Section } from "@/components/catalog";

const swatches = [
  { name: "Canvas", light: "bg-surface", dark: "", note: "page background" },
  { name: "Surface", light: "bg-raised", dark: "", note: "cards and panels" },
  { name: "Raised", light: "bg-raised", dark: "", note: "chips, wells" },
  { name: "Border", light: "border-line", dark: "", note: "hairlines" },
  { name: "Accent", light: "bg-accent", dark: "", note: "primary actions" },
];

/* The page's own sections, so "On this page" links at anchors that exist. */
const TOC = [
  { id: "palette", title: "Palette" },
  { id: "dark-mode", title: "Dark mode" },
  { id: "tokens", title: "Relation to Aura tokens" },
];

export default function ThemingPage() {
  return (
    <CatalogPage
      toc={TOC}
      kicker="Getting Started / Theming"
      title="Theming"
      lede="The docs shell keeps sona-ui's neutral palette as its own layer, toggled by a `dark` class."
    >
      <Section id="palette" title="Palette">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          The catalog layer is distinct from the Console&apos;s operational tokens and the
          landing&apos;s editorial tokens. It uses Tailwind&apos;s `neutral` scale:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {swatches.map((swatch) => (
            <div
              key={swatch.name}
              className="flex items-center gap-3 rounded-xl border border-line p-3"
            >
              <span
                aria-hidden="true"
                className={`size-8 shrink-0 rounded-lg border border-line  ${swatch.light} ${swatch.dark}`}
              />
              <div>
                <p className="text-sm font-medium text-ink">{swatch.name}</p>
                <p className="text-xs text-muted">{swatch.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="dark-mode" title="Dark mode">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          The docs shell defaults to dark. The topbar theme toggle flips the dark class on
          the html element, and every component carries dark: variants:
        </p>
        <CodeBlock>{`document.documentElement.classList.toggle("dark", next === "dark");`}</CodeBlock>
      </Section>

      <Section id="tokens" title="Relation to Aura tokens">
        <p className="text-sm leading-relaxed text-muted">
          Console surfaces keep the `--color-*` tokens; the catalog layer keeps the
          neutral classes. See `docs/design/tokens-and-theming.md` for the full boundary.
        </p>
      </Section>
    </CatalogPage>
  );
}
