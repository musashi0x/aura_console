"use client";

import * as React from "react";
import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { animate } from "motion/react";
import { Maximize2, Minimize2, Move, RotateCcw } from "lucide-react";

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
  vx: number;
  vy: number;
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
  { w: 380, h: 460, x: 5, y: 10 },
  { w: 360, h: 360, x: 48, y: 8 },
  { w: 360, h: 370, x: 92, y: 10 },
  { w: 360, h: 360, x: 8, y: 88 },
  { w: 360, h: 360, x: 50, y: 92 },
  { w: 420, h: 340, x: 94, y: 86 },
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
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const zoomedRef = useRef<number | null>(null);
  const transitionRef = useRef(transition);
  const zoomAnims = useRef<Array<{ stop: () => void } | null>>([]);
  const cfgRef = useRef({ speed, reach, hover });

  const dragRef = useRef<{
    activeIdx: number | null;
    isDragging: boolean;
    startX: number;
    startY: number;
    startCardX: number;
    startCardY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
  }>({
    activeIdx: null,
    isDragging: false,
    startX: 0,
    startY: 0,
    startCardX: 0,
    startCardY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
  });

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

      const initialX = (slot.x / 100) * Math.max(0, W - w);
      const initialY = (slot.y / 100) * Math.max(0, H - h);

      return {
        x: prev ? prev.x : initialX,
        y: prev ? prev.y : initialY,
        dx: prev ? prev.dx : 0,
        dy: prev ? prev.dy : 0,
        z: prev ? prev.z : 0,
        targetZ: prev ? prev.targetZ : 0,
        w,
        h,
        mult: 0.75 + hash01(i) * 0.5,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
      };
    });
  }, [cards]);

  /** Reset cards smoothly back to their organic grid positions */
  const resetLayout = useCallback(() => {
    const { w: W, h: H } = sizeRef.current;
    if (!W || !H) return;
    const scaleFactor = Math.min(1, Math.max(0.75, W / 1200));

    cards.forEach((_card, i) => {
      const slot = CARD_LAYOUT[i % CARD_LAYOUT.length] ?? {
        w: 360,
        h: 360,
        x: 20,
        y: 20,
      };
      const w = slot.w * scaleFactor;
      const h = slot.h * scaleFactor;
      const targetX = (slot.x / 100) * Math.max(0, W - w);
      const targetY = (slot.y / 100) * Math.max(0, H - h);
      const p = partsRef.current[i];
      if (!p) return;

      p.vx = 0;
      p.vy = 0;
      p.dx = 0;
      p.dy = 0;

      const startX = p.x;
      const startY = p.y;
      animate(0, 1, {
        duration: 0.55,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: (t: number) => {
          p.x = startX + (targetX - startX) * t;
          p.y = startY + (targetY - startY) * t;
        },
      });
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

      const drag = dragRef.current;
      const heldIdx = drag.isDragging ? drag.activeIdx : null;

      for (let i = 0; i < partsRef.current.length; i++) {
        const a = partsRef.current[i];
        const node = nodesRef.current[i];
        if (!a || !node) continue;
        const frozen = zi === i;
        const isHeld = heldIdx === i;

        if (!frozen && !isHeld) {
          // Apply throw inertia
          a.x += a.vx * dt;
          a.y += a.vy * dt;

          // Friction damping
          a.vx *= Math.exp(-4.2 * dt);
          a.vy *= Math.exp(-4.2 * dt);
          if (Math.abs(a.vx) < 0.5) a.vx = 0;
          if (Math.abs(a.vy) < 0.5) a.vy = 0;

          // Background drift when throw velocity has settled
          if (Math.abs(a.vy) < 15) {
            a.y += (drift + scrollImpulse * 0.45) * a.mult * dt;
          }

          // Horizontal bounds: soft elastic containment inside canvas
          const minX = -a.w * 0.2;
          const maxX = W - a.w * 0.8;
          if (a.x < minX) {
            a.x = minX;
            a.vx = Math.abs(a.vx) * 0.4;
          } else if (a.x > maxX) {
            a.x = maxX;
            a.vx = -Math.abs(a.vx) * 0.4;
          }

          // Wrap seamlessly around top/bottom edges
          const span = H + a.h;
          if (a.y > H + a.h * 0.2) a.y -= span;
          else if (a.y < -a.h * 1.2) a.y += span;
        }

        let tx = 0;
        let ty = 0;
        // Only apply cursor repulsion if card is not held
        if (p.active && !frozen && !isHeld && F > 0) {
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
        node.style.zIndex = z > 0.01 ? "999" : isHeld ? "100" : "10";
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
    const px = (e.clientX - r.left) * sx;
    const py = (e.clientY - r.top) * sy;

    pointerRef.current = {
      x: px,
      y: py,
      active: true,
    };

    const drag = dragRef.current;
    if (drag.activeIdx !== null) {
      const p = partsRef.current[drag.activeIdx];
      if (p) {
        const now = e.timeStamp;
        const dt = Math.max(0.001, (now - drag.lastTime) / 1000);
        const dist = Math.hypot(px - drag.startX, py - drag.startY);

        if (!drag.isDragging && dist > 5) {
          drag.isDragging = true;
          setDraggingIdx(drag.activeIdx);
        }

        if (drag.isDragging) {
          p.x = drag.startCardX + (px - drag.startX);
          p.y = drag.startCardY + (py - drag.startY);

          // Filtered momentum velocity estimation
          const instVx = (px - drag.lastX) / dt;
          const instVy = (py - drag.lastY) / dt;
          drag.vx = drag.vx * 0.35 + instVx * 0.65;
          drag.vy = drag.vy * 0.35 + instVy * 0.65;
        }

        drag.lastX = px;
        drag.lastY = py;
        drag.lastTime = now;
      }
    }
  };

  const onPointerLeave = () => {
    pointerRef.current.active = false;
  };

  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    i: number
  ) => {
    // If a different card is zoomed, ignore drag
    if (zoomedRef.current !== null && zoomedRef.current !== i) return;

    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const sx = r.width ? root.offsetWidth / r.width : 1;
    const sy = r.height ? root.offsetHeight / r.height : 1;
    const px = (e.clientX - r.left) * sx;
    const py = (e.clientY - r.top) * sy;

    const p = partsRef.current[i];
    if (!p) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    dragRef.current = {
      activeIdx: i,
      isDragging: false,
      startX: px,
      startY: py,
      startCardX: p.x,
      startCardY: p.y,
      lastX: px,
      lastY: py,
      lastTime: e.timeStamp,
      vx: 0,
      vy: 0,
    };

    p.vx = 0;
    p.vy = 0;
  };

  const handleCardPointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    i: number
  ) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const drag = dragRef.current;
    if (drag.activeIdx === i) {
      if (drag.isDragging) {
        // Impart momentum throw velocity (clamped to realistic max)
        const p = partsRef.current[i];
        if (p) {
          p.vx = Math.max(-1200, Math.min(1200, drag.vx));
          p.vy = Math.max(-1200, Math.min(1200, drag.vy));
        }
      } else {
        // Normal click without dragging -> toggle zoom focus
        const target = e.target as HTMLElement | null;
        const isInteractive = target?.closest("button, a, input");
        if (!isInteractive) {
          if (zoomedRef.current === i) {
            setZoomed(null);
          } else {
            setZoomed(i);
          }
        }
      }
    }

    drag.activeIdx = null;
    drag.isDragging = false;
    setDraggingIdx(null);
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
      <div className="absolute top-4 left-6 z-20 flex flex-wrap items-center gap-2 select-none">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-frame/80 px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-md shadow-xs">
          <Move className="h-3 w-3 text-accent animate-pulse" />
          <span>Drag cards to arrange • Click to focus • Hover to repel</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetLayout();
          }}
          className="flex items-center gap-1.5 rounded-full border border-border/80 bg-frame/80 px-3 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-md shadow-xs transition-colors hover:text-foreground hover:border-accent/40 cursor-pointer"
          title="Reset cards to default grid layout"
        >
          <RotateCcw className="h-3 w-3 text-accent" />
          <span>Reset Layout</span>
        </button>
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
        const isHeld = draggingIdx === i;

        const toggleZoom = (e?: React.SyntheticEvent) => {
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

        const slot = CARD_LAYOUT[i % CARD_LAYOUT.length];
        const cardWidth = slot?.w ?? 360;
        const cardHeight = slot?.h ?? 380;

        return (
          <div
            key={card.id}
            ref={(el) => {
              nodesRef.current[i] = el;
            }}
            onPointerDown={(e) => handleCardPointerDown(e, i)}
            onPointerUp={(e) => handleCardPointerUp(e, i)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: cardWidth,
              height: cardHeight,
              cursor: isZoom ? "default" : isHeld ? "grabbing" : "grab",
              userSelect: isZoom ? "auto" : "none",
              touchAction: "none",
              willChange: "transform",
            }}
            className={`transition-shadow duration-300 ${
              isZoom
                ? "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] ring-2 ring-emerald-500/50 rounded-4xl"
                : isHeld
                ? "shadow-2xl ring-2 ring-emerald-500/50 scale-[1.01]"
                : "shadow-xl hover:shadow-2xl"
            }`}
          >
            {/* Quick zoom toggle button on top-right of each card */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-80">
              <button
                type="button"
                onClick={toggleZoom}
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