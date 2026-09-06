# Deploying Aura Console

Two services out of one monorepo, and three traps that do not appear in local
development. Each one below was hit and fixed while building the images, not
predicted.

## The two services

| Service | Builder | Config | Start |
|---|---|---|---|
| `aura-api` | Dockerfile | `apps/api/railway.json` | `node apps/api/dist/server.js` |
| `aura-web` | Nixpacks | `apps/web/railway.json` | `pnpm --filter @aura/web start` |

Both build from the **repository root**, not from `apps/*`. Setting a service's
root directory to `apps/web` breaks the pnpm workspace: the app depends on
`@aura/db` through the lockfile at the root, and an install that cannot see the
workspace cannot resolve it.

## Trap 1 — the API image needs two runtimes

The API is Node. Sibyl Memory is a Python package over SQLite. The bridge in
`tools/sibyl_bridge.py` spans them, so the image carries Node 22 **and** Python
3.11 with `sibyl-memory-client` in a venv at `/opt/sibyl`.

This is why the API uses a Dockerfile rather than Nixpacks, which builds one
language well and two awkwardly.

## Trap 2 — Sibyl's memory is a file, and containers are ephemeral

`SIBYL_DB_PATH` points at a SQLite file. A container filesystem is wiped on
every deploy, so without a mounted volume the store silently resets and the
Console — correctly, and uselessly — reports `NO_HISTORY` forever.

**Attach a Railway Volume to the API service and put the database inside it:**

```
Volume mount path   /data
SIBYL_DB_PATH       /data/memory.db
```

The image deliberately does **not** default `SIBYL_DB_PATH` to a writable path.
A default would put memory on ephemeral storage and lose it without ever saying
so. With `SIBYL_PYTHON` unset the Console reports relationship memory as
`NOT CONNECTED`, which is honest; with it set and the path wrong, it reports an
empty store, which is not.

A fresh volume holds no memory. Seed the Alpha/Beta fixture into it once:

```bash
railway run --service aura-api -- /opt/sibyl/bin/python tools/sibyl_seed.py --db /data/memory.db
```

The tenant must match the API's `AGENT_ID`; the seeder defaults to it and
refuses to guess. Seeding under any other tenant writes records that are real,
correct, and permanently invisible.

## Trap 3 — `NEXT_PUBLIC_API_URL` is a BUILD-time variable

`apps/web/src/lib/env.ts` validates it with Zod at module load, and Next inlines
`NEXT_PUBLIC_*` into the client bundle at build time. Setting it only as a
runtime variable fails the build with:

```
Failed to collect configuration for /runs/[runId]
  NEXT_PUBLIC_API_URL: Invalid input: expected string, received undefined
```

On Railway it must be present when the web service **builds**, pointing at the
API service's public domain. Changing it later requires a rebuild, not a
restart.

## Environment

**API**

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Railway Postgres connection string |
| `PORT` | injected | Railway supplies it |
| `CORS_ORIGINS` | yes | The web service's public URL, comma-separated |
| `AGENT_ID` | no | Defaults to `agent_buyer_1`; also the Sibyl tenant |
| `SIBYL_DB_PATH` | for memory | Inside the mounted volume, e.g. `/data/memory.db` |
| `SIBYL_PYTHON` | preset | `/opt/sibyl/bin/python` in the image |
| `SIBYL_BRIDGE` | preset | `/app/tools/sibyl_bridge.py` in the image |
| `ADK_BASE_URL` | no | Unset means the chat reports the agent unavailable |

**Web**

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes, at build | The API service's public URL |
| `PORT` / `WEB_PORT` | injected | Railway supplies it |

## Migrations

The API never migrates on boot, so N replicas cannot race to rewrite the schema.
Run it explicitly after a deploy that adds one:

```bash
railway run --service aura-api -- pnpm db:migrate
```

## Verified

The API image was built and run against a real Postgres and a mounted Sibyl
store. Inside the container: `/health/db` 200, `/health/sibyl` reachable with
its real readings, and a counterparty recall returning `AVAILABLE` from the
Python bridge. The web production build succeeds with `NEXT_PUBLIC_API_URL` set.
