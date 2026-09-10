import { eq, getDb, schema, sql } from "@aura/db";

import { env } from "../env.js";
import { getNativeSibylStatus, resetNativeSibylStorage } from "./native-sibyl.js";

/**
 * Seeds the 8 counterparty fixtures into Postgres if missing.
 * Ensures the relational database and Sibyl memory store are coherent.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  try {
    const db = getDb();
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.counterparties);

    if (!countRow || countRow.count < 8) {
      console.log("[db] seeding initial counterparties fixture (8 multi-protocol agents)...");

    // Insert Alpha Research
    await db
      .insert(schema.counterparties)
      .values({
        counterpartyKey: "virtuals:agent:alpha",
        protocol: "virtuals",
        agentId: "alpha",
        address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        displayName: "Alpha Research",
        acpLifecycleState: "ACTIVE",
        relationshipStatus: "WATCH",
        latestMemoryVersion: 1,
        classifiedAggregates: {
          completed_jobs: 2,
          acceptance_rate: 0.5,
          avg_delivery_hours: 48,
        },
        offerings: [
          {
            offering_id: "market_research_v1",
            name: "Cryptoeconomic Market Analysis",
            base_price_usdc: "9.00",
          },
        ],
        publicTrust: { verified: true, endorsements: 12 },
      })
      .onConflictDoNothing();

    await db
      .insert(schema.counterpartySalts)
      .values({
        counterpartyKey: "virtuals:agent:alpha",
        salt: "salt_alpha_fixture_seed_001",
      })
      .onConflictDoNothing();

    await db
      .insert(schema.counterpartyProfiles)
      .values({
        counterpartyKey: "virtuals:agent:alpha",
        ownerAgentId: "agent_buyer_1",
        memoryVersion: 1,
        overallReliability: 0.42,
        taskFit: 0.71,
        confidence: 0.88,
        body: {
          risk_note:
            "One acceptance failure inside the last 30 days applies a risk penalty.",
        },
      })
      .onConflictDoNothing();

    await db
      .insert(schema.counterpartyEpisodes)
      .values([
        {
          counterpartyKey: "virtuals:agent:alpha",
          ownerAgentId: "agent_buyer_1",
          taskType: "market-research",
          outcome: "REJECTED",
          amountUsdc: "9.000000",
          occurredAt: new Date("2026-08-14T09:12:00.000Z"),
          body: {
            note: "Delivered 41 hours late and the deliverable failed acceptance.",
          },
        },
        {
          counterpartyKey: "virtuals:agent:alpha",
          ownerAgentId: "agent_buyer_1",
          taskType: "market-research",
          outcome: "DELIVERED",
          amountUsdc: "9.000000",
          occurredAt: new Date("2026-07-30T15:40:00.000Z"),
          body: { note: "Delivered on time at the quoted price." },
        },
      ])
      .onConflictDoNothing();

    // Insert Beta Labs
    await db
      .insert(schema.counterparties)
      .values({
        counterpartyKey: "virtuals:agent:beta",
        protocol: "virtuals",
        agentId: "beta",
        address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        displayName: "Beta Labs",
        acpLifecycleState: "ACTIVE",
        relationshipStatus: "PREFERRED",
        latestMemoryVersion: 1,
        classifiedAggregates: {
          completed_jobs: 4,
          acceptance_rate: 1.0,
          avg_delivery_hours: 18,
        },
        offerings: [
          {
            offering_id: "market_research_v2",
            name: "Deep Market & Competitor Intelligence",
            base_price_usdc: "12.00",
          },
        ],
        publicTrust: { verified: true, endorsements: 48 },
      })
      .onConflictDoNothing();

    await db
      .insert(schema.counterpartySalts)
      .values({
        counterpartyKey: "virtuals:agent:beta",
        salt: "salt_beta_fixture_seed_002",
      })
      .onConflictDoNothing();

    await db
      .insert(schema.counterpartyProfiles)
      .values({
        counterpartyKey: "virtuals:agent:beta",
        ownerAgentId: "agent_buyer_1",
        memoryVersion: 1,
        overallReliability: 0.91,
        taskFit: 0.83,
        confidence: 0.90,
        body: {
          risk_note: "No acceptance failures on record.",
        },
      })
      .onConflictDoNothing();

    await db
      .insert(schema.counterpartyEpisodes)
      .values([
        {
          counterpartyKey: "virtuals:agent:beta",
          ownerAgentId: "agent_buyer_1",
          taskType: "market-research",
          outcome: "DELIVERED",
          amountUsdc: "12.000000",
          occurredAt: new Date("2026-08-22T11:05:00.000Z"),
          body: {
            note: "Delivered early; deliverable accepted without revision.",
          },
        },
        {
          counterpartyKey: "virtuals:agent:beta",
          ownerAgentId: "agent_buyer_1",
          taskType: "market-research",
          outcome: "DELIVERED",
          amountUsdc: "12.000000",
          occurredAt: new Date("2026-08-29T08:31:00.000Z"),
          body: { note: "Delivered on time at the quoted price." },
        },
      ])
      .onConflictDoNothing();

      // Insert Gamma SecOps (Base)
      await db
        .insert(schema.counterparties)
        .values({
          counterpartyKey: "base:agent:gamma",
          protocol: "base",
          agentId: "gamma",
          address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          displayName: "Gamma SecOps",
          acpLifecycleState: "ACTIVE",
          relationshipStatus: "PREFERRED",
          latestMemoryVersion: 1,
          classifiedAggregates: { completed_jobs: 5, acceptance_rate: 1.0, avg_delivery_hours: 12 },
          offerings: [{ offering_id: "secops_audit_v1", name: "Smart Contract Security Audit", base_price_usdc: "25.00" }],
          publicTrust: { verified: true, endorsements: 64 },
        })
        .onConflictDoNothing();

      // Insert Delta Scraper (Base)
      await db
        .insert(schema.counterparties)
        .values({
          counterpartyKey: "base:agent:delta",
          protocol: "base",
          agentId: "delta",
          address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
          displayName: "Delta Scraper",
          acpLifecycleState: "ACTIVE",
          relationshipStatus: "WATCH",
          latestMemoryVersion: 1,
          classifiedAggregates: { completed_jobs: 3, acceptance_rate: 0.67, avg_delivery_hours: 6 },
          offerings: [{ offering_id: "web_scraping_v1", name: "High-Volume Data Extraction", base_price_usdc: "4.50" }],
          publicTrust: { verified: true, endorsements: 18 },
        })
        .onConflictDoNothing();

      // Insert Epsilon Quant (Virtuals)
      await db
        .insert(schema.counterparties)
        .values({
          counterpartyKey: "virtuals:agent:epsilon",
          protocol: "virtuals",
          agentId: "epsilon",
          address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
          displayName: "Epsilon Quant",
          acpLifecycleState: "ACTIVE",
          relationshipStatus: "PREFERRED",
          latestMemoryVersion: 1,
          classifiedAggregates: { completed_jobs: 8, acceptance_rate: 1.0, avg_delivery_hours: 24 },
          offerings: [{ offering_id: "quant_modeling_v1", name: "Quantitative Risk Modeling", base_price_usdc: "45.00" }],
          publicTrust: { verified: true, endorsements: 92 },
        })
        .onConflictDoNothing();

      // Insert Zeta Rogue (Base - BLOCKED)
      await db
        .insert(schema.counterparties)
        .values({
          counterpartyKey: "base:agent:zeta",
          protocol: "base",
          agentId: "zeta",
          address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
          displayName: "Zeta Rogue",
          acpLifecycleState: "SUSPENDED",
          relationshipStatus: "BLOCKED",
          latestMemoryVersion: 1,
          classifiedAggregates: { completed_jobs: 4, acceptance_rate: 0.25, avg_delivery_hours: 72 },
          offerings: [{ offering_id: "budget_data_v1", name: "Budget Data Entry", base_price_usdc: "2.50" }],
          publicTrust: { verified: false, endorsements: 1 },
        })
        .onConflictDoNothing();

      // Insert Eta Translation (ERC-8004)
      await db
        .insert(schema.counterparties)
        .values({
          counterpartyKey: "erc8004:agent:eta",
          protocol: "erc8004",
          agentId: "eta",
          address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
          displayName: "Eta Translation",
          acpLifecycleState: "ACTIVE",
          relationshipStatus: "NEW",
          latestMemoryVersion: 1,
          classifiedAggregates: { completed_jobs: 0, acceptance_rate: 0.0, avg_delivery_hours: 0 },
          offerings: [{ offering_id: "translation_v1", name: "Multi-Language Technical Translation", base_price_usdc: "8.00" }],
          publicTrust: { verified: true, endorsements: 5 },
        })
        .onConflictDoNothing();

      // Insert Theta Oracle (Base)
      await db
        .insert(schema.counterparties)
        .values({
          counterpartyKey: "base:agent:theta",
          protocol: "base",
          agentId: "theta",
          address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
          displayName: "Theta Oracle",
          acpLifecycleState: "ACTIVE",
          relationshipStatus: "PREFERRED",
          latestMemoryVersion: 1,
          classifiedAggregates: { completed_jobs: 6, acceptance_rate: 1.0, avg_delivery_hours: 1 },
          offerings: [{ offering_id: "oracle_feed_v1", name: "Signed Oracle Feed Attestations", base_price_usdc: "15.00" }],
          publicTrust: { verified: true, endorsements: 76 },
        })
        .onConflictDoNothing();

      console.log("[db] 8 multi-protocol counterparties fixture seeded successfully.");
    }

    // Seed default operator policy for target agent if not present
    const targetAgentId = env.AGENT_ID || "agent_buyer_1";
    const [policyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agentPolicies)
      .where(eq(schema.agentPolicies.agentId, targetAgentId));

    if (!policyCount || policyCount.count === 0) {
      await db
        .insert(schema.agentPolicies)
        .values({
          agentId: targetAgentId,
          policyVersion: 1,
          autoSpendLimitUsdc: "10.000000",
          absoluteSpendLimitUsdc: "50.000000",
          dailySpendLimitUsdc: "100.000000",
          humanApprovalAboveUsdc: "10.000000",
          minimumReliability: 80,
          preferredProviderPremiumLimit: "1.2500",
          blockAfterRecentFailures: 2,
          preferPreviousSuccess: true,
          requireVerifiedCommitment: false,
          memoryErrorOverrideAllowed: false,
        })
        .onConflictDoNothing();
      console.log(`[db] initial operator policy seeded for ${targetAgentId}.`);
    }

    // Seed demo run 3c2dc36a-dc44-4abd-9fe0-8386e55cd677 if not present
    const demoRunId = "3c2dc36a-dc44-4abd-9fe0-8386e55cd677";
    const [existingRun] = await db
      .select({ id: schema.runs.id })
      .from(schema.runs)
      .where(eq(schema.runs.id, demoRunId));

    if (!existingRun) {
      console.log(`[db] seeding demo run ${demoRunId}...`);
      await db
        .insert(schema.runs)
        .values({
          id: demoRunId,
          objective:
            "Execute an autonomous surprise discovery mission: analyze current network readiness, inspect active guardrails, evaluate preferred counterparties in Sibyl memory, and initiate a delightful autonomous operation.",
          source: "CONSOLE",
          environment: "base-sepolia",
          budgetUsdc: "25.000000",
          createdAt: new Date("2026-09-09T07:00:08.437Z"),
          updatedAt: new Date("2026-09-09T07:00:08.437Z"),
        })
        .onConflictDoNothing();

      await db
        .insert(schema.runEvents)
        .values([
          {
            eventId: "3e54c675-2a54-4ccc-a9e7-76eeedd5e796",
            runId: demoRunId,
            sequence: 0,
            type: "run.created",
            eventTime: new Date("2026-09-09T07:00:08.437Z"),
            data: {
              source: "CONSOLE",
              objective:
                "Execute an autonomous surprise discovery mission: analyze current network readiness, inspect active guardrails, evaluate preferred counterparties in Sibyl memory, and initiate a delightful autonomous operation.",
              budget_usdc: "25.000000",
              environment: "base-sepolia",
            },
          },
          {
            eventId: "9c319338-2bf2-4c09-9354-6e3aa7999181",
            runId: demoRunId,
            sequence: 1,
            type: "memory.retrieved",
            eventTime: new Date("2026-09-09T07:00:18.132Z"),
            data: {
              count: 6,
              source: "SIBYL",
              summary: "Recalled 6 counterparties from Sibyl relationship memory",
              verdict_code: "ok",
              retrieval_status: "AVAILABLE",
            },
          },
          {
            eventId: "69bb840f-2ee2-40ae-8940-ab613d99f604",
            runId: demoRunId,
            sequence: 2,
            type: "candidate.scored",
            eventTime: new Date("2026-09-09T07:00:18.140Z"),
            data: {
              summary: "Ranked 2 counterparties on price and relationship memory",
              excluded: [
                {
                  key: "test:failing:agent",
                  reason: "No observed price on record, so there was nothing to compare on.",
                },
                {
                  key: "virtuals:agent:blocked_test",
                  reason: "No observed price on record, so there was nothing to compare on.",
                },
                {
                  key: "agent:beta",
                  reason: "No observed price on record, so there was nothing to compare on.",
                },
                {
                  key: "blocked_candidate",
                  reason: "No observed price on record, so there was nothing to compare on.",
                },
              ],
              candidates: [
                {
                  key: "virtuals:agent:beta",
                  score: 96,
                  memory_note: "No previous interactions on record.",
                  memory_adjustment: 1,
                },
                {
                  key: "virtuals:agent:alpha",
                  score: 89,
                  memory_note:
                    "One acceptance failure inside the last 30 days applies a risk penalty.",
                  memory_adjustment: -11,
                },
              ],
            },
          },
          {
            eventId: "91c3e7bb-d356-429a-891d-c2bc7d73d023",
            runId: demoRunId,
            sequence: 3,
            type: "decision.made",
            eventTime: new Date("2026-09-09T07:00:18.145Z"),
            data: {
              reasons: [
                "Relationship status on record is KNOWN.",
                "Observed price is 9.50 USDC.",
                "No previous interactions on record.",
                "This record is seeded demonstration data, not a relationship this operator has had.",
              ],
              summary: "Selected the highest-ranked counterparty",
              counterparty_key: "virtuals:agent:beta",
              authorization_mode: "OPERATOR_APPROVAL",
            },
          },
          {
            eventId: "b4b8b78c-49ab-4a96-b21d-9091ddfd8694",
            runId: demoRunId,
            sequence: 4,
            type: "approval.requested",
            eventTime: new Date("2026-09-09T07:00:18.149Z"),
            data: {
              action: "Fund the job at 9.50 USDC",
              summary: "Funding this counterparty needs an operator decision",
              amount_usdc: "9.50",
              ceiling_usdc: "25.000000",
              counterparty_key: "virtuals:agent:beta",
              authorization_mode: "OPERATOR_APPROVAL",
            },
          },
        ])
        .onConflictDoNothing();
      console.log(`[db] demo run ${demoRunId} seeded successfully.`);
    }

    // Initialize native durable SQLite store and seed fixtures if empty
    try {
      if (process.env.AURA_NATIVE_AUTO_SEED !== "false" && process.env.SIBYL_SEED_FIXTURES !== "false") {
        const status = getNativeSibylStatus();
        if (status.entityCount === 0) {
          console.log("[db] initializing native durable SQLite store with fixtures...");
          resetNativeSibylStorage({ seedFixtures: true });
        }
      }
    } catch (err) {
      console.warn("[db] could not initialize native durable SQLite store:", err);
    }
  } catch (err) {
    console.warn("[db] could not seed initial defaults:", err);
  }
}
