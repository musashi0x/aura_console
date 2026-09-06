import { describe, expect, it } from "vitest";

import type { RunStatus, TimelineEntry } from "../model/types";
import type { CanonicalStage } from "../model/types";
import {
  MISSION_STEP_ORDER,
  buildMissionProgress,
  missionStepFor,
} from "./mission-rail";

const entry = (
  sequence: number,
  stage: CanonicalStage | null,
): TimelineEntry => ({
  eventId: `evt_${sequence}`,
  sequence,
  type: "x.y",
  eventTime: `2026-09-01T09:00:${String(sequence).padStart(2, "0")}Z`,
  stage,
  support: "SUPPORTED",
  summary: `event ${sequence}`,
  data: undefined,
});

const progress = (stages: (CanonicalStage | null)[], status: RunStatus = "RUNNING") =>
  buildMissionProgress(
    stages.map((stage, index) => entry(index, stage)),
    status,
  );

describe("mission progress", () => {
  it("maps all ten canonical stages onto the six the operator reads", () => {
    const stages: CanonicalStage[] = [
      "DISCOVER", "MEMORY", "SCORE", "POLICY", "DECIDE",
      "FUND", "DELIVER", "EVALUATE", "LEARN", "COMMIT",
    ];
    // Total in one direction: a rail step can never appear that no canonical
    // stage justifies, and no stage falls through the mapping.
    const covered = new Set(stages.map(missionStepFor));
    expect([...covered].sort()).toEqual([...MISSION_STEP_ORDER].sort());
  });

  it("groups the three decision stages into one step", () => {
    const { nodes } = progress(["SCORE", "POLICY", "DECIDE"]);
    const decide = nodes.find((n) => n.step === "DECIDE")!;
    expect(decide.entries).toHaveLength(3);
    expect(decide.reached).toBe(true);
  });

  it("leaves a step the Run has not reached queued and unreached", () => {
    const { nodes } = progress(["DISCOVER"]);
    const verify = nodes.find((n) => n.step === "VERIFY")!;
    expect(verify.reached).toBe(false);
    expect(verify.column).toBe("QUEUED");
    // No moment to report, because nothing has happened there.
    expect(verify.firstTime).toBeNull();
  });

  it("puts the step a Run is working on in Running", () => {
    const { nodes, current } = progress(["DISCOVER", "MEMORY"]);
    expect(current).toBe("REMEMBER");
    expect(nodes.find((n) => n.step === "REMEMBER")!.column).toBe("RUNNING");
    expect(nodes.find((n) => n.step === "UNDERSTAND")!.column).toBe("DONE");
  });

  it("says Needs you only when the Run itself is halted for a person", () => {
    const waiting = progress(["DISCOVER", "MEMORY"], "WAITING_APPROVAL");
    expect(waiting.nodes.find((n) => n.step === "REMEMBER")!.column).toBe("NEEDS_YOU");
    const blocked = progress(["DISCOVER", "MEMORY"], "BLOCKED");
    expect(blocked.nodes.find((n) => n.step === "REMEMBER")!.column).toBe("NEEDS_YOU");
    // Working is not waiting. Inferring an approval from a pause would put a
    // demand on the operator that no event made.
    const running = progress(["DISCOVER", "MEMORY"], "RUNNING");
    expect(running.nodes.find((n) => n.step === "REMEMBER")!.column).toBe("RUNNING");
  });

  it("leaves a settled Run on no step at all", () => {
    for (const status of ["COMPLETED", "FAILED", "CANCELLED"] as const) {
      const { nodes, current } = progress(["DISCOVER", "MEMORY"], status);
      expect(current).toBeNull();
      // Including FAILED and CANCELLED: they are as finished as COMPLETED, and
      // a failed Mission still showing a Running step would read as in flight.
      expect(nodes.find((n) => n.step === "REMEMBER")!.column).toBe("DONE");
    }
  });

  it("keeps lifecycle events out of the steps without dropping the Run", () => {
    // run.created and friends belong to no stage. They must not invent a step,
    // and they must not stop the stages around them from being classified.
    const { nodes } = progress([null, "DISCOVER", null]);
    expect(nodes.find((n) => n.step === "UNDERSTAND")!.entries).toHaveLength(1);
    expect(nodes.filter((n) => n.reached)).toHaveLength(1);
  });

  it("carries an anchor to the first event of each reached step", () => {
    const { nodes } = progress(["DISCOVER", "DISCOVER"]);
    expect(nodes.find((n) => n.step === "UNDERSTAND")!.firstEventId).toBe("evt_0");
  });
});
