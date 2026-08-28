"use client";

import { useEffect, useRef, useState } from "react";

import { landing } from "../copy";
import { ConsolePreview } from "./console-preview";

/**
 * Scenes 4 and 5. The Console window is revealed, then held while the causal
 * events take turns being emphasised.
 *
 * No scroll hijacking: the page scrolls normally and the window is simply
 * sticky. Emphasis is driven by IntersectionObserver over invisible markers,
 * so if the observer never runs the preview still renders every event.
 */
export function ConsoleStory() {
  const [active, setActive] = useState(-1);
  const markers = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    if (typeof IntersectionObserver === "undefined") return;

    const nodes = markers.current.filter((n): n is HTMLDivElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(index)) setActive(index);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="lp-story" aria-labelledby="story-heading">
      <div className="lp-story__intro">
        <p className="lp-kicker">{landing.console.kicker}</p>
        <h2
          id="story-heading"
          className="lp-display lp-display--sm"
          aria-label={landing.console.headline.join(" ")}
        >
          {landing.console.headline.map((line) => (
            <span key={line} className="lp-display__line">
              {line}{" "}
            </span>
          ))}
        </h2>
      </div>

      <div className="lp-story__layout">
        <div className="lp-story__sticky">
          <ConsolePreview activeIndex={active} />
        </div>

        {/* Scroll markers only. The readable copy lives in the preview. */}
        <div className="lp-story__markers" aria-hidden="true">
          {landing.console.events.map((event, index) => (
            <div
              key={event.title}
              className="lp-story__marker"
              data-index={index}
              ref={(node) => {
                markers.current[index] = node;
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
