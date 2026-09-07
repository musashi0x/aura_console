"use client";

import { CatalogPage, CodeBlock, Section } from "@/components/catalog";

/* The page's own sections, so "On this page" links at anchors that exist. */
const TOC = [
  { id: "prerequisites", title: "Prerequisites" },
  { id: "add-a-component", title: "Add a component" },
  { id: "manual", title: "Manual install" },
  { id: "themes", title: "Theming" },
];

export default function InstallationPage() {
  return (
    <CatalogPage
      toc={TOC}
      kicker="Getting Started / Installation"
      title="Installation"
      lede="Add any catalog component to your project with one command."
    >
      <Section id="prerequisites" title="Prerequisites">
        <p className="text-sm leading-relaxed text-muted">
          Aura Console runs on Node 22+, pnpm 10+, and Next.js 16 with React 19. The
          catalog components depend on `motion` and Tailwind CSS; both are already in the
          web app.
        </p>
      </Section>

      <Section id="add-a-component" title="Add a component">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Every catalog page ships its install command:
        </p>
        <CodeBlock>{`npx shadcn@latest add @aura/animated-dropdown`}</CodeBlock>
      </Section>

      <Section id="manual" title="Manual install">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Copy the component file from `apps/web/src/components/catalog/` into your own
          components folder. Each component is self-contained except for the `cn` utility
          and `motion`.
        </p>
        <CodeBlock>{`import { AnimatedDropdown } from "@/components/catalog";
// or copy the file and import from your local path`}</CodeBlock>
      </Section>

      <Section id="themes" title="Theming">
        <p className="text-sm leading-relaxed text-muted">
          Components use the sona-ui neutral palette with dark: variants. They follow the
          page&apos;s dark class on the html element — see Theming.
        </p>
      </Section>
    </CatalogPage>
  );
}
