"use client";

import Link from "next/link";
import { TopNav } from "@astryxdesign/core/TopNav";

import { console_ } from "../copy";
import { CommandPalette } from "./command-palette";
import { ConsoleStatus, type ReadinessState } from "./console-status";

/**
 * The context bar: which surface the operator is on, which Run, and whether
 * the system is answering.
 *
 * The nav toggle is gone from here. SideNav ships its own collapse control, and
 * two controls for one piece of state is how a rail ends up disagreeing with
 * the button that claims to own it.
 */
export function ConsoleTopbar({
  surface,
  readiness,
  runRef,
}: {
  surface: string;
  readiness: ReadinessState;
  /** Shown only when a Run is actually selected. */
  runRef?: string;
}) {
  return (
    <TopNav
      label={console_.topNavLabel}
      heading={
        <Link href="/" className="cs__brand">
          {console_.brand}
        </Link>
      }
      startContent={
        <>
          <span className="cs__surface">{surface}</span>
          {runRef ? <code className="cs__run-ref">{runRef}</code> : null}
        </>
      }
      endContent={
        <>
          {/* The palette lives in the bar so its keyboard hint is discoverable
              without hunting: a shortcut nobody can see is a shortcut nobody
              uses. */}
          <CommandPalette />
          <span className="cs__env">{console_.environment}</span>
          <ConsoleStatus state={readiness} />
        </>
      }
    />
  );
}
