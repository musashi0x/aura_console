"use client";

import { CatalogPage, CodeBlock, Section } from "@/components/catalog";

/* The page's own sections, so "On this page" links at anchors that exist. */
const TOC = [
  { id: "starting-point", title: "Starting point" },
  { id: "adding-a-component", title: "Adding a component" },
  { id: "rules", title: "Rules" },
];

export default function AiAgentsPage() {
  return (
    <CatalogPage
      toc={TOC}
      kicker="Getting Started / AI agents"
      title="AI agents"
      lede="How a coding agent should read and extend this catalog."
    >
      <Section id="starting-point" title="Starting point">
        <p className="text-sm leading-relaxed text-muted">
          `docs/design/` is the specification for this shell. Read `sona-ui-layout.md`
          first, then `components.md`, then `clone-map.md`. The code is the fact: if the
          docs drift, trust the code and update the docs.
        </p>
      </Section>

      <Section id="adding-a-component" title="Adding a component">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Follow the clone-map recipe: create the component under
          apps/web/src/components/catalog/, add a demo page under
          apps/web/src/app/docs/&lt;name&gt;/, and register it in the sidebar:
        </p>
        <CodeBlock>{`// desktop-docs-sidebar.tsx — groupedComponents
{ name: "My Component", href: "/docs/my-component", tag: "new"},`}</CodeBlock>
      </Section>

      <Section id="rules" title="Rules">
        <ul className="grid gap-1 text-sm leading-relaxed text-muted">
          <li>
            • Components are leaf client components: no data fetching, no Run claims.
          </li>
          <li>• Neutral palette + `dark:` variants only; cyan accent.</li>
          <li>• 44px targets, visible focus rings, reduced-motion respected.</li>
          <li>• `pnpm lint && pnpm typecheck && pnpm test` before finishing.</li>
        </ul>
      </Section>
    </CatalogPage>
  );
}
