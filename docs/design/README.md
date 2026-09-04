# Aura Console design documentation

This folder records the **sona-ui-inspired component-catalog / docs shell**
served at `/docs` and `/demo/agent-plan`. It is the design specification a
builder can execute from without re-reading source, and it records the
boundaries that keep the three visual layers of Aura Console distinct.

## The three layers

Aura Console deliberately keeps three visual layers. They must not bleed into
each other.

| Layer | Surface | Palette | Source of truth |
|---|---|---|---|
| Operational | Console shell (`/runs`, `/system`, …) | Aura `--color-*` dark tokens | `apps/web/src/styles/tokens.css`, enforced by `tokens.test.ts` |
| Editorial | Landing page (`/`) | Aura `--landing-*` light tokens | `apps/web/src/styles/tokens.css` |
| Catalog | Docs shell (`/docs`, `/demo/agent-plan`) | sona-ui `neutral-*` + `dark:` Tailwind classes | This folder |

The docs shell keeps sona-ui's native neutral palette — the decision and its
rationale are in [decisions.md](decisions.md). The three-layer rule is the same
shape as the two-layer rule in
[`docs/product/visual-system.md`](../product/visual-system.md): the contrast
between layers is intentional, and a surface must not borrow another layer's
classes.

## Documents

- [sona-ui-layout.md](sona-ui-layout.md) — the primary spec: anatomy, drawer
  behaviour, responsive rules, component map.
- [components.md](components.md) — per-component specification: props, state,
  visuals, accessibility.
- [tokens-and-theming.md](tokens-and-theming.md) — the keep-neutral palette
  decision and the token boundary.
- [clone-map.md](clone-map.md) — sona-ui pattern → Aura equivalent mapping.
- [decisions.md](decisions.md) — the recorded decisions behind the shell.

Related: the Console shell's own spec lives in
[`docs/ai/web/console-shell.md`](../ai/web/console-shell.md), and the visual
system in [`docs/product/visual-system.md`](../product/visual-system.md).
