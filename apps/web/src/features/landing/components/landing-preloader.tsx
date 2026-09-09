"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuraIcon } from "@/components/aura-logo";

interface LandingPreloaderProps {
  /**
   * Optional callback when preloader finishes dismissing
   */
  onComplete?: () => void;
  /**
   * Maximum duration in ms before auto-dismissing (default 6800ms).
   */
  fallbackTimeoutMs?: number;
}

export function LandingPreloader({
  onComplete,
  fallbackTimeoutMs,
}: LandingPreloaderProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isExitingRef = useRef(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleDismiss = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);

    dismissTimerRef.current = setTimeout(() => {
      setIsDismissed(true);
      onComplete?.();
    }, 700);
  }, [onComplete]);

  // Clean up any pending dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // Autofocus the skip button on mount for keyboard & screen reader accessibility
  useEffect(() => {
    skipButtonRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts (Escape, Space) with preventDefault to avoid background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDismiss]);

  // Lock body scroll while preloader is active
  useEffect(() => {
    if (isDismissed) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isDismissed]);

  // If dismissed immediately on mount (e.g. reduced motion), invoke onComplete
  useEffect(() => {
    if (isDismissed) {
      onComplete?.();
    }
  }, [isDismissed, onComplete]);

  // Fallback timer: ensure preloader dismisses automatically after timeout
  useEffect(() => {
    if (isDismissed) return;

    const timeout = fallbackTimeoutMs ?? 6800;
    const timer = setTimeout(() => {
      handleDismiss();
    }, timeout);

    return () => clearTimeout(timer);
  }, [handleDismiss, fallbackTimeoutMs, isDismissed]);

  // Attempt video playback with standard browser feature detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (typeof video.play === "function") {
      try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Autoplay may be restricted by browser policy; fallback timer handles completion
          });
        }
      } catch {
        // Playback not supported
      }
    }
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration || Number.isNaN(video.duration)) return;
    const pct = Math.round((video.currentTime / video.duration) * 100);
    setProgress(Math.min(100, Math.max(0, pct)));
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Aura Memory preloader sequence"
      className={`fixed inset-0 z-[9999] flex flex-col justify-between bg-[#070a12] text-white p-6 sm:p-10 select-none transition-all duration-700 ease-out ${
        isExiting
          ? "opacity-0 scale-[1.03] filter blur-[4px] pointer-events-none"
          : "opacity-100 scale-100"
      }`}
    >
      {/* Top Header / Telemetry Bar */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="inline-flex items-center gap-2.5">
          <AuraIcon size={24} className="text-emerald-400" />
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold tracking-wider text-neutral-200">
              AURA MEMORY
            </span>
            <span className="font-mono text-[10px] text-neutral-400">
              PERSISTENT AGENT STATE RUNTIME
            </span>
          </div>
        </div>

        <button
          ref={skipButtonRef}
          type="button"
          autoFocus
          onClick={handleDismiss}
          aria-label="Skip preloader animation"
          className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 font-mono text-xs text-neutral-200 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
        >
          <span>Skip</span>
          <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-neutral-300 font-mono group-hover:bg-white/25">
            Esc
          </kbd>
        </button>
      </div>

      {/* Center Video Container */}
      <div className="relative flex-1 flex items-center justify-center w-full max-w-5xl mx-auto my-auto overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/preloader-poster.jpg"
          onEnded={handleDismiss}
          onError={handleDismiss}
          onTimeUpdate={handleTimeUpdate}
          aria-label="How do I give my agent lasting memory animation"
          className="w-full max-h-[72vh] object-contain rounded-xl shadow-2xl border border-white/10"
        >
          <source src="/preloader.webm" type="video/webm" />
          <source src="/preloader.mp4" type="video/mp4" />
          <source src="/light-rails-0909-164913.webm" type="video/webm" />
          <p className="sr-only">
            How do I give my agent lasting memory? Aura Memory light rails preloader animation.
          </p>
        </video>
      </div>

      {/* Bottom Progress Bar & Telemetry */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 z-10 font-mono text-xs text-neutral-400">
        <div className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] tracking-wide text-neutral-300 uppercase">
            INITIALIZING 5-TIER MEMORY RECALL
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 transition-all duration-150 ease-out"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
          <span className="text-[10px] text-neutral-400 w-8 text-right tabular-nums">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
