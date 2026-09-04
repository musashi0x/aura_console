"use client";

import { CatalogPage, CodeBlock, Section } from "@/components/catalog";

/* The page's own sections, so "On this page" links at anchors that exist. */
const TOC = [
  { id: "what-is-a-skill", title: "What is a skill" },
  { id: "scaffold-skill", title: "Example: scaffold a demo page" },
  { id: "conventions", title: "Conventions" },
];

export default function SkillsPage() {
  return (
    <CatalogPage
      toc={TOC}
      kicker="Getting Started / Skills"
      title="Skills"
      lede="Reusable agent skills for working in this repository."
    >
      <Section id="what-is-a-skill" title="What is a skill">
        <p className="text-sm leading-relaxed text-muted">
          A skill is a folder with a `SKILL.md` that teaches an agent a repeatable
          procedure. The catalog can ship skills alongside its components — for example, a
          skill that scaffolds a new demo page.
        </p>
      </Section>

      <Section id="scaffold-skill" title="Example: scaffold a demo page">
        <CodeBlock>{`# Scaffold a catalog page

1. Create the component in apps/web/src/components/catalog/.
2. Add a page under apps/web/src/app/docs/<name>/page.tsx
 using CatalogPage + Showcase + Section.
3. Register it in desktop-docs-sidebar.tsx groupedComponents.
4. Run pnpm lint && pnpm typecheck && pnpm test.`}</CodeBlock>
      </Section>

      <Section id="conventions" title="Conventions">
        <ul className="grid gap-1 text-sm leading-relaxed text-muted">
          <li>• One component per page, one idea per section.</li>
          <li>• Props tables are mandatory for interactive components.</li>
          <li>• Every page carries an accessibility section.</li>
        </ul>
      </Section>
    </CatalogPage>
  );
}
