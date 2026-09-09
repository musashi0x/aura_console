"use client";

import { useState } from "react";
import { Check, History } from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";

export type DiffRow = {
  key: string;
  field: string;
  previousValue: string;
  newValue: string;
  status: "modified" | "added" | "removed" | "unchanged";
};

const DEFAULT_DIFF_ROWS: DiffRow[] = [
  {
    key: "reliability",
    field: "Beta Labs Reliability",
    previousValue: "0.78 (12 tasks)",
    newValue: "0.84 (14 tasks)",
    status: "modified",
  },
  {
    key: "status",
    field: "Relationship Status",
    previousValue: "PROBATIONARY",
    newValue: "ESTABLISHED",
    status: "modified",
  },
  {
    key: "commitment",
    field: "Base Sepolia Hash",
    previousValue: "0x8fa1...d4b2",
    newValue: "0x3e9c...81a0",
    status: "added",
  },
  {
    key: "spend_limit",
    field: "Remaining Daily Guardrail",
    previousValue: "100.00 USDC",
    newValue: "90.00 USDC",
    status: "modified",
  },
];

export interface DiffTableProps {
  title?: string;
  rows?: DiffRow[];
  onApply?: (selectedKeys: string[]) => void | Promise<void>;
  className?: string;
}

export function DiffTable({
  title = "Memory State & Ledger Diffs",
  rows = DEFAULT_DIFF_ROWS,
  onApply,
  className = "",
}: DiffTableProps) {
  const [userSelection, setUserSelection] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [prevRows, setPrevRows] = useState(rows);

  if (rows !== prevRows) {
    setPrevRows(rows);
    setUserSelection({});
    const hasPendingChanges = rows.some(
      (r) => r.status !== "unchanged" && r.previousValue !== r.newValue
    );
    if (hasPendingChanges && applied) {
      setApplied(false);
    }
  }

  const toggleRow = (key: string) => {
    if (applied) return;
    playInteractionSound("tick");
    setUserSelection((curr) => ({ ...curr, [key]: !(curr[key] ?? true) }));
  };

  const handleApply = async () => {
    playInteractionSound("pulse");
    const keys = rows
      .filter((r) => userSelection[r.key] ?? true)
      .map((r) => r.key);
    if (keys.length === 0) return;
    setApplying(true);
    try {
      if (onApply) {
        await onApply(keys);
      }
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  const selectedCount = rows.filter((r) => userSelection[r.key] ?? true).length;

  return (
    <div
      data-diff-table
      className={`w-full max-w-[620px] rounded-[10px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] overflow-hidden text-[#f4f7fb] my-3 ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[rgba(216,216,219,0.12)] px-3.5 py-2.5 bg-[#111015]/40">
        <div className="flex items-center gap-2">
          <History size={14} className="text-[#d8d8db]" />
          <span className="text-[13px] font-semibold">{title}</span>
        </div>
        {!applied && (
          <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)]">
            Click row to include/exclude
          </span>
        )}
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[rgba(216,216,219,0.12)] bg-[#111015]/20 text-[11px] text-[var(--color-text-muted,#8d9aaf)] uppercase tracking-wider">
              <th className="px-3.5 py-2">Field / State</th>
              <th className="px-3 py-2">Previous Value</th>
              <th className="px-3 py-2">New Value</th>
              <th className="px-3 py-2 text-right">Include</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(216,216,219,0.08)]">
            {rows.map((row) => {
              const isIncluded = userSelection[row.key] ?? true;
              return (
                <tr
                  key={row.key}
                  tabIndex={applied ? undefined : 0}
                  role="checkbox"
                  aria-checked={isIncluded}
                  onClick={() => toggleRow(row.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleRow(row.key);
                    }
                  }}
                  className={`transition-colors cursor-pointer ${
                    isIncluded
                      ? "bg-[#1b1b1f] hover:bg-[#25252a]"
                      : "opacity-40 hover:opacity-60 bg-[#111015]/40"
                  }`}
                >
                  <td className="px-3.5 py-2.5 font-medium text-[#f4f7fb]">
                    {row.field}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-muted,#8d9aaf)] line-through">
                    {row.previousValue}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[#51e6a6]">
                    {row.newValue}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`inline-flex size-4 items-center justify-center rounded-[4px] border ${
                        isIncluded
                          ? "border-[#51e6a6] bg-[#51e6a6] text-[#111015]"
                          : "border-[rgba(216,216,219,0.24)] text-transparent"
                      }`}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-[rgba(216,216,219,0.12)] bg-[#111015]/30 px-3.5 py-2.5 flex items-center justify-between">
        {applied ? (
          <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#51e6a6]">
            <Check size={13} strokeWidth={2.5} />
            <span>{selectedCount} state mutations committed to Base Sepolia memory log</span>
          </div>
        ) : (
          <>
            <span className="text-[11.5px] font-mono text-[var(--color-text-muted,#8d9aaf)]">
              {selectedCount} of {rows.length} changes selected
            </span>
            <button
              type="button"
              disabled={selectedCount === 0 || applying}
              onClick={handleApply}
              data-sound="pulse"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#f3f3f5] text-[#111015] text-[12px] font-semibold hover:bg-white transition-colors disabled:opacity-30"
            >
              <Check size={12} strokeWidth={2.5} />
              <span>{applying ? "Applying..." : `Apply ${selectedCount} ${selectedCount === 1 ? "Diff" : "Diffs"}`}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default DiffTable;
