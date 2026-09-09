"use client";

import { useState } from "react";
import { ArrowUpDown, ShieldCheck, Search } from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";

export type CounterpartyRecord = {
  id: string;
  name: string;
  category: string;
  reliabilityScore: number;
  tasksCompleted: number;
  status: "ESTABLISHED" | "PROBATIONARY" | "SUSPENDED";
  lastInteraction: string;
  commitmentHash?: string;
};

const DEFAULT_RECORDS: CounterpartyRecord[] = [
  {
    id: "virtuals:agent:alpha",
    name: "Alpha Studio (Agent)",
    category: "Code & Verification",
    reliabilityScore: 0.42,
    tasksCompleted: 42,
    status: "PROBATIONARY",
    lastInteraction: "2 hours ago",
    commitmentHash: "0x4b7e...9a12",
  },
  {
    id: "virtuals:agent:beta",
    name: "Beta Labs (Agent)",
    category: "Procurement & Data",
    reliabilityScore: 0.84,
    tasksCompleted: 14,
    status: "ESTABLISHED",
    lastInteraction: "1 day ago",
    commitmentHash: "0x8fa1...d4b2",
  },
  {
    id: "virtuals:agent:gamma",
    name: "Gamma Research",
    category: "Market Intelligence",
    reliabilityScore: 0.62,
    tasksCompleted: 5,
    status: "PROBATIONARY",
    lastInteraction: "3 days ago",
    commitmentHash: "0x12dc...65f8",
  },
];

export interface RecordsTableProps {
  records?: CounterpartyRecord[];
  onSelectRecord?: (record: CounterpartyRecord) => void;
  className?: string;
}

export function RecordsTable({
  records = DEFAULT_RECORDS,
  onSelectRecord,
  className = "",
}: RecordsTableProps) {
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<keyof CounterpartyRecord>("reliabilityScore");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: keyof CounterpartyRecord) => {
    playInteractionSound("press");
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filtered = records
    .filter(
      (r) =>
        r.name.toLowerCase().includes(filter.toLowerCase()) ||
        r.id.toLowerCase().includes(filter.toLowerCase()) ||
        r.category.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

  return (
    <div
      data-records-table
      className={`w-full max-w-[760px] rounded-[10px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] overflow-hidden text-[#f4f7fb] my-3 ${className}`}
    >
      {/* Header with search */}
      <div className="flex items-center justify-between border-b border-[rgba(216,216,219,0.12)] px-3.5 py-2.5 bg-[#111015]/40">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#51e6a6]" />
          <span className="text-[13px] font-semibold">Sibyl Counterparty Ledger</span>
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2 text-[var(--color-text-muted,#8d9aaf)]" />
          <input
            type="text"
            placeholder="Search counterparties..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-[6px] border border-[rgba(216,216,219,0.16)] bg-[#111015] pl-7 pr-2.5 py-1 text-[11.5px] text-[#f4f7fb] outline-none focus:border-[#d8d8db]"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[rgba(216,216,219,0.12)] bg-[#111015]/20 text-[11px] text-[var(--color-text-muted,#8d9aaf)] uppercase tracking-wider">
              <th className="px-3.5 py-2 cursor-pointer select-none" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">
                  <span>Counterparty</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="px-3 py-2">Category</th>
              <th
                className="px-3 py-2 cursor-pointer select-none"
                onClick={() => handleSort("reliabilityScore")}
              >
                <div className="flex items-center gap-1">
                  <span>Reliability</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Base Sepolia Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(216,216,219,0.08)]">
            {filtered.map((record) => (
              <tr
                key={record.id}
                onClick={() => {
                  playInteractionSound("press");
                  onSelectRecord?.(record);
                }}
                className="hover:bg-[#25252a] cursor-pointer transition-colors"
              >
                <td className="px-3.5 py-2.5 font-medium text-[#f4f7fb]">
                  <div className="font-semibold">{record.name}</div>
                  <div className="font-mono text-[10.5px] text-[var(--color-text-muted,#8d9aaf)]">{record.id}</div>
                </td>
                <td className="px-3 py-2.5 text-[var(--color-text-muted,#8d9aaf)]">{record.category}</td>
                <td className="px-3 py-2.5 font-mono">
                  <span
                    className={`font-semibold ${
                      record.reliabilityScore >= 0.8
                        ? "text-[#51e6a6]"
                        : record.reliabilityScore >= 0.6
                        ? "text-[#ffbe63]"
                        : "text-[#ff6b7a]"
                    }`}
                  >
                    {Math.round(record.reliabilityScore * 100)}%
                  </span>{" "}
                  <span className="text-[10px] text-[var(--color-text-muted,#8d9aaf)]">
                    ({record.tasksCompleted} tasks)
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      record.status === "ESTABLISHED"
                        ? "bg-[#51e6a6]/15 text-[#51e6a6]"
                        : record.status === "PROBATIONARY"
                        ? "bg-[#ffbe63]/15 text-[#ffbe63]"
                        : "bg-[#ff6b7a]/15 text-[#ff6b7a]"
                    }`}
                  >
                    {record.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-muted,#8d9aaf)]">
                  {record.commitmentHash || "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted,#8d9aaf)]">
                  No matching counterparty records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecordsTable;
