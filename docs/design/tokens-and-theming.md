# Tokens and theming

The docs shell keeps sona-ui's **native neutral palette** — Tailwind
`neutral-*` classes plus `dark:` variants — as its own visual layer. This is a
decided stance (see [decisions.md](decisions.md)); this file records the palette
and the boundary around it.

## Keep-neutral decision

The docs shell is a component catalog, not a Run-reporting surface. It therefore
**does not** consume the Aura `--color-*` tokens for its surfaces. It keeps:

- `bg-white dark:bg-neutral-950` for the canvas and panels;
- `border-neutral-200 dark:border-neutral-800` for hairlines;
- `bg-neutral-50 dark:bg-neutral-900` for raised cards;
- `text-neutral-500/600 dark:text-neutral-400` for muted text,
  `text-neutral-900 dark:text-neutral-100` for primary text;
- `bg-white/90 dark:bg-neutral-950/90` + `backdrop-blur-xl` for the glass
  topbar pills;
- `ring-cyan-500` / `text-cyan-600 dark:text-cyan-400` / `before:bg-cyan-500`
  for the accent;
- `bg-emerald-500` / `bg-blue-500` for "new"/"updated" tag dots.

The `dark` class on `<html>` switches the whole layer; `ModeToggle` in the
`Topbar` flips it and defaults to dark. The Console's `--color-*` tokens and the
landing's `--landing-*` tokens are unaffected by that class.

## sona-ui palette → class map

| sona-ui token | Tailwind classes used here | Aura `--color-*` equivalent (reference only) |
|---|---|---|
| Canvas `neutral-950` | `dark:bg-neutral-950`, `dark:from-neutral-950` | `--color-canvas` `#05070d` |
| Surface `neutral-900` | `dark:bg-neutral-900`, `dark:bg-neutral-900/90` | `--color-surface` `#0d1420` |
| Raised `neutral-800` | `dark:bg-neutral-800`, `dark:border-neutral-800` | `--color-surface-raised` `#111b2a` |
| Border `neutral-200/800` | `border-neutral-200 dark:border-neutral-800` | `--color-border` |
| Ink `neutral-900/100` | `text-neutral-900 dark:text-neutral-100` | `--color-text` `#f4f7fb` |
| Muted `neutral-500/400` | `text-neutral-500 dark:text-neutral-400` | `--color-text-muted` `#8d9aaf` |
| Glass white/90 | `bg-white/90 backdrop-blur-xl` | `--color-glass` family |
| Accent cyan-500 | `ring-cyan-500`, `text-cyan-600`, `before:bg-cyan-500` | `--color-cyan` `#48d7ff` |
| Tag new emerald-500 | `bg-emerald-500` | `--color-success` `#51e6a6` |
| Tag updated blue-500 | `bg-blue-500` | (none) |

## Aura token layer (for reference)

The Aura tokens in `apps/web/src/styles/tokens.css` that parallel the docs
shell's needs. The docs shell is **not required** to use them, but may reference
them as equivalents:

- Glass: `--color-glass` (`rgba(255,255,255,0.04)`),
  `--color-glass-strong` (`0.07`), `--color-surface-glass`
  (`color-mix(... surface 82%, transparent)`).
- Elevation: `--shadow-float`, `--shadow-panel`.
- Glow: `--glow-cyan`, `--glow-cyan-strong`, `--glow-violet`.
- Accent ink: `--color-accent-ink` (`#04131c`) — dark text on cyan fills.
- Radii: `--radius-sm/md/lg/xl/2xl`.
- `--rb-accent` / `--rb-accent-fg` / `--rb-r-*` aliases defined in
  `globals.css` `:root` bridge to the Tailwind `accent` / `accent-fg` /
  `rb-r-*` theme keys in `apps/web/tailwind.config.cjs`.

## Contrast requirements

- The docs shell is **exempt** from the literal-hex scan in
  `apps/web/src/styles/tokens.test.ts` **only because** it is a non-claim
  catalog surface. It must still meet WCAG AA for its own text — sona-ui's
  neutral scale does (`neutral-600` on `neutral-50`, `neutral-400` on
  `neutral-950`).
- The `focus-visible:ring-cyan-500` ring must remain on every interactive
  element; it is the keyboard path.
- State never depends on colour alone: the "new"/"updated"/"soon" tags pair the
  dot with an `sr-only` word, and the active nav item pairs the cyan bar with
  `font-medium` text and `aria-current`.

## The boundary (must never be crossed)

1. **Console surfaces never borrow docs-shell classes.** `/runs`, `/system`,
   and the Run timeline use `--color-*` tokens only. A literal hex or a
   `neutral-*`/`dark:` class on a Run-reporting surface fails the token test and
   the honesty rules in `docs/ai/web/react-bits.md`.
2. **The docs shell never reports a Run.** It shows components. If it ever needs
   to display real Run data, it mounts the Console's own components (which bring
   their token layer with them).
3. **The exemption is narrow.** It covers the docs shell's own Tailwind classes.
   It is not a licence to add literal hex colours elsewhere, and new components
   in `apps/web/src/components/` outside the docs shell must use tokens.
