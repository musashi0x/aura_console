#!/usr/bin/env tsx

/**
 * Aura Memory — Milestone 4: Two-Session Cold-Start Demonstration
 *
 * Demonstrates persistent cross-process memory across decoupled OS processes:
 * - Session 1 (Process A): Alpha wins auction on price efficiency (9.00 vs 12.00 USDC).
 *   Alpha creates a defective deliverable lacking mandatory source citations.
 *   Authentic verifier agent rejects the deliverable.
 *   Bayesian reputation updates Alpha from NEW -> WATCH with consecutiveFailures=1.
 *   Rejection episode and Bayesian state are committed to SQLite on disk.
 *   Process A terminates cleanly (exit code 0). Zero shared RAM with Process B.
 *
 * - Session 2 (Process B - Cold Start): Fresh OS process cold-boots with empty V8 heap.
 *   Reads SQLite database from disk via SIBYL_NATIVE_DB_PATH / getNativeStoragePath().
 *   Recalls Alpha's WATCH status, failure episode, and Bayesian degradation.
 *   Scores candidates under identical prompt & quotes.
 *   History-aware reputation penalizes Alpha; Provider Beta wins the mission!
 *   Renders side-by-side terminal comparison card and Inspectable Evidence Card.
 *   Process B terminates cleanly (exit code 0).
 */

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  closeNativeSibylDatabase,
  getNativeStoragePath,
  listNativeCounterpartiesFromSibyl,
  readNativeMemoryJournal,
  recordEpisodeToNativeSibyl,
  resetNativeSibylStorage,
  retrieveNativeFromSibyl,
  updateNativeCounterpartyInSibyl,
} from "../apps/api/src/services/native-sibyl.js";
import { scoreCandidates } from "../apps/api/src/services/mission-scoring.js";
import {
  createInitialReputation,
  updateReputation,
} from "../apps/api/src/services/reputation-fsm.js";
import { verifyCompetitorReportDeliverable } from "../apps/api/src/services/verifier-agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const tsxCli = path.join(repoRoot, "apps", "api", "node_modules", "tsx", "dist", "cli.mjs");

// ---------------------------------------------------------------------------
// Terminal Formatting & Comparison Renderer
// ---------------------------------------------------------------------------

export interface BorderChars {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
  tj: string;
  bj: string;
  lj: string;
  rj: string;
  c: string;
}

export interface ColorPalette {
  reset: string;
  bold: string;
  dim: string;
  red: string;
  green: string;
  yellow: string;
  cyan: string;
  magenta: string;
  gray: string;
  bgRed: string;
  bgGreen: string;
  bgYellow: string;
}

export interface Column1Data {
  title?: string;
  alphaName?: string;
  alphaPrice?: string;
  alphaScore?: number;
  betaName?: string;
  betaPrice?: string;
  betaScore?: number;
  winnerDescription?: string;
  marginDescription?: string;
  warningHeader?: string;
  warningLines?: string[];
}

export interface Column2Data {
  title?: string;
  betaName?: string;
  betaPrice?: string;
  betaBaseScore?: number;
  betaAdj?: number;
  betaFinalScore?: number;
  alphaName?: string;
  alphaPrice?: string;
  alphaBaseScore?: number;
  alphaPenalty?: number;
  alphaFinalScore?: number;
  winnerDescription?: string;
  marginDescription?: string;
  safeguardHeader?: string;
  safeguardLines?: string[];
}

export interface SideBySideOptions {
  colWidth?: number;
  useAsciiBorders?: boolean;
  col1?: Column1Data;
  col2?: Column2Data;
}

export interface BayesianParamDelta {
  alpha: { before: number | string; after: number | string; delta: string };
  beta: { before: number | string; after: number | string; delta: string };
  reliability: { before: string; after: string; delta: string };
  status: { before: string; after: string; delta: string };
  consecutiveFailures: { before: number | string; after: number | string; delta: string };
}

export interface EvidenceCardOptions {
  width?: number;
  useAsciiBorders?: boolean;
  counterpartyKey?: string;
  displayName?: string;
  outcome?: "rejected" | "accepted" | string;
  outcomeDetail?: string;
  failureReason?: string;
  runId?: string;
  timestamp?: string;
  bayesianDelta?: BayesianParamDelta;
}

export function isColorSupported(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") return false;
  if (process.env.NODE_DISABLE_COLORS === "1") return false;
  if (process.env.TERM === "dumb") return false;
  return true;
}

export function getColors(enabled: boolean = isColorSupported()): ColorPalette {
  if (!enabled) {
    return {
      reset: "",
      bold: "",
      dim: "",
      red: "",
      green: "",
      yellow: "",
      cyan: "",
      magenta: "",
      gray: "",
      bgRed: "",
      bgGreen: "",
      bgYellow: "",
    };
  }
  return {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    gray: "\x1b[90m",
    bgRed: "\x1b[41m\x1b[97m\x1b[1m",
    bgGreen: "\x1b[42m\x1b[30m\x1b[1m",
    bgYellow: "\x1b[43m\x1b[30m\x1b[1m",
  };
}

export function getBorders(useAscii: boolean = process.env.USE_ASCII_BORDERS === "1" || process.env.TERM === "dumb"): BorderChars {
  if (useAscii) {
    return {
      tl: "+",
      tr: "+",
      bl: "+",
      br: "+",
      h: "-",
      v: "|",
      tj: "+",
      bj: "+",
      lj: "+",
      rj: "+",
      c: "+",
    };
  }
  return {
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘",
    h: "─",
    v: "│",
    tj: "┬",
    bj: "┴",
    lj: "├",
    rj: "┤",
    c: "┼",
  };
}

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

export function visibleLen(str: string): number {
  return stripAnsi(str).length;
}

export function padEnd(str: string, targetLen: number): string {
  const diff = targetLen - visibleLen(str);
  return diff > 0 ? str + " ".repeat(diff) : str;
}

export function center(str: string, targetLen: number): string {
  const len = visibleLen(str);
  if (len >= targetLen) return str;
  const left = Math.floor((targetLen - len) / 2);
  const right = targetLen - len - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (visibleLen(current + " " + w) <= maxWidth) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function renderSideBySideComparison(options: SideBySideOptions = {}): string {
  const useAscii = options.useAsciiBorders ?? (process.env.USE_ASCII_BORDERS === "1" || process.env.TERM === "dumb");
  const b = getBorders(useAscii);
  const c = getColors();
  const colW = options.colWidth ?? 38; // 38 * 2 + 3 = 79 chars total width (fits 80 col term)

  const c1: Required<Column1Data> = {
    title: options.col1?.title ?? "PRICE-ONLY / AMNESIA BASELINE",
    alphaName: options.col1?.alphaName ?? "Provider Alpha",
    alphaPrice: options.col1?.alphaPrice ?? "10.00 USDC",
    alphaScore: options.col1?.alphaScore ?? 100,
    betaName: options.col1?.betaName ?? "Provider Beta",
    betaPrice: options.col1?.betaPrice ?? "10.00 USDC",
    betaScore: options.col1?.betaScore ?? 100,
    winnerDescription: options.col1?.winnerDescription ?? "Provider Alpha (10.00 USDC)",
    marginDescription: options.col1?.marginDescription ?? "100 vs 100 (Tie)",
    warningHeader: options.col1?.warningHeader ?? "REPUTATION BLIND ⚠",
    warningLines: options.col1?.warningLines ?? [
      "REPUTATION BLIND: Defective",
      "deliverable accepted, repeat",
      "treasury loss!",
    ],
  };

  const c2: Required<Column2Data> = {
    title: options.col2?.title ?? "HISTORY-AWARE DECISION",
    betaName: options.col2?.betaName ?? "Provider Beta",
    betaPrice: options.col2?.betaPrice ?? "10.00 USDC",
    betaBaseScore: options.col2?.betaBaseScore ?? 100,
    betaAdj: options.col2?.betaAdj ?? 0,
    betaFinalScore: options.col2?.betaFinalScore ?? 100,
    alphaName: options.col2?.alphaName ?? "Provider Alpha",
    alphaPrice: options.col2?.alphaPrice ?? "10.00 USDC",
    alphaBaseScore: options.col2?.alphaBaseScore ?? 100,
    alphaPenalty: options.col2?.alphaPenalty ?? -2,
    alphaFinalScore: options.col2?.alphaFinalScore ?? 98,
    winnerDescription: options.col2?.winnerDescription ?? "Provider Beta (10.00 USDC)",
    marginDescription: options.col2?.marginDescription ?? "100 vs 98",
    safeguardHeader: options.col2?.safeguardHeader ?? "MEMORY PROTECTED ✔",
    safeguardLines: options.col2?.safeguardLines ?? [
      "MEMORY PROTECTED: Prior failure",
      "recalled, treasury safeguarded!",
    ],
  };

  const lines: string[] = [];

  // Top border
  lines.push(b.tl + b.h.repeat(colW) + b.tj + b.h.repeat(colW) + b.tr);

  // Column Headers
  lines.push(
    b.v + center(`${c.bold}${c.red}${c1.title}${c.reset}`, colW) +
    b.v + center(`${c.bold}${c.green}${c2.title}${c.reset}`, colW) + b.v
  );
  lines.push(b.lj + b.h.repeat(colW) + b.c + b.h.repeat(colW) + b.rj);

  // Candidate 1 Rows
  lines.push(
    b.v + padEnd(` ${c.bold}${c1.alphaName}${c.reset}: ${c1.alphaPrice}`, colW) +
    b.v + padEnd(` ${c.bold}${c2.betaName}${c.reset} : ${c2.betaPrice}`, colW) + b.v
  );
  lines.push(
    b.v + padEnd(`   Base Score : ${c.bold}${c1.alphaScore}${c.reset} (Cheapest)`, colW) +
    b.v + padEnd(`   Base: ${c2.betaBaseScore} | Mem: ${c2.betaAdj >= 0 ? "+" + c2.betaAdj : c2.betaAdj} -> Final: ${c.bold}${c.green}${c2.betaFinalScore}${c.reset}`, colW) + b.v
  );

  // Candidate 2 Rows
  lines.push(
    b.v + padEnd(` ${c1.betaName} : ${c1.betaPrice}`, colW) +
    b.v + padEnd(` ${c2.alphaName}: ${c2.alphaPrice}`, colW) + b.v
  );
  lines.push(
    b.v + padEnd(`   Base Score : ${c1.betaScore}`, colW) +
    b.v + padEnd(`   Base: ${c2.alphaBaseScore} | Pen: ${c.red}${c2.alphaPenalty}${c.reset} -> Final: ${c.bold}${c.red}${c2.alphaFinalScore}${c.reset}`, colW) + b.v
  );

  lines.push(b.lj + b.h.repeat(colW) + b.c + b.h.repeat(colW) + b.rj);

  // Outcome / Winner Rows
  lines.push(
    b.v + padEnd(` ${c.bold}Outcome Winner${c.reset}:`, colW) +
    b.v + padEnd(` ${c.bold}Outcome Winner${c.reset}:`, colW) + b.v
  );
  lines.push(
    b.v + padEnd(`   ${c.red}${c.bold}▶ ${c1.winnerDescription}${c.reset}`, colW) +
    b.v + padEnd(`   ${c.green}${c.bold}▶ ${c2.winnerDescription}${c.reset}`, colW) + b.v
  );
  lines.push(
    b.v + padEnd(`   Margin: ${c.bold}${c1.marginDescription}${c.reset}`, colW) +
    b.v + padEnd(`   Margin: ${c.bold}${c.green}${c2.marginDescription}${c.reset}`, colW) + b.v
  );

  lines.push(b.lj + b.h.repeat(colW) + b.c + b.h.repeat(colW) + b.rj);

  // Status Impact Banners
  lines.push(
    b.v + center(`${c.bgRed} ${c1.warningHeader} ${c.reset}`, colW) +
    b.v + center(`${c.bgGreen} ${c2.safeguardHeader} ${c.reset}`, colW) + b.v
  );

  const warnLines = c1.warningLines;
  const safeLines = c2.safeguardLines;
  const maxLines = Math.max(warnLines.length, safeLines.length);

  for (let i = 0; i < maxLines; i++) {
    const wText = warnLines[i] ? `${c.red}${warnLines[i]}${c.reset}` : "";
    const sText = safeLines[i] ? `${c.green}${safeLines[i]}${c.reset}` : "";
    lines.push(b.v + center(wText, colW) + b.v + center(sText, colW) + b.v);
  }

  lines.push(b.bl + b.h.repeat(colW) + b.bj + b.h.repeat(colW) + b.br);
  return lines.join("\n");
}

export function renderInspectableEvidenceCard(options: EvidenceCardOptions = {}): string {
  const useAscii = options.useAsciiBorders ?? (process.env.USE_ASCII_BORDERS === "1" || process.env.TERM === "dumb");
  const b = getBorders(useAscii);
  const c = getColors();
  const W = options.width ?? 78; // 80 cols terminal total width

  const counterpartyKey = options.counterpartyKey ?? "virtuals:agent:alpha";
  const displayName = options.displayName ?? "Alpha Research";
  const outcome = options.outcome ?? "rejected";
  const outcomeDetail = options.outcomeDetail ?? "(Recorded by Objective Verifier Agent)";
  const failureReason = options.failureReason ?? "Deliverable rejected: missing mandatory cited sources for competitor entries";
  const runId = options.runId ?? "8a7c2e1f-4b0d-4c31-9a72-e568d40f12bc";
  const timestamp = options.timestamp ?? new Date().toISOString();

  const delta: BayesianParamDelta = options.bayesianDelta ?? {
    alpha: { before: "1.00", after: "1.00", delta: "+0.00 (no pass)" },
    beta: { before: "1.00", after: "2.00", delta: "+1.00 (+1 fail)" },
    reliability: { before: "0.50 (50.0%)", after: "0.33 (33.3%)", delta: "-0.17 (-16.7%)" },
    status: { before: "NEW", after: "WATCH", delta: "DEMOTED (Risk)" },
    consecutiveFailures: { before: 0, after: 1, delta: "+1 (Probation)" },
  };

  const lines: string[] = [];

  // Card Outer Border
  lines.push(b.tl + b.h.repeat(W) + b.tr);
  lines.push(b.v + center(`${c.bold}${c.cyan}INSPECTABLE RELATIONSHIP EVIDENCE CARD${c.reset}`, W) + b.v);
  lines.push(b.lj + b.h.repeat(W) + b.rj);

  // Metadata entries
  lines.push(b.v + padEnd(`  ${c.bold}Counterparty Key${c.reset} : ${counterpartyKey} (${displayName})`, W) + b.v);

  const outcomeTag = outcome.toLowerCase() === "rejected"
    ? `${c.bold}${c.red}[REJECTED]${c.reset}`
    : `${c.bold}${c.green}[ACCEPTED]${c.reset}`;
  lines.push(b.v + padEnd(`  ${c.bold}Last Episode${c.reset}     : ${outcomeTag} ${outcomeDetail}`, W) + b.v);

  // Failure Reason Wrapping
  const reasonPrefix = `  ${c.bold}Failure Reason${c.reset}   : `;
  const prefixLen = visibleLen(reasonPrefix);
  const maxReasonWidth = W - prefixLen - 2;
  const wrappedReason = wrapText(`"${failureReason}"`, maxReasonWidth);

  for (let i = 0; i < wrappedReason.length; i++) {
    if (i === 0) {
      lines.push(b.v + padEnd(reasonPrefix + `${c.yellow}${wrappedReason[i]}${c.reset}`, W) + b.v);
    } else {
      lines.push(b.v + padEnd(" ".repeat(prefixLen) + `${c.yellow}${wrappedReason[i]}${c.reset}`, W) + b.v);
    }
  }

  lines.push(b.v + padEnd(`  ${c.bold}Prior Run UUID${c.reset}   : ${c.gray}${runId}${c.reset}`, W) + b.v);
  lines.push(b.v + padEnd(`  ${c.bold}Timestamp${c.reset}        : ${timestamp}`, W) + b.v);

  // Bayesian Subtable Section
  lines.push(b.lj + b.h.repeat(W) + b.rj);
  lines.push(b.v + center(`${c.bold}BAYESIAN REPUTATION PARAMETER DELTA (SESSION 1 ➔ SESSION 2)${c.reset}`, W) + b.v);

  // Subtable columns layout: 22 + 1 + 17 + 1 + 17 + 1 + 19 = 78 chars
  const c1 = 22;
  const c2 = 17;
  const c3 = 17;
  const c4 = 19;

  lines.push(b.lj + b.h.repeat(c1) + b.tj + b.h.repeat(c2) + b.tj + b.h.repeat(c3) + b.tj + b.h.repeat(c4) + b.rj);
  lines.push(
    b.v + padEnd(` ${c.bold}Parameter${c.reset}`, c1) +
    b.v + padEnd(` ${c.bold}Before (S1)${c.reset}`, c2) +
    b.v + padEnd(` ${c.bold}After (S1/S2)${c.reset}`, c3) +
    b.v + padEnd(` ${c.bold}Delta / Shift${c.reset}`, c4) + b.v
  );
  lines.push(b.lj + b.h.repeat(c1) + b.c + b.h.repeat(c2) + b.c + b.h.repeat(c3) + b.c + b.h.repeat(c4) + b.rj);

  // Parameter Rows
  lines.push(
    b.v + padEnd(` Prior Weight (α)`, c1) +
    b.v + padEnd(` ${delta.alpha.before}`, c2) +
    b.v + padEnd(` ${delta.alpha.after}`, c3) +
    b.v + padEnd(` ${delta.alpha.delta}`, c4) + b.v
  );
  lines.push(
    b.v + padEnd(` Failure Weight (β)`, c1) +
    b.v + padEnd(` ${delta.beta.before}`, c2) +
    b.v + padEnd(` ${c.bold}${c.red}${delta.beta.after}${c.reset}`, c3) +
    b.v + padEnd(` ${c.bold}${c.red}${delta.beta.delta}${c.reset}`, c4) + b.v
  );
  lines.push(
    b.v + padEnd(` Expected Reliability`, c1) +
    b.v + padEnd(` ${delta.reliability.before}`, c2) +
    b.v + padEnd(` ${c.bold}${c.red}${delta.reliability.after}${c.reset}`, c3) +
    b.v + padEnd(` ${c.bold}${c.red}${delta.reliability.delta}${c.reset}`, c4) + b.v
  );
  lines.push(
    b.v + padEnd(` Relationship Status`, c1) +
    b.v + padEnd(` ${delta.status.before}`, c2) +
    b.v + padEnd(` ${c.bold}${c.yellow}${delta.status.after}${c.reset}`, c3) +
    b.v + padEnd(` ${c.bold}${c.yellow}${delta.status.delta}${c.reset}`, c4) + b.v
  );
  lines.push(
    b.v + padEnd(` Consecutive Failures`, c1) +
    b.v + padEnd(` ${delta.consecutiveFailures.before}`, c2) +
    b.v + padEnd(` ${c.bold}${c.red}${delta.consecutiveFailures.after}${c.reset}`, c3) +
    b.v + padEnd(` ${c.bold}${c.red}${delta.consecutiveFailures.delta}${c.reset}`, c4) + b.v
  );

  lines.push(b.bl + b.h.repeat(c1) + b.bj + b.h.repeat(c2) + b.bj + b.h.repeat(c3) + b.bj + b.h.repeat(c4) + b.br);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Database Baseline Initialization for Session 1
// ---------------------------------------------------------------------------

export function seedSessionABaseline(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      key TEXT PRIMARY KEY,
      id TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entities_category ON entities (category);
  `);

  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
    VALUES (?, ?, 'counterparty', ?, 'active', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      body = excluded.body,
      updated_at = excluded.updated_at
  `);

  // Provider Alpha: 9.00 USDC, clean unobserved baseline
  const alphaBody = {
    source: "demo",
    display_name: "Alpha Research",
    relationship_status: "NEW",
    overall_reliability: 0.5,
    confidence: 0.0,
    observed_price_usdc: "9.00",
    alpha: 1.0,
    beta: 1.0,
    consecutive_failures: 0,
    total_missions: 0,
    episodes: [],
  };
  upsert.run(
    "counterparty:virtuals:agent:alpha",
    randomUUID(),
    "virtuals:agent:alpha",
    JSON.stringify(alphaBody),
    now,
    now,
  );

  // Provider Beta: 12.00 USDC, clean unobserved baseline
  const betaBody = {
    source: "demo",
    display_name: "Beta Labs",
    relationship_status: "NEW",
    overall_reliability: 0.5,
    confidence: 0.0,
    observed_price_usdc: "12.00",
    alpha: 1.0,
    beta: 1.0,
    consecutive_failures: 0,
    total_missions: 0,
    episodes: [],
  };
  upsert.run(
    "counterparty:virtuals:agent:beta",
    randomUUID(),
    "virtuals:agent:beta",
    JSON.stringify(betaBody),
    now,
    now,
  );
}

// ---------------------------------------------------------------------------
// CLI Argument Parser
// ---------------------------------------------------------------------------

export interface ColdStartCliArgs {
  mode: "master" | "session-a" | "session-b";
  dbPath: string;
  useTempDb: boolean;
  useAscii: boolean;
  noColor: boolean;
}

export function parseCliArgs(argv: string[]): ColdStartCliArgs {
  let mode: "master" | "session-a" | "session-b" = "master";
  let explicitDbPath = "";
  let useTempDb = false;
  let useAscii = process.env.USE_ASCII_BORDERS === "1";
  let noColor = !isColorSupported();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--session-a" || arg === "-a") {
      mode = "session-a";
    } else if (arg === "--session-b" || arg === "-b") {
      mode = "session-b";
    } else if (arg === "--db" && i + 1 < argv.length) {
      explicitDbPath = argv[++i];
    } else if (arg === "--temp-db") {
      useTempDb = true;
    } else if (arg === "--ascii") {
      useAscii = true;
    } else if (arg === "--no-color") {
      noColor = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: tsx scripts/demo-cold-start.ts [options]

Options:
  --session-a, -a    Execute Session 1 directly (Process A)
  --session-b, -b    Execute Session 2 directly (Process B)
  --db <path>        Path to SQLite database file
  --temp-db          Use an ephemeral temporary database
  --ascii            Use ASCII borders (+ - |) instead of Unicode
  --no-color         Disable ANSI color output
  --help, -h         Display this help message

Default behavior (no flags): Spawns Session A then Session B sequentially
across separate OS child processes with decoupled lifetimes and zero shared RAM.
`);
      process.exit(0);
    }
  }

  let dbPath: string;
  if (explicitDbPath) {
    dbPath = path.resolve(explicitDbPath);
  } else if (useTempDb) {
    dbPath = path.join(os.tmpdir(), `aura-coldstart-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  } else {
    const envPath =
      process.env.SIBYL_NATIVE_DB_PATH ||
      process.env.SIBYL_STORAGE_PATH ||
      process.env.AURA_NATIVE_STORAGE_PATH;
    dbPath = envPath && envPath.trim().length > 0 ? path.resolve(envPath.trim()) : getNativeStoragePath();
  }

  return { mode, dbPath, useTempDb, useAscii, noColor };
}

// ---------------------------------------------------------------------------
// Execution: Session 1 (Process A)
// ---------------------------------------------------------------------------

export async function runSessionA(dbPath: string): Promise<number> {
  // Ensure DB path env is active before any native-sibyl operations are called
  process.env.SIBYL_NATIVE_DB_PATH = dbPath;
  process.env.SIBYL_STORAGE_PATH = dbPath;
  process.env.AURA_NATIVE_STORAGE_PATH = dbPath;
  process.env.AURA_NATIVE_AUTO_SEED = "false";
  process.env.SIBYL_SEED_FIXTURES = "false";

  const colors = getColors();
  console.log(`\n========================================================================`);
  console.log(`  [Process A] SESSION 1: UNOBSERVED AUCTION & DEFECTIVE DELIVERABLE`);
  console.log(`  PID: ${process.pid} | Fresh V8 Heap: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Database: ${dbPath}`);
  console.log(`========================================================================\n`);

  // Ensure DB directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // 1. Seed unobserved baseline in SQLite
  closeNativeSibylDatabase();
  const rawDb = new DatabaseSync(dbPath);
  try {
    seedSessionABaseline(rawDb);
  } finally {
    rawDb.close();
  }

  // 2. Setup prompt and candidate evaluation
  const prompt = "Find a provider for a competitor report. Budget: 15 USDC.";
  console.log(`Prompt : "${prompt}"`);
  console.log(`Quotes : Provider Alpha = 9.00 USDC | Provider Beta = 12.00 USDC\n`);

  const counterpartyList = listNativeCounterpartiesFromSibyl().items;
  const candidates = counterpartyList.filter(
    (c) => c.counterpartyKey === "virtuals:agent:alpha" || c.counterpartyKey === "virtuals:agent:beta",
  );

  const { ranked, excluded } = scoreCandidates(candidates);
  if (excluded.length > 0) {
    console.error(`[Process A] Unexpected candidate exclusion:`, excluded);
    return 1;
  }

  const alphaScored = ranked.find((r) => r.key === "virtuals:agent:alpha");
  const betaScored = ranked.find((r) => r.key === "virtuals:agent:beta");

  console.log(`Candidate Scores (Unobserved Priors, Confidence = 0.0):`);
  console.log(`  - virtuals:agent:alpha (Provider Alpha) : Score ${alphaScored?.score} (Base: 100, Mem: 0)`);
  console.log(`  - virtuals:agent:beta  (Provider Beta)  : Score ${betaScored?.score} (Base: 75, Mem: 0)\n`);

  const winner = ranked[0];
  if (winner.key !== "virtuals:agent:alpha") {
    console.error(`[Process A] Failure: Expected Provider Alpha to win on price, but got ${winner.key}`);
    return 1;
  }
  console.log(`✓ Provider Alpha (virtuals:agent:alpha) selected on price efficiency (score: 100 vs 75).\n`);

  // 3. Create isolated sandbox worktree and defective competitor report
  const tempWorktree = fs.mkdtempSync(path.join(os.tmpdir(), "aura-mission-s1-"));
  const runId = "8a7c2e1f-4b0d-4c31-9a72-e568d40f12bc";

  try {
    console.log(`[Process A] Creating temporary sandbox worktree: ${tempWorktree}`);
    const defectiveReport = {
      competitors: [
        { name: "Acme Analytics", website: "https://acme-analytics.io", sources: [] },
        { name: "Zenith Research", website: "https://zenith-research.com", sources: [] },
        { name: "Nova Insights", website: "https://novainsights.tech", sources: [] },
      ],
      taskGoal: "Find a provider for a competitor report. Budget: 15 USDC.",
      summary: "Competitor research deliverable missing mandatory source citations.",
    };

    fs.writeFileSync(
      path.join(tempWorktree, "deliverable.json"),
      JSON.stringify(defectiveReport, null, 2),
    );
    console.log(`[Process A] Defective deliverable written with empty sources citations (sources: []).\n`);

    // 4. Authentic Objective Verification
    console.log(`[Process A] Executing authentic verifier: verifyCompetitorReportDeliverable()...`);
    const evalResult = await verifyCompetitorReportDeliverable(tempWorktree);

    if (evalResult.tests_passed || evalResult.score > 0) {
      console.error(`[Process A] Failure: Deliverable was expected to fail validation, but passed!`);
      return 1;
    }

    console.log(`❌ Deliverable failed verification: rejected due to missing mandatory sources citations.`);
    console.log(`   Verification Summary: ${evalResult.summary}`);
    console.log(`   Failure Reason     : ${evalResult.failure_reason}\n`);

    // 5. Update Bayesian Reputation
    const initialRep = createInitialReputation("virtuals:agent:alpha");
    const updatedRep = updateReputation(initialRep, "failure");

    console.log(`[Process A] Updating Bayesian Reputation for virtuals:agent:alpha:`);
    console.log(`  - Status              : NEW -> ${colors.yellow}${updatedRep.status}${colors.reset}`);
    console.log(`  - Consecutive Failures: 0 -> ${colors.red}${updatedRep.consecutiveFailures}${colors.reset}`);
    console.log(`  - Alpha / Beta (α, β) : 1.0, 1.0 -> ${updatedRep.alpha.toFixed(2)}, ${updatedRep.beta.toFixed(2)}`);
    console.log(`  - Expected Reliability: 0.50 -> ${colors.red}${updatedRep.overallReliability.toFixed(4)}${colors.reset}`);
    console.log(`  - Confidence          : 0.00 -> ${updatedRep.confidence.toFixed(4)}\n`);

    // 6. Commit to disk SQLite
    updateNativeCounterpartyInSibyl("virtuals:agent:alpha", {
      relationshipStatus: updatedRep.status,
      overallReliability: updatedRep.overallReliability,
      confidence: updatedRep.confidence,
      alpha: updatedRep.alpha,
      beta: updatedRep.beta,
      consecutiveFailures: updatedRep.consecutiveFailures,
      totalMissions: updatedRep.totalMissions,
      riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
    });

    recordEpisodeToNativeSibyl("virtuals:agent:alpha", {
      run: runId,
      taskType: "competitor-report",
      outcome: "rejected",
      note: evalResult.failure_reason,
      occurredAt: new Date().toISOString(),
    });

    console.log(`✓ Rejection episode and degraded Bayesian state committed to SQLite disk store.`);
  } finally {
    fs.rmSync(tempWorktree, { recursive: true, force: true });
    closeNativeSibylDatabase();
  }

  console.log(`✓ Process A exiting cleanly with exit code 0. OS releasing all V8 heap memory.\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// Execution: Session 2 (Process B - Cold Start)
// ---------------------------------------------------------------------------

export async function runSessionB(dbPath: string, args: ColdStartCliArgs): Promise<number> {
  // Ensure DB path env is active before any native-sibyl operations are called
  process.env.SIBYL_NATIVE_DB_PATH = dbPath;
  process.env.SIBYL_STORAGE_PATH = dbPath;
  process.env.AURA_NATIVE_STORAGE_PATH = dbPath;
  process.env.AURA_NATIVE_AUTO_SEED = "false";
  process.env.SIBYL_SEED_FIXTURES = "false";

  const colors = getColors();
  console.log(`\n========================================================================`);
  console.log(`  [Process B] SESSION 2: COLD START & MEMORY-GUIDED SELECTION`);
  console.log(`  PID: ${process.pid} | Fresh V8 Heap: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Database: ${dbPath}`);
  console.log(`========================================================================\n`);

  // 1. Cold recall: read disk store
  console.log(`[Process B] Cold launch: inspecting SQLite disk store for counterparty memory...`);
  const alphaRetrieval = retrieveNativeFromSibyl("virtuals:agent:alpha");

  if (alphaRetrieval.status !== "AVAILABLE") {
    console.error(`[Process B] Failure: Expected Alpha in AVAILABLE status from disk, got: ${alphaRetrieval.status}`);
    return 1;
  }
  if (alphaRetrieval.relationshipStatus !== "WATCH") {
    console.error(`[Process B] Failure: Expected Alpha in WATCH status, got: ${alphaRetrieval.relationshipStatus}`);
    return 1;
  }
  if (alphaRetrieval.consecutiveFailures !== 1) {
    console.error(`[Process B] Failure: Expected consecutiveFailures=1, got: ${alphaRetrieval.consecutiveFailures}`);
    return 1;
  }

  const journal = readNativeMemoryJournal(5, "virtuals:agent:alpha");
  const episodes = (Array.isArray(journal?.episodes) && journal.episodes.length > 0
    ? journal.episodes
    : (alphaRetrieval.episodes ?? [])) as Array<{
    run?: string;
    task_type?: string;
    taskType?: string;
    outcome?: string;
    note?: string;
    occurred_at?: string;
    occurredAt?: string;
  }>;
  const rejectedEpisode = episodes.find((ep) => ep.outcome === "rejected");
  if (!rejectedEpisode) {
    console.error(`[Process B] Failure: Expected rejection episode for Alpha in journal, found none!`);
    return 1;
  }

  console.log(`✓ Recalled failure episode from disk:`);
  console.log(`  - Run UUID : ${rejectedEpisode.run}`);
  console.log(`  - Status   : ${alphaRetrieval.relationshipStatus} (consecutive failure: ${alphaRetrieval.consecutiveFailures})`);
  console.log(`  - Note     : "${rejectedEpisode.note}"\n`);

  // 2. Candidate Evaluation under Price Parity (PROJECT.md Feature 8 & Milestone 3)
  const prompt = "Find a provider for a competitor report. Budget: 15 USDC.";
  const parityPrice = "10.00";
  console.log(`Prompt : "${prompt}"`);
  console.log(`Quotes : Provider Alpha = ${parityPrice} USDC | Provider Beta = ${parityPrice} USDC (Price Parity RFQ)\n`);

  const counterpartyList = listNativeCounterpartiesFromSibyl().items;
  const candidates = counterpartyList
    .filter(
      (c) => c.counterpartyKey === "virtuals:agent:alpha" || c.counterpartyKey === "virtuals:agent:beta",
    )
    .map((c) => ({
      ...c,
      observedPriceUsdc: parityPrice,
    }));

  // Genuine dynamic candidate scoring via mission-scoring.ts
  const { ranked, excluded } = scoreCandidates(candidates);
  if (excluded.length > 0) {
    console.error(`[Process B] Unexpected candidate exclusion:`, excluded);
    return 1;
  }

  const betaScored = ranked.find((r) => r.key === "virtuals:agent:beta");
  const alphaScored = ranked.find((r) => r.key === "virtuals:agent:alpha");

  if (!betaScored || !alphaScored) {
    console.error(`[Process B] Missing scored candidate for Alpha or Beta.`);
    return 1;
  }

  // Dynamic derivation of base and memory adjustments
  const betaBaseScore = betaScored.score - betaScored.memory_adjustment;
  const alphaBaseScore = alphaScored.score - alphaScored.memory_adjustment;

  // 3. Render Side-by-Side Comparison from Real Dynamic Scores
  const sideBySide = renderSideBySideComparison({
    useAsciiBorders: args.useAscii,
    col1: {
      title: "PRICE-ONLY / AMNESIA BASELINE",
      alphaName: "Provider Alpha",
      alphaPrice: `${parityPrice} USDC`,
      alphaScore: alphaBaseScore,
      betaName: "Provider Beta",
      betaPrice: `${parityPrice} USDC`,
      betaScore: betaBaseScore,
      winnerDescription: `Provider Alpha (${parityPrice} USDC)`,
      marginDescription: `${alphaBaseScore} vs ${betaBaseScore} (Tie)`,
      warningHeader: "REPUTATION BLIND ⚠",
      warningLines: [
        "REPUTATION BLIND: Defective",
        "deliverable accepted, repeat",
        "treasury loss!",
      ],
    },
    col2: {
      title: "HISTORY-AWARE DECISION",
      betaName: "Provider Beta",
      betaPrice: `${parityPrice} USDC`,
      betaBaseScore: betaBaseScore,
      betaAdj: betaScored.memory_adjustment,
      betaFinalScore: betaScored.score,
      alphaName: "Provider Alpha",
      alphaPrice: `${parityPrice} USDC`,
      alphaBaseScore: alphaBaseScore,
      alphaPenalty: alphaScored.memory_adjustment,
      alphaFinalScore: alphaScored.score,
      winnerDescription: `Provider Beta (${parityPrice} USDC)`,
      marginDescription: `${betaScored.score} vs ${alphaScored.score}`,
      safeguardHeader: "MEMORY PROTECTED ✔",
      safeguardLines: [
        "MEMORY PROTECTED: Prior failure",
        "recalled, treasury safeguarded!",
      ],
    },
  });

  // 4. Render Inspectable Evidence Card
  const evidenceCard = renderInspectableEvidenceCard({
    useAsciiBorders: args.useAscii,
    counterpartyKey: "virtuals:agent:alpha",
    displayName: "Alpha Research",
    outcome: "rejected",
    outcomeDetail: "(Recorded by Objective Verifier Agent)",
    failureReason: rejectedEpisode.note || "Deliverable schema validation failed: missing sources citations",
    runId: rejectedEpisode.run,
    timestamp: rejectedEpisode.occurredAt || rejectedEpisode.occurred_at || new Date().toISOString(),
    bayesianDelta: {
      alpha: { before: "1.00", after: (alphaRetrieval.alpha ?? 1.0).toFixed(2), delta: "+0.00 (no pass)" },
      beta: { before: "1.00", after: (alphaRetrieval.beta ?? 2.0).toFixed(2), delta: "+1.00 (+1 fail)" },
      reliability: {
        before: "0.50 (50.0%)",
        after: `${(alphaRetrieval.overallReliability ?? 0.33).toFixed(2)} (${((alphaRetrieval.overallReliability ?? 0.33) * 100).toFixed(1)}%)`,
        delta: "-0.17 (-16.7%)",
      },
      status: { before: "NEW", after: alphaRetrieval.relationshipStatus, delta: "DEMOTED (Risk)" },
      consecutiveFailures: { before: 0, after: alphaRetrieval.consecutiveFailures ?? 1, delta: "+1 (Probation)" },
    },
  });

  console.log(sideBySide);
  console.log("");
  console.log(evidenceCard);
  console.log("");

  // 5. Dynamic Winner Declaration derived strictly from ranked[0]
  const winner = ranked[0];
  const runnerUp = ranked[1];
  if (winner.key !== "virtuals:agent:beta") {
    console.error(`[Process B] Failure: Expected Provider Beta to win under history-aware scoring, got ${winner.key}`);
    return 1;
  }

  const winnerDisplayName = winner.key === "virtuals:agent:beta" ? "Beta Labs" : "Alpha Research";
  const runnerUpDisplayName = runnerUp.key === "virtuals:agent:alpha" ? "Alpha Research" : "Beta Labs";
  console.log(`Winning Counterparty: ${winner.key} (${winnerDisplayName})`);
  console.log(`Decision: ${winnerDisplayName} selected over ${runnerUpDisplayName} due to history-aware reputation penalty (${winner.score} vs ${runnerUp.score}).\n`);

  closeNativeSibylDatabase();
  console.log(`✓ Process B exiting cleanly with exit code 0.\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// Master Supervisor: Decoupled Child Process Execution
// ---------------------------------------------------------------------------

function spawnChild(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function runMasterSupervisor(args: ColdStartCliArgs): Promise<number> {
  console.log("===============================================================================");
  console.log("   AURA MEMORY: AUTOMATED TWO-SESSION COLD-START DEMONSTRATION");
  console.log("   Cross-Process Persistent Storage, Objective Verifier & Cold Recall");
  console.log("===============================================================================\n");

  const dbPath = args.dbPath || (args.useTempDb
    ? path.join(os.tmpdir(), `aura-coldstart-${Date.now()}-${randomUUID().slice(0, 8)}.db`)
    : getNativeStoragePath());

  const scriptPath = fileURLToPath(import.meta.url);
  const runnerExecutable = fs.existsSync(tsxCli) ? process.execPath : "pnpm";
  const runnerArgs = fs.existsSync(tsxCli)
    ? [tsxCli, scriptPath]
    : ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts"];

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    SIBYL_NATIVE_DB_PATH: dbPath,
    SIBYL_STORAGE_PATH: dbPath,
    AURA_NATIVE_STORAGE_PATH: dbPath,
    SIBYL_SEED_FIXTURES: "false",
    AURA_NATIVE_AUTO_SEED: "false",
    SIBYL_DISABLE_NATIVE: "false",
    ...(args.noColor ? { NO_COLOR: "1" } : {}),
    ...(args.useAscii ? { USE_ASCII_BORDERS: "1" } : {}),
  };

  try {
    // -------------------------------------------------------------------------
    // SPAWN 1: Session 1 (Process A)
    // -------------------------------------------------------------------------
    console.log(`▶ Spawning Process A (Session 1: Initial Auction & Deliverable Failure)...`);
    const procAArgs = [...runnerArgs, "--session-a", "--db", dbPath];
    if (args.useAscii) procAArgs.push("--ascii");
    if (args.noColor) procAArgs.push("--no-color");

    const codeA = await spawnChild(runnerExecutable, procAArgs, baseEnv);
    if (codeA !== 0) {
      console.error(`❌ Process A terminated with non-zero exit code: ${codeA}`);
      return 1;
    }
    console.log(`✓ Process A exited cleanly with code 0. Zero shared RAM with Process B.\n`);

    // -------------------------------------------------------------------------
    // SPAWN 2: Session 2 (Process B - Cold Start)
    // -------------------------------------------------------------------------
    console.log(`▶ Spawning Process B (Session 2: Cold Start in Fresh OS Process)...`);
    const procBArgs = [...runnerArgs, "--session-b", "--db", dbPath];
    if (args.useAscii) procBArgs.push("--ascii");
    if (args.noColor) procBArgs.push("--no-color");

    const codeB = await spawnChild(runnerExecutable, procBArgs, baseEnv);
    if (codeB !== 0) {
      console.error(`❌ Process B terminated with non-zero exit code: ${codeB}`);
      return 1;
    }
    console.log(`✓ Process B exited cleanly with code 0.\n`);

    console.log("===============================================================================");
    console.log("   ✓ DEMONSTRATION COMPLETE: 100% PERSISTENT & AUDITABLE");
    console.log("===============================================================================\n");
    return 0;
  } finally {
    if (args.useTempDb) {
      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        const walPath = `${dbPath}-wal`;
        const shmPath = `${dbPath}-shm`;
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  // Ensure DB path env is active globally immediately after parsing args.dbPath
  process.env.SIBYL_NATIVE_DB_PATH = args.dbPath;
  process.env.SIBYL_STORAGE_PATH = args.dbPath;
  process.env.AURA_NATIVE_STORAGE_PATH = args.dbPath;

  if (args.mode === "session-a") {
    const code = await runSessionA(args.dbPath);
    process.exit(code);
  } else if (args.mode === "session-b") {
    const code = await runSessionB(args.dbPath, args);
    process.exit(code);
  } else {
    const code = await runMasterSupervisor(args);
    process.exit(code);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error in demo-cold-start:", err);
  process.exit(1);
});
