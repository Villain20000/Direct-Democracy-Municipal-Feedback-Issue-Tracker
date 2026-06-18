# Contributing to Direct Democracy

Thank you for contributing. This guide helps new developers get productive quickly.

## Prerequisites

- Node.js 18+, npm 9+, Docker 20+
- 6+ GB RAM if running Ollama locally (optional — AI features degrade gracefully)

## First-time setup

```bash
git clone <repository-url>
cd Direct-Democracy-Municipal-Feedback-Issue-Tracker
npm install

# Infrastructure (Postgres + Redis + backend + worker)
docker compose -f docker/docker-compose.yml up -d

# Database
cd apps/backend
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npx tsx src/db/seed.ts
cd ../..

# Dev servers (Angular + Express)
npm run dev
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:3001/api/v1

## Demo accounts (password: `password123`)

| Role | Email |
|------|-------|
| Super Admin | `admin@city.gov` |
| Mayor | `mayor@city.gov` |
| Department Head | `pw.head@city.gov` |
| Council Member | `council1@city.gov` |
| Staff | `staff1@city.gov` |
| Ward Rep | `wardrep1@city.gov` |
| Citizen | `citizen1@email.com` |
| Volunteer | `volunteer1@email.com` |
| Auditor | `auditor@city.gov` |
| Media | `press@herald.com` |

## Running tests

```bash
# Backend unit tests (needs Postgres; Redis optional)
cd apps/backend
npx prisma generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/direct_democracy \
  JWT_SECRET=test-secret REFRESH_TOKEN_SECRET=test-refresh-secret \
  REDIS_ENABLED=false NODE_ENV=test npm test

# Frontend unit tests
npm test --workspace=apps/frontend -- --watch=false --browsers=ChromeHeadlessCI

# Lint / typecheck (all workspaces)
npm run lint

# E2E (boots dev stack via playwright.config.ts)
docker compose -f docker/docker-compose.yml up -d postgres redis
npm run db:seed
npm run test:e2e
```

## Project layout

```
apps/frontend/     Angular 18 PWA
apps/backend/      Express 5 API + Prisma
packages/shared-types/   Shared TypeScript interfaces
e2e/               Playwright specs
```

## Coding conventions

- Match existing patterns: standalone Angular components, `inject()`, Signals/computed where used
- Use `toApiError()` / `getFieldErrors()` for API errors in forms
- Add i18n keys to both `en.ts` and `el.ts` under `apps/frontend/src/app/core/i18n/translations/`
- Backend: controllers → services → Prisma; validate with Zod schemas in `validators/`
- Keep PRs small and focused — one feature or fix per PR

## Good first issues

Look for GitHub issues labeled `good-first-issue`. Starter tasks:

1. Wire feature-sweep APIs in `api.service.ts` to UI panels
2. Add backend route tests following `announcements.test.ts`
3. Expand Playwright coverage (portal, subscribe, map)
4. i18n pass on hardcoded English strings

## Pull requests

- Fill out the PR template
- Ensure `npm run lint` passes
- Run relevant tests before requesting review
- Include screenshots for UI changes