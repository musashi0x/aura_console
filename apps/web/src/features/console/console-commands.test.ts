import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMMAND_DESTINATIONS,
  CONSOLE_COMMANDS,
  matchCommand,
} from "./console-commands";
import {
  __resetMemoryView,
  getMemoryViewEnabled,
  setMemoryViewEnabled,
} from "./memory-view-state";

beforeEach(() => {
  __resetMemoryView();
});

describe("the console command registry", () => {
  it("reaches only declared destinations, and never the network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const visited: string[] = [];
    for (const command of CONSOLE_COMMANDS) command.run((href) => visited.push(href));
    for (const href of visited) expect(COMMAND_DESTINATIONS).toContain(href);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("covers every console surface the operator can be on", () => {
    for (const href of ["/runs", "/runs/new", "/system", "/policies", "/counterparties"]) {
      const visited: string[] = [];
      for (const command of CONSOLE_COMMANDS) command.run((h) => visited.push(h));
      expect(visited).toContain(href);
    }
  });
});

describe("matching what an operator typed", () => {
  it("runs a command the operator clearly asked for", () => {
    expect(matchCommand("go to policies")?.id).toBe("policies");
    expect(matchCommand("Counterparties")?.id).toBe("counterparties");
    expect(matchCommand("start a run")?.id).toBe("new");
  });

  it("tolerates trailing punctuation and case", () => {
    expect(matchCommand("  System Health.  ")?.id).toBe("system");
  });

  it("does not fire on a question that merely mentions the word", () => {
    // Substring matching anywhere would navigate away from the answer the
    // operator is asking for.
    expect(matchCommand("what do the policies say about refunds?")).toBeNull();
    expect(matchCommand("why did this run pick provider b?")).toBeNull();
    expect(matchCommand("show me the counterparties with the worst record")).toBeNull();
  });

  it("treats an empty message as nothing at all", () => {
    expect(matchCommand("   ")).toBeNull();
  });
});

describe("asking for a specific memory state", () => {
  it("turns memory off when it is on", () => {
    expect(matchCommand("memory off")?.id).toBe("memory");
  });

  it("does not toggle memory back on when the operator asks for off twice", () => {
    setMemoryViewEnabled(false);
    // A blind toggle here would answer "turn memory off" by turning it ON.
    expect(matchCommand("memory off")).toBeNull();
    expect(matchCommand("memory on")?.id).toBe("memory");
  });

  it("reports the state that exists after it ran, not the one requested", () => {
    const memory = CONSOLE_COMMANDS.find((c) => c.id === "memory")!;
    memory.run(() => {});
    expect(getMemoryViewEnabled()).toBe(false);
    expect(memory.done()).toMatch(/off/i);
  });
});
