"use client";

import { DrawablyUnderline } from "drawably/react";

import { landing } from "../copy";

/**
 * Scene 1. A single statement inside a large floating window, and nothing
 * else. No buttons here on purpose: the first viewport is meant to be calm,
 * and every action it could offer appears later once the story has been told.
 */
export function OpeningWindow() {
  const [before, after] = landing.opening.statement.split("decided");

  return (
    <section className="lp-opening" aria-labelledby="opening-heading">
      <div className="lp-window lp-window--light">
        {/* Decorative chrome. Not controls, so it stays out of the a11y tree. */}
        <span className="lp-window__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h1 id="opening-heading" className="lp-opening__statement">
          {before}
          <DrawablyUnderline>decided</DrawablyUnderline>
          {after}
        </h1>
      </div>
    </section>
  );
}
