export interface LogEntry {
  id: string;
  runId: string;
  stream: "stdout" | "stderr" | "system";
  text: string;
  timestamp: string;
}

export type LogListener = (entry: LogEntry) => void;

/**
 * Service managing real-time streaming and buffered capture of execution logs
 * for AI CLI sandboxes and verification runs.
 */
export class MissionLogService {
  private static instance: MissionLogService;
  private logs = new Map<string, LogEntry[]>();
  private listeners = new Map<string, Set<LogListener>>();
  private maxEntriesPerRun = 1500;

  static getInstance(): MissionLogService {
    if (!MissionLogService.instance) {
      MissionLogService.instance = new MissionLogService();
    }
    return MissionLogService.instance;
  }

  append(runId: string, stream: "stdout" | "stderr" | "system", text: string): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      runId,
      stream,
      text,
      timestamp: new Date().toISOString(),
    };

    let runLogs = this.logs.get(runId);
    if (!runLogs) {
      runLogs = [];
      this.logs.set(runId, runLogs);
    }
    runLogs.push(entry);
    if (runLogs.length > this.maxEntriesPerRun) {
      runLogs.shift();
    }

    const runListeners = this.listeners.get(runId);
    if (runListeners) {
      for (const listener of runListeners) {
        try {
          listener(entry);
        } catch {
          // ignore listener errors
        }
      }
    }

    return entry;
  }

  getLogs(runId: string): LogEntry[] {
    return this.logs.get(runId) ?? [];
  }

  subscribe(runId: string, listener: LogListener): () => void {
    let runListeners = this.listeners.get(runId);
    if (!runListeners) {
      runListeners = new Set();
      this.listeners.set(runId, runListeners);
    }
    runListeners.add(listener);

    return () => {
      runListeners?.delete(listener);
      if (runListeners?.size === 0) {
        this.listeners.delete(runId);
      }
    };
  }

  clear(runId: string): void {
    this.logs.delete(runId);
    this.listeners.delete(runId);
  }
}

export const missionLogs = MissionLogService.getInstance();
