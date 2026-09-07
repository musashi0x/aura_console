"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";

export type SoundCue = "press" | "tick" | "pulse" | "release" | "chime";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem("bui-sounds") !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("bui-sounds", enabled ? "on" : "off");
    window.dispatchEvent(new CustomEvent("bui-sounds-changed", { detail: enabled }));
  } catch {
    // Ignore storage quota or access errors
  }
}

export function playInteractionSound(cue: SoundCue): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.24, now);
    masterGain.connect(ctx.destination);

    switch (cue) {
      case "press": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.028);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.032);
        break;
      }
      case "tick": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1900, now);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.018);
        break;
      }
      case "pulse": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.135);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }
      case "release": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      }
      case "chime": {
        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 harmonic triad
        frequencies.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.05;
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.18, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(start);
          osc.stop(start + 0.24);
        });
        break;
      }
    }
  } catch {
    // Audio synthesis failure should never crash the UI
  }
}

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[role='button']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='tab']",
  "[role='radio']",
  "[role='menuitem']",
].join(",");

const RELEASE_REGEX = /close|dismiss|remove|delete|collapse|cancel|clear|reject/i;
const PULSE_REGEX = /send|submit|approve|apply|create|confirm|authoriz|commit/i;

export function determineElementCue(element: Element): SoundCue {
  const explicit = element.getAttribute("data-sound") as SoundCue | null;
  if (explicit && ["press", "tick", "pulse", "release", "chime"].includes(explicit)) {
    return explicit;
  }

  const label = `${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`.trim();
  if (RELEASE_REGEX.test(label)) return "release";
  if (PULSE_REGEX.test(label)) return "pulse";
  if (element.matches("input[type='checkbox'], input[type='radio'], [role='checkbox'], [role='switch']")) {
    return "tick";
  }
  if (element.matches("input, textarea")) return "tick";
  return "press";
}

export function InteractionSounds() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isSoundEnabled()) return;
      if (!(event.target instanceof Element)) return;

      const target = event.target.closest(INTERACTIVE_SELECTOR);
      if (!target || target.closest("[data-sound-silent]")) return;
      if (target.matches(":disabled, [aria-disabled='true']")) return;

      const cue = determineElementCue(target);
      playInteractionSound(cue);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}

function subscribeSound(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("bui-sounds-changed", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("bui-sounds-changed", onStoreChange);
  };
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    subscribeSound,
    isSoundEnabled,
    () => true
  );
}

export function SoundToggle({
  className = "",
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "icon";
}) {
  const enabled = useSoundEnabled();

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    if (next) {
      playInteractionSound("chime");
    } else {
      playInteractionSound("release");
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={`Sound FX: ${enabled ? "On" : "Off"}`}
        title={`Sound FX: ${enabled ? "On" : "Off"}`}
        aria-pressed={enabled}
        data-sound="press"
        onClick={toggle}
        className={`inline-flex items-center justify-center size-8 rounded-[8px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:border-[rgba(216,216,219,0.32)] transition-colors ${className}`}
      >
        {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Sound FX: ${enabled ? "On" : "Off"}`}
      aria-pressed={enabled}
      data-sound="press"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px] font-medium border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:border-[rgba(216,216,219,0.32)] transition-colors ${className}`}
    >
      {enabled ? (
        <Volume2 size={13} className="text-[#51e6a6]" />
      ) : (
        <VolumeX size={13} className="text-[#8d9aaf]" />
      )}
      <span>Sound FX: {enabled ? "On" : "Off"}</span>
    </button>
  );
}

export default InteractionSounds;
