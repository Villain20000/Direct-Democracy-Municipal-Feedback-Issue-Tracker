# =============================================================================
# Backend image (monorepo-aware).
#
# Build context: the monorepo ROOT. The compose file sets `context: ..`
# (relative to `docker/docker-compose.yml`) so the COPY paths below can
# reach the root `package.json`, `package-lock.json`, and the
# `packages/` + `apps/` workspaces.
#
# Same image powers both the `backend` (Express API) and `worker`
# (BullMQ consumer) services — the worker service in compose overrides
# the CMD to `npm run worker`.
#
# SHELL is set to `/bin/sh -eo pipefail -c` so every RUN fails loud on
# any non-zero exit AND surfaces failures inside pipelines
# (`cmd1 | cmd2`). No need for per-RUN `set -e;` prefixes.
# =============================================================================

FROM node:20-alpine
SHELL ["/bin/sh", "-eo", "pipefail", "-c"]

# Native-module build deps (bcrypt, prisma engines, pdf-parse canvas)
# need OpenSSL + a basic toolchain at install time.
RUN apk add --no-cache openssl

WORKDIR /app

# --- Layer 1: targeted workspace install --------------------------------------
# Copy the root lockfile + workspace manifests so the install layer is
# cache-stable across source-only changes.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Install ONLY the workspaces the backend needs (shared-types + backend).
# Using the full `--workspaces` flag would also install apps/frontend
# (~1000 Angular packages), which bloats the image and slows the build
# for no runtime benefit.
#
# `--include-workspace-root` lets npm resolve the `@dd/shared-types: "*"`
# workspace dep from packages/shared-types instead of fetching from the
# registry. Fall back to `npm install` if the root lockfile is missing
# (dev only).
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund \
        -w @dd/shared-types -w apps/backend \
        --include-workspace-root; \
    else \
      npm install --no-audit --no-fund \
        -w @dd/shared-types -w apps/backend \
        --include-workspace-root; \
    fi

# --- Layer 2: shared-types source + build -------------------------------------
# Build the @dd/shared-types package first so the backend's `import` of
# the compiled types actually resolves.
#
# The package's `build` script is `tsc`. If the script is ever renamed
# or removed, this will fail loudly with a clear "Missing script: build"
# error — which is the desired behavior.
COPY packages/shared-types ./packages/shared-types
RUN npm run build -w @dd/shared-types

# --- Layer 3: backend source + Prisma client ----------------------------------
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN npx prisma generate

EXPOSE 3001

# Default to the API; the `worker` service overrides this CMD in compose.
CMD ["npm", "run", "dev"]
