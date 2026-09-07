# clone-map — sona-ui → Aura Console

How the sona-ui documentation shell patterns map onto Aura Console's docs
shell, so "clone all" is deterministic. Reference:
[sona-ui](https://github.com/Dinil-Thilakarathne/sona-ui) (Dinil-Thilakarathne).

## Pattern map

| sona-ui pattern | In sona-ui | Aura equivalent | Where |
|---|---|---|---|
| Floating glass topbar | `header` with backdrop blur, sidebar toggle + action buttons | `Topbar` | `apps/web/src/components/docs/topbar.tsx` |
| Animated sidebar drawer | Sidebar springs from the left | `DocsPageShell` left pane + `DesktopDocsSidebar` | `apps/web/src/components/docs/` |
| Component showcase card | Rounded card holding the live component | Center `<article>` with the component in a bordered card | `apps/web/src/app/demo/agent-plan/page.tsx` |
| Focus panel / docs-page-navigation | Right-hand detail panel | `DocsPageShell` `rightPanel` prop | `apps/web/src/components/docs/docs-page-shell.tsx` |
| Docs table of contents | Sticky "On this page" rail | `TableOfContents` | `apps/web/src/components/docs/table-of-contents.tsx` |
| Docs layout shell context | Shared open/close state | `DocsLayoutShell` + `useDocsFocusPanelState` | `apps/web/src/components/docs/docs-layout-shell.tsx` |
| Dark `neutral-950` canvas | `bg-neutral-950` | Kept as `dark:bg-neutral-950` (keep-neutral) | docs components |
| Cyan accent | `cyan-500` focus rings, active markers | `ring-cyan-500`, `text-cyan-600`, `before:bg-cyan-500` | docs components |
| Spring drawer motion | `motion` springs | `{ type: "spring", bounce: 0, duration: 0.48 }`, reduced-motion → 0 | `docs-page-shell.tsx` |
| New/updated badges | Coloured dots | `bg-emerald-500` / `bg-blue-500` dots + `sr-only` word | `desktop-docs-sidebar.tsx` |

## Page template

To add a new component doc page (e.g. `/demo/<name>`), follow
`apps/web/src/app/demo/agent-plan/page.tsx`:

1. `"use client"` page.
2. Wrap in `<DocsLayoutShell>`.
3. Render `<DocsPageShell rightPanel={...}>` with the guide `<article>` inside.
4. Center article shell: `h-full w-full overflow-y-auto p-5 pt-22 md:p-10
   md:pt-16 lg:p-14 lg:pt-16`, inner `mx-auto max-w-[82ch]`.
5. Kicker: `font-mono text-[10px] uppercase tracking-[0.16em]
   text-neutral-500 dark:text-neutral-400`.
6. Sections: `<section id="..." className="mb-12 scroll-mt-16">` with
   `h2 text-2xl font-semibold tracking-tight`.
7. Code blocks: `pre.overflow-x-auto.rounded-lg.border.border-neutral-200
   .bg-neutral-50.p-4.font-mono.text-xs.dark:border-neutral-800
   .dark:bg-neutral-900`.
8. The component under showcase sits in a rounded bordered card
   (`rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800
   dark:bg-neutral-900`).

## To add a new component to the catalog

1. Create the component in `apps/web/src/components/<area>/` (e.g. `agent/`).
2. Add a demo page under `apps/web/src/app/demo/<name>/page.tsx` using the
   template above.
3. Add a nav entry in `DesktopDocsSidebar`'s `groupedComponents` (and the
   mobile `Sidebar`'s copy if it stays in sync).
4. Link it from the `/docs` home `guides` array.

## Rules inherited from sona-ui

- Components are copy-paste friendly and fully typed.
- Motion uses springs with sensible easing and honours reduced motion.
- Real interactive elements with keyboard support and ARIA wiring.
- Themed via Tailwind; the docs shell uses the `neutral` scale + `dark:`
  variants (keep-neutral, see [tokens-and-theming.md](tokens-and-theming.md)).
