"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import {
  createPeel,
  supportsHtmlInCanvas,
  type PeelInstance,
  type PeelOptions,
} from "./PeelVanilla";

export interface PeelProps extends PeelOptions {
  /**
 * NOT MOUNTED ANYWHERE — kept deliberately.
 *
 * The peel draws by capturing the live page into a canvas through the
 * experimental html-in-canvas API. On current Chrome (152, no flags)
 * `CanvasRenderingContext2D.drawElementImage` and `HTMLCanvasElement
 * .requestPaint` are both undefined, so `htmlInCanvas` is false, the capture
 * step returns immediately, and the sheet has never rendered a curl for anyone
 * without `chrome://flags/#canvas-draw-element`.
 *
 * Both shells that used to host it — the console and the docs — are now built
 * on AppShell, which owns the content element while SideNav owns the rail; the
 * peel needs both at once. Keeping a second hand-built shell alive to host an
 * effect that draws nothing was not a trade worth making twice.
 *
 * The source stays so it can be reinstated as its own overlay when the API
 * ships. Delete it only if that decision is reversed.
 */

/** The content that peels away. */
  children: ReactNode;
  /** The content revealed underneath the peel. */
  under?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const emptySubscribe = () => () => {};

/**
 * Upstream tracks the "init failed"fallback with `useState` written from
 * inside an effect. This repo's lint bans that (`react-hooks/set-state-in-effect`),
 * so the same one-shot signal lives in a tiny per-instance store instead: the
 * effect updates an external system, which is what effects are for, and the
 * subscription re-renders into the fallback exactly as upstream does.
 *
 * The signal matters. `supportsHtmlInCanvas` cannot see a WebGL context that
 * fails to allocate — browsers cap the number of live contexts — and without a
 * fallback the children would stay inside a canvas that nothing draws.
 */
function createFailureStore() {
  let failed = false;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => failed,
    fail() {
      if (failed) return;
      failed = true;
      for (const listener of listeners) listener();
    },
  };
}

export function Peel({ children, under, className, style, ...options }: PeelProps) {
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const underRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PeelInstance | null>(null);
  const [initialOptions] = useState(options);
  const [failures] = useState(createFailureStore);

  const supported = useSyncExternalStore(
    emptySubscribe,
    supportsHtmlInCanvas,
    () => false,
  );
  const failed = useSyncExternalStore(
    failures.subscribe,
    failures.getSnapshot,
    () => false,
  );
  const native = supported && !failed;

  useEffect(() => {
    // Nothing to drive without the capture API, and building a context here
    // would only draw a transparent quad over the fallback content.
    if (!native) return;
    const source = sourceRef.current;
    const content = contentRef.current;
    const output = outputRef.current;
    if (!source || !content || !output) return;
    instanceRef.current = createPeel(
      { source, content, output, under: underRef.current ?? undefined },
      initialOptions,
    );
    if (!instanceRef.current) failures.fail();
    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [initialOptions, native, failures]);

  useEffect(() => {
    instanceRef.current?.setOptions(options);
  });

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      {native ? (
        <div
          ref={underRef}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            visibility: "hidden",
          }}
        >
          {under}
        </div>
      ) : null}
      <canvas
        ref={sourceRef}
        // @ts-expect-error experimental html-in-canvas attribute
        layoutsubtree="true"
        suppressHydrationWarning
        style={
          native
            ? {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }
            : { display: "none" }
        }
      >
        {native ? (
          <div
            ref={contentRef}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              pointerEvents: "auto",
            }}
          >
            {children}
          </div>
        ) : null}
      </canvas>
      {!native ? (
        <div
          ref={contentRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      ) : null}
      <canvas
        ref={outputRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export type { PeelInstance, PeelOptions };

export default Peel;
