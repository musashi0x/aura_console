"use client";

import { THEME_STORAGE_KEY } from "@/lib/theme";

export type DocsTheme = "light" | "dark";

/**
 * The docs surface's light/dark state, read from where it actually lives.
 *
 * Two systems have to agree here and they use different mechanisms, which is
 * why this is one module rather than a value passed around:
 *
 *   - Tailwind resolves `bg-surface` / `text-ink` through `darkMode: 'class'`,
 *     so it needs `.dark` on <html>.
 *   - Astryx components resolve their tokens through `<Theme mode>`, which
 *     stamps `data-theme` on the root.
 *
 * Different attributes, so they never collide — they just diverge in silence.
 * Set one and not the other and the page is half themed: no error, no warning,
 * simply Astryx dark on a Tailwind-light background. The class stays the single
 * source of truth and `<Theme mode>` is driven from it.
 */
export function subscribeDocsTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function getDocsThemeSnapshot(): DocsTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The server cannot know which class <html> will carry. Callers that need a
 * mode before hydration get "light", which is the actual default: the restore
 * effect only ever ADDS `.dark`, so an unset preference is a light page.
 */
export const DOCS_THEME_SERVER_SNAPSHOT: DocsTheme = "light";

/** Null until hydration, for controls that must not announce a guess. */
export const DOCS_THEME_SERVER_UNKNOWN = null;

export function setDocsTheme(next: DocsTheme) {
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Blocked storage still leaves the toggle working for this visit.
  }
}

/** Re-apply the stored choice. Returns nothing: the class is the state. */
export function restoreDocsTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.classList.toggle("dark", stored === "dark");
  } catch {
    // Blocked storage leaves the surface on its default theme.
  }
}
