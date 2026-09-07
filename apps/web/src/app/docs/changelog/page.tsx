"use client";

import { CatalogPage, Section } from "@/components/catalog";

const changelog = [
  {
    version: "0.1.0",
    date: "2026-08-31",
    notes: [
      "Catalog shell lands with the first component docs.",
      "Animated dropdown, dialog, accordion, fluid tabs and tooltip.",
      "Animated switch, button, expanding action, ripple button and fluid slider.",
    ],
  },
];

/* The page's own sections, so "On this page" links at anchors that exist. */
const TOC = [
  { id: "releases", title: "Releases" },
];

export default function ChangelogPage() {
  return (
    <CatalogPage
      toc={TOC}
      kicker="Getting Started / Changelog"
      title="Changelog"
      lede="What changed in the docs shell and catalog."
    >
      <Section id="releases" title="Releases">
        <ul className="grid gap-4">
          {changelog.map((release) => (
            <li key={release.version} className="rounded-xl border border-line p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">v{release.version}</h3>
                <span className="font-mono text-xs text-muted">{release.date}</span>
              </div>
              <ul className="mt-2 grid gap-1">
                {release.notes.map((note) => (
                  <li key={note} className="text-sm leading-relaxed text-muted">
                    {note}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </CatalogPage>
  );
}
