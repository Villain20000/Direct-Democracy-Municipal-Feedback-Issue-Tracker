# 🏛️ Direct Democracy — Municipal Feedback & Issue Tracker

A full-stack civic engagement platform enabling citizens to report issues, vote on priorities, and participate in local democracy. Powered by **Angular 18**, **Express.js 5**, **PostgreSQL 16 + PostGIS + pgvector**, **BullMQ**, **Redis 7**, and local AI via **Ollama** (Gemma 2B for chat + `nomic-embed-text` for RAG embeddings). Ships as an installable **PWA** with **offline-first issue submission**, and ships with a **Playwright E2E** test suite.

> ✨ **What’s new in v1.5**
>
> - 🗺️ **PostGIS spatial queries** — radius / polygon / nearest-issue endpoints with a GIST index
> - 🧠 **RAG over municipal legislation** — pgvector + `nomic-embed-text` + BullMQ worker, citation-aware chat
> - ⚡ **Real-Time AI Streaming (SSE)** — chat chatbot endpoints stream tokens from Gemma 2B via Server-Sent Events (SSE)
> - 🎨 **Premium Glassmorphic UI & Dark Mode** — slate HSL color system, Outfit typography, glassmorphic layout elements, and theme toggler saved in localStorage
> - 📦 **Offline-first PWA** — service worker, manifest, IndexedDB submission queue with auto-drain
> - 🧪 **Playwright E2E suite** — auth, issue flow, semantic search
> - ⚡ **Redis cache for semantic search** — 300 s TTL, in-memory fallback
> - 🗂 **Admin legislation KB** — upload ordinances / decisions, browse / retrieve with citations
> - 🛠 **Database Schema Alignment** — removed database unique index drift on `User(departmentId)` to support multiple staff per department as defined in Prisma schema

---

## 📋 Table of Contents

- [What’s New](#-whats-new)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Roles & Features](#-roles--features)
- [Prerequisites](#-prerequisites)
- [Setup & Installation](#-setup--installation)
- [Running the App](#-running-the-app)
- [Demo Accounts](#-demo-accounts)
- [Quick Tour — 5-minute curl walkthrough](#-quick-tour--5-minute-curl-walkthrough)
- [API Endpoints](#-api-endpoints)
- [AI Integration & RAG](#-ai-integration--rag)
- [Spatial Queries (PostGIS)](#-spatial-queries-postgis)
- [Progressive Web App](#-progressive-web-app)
- [Database](#-database)
- [Testing (Unit + E2E)](#-testing-unit--e2e)
- [CI/CD](#-cicd)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Health Check](#-health-check)
- [License](#-license)

---

## 🛠 Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | Angular 18 | Standalone components, Signals, `@if`/`@for` control flow, **PWA** via `@angular/service-worker` |
| **Backend** | Express.js 5 | TypeScript, layered architecture (controllers → services → Prisma) |
| **Database** | PostgreSQL 16 | Dockerized via custom image with **pgvector** + **PostGIS** extensions |
| **ORM** | Prisma | Type-safe access; `Unsupported("vector(768)")` and `Unsupported("geometry(Point, 4326)")` for embeddings + location |
| **AI — Chat** | Ollama + Gemma 2B | Local CPU inference for categorization, priority, sentiment, summaries, chat |
| **AI — Embeddings** | Ollama + `nomic-embed-text` | 768-dim vectors for semantic search, duplicate detection, RAG retrieval |
| **Vector store** | pgvector | `ivfflat` HNSW indexes; cosine distance; SQL-only queries |
| **Spatial store** | PostGIS | `GEOMETRY(Point, 4326)`, GIST index, `ST_DWithin` / `ST_Contains` |
| **Job queue** | BullMQ + ioredis | Embedding + heavy AI work runs in a separate `worker` container |
| **Cache** | Redis 7 | Embedding-result cache (300 s TTL), in-memory fallback if Redis is down |
| **Auth** | JWT + Refresh Tokens | 15-min access tokens, 7-day httpOnly cookie refresh tokens, 9 RBAC roles |
| **E2E tests** | Playwright | Chromium, real backend, HTML report, CI integration |
| **Monorepo** | npm workspaces | `/apps` (frontend, backend) + `/packages` (shared-types) |
| **Infrastructure** | Docker Compose | Postgres + Redis + Backend API + Embed worker |

---

## 🏗 Architecture

```mermaid
flowchart LR
    %% Click to zoom — GitHub renders this natively and opens a
    %% larger view on click. Numbered edges trace ONE request through
    %% the whole stack: sync hot path (solid), async embed pipeline
    %% (dashed), RAG chat pipeline (thick). Stadium-shaped nodes are
    %% stores; rectangles are compute.

    subgraph BROWSER ["🖥 Browser (PWA)"]
        UI["Angular 18 UI<br/>9 role dashboards"]
        SW["Service Worker<br/>ngsw + IndexedDB queue"]
    end

    subgraph API ["⚙️ Express.js 5 API"]
        ROUTES["REST routes<br/>issues · spatial ·<br/>admin docs · AI"]
        SVC["Services<br/>issue · spatial ·<br/>rag · embedding"]
    end

    subgraph WORKER ["🔁 BullMQ worker"]
        Q[("embed-issue<br/>queue")]
        W["embed worker<br/>(tsx watch)"]
    end

    subgraph AI ["🧠 Ollama (local CPU)"]
        CHAT["gemma2:2b<br/>(chat)"]
        EMBED["nomic-embed-text<br/>(768-dim)"]
    end

    subgraph DB ["🗄 PostgreSQL 16"]
        T[("Relational<br/>tables")]
        VEC[("pgvector<br/>vector(768)")]
        GEO[("PostGIS<br/>geometry")]
    end

    REDIS[("Redis 7<br/>BullMQ + cache")]

    %% === Sync hot path (solid arrows) ===
    UI -->|"1. HTTPS+JWT"| SW
    SW -->|"2. fetch"| ROUTES
    ROUTES --> SVC
    SVC -->|"3. SQL"| T
    SVC -->|"4. ST_DWithin /<br/>ST_Contains"| GEO
    SVC -->|"5. cosine distance"| VEC
    SVC -->|"6. get / set"| REDIS

    %% === Async embed pipeline (dashed arrows) ===
    SVC -. "7. enqueue" .-> REDIS
    REDIS -. "8. BLPOP" .-> Q
    Q --> W
    W -->|"9. embed title+desc"| EMBED
    EMBED -->|"10. 768-dim vector"| W
    W -->|"11. UPSERT embedding"| VEC
    W -. "12. del search:semantic:*" .-> REDIS

    %% === RAG chat pipeline (thick arrows) ===
    SVC ==>|"13. embed query"| EMBED
    EMBED ==>|"14. vector"| SVC
    SVC ==>|"15. top-K cosine"| VEC
    VEC ==>|"16. chunks"| SVC
    SVC ==>|"17. prompt + context"| CHAT
    CHAT ==>|"18. cited answer"| SVC

    %% === Response back to the client ===
    SVC -->|"19. JSON"| ROUTES
    ROUTES -->|"20. HTTPS"| SW
    SW -->|"21. cache / deliver"| UI
```

> 💡 **How to read this:** solid arrows are the **synchronous hot path** a single API call walks (one read, one write, one response). Dashed arrows are the **async embed pipeline** kicked off by `POST /issues` — the HTTP response returns `202` *before* the embedding lands, and the worker writes the vector on its own clock. Thick arrows are the **RAG chat pipeline** (6 round-trips per answer). Click the diagram in GitHub's preview to open the zoomed view.

---

## 👥 Roles & Features

### 9 Roles

| Role | Description | Dashboard Color |
|------|-------------|----------------|
| **Super Admin** | Full system control, user management, settings, legislation KB | 🔴 Deep Red |
| **Mayor** | City-wide analytics, resolutions, announcements, weekly briefing | 🔵 Royal Blue |
| **Department Head** | Manages department issues, staff, budget | 🟢 Forest Green |
| **Council Member** | Constituent issues, resolution voting, meetings, KB upload | 🟣 Purple |
| **Staff / Agent** | Handles assigned issues, status updates, field notes | 🟠 Orange |
| **Ward Rep** | Neighborhood feedback, community events | 🔵 Teal |
| **Citizen** | Report issues, vote, participate in forums, **PWA offline mode** | 🔵 Sky Blue |
| **Volunteer** | Community projects, events, observations | 🟡 Amber |
| **Auditor** | Compliance oversight, audit log explorer, anomaly detection, CSV export | ⚫ Slate Gray |
| **Media** | Public statistics, trending issues, press reports | 🔵 Indigo |

> The platform ships with **10 active roles** (see table above), including the `Auditor` role which has a dedicated dashboard, read access to the immutable `AuditLog`, anomaly detection view, and CSV report export. The `AUDITOR` enum value is in `schema.prisma`, a seeded demo account exists (`auditor@city.gov`), and 7 backend routes authorize it.

### 30+ Features

- **Issue Management:** Submission, tracking, smart routing, priority queue, **bulk management**, templates, **map area summary** (draw a polygon → AI summary)
- **AI-Powered:** Auto-categorization, priority scoring, sentiment analysis, summaries, **RAG chatbot with citations**, trend detection
- **Spatial:** **Radius search**, **polygon search**, **nearest-issue lookup**, **draw-to-summarize area**, map heat layer
- **Democratic:** Upvoting, community polls, resolution voting, referendum tracker
- **Communication:** Comments, notifications, announcements, direct messaging
- **Analytics:** Dashboard analytics, heat maps, report export, transparency portal
- **Legislation KB (new):** Upload ordinances / decisions / regulations, semantic search with citations
- **Offline (new):** **PWA** with service worker, IndexedDB submission queue, background auto-drain, install prompt
- **Administration:** User management, department/ward management, audit trail, custom dashboards

---

## ⚡ Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Docker** ≥ 20.x
- **6+ GB RAM** (Gemma 2B ~1.6 GB + `nomic-embed-text` ~274 MB + dev services)
- **Ollama** (for AI / RAG features — optional, app falls back gracefully when offline)

---

## 🚀 Setup & Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd Direct-Democracy-Municipal-Feedback-Issue-Tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start infrastructure (Postgres + Redis)

The custom `docker/postgres.Dockerfile` layers **PostGIS** on top of the **pgvector** base image so we have *both* extensions in one place.

```bash
docker compose -f docker/docker-compose.yml up -d
```

This boots:

| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 5432 | App DB + pgvector + PostGIS |
| `redis` | 6379 | BullMQ + embedding-result cache |
| `backend` | 3001 | Express API (dev, with `tsx watch`) |
| `worker` | — | BullMQ consumer (embed-issue queue) |

Verify:

```bash
docker ps
# dd_postgres, dd_redis, dd_backend, dd_worker

# Confirm both extensions are loaded:
docker exec dd_postgres psql -U postgres -d direct_democracy -c \
  "SELECT extname FROM pg_extension ORDER BY extname;"
# → plpgsql, postgis, vector
```

### 4. Set up the database

```bash
cd apps/backend
cp .env.example .env   # adjust if needed (see "Environment Variables" below)

# Generate Prisma client
npx prisma generate

# Apply all migrations (creates 23+ tables, enables extensions, builds indexes)
npx prisma migrate deploy

# Seed with sample data (16 users, 8 issues, 8 departments, 6 wards)
npx tsx src/db/seed.ts

# (Optional) Backfill embeddings for any issues that don't have one yet
npm run embed:backfill
```

### 5. Install Ollama + models (AI / RAG features)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &

# Chat model (~1.6 GB)
ollama pull gemma2:2b

# Embedding model (~274 MB) — required for semantic search and RAG
ollama pull nomic-embed-text
```

Verify:

```bash
curl http://localhost:11434/api/tags
# Should list both gemma2:2b and nomic-embed-text
```

### 6. Start the embed worker (if not using Docker)

The worker lives in a separate process so HTTP requests return immediately. If you used `docker compose up`, the worker is already running. Otherwise:

```bash
cd apps/backend
npm run worker
```

### 7. Install Angular CLI (optional)

```bash
npm install -g @angular/cli
```

---

## 🏃 Running the App

### All-in-one (with Docker)

```bash
docker compose -f docker/docker-compose.yml up
```

### Local dev (without Docker for the app — just for infra)

```bash
# From the project root — starts backend + frontend together
npm run dev
```

- **Backend API** → `http://localhost:3001`
- **Frontend (PWA)** → `http://localhost:4200`

### Individually

```bash
# Terminal 1 — backend
cd apps/backend
npm run dev

# Terminal 2 — embed worker
cd apps/backend
npm run worker

# Terminal 3 — frontend
cd apps/frontend
npm start
```

Open in browser: `http://localhost:4200`

> The PWA is fully functional in **dev mode** for testing the service worker. Production builds (`npm run build:frontend`) enable the full offline asset cache via `ngsw-config.json`.

---

## 🔑 Demo Accounts

## 🚀 Quick Tour — 5-minute curl walkthrough

This walks through the full stack once: **seed login → create issue → confirm the embed worker ran → semantic search → spatial summarize → ask the RAG chatbot a question**. All commands run against a local dev stack (`docker compose -f docker/docker-compose.yml up` for Postgres/Redis/Ollama/Worker, then `npm run dev` for the Angular + Express processes).

> **Prereqs in one line:** `docker compose up -d` → `npx prisma migrate deploy` → `npx tsx src/db/seed.ts` → `npm run worker` (in a second terminal) → `npm run dev` (in a third).

### 0. Log in once, reuse the token

```bash
# Login as the seeded admin. The access token is valid for 15 min —
# plenty of time to finish the whole tour.
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@city.gov","password":"password123"}' \
  | jq -r '.data.accessToken')
echo "Token: ${TOKEN:0:20}…"
```

### 1. Create an issue

```bash
ISSUE=$(curl -s -X POST http://localhost:3001/api/v1/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Massive pothole on Monastiriou Street",
    "description": "Deep pothole near the corner with Egnatia causing tyre damage to cars and bikes. Has been there for weeks.",
    "category": "INFRASTRUCTURE",
    "location": "Monastiriou 12, Thessaloniki",
    "latitude": 40.6401,
    "longitude": 22.9444
  }')
ISSUE_ID=$(echo "$ISSUE" | jq -r '.data.id')
echo "Created issue: $ISSUE_ID"
```

> **What just happened:** the API persisted the row, fire-and-forgot `syncGeomFromLatLng` for the PostGIS `location_geom`, and **returned `202 Accepted`** with a `warnings: []` array. An `embed-issue` BullMQ job is now sitting in Redis waiting for the worker.

### 2. Confirm the embedding job ran

```bash
# Give the worker a beat to drain the queue.
sleep 2

# BullMQ queue is empty.
docker exec dd_redis redis-cli LLEN bull:embed-issue:wait
# → 0

# Postgres has the freshly-generated vector.
docker exec dd_postgres psql -U postgres -d direct_democracy -c \
  "SELECT i.title, e.model, e.\"generatedAt\"
   FROM \"IssueEmbedding\" e JOIN \"Issue\" i ON i.id = e.\"issueId\"
   WHERE i.id = '$ISSUE_ID';"
# → Massive pothole on Monastiriou Street | nomic-embed-text | <timestamp>
```

> **What just happened:** the worker consumed the job, called `nomic-embed-text` for `(title + description)`, and upserted a 768-dim vector into `IssueEmbedding`. The `contentHash` makes the worker idempotent — re-runs on unchanged content are no-ops.

### 3. Semantic search

```bash
curl -s "http://localhost:3001/api/v1/issues/search-similar?text=broken%20streetlight&topK=3" \
  | jq '.data | map({id, title, score: (.score | tonumber | . * 100 | round / 100)})'
```

```json
[
  { "id": "...", "title": "Streetlight #42 on Tsimiski has been out for a week", "score": 0.81 },
  { "id": "...", "title": "Pole 17 flickering at the corner", "score": 0.74 }
]
```

> **What just happened:** the API embedded the query, ran `1 - (embedding <=> query_vec) AS score` against every `IssueEmbedding`, filtered by `score >= 0.2`, and returned the top-3 ranked by cosine similarity. The result is **cached in Redis** (SHA-256 of `text|topK|minScore`) for 5 min — a second identical search hits Redis instead of Ollama + pgvector. Falls back to `ILIKE` text search if Ollama is down.

### 4. Spatial summarize — "draw a polygon on the map"

```bash
curl -s -X POST http://localhost:3001/api/v1/issues/summarize-area \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "polygon": [
      [22.94, 40.64], [22.95, 40.64],
      [22.95, 40.65], [22.94, 40.65]
    ]
  }' \
  | jq '.data | {mode, summary, issueCount: (.issues | length)}'
```

```json
{
  "mode": "postgis",
  "summary": "Within the selected area, the dominant concern is road surface deterioration: 3 pothole reports, 1 broken streetlight, and 1 illegal-dumping complaint have been filed in the last 30 days. Public Works has 2 of these open and 1 in progress.",
  "issueCount": 5
}
```

> **What just happened:** the API ran PostGIS `ST_Contains` against the `Issue.location_geom` column, collected the matching issues, and asked `gemma2:2b` to write a 2-sentence summary. The frontend's "Draw area" tool on the map page wires the same endpoint to a click-driven polygon. If PostGIS is unavailable, `area-summary.service.ts` automatically falls back to a JS bounding-box query — the page never breaks.

### 5. Upload a piece of legislation to the KB (prerequisite for #6)

```bash
DOC=$(curl -s -X POST http://localhost:3001/api/v1/admin/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Noise Ordinance 2024-12",
    "type": "ORDINANCE",
    "source": "manual",
    "documentDate": "2024-12-01",
    "content": "Quiet hours are 15:00-17:30 and 23:00-07:00 on weekdays, and all day on Sundays. Construction noise is permitted 07:00-15:00 weekdays only. Violations are subject to a 200-500 euro fine."
  }')
echo "$DOC" | jq '.data | {id, title, chunksCreated, skipped}'
# → { "id": "...", "title": "Noise Ordinance 2024-12", "chunksCreated": 1, "skipped": false }
```

> **What just happened:** the API ingested the document, computed a SHA-256 `contentHash` (idempotent — re-uploading the same text is a no-op), split it into ~500-token chunks, embedded each with `nomic-embed-text`, and wrote them to `DocumentChunk`. Larger PDFs go through `pdf-parse` server-side; the JSON path above is for paste-in text.

### 6. Ask the RAG chatbot a question

```bash
curl -s -X POST http://localhost:3001/api/v1/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"user","content":"What are the quiet hours for renovation work?"}
    ]
  }' \
  | jq '.data | {answer, ragUsed, citations: .citations | map({title, score: (.score | . * 100 | round / 100), chunk: (.chunk[0:80] + "…")})}'
```

```json
{
  "answer": "Renovation work is permitted 07:00-15:00 on weekdays only [1]. Outside those hours — 15:00-17:30, 23:00-07:00, and all day Sunday — you must stop noisy work or risk a 200-500 euro fine.",
  "ragUsed": true,
  "citations": [
    {
      "title": "Noise Ordinance 2024-12",
      "score": 0.83,
      "chunk": "Quiet hours are 15:00-17:30 and 23:00-07:00 on weekdays, and all day on Sundays. C…"
    }
  ]
}
```

> **What just happened:** the API embedded the question, retrieved the top-5 most similar chunks from `DocumentChunk` (cosine ≥ 0.3), injected them as a system message asking the model to **cite document numbers in brackets**, and called `gemma2:2b`. The response includes the answer + structured citations for the UI to render. Set `useRag: false` to bypass retrieval.

---

**Total time:** ~4–5 min, dominated by the Ollama cold-start in steps 2 and 6. If a step fails, the most common cause is the embed worker not running — `cd apps/backend && npm run worker` to start it.

| Role | Email | Dashboard |
|------|-------|-----------|
| Super Admin | `admin@city.gov` | `/admin` |
| Mayor | `mayor@city.gov` | `/mayor` |
| Department Head | `pw.head@city.gov` | `/department` |
| Council Member | `council1@city.gov` | `/council` |
| Staff | `staff1@city.gov` | `/staff` |
| Ward Rep | `wardrep1@email.com` | `/ward` |
| Citizen | `citizen1@email.com` | `/citizen` |
| Volunteer | `volunteer1@email.com` | `/volunteer` |
| Media | `press@herald.com` | `/media` |

---

## 📡 API Endpoints

> All endpoints are prefixed with `/api/v1`. Authentication uses `Authorization: Bearer <jwt>` unless marked **Public**.

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login (returns JWT) |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | ✅ | Logout (clears refresh token) |
| GET | `/auth/profile` | ✅ | Get current user profile |

### Issues

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/issues` | Public | List issues (paginated, filterable) |
| GET | `/issues/stats` | ✅ | Dashboard statistics |
| GET | `/issues/templates` | ✅ | Pre-built issue templates |
| GET | `/issues/search-similar` | Public | **Semantic** search (`?text=…&topK=5&minScore=0.2`) |
| POST | `/issues/summarize-area` | ✅ | **AI summary** of issues inside a drawn polygon |
| GET | `/issues/:id` | Public | Get issue detail |
| POST | `/issues` | ✅ | Create issue (**202** — embedding is queued) |
| PATCH | `/issues/bulk` | Staff+ | Bulk update status / assign / etc. |
| PATCH | `/issues/:id/status` | Staff+ | Update status |
| PATCH | `/issues/:id/assign` | Admin+ | Assign issue |
| POST | `/issues/:id/upvote` | ✅ | Upvote / toggle vote |
| POST | `/issues/:id/comments` | ✅ | Add comment |

### Spatial (PostGIS)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/spatial/issues/within` | ✅ | `?lat=…&lng=…&radius=500` — `ST_DWithin` |
| POST | `/spatial/issues/in-polygon` | ✅ | `{ polygon: [[lng,lat], …] }` — `ST_Contains` |
| GET | `/spatial/issues/nearest` | ✅ | `?lat=…&lng=…&k=5` — k-nearest neighbours |

### Admin — Legislation KB

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/documents` | Admin+ | List uploaded documents |
| GET | `/admin/documents/:id` | Admin+ | Get document + chunks |
| POST | `/admin/documents` | Admin+ | **Upload** (`multipart/form-data` PDF/.txt **or** JSON `{content}`) |
| POST | `/admin/documents/retrieve` | Admin+ | **Semantic search** the KB (no LLM) |
| DELETE | `/admin/documents/:id` | Admin+ | Remove document + chunks |

> Roles allowed: `SUPER_ADMIN`, `MAYOR`, `DEPARTMENT_HEAD`, `COUNCIL_MEMBER`.

### AI

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/categorize` | ✅ | Auto-categorize issue text |
| POST | `/ai/priority` | ✅ | Score urgency 1-5 |
| POST | `/ai/sentiment` | ✅ | Sentiment analysis |
| POST | `/ai/summary` | ✅ | Executive summary |
| POST | `/ai/trends` | ✅ | Detect emerging trends |
| POST | `/ai/chat` | ✅ | **RAG-augmented** chat — returns `{ answer, citations, ragUsed }` |

### Users / Notifications / Departments / Events / Announcements / Polls / Resolutions / Messages / Audit / Surveys / Forums / Reports / Comments / Attachments

All standard CRUD + role-aware list endpoints. See `apps/backend/src/routes/*.routes.ts` for the full surface.

---

## 🤖 AI Integration & RAG

The platform runs **two Ollama models**:

| Model | Purpose | Dimensionality |
|-------|---------|---------------|
| `gemma2:2b` | Chat, categorization, priority, sentiment, summary, trends | — |
| `nomic-embed-text` | Embeddings for RAG + semantic search | 768-dim |

### RAG Chat

`POST /api/v1/ai/chat` accepts:

```json
{
  "messages": [
    { "role": "user", "content": "Can I build a fence higher than 1.5 m in Ward 3?" }
  ],
  "useRag": true
}
```

Behind the scenes:

1. Embed the latest user message with `nomic-embed-text` (or pull from Redis cache).
2. Retrieve the **top-5 most similar chunks** from `DocumentChunk` via pgvector cosine distance.
3. Inject them as a **system message** that explicitly asks the model to **cite document numbers in brackets `[1]`, `[2]`, …**.
4. Stream the chat completion back to the client.
5. Return both the answer and the citations for the UI to render.

Response shape:

```json
{
  "success": true,
  "data": {
    "answer": "Yes, you can request an exemption through the Building Office [1]...",
    "citations": [
      {
        "documentId": "...",
        "title": "Ordinance 24-2024 — Building Height Limits",
        "type": "ORDINANCE",
        "source": "upload:ordinance-24-2024.pdf",
        "documentDate": "2024-11-12",
        "chunkIndex": 3,
        "score": 0.81,
        "chunk": "…first 220 chars of the matching chunk…"
      }
    ],
    "ragUsed": true
  }
}
```

### Semantic Issue Search

`GET /api/v1/issues/search-similar?text=broken%20streetlight&topK=5`

- Embeds the query, runs `1 - (embedding <=> query_vec) AS score` against `IssueEmbedding`.
- Caches successful results in Redis (SHA-256 of `text|topK|minScore`, TTL 300 s).
- Falls back to plain `ILIKE` text search if Ollama or pgvector is unavailable — search never breaks.

### Embedding pipeline

- **On create**: `POST /issues` persists the row, returns `202 Accepted`, and enqueues a BullMQ job (`jobId: embed:<issueId>` → dedupes double-clicks).
- **Worker**: `npm run worker` (or the `worker` Docker service) consumes the queue, calls Ollama, upserts into `IssueEmbedding` with a `contentHash` so unchanged content is a no-op.
- **Backfill**: `npm run embed:backfill` re-embeds anything missing or stale (e.g. after a model swap).

### Admin document ingestion

`POST /api/v1/admin/documents` accepts:

```bash
# Option A — multipart upload
curl -X POST http://localhost:3001/api/v1/admin/documents \
  -H "Authorization: Bearer <token>" \
  -F "file=@ordinance-24-2024.pdf" \
  -F "title=Ordinance 24-2024" \
  -F "type=ORDINANCE" \
  -F "source=upload:ordinance-24-2024.pdf" \
  -F "documentDate=2024-11-12"

# Option B — JSON paste-in
curl -X POST http://localhost:3001/api/v1/admin/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Decision 12-2025",
    "type": "DECISION",
    "source": "manual",
    "content": "…full text of the decision…"
  }'
```

- **PDF**: extracted with `pdf-parse` server-side.
- **Chunking**: ~500-token sliding windows.
- **Idempotent**: re-uploading the same content becomes a no-op (the `contentHash` unique index catches it).
- **Types**: `ORDINANCE | DECISION | REGULATION | GUIDE | OTHER`.

---

## 🗺 Spatial Queries (PostGIS)

The `Issue` table has a `location_geom GEOMETRY(Point, 4326)` column with a **GIST index**. PostGIS uses **X-then-Y** (longitude first, then latitude) — every helper in `spatial.service.ts` and every route documents this explicitly.

### Radius search

```bash
curl "http://localhost:3001/api/v1/spatial/issues/within?lat=40.6401&lng=22.9444&radius=500&statuses=SUBMITTED,IN_PROGRESS" \
  -H "Authorization: Bearer <token>"
```

```sql
-- Equivalent SQL (uses geography type so radius is in meters)
SELECT i.id, i.title, i.status::text,
       ST_Y(i.location_geom) AS latitude,
       ST_X(i.location_geom) AS longitude,
       ST_Distance(i.location_geom::geography, ST_MakePoint($lng, $lat)::geography) AS distance_m
FROM "Issue" i
WHERE ST_DWithin(
  i.location_geom::geography,
  ST_MakePoint($lng, $lat)::geography,
  $radius_m
)
ORDER BY distance_m ASC
LIMIT 200;
```

### Polygon search ("draw on the map → summarize")

```bash
curl -X POST http://localhost:3001/api/v1/spatial/issues/in-polygon \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "polygon": [
      [22.94, 40.64], [22.95, 40.64],
      [22.95, 40.65], [22.94, 40.65]
    ]
  }'
```

The frontend exposes this through the **map page** ("Draw area" tool) which calls `/issues/summarize-area` to get an LLM-generated summary of all the issues in the polygon.

> `area-summary.service.ts` automatically **falls back to a JS bounding-box query** (no PostGIS) if the geometry column isn't populated yet — so the page never breaks on a fresh install.

### Graceful degradation

`issue.service.create()` calls `spatialService.syncGeomFromLatLng(id, lat, lng)` fire-and-forget right after the row is created, so every new issue with coordinates is immediately queryable in PostGIS.

---

## 📦 Progressive Web App

The frontend is an installable PWA. The PWA is configured in `apps/frontend/ngsw-config.json` and registered in `app.config.ts` via `provideServiceWorker`.

### What gets cached

| Group | Strategy | Items |
|-------|----------|-------|
| **App shell** | `install` (precache) | `/index.html`, bundles, `manifest.webmanifest` |
| **Assets** | `install` (precache) | `/assets/**` (icons, fonts, images) |
| **API (issues list, stats)** | `freshness` (timeout 10 s, max 1 h) | `GET /api/v1/issues*` |
| **API (read-only detail)** | `performance` (max 30 d) | `GET /api/v1/issues/:id`, departments, wards |
| **API (mutations)** | bypass | `POST /issues`, etc. — handled by the queue below |

### Offline issue submission

Citizens in the field (low 4G/5G) can still report issues:

1. **Service worker** intercepts the failed `POST /api/v1/issues` when offline and **returns 503**.
2. **`OfflineQueueService`** (IndexedDB-backed) catches the 503, persists the full payload + a client-generated `clientId` to IndexedDB.
3. When connectivity returns (`window.online` event + on app start), the queue **replays each payload** with exponential backoff.
4. After 5 failed attempts a payload moves to the **dead-letter store** and surfaces a red badge in the install banner.
5. Successful submissions are removed from the queue; the UI shows a "📤 X report(s) waiting" indicator.

### Install prompt

`<app-install-prompt>` captures the native `beforeinstallprompt` event and renders a small banner with a "Install" CTA. Also displays the current offline-queue depth.

### Manifest

`apps/frontend/src/manifest.webmanifest` declares:

- `name` / `short_name`: `Direct Democracy — Municipal Feedback` / `DD`
- `display: standalone`, `theme_color: #2563eb`, `background_color: #0f172a`
- 8 icon sizes (72 → 512, all `maskable any`)

> ℹ️ Drop your app icons into `apps/frontend/src/assets/icons/` (the manifest references `icon-72x72.png` through `icon-512x512.png`).

---

## 🗄 Database

PostgreSQL 16 with two extensions enabled in the first migration:

| Extension | Used for |
|-----------|----------|
| `vector` (pgvector) | 768-dim embeddings on `IssueEmbedding` and `DocumentChunk` |
| `postgis` | `GEOMETRY(Point, 4326)` on `Issue`, GIST index |

### 23+ tables

| Category | Tables |
|----------|--------|
| **Auth** | `User`, `RefreshToken` |
| **Geography** | `Ward`, `Department`, `DepartmentWard` |
| **Issues** | `Issue`, `IssueTag`, `StatusHistory`, `Attachment`, **`IssueEmbedding`** (vector) |
| **Voting** | `Vote`, `Poll`, `PollOption`, `Survey`, `SurveyQuestion`, `SurveyResponse` |
| **Communication** | `Comment`, `Message`, `Notification`, `Announcement` |
| **Events** | `Event`, `EventRSVP` |
| **Governance** | `Resolution` |
| **Audit** | `AuditLog` |
| **AI / RAG** | `Document`, `DocumentChunk` (vector) |
| **Analytics** | `WeeklySummary` |

### Migrations

```bash
cd apps/backend
npx prisma migrate deploy         # apply all
npx prisma migrate dev --name X  # dev: create a new one
npx prisma studio                # visual browser
npx prisma db push --force-reset  # ⚠️ destroys all data
npx tsx src/db/seed.ts            # re-seed after reset
npm run embed:backfill           # re-embed after a model swap
```

---

## 🧪 Testing (Unit + E2E)

### Backend unit tests (Jest)

```bash
npm test                        # all
cd apps/backend && npx jest --watch
```

### Frontend unit tests (Karma + Jasmine)

```bash
cd apps/frontend
npm test -- --watch=false --browsers=ChromeHeadlessCI
```

### End-to-end (Playwright)

```bash
# 1. Make sure infra is up (Postgres + Redis)
docker compose -f docker/docker-compose.yml up -d postgres redis

# 2. (Optional) Pre-start the dev stack to skip Playwright's webServer boot
PLAYWRIGHT_SKIP_WEBSERVER=1 npm run dev   # in a separate terminal

# 3. Run the suite
npm run test:e2e
# → 3 specs: auth, issue flow, semantic search
# → HTML report at ./playwright-report/

# Interactive modes
npm run test:e2e:headed
npm run test:e2e:ui
```

The config (`playwright.config.ts`) auto-boots the dev stack via `webServer` unless you pre-started it.

---

## 🔁 CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push / PR:

1. **Lint + typecheck** for both workspaces
2. **Backend unit tests** (Jest) against a Postgres + Redis service container
3. **Frontend unit tests** (Karma + ChromeHeadlessCI)
4. **Build** both apps
5. **Playwright E2E** against a fresh stack (Postgres service + Redis service + seeded DB)
6. **Upload** the Playwright HTML report as a build artifact

---

## ⚙️ Environment Variables

### Backend (`apps/backend/.env`)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/direct_democracy

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret-key
REFRESH_TOKEN_EXPIRES_IN=7d

# Ollama — chat model
OLLAMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma2:2b

# Ollama — embedding model (RAG / pgvector)
# Must be 768-dim unless you also update the `vector(768)` columns in
# the Prisma schema and re-run migrations.
EMBED_MODEL=nomic-embed-text

# Redis (optional — falls back to in-memory cache)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Email (optional — logs to console when SMTP not configured)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@city.gov
APP_URL=http://localhost:4200

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200

# Worker tuning
WORKER_CONCURRENCY=2
EMBED_LOCK_DURATION_MS=60000
EMBED_STALLED_INTERVAL_MS=30000
```

### Frontend (`apps/frontend/src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001/api/v1',
};
```

---

## 📁 Project Structure

```
Direct-Democracy-Municipal-Feedback-Issue-Tracker/
├── apps/
│   ├── frontend/                                # Angular 18 PWA
│   │   ├── ngsw-config.json                     # Service worker config
│   │   ├── src/
│   │   │   ├── manifest.webmanifest             # PWA install metadata
│   │   │   └── app/
│   │   │       ├── core/
│   │   │       │   ├── guards/                  # authGuard, roleGuard(...)
│   │   │       │   ├── interceptors/            # credentials, auth
│   │   │       │   ├── services/                # AuthService, ApiService, OfflineQueueService (IDB)
│   │   │       │   └── i18n/                    # EN / EL translations
│   │   │       ├── shared/                      # Layout, Toast, LanguageSwitcher, InstallPrompt
│   │   │       └── features/
│   │   │           ├── auth/                    # Login, Register, Forgot/Reset Password
│   │   │           ├── admin/                   # Admin dashboard, **Legislation KB** (upload + browse)
│   │   │           ├── mayor/                   # Mayor dashboard
│   │   │           ├── department/              # Department Head dashboard
│   │   │           ├── council/                 # Council Member dashboard
│   │   │           ├── staff/                   # Staff dashboard
│   │   │           ├── ward/                    # Ward Rep dashboard
│   │   │           ├── citizen/                 # Citizen dashboard (offline-aware)
│   │   │           ├── volunteer/               # Volunteer dashboard
│   │   │           ├── media/                   # Media dashboard
│   │   │           ├── issues/                  # List, create, detail (with AI duplicates)
│   │   │           └── shared/                  # **Map page with draw-area + spatial filters**
│   │   └── karma.conf.js
│   │
│   └── backend/                                 # Express.js 5 API
│       ├── Dockerfile
│       ├── prisma/
│       │   ├── schema.prisma                    # All 23+ models, Unsupported vector + geometry
│       │   └── migrations/                      # init, feature-sweep, **pgvector + RAG**, **PostGIS**
│       └── src/
│           ├── config/                          # Env config
│           ├── db/                              # Prisma client + seed
│           ├── cache/                           # Redis + in-memory fallback
│           ├── middleware/                      # auth, RBAC, validate, rateLimit, error
│           ├── routes/                          # auth, issues, ai, **spatial**, **admin-documents**, …
│           ├── services/                        # issue, auth, user, **rag**, **embedding**, **spatial**, **area-summary**, …
│           ├── ai/                              # Ollama chat wrapper
│           ├── queue/                           # **BullMQ embed-issue queue**
│           ├── worker.ts                        # **Background embedding worker entry**
│           ├── scripts/embed-existing-issues.ts # **Backfill script**
│           ├── utils/                           # content-hash, etc.
│           └── index.ts                         # Express app entry
│
├── packages/
│   └── shared-types/                            # TS interfaces shared between FE & BE
│
├── docker/
│   ├── docker-compose.yml                       # Postgres + Redis + backend + worker
│   └── postgres.Dockerfile                      # pgvector + PostGIS combined image
│
├── e2e/                                         # **Playwright specs**
│   ├── auth.spec.ts
│   ├── issue-flow.spec.ts
│   └── semantic-search.spec.ts
│
├── playwright.config.ts
├── .github/workflows/ci.yml                     # Lint + test + build + **E2E**
├── PLAN.md                                      # Original architecture plan
├── package.json                                 # Monorepo root (workspaces + `test:e2e` scripts)
├── tsconfig.base.json
└── README.md
```

---

## 🩺 Health Check

```bash
# Backend
curl http://localhost:3001/api/v1/health
# → {"status":"ok","timestamp":"...","version":"1.0.0"}

# Postgres (extensions loaded)
docker exec dd_postgres psql -U postgres -d direct_democracy -c \
  "SELECT extname FROM pg_extension WHERE extname IN ('vector','postgis');"

# Redis
docker exec dd_redis redis-cli ping
# → PONG

# Ollama
curl http://localhost:11434/api/tags
# → gemma2:2b, nomic-embed-text
```

---

## 📄 License

MIT

Built with ❤️ for democratic governance.
