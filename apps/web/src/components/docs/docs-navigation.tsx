"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";

import { docsNav } from "@/components/docs/nav";

/**
 * The documentation rail, as the design system's own.
 *
 * The sections come from `nav.ts`, whose Console group is derived from
 * `console_.nav` — so the docs menu and the console menu cannot drift apart.
 * Collapse, the collapsed rail and the mobile drawer are SideNav's and
 * AppShell's; this file previously had a hand-built desktop pane, a separate
 * mobile drawer with its own FAB, and a peel layer mounting a second copy of
 * the same nav.
 */
export function DocsNavigation() {
  const pathname = usePathname();

  return (
    <SideNav collapsible aria-label="Documentation">
      {docsNav.map((section) => (
        <SideNavSection key={section.title} title={section.title}>
          {section.items.map((item) => (
            <SideNavItem
              key={item.href}
              as={Link}
              href={item.href}
              label={item.name}
              /* Exact match only. A `startsWith` test marks "Documentation
                 home" as current on every /docs/* page, so the rail would show
                 two destinations selected at once. */
              isSelected={pathname === item.href}
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );
}
