import { getDb, schema, sql } from "@aura/db";

/**
 * Seeds the Alpha and Beta counterparty fixture into Postgres if the table is empty.
 * Ensures the relational database and Sibyl memory store are coherent.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  try {
    const db = getDb();
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.counterparties);

    if (countRow && countRow.count > 0) {
      return;
    }

    console.log("[db] seeding initial counterparties fixture (Alpha Research & Beta Labs)...");

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

    console.log("[db] initial counterparties fixture seeded successfully.");
  } catch (err) {
    console.warn("[db] could not seed initial counterparties:", err);
  }
}
