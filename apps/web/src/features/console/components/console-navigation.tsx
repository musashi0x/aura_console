"use client";

import Link from "next/link";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";

import {
  ListFilter,
  PlusCircle,
  MessageSquareCode,
  Users,
  ShieldCheck,
  Activity,
  BookOpen,
} from "lucide-react";
import type { IconType } from "@astryxdesign/core/Icon";

import { console_ } from "../copy";

const NAV_ICONS: Record<string, IconType> = {
  Missions: ListFilter as unknown as IconType,
  "New Mission": PlusCircle as unknown as IconType,
  "Chat Console": MessageSquareCode as unknown as IconType,
  Agents: Users as unknown as IconType,
  Guardrails: ShieldCheck as unknown as IconType,
  Network: Activity as unknown as IconType,
  Docs: BookOpen as unknown as IconType,
};

/**
 * The console's navigation, as the design system's own rail.
 *
 * Only destinations that exist. There is no account menu, organisation
 * switcher, or workspace switcher, because v0.1 has none of those things and a
 * control implying otherwise would misrepresent the product.
 *
 * Collapse is SideNav's own: it ships the toggle, the collapsed rail and the
 * accessible naming, which the console previously carried in a module store, a
 * topbar button and a hand-written `inert` rail. Deleting that in favour of the
 * component's version is the point of adopting the frame.
 */
export function ConsoleNavigation({
  surface,
  contextSelector,
}: {
  surface: string;
  contextSelector?: React.ReactNode;
}) {
  const item = (href: string, label: string) => (
    <SideNavItem
      key={href}
      as={Link}
      href={href}
      label={label}
      icon={NAV_ICONS[label]}
      isSelected={surface === label}
      data-sound="tick"
    />
  );

  return (
    /* SideNav renders a navigation landmark but exposes no `label` prop, and
       AppShell puts the top and side navigation in the tree as two landmarks —
       a screen reader lists both, so an unnamed one reads as a bare
       "navigation". aria-label forwards to the rendered <nav>. */
    <SideNav collapsible aria-label={console_.nav.label}>
      {contextSelector}
      {/* One group. The rail was two — a primary list and a "Reference" group
          holding Example Run, Readiness and Back to landing — and all three
          left it: the example Mission belongs in Missions, readiness belongs to
          Network and its status chip, and the landing page is reachable from
          the brand mark. */}
      <SideNavSection title={console_.nav.label} isHeaderHidden>
        {console_.nav.primary.map((entry) => item(entry.href, entry.label))}
      </SideNavSection>
    </SideNav>
  );
}
