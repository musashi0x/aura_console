"use client";

import type { ReactNode } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { Theme } from "@astryxdesign/core/theme";
import { useMediaQuery } from "@astryxdesign/core/hooks";

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

/** The chat is a region of the frame, not a floating sheet. */
const CHAT_PANEL_WIDTH = 380;

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
}: {
  runId?: string;
  grounding?: ChatGrounding;
}) {
  return (
    <div className="cs__chat-region">
      <div className="cs__chat-dock-head">
        <h2 className="cs__chat-dock-title">{console_.chat.dock.label}</h2>
        <ConsoleChatCloseButton />
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
  const chatOpen = useChatOpen();
  const chatTouched = useChatTouched();
  const narrow = useMediaQuery(NARROW);
  const chatDocked = chatOpen && !narrow && !hostsConversation;
  const chatAsSheet = chatOpen && narrow && !hostsConversation && chatTouched;

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
              <div className="cs__workspace relative w-full min-h-[580px] flex flex-col flex-1">
                {children}
              </div>
            </LayoutContent>
          }
          end={
            chatDocked ? (
              <LayoutPanel
                width={CHAT_PANEL_WIDTH}
                hasDivider
                padding={4}
                role="complementary"
                label={console_.chat.dock.label}
                className="cs__chat-dock"
              >
                <ConsoleChatRegion runId={runRef} grounding={grounding} />
              </LayoutPanel>
            ) : undefined
          }
        />
      </AppShell>
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
      {!hostsConversation && !chatDocked && !chatAsSheet ? (
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

