import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { app } from "../app.js";

async function createRun() {
  const res = await app.request("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ objective: "Adversarial testing run" }),
  });
  const body = (await res.json()) as { run: { id: string } };
  return body.run.id;
}

async function append(runId: string, type: string, data: Record<string, unknown> = {}) {
  await app.request(`/api/runs/${runId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventId: randomUUID(),
      type,
      eventTime: new Date().toISOString(),
      data,
    }),
  });
}

function approve(runId: string, body: unknown = { ceiling_usdc: "25.000000" }) {
  return app.request(`/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function reject(runId: string, body: unknown = { reason: "Operator rejected the requested action" }) {
  return app.request(`/api/runs/${runId}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.sequential("Adversarial Challenge: Approvals Lifecycle", () => {
  // Edge Case 1: Rejection followed by approval attempt (must return 409)
  describe("Edge Case 1: Rejection followed by approval attempt", () => {
    it("returns 409 already_rejected when approving an already rejected request", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", {
        action: "Spend 15 USDC",
        counterparty_key: "agent:alpha",
      });

      const rejectRes = await reject(runId, { reason: "Budget limit exceeded" });
      expect(rejectRes.status).toBe(201);

      const approveRes = await approve(runId, { ceiling_usdc: "15.000000" });
      expect(approveRes.status).toBe(409);
      const body = (await approveRes.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("already_rejected");
    });

    it("returns 409 even after multiple rejection attempts followed by approval", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend 10 USDC" });

      expect((await reject(runId)).status).toBe(201);
      expect((await reject(runId)).status).toBe(409); // second rejection fails

      const approveRes = await approve(runId);
      expect(approveRes.status).toBe(409);
      const body = (await approveRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("already_rejected");
    });
  });

  // Edge Case 2: Approval followed by rejection attempt (must return 409)
  describe("Edge Case 2: Approval followed by rejection attempt", () => {
    it("returns 409 already_approved when rejecting an already approved request", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", {
        action: "Spend 20 USDC",
        counterparty_key: "agent:beta",
      });

      const approveRes = await approve(runId, { ceiling_usdc: "20.000000" });
      expect(approveRes.status).toBe(201);

      const rejectRes = await reject(runId, { reason: "Changed mind" });
      expect(rejectRes.status).toBe(409);
      const body = (await rejectRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("already_approved");
    });

    it("returns 409 even after multiple approval attempts followed by rejection", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend 10 USDC" });

      expect((await approve(runId)).status).toBe(201);
      expect((await approve(runId)).status).toBe(409); // second approval fails

      const rejectRes = await reject(runId);
      expect(rejectRes.status).toBe(409);
      const body = (await rejectRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("already_approved");
    });
  });

  // Edge Case 3: Concurrent approval/rejection attempts
  describe("Edge Case 3: Concurrent approval and rejection attempts", () => {
    it("handles concurrent approve and reject across multiple trials", async () => {
      let bothSucceeded = 0;
      for (let trial = 0; trial < 5; trial++) {
        const runId = await createRun();
        await append(runId, "approval.requested", { action: `Spend 50 USDC trial ${trial}` });

        const [resApprove, resReject] = await Promise.all([
          approve(runId, { ceiling_usdc: "50.000000" }),
          reject(runId, { reason: "Too risky" }),
        ]);

        const statuses = [resApprove.status, resReject.status].sort();
        console.log(`Trial ${trial}: approve=${resApprove.status}, reject=${resReject.status}`);
        if (statuses[0] === 201 && statuses[1] === 201) {
          bothSucceeded++;
          const eventsRes = await app.request(`/api/runs/${runId}/events`);
          const eventsBody = (await eventsRes.json()) as { events: { type: string; sequence: number }[] };
          console.log(`Trial ${trial} events:`, eventsBody.events.map(e => `${e.sequence}:${e.type}`));
        }
      }
      console.log(`Concurrent approve & reject trials with both 201: ${bothSucceeded} / 5`);
      expect(bothSucceeded).toBe(0);
    });

    it("handles concurrent double-approve: exactly one should succeed (201) and one should fail (409)", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend 30 USDC" });

      const [res1, res2] = await Promise.all([
        approve(runId, { ceiling_usdc: "30.000000" }),
        approve(runId, { ceiling_usdc: "35.000000" }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      console.log(`Concurrent double-approve statuses: res1=${res1.status}, res2=${res2.status}`);

      expect(statuses).toEqual([201, 409]);

      const eventsRes = await app.request(`/api/runs/${runId}/events`);
      const eventsBody = (await eventsRes.json()) as { events: { type: string }[] };
      const grants = eventsBody.events.filter((e) => e.type === "approval.granted");
      expect(grants.length).toBe(1);
    });

    it("handles concurrent double-reject: exactly one should succeed (201) and one should fail (409)", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend 40 USDC" });

      const [res1, res2] = await Promise.all([
        reject(runId, { reason: "Rejection A" }),
        reject(runId, { reason: "Rejection B" }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      console.log(`Concurrent double-reject statuses: res1=${res1.status}, res2=${res2.status}`);

      expect(statuses).toEqual([201, 409]);

      const eventsRes = await app.request(`/api/runs/${runId}/events`);
      const eventsBody = (await eventsRes.json()) as { events: { type: string }[] };
      const rejections = eventsBody.events.filter((e) => e.type === "approval.rejected");
      expect(rejections.length).toBe(1);
    });

    it("handles burst of 10 concurrent requests: exactly one 201, nine 409s", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend 100 USDC" });

      const attempts = Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? approve(runId, { ceiling_usdc: `100.00000${i}` })
          : reject(runId, { reason: `Reject ${i}` }),
      );

      const results = await Promise.all(attempts);
      const statusCounts = results.reduce<Record<number, number>>((acc, res) => {
        acc[res.status] = (acc[res.status] ?? 0) + 1;
        return acc;
      }, {});

      console.log("10-request burst status counts:", statusCounts);
      expect(statusCounts[201]).toBe(1);
      expect(statusCounts[409]).toBe(9);
    });
  });

  // Edge Case 4: Requests without pending approval.requested event (must return 409)
  describe("Edge Case 4: Requests without pending approval.requested event", () => {
    it("returns 409 when no events exist in run besides run.created (approve)", async () => {
      const runId = await createRun();
      const res = await approve(runId);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("no_pending_approval");
    });

    it("returns 409 when no events exist in run besides run.created (reject)", async () => {
      const runId = await createRun();
      const res = await reject(runId);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("no_pending_approval");
    });

    it("returns 409 when unrelated events exist (e.g. system.status, chat.message)", async () => {
      const runId = await createRun();
      await append(runId, "system.status", { message: "ready" });
      await append(runId, "chat.message", { role: "user", text: "hello" });

      const approveRes = await approve(runId);
      expect(approveRes.status).toBe(409);
      expect(((await approveRes.json()) as { error: { code: string } }).error.code).toBe("no_pending_approval");

      const rejectRes = await reject(runId);
      expect(rejectRes.status).toBe(409);
      expect(((await rejectRes.json()) as { error: { code: string } }).error.code).toBe("no_pending_approval");
    });

    it("returns 409 when previous request was settled and no new request exists", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Old spend" });
      await approve(runId); // settled

      // Add another unrelated event
      await append(runId, "chat.message", { role: "assistant", text: "processed" });

      // Trying to approve again must be 409
      const approveRes = await approve(runId);
      expect(approveRes.status).toBe(409);
      // It's 409 already_approved
      expect(((await approveRes.json()) as { error: { code: string } }).error.code).toBe("already_approved");

      // Trying to reject must also be 409
      const rejectRes = await reject(runId);
      expect(rejectRes.status).toBe(409);
      expect(((await rejectRes.json()) as { error: { code: string } }).error.code).toBe("already_approved");
    });
  });

  // Edge Case 5: Invalid ceiling strings and injection attempts
  describe("Edge Case 5: Invalid ceiling strings and injection attempts", () => {
    it("rejects non-numeric and malformed ceiling strings with 422", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend check" });

      const invalidCeilings = [
        "",
        "abc",
        "lots",
        "-10",
        "-10.00",
        "+10",
        "+10.00",
        "1e6",
        "0x10",
        "10.",
        ".50",
        " 10.00",
        "10.00 ",
        "10.00 USDC",
        "10.1234567", // 7 decimal places
        "NaN",
        "Infinity",
        "-Infinity",
      ];

      for (const ceiling of invalidCeilings) {
        const res = await approve(runId, { ceiling_usdc: ceiling });
        expect(res.status, `Expected 422 for ceiling "${ceiling}" but got ${res.status}`).toBe(422);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_ceiling");
      }
    });

    it("rejects SQL injection, script injection, and null byte payloads in ceiling with 422", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend check" });

      const injectionPayloads = [
        "10; DROP TABLE runs; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM runs; --",
        "<script>alert('xss')</script>",
        "javascript:alert(1)",
        "10\u0000",
        "10\n20",
        '{"$gt": ""}',
      ];

      for (const payload of injectionPayloads) {
        const res = await approve(runId, { ceiling_usdc: payload });
        expect(res.status, `Expected 422 for payload "${payload}" but got ${res.status}`).toBe(422);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_ceiling");
      }
    });

    it("rejects non-string types for ceiling_usdc with 422", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend check" });

      const nonStrings = [
        10,
        10.5,
        true,
        false,
        null,
        ["10.000000"],
        { amount: "10" },
      ];

      for (const val of nonStrings) {
        const res = await approve(runId, { ceiling_usdc: val });
        expect(res.status).toBe(422);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_ceiling");
      }
    });

    it("rejects invalid JSON body and empty body with 400", async () => {
      const runId = await createRun();
      await append(runId, "approval.requested", { action: "Spend check" });

      const invalidJsonRes = await app.request(`/api/runs/${runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ this is not json",
      });
      expect(invalidJsonRes.status).toBe(400);
      expect(((await invalidJsonRes.json()) as { error: { code: string } }).error.code).toBe("invalid_body");

      const emptyBodyRes = await app.request(`/api/runs/${runId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "",
      });
      expect(emptyBodyRes.status).toBe(400);
      expect(((await emptyBodyRes.json()) as { error: { code: string } }).error.code).toBe("invalid_body");
    });

    it("accepts valid decimal ceiling formats (0 to 6 decimals)", async () => {
      const validCeilings = [
        "0",
        "0.0",
        "0.000000",
        "1",
        "10",
        "10.5",
        "10.50",
        "25.123456",
        "1000000.000000",
      ];

      for (const ceiling of validCeilings) {
        const runId = await createRun();
        await append(runId, "approval.requested", { action: "Spend test" });
        const res = await approve(runId, { ceiling_usdc: ceiling });
        expect(res.status, `Expected 201 for ceiling "${ceiling}" but got ${res.status}`).toBe(201);
      }
    });

    it("safely handles injection payloads and malformed types in reject reason", async () => {
      const runId1 = await createRun();
      await append(runId1, "approval.requested", { action: "Spend check 1" });
      // SQL injection in reason should be safely stored as text without executing
      const sqlInjectionRes = await reject(runId1, { reason: "'; DROP TABLE runs; --" });
      expect(sqlInjectionRes.status).toBe(201);

      // Verify table still exists and event recorded verbatim
      const eventsRes = await app.request(`/api/runs/${runId1}/events`);
      const events = (await eventsRes.json()) as { events: { data: { reason: string } }[] };
      const last = events.events.at(-1);
      expect(last?.data.reason).toBe("'; DROP TABLE runs; --");

      // Non-string reason should return 422
      const runId2 = await createRun();
      await append(runId2, "approval.requested", { action: "Spend check 2" });
      const nonStringRes = await reject(runId2, { reason: 12345 });
      expect(nonStringRes.status).toBe(422);

      // Invalid JSON body in reject returns 400
      const runId3 = await createRun();
      await append(runId3, "approval.requested", { action: "Spend check 3" });
      const invalidJsonRes = await app.request(`/api/runs/${runId3}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ bad json",
      });
      expect(invalidJsonRes.status).toBe(400);
    });
  });
});
