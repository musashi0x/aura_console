"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { Theme } from "@astryxdesign/core/theme";

import { DocsNavigation } from "@/components/docs/docs-navigation";
import { useDocsFocusPanelState } from "@/components/docs/docs-layout-shell";
import { Topbar } from "@/components/docs/topbar";
import {
  DOCS_THEME_SERVER_SNAPSHOT,
  getDocsThemeSnapshot,
  subscribeDocsTheme,
} from "@/lib/docs-theme";
import { neutralTheme } from "@/themes/neutral/neutral.js";

/** The detail panel's budget, the same reading width the console's chat uses. */
const DETAIL_PANEL_WIDTH = 420;

/**
 * The documentation shell, built from the design system's own frame.
 *
 * AppShell owns the skip link, the main landmark and the mobile nav drawer;
 * SideNav owns the rail and its collapse; Layout splits the article from the
 * detail panel. All of that was hand-built here — a grid whose columns were
 * animated between four hard-coded track lists, a desktop pane, a separate
 * mobile drawer, and a right panel translated off-screen and hidden.
 *
 * The peel is not in this frame. It needs to own the content element while
 * rendering the rail as its `under` layer, and AppShell owns the first while
 * SideNav owns the second. Losing it costs nothing today: the effect draws
 * through the experimental html-in-canvas API, and on current Chrome
 * `drawElementImage` and `requestPaint` are undefined, so its capture step
 * returns immediately and the sheet has never rendered a curl for anyone
 * without the flag. The component stays on disk for when that ships.
 */
export function DocsPageShell({
  children,
  rightPanel,
}: {
  children: ReactNode;
  rightPanel?: ReactNode;
}) {
  const { documentOpen } = useDocsFocusPanelState();
  /* Read from the class Tailwind resolves against, so the Astryx tokens and the
     utility classes can never end up on opposite sides of the toggle. */
  const mode = useSyncExternalStore(
    subscribeDocsTheme,
    getDocsThemeSnapshot,
    () => DOCS_THEME_SERVER_SNAPSHOT,
  );

  return (
    <Theme theme={neutralTheme} mode={mode}>
      <AppShell
        height="fill"
        contentPadding={0}
        topNav={<Topbar />}
        sideNav={<DocsNavigation />}
      >
        <Layout
          content={
            /* No `tabIndex` here: unlike the console workspace, every docs page
               carries links, so the scroll container is already reachable. The
               code blocks scroll on their own and carry their own tab stop. */
            <LayoutContent padding={0}>{children}</LayoutContent>
          }
          end={
            rightPanel && documentOpen ? (
              <LayoutPanel
                width={DETAIL_PANEL_WIDTH}
                hasDivider
                padding={4}
                role="complementary"
                label="Page detail"
              >
                {rightPanel}
              </LayoutPanel>
            ) : undefined
          }
        />
      </AppShell>
    </Theme>
  );
}
