# sona-ui layout

The primary specification for the component-catalog / docs shell of Aura
Console, served at `/docs` and `/demo/agent-plan`. The layout is a direct
adaptation of the [sona-ui](https://github.com/Dinil-Thilakarathne/sona-ui)
documentation shell: a floating glass topbar over a three-pane workspace whose
drawers spring open and closed.

## Purpose

The docs shell is a **component catalog**, not an operational surface. It shows
off Aura's own components (the Agent Plan surface, future component docs) in a
sona-ui-style showcase. It carries no Run claim: nothing here reports a Run,
spend, or verified state. That is what makes the keep-neutral palette and the
borrowed motion acceptable (see [decisions.md](decisions.md)).

## Three-pane anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  [≡]  (floating glass topbar: sidebar toggle ··· Home Search ⭐ ⓘ ◑) │
│  ┌───────────┬──────────────────────────────┬─────────────────────┐  │
│  │           │                              │                     │  │
│  │  Left     │   Center guide               │   Right detail      │  │
│  │  sidebar  │   (component showcase)       │   panel             │  │
│  │  (springs │                              │   (springs in from  │  │
│  │   in from │                              │    the right)       │  │
│  │   the     │                              │                     │  │
│  │   left)   │                              │                     │  │
│  └───────────┴──────────────────────────────┴─────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

| Pane | Content | Closed width | Open width |
|---|---|---|---|
| Left sidebar | `DesktopDocsSidebar` — grouped component nav | `0px` | `calc(clamp(16rem, 24vw, 18rem) + 0.75rem)` |
| Center | The guide `<article>` (scrollable) | — | `minmax(0, 1fr)` |
| Right panel | Component details (`rightPanel` prop) | `0px` | `calc(clamp(20rem, 34vw, 28rem) + 0.75rem)` |

The topbar floats above the panes: `absolute inset-x-2 top-2 z-[100]`
(`md:inset-x-4 md:top-4`), glassy `bg-white/90 dark:bg-neutral-950/90` with
`backdrop-blur-xl`, rounded-xl, hairline border, soft shadow.

## Drawer behaviour

Implemented in `apps/web/src/components/docs/docs-page-shell.tsx`
(`DocsPageShell`) on top of the focus-panel state in
`docs/docs-layout-shell.tsx`.

- The main element is a CSS grid. On `min-width: 900px` it is
  `grid-template-columns` with three tracks; the track widths are what animate.
- Grid-track transition: `transition-[grid-template-columns] duration-500
  ease-[cubic-bezier(0.22,1,0.36,1)]`.
- Left sidebar: `motion.div` animating `x: 0 → -340` when closing,
  `-340 → 0` when opening, spring `{ type: "spring", bounce: 0, duration: 0.48 }`.
- Right panel: `motion.aside` animating `x: 0 → 600` when closing,
  `600 → 0` when opening, same spring.
- A closed pane is removed from the accessibility tree and from interaction:
  `aria-hidden={true}` **and** `inert`. This is not optional — a hidden drawer
  must not keep focusable links tabbable.
- `useReducedMotion()` from `motion/react` short-circuits every spring to
  `duration: 0`. The grid transition is CSS, so it is also covered by the global
  `prefers-reduced-motion` rule in `globals.css`.
- Open/close state lives in `DocsLayoutShell` context
  (`navOpen` / `documentOpen`), consumed via `useDocsFocusPanelState()`.
  `ToolDrawer` (`"controls" | "source" | null`) is reserved for future tool
  drawers and is not rendered yet.

## Responsive

| Viewport | Behaviour |
|---|---|
| `≥ 900px` | Three-pane grid; sidebar and detail spring in/out; both start closed |
| `< 900px` | The grid collapses to a single column (`flex` layout). The left sidebar and right panel are not rendered; navigation moves to the mobile drawer (`Sidebar`) with a floating action button |

The `899px` cut-off is a deliberate choice: it is the point where a 16rem
sidebar plus a 20rem detail panel leave less than a comfortable reading column.

## Component map

| File (under `apps/web/src/components/`) | Export | Role |
|---|---|---|
| `docs/docs-layout-shell.tsx` | `DocsLayoutShell` (default), `useDocsFocusPanelState`, `ToolDrawer` | Owns `navOpen`, `documentOpen`, `toolDrawer`; provides `DocsFocusPanelContext` |
| `docs/docs-page-shell.tsx` | `DocsPageShell` | The three-pane drawer layout + `Topbar` |
| `docs/topbar.tsx` | `Topbar` | Floating glass action bar |
| `docs/desktop-docs-sidebar.tsx` | `DesktopDocsSidebar` | Left grouped nav for `≥ 900px` |
| `docs/sidebar.tsx` | `Sidebar` | Mobile drawer + FAB |
| `docs/table-of-contents.tsx` | `TableOfContents` | Right "On this page" rail (sticky, unused by current routes) |
| `agent/agent-plan-6.tsx` | `AgentPlan6` (default) | The demo content in the center pane |

## Routes

| Route | File | Content |
|---|---|---|
| `/docs` | `apps/web/src/app/docs/page.tsx` | Docs home: guide cards |
| `/demo/agent-plan` | `apps/web/src/app/demo/agent-plan/page.tsx` | `AgentPlan6` showcase with a right detail panel |

Both are `"use client"` pages wrapped in `DocsLayoutShell`.

## Rules that always apply

- Every interactive element has a visible focus ring (`focus-visible:ring-2
  ring-cyan-500`) and a 44px minimum target where it is a control.
- A closed pane is `inert` and `aria-hidden` — never just visually hidden.
- Reduced motion collapses all springs to `duration: 0` and the grid transition
  is covered by the global reduced-motion rule.
- No surface here may report a Run, a spend, or a verified state. If a future
  component doc needs to show a real Run, it renders the Console's own
  components, not a decorated mock.
