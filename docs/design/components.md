# Components

Per-component specification for the docs shell. All files live under
`apps/web/src/components/` unless noted. Class names quoted are literal —
grep the source to confirm before refactoring.

## DocsLayoutShell — `docs/docs-layout-shell.tsx`

State provider for the whole shell.

- **Props**: `{ children: ReactNode }`.
- **Owns**: `navOpen: boolean`, `documentOpen: boolean`,
  `toolDrawer: ToolDrawer` (`"controls" | "source" | null`), and their setters.
- **Exports**: default `DocsLayoutShell`; `useDocsFocusPanelState()` hook;
  `ToolDrawer` type.
- **Behaviour**: wraps children in a `<div className="relative h-svh
  overflow-hidden">` and provides `DocsFocusPanelContext`. `useDocsFocusPanelState`
  throws if used outside the provider.
- **Accessibility**: the wrapper div is a positioning shell only; it is not a
  landmark. Landmarks come from `Topbar` (`header`), `DesktopDocsSidebar`
  (`nav`), and the center `<main>`.

## DocsPageShell — `docs/docs-page-shell.tsx`

The reusable three-pane layout.

- **Props**: `{ children: ReactNode; rightPanel?: ReactNode }`.
- **Consumes**: `navOpen`, `documentOpen` from context; `useMediaQuery("(max-width:
  899px)")`; `useReducedMotion()`.
- **Renders**: `Topbar`, then `<main>` as a grid:
  - mobile-first `flex h-full min-h-0 p-2 md:p-4`;
  - `min-[900px]:grid` with tracks
    `[0px_minmax(0,1fr)_0px]`, expanding each track when its drawer is open
    (`calc(clamp(16rem,24vw,18rem)+0.75rem)` / `calc(clamp(20rem,34vw,28rem)+0.75rem)`);
  - grid transition `duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]`.
- **Drawers**:
  - Left: `motion.div`, `animate={{ x: open ? 0 : -340 }}`, spring
    `{ type: "spring", bounce: 0, duration: reduceMotion ? 0 : 0.48 }`,
    `aria-hidden={!open}` `inert={!open}`,
    `w-[clamp(16rem,24vw,18rem)] will-change-transform`.
  - Right: `motion.aside`, `animate={{ x: open ? 0 : 600 }}`, same spring and
    `inert`/`aria-hidden` contract,
    `w-[clamp(20rem,34vw,28rem)]`; content wrapper
    `h-full overflow-y-auto px-4 py-8 lg:pt-32`.
- **Center**: `motion.section` with `layout`, `rounded-[22px] border
  border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950`,
  `place-items-center overflow-hidden`, transition `duration-240
  ease-[cubic-bezier(0.22,1,0.36,1)]`.
- **Mobile**: below 900px the left/right panes are not rendered; navigation is
  the `Sidebar` mobile drawer.

## Topbar — `docs/topbar.tsx`

Floating glass action bar.

- **Props**: none.
- **Consumes**: `navOpen`, `setNavOpen`, `documentOpen`, `setDocumentOpen`.
- **Structure**: `header.pointer-events-none.absolute.inset-x-2.top-2.z-[100]`
  with two `pointer-events-auto` glass pills
  (`rounded-xl border border-neutral-200 bg-white/90 p-1 shadow-sm
  backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/90`):
  - **Left pill**: sidebar toggle (`IconButton` + `SidebarToggleIcon`), labelled
    "Open/Close documentation navigation", `aria-expanded={navOpen}`.
  - **Right pill** (hidden while `documentOpen`): Home link (`/`), Search
    (`IconButton`, no handler yet), GitHub link
    (`https://github.com/musashi0x/aura_memory`), Description toggle
    (`aria-pressed={documentOpen}`), and `ModeToggle`.
- **IconButton**: 36px (`size-9`) rounded-lg, `text-neutral-500` →
  `hover:bg-neutral-100 hover:text-neutral-900`, active state
  `bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100`,
  `focus-visible:ring-2 ring-cyan-500`. Note: 36px is under the 44px rule but
  these are dense toolbar icons; keep the ring for keyboard users.
- **ModeToggle**: `useSyncExternalStore` for mount detection (SSR renders
  `disabled`), toggles the `dark` class on `<html>`; defaults to `dark`. Icons:
  a sun/moon circle SVG that rotates `-rotate-45` (dark) / `rotate-[135deg]`
  (light).
- **Accessibility**: every icon button has an `aria-label` and `title`.

## DesktopDocsSidebar — `docs/desktop-docs-sidebar.tsx`

The left grouped nav.

- **Props**: none.
- **Consumes**: `usePathname()`.
- **Structure**: `nav[aria-label="Documentation pages"]`,
  `flex h-full min-h-0 flex-col overflow-hidden p-5 lg:pt-32`. A scrollable
  group list with top/bottom fade gradients
  (`h-8 bg-gradient-to-b from-white to-transparent dark:from-neutral-950`).
- **Nav data**: `groupedComponents` — Documentation / Getting Started /
  Navigation & Disclosure / Actions & Inputs. Item tags: `"new"` (emerald dot),
  `"updated"` (blue dot), `"soon"` (neutral dot); the tag word is `sr-only`.
- **Link styling**: `relative flex items-center justify-between rounded-lg
  py-1.5 pl-3 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400
  dark:hover:text-neutral-100`. Active (`aria-current="page"`):
  `font-medium text-neutral-900 dark:text-neutral-100` plus a 1px cyan left bar
  (`before:bg-cyan-500 before:opacity-100`).
- **Accessibility**: group headings are `h2`; each link is a real `Link` with
  `aria-current` on the active route.

## Sidebar — `docs/sidebar.tsx`

Mobile drawer + floating action button.

- **Props**: `{ isOpen?: boolean; onOpenChange?: (open: boolean) => void }`
  (controlled or uncontrolled).
- **Owns**: `uncontrolledIsOpen` state; `useMediaQuery("(min-width: 1280px)")`.
- **Behaviour**: desktop (`≥ 1280px`) renders a fixed left rail
  (`hidden xl:flex`); below that a FAB (`fixed bottom-4 right-4 z-50 ... xl:hidden`)
  opens a slide-in drawer (`motion.aside x: -100% → 0`, spring
  `{ damping: 25, stiffness: 200 }`) with a `bg-black/50` overlay.
  `mobileDrawerOpen = !isDesktop && isOpen` keeps the drawer from ever rendering
  on desktop. The drawer closes on link click on mobile.
- **Note**: this component duplicates the nav data (`groupedComponents` with an
  `isNew` flag) and is currently **not rendered by any route** — the routes use
  `DesktopDocsSidebar` inside `DocsPageShell`. Keep it working as the mobile
  fallback, or remove it once a mobile pass lands.

## TableOfContents — `docs/table-of-contents.tsx`

Right "On this page" rail.

- **Props**: none.
- **Structure**: `aside.hidden.w-48.xl:block` with
  `sticky top-20`; `h4` mono kicker "On this page"; `nav` of anchor links with a
  left border; level-3 items are indented `ml-3`.
- **Note**: currently **not rendered by any route** (the right panel is the
  `rightPanel` prop instead). It is the sona-ui docs-page-navigation equivalent
  and can be mounted inside the center article or the right panel later.

## AgentPlan6 — `agent/agent-plan-6.tsx`

The demo content in the center pane.

- **Props**: none.
- **State**: `goal` (editable), `editing`, `draft`, `running` (local UI only —
  nothing is actually executed), plus the scroll-fade hook.
- **Structure** (all `dark:` variants are `neutral-*`):
  - `header`: title "Fix billing entitlements" + `{totalSteps} steps`.
  - **Goal** card: `rounded-[var(--rb-r-2xl,14px)] border
    border-neutral-200/70 bg-neutral-50 p-4 dark:border-neutral-800
    dark:bg-neutral-900`; edit mode swaps in a `textarea` with Save/Cancel.
  - **Stats** row: 3-column `dl` card (Steps / Est. time / Est. cost), each cell
    `bg-white dark:bg-neutral-950`.
  - **Tools**: chip list (`bg-neutral-100 dark:bg-neutral-800`).
  - **Breakdown**: numbered phase rows (index chip, name, steps, time).
  - **Footer**: Edit plan (tertiary) + Run plan (primary, cyan/ink) — or Stop
    while `running`. The primary button is `bg-[var(--rb-accent,...)]`
    `text-[var(--rb-accent-fg,...)]` with `active:scale-[0.97]`.
- **Scroll-fade**: `useScrollFade` returns a callback ref + `edges`
  (`start`/`end`); two absolutely positioned gradient overlays fade in/out at
  the top and bottom of the scroll area. The callback-ref pattern keeps ref
  reads out of render (React Compiler compliant).
- **Accessibility**: the Goal textarea has `aria-label="Plan goal"`; footer
  buttons are real buttons with icon + text; the scroll area is a `<main>`.

## Styling constants

`agent-plan-6.tsx` uses `--rb-*` custom properties
(`--rb-accent`, `--rb-accent-fg`, `--rb-r-sm/md/lg/2xl`) defined in
`apps/web/src/app/globals.css` under `:root` (they are the "react-bits"
radii/accent aliases). The docs shell Tailwind classes are the sona-ui neutral
scale; the `--rb-*` aliases bridge to the Tailwind `accent`/`accent-fg` theme
keys in `apps/web/tailwind.config.cjs`.
