"use client";

import Link from "next/link";
import { Home, BookOpenText } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  DOCS_THEME_SERVER_UNKNOWN,
  getDocsThemeSnapshot,
  setDocsTheme,
  subscribeDocsTheme,
  type DocsTheme,
} from "@/lib/docs-theme";
import { TopNav } from "@astryxdesign/core/TopNav";

import { useDocsFocusPanelState } from "./docs-layout-shell";

/**
 * Mode toggle for the docs shell. It reports the theme actually applied to
 * <html> instead of assuming one: a hard-coded initial value made the button
 * announce "dark theme"on a light page and turned the first click into a
 * no-op, because it removed a class that had never been added. The choice is
 * persisted, and `restoreDocsTheme` re-applies it on mount in the layout
 * shell. (An earlier comment here credited a `THEME_INIT_SCRIPT` that has
 * never existed; anyone trusting it would delete the restore effect as
 * redundant and lose the stored theme on every load.)
 */
function ModeToggle() {
  const theme = useSyncExternalStore<DocsTheme | null>(
    subscribeDocsTheme,
    getDocsThemeSnapshot,
    () => DOCS_THEME_SERVER_UNKNOWN,
  );

  const mounted = theme !== null;
  const isDark = theme === "dark";
  const nextTheme: DocsTheme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      disabled={!mounted}
      aria-label={`${isDark ? "dark" : "light"} theme. Switch to ${nextTheme} theme`}
      aria-pressed={isDark}
      title={`Switch to ${nextTheme} theme`}
      onClick={() => setDocsTheme(nextTheme)}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50   ",
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className={cn(
          "size-4 transition-transform duration-300 motion-reduce:transition-none",
          isDark ? "-rotate-45" : "rotate-[135deg]",
        )}
      >
        <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" />
        <path d="M5 20L19 5" strokeLinejoin="round" />
        <path
          d="M16 9L22 13.8528M12.4128 12.4059L19.3601 18.3634M8 15.6672L15 21.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}


function IconButton({
  label,
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50   ",
        active && "bg-raised text-ink  ",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Topbar() {
  const { documentOpen, setDocumentOpen } = useDocsFocusPanelState();

  return (
    <TopNav
      label="Documentation context"
      heading={
        <Link href="/" className="docs-brand" aria-label="Aura Console home">
          <Home className="size-4" aria-hidden="true" />
        </Link>
      }
      endContent={
        <>
          <Link
            href="https://github.com/musashi0x/aura_memory"
            target="_blank"
            rel="noreferrer"
            aria-label="View Aura Console on GitHub"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <FaGithub className="size-4" aria-hidden="true" />
          </Link>
          <IconButton
            label="Page detail"
            active={documentOpen}
            onClick={() => setDocumentOpen(!documentOpen)}
          >
            <BookOpenText className="size-4" />
          </IconButton>
          <ModeToggle />
        </>
      }
    />
  );
}
