"use client";

import Link from "next/link";
import { type ComponentProps, useEffect, useRef } from "react";
import { drawablyButton, type DrawablyButtonOptions } from "drawably";

export type DrawablyLinkProps = ComponentProps<typeof Link> & DrawablyButtonOptions;

/**
 * Next.js Link enhanced with drawablyButton hand-drawn chrome and animations.
 * Preserves the semantic <a> element, router prefetching, and accessible role.
 */
export function DrawablyLink({
  variant = "outline",
  state,
  tone,
  seed,
  roughness,
  boil,
  stroke,
  fill,
  paper,
  width,
  className = "",
  children,
  ...rest
}: DrawablyLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const sketchRef = useRef<ReturnType<typeof drawablyButton> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const sketch = drawablyButton(ref.current, {
      variant,
      tone,
      seed,
      roughness,
      boil,
      stroke,
      fill,
      paper,
      width,
    });
    sketchRef.current = sketch;
    return () => {
      sketch.destroy();
      sketchRef.current = null;
    };
  }, [variant, tone, seed, roughness, boil, stroke, fill, paper, width]);

  useEffect(() => {
    sketchRef.current?.setState(state ?? "idle");
  }, [state]);

  return (
    <Link ref={ref} className={className} {...rest}>
      {children}
    </Link>
  );
}
