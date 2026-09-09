"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Lock, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { useWeb3Wallet } from "./web3-context";

const emptySubscribe = () => () => {};

export function WalletGateOverlay(): ReactNode {
  const {
    isConnected,
    isConnecting,
    isBaseSepolia,
    connect,
    switchToBaseSepolia,
    simulateConnect,
  } = useWeb3Wallet();

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // Avoid SSR hydration mismatch
  if (!mounted) {
    return null;
  }

  // If connected on Base Sepolia, gate is open
  if (isConnected && isBaseSepolia) {
    return null;
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div
        className="wallet-gate-overlay absolute inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-md bg-neutral-950/75"
        data-testid="wallet-gate-overlay"
        role="region"
        aria-label="Operator clearance required"
      >
        <div
          className="wallet-gate-card relative max-w-md w-full rounded-3xl border border-neutral-800 bg-[#14141a] p-7 text-center shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200"
          style={{ boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9)" }}
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-700/60 bg-neutral-900 shadow-inner">
            <span className="text-2xl" role="img" aria-label="Wallet">🦊</span>
            <span
              className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#14141a] bg-blue-500"
              title="Base Sepolia Active"
            />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-400 uppercase">
              <Lock className="h-3 w-3" />
              <span>Operator Clearance Required</span>
            </div>
            <h2 className="text-xl font-semibold text-white tracking-tight mt-1">
              Connect Web3 Wallet
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              Aura Console enforces cryptographic authorization on Base Sepolia. Connect your Web3 wallet (MetaMask / Coinbase) to decrypt counterparty dossiers, verify Bayesian reputation parameters, and execute autonomous capital missions.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full pt-1">
            <button
              type="button"
              onClick={() => connect()}
              disabled={isConnecting}
              className="cs__wallet-connect-btn flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black shadow-md transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
              data-testid="gate-connect-wallet-btn"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-black" />
                  <span>Connecting to Wallet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-black" />
                  <span>Connect MetaMask</span>
                </>
              )}
            </button>

            {simulateConnect && (
              <button
                type="button"
                onClick={() => simulateConnect()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700/70 bg-neutral-900/90 px-4 py-2.5 font-mono text-xs font-medium text-neutral-300 transition-all hover:bg-neutral-800 hover:border-neutral-600 cursor-pointer"
                data-testid="gate-simulate-connect-btn"
              >
                <span>⚡ Quick Connect (Simulate for Demo)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 pt-1">
            <span>Base Sepolia (84532)</span>
            <span>•</span>
            <span>Salted Keccak256 Proof</span>
          </div>
        </div>
      </div>
    );
  }

  // Wrong Network state
  return (
    <div
      className="wallet-gate-overlay absolute inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-md bg-neutral-950/75"
      data-testid="wallet-wrong-net-overlay"
      role="region"
      aria-label="Wrong Network"
    >
      <div
        className="wallet-gate-card relative max-w-md w-full rounded-3xl border border-amber-900/60 bg-[#161414] p-7 text-center shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9)" }}
      >
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-950/40 shadow-inner">
          <ShieldAlert className="h-7 w-7 text-amber-400" />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-400 uppercase">
            <span>Network Mismatch</span>
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight mt-1">
            Switch to Base Sepolia
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
            Aura Memory contracts and cryptographic commitments are deployed exclusively to Base Sepolia (Chain ID 84532). Please switch your wallet network to proceed.
          </p>
        </div>

        <div className="w-full pt-1">
          <button
            type="button"
            onClick={() => switchToBaseSepolia()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-500 cursor-pointer"
            data-testid="gate-switch-network-btn"
          >
            <span>Switch to Base Sepolia (84532)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
