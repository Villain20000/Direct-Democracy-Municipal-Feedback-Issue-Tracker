# 🔍 Missing Features — Gap Analysis & Implementation Plan

> Audited against `PLAN.md` (the 30-feature spec + dashboard widget spec) and `README.md`
> (v1.5 / v1.6 claims). Every gap below was verified **in this repository**, not inferred
> from the docs. Last verified: 2026-10-06.

---

## 0. Verification snapshot (baseline health)

| Check | Command | Result |
|-------|---------|--------|
| Backend typecheck | `cd apps/backend && npx prisma generate && npx tsc --noEmit` | ✅ 0 errors |
| Frontend build | `cd apps/frontend && npx ng build --configuration=development` | ✅ exit 0 |
| Backend unit tests | docker `postgres`+`redis` up → `npx prisma migrate deploy` → `npx jest` | ✅ **19/19 suites, 260/260 tests pass** |
| Frontend unit tests | `ng test --watch=false --browsers=ChromeHeadlessCI` | ⚠️ test bundle compiles, but **cannot run here**: no Chrome binary (`CHROME_BIN` unset). Environment limit, not a code failure. |
| Playwright E2E | 7 specs in `/e2e` | not run here (needs browsers + full stack + Ollama) |

> Setup note: the repo ships only `.env.example`; `apps/backend/.env` must be created
> (`cp .env.example .env`) or Prisma fails with `P1012: Environment variable not found`.
> After `prisma generate`, typecheck is clean — without it, ~40 spurious `Prisma` type errors appear.

**Bottom line:** the code that exists is healthy. The gaps are *missing/documented-but-unimplemented
features*, not bugs in shipped code (with one important exception: SLA tracking, see P0-1).

---

## 1. P0 — Backend features that are dead or unreachable

### P0-1. SLA tracking never initialises (functionally dead)
- **Spec:** PLAN §16 feature B6 — "response / resolution timer, breach detection, cron + dashboard widget".
- **Evidence:** `slaTrackingService.upsertForIssue()` (`apps/backend/src/services/sla-tracking.service.ts:34`)
  is **only ever called from tests** (`__tests__/feature-sweep.test.ts`). No production call site exists
  (`issue.service.ts` only calls `markFirstResponse`/`markResolved` at lines 220–222, wrapped in
  `.catch(() => {})`, which silently swallows the `P2025` "row does not exist" error).
  Consequence: `GET /issues/:id/sla` → `null`, `GET /sla/breached` → `[]`, `POST /sla/scan-breaches`
  scans nothing, and `POST /ai/sla-risk` always falls back to the default 72 h heuristic.
- **Also missing:** the breach-scan cron. `apps/backend/src/worker.ts` schedules 4 crons
  (weekly summary, ward digest, seasonal forecast, FAQ) — **no SLA scan**, despite
  `sla-tracking.service.ts:86` saying "designed to be invoked by a cron tick (not yet wired)".
- **Fix:** upsert on issue create (and on priority change, once P0-2 lands), add
  `cron.schedule('*/15 * * * *', scanForBreaches)` to `worker.ts`, surface `GET /sla/breached`
  as a widget (dept head + admin dashboards).
- **Acceptance:** create an issue → `SlaTracking` row exists with correct `dueAt`; breach scan
  flips `breached=true` on an overdue row; dashboard shows breached count; unit tests cover the cron path.

### P0-2. No manual priority override (PLAN feature 4 half-missing)
- **Spec:** feature 4 — "AI-scored priority ranking (1-5) **with manual override capability**".
- **Evidence:** no `PATCH /issues/:id/priority` (or generic `PATCH /issues/:id`) in
  `routes/issue.routes.ts`; `bulkUpdate` accepts only status/assignee/department/coords
  (`services/issue.service.ts:228-241`); the frontend has no API method for it.
  SLA service comments explicitly anticipate "priority change" that can never happen.
- **Fix:** add `PATCH /issues/:id` (priority, title, description) with staff+ RBAC + audit log +
  `slaTrackingService.upsertForIssue` on priority change; add an edit control on
  `features/issues/issue-detail.component.ts`; allow `priority` in bulk updates.
- **Acceptance:** staff can set priority 1–5; SLA due date recalculates; audit row written; test coverage.

### P0-3. Saved searches — backend complete, **zero frontend**
- **Spec:** PLAN §16 feature B3 — full CRUD + alert pipeline.
- **Evidence:** backend `GET/POST/PATCH/DELETE /users/me/saved-searches`
  (`routes/feature-sweep.routes.ts:155-199`) + `SavedSearch`, `SavedSearchEmbedding`,
  `SavedSearchAlert` models + `saved-search-alert.service.ts` (fires after each embed).
  `api.service.ts` has **no** saved-search method; no component references it. The search UI
  (`issue-list.component.ts`) has no "Save this search" button.
- **Fix:** `saveSearch()/listSavedSearches()/deleteSavedSearch()` in `api.service.ts`,
  "💾 Save search" chip row above the issue filters, manage list in settings page, EN/EL strings.
- **Acceptance:** save a filter combo → appears after reload → one click re-applies it → alert
  notification arrives when a new issue matches.

### P0-4. Assignment history — backend complete, no frontend
- **Spec:** PLAN §16 feature B7 — `GET /issues/:id/assignment-history` (`feature-sweep.routes.ts:331`).
- **Evidence:** no reference anywhere in `apps/frontend/src`.
- **Fix:** "History" section on `issue-detail.component.ts` (who/when/from→to), staff+ only.
- **Acceptance:** assigning twice renders a reverse-chronological timeline.

### P0-5. PostGIS spatial endpoints are never called by the UI
- **Spec:** v1.5 spatial layer (PLAN §13) — radius / polygon / nearest + "map heat layer" (README).
- **Evidence:** frontend grep for `spatial/issues|issues/within|in-polygon|nearest` → **0 matches**.
  The map page loads `GET /issues?pageSize=100` client-side
  (`issues-map-page.component.ts:227`) and draw-area goes through `/issues/summarize-area`
  (which internally falls back to a JS bounding box) instead of `/spatial/issues/in-polygon`.
  Citizens have no radius/nearby filter at all (`/citizen/nearby` → issue **list**, not map).
- **Fix:** add `spatialWithin()/inPolygon()/nearest()` to `api.service.ts`; add a radius slider +
  "issues near me" toggle and ward-boundary filter to `issues-map-page`; point draw-area at the
  spatial endpoint first with the existing fallback; add a citizen "Nearby map" widget.
- **Acceptance:** with >100 issues in the DB, the map still shows all in-radius results (server-side
  query); `EXPLAIN` uses the GIST index; E2E `map.spec.ts` extended for radius search.

---

## 2. P1 — Flagship features documented but not implemented

### P1-6. Geographic heat map (PLAN feature 22, README "map heat layer", Ward + Media widgets)
- **Evidence:** `media-dashboard.component.ts:165-176` renders a **static illustration placeholder**
  labeled "Heat Map" that only links to the map page; `issues-map-page` draws plain `L.circleMarker`s;
  no `leaflet.heat` (or equivalent) anywhere; no ward/district drill-down.
- **Fix:** add `leaflet.heat` (or Leaflet circle-based density), a `heat` layer toggle on the map
  page (weighted by priority/upvotes), ward-level drill-down via `GET /spatial/issues/in-polygon`
  with ward boundaries (see P1-11), real heat preview on Ward + Media dashboards.
- **Acceptance:** toggling "Heat layer" renders a density overlay from server data; clicking a ward
  zooms + filters; Media/Ward widgets embed the live layer instead of an image placeholder.

### P1-7. PDF report export (PLAN feature 23 "Report Export (PDF/CSV)", Auditor "Report generator (PDF/CSV)")
- **Evidence:** only CSV exists — `GET /reports/issues.csv`, `GET /reports/audit.csv`
  (`routes/reports.routes.ts`); issue detail uses `window.print()`
  (`issue-detail.component.ts:787`). No jsPDF/pdfmake/puppeteer dependency.
- **Fix:** server-side PDF (template + table; `pdfkit`/`puppeteer`) for issues report, audit report,
  weekly briefing, and resolution dossier; "Download PDF" buttons on analytics/auditor/media pages;
  keep CSV for raw data.
- **Acceptance:** authenticated role can download a branded PDF with filters applied; E2E asserts
  a non-empty `application/pdf` response; both endpoints RBAC-tested.

### P1-8. Charts & trend graphs — `chart.js` is installed but never imported
- **Evidence:** `apps/frontend/package.json` lists `chart.js ^4.4.0`; grep for `chart.js|Chart(` →
  **0 matches**. "Charts" today are CSS width-bars (`analytics-page.component.ts` = 4 KPI cards +
  one category bar list). Missing per PLAN §10: department performance comparison, ward issue
  distribution pie, **sentiment trend line (30d)**, staff workload chart, category donut,
  resolution-time trend, historical comparisons (Media).
- **Fix:** a shared `<app-chart>` wrapper (line/bar/doughnut, theme-aware, lazy `Chart.register`);
  wire: analytics page (category donut + status trend), admin (dept comparison + ward pie),
  mayor (sentiment trend from `/ai/sentiment` sampled weekly), department (workload from real
  `getUsers` data — see P1-9), auditor (resolution timeline).
- **Acceptance:** at least 6 planned widgets render real API data; charts are EN/EL labelled and
  render in dark mode.

### P1-9. Budget management — no model, dashboards show hardcoded mock data
- **Spec:** PLAN §10 — Mayor "Budget allocation vs spending chart", Dept Head "Department budget
  tracker", Council "Budget impact reports", Auditor "Budget expenditure audit trail"; README role
  table says Dept Head "manages … budget".
- **Evidence:** only `Department.budget Decimal?` exists (`schema.prisma:134`). There is **no**
  Budget/Expense model, migration, route, or service. `department-dashboard.component.ts:61-73`
  renders a **hardcoded** `$5,000,000` total + fixed `budgetCategories` array (lines 156-165), and
  `staffWorkload` (lines 150-154) is also fake (`'Tom Wilson', …`) even though real staff are loaded.
  Media's "Budget Transparency" download (`media-dashboard.component.ts:187`) is just the issues CSV.
- **Fix:** `BudgetLine` + `Expense` models (deptId, fiscal year, category, amount), CRUD
  (dept head + admin), seeded demo data, spend-vs-budget chart on dept/mayor dashboards, expense
  CSV/PDF export for auditor, replace mock arrays with real `getUsers` workload data.
- **Acceptance:** dept head records an expense → remaining budget updates → chart + portal
  "Budget Transparency" show real numbers; auditor export lists expenses.

### P1-10. Escalation workflow (Staff widget) — entirely absent
- **Evidence:** `IssueStatus` enum has no `ESCALATED` value (`schema.prisma:236-243`); grep for
  `escalat` in `apps/backend/src` → **0 matches**. The Dept dashboard "Escalated" KPI is a proxy
  (`escalatedCount = issues.filter(priority >= 4)` — `department-dashboard.component.ts:181-183`).
- **Fix:** decide semantics (recommend: keep enum stable, add `escalatedTo`/`escalationReason`
  fields + `POST /issues/:id/escalate` → notifies department head + mayor + creates audit row) vs.
  adding an `ESCALATED` status (schema migration + status pipeline UI). Add "Escalate" button for
  staff, escalated badge/queue on dept & mayor dashboards.
- **Acceptance:** staff escalates → target roles notified + audit trail + dashboard counter reflects
  real escalations (not priority heuristic); tests for RBAC and notification.

### P1-11. Ward boundaries & department↔ward hierarchy are dead schema
- **Evidence:** `Ward.boundary Json?` (GeoJSON) is accepted by `department.validators.ts:15` but
  **never read or written by any service**; `DepartmentWard` join table is referenced only in test
  cleanup (`__tests__/helpers.ts:132`). `routingService.resolveDepartmentId(category)` is
  category→code only (`routing.service.ts:16-23`) — PLAN feature 3 says "category **+ ward/district**".
- **Fix:** admin UI to draw/edit ward polygons on Leaflet (`admin-wards-page`), persist GeoJSON,
  use boundary in `ST_Contains` queries (map filter, portal ward stats, heat drill-down),
  manage Department↔Ward assignments, and extend routing: `ward → DepartmentWard → dept` with
  category fallback.
- **Acceptance:** creating/editing a ward with a drawn polygon persists and filters issues by ward
  server-side; new issues in a ward route through the hierarchy; routing tests cover both paths.

### P1-12. Comment threading UI + @mentions (PLAN feature 17)
- **Evidence:** backend fully supports replies (`Comment.parentId`, `comment.service.ts` returns
  `children`), but the frontend has **no reply affordance** (grep `parentId|reply` in issue-detail → 0).
  @mentions: no parser anywhere; `notification.service.ts:13` maps an `ISSUE_MENTION` type that is
  **never emitted**.
- **Fix:** reply button + nested rendering on `issue-detail`, `parentId` in `createComment`;
  parse `@username` on submit → resolve users → emit `ISSUE_MENTION` notifications (+ email channel).
- **Acceptance:** two-level thread renders; mentioning a user creates their notification and
  respects notification prefs; tests for both.

### P1-13. Notification types defined but never emitted
- **Evidence:** `notification.service.ts:11-17` maps `VOTE_RECEIVED`, `ANNOUNCEMENT`, `EVENT`
  (and `ISSUE_MENTION`); `notification-preference.service.ts:8-9` lists them — but **no code path
  ever creates them**: announcements don't notify anyone, poll/resolution/referendum votes don't
  notify, event RSVP changes don't notify. Email coverage is also narrow (reporter-only on
  create/status/comment — `sendEmail: true` at `issue.service.ts:208,361`).
- **Fix:** emit ANNOUNCEMENT on publish (all users, respecting prefs), VOTE_RECEIVED on
  poll/resolution/referendum vote (to creator/subject), EVENT on RSVP change/new event in ward;
  extend email fan-out with throttling; document which types are in-app-only by default.
- **Acceptance:** publishing an announcement lands in recipients' bells (and email when enabled);
  preference toggles are honoured; tests per type.

### P1-14. Staff Kanban board (PLAN §10 Staff widget)
- **Evidence:** `staff-tasks-page.component.ts` is a flat list; grep `kanban|drag` in staff
  feature → 0 matches. Status pipeline exists server-side (`/issues/:id/status`).
- **Fix:** drag-and-drop columns (Submitted → Acknowledged → In Progress → PENDING_REVIEW →
  Resolved) reusing `updateIssueStatus`, optimistic updates, WIP counts, keyboard-accessible moves.
- **Acceptance:** dragging a card updates status + status history + notification; works on mobile.

---

## 3. P2 — Partial CRUD, role mismatches, widget-level gaps

| # | Gap | Evidence | Fix |
|---|-----|----------|-----|
| P2-15 | **Department & Ward management is create-only** (PLAN feature 26: "configure … boundaries, hierarchies") | `department.routes.ts` has only `GET/POST /` + `GET/POST /wards` — no PATCH/DELETE; admin pages only create | Add update/delete routes (+ reassignment guards), edit/delete UI on `admin-departments`/`admin-wards`, boundary editor (with P1-11) |
| P2-16 | **Ward Rep cannot create polls** — matrix says ✅ | `poll.routes.ts:35` `authorize(SUPER_ADMIN, MAYOR, COUNCIL_MEMBER)`; same for surveys? (verify) | Add `WARD_REP` (and confirm volunteer/citizen create rights per matrix) + route guards on FE |
| P2-17 | **Announcement creator roles mismatch**: matrix allows Media ✅, backend allows `DEPARTMENT_HEAD`/`STAFF` but not `MEDIA` | `announcement.routes.ts:35` | Align RBAC with matrix (either direction) and document |
| P2-18 | **Bulk management roles**: matrix = Admin+Dept Head only; backend also allows MAYOR/STAFF | `issue.routes.ts:85` | Decide: tighten or update matrix (recommend: keep STAFF, update matrix) |
| P2-19 | **Media**: no meeting-minutes archive, no RSS/API-access info, "historical comparisons" absent | `media-dashboard.component.ts` (downloads are 3× issues CSV with different filenames) | Minutes = `Event(type=MEETING)` archive page or new `MeetingMinute` model; add "Public API / RSS" help card; historical comparison chart from P1-8 |
| P2-20 | **Auditor**: no entity-relationship graph, no budget expenditure audit trail, no resolution timeline analysis | `auditor-dashboard.component.ts` — logs/anomalies/quality scores only (those ✅) | ER graph (schema-driven, lightweight SVG), depends on P1-9 budget; resolution timeline chart |
| P2-21 | **Super Admin**: "system health" is a single `fetch('/health')` toggle; no response-time/queue metrics | `admin-dashboard.component.ts:175` | Add p95 latency, BullMQ queue depth, Ollama health, Redis status (all fetchable already) |
| P2-22 | **Citizen "nearby issues on interactive map"** widget routes to a list | `app.routes.ts` `/citizen/nearby → issue-list.component` | Point to map page with radius preset (with P0-5) |
| P2-23 | **Email notifications partial** — assignment/vote/mention emails mostly absent | see P1-13 | covered there |
| P2-24 | Backend-only endpoints with no UI: `GET /issues/:id/subscribers`, `GET/DELETE share-links` management | `feature-sweep.routes.ts:82-154` | Subscriber count on issue detail; "manage share links" list with revoke |

---

## 4. P3 — Documentation & test-suite gaps

1. **README says E2E = "3 specs (auth, issue flow, semantic search)"** — there are **7**
   (`auth`, `issue-flow`, `legislation-kb`, `map`, `portal`, `semantic-search`, `issue-subscribe`).
2. **README claims a "map heat layer"** under Spatial features — not implemented (P1-6).
3. **README claims "ivfflat HNSW indexes"** — these are two different index types; state the one actually created.
4. **PLAN §16 calls it a "10-feature sweep" but tables only 7 families** — reconcile naming.
5. **PLAN §2 structure drift**: no `layouts/` dir (layout lives in `shared/layout.component.ts`),
   no `models/` (Prisma lives in `prisma/`), controllers were merged into routes/services.
   Update the plan or add a "reconciliation" section (§17 already does this for roles — extend it).
6. **Frontend unit tests are thin** — 6 spec files, all core/util/i18n; **zero component tests** for
   dashboards, issue flows, offline queue. Add specs for any component built in this plan.
7. **Seed data claim** ("16 users, 8 issues, 8 departments, 6 wards") — re-verify counts or fix README.
8. **Playwright specs don't cover** new-in-this-plan features (heat layer, PDF, saved searches, spatial filters) — extend `/e2e`.

---

## 5. Implementation plan (sequenced)

> Each phase ends with a green gate: `tsc --noEmit`, `ng build`, `jest` (260+ tests),
> plus the new tests written for that phase.

### Phase 1 — "Wire what already exists" (highest ROI, mostly FE + small BE)
1. P0-1 SLA init on create + breach cron + breached widget (+ tests)
2. P0-2 `PATCH /issues/:id` priority override + UI (+ SLA recalc + audit)
3. P0-3 Saved-search UI (+ E2E)
4. P0-4 Assignment-history timeline on issue detail
5. P0-5 Spatial FE integration (radius/nearby/in-polygon/draw → real PostGIS endpoints)
- **Gate:** all 260 existing tests + ~25 new tests pass; map works with >100 issues.

### Phase 2 — "Documented flagships"
6. P1-6 Heat layer + ward drill-down (depends on Phase 3 boundaries for drill-down; ship layer first)
7. P1-7 PDF export (issues, audit, weekly briefing)
8. P1-8 Chart.js wrapper + 6 planned widgets (incl. sentiment trend)
9. P1-9 Budget model + endpoints + real dashboards (replaces mock arrays)
- **Gate:** each feature reachable from its role dashboard, covered by unit + E2E tests, EN/EL strings added.

### Phase 3 — "Data model & workflow depth"
10. P1-11 Ward boundaries + DepartmentWard management + ward-aware routing
11. P1-10 Escalation workflow
12. P1-12 Comment threading UI + @mentions
13. P1-13 Announcement/event/vote notifications (in-app + optional email)
14. P1-14 Staff Kanban
- **Gate:** migration is reversible/seeded; routing has fallback tests; notifications respect prefs.

### Phase 4 — "Role dashboard parity vs PLAN §10"
15. P2-15 department/ward CRUD · P2-16..18 RBAC/matrix alignment
16. P2-19 media (minutes, API info, comparisons) · P2-20 auditor (ER graph, timelines) ·
    P2-21 admin health · P2-22 citizen nearby map · P2-24 subscriber/share-link UI
- **Gate:** every PLAN §10 widget is either implemented or explicitly marked "won't do" in §17.

### Phase 5 — "Docs & tests catch-up"
17. All P3 items: README/PLAN corrections, component specs, E2E extensions, CI artifact checks.

---

## 6. What's already solid (no action needed)

- Auth (JWT + refresh + forgot/reset + RBAC guards), 10 role dashboards, PWA offline queue + icons
- Issue CRUD, templates, smart search (semantic + AI), duplicates, bulk ops, category routing
- Full AI surface (categorize/priority/sentiment/summary/trends/chat+SSE RAG/duplicates/translate/…)
- Legislation KB (upload, chunk, embed, retrieve, citations), BullMQ embed worker + backfill + crons
- Polls, resolutions, referendums, surveys, forums (with AI moderation), events/RSVP, messaging,
  announcements, audit trail + anomalies, CSV exports, transparency portal, share links, subscriptions,
  internal notes, notification prefs, activity feed, civic score, command palette, i18n (EN/EL),
  ward digests, weekly summaries, seasonal forecasts, FAQ generation
- Verification: backend typecheck clean, frontend builds, **260/260 backend tests green**
