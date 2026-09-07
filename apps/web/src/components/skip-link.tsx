/**
 * Skip to the page's own main landmark.
 *
 * It lives with each shell that renders `<main id="main">` rather than in the
 * root layout, because the console no longer has one: AppShell owns that
 * frame's main element and ships its own skip link. A single global link left
 * console pages with two skip links, the second of them pointing at an id that
 * had stopped existing — which is precisely what axe's `skip-link` rule flags.
 */
export function SkipLink() {
  return (
    <nav aria-label="Skip links">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
    </nav>
  );
}
