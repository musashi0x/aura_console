"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createRectCache } from "./rect-cache";
import {
  createDecryptReveal as createWebGLDecryptReveal,
  supportsHtmlInCanvas,
  type DecryptRevealInstance,
  type DecryptRevealOptions,
} from "./decrypt-reveal-vanilla";

export interface DecryptRevealProps extends DecryptRevealOptions {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Force overlay mode or let it auto-detect */
  mode?: "auto" | "webgl" | "overlay";
  /** Optional callback when cursor is within decrypt range */
  onActiveChange?: (active: boolean) => void;
}

const emptySubscribe = () => () => {};

const DEFAULT_CHARSET =
  "0123456789ABCDEF!@#$%^&*()_+-=[]{}|;:,.<>?/~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function DecryptReveal({
  children,
  className = "",
  style,
  mode = "auto",
  onActiveChange,
  radius = 280,
  softness = 0.45,
  cell = 12,
  aspect = 0.65,
  charset = DEFAULT_CHARSET,
  color = "#10b981",
  brightness = 1.1,
  scramble = 0.16,
  scrambleSpeed = 10,
  edgeWidth = 0.22,
  edgeFlicker = 0.85,
  edgeGlow = 2.2,
  edgeTint = 0.75,
  aberration = 8,
  passthrough = 0.08,
  background = "#0d0d12",
  smoothing = 0.16,
  ...restOptions
}: DecryptRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const webglInstanceRef = useRef<DecryptRevealInstance | null>(null);
  const [webglFailed, setWebGLFailed] = useState(false);

  const supported = useSyncExternalStore(
    emptySubscribe,
    supportsHtmlInCanvas,
    () => false,
  );

  const useNativeWebGL = mode === "webgl" || (mode === "auto" && supported && !webglFailed);

  // 1. WebGL mode (when HTML-in-canvas is supported)
  useEffect(() => {
    if (!useNativeWebGL) return;
    const source = sourceRef.current;
    const content = contentRef.current;
    const output = outputRef.current;
    if (!source || !content || !output) return;

    try {
      webglInstanceRef.current = createWebGLDecryptReveal(
        { source, content, output },
        {
          radius,
          softness,
          cell,
          aspect,
          charset,
          color,
          brightness,
          scramble,
          scrambleSpeed,
          edgeWidth,
          edgeFlicker,
          edgeGlow,
          edgeTint,
          aberration,
          passthrough,
          background,
          smoothing,
          ...restOptions,
        },
      );
      if (!webglInstanceRef.current) {
        queueMicrotask(() => setWebGLFailed(true));
      }
    } catch {
      queueMicrotask(() => setWebGLFailed(true));
    }

    return () => {
      webglInstanceRef.current?.destroy();
      webglInstanceRef.current = null;
    };
  }, [
    useNativeWebGL,
    radius,
    softness,
    cell,
    aspect,
    charset,
    color,
    brightness,
    scramble,
    scrambleSpeed,
    edgeWidth,
    edgeFlicker,
    edgeGlow,
    edgeTint,
    aberration,
    passthrough,
    background,
    smoothing,
    restOptions,
  ]);

  // 2. Universal Overlay Engine (for standard browsers & cross-platform visual consistency)
  useEffect(() => {
    if (useNativeWebGL) return;
    const canvas = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let destroyed = false;
    let rafId = 0;
    let lastTime = performance.now();

    const rectCache = createRectCache(container);

    const pointer = {
      x: -1e5,
      y: -1e5,
      tx: -1e5,
      ty: -1e5,
      active: 0,
      target: 0,
    };

    // Precalculate character glyph set
    const chars = Array.from(new Set(charset.split("")));
    const charLen = chars.length;

    // Grid state for persistent scrambles
    let cols = 0;
    let rows = 0;
    let cellW = Math.max(Math.round(cell * aspect), 6);
    let cellH = Math.max(cell, 8);
    let gridChars: Uint8Array = new Uint8Array(0);

    const syncSize = () => {
      if (destroyed || !canvas || !container) return;
      const rect = rectCache.current;
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      const w = Math.max(Math.round(rect.width), 1);
      const h = Math.max(Math.round(rect.height), 1);

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      cellW = Math.max(Math.round(cell * aspect), 6);
      cellH = Math.max(cell, 8);
      const newCols = Math.ceil(w / cellW);
      const newRows = Math.ceil(h / cellH);

      if (newCols !== cols || newRows !== rows) {
        cols = newCols;
        rows = newRows;
        gridChars = new Uint8Array(cols * rows);
        for (let i = 0; i < gridChars.length; i++) {
          gridChars[i] = Math.floor(Math.random() * charLen);
        }
      }

      // Initial center position preview on first size calculation
      if (pointer.x < -1e4) {
        pointer.x = w / 2;
        pointer.y = Math.min(h / 3, 180);
        pointer.tx = pointer.x;
        pointer.ty = pointer.y;
        pointer.active = 0.85;
        pointer.target = 0; // Gently fades to encrypted state unless cursor hovers
      }
    };

    syncSize();

    const onPointerMove = (e: PointerEvent) => {
      const rect = rectCache.current;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (pointer.target === 0 && pointer.active < 1e-3) {
        pointer.x = x;
        pointer.y = y;
      }

      pointer.tx = x;
      pointer.ty = y;
      pointer.target = 1;
      onActiveChange?.(true);
    };

    const onPointerLeave = () => {
      pointer.target = 0;
      onActiveChange?.(false);
    };

    container.addEventListener("pointerdown", onPointerMove, { passive: true });
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerleave", onPointerLeave, { passive: true });

    let _timeAcc = 0;

    const render = (now: number) => {
      if (destroyed) return;

      const delta = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      _timeAcc += delta;

      // Exponential damping / smoothing
      const tau = Math.max(smoothing, 1e-4);
      const k = 1 - Math.exp(-delta / tau);
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
      pointer.active += (pointer.target - pointer.active) * k;

      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // 1. Draw Cipher Backdrop (Dark terminal base)
      const bgAlpha = Math.min(Math.max(1 - passthrough, 0.75), 0.98);
      ctx.fillStyle = background;
      ctx.globalAlpha = bgAlpha;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // 2. Scramble grid cells and render ASCII cipher glyphs
      const rad = Math.max(radius, 1);
      const inner = rad * (1 - Math.min(Math.max(softness, 0.02), 1));
      const bandW = Math.max(rad * Math.min(Math.max(edgeWidth, 0.0), 1) * 0.5, 6);
      const bandCenter = (inner + rad) * 0.5;

      ctx.font = `600 ${Math.floor(cellH * 0.88)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      const scrambleChance = Math.min(Math.max(scramble, 0), 1) * 0.2;

      for (let r = 0; r < rows; r++) {
        const cy = r * cellH + cellH / 2;
        for (let c = 0; c < cols; c++) {
          const cx = c * cellW + cellW / 2;
          const idx = r * cols + c;

          const dist = Math.hypot(cx - pointer.x, cy - pointer.y);
          // Reveal factor: 1 = fully clear, 0 = fully encrypted
          let e = 0;
          if (pointer.active > 0.001) {
            if (dist <= inner) {
              e = 1;
            } else if (dist < rad) {
              const t = (dist - inner) / (rad - inner);
              e = 1 - (t * t * (3 - 2 * t)); // smoothstep
            }
            e *= pointer.active;
          }

          // If fully decoded into clear UI, skip drawing cipher character
          if (e >= 0.95) continue;

          // Wavefront band calculation
          const bandD = dist - bandCenter;
          const ring = Math.exp(-(bandD * bandD) / (2 * bandW * bandW)) * pointer.active;

          // Mutation: characters scramble faster on the wavefront
          const cellReroll = scrambleChance + ring * edgeFlicker * 0.6;
          if (Math.random() < cellReroll) {
            gridChars[idx] = Math.floor(Math.random() * charLen);
          }

          const charCode = gridChars[idx] ?? 0;
          const char = chars[charCode % charLen] ?? "#";

          // Calculate glyph styling based on wavefront edge & cipher glow
          if (ring > 0.25) {
            // Wavefront edge: violent glowing flicker with aberration tint
            const flickerIntensity = 0.8 + Math.random() * 0.4 * edgeFlicker;
            const glowSurge = 1 + ring * edgeGlow * flickerIntensity;
            ctx.fillStyle = ring > 0.55 ? "#6ee7b7" : color; // Emerald highlight
            ctx.globalAlpha = Math.min(flickerIntensity * glowSurge * (1 - e), 1);

            // Subtle chromatic aberration on wavefront
            if (aberration > 0 && ring > 0.4) {
              const angle = Math.atan2(cy - pointer.y, cx - pointer.x);
              const caOffset = (aberration * ring * 0.4);
              ctx.save();
              ctx.fillStyle = "rgba(239, 68, 68, 0.45)"; // Red shift
              ctx.fillText(char, cx + Math.cos(angle) * caOffset, cy + Math.sin(angle) * caOffset);
              ctx.fillStyle = "rgba(56, 189, 248, 0.45)"; // Cyan shift
              ctx.fillText(char, cx - Math.cos(angle) * caOffset, cy - Math.sin(angle) * caOffset);
              ctx.restore();
            }
          } else {
            // Unrevealed background cipher: stable matrix glow
            ctx.fillStyle = color;
            ctx.globalAlpha = Math.min(brightness * (0.35 + (idx % 5) * 0.1) * (1 - e), 0.9);
          }

          ctx.fillText(char, cx, cy);
        }
      }

      // 3. Cut out the smooth reveal hole to expose the crisp underlying UI
      if (pointer.active > 0.001) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";

        const grad = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          Math.max(0, inner),
          pointer.x,
          pointer.y,
          rad,
        );
        grad.addColorStop(0, `rgba(0, 0, 0, ${pointer.active})`);
        grad.addColorStop(0.7, `rgba(0, 0, 0, ${pointer.active * 0.85})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. Draw the glowing wavefront edge perimeter
        const ringFlicker = 0.8 + Math.random() * 0.3 * edgeFlicker;
        const edgeAlpha = Math.min(pointer.active * ringFlicker * edgeTint, 0.95);

        ctx.save();
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, bandCenter, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${edgeAlpha})`;
        ctx.lineWidth = Math.max(bandW * 0.6, 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 12 * edgeGlow;
        ctx.stroke();

        // High-energy inner laser filament
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, inner, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(110, 231, 183, ${edgeAlpha * 0.65})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      rafId = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncSize();
    });
    resizeObserver.observe(container);

    rafId = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      rectCache.destroy();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [
    useNativeWebGL,
    radius,
    softness,
    cell,
    aspect,
    charset,
    color,
    brightness,
    scramble,
    scrambleSpeed,
    edgeWidth,
    edgeFlicker,
    edgeGlow,
    edgeTint,
    aberration,
    passthrough,
    background,
    smoothing,
    onActiveChange,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ position: "relative", ...style }}
    >
      {/* 1. Native WebGL layoutsubtree canvas (only rendered when experimental html-in-canvas is active) */}
      {useNativeWebGL ? (
        <>
          <canvas
            ref={sourceRef}
            // @ts-expect-error experimental html-in-canvas attribute
            layoutsubtree="true"
            suppressHydrationWarning
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <div
              ref={contentRef}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "auto",
              }}
            >
              {children}
            </div>
          </canvas>
          <canvas
            ref={outputRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        /* 2. Universal Hybrid Overlay Engine (100% interactive DOM underneath, high-FPS ASCII Cipher Decrypt canvas on top) */
        <>
          <div
            ref={contentRef}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              zIndex: 1,
            }}
          >
            {children}
          </div>
          <canvas
            ref={overlayCanvasRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 10,
              borderRadius: "inherit",
            }}
          />
        </>
      )}
    </div>
  );
}

export default DecryptReveal;
