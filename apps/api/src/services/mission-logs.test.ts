import { describe, expect, it } from "vitest";

import { MissionLogService } from "./mission-logs.js";

describe("MissionLogService", () => {
  it("appends and retrieves logs for a mission", () => {
    const service = new MissionLogService();
    const runId = "test-run-123";

    service.append(runId, "system", "Starting mission sandbox...");
    service.append(runId, "stdout", "Running claude -p 'test'...");
    service.append(runId, "stderr", "Warning: deprecated flag");

    const logs = service.getLogs(runId);
    expect(logs).toHaveLength(3);
    expect(logs[0]?.stream).toBe("system");
    expect(logs[0]?.text).toContain("Starting mission sandbox");
    expect(logs[1]?.stream).toBe("stdout");
    expect(logs[2]?.stream).toBe("stderr");
  });

  it("streams new logs to active subscribers", () => {
    const service = new MissionLogService();
    const runId = "test-stream-456";

    const received: string[] = [];
    const unsubscribe = service.subscribe(runId, (entry) => {
      received.push(`[${entry.stream}] ${entry.text}`);
    });

    service.append(runId, "system", "First log");
    service.append(runId, "stdout", "Second log");

    expect(received).toHaveLength(2);
    expect(received[0]).toBe("[system] First log");
    expect(received[1]).toBe("[stdout] Second log");

    unsubscribe();
    service.append(runId, "stdout", "Third log after unsubscribe");
    expect(received).toHaveLength(2);
  });

  it("isolates logs between different runs", () => {
    const service = new MissionLogService();
    service.append("run-A", "stdout", "Log A");
    service.append("run-B", "stdout", "Log B");

    expect(service.getLogs("run-A")).toHaveLength(1);
    expect(service.getLogs("run-A")[0]?.text).toBe("Log A");
    expect(service.getLogs("run-B")).toHaveLength(1);
    expect(service.getLogs("run-B")[0]?.text).toBe("Log B");
  });
});
