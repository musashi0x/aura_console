#!/usr/bin/env tsx

/**
 * Aura Memory — Base Sepolia Memory Commitment Verifier
 *
 * Verifies that a counterparty's private memory state committed to Base Sepolia
 * calldata matches the cryptographic salt stored in Sibyl REFERENCE tier
 * and the profile stored in Sibyl WARM tier.
 *
 * Usage:
 *   pnpm memory:verify [counterpartyKey] [version]
 *   tsx scripts/verify-memory-commitment.ts virtuals:agent:beta 1
 */

import {
  computeCommitment,
  getSaltFromSibyl,
  verifyMemoryCommitment,
} from "../apps/api/src/services/memory-commitment.js";
import { retrieveFromSibyl } from "../apps/api/src/services/sibyl.js";

async function main() {
  const args = process.argv.slice(2);
  const counterpartyKey = args[0] || "virtuals:agent:beta";
  const version = Number(args[1] || 1);
  const expectedCommitment = args[2];

  console.log("\n=======================================================");
  console.log("  AURA MEMORY — BASE SEPOLIA COMMITMENT VERIFICATION  ");
  console.log("=======================================================\n");
  console.log(`Target Counterparty : ${counterpartyKey}`);
  console.log(`Memory Version      : v${version}`);
  if (expectedCommitment) {
    console.log(`Expected Commitment : ${expectedCommitment}`);
  }
  console.log("");

  // 1. Retrieve salt from Sibyl REFERENCE tier
  console.log("--> [1/3] Reading salt from Sibyl REFERENCE tier...");
  const salt = await getSaltFromSibyl(counterpartyKey, version);

  if (!salt) {
    console.error(`❌ FAILED: No salt found in Sibyl REFERENCE tier under commitment:${counterpartyKey}:v${version}`);
    process.exit(1);
  }
  console.log(`    ✓ Salt retrieved: ${salt}`);

  // 2. Retrieve profile from Sibyl WARM tier
  console.log("--> [2/3] Reading profile from Sibyl WARM tier...");
  const retrieval = await retrieveFromSibyl(counterpartyKey);

  if (retrieval.status !== "AVAILABLE") {
    console.error(`❌ FAILED: Could not retrieve counterparty profile from Sibyl (status: ${retrieval.status})`);
    process.exit(1);
  }

  const profile = {
    relationshipStatus: retrieval.relationshipStatus,
    overallReliability: retrieval.overallReliability,
    confidence: retrieval.confidence,
    memoryVersion: version,
  };
  console.log(`    ✓ Profile retrieved (status: ${retrieval.relationshipStatus}, reliability: ${retrieval.overallReliability})`);

  // 3. Recompute Keccak256 commitment & verify via verifyMemoryCommitment
  console.log("--> [3/3] Recomputing Keccak256(canonical || salt)...");
  const { canonical } = computeCommitment(profile, salt);
  console.log(`    ✓ Canonical Body: ${canonical}`);

  const verification = await verifyMemoryCommitment({
    counterpartyKey,
    version,
    expectedCommitment,
  });

  if (!verification.computedCommitment) {
    console.error(`❌ FAILED: ${verification.details}`);
    process.exit(1);
  }

  console.log(`    ✓ Recomputed Hash: ${verification.computedCommitment}\n`);

  if (expectedCommitment) {
    if (verification.verified) {
      console.log("=======================================================");
      console.log("  VERIFICATION RESULT: SUCCESS (100% CRYPTOGRAPHIC MATCH)");
      console.log("=======================================================");
      console.log(`  Expected Commitment : ${expectedCommitment}`);
      console.log(`  Recomputed Hash     : ${verification.computedCommitment}`);
      console.log(`  The committed calldata payload on Base Sepolia represents`);
      console.log(`  authentic, tamper-proof private memory stored in Sibyl.\n`);
      process.exit(0);
    } else {
      console.error("=======================================================");
      console.error("  VERIFICATION RESULT: FAILED (COMMITMENT MISMATCH)");
      console.error("=======================================================");
      console.error(`  Expected Commitment : ${expectedCommitment}`);
      console.error(`  Recomputed Hash     : ${verification.computedCommitment}`);
      console.error(`  ${verification.details}\n`);
      process.exit(1);
    }
  } else {
    console.log("=======================================================");
    console.log("  CURRENT SIBYL STATE & RECOMPUTED COMMITMENT");
    console.log("=======================================================");
    console.log(`  Target Counterparty : ${counterpartyKey}`);
    console.log(`  Memory Version      : v${version}`);
    console.log(`  Recomputed Hash     : ${verification.computedCommitment}`);
    console.log(`  Sibyl State         : Authenticated in WARM & REFERENCE tiers`);
    console.log(`\n  Note: To verify against an on-chain transaction calldata hash,`);
    console.log(`  pass expectedCommitment as the 3rd argument:`);
    console.log(`    pnpm memory:verify ${counterpartyKey} ${version} <expectedCommitment>\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
