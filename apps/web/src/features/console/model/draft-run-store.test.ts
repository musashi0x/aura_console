import { describe, expect, it, vi } from "vitest";
import {
  MISSION_TEMPLATES,
  getDraftMission,
  setDraftMission,
  subscribeDraftMission,
} from "./draft-run-store";

describe("draft-run-store", () => {
  it("provides predefined mission templates", () => {
    expect(MISSION_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const first = MISSION_TEMPLATES[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("objective");
    expect(first).toHaveProperty("budgetUsdc");
  });

  it("notifies subscribers when draft mission updates", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDraftMission(listener);

    setDraftMission("New custom objective", "50.000000");

    expect(listener).toHaveBeenCalled();
    const draft = getDraftMission();
    expect(draft.objective).toBe("New custom objective");
    expect(draft.budget).toBe("50.000000");

    unsubscribe();
    listener.mockClear();
    setDraftMission("Another objective", "10.000000");
    expect(listener).not.toHaveBeenCalled();
  });
});
