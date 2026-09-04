"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme";

export type ToolDrawer = "controls" | "source" | null;

type DocsFocusPanelState = {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  documentOpen: boolean;
  setDocumentOpen: (open: boolean) => void;
  toolDrawer: ToolDrawer;
  setToolDrawer: (panel: ToolDrawer) => void;
};

const DocsFocusPanelContext = createContext<DocsFocusPanelState | null>(null);

export function useDocsFocusPanelState() {
  const state = useContext(DocsFocusPanelContext);
  if (!state) {
    throw new Error("useDocsFocusPanelState must be used within DocsLayoutShell.");
  }
  return state;
}

const DocsLayoutShell: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [navOpen, setNavOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [toolDrawer, setToolDrawer] = useState<ToolDrawer>(null);

  // Re-apply the stored theme on mount. An inline script in the root layout
  // would avoid the one-frame flash, but React never executes scripts it
  // renders, so it warns; a blocking external script is a poor trade for that
  // frame. `ModeToggle` observes the class, so the button reports whatever
  // ends up applied here rather than assuming a default.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      document.documentElement.classList.toggle("dark", stored === "dark");
    } catch {
      // Blocked storage leaves the surface on its default theme.
    }
  }, []);

  return (
    <DocsFocusPanelContext
      value={{
        navOpen,
        setNavOpen,
        documentOpen,
        setDocumentOpen,
        toolDrawer,
        setToolDrawer,
      }}
    >
      <div className="relative h-svh overflow-hidden bg-raised">{children}</div>
    </DocsFocusPanelContext>
  );
};

export default DocsLayoutShell;
