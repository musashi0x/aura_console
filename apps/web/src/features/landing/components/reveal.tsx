"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveal-on-scroll that fails open. Content renders visible on the server and
 * stays visible without JavaScript. The pending state is only applied on the
 * client, and only when the operator has not asked for reduced motion, so a
 * failed observer or a blocked script can never hide a section.
 */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // matchMedia is absent in some environments. Treat that as "animate", the
    // same as a browser reporting no preference.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    if (typeof IntersectionObserver === "undefined") return;

    node.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Also reveal anything already above the viewport. A jump, a restored
          // scroll position, or an in-page anchor can move past an element
          // without it ever intersecting, and it would otherwise stay at
          // opacity 0 permanently.
          const alreadyPassed = entry.boundingClientRect.top < 0;
          if (entry.isIntersecting || alreadyPassed) {
            node.dataset.reveal = "shown";
            observer.unobserve(node);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
