"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";

const emptySubscribe = () => () => {};

export function ThemeSwitch(): ReactNode {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <div className="fixed right-6 bottom-6 z-50">
        <button
          className="border-border bg-frame/80 flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full border opacity-40 shadow-lg backdrop-blur-md"
          aria-label="Toggle theme"
          disabled
        />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <button
        onClick={toggleTheme}
        className="border-border hover:border-accent/60 bg-frame/95 text-foreground flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:shadow-2xl"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-pressed={isDark}
        type="button"
      >
        {isDark ? (
          <Sun className="text-accent h-5 w-5" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5 text-neutral-800" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
