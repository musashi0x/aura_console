"use client";

import type { ReactNode } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { Theme } from "@astryxdesign/core/theme";
import { useMediaQuery } from "@astryxdesign/core/hooks";

import { neutralTheme } from "@/themes/neutral/neutral.js";

import { console_ } from "../copy";
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
  children: ReactNode;
}

/** The chat is a region of the frame, not a floating sheet. */
const CHAT_PANEL_WIDTH = 420;

/**
 * Below this the frame cannot afford two columns: a 420px panel beside a 375px
 * viewport pushed the whole document sideways.
 *
 * The query asks whether the viewport is NARROW rather than whether it is wide,
 * because `useMediaQuery` returns false on its first render for SSR. Phrased
 * this way that first answer means "not narrow", so a desktop paints the panel
 * once; a phone reflows once instead. One of the two had to, and the phone is
 * the case where the layout visibly changes anyway.
 */
const NARROW = "(max-width: 59.99rem)";

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
function ConsoleChatRegion({ runId }: { runId?: string }) {
  return (
    <div className="cs__chat-region">
      <div className="cs__chat-dock-head">
        <h2 className="cs__chat-dock-title">{console_.chat.dock.label}</h2>
        <ConsoleChatCloseButton />
      </div>
      <ConsoleChatPanel runId={runId} />
    </div>
  );
}

export function ConsoleShell({
  surface,
  readiness,
  runRef,
  hostsConversation = false,
  children,
}: ConsoleShellProps) {
  const chatOpen = useChatOpen();
  const chatTouched = useChatTouched();
  const narrow = useMediaQuery(NARROW);
  /* Docked beside the workspace when there is room, and a sheet over it when
     there is not. Never both, and never a 420px column on a 375px screen.
     A sheet rather than a replacement: putting the chat where the content goes
     took the page's h1 with it, so a phone had a document with no heading. */
  /* A surface that renders the conversation itself gets no dock, no sheet and
     no launcher. Two live transcripts of one thread on one screen is not a
     second way in, it is the same conversation disagreeing with itself. */
  const chatDocked = chatOpen && !narrow && !hostsConversation;
  /* The sheet needs an actual decision. `chatOpen` starts true so the docked
     panel is present on a wide screen without being asked for, and on a phone
     that same default put a full-height chat over every surface on arrival —
     the operator reached Agents and got a conversation instead of the page.
     A panel beside the content and a sheet on top of it are different offers. */
  const chatAsSheet = chatOpen && narrow && !hostsConversation && chatTouched;

  return (
    /* The console is a dark operator surface, always — it is not the docs, and
       it has no light variant to follow a toggle into. Declaring the mode here
       rather than globally lets the docs keep their own light/dark switch
       without the two disagreeing about one shared value. */
    <Theme theme={neutralTheme} mode="dark">
      <AppShell
        height="fill"
        contentPadding={0}
        topNav={<ConsoleTopbar surface={surface} readiness={readiness} runRef={runRef} />}
        sideNav={<ConsoleNavigation surface={surface} />}
      >
        <Layout
          content={
            /* The workspace scrolls, and a surface whose content is all
               read-only text has nothing inside it a keyboard can reach — so
               the region itself has to be reachable, or that page cannot be
               scrolled without a mouse. axe reports it as
               scrollable-region-focusable. */
            <LayoutContent padding={6} tabIndex={0}>
              {/* The query container for the surfaces inside. They size
                  against the workspace, not the window: with the chat panel
                  open a wide window still leaves a narrow content region, and
                  a viewport breakpoint laid five spine columns into space that
                  fits one. */}
              <div className="cs__workspace">{children}</div>
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
              >
                <ConsoleChatRegion runId={runRef} />
              </LayoutPanel>
            ) : undefined
          }
        />
      </AppShell>
      {/* On a phone the chat is a sheet over the page, so the surface it is
          discussing stays in the document behind it. `tall` because the
          composer brings up the mobile keyboard.
          Mounted only where the frame actually needs it: a sheet renders its
          children even while closed, so on the chat surface it put a second
          live transcript of the same thread behind the first. */}
      {narrow && !hostsConversation && chatTouched ? (
        <BottomSheet
          isOpen={chatAsSheet}
          onOpenChange={(open) => setChatOpen(open)}
          purpose="form"
          height="tall"
          label={console_.chat.dock.label}
        >
          <ConsoleChatRegion runId={runRef} />
        </BottomSheet>
      ) : null}
      {chatOpen || hostsConversation ? null : <ConsoleChatLauncher />}
    </Theme>
  );
}
