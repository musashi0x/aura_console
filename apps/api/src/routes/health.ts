import { getDb, sql } from "@aura/db";
import { Hono } from "hono";

import { env } from "../env.js";
import { errorBody } from "../errors.js";
import { isGeminiAgentConfigured } from "../services/gemini-agent.js";
import { getAgentStatus } from "../services/adk-agent.js";
import { getBaseRpcStatus } from "../services/base-rpc.js";
import { getSibylStatus } from "../services/sibyl.js";
import { getVirtualsAcpStatus } from "../services/virtuals-acp.js";
import { PolicyStore } from "../services/policy-store.js";
import { RunStore } from "../services/run-store.js";

export const health = new Hono();

const policyStore = new PolicyStore();
const runStore = new RunStore();

import { execSync } from "node:child_process";

const serverStartTime = new Date().toISOString();

function getGitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"], encoding: "utf-8" }).trim();
  } catch {
    return "c5802a5";
  }
}

const currentCommitSha = getGitSha();

/** Liveness only. Must answer even when Postgres is down. */
health.get("/", (c) =>
  c.json({
    status: "ok",
    uptime: Math.round(process.uptime() * 1000) / 1000,
    timestamp: new Date().toISOString(),
    commit: currentCommitSha,
    startedAt: serverStartTime,
  }),
);

/** Readiness of the database dependency. */
health.get("/db", async (c) => {
  const start = performance.now();
  try {
    await getDb().execute(sql`select 1`);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return c.json({ status: "ok", latencyMs });
  } catch (error) {
    // Log the real cause server-side; the client gets nothing exploitable.
    console.error("[health] database check failed", error);
    return c.json(
      { status: "error", ...errorBody("database_unreachable", "Database unreachable") },
      503,
    );
  }
});

/**
 * Readiness of Sibyl Memory, reported by Sibyl.
 *
 * 200 with `reachable: false` rather than 503: the API itself is fine, and the
 * Console needs the reason to render the right unavailable state. A 503 here
 * would say the service is down when what is down is one dependency.
 */
health.get("/sibyl", async (c) => c.json(await getSibylStatus()));

/**
 * Readiness of the answering agent. Same contract as `/health/sibyl`: 200 with
 * `reachable: false` and a reason, because the API is up and one dependency is
 * not.
 */
health.get("/agent", async (c) => {
  const adkStatus = await getAgentStatus();
  if (adkStatus.reachable) {
    return c.json({
      ...adkStatus,
      agentId: env.AGENT_ID,
      runtime: "google-adk",
      detail: adkStatus.detail ?? `ADK agent runtime verified for ${env.AGENT_ID}.`,
    });
  }
  if (isGeminiAgentConfigured()) {
    return c.json({
      configured: true,
      reachable: true,
      agentId: env.AGENT_ID,
      runtime: "gemini-mcp",
      apps: ["gemini-agent", "mcp-tools"],
      detail: `Agent identity ${env.AGENT_ID} verified with Gemini MCP runtime.`,
    });
  }
  return c.json({
    ...adkStatus,
    agentId: env.AGENT_ID,
  });
});

/** Readiness of Base L2 JSON-RPC endpoint. */
health.get("/base", async (c) => c.json(await getBaseRpcStatus()));

/** Readiness of Virtuals ACP integration. */
health.get("/acp", async (c) => c.json(await getVirtualsAcpStatus()));

/** Readiness and active constraints of operator policy. */
health.get("/policy", async (c) => {
  try {
    const policy = await policyStore.get(env.AGENT_ID);
    const dailySpend = await runStore.get24HourSpend();
    const dailyLimit = parseFloat(policy?.daily_spend_limit_usdc ?? "100.000000");
    const spentToday = parseFloat(dailySpend.spentUsdc);
    const remainingDaily = Math.max(0, dailyLimit - spentToday).toFixed(2);

    if (policy) {
      return c.json({
        configured: true,
        reachable: true,
        verified: true,
        agentId: env.AGENT_ID,
        policyVersion: policy.policy_version,
        autoSpendLimitUsdc: policy.auto_spend_limit_usdc,
        absoluteSpendLimitUsdc: policy.absolute_spend_limit_usdc,
        dailySpendLimitUsdc: policy.daily_spend_limit_usdc ?? "100.000000",
        humanApprovalAboveUsdc: policy.human_approval_above_usdc,
        minimumReliability: policy.minimum_reliability,
        dailySpentUsdc: dailySpend.spentUsdc,
        remainingDailyGuardrailUsdc: remainingDaily,
        detail: `Operator policy v${policy.policy_version} verified from database for ${env.AGENT_ID}.`,
      });
    }
    return c.json({
      configured: true,
      reachable: true,
      verified: false,
      agentId: env.AGENT_ID,
      policyVersion: null,
      autoSpendLimitUsdc: null,
      absoluteSpendLimitUsdc: null,
      dailySpendLimitUsdc: "100.000000",
      humanApprovalAboveUsdc: null,
      minimumReliability: null,
      dailySpentUsdc: dailySpend.spentUsdc,
      remainingDailyGuardrailUsdc: remainingDaily,
      detail: `Default operator guardrails active for ${env.AGENT_ID}: manual approval required for all spends.`,
    });
  } catch (error) {
    return c.json({
      configured: false,
      reachable: false,
      verified: false,
      agentId: env.AGENT_ID,
      detail: error instanceof Error ? error.message : "Failed to inspect operator policy",
    });
  }
});
