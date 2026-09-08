"use client";

import { useEffect, useRef, useState } from "react";
import { useWeb3Wallet } from "./web3-context";

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ConnectWalletButton({ className }: { className?: string }) {
  const {
    address,
    isConnected,
    isConnecting,
    isBaseSepolia,
    ethBalance,
    usdcBalance,
    isFetchingBalances,
    refreshBalances,
    connect,
    disconnect,
    switchToBaseSepolia,
  } = useWeb3Wallet();

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (address && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => connect()}
        disabled={isConnecting}
        className={`cs__wallet-connect-btn ${className ?? ""}`.trim()}
        data-testid="wallet-connect-btn"
        aria-label="Connect Web3 Wallet"
      >
        <span className="cs__wallet-icon" aria-hidden="true">🦊</span>
        <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
      </button>
    );
  }

  if (!isBaseSepolia) {
    return (
      <button
        type="button"
        onClick={() => switchToBaseSepolia()}
        className={`cs__wallet-wrong-net-btn ${className ?? ""}`.trim()}
        data-testid="wallet-switch-network-btn"
        aria-label="Switch to Base Sepolia Network"
      >
        <span className="cs__wallet-icon" aria-hidden="true">⚠️</span>
        <span className="cs__wallet-label-full">Switch to Base Sepolia</span>
        <span className="cs__wallet-label-short">Base Sepolia</span>
      </button>
    );
  }

  return (
    <div className="cs__wallet-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`cs__wallet-chip ${className ?? ""}`.trim()}
        data-testid="wallet-chip"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Connected wallet ${truncateAddress(address || "")}`}
      >
        <span className="cs__base-dot" aria-hidden="true" />
        <span className="cs__network-name">Base Sepolia</span>
        <span className="cs__address-tag">{truncateAddress(address || "")}</span>
        {usdcBalance !== null && (
          <span className="cs__wallet-quick-balance" data-testid="wallet-quick-balance">
            {usdcBalance} USDC
          </span>
        )}
        <span className="cs__chevron" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div
          className="cs__wallet-menu"
          data-testid="wallet-menu"
          role="dialog"
          aria-label="Wallet Account Details"
        >
          <div className="cs__wallet-menu-header">
            <span className="cs__wallet-menu-title">Operator Wallet</span>
            <span className="cs__wallet-menu-net" data-testid="wallet-network-badge">
              Base Sepolia (84532)
            </span>
          </div>

          <div className="cs__wallet-menu-address-row">
            <code className="cs__wallet-menu-full-addr">{address}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="cs__wallet-menu-copy-btn"
              aria-label="Copy wallet address"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="cs__wallet-menu-balances" data-testid="wallet-balances">
            <div className="cs__wallet-balance-item">
              <span className="cs__wallet-balance-label">Gas Balance (ETH)</span>
              <span className="cs__wallet-balance-val font-mono" data-testid="wallet-eth-balance">
                {isFetchingBalances ? "Fetching..." : ethBalance !== null ? `${ethBalance} ETH` : "—"}
              </span>
            </div>
            <div className="cs__wallet-balance-item">
              <span className="cs__wallet-balance-label">Spend Balance (USDC)</span>
              <div className="flex items-center gap-1.5">
                <span className="cs__wallet-balance-val font-mono" data-testid="wallet-usdc-balance">
                  {isFetchingBalances ? "Fetching..." : usdcBalance !== null ? `${usdcBalance} USDC` : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => refreshBalances()}
                  disabled={isFetchingBalances}
                  className="cs__wallet-menu-refresh-btn"
                  title="Refresh testnet balances"
                  aria-label="Refresh testnet balances"
                  data-testid="wallet-refresh-balances-btn"
                >
                  <span className={isFetchingBalances ? "inline-block animate-spin" : ""}>↻</span>
                </button>
              </div>
            </div>
          </div>

          <div className="cs__wallet-menu-actions">
            <div className="cs__wallet-menu-links">
              <a
                href={`https://sepolia.basescan.org/address/${address}`}
                target="_blank"
                rel="noreferrer noopener"
                className="cs__wallet-menu-link"
                data-testid="wallet-basescan-link"
              >
                <span>View on BaseScan</span>
                <span aria-hidden="true">↗</span>
              </a>

              <a
                href="https://portal.cdp.coinbase.com/products/faucet"
                target="_blank"
                rel="noreferrer noopener"
                className="cs__wallet-menu-link cs__wallet-faucet-link"
                data-testid="wallet-faucet-link"
              >
                <span>Base Sepolia Faucet</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="cs__wallet-menu-disconnect-btn"
              data-testid="wallet-disconnect-btn"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
