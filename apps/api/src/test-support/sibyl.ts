import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRootEnvFile } from "@aura/db";

loadRootEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir, "../../../..");
    dir = parent;
  }
}

const repoRoot = findRepoRoot(__dirname);

/**
 * Returns a dedicated, worktree-isolated test HOME directory in os.tmpdir().
 * This ensures Sibyl's account-level cap checker (which sums Path.home() / ".sibyl-memory/memory.db")
 * inspects only the isolated test store, completely decoupled from the user's host environment.
 */
export function testSibylHomeDir(): string {
  const hash = createHash("md5").update(repoRoot).digest("hex").slice(0, 8);
  return path.join(os.tmpdir(), `aura_api_test_home_${hash}`);
}

/**
 * Returns the isolated test Sibyl SQLite database path.
 */
export function testSibylDbPath(): string {
  return path.join(testSibylHomeDir(), ".sibyl-memory", "memory.db");
}

function resolvePythonBinary(): string | undefined {
  if (process.env.SIBYL_PYTHON && fs.existsSync(process.env.SIBYL_PYTHON)) {
    return process.env.SIBYL_PYTHON;
  }
  const venvPython = path.resolve(repoRoot, ".venv-sibyl/bin/python");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return undefined;
}

/**
 * Sets up and seeds the isolated Sibyl test database once before the test suite runs.
 * If Python runtime is available, seeds the Alpha/Beta relationship fixtures and
 * the baseline cryptographic salt reference for virtuals:agent:beta v1.
 */
export async function setupTestSibylDb(): Promise<void> {
  const testHome = testSibylHomeDir();
  const testDbDir = path.join(testHome, ".sibyl-memory");
  const testDb = testSibylDbPath();

  fs.mkdirSync(testDbDir, { recursive: true });

  const python = resolvePythonBinary();
  if (!python) {
    return;
  }

  // Remove previous test database if present to ensure clean state on every test run
  if (fs.existsSync(testDb)) {
    try {
      fs.unlinkSync(testDb);
    } catch {
      // ignore
    }
  }

  const seedScript = path.resolve(repoRoot, "tools/sibyl_seed.py");
  const bridgeScript = path.resolve(repoRoot, "tools/sibyl_bridge.py");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: testHome,
    SIBYL_DB_PATH: testDb,
    SIBYL_TENANT_ID: "agent_buyer_1",
  };

  if (fs.existsSync(seedScript)) {
    execFileSync(python, [seedScript, "--db", testDb, "--tenant", "agent_buyer_1"], {
      env,
      stdio: "ignore",
    });
  }

  if (fs.existsSync(bridgeScript)) {
    execFileSync(
      python,
      [
        bridgeScript,
        "set_reference",
        "commitment:virtuals:agent:beta:v1",
        JSON.stringify({
          counterpartyKey: "virtuals:agent:beta",
          version: 1,
          salt: "0x6aa39667e808b432700aafd63cece38e8c3d0a06da3def992e16a128643cb254",
          committedAt: "2026-09-07T15:18:20.401Z",
        }),
      ],
      {
        env,
        stdio: "ignore",
      },
    );
  }
}
