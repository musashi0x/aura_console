"use client";

import * as React from "react";
import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { animate } from "motion/react";
import { Maximize2, Minimize2, Move } from "lucide-react";

export type GalleryMotion = {
  type?: "spring" | "tween" | "keyframes" | "inertia";
  duration?: number;
  ease?: [number, number, number, number];
  delay?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  bounce?: number;
  restSpeed?: number;
  restDelta?: number;
};

const DEFAULT_TRANSITION: GalleryMotion = {
  type: "tween",
  duration: 0.28,
  ease: [0, 0, 0.58, 1],
};

const SPEED_REF = 32; // px/sec baseline drift
const ZOOM = 1.35; // Maximum zoom factor
const ZOOM_FIT = 0.92; // Viewport bounding ratio

type Particle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  z: number;
  targetZ: number;
  w: number;
  h: number;
  mult: number;
};

function hash01(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Responsive coordinate grid for 6 core architecture cards.
 * Provides organic staggered positions across the canvas.
 */
const CARD_LAYOUT: ReadonlyArray<{
  w: number;
  h: number;
  x: number;
  y: number;
}> = [
  { w: 380, h: 460, x: 16, y: 14 },
  { w: 360, h: 360, x: 50, y: 12 },
  { w: 360, h: 370, x: 84, y: 16 },
  { w: 360, h: 360, x: 18, y: 64 },
  { w: 360, h: 360, x: 52, y: 66 },
  { w: 420, h: 340, x: 86, y: 62 },
];

export interface FloatingCardItem {
  id: string;
  title: string;
  node: ReactNode;
}

export interface FloatingCardsGalleryProps {
  cards: FloatingCardItem[];
  speed?: number; // 0-100, 50 = SPEED_REF
  reach?: number; // px cursor repulsion area
  hover?: number; // repulsion force intensity
  transition?: GalleryMotion;
  className?: string;
  height?: number | string;
}

export function FloatingCardsGallery({
  cards,
  speed = 45,
  reach = 240,
  hover = 28,
  transition = DEFAULT_TRANSITION,
  className = "",
  height = 780,
}: FloatingCardsGalleryProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<Particle[]>([]);
  const nodesRef = useRef<Array<HTMLDivElement | null>>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const scrollVelocityRef = useRef(0);
  const lastScrollY = useRef(0);

  const [zoomed, setZoomed] = useState<number | null>(null);
  const zoomedRef = useRef<number | null>(null);
  const transitionRef = useRef(transition);
  const zoomAnims = useRef<Array<{ stop: () => void } | null>>([]);
  const cfgRef = useRef({ speed, reach, hover });

  useEffect(() => {
    zoomedRef.current = zoomed;
  }, [zoomed]);

  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

  useEffect(() => {
    cfgRef.current = { speed, reach, hover };
  }, [speed, reach, hover]);

  // Track window scroll velocity for tactile inertia
  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      const curr = window.scrollY;
      const dy = curr - lastScrollY.current;
      lastScrollY.current = curr;
      const clampedDy = Math.max(-60, Math.min(60, dy));
      scrollVelocityRef.current += clampedDy * 1.8;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard accessibility: Escape clears zoom
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && zoomedRef.current !== null) {
        setZoomed(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Seed particles based on container dimensions */
  const seed = useCallback(() => {
    const { w: W, h: H } = sizeRef.current;
    if (!W || !H) return;

    // Scale card dimensions gracefully if container is narrower
    const scaleFactor = Math.min(1, Math.max(0.75, W / 1200));

    partsRef.current = cards.map((_card, i) => {
      const slotIndex = i % CARD_LAYOUT.length;
      const slot = CARD_LAYOUT[slotIndex] ?? { w: 360, h: 360, x: 20, y: 20 };
      const w = slot.w * scaleFactor;
      const h = slot.h * scaleFactor;
      const prev = partsRef.current[i];

      return {
        x: (slot.x / 100) * W - w / 2,
        y: prev ? prev.y : (slot.y / 100) * H - h / 2,
        dx: prev ? prev.dx : 0,
        dy: prev ? prev.dy : 0,
        z: prev ? prev.z : 0,
        targetZ: prev ? prev.targetZ : 0,
        w,
        h,
        mult: 0.75 + hash01(i) * 0.5,
      };
    });
  }, [cards]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      sizeRef.current = {
        w: root.offsetWidth || 1200,
        h: root.offsetHeight || 780,
      };
      seed();
    };

    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(root);
      return () => ro.disconnect();
    }
  }, [seed]);

  // Main high-performance physics loop running via single rAF
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const { w: W, h: H } = sizeRef.current;
      if (!W || !H) return;

      const cfg = cfgRef.current;
      const R = Math.max(1, cfg.reach);
      const F = cfg.hover;
      const drift = (Math.max(0, cfg.speed) / 50) * SPEED_REF;

      // Dampen scroll velocity smoothly
      scrollVelocityRef.current *= Math.exp(-7 * dt);
      const scrollImpulse = scrollVelocityRef.current;

      const p = pointerRef.current;
      const zi = zoomedRef.current;
      const kOut = 1 - Math.exp(-8 * dt);

      for (let i = 0; i < partsRef.current.length; i++) {
        const a = partsRef.current[i];
        const node = nodesRef.current[i];
        if (!a || !node) continue;
        const frozen = zi === i;

        if (!frozen) {
          // Continuous drift coupled with scroll momentum
          a.y += (drift + scrollImpulse * 0.45) * a.mult * dt;

          // Wrap seamlessly around top/bottom edges
          const span = H + a.h;
          if (a.y > H + a.h * 0.15) a.y -= span;
          else if (a.y < -a.h * 1.15) a.y += span;
        }

        let tx = 0;
        let ty = 0;
        if (p.active && !frozen && F > 0) {
          const cx = a.x + a.w / 2;
          const cy = a.y + a.h / 2;
          const vx = cx - p.x;
          const vy = cy - p.y;
          const d = Math.hypot(vx, vy);
          if (d < R) {
            const inv = d > 0.001 ? 1 / d : 0;
            const fall = 1 - d / R;
            const push = F * fall * fall;
            tx = vx * inv * push;
            ty = vy * inv * push;
          }
        }

        a.dx += (tx - a.dx) * kOut;
        a.dy += (ty - a.dy) * kOut;

        // Click-to-center zoom via motion animate
        const targetZ = frozen ? 1 : 0;
        if (a.targetZ !== targetZ) {
          a.targetZ = targetZ;
          zoomAnims.current[i]?.stop();
          const from = a.z;
          const delta = targetZ - from;
          zoomAnims.current[i] = animate(0, 1, {
            ...transitionRef.current,
            onUpdate: (t: number) => {
              a.z = from + delta * t;
            },
            onComplete: () => {
              zoomAnims.current[i] = null;
            },
          });
        }

        const baseX = a.x + a.dx;
        const baseY = a.y + a.dy;
        const z = a.z;

        // Travel to exact container center when zoomed
        const px = baseX + ((W - a.w) / 2 - baseX) * z;
        const py = baseY + ((H - a.h) / 2 - baseY) * z;

        const fit = Math.min(
          ZOOM,
          (W * ZOOM_FIT) / Math.max(1, a.w),
          (H * ZOOM_FIT) / Math.max(1, a.h)
        );
        const s = 1 + (fit - 1) * z;

        node.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
        node.style.zIndex = z > 0.01 ? "999" : "10";
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const sx = r.width ? root.offsetWidth / r.width : 1;
    const sy = r.height ? root.offsetHeight / r.height : 1;
    pointerRef.current = {
      x: (e.clientX - r.left) * sx,
      y: (e.clientY - r.top) * sy,
      active: true,
    };
  };

  const onPointerLeave = () => {
    pointerRef.current.active = false;
  };

  return (
    <div
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={() => {
        if (zoomed !== null) setZoomed(null);
      }}
      style={{ height }}
      className={`relative w-full overflow-hidden rounded-4xl border border-border/70 bg-gradient-to-b from-card-primary/95 via-card-secondary/90 to-background/95 p-4 shadow-2xl backdrop-blur-md dark:border-neutral-800/80 ${className}`}
    >
      {/* Dynamic ambient grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Subtle gallery controls hint bar */}
      <div className="absolute top-4 left-6 z-20 flex items-center gap-2 rounded-full border border-border/80 bg-frame/80 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-md shadow-xs select-none">
        <Move className="h-3 w-3 text-accent animate-pulse" />
        <span>Hover to repel • Click card to focus</span>
      </div>

      {/* Dimming backdrop overlay when a card is zoomed */}
      <div
        className={`absolute inset-0 z-40 bg-neutral-950/60 backdrop-blur-xs transition-opacity duration-300 ${
          zoomed !== null
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setZoomed(null);
        }}
      />

      {/* Physics Cards */}
      {cards.map((card, i) => {
        const isZoom = zoomed === i;

        const activate = (e?: React.SyntheticEvent) => {
          e?.stopPropagation();
          if (isZoom) {
            setZoomed(null);
            return;
          }
          if (zoomed !== null) {
            setZoomed(null);
            return;
          }
          setZoomed(i);
        };

        const cardPart = partsRef.current[i];
        const cardWidth = cardPart ? cardPart.w : 360;
        const cardHeight = cardPart ? cardPart.h : 380;

        return (
          <div
            key={card.id}
            ref={(el) => {
              nodesRef.current[i] = el;
            }}
            onClick={activate}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: cardWidth,
              height: cardHeight,
              cursor: isZoom ? "default" : "pointer",
              userSelect: isZoom ? "auto" : "none",
              willChange: "transform",
            }}
            className={`transition-shadow duration-300 ${
              isZoom
                ? "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] ring-2 ring-emerald-500/50 rounded-4xl"
                : "shadow-xl hover:shadow-2xl"
            }`}
          >
            {/* Quick zoom toggle button on top-right of each card */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-80">
              <button
                type="button"
                onClick={activate}
                aria-label={`${isZoom ? "Minimize" : "Maximize"} ${card.title}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-frame/90 text-muted-foreground shadow-xs backdrop-blur-xs transition-colors hover:text-foreground hover:border-accent/40 cursor-pointer"
              >
                {isZoom ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* The card content */}
            <div className="h-full w-full pointer-events-auto">
              {card.node}
            </div>
          </div>
        );
      })}
    </div>
  );
}