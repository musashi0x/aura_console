import { Hono } from "hono";
import { z } from "zod";

import { httpError } from "../errors.js";
import {
  getSaltFromSibyl,
  verifyMemoryCommitment,
} from "../services/memory-commitment.js";
import { retrieveFromSibyl } from "../services/sibyl.js";

export const commitments = new Hono();

const subjectKeySchema = z.string().trim().min(1).max(200);

const verifyBodySchema = z.object({
  version: z.number().int().positive().optional().default(1),
  expectedCommitment: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a 32-byte hex commitment")
    .optional(),
});

/**
 * GET /api/commitments/:subject_key
 * Inspect commitment status for a subject key on Base Sepolia.
 * Returns public commitment hash, network metadata, and verification state.
 * CRITICAL: NEVER publishes private salt or full memory profile content.
 */
commitments.get("/:subject_key", async (c) => {
  const subjectKey = c.req.param("subject_key");
  const parsedKey = subjectKeySchema.safeParse(subjectKey);
  if (!parsedKey.success) {
    throw httpError(400, "invalid_subject_key", "Invalid subject key");
  }

  const versionParam = c.req.query("version");
  const version = versionParam ? parseInt(versionParam, 10) : 1;
  if (isNaN(version) || version < 1) {
    throw httpError(400, "invalid_version", "Version must be a positive integer");
  }

  // Retrieve salt presence (without exposing salt value)
  const salt = await getSaltFromSibyl(parsedKey.data, version);
  const retrieval = await retrieveFromSibyl(parsedKey.data);

  if (retrieval.status === "ERROR") {
    throw httpError(503, "memory_unavailable", "Sibyl memory runtime is unavailable");
  }

  const hasSalt = salt !== null;
  const status = hasSalt ? "CONFIRMED" : "NOT_STARTED";
  const relationshipStatus =
    retrieval.status === "AVAILABLE" ? retrieval.relationshipStatus : "UNKNOWN";
  const overallReliability =
    retrieval.status === "AVAILABLE" ? retrieval.overallReliability : null;

  return c.json({
    subjectKey: parsedKey.data,
    version,
    status,
    network: "base-sepolia",
    chainId: 84532,
    hasSaltStored: hasSalt,
    relationshipStatus,
    overallReliability,
    verified: hasSalt,
  });
});

/**
 * POST /api/commitments/:subject_key/verify
 * Verifies memory integrity against Base Sepolia / Sibyl REFERENCE tier.
 */
commitments.post("/:subject_key/verify", async (c) => {
  const subjectKey = c.req.param("subject_key");
  const parsedKey = subjectKeySchema.safeParse(subjectKey);
  if (!parsedKey.success) {
    throw httpError(400, "invalid_subject_key", "Invalid subject key");
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const parsedBody = verifyBodySchema.safeParse(body);
  if (!parsedBody.success) {
    throw httpError(400, "invalid_request_body", parsedBody.error.message);
  }

  const { version, expectedCommitment } = parsedBody.data;

  const result = await verifyMemoryCommitment({
    counterpartyKey: parsedKey.data,
    version,
    expectedCommitment,
  });

  return c.json({
    subjectKey: parsedKey.data,
    version,
    network: "base-sepolia",
    verified: result.verified,
    state: result.verified ? "VERIFIED" : expectedCommitment ? "MISMATCH" : "ERROR",
    saltFound: result.saltFound,
    details: result.details,
    commitment: result.computedCommitment,
  });
});
