"use client";

import { useState, useEffect, type ReactNode } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { Theme } from "@astryxdesign/core/theme";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Maximize2, Minimize2 } from "lucide-react";

import { stoneTheme } from "@/themes/stone/stone.js";
import { InteractionSounds, SoundToggle } from "@/components/primitives";

import { console_ } from "../copy";
import type { ChatGrounding } from "./console-chat";
import {
  ConsoleChatCloseButton,
  ConsoleChatLauncher,
  ConsoleChatPanel,
  setChatOpen,
  useChatTouched,
  useChatOpen,
} from "./console-chat-dock";
import { ConsoleNavigation } from "./console-navigation";
import type { ReadinessState } from "./console-status";
import { ConsoleTopbar } from "./console-topbar";
import { Web3WalletProvider } from "@/features/web3";

export interface ConsoleShellProps {
  /** The destination the operator is on, for navigation and the context bar. */
  surface: string;
  readiness: ReadinessState;
  /** Shown in the context bar only when a Run is actually selected. */
  runRef?: string;
  /**
   * True when the surface renders the conversation itself, as a Mission does.
   * The shell then docks nothing: conversation is a mode inside a Mission, not
   * a column beside it.
   */
  hostsConversation?: boolean;
  /**
   * Checked readiness of the answering path, read on the server.
   *
   * The docked chat reaches every console surface, so it needs this on every
   * one. Passing it only from the Mission routes left the panel reporting
   * "not checked" on four surfaces where the console could have checked.
   */
  grounding?: ChatGrounding;
  children: ReactNode;
}

/** Standard and expanded chat panel dimensions for readability. */
const CHAT_PANEL_WIDTH = 420;
const CHAT_PANEL_EXPANDED_WIDTH = 760;

/**
 * Below this the frame cannot comfortably afford two columns: a docked chat panel
 * beside side nav on a tablet viewport crushes the workspace.
 * Chat is launched on demand as a sheet below this breakpoint.
 */
const NARROW = "(max-width: 69.99rem)";

/**
 * The console frame, built from the design system's own shell.
 *
 * AppShell owns the skip link, the main landmark and the mobile nav drawer;
 * Layout splits the workspace from the chat. Both were hand-rolled here before,
 * along with a collapse store, an `inert` rail and a right-hand gutter the
 * workspace had to reserve so a fixed chat panel would not cover it. The end
 * panel makes that reservation the layout's job, which is what it always was.
 *
 * The peel effect the rail used to carry is not in this frame. It was tied to
 * the hand-built rail, and it comes back as its own overlay rather than as a
 * reason to keep a second shell.
 *
 * This is a client component so the rail can collapse and the chat can open.
 * Pages stay server components: their output arrives here as `children`.
 */
/**
 * The chat's own query container, wherever the frame puts it. Its composer
 * stacks when the region is narrow, and the container it used to measure was
 * the fixed dock — an element this frame no longer has, so the query silently
 * never matched and the input clipped its own placeholder.
 */
function ConsoleChatRegion({
  runId,
  grounding,
  isExpanded = false,
  onToggleExpand,
}: {
  runId?: string;
  grounding?: ChatGrounding;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div className="cs__chat-region">
      <div className="cs__chat-dock-head flex items-center justify-between gap-2">
        <h2 className="cs__chat-dock-title">{console_.chat.dock.label}</h2>
        <div className="flex items-center gap-1.5">
          {onToggleExpand && (
            <button
              type="button"
              className="btn cs__chat-expand-btn text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-white/10 hover:bg-white/10 text-neutral-300 transition-colors cursor-pointer"
              onClick={onToggleExpand}
              title={isExpanded ? "Collapse to standard view (420px)" : "Expand to wide view (760px)"}
              aria-label={isExpanded ? "Collapse chat panel" : "Expand chat panel to wide view"}
              data-testid="chat-expand-toggle-btn"
            >
              {isExpanded ? (
                <>
                  <Minimize2 size={13} className="text-neutral-400" />
                  <span className="text-[11px] font-mono">Standard</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} className="text-neutral-400" />
                  <span className="text-[11px] font-mono">Expand</span>
                </>
              )}
            </button>
          )}
          <ConsoleChatCloseButton />
        </div>
      </div>
      <ConsoleChatPanel runId={runId} grounding={grounding} />
    </div>
  );
}

function ConsoleShellInner({
  surface,
  readiness,
  runRef,
  hostsConversation = false,
  grounding,
  children,
}: ConsoleShellProps) {
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatOpen = useChatOpen();
  const chatTouched = useChatTouched();
  const narrow = useMediaQuery(NARROW);
  const canExpandInline = useMediaQuery("(min-width: 96rem)");
  const isExpanded = chatOpen && chatExpanded;
  const chatDocked = chatOpen && !narrow && !hostsConversation && (!isExpanded || canExpandInline);
  const chatAsSheet = chatOpen && narrow && !hostsConversation && chatTouched;
  const showOverlayDrawer = chatOpen && !hostsConversation && !narrow && isExpanded && !canExpandInline;

  useEffect(() => {
    if (!isExpanded || canExpandInline) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setChatExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, canExpandInline]);

  return (
    <>
      <InteractionSounds />
      <AppShell
        height="fill"
        contentPadding={0}
        topNav={
          <ConsoleTopbar
            surface={surface}
            readiness={readiness}
            runRef={runRef}
            actions={<SoundToggle variant="icon" />}
          />
        }
        sideNav={<ConsoleNavigation surface={surface} />}
      >
        <Layout
          content={
            <LayoutContent padding={6} tabIndex={0}>
              <div className="cs__workspace relative w-full min-h-[580px] flex flex-col flex-1 min-w-0">
                {children}
              </div>
            </LayoutContent>
          }
          end={
            chatDocked ? (
              <LayoutPanel
                width={chatExpanded ? CHAT_PANEL_EXPANDED_WIDTH : CHAT_PANEL_WIDTH}
                hasDivider
                padding={4}
                role="complementary"
                label={console_.chat.dock.label}
                className={`cs__chat-dock transition-all duration-300 ${chatExpanded ? "cs__chat-dock--expanded" : ""}`}
              >
                <ConsoleChatRegion
                  runId={runRef}
                  grounding={grounding}
                  isExpanded={chatExpanded}
                  onToggleExpand={() => setChatExpanded((prev) => !prev)}
                />
              </LayoutPanel>
            ) : undefined
          }
        />
      </AppShell>
      {/* Floating slide-over drawer when expanded on viewports below 96rem (1536px) */}
      {showOverlayDrawer ? (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setChatExpanded(false)}
            aria-hidden="true"
          />
          <aside
            role="complementary"
            aria-label={console_.chat.dock.label}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[760px] bg-neutral-900 border-l border-white/10 shadow-2xl p-4 flex flex-col transition-transform animate-in slide-in-from-right duration-200"
          >
            <ConsoleChatRegion
              runId={runRef}
              grounding={grounding}
              isExpanded={chatExpanded}
              onToggleExpand={() => setChatExpanded(false)}
            />
          </aside>
        </>
      ) : null}
      {narrow && !hostsConversation && chatTouched ? (
        <BottomSheet
          isOpen={chatAsSheet}
          onOpenChange={(open) => setChatOpen(open)}
          purpose="form"
          height="tall"
          label={console_.chat.dock.label}
        >
          <ConsoleChatRegion runId={runRef} grounding={grounding} />
        </BottomSheet>
      ) : null}
      {!hostsConversation && !chatDocked && !chatAsSheet && !showOverlayDrawer ? (
        <ConsoleChatLauncher />
      ) : null}
    </>
  );
}

export function ConsoleShell(props: ConsoleShellProps) {
  return (
    <Web3WalletProvider>
      <Theme theme={stoneTheme} mode="dark">
        <ConsoleShellInner {...props} />
      </Theme>
    </Web3WalletProvider>
  );
}

