import { console_ } from "@/features/console/copy";

export type NavItem = {
  name: string;
  href: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * The docs shell's menu is the project's menu.
 *
 * The Console group is derived from `console_.nav` rather than restated. That
 * file is the reviewed home of console navigation, so deriving it here means
 * the two menus cannot drift apart. `/docs` is filtered out because the groups
 * below already cover the documentation.
 *
 * Entries carry no "new" or "soon" badge. Each console surface reports its own
 * state — Counterparties and Policies name what is still deferred, Readiness
 * reports only what actually answered — and a badge here would be a second
 * claim about that state to keep in sync with them.
 */
const consoleSurfaces: NavItem[] = console_.nav.primary
  .filter((entry) => entry.href !== "/docs")
  .map((entry) => ({ name: entry.label, href: entry.href }));

export const docsNav: NavSection[] = [
  {
    title: "Console",
    items: consoleSurfaces,
  },
  {
    title: "Getting started",
    items: [
      { name: "Documentation home", href: "/docs" },
      { name: "Installation & Setup", href: "/docs/installation" },
      { name: "Onboarding", href: "/onboarding" },
      { name: "Changelog", href: "/docs/changelog" },
    ],
  },
  {
    title: "Agents & memory",
    items: [
      { name: "AI agents", href: "/docs/ai-agents" },
      { name: "Skills", href: "/docs/skills" },
    ],
  },
  {
    title: "Interface",
    items: [{ name: "Theming", href: "/docs/theming" }],
  },
];

export const navItemCount = docsNav.reduce(
  (total, section) => total + section.items.length,
  0,
);
