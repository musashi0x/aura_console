"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { apiClient, type LogEntry } from "@/lib/api-client";

export interface MissionTerminalProps {
  runId: string;
  initialLogs?: LogEntry[];
}

export function MissionTerminal({ runId, initialLogs = [] }: MissionTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [streaming, setStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "STDOUT" | "STDERR" | "SYSTEM">("ALL");

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Initial snapshot fetch
  useEffect(() => {
    let cancelled = false;
    async function loadSnapshot() {
      const res = await apiClient.getRunLogs(runId);
      if (!cancelled && res.ok && res.data.entries.length > 0) {
        setLogs(res.data.entries);
      }
    }
    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // 2. Real-time EventSource connection
  useEffect(() => {
    let active = true;
    const url = `/api/runs/${encodeURIComponent(runId)}/logs?stream=true`;
    const es = new EventSource(url);

    es.addEventListener("log", (event) => {
      if (!active) return;
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        setLogs((prev) => {
          if (prev.some((p) => p.id === entry.id)) return prev;
          return [...prev, entry];
        });
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener("done", () => {
      if (!active) return;
      setStreaming(false);
      es.close();
    });

    es.onerror = () => {
      if (!active) return;
      setStreaming(false);
      es.close();
    };

    return () => {
      active = false;
      es.close();
    };
  }, [runId]);

  // 3. Auto-scroll on logs update
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === "ALL") return true;
    if (filter === "STDOUT") return log.stream === "stdout";
    if (filter === "STDERR") return log.stream === "stderr";
    if (filter === "SYSTEM") return log.stream === "system";
    return true;
  });

  return (
    <div
      style={{
        backgroundColor: "#0b0f19",
        color: "#e2e8f0",
        borderRadius: "8px",
        border: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        height: "560px",
        overflow: "hidden",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #1e293b",
          backgroundColor: "#070a12",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <HStack gap={2} align="center">
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: streaming ? "#22c55e" : "#64748b",
              boxShadow: streaming ? "0 0 8px #22c55e" : "none",
            }}
          />
          <Text as="span" size="sm" weight="semibold">
            CLI Worker Sandbox Terminal
          </Text>
          <Token
            label={streaming ? "LIVE" : "ENDED"}
            size="sm"
            color={streaming ? "green" : undefined}
          />
          <Text as="span" size="xsm" color="secondary">
            {logs.length} entries
          </Text>
        </HStack>

        <HStack gap={2} align="center">
          <Button
            label={filter === "ALL" ? "[All]" : "All"}
            size="sm"
            variant={filter === "ALL" ? "primary" : "secondary"}
            onClick={() => setFilter("ALL")}
          />
          <Button
            label={filter === "STDOUT" ? "[Stdout]" : "Stdout"}
            size="sm"
            variant={filter === "STDOUT" ? "primary" : "secondary"}
            onClick={() => setFilter("STDOUT")}
          />
          <Button
            label={filter === "STDERR" ? "[Stderr]" : "Stderr"}
            size="sm"
            variant={filter === "STDERR" ? "primary" : "secondary"}
            onClick={() => setFilter("STDERR")}
          />
          <Button
            label={filter === "SYSTEM" ? "[System]" : "System"}
            size="sm"
            variant={filter === "SYSTEM" ? "primary" : "secondary"}
            onClick={() => setFilter("SYSTEM")}
          />

          <Button
            label={autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF"}
            size="sm"
            variant="secondary"
            onClick={() => setAutoScroll((prev) => !prev)}
          />
          <Button
            label="Clear"
            size="sm"
            variant="secondary"
            onClick={() => setLogs([])}
          />
        </HStack>
      </div>

      {/* Terminal Output Area */}
      <div
        style={{
          flex: 1,
          padding: "12px 16px",
          overflowY: "auto",
          fontSize: "12px",
          lineHeight: "1.6",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: "#64748b", padding: "24px 0", textAlign: "center" }}>
            <p>No terminal output recorded for this mission yet.</p>
            <p style={{ fontSize: "11px", marginTop: "4px" }}>
              Terminal logs stream live when Claude Code or Gemini CLI executes inside the isolated worktree.
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const timeStr = log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString()
              : "";
            return (
              <div
                key={log.id || index}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                  marginBottom: "4px",
                  wordBreak: "break-word",
                }}
              >
                <span style={{ color: "#475569", flexShrink: 0 }}>
                  [{timeStr}]
                </span>
                <span
                  style={{
                    color:
                      log.stream === "system"
                        ? "#38bdf8"
                        : log.stream === "stderr"
                          ? "#f87171"
                          : "#4ade80",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  [{log.stream.toUpperCase()}]
                </span>
                <span
                  style={{
                    whiteSpace: "pre-wrap",
                    color: log.stream === "stderr" ? "#fca5a5" : "#e2e8f0",
                  }}
                >
                  {log.text}
                </span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
