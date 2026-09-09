"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@astryxdesign/core/TopNav";

import { console_ } from "../copy";
import { CommandPalette } from "./command-palette";
import { ConsoleStatus, type ReadinessState } from "./console-status";
import { ConnectWalletButton } from "@/features/web3";

function getUtcTimeString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

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
  actions,
}: {
  surface: string;
  readiness: ReadinessState;
  /** Shown only when a Run is actually selected. */
  runRef?: string;
  actions?: React.ReactNode;
}) {
  const [utcTime, setUtcTime] = useState<string>("");
  const [telemetry, setTelemetry] = useState<{ commit?: string; startedAt?: string }>({});

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      setUtcTime(getUtcTimeString());
    }, 0);
    const interval = setInterval(() => {
      setUtcTime(getUtcTimeString());
    }, 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" && window.location.port === "3010"
        ? "http://localhost:3011"
        : "http://localhost:3001");
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setTelemetry({
            commit: typeof data.commit === "string" ? data.commit : undefined,
            startedAt: typeof data.startedAt === "string" ? data.startedAt : undefined,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <TopNav
      label={console_.topNavLabel}
      heading={
        <Link href="/" className="cs__brand">
          {console_.brand}
        </Link>
      }
      startContent={
        <div className="flex items-center gap-2 max-w-full overflow-hidden flex-nowrap">
          <span className="cs__surface whitespace-nowrap">{surface}</span>
          {runRef ? (
            <code
              className="cs__run-ref max-w-[110px] sm:max-w-[150px] md:max-w-[220px] truncate"
              title={runRef}
            >
              {runRef}
            </code>
          ) : null}
        </div>
      }
      endContent={
        <div className="cs__topbar-end flex items-center gap-1.5 sm:gap-2 max-w-full">
          {actions}
          <ConnectWalletButton />
          {/* The palette lives in the bar so its keyboard hint is discoverable
              without hunting: a shortcut nobody can see is a shortcut nobody
              uses. */}
          <CommandPalette />
          {utcTime ? <span className="cs__utc-clock hidden xl:inline">{utcTime}</span> : null}
          {telemetry.commit ? (
            <code
              className="cs__commit-badge hidden 2xl:inline"
              title={telemetry.startedAt ? `Process started at ${telemetry.startedAt}` : undefined}
            >
              {telemetry.commit.slice(0, 7)}
            </code>
          ) : null}
          <span
            className="cs__env hidden lg:inline"
            title="Base Sepolia Network: Aura Console operates on Base Sepolia testnet and local simulation. Testing agent missions and spend approvals never moves real mainnet funds while executing real cryptographic signatures and testnet contract transactions."
          >
            {console_.environment}
          </span>
          <ConsoleStatus state={readiness} />
        </div>
      }
    />
  );
}

