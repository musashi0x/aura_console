"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Returns true when the query matches.
 * Returns false during SSR and during the first render before useEffect runs.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}