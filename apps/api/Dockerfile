# The Aura API is a two-runtime service, and that is not an accident of
# packaging: the API is Node, and Sibyl Memory ships as a Python package over a
# local SQLite file, so the image has to carry an interpreter that can import
# `sibyl-memory-client` alongside the Node server. `tools/sibyl_bridge.py` is
# the seam between them.
#
# Nixpacks builds one language well and two awkwardly, which is why this is a
# Dockerfile.
#
# IMPORTANT — Sibyl's database is a FILE. A container filesystem is ephemeral,
# so without a mounted volume every deploy silently starts from an empty store,
# and the Console would honestly report NO_HISTORY forever. Mount a volume and
# point SIBYL_DB_PATH inside it. See docs/ai/api/deployment.md.

# ---------------------------------------------------------------------------
# Builder: Node toolchain only. Nothing Python is needed to compile TypeScript.
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Manifests first so a dependency install is cached independently of source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# The root preinstall hook enforces pnpm, so it must exist before install runs.
COPY scripts/ scripts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/

RUN pnpm install --frozen-lockfile

COPY . .

# The API imports @aura/db, so the workspace package is built with it.
RUN pnpm --filter @aura/db... --filter @aura/api... build

# ---------------------------------------------------------------------------
# Runtime: Node plus a Python that can import Sibyl.
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

# python3 on bookworm-slim is 3.11; sibyl-memory-client requires >= 3.10.
# `python3-venv` is separate on Debian and the venv is what keeps Sibyl's
# dependencies out of the system interpreter.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# The whole built tree, so pnpm's workspace symlinks survive intact. Resolving
# them by hand is how a monorepo image breaks on an import nobody tested.
COPY --from=builder /app ./

# Sibyl's own runtime, isolated from the system interpreter.
RUN python3 -m venv /opt/sibyl \
 && /opt/sibyl/bin/pip install --no-cache-dir --upgrade pip \
 && /opt/sibyl/bin/pip install --no-cache-dir sibyl-memory-client

# Defaults the bridge needs. SIBYL_DB_PATH is deliberately NOT defaulted to a
# writable path here: a default inside the container would put memory on
# ephemeral storage and lose it on the next deploy without ever saying so.
# Leave SIBYL_PYTHON unset to run with relationship memory reported as
# NOT CONNECTED, which is honest, rather than silently empty.
ENV SIBYL_PYTHON=/opt/sibyl/bin/python
ENV SIBYL_BRIDGE=/app/tools/sibyl_bridge.py
ENV NODE_ENV=production

# Railway injects PORT; the server reads it and this is only the local default.
EXPOSE 3001

CMD ["node", "apps/api/dist/server.js"]
