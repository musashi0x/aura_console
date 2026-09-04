"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/** How fast the render catches up to what the stream has already delivered. */
const CATCH_UP_MS = 180;
/** Floor so a stalled stream still finishes rather than creeping. */
const FLOOR_CPS = 45;

/** Never reveal a half-typed word; cut back to the last space instead. */
function lastWordBoundary(source: string, cut: number) {
  if (cut >= source.length) return source.length;
  const index = source.lastIndexOf(" ", cut);
  return index === -1 ? 0 : index;
}

/**
 * Decouples what the stream has delivered from what the reader sees.
 *
 * SSE arrives in bursts, and rendering each burst verbatim makes the answer
 * stutter. This eases the visible text toward the received text, which reads as
 * a steady pace without inventing any content: the target is only ever what the
 * server actually sent.
 *
 * Under reduced motion the text appears at once — the easing is the animation.
 */
export function useSmoothedText() {
  const [text, setText] = useState("");
  const [settled, setSettled] = useState(false);
  const targetRef = useRef("");
  const shownRef = useRef(0);
  const endedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(now - last, 64);
      last = now;
      const target = targetRef.current;
      const behind = target.length - shownRef.current;

      if (behind > 0) {
        shownRef.current = reduceMotion
          ? target.length
          : Math.min(
              target.length,
              shownRef.current +
                behind * (1 - Math.exp(-delta / CATCH_UP_MS)) +
                (FLOOR_CPS * delta) / 1000,
            );
        const cut = Math.floor(shownRef.current);
        const finished = endedRef.current && cut >= target.length;
        setText(target.slice(0, finished ? target.length : lastWordBoundary(target, cut)));
        if (finished) setSettled(true);
      } else if (endedRef.current && !settled) {
        setSettled(true);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, settled]);

  const push = useCallback((chunk: string) => {
    targetRef.current += chunk;
  }, []);

  const end = useCallback(() => {
    endedRef.current = true;
  }, []);

  const reset = useCallback(() => {
    targetRef.current = "";
    shownRef.current = 0;
    endedRef.current = false;
    setText("");
    setSettled(false);
  }, []);

  return { text, settled, push, end, reset };
}
