# Decisions

Recorded decisions behind the docs shell. Each entry states the decision, the
rationale, and what would change it.

## Decision: keep the sona-ui neutral palette (keep-neutral)

**Status: decided (confirmed by the operator).**

The docs shell (`/docs`, `/demo/agent-plan`) keeps sona-ui's native Tailwind
`neutral-*` + `dark:` palette rather than migrating to the Aura `--color-*`
tokens.

**Rationale:**

- The request was to clone sona-ui's look. Re-colouring the shell into Aura's
  operational tokens would undo the clone.
- It is exactly parallel to the existing two-layer rule: the landing page has
  its own `--landing-*` editorial scale distinct from the Console's `--color-*`
  operational scale (see `docs/product/visual-system.md`). The docs shell is a
  third layer with its own palette.
- The docs shell is a component catalog — a non-claim surface — so the
  decoration is allowed under the same boundary `docs/ai/web/react-bits.md`
  draws between decorative motion and Run-reporting surfaces.

**Boundaries that come with it:**

- Console surfaces (`/runs`, `/system`, the Run timeline) never borrow
  `neutral-*`/`dark:` classes or literal hex. The token test enforces this.
- The docs shell never reports a Run. Real Run data, if ever shown here, mounts
  the Console's own components.
- The exemption is narrow: it covers the docs shell's Tailwind classes only.

**What would change it:** a decision to make the whole product one visual
language. That would be a separate, deliberate pass, not a drive-by refactor.

## Decision: three visual layers

| Layer | Palette | Surfaces |
|---|---|---|
| Operational | `--color-*` | Console shell, Run timeline, primitives |
| Editorial | `--landing-*` | Landing page |
| Catalog | `neutral-*` + `dark:` | Docs shell |

The contrast between layers is intentional, and no surface borrows another
layer's classes.

## Decision: `h-svh` over `h-screen`

The shell uses `h-svh` (small viewport height) so the drawers and topbar fit
mobile browsers without the URL-bar overlap problem `100vh` has. The layout is
`overflow-hidden` by design: the center article scrolls internally.

## Decision: spring motion with `bounce: 0, duration: 0.48`

The drawers use `{ type: "spring", bounce: 0, duration: 0.48 }`. `bounce: 0`
keeps the motion deliberate rather than playful — the shell is a documentation
tool, not a toy. `useReducedMotion()` collapses every spring to `duration: 0`,
and the CSS grid-track transition is covered by the global reduced-motion rule.

## Decision: `inert` on closed drawers

A closed pane gets `aria-hidden={true}` **and** `inert`. `aria-hidden` alone
keeps it out of the accessibility tree but leaves the links focusable; `inert`
removes them from the tab order too. This is the contract that keeps a hidden
drawer from trapping keyboard users.

## Decision: `899px` breakpoint

The grid collapses below `min-width: 900px`. The left sidebar
(`clamp(16rem,24vw,18rem)`) plus the right panel (`clamp(20rem,34vw,28rem)`)
leave less than a readable column below 900px, so below it the shell is a
single column and navigation moves to the mobile drawer (`Sidebar`).

## Decision: `ToolDrawer` is reserved, not rendered

`DocsLayoutShell` carries `toolDrawer: "controls" | "source" | null` and its
setter, but no route renders a tool drawer yet. It is the seam for future
controls/source drawers (sona-ui's playground pattern). Do not remove it; do
not render it without a purpose.

## Decision: `Sidebar` (mobile) and `TableOfContents` are currently unmounted

Neither the mobile `Sidebar` nor `TableOfContents` is rendered by the current
routes — the routes use `DesktopDocsSidebar` inside `DocsPageShell`, and the
right panel is the `rightPanel` prop. They are kept as working components: the
mobile drawer is the intended < 900px navigation, and the table of contents is
the sona-ui docs-page-navigation equivalent. They should be wired into a mobile
pass or removed explicitly; leaving them half-wired is not an option.

## Decision: docs are the spec, code is the fact

`docs/design/*` describes the shell as it exists. If the code drifts, update
the docs to match the code, and flag the drift. This mirrors the rule in
`docs/ai/README.md` ("the code is the fact and the tracker is the intent").
