# 🏛️ Direct Democracy — Municipal Feedback & Issue Tracker

A full-stack civic engagement platform enabling citizens to report issues, vote on priorities, and participate in local democracy. Powered by Angular 18, Express.js 5, PostgreSQL, and local AI via Ollama + Gemma 2B.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Roles & Features](#roles--features)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Running the App](#running-the-app)
- [Demo Accounts](#demo-accounts)
- [API Endpoints](#api-endpoints)
- [AI Integration](#ai-integration)
- [Database](#database)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## 🛠 Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | Angular 18 | Standalone components, Signals, @if/@for control flow |
| **Backend** | Express.js 5 | TypeScript, layered architecture (controllers → services → Prisma) |
| **Database** | PostgreSQL 16 | Dockerized, 23 tables with full relational schema |
| **ORM** | Prisma | Type-safe database access, migrations, studio |
| **AI Engine** | Ollama + Gemma 2B | Local CPU inference for categorization, priority, sentiment, summaries |
| **Auth** | JWT + Refresh Tokens | 15-min access tokens, 7-day httpOnly cookie refresh tokens |
| **Monorepo** | npm workspaces | `/apps` (frontend, backend) + `/packages` (shared-types) |
| **Infrastructure** | Docker Compose | PostgreSQL 16 + Redis 7 |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Angular 18 SPA                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │ Dashboards│ │  Issues  │ │   AI Chat │  │
│  │  Module  │ │ (10 roles)│ │  Module  │ │   Widget  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └────────────┴────────────┴──────────────┘        │
│                    HTTP + JWT                            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                   Express.js 5 API                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │  Issues  │ │   Users  │ │ AI Routes │  │
│  │  Routes  │ │  Routes  │ │  Routes  │ │ (6 eps)   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │            │            │              │         │
│  ┌────┴────────────┴────────────┴──────────────┴─────┐  │
│  │              Services (Business Logic)             │  │
│  └────────────────────┬──────────────────────────────┘  │
│                       │                                  │
│  ┌────────────┐  ┌────┴─────┐  ┌────────────────────┐  │
│  │ Ollama/Gemma│  │  Prisma  │  │  Middleware (RBAC)  │  │
│  │  AI Service │  │  Client  │  │  Auth / Validate    │  │
│  └────────────┘  └────┬─────┘  └────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    Infrastructure                         │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ PostgreSQL 16 │  │ Redis 7  │  │ Ollama + Gemma 2B │  │
│  │  (Docker)     │  │ (Docker) │  │  (Local CPU)      │  │
│  └──────────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 👥 Roles & Features

### 10 Roles

| Role | Description | Dashboard Color |
|------|-------------|----------------|
| **Super Admin** | Full system control, user management, settings | 🔴 Deep Red |
| **Mayor** | City-wide analytics, resolutions, announcements | 🔵 Royal Blue |
| **Department Head** | Manages department issues, staff, budget | 🟢 Forest Green |
| **Council Member** | Constituent issues, resolution voting, meetings | 🟣 Purple |
| **Staff / Agent** | Handles assigned issues, status updates, field notes | 🟠 Orange |
| **Ward Rep** | Neighborhood feedback, community events | 🔵 Teal |
| **Citizen** | Report issues, vote, participate in forums | 🔵 Sky Blue |
| **Volunteer** | Community projects, events, observations | 🟡 Amber |
| **Auditor** | Audit trails, compliance, reports | ⚫ Slate Gray |
| **Media** | Public statistics, trending issues, press reports | 🔵 Indigo |

### 30 Features

- **Issue Management:** Submission, tracking, smart routing, priority queue, bulk management, templates
- **AI-Powered:** Auto-categorization, priority scoring, sentiment analysis, summaries, chatbot, trend detection
- **Democratic:** Upvoting, community polls, resolution voting, referendum tracker
- **Communication:** Comments, notifications, announcements, direct messaging
- **Analytics:** Dashboard analytics, heat maps, report export, transparency portal
- **Administration:** User management, department/ward management, audit trail, custom dashboards
- **Community:** Forums, event calendar

---

## ⚡ Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Docker** ≥ 20.x
- **4+ GB RAM** (for Gemma 2B model)

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

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
docker-compose -f docker/docker-compose.yml up -d
```

Verify containers are running:

```bash
docker ps
```

### 4. Set up database

```bash
cd apps/backend
cp .env.example .env   # or use the provided .env

# Generate Prisma client
npx prisma generate

# Push schema to database (creates all 23 tables)
npx prisma db push

# Seed with sample data (16 users, 8 issues, 8 departments, 6 wards)
npx tsx src/db/seed.ts
```

### 5. Install Ollama + Gemma 2B (AI features)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama server
ollama serve &

# Pull Gemma 2B model (~1.6 GB download)
ollama pull gemma2:2b
```

Verify the model is available:

```bash
curl http://localhost:11434/api/tags
```

### 6. Install Angular CLI (optional, for ng commands)

```bash
npm install -g @angular/cli
```

---

## 🏃 Running the App

### Start everything at once:

```bash
# From the project root
npm run dev
```

This starts both:
- **Backend API** → `http://localhost:3001`
- **Frontend** → `http://localhost:4200`

### Or start individually:

```bash
# Terminal 1 — Backend
cd apps/backend
npm run dev

# Terminal 2 — Frontend
cd apps/frontend
npm start
```

### Open in browser:

```
http://localhost:4200
```

---

## 🔑 Demo Accounts

All accounts use password: `password123`

| Role | Email | Dashboard |
|------|-------|-----------|
| Super Admin | `admin@city.gov` | `/admin` |
| Mayor | `mayor@city.gov` | `/mayor` |
| Department Head | `pw.head@city.gov` | `/department` |
| Council Member | `council1@city.gov` | `/council` |
| Staff | `staff1@city.gov` | `/staff` |
| Ward Rep | `wardrep1@city.gov` | `/ward` |
| Citizen | `citizen1@email.com` | `/citizen` |
| Volunteer | `volunteer1@email.com` | `/volunteer` |
| Auditor | `auditor@city.gov` | `/auditor` |
| Media | `press@herald.com` | `/media` |

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login (returns JWT) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout (clears refresh token) |
| GET | `/api/v1/auth/profile` | Get current user profile |

### Issues

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/issues` | Optional | List issues (paginated, filterable) |
| GET | `/api/v1/issues/stats` | ✅ | Dashboard statistics |
| GET | `/api/v1/issues/:id` | Optional | Get issue detail |
| POST | `/api/v1/issues` | ✅ | Create new issue |
| PATCH | `/api/v1/issues/:id/status` | Staff+ | Update issue status |
| PATCH | `/api/v1/issues/:id/assign` | Admin+ | Assign issue |
| POST | `/api/v1/issues/:id/upvote` | ✅ | Upvote/toggle vote |

### Users (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List users (paginated) |
| GET | `/api/v1/users/stats` | User statistics |
| GET | `/api/v1/users/:id` | Get user detail |
| PATCH | `/api/v1/users/:id` | Update user |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications` | Get user notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| PATCH | `/api/v1/notifications/read-all` | Mark all as read |

### AI (Requires Ollama + Gemma 2B)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/categorize` | Auto-categorize issue text |
| POST | `/api/v1/ai/priority` | Score issue urgency (1-5) |
| POST | `/api/v1/ai/sentiment` | Analyze feedback sentiment |
| POST | `/api/v1/ai/summary` | Generate executive summary |
| POST | `/api/v1/ai/trends` | Detect emerging trends |
| POST | `/api/v1/ai/chat` | Chatbot conversation |

### Departments & Wards

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/departments` | Public | List departments |
| POST | `/api/v1/departments` | Admin | Create department |
| GET | `/api/v1/departments/wards` | Public | List wards |
| POST | `/api/v1/departments/wards` | Admin | Create ward |

---

## 🤖 AI Integration

The platform uses **Ollama** with the **Gemma 2B** model running locally on CPU. All AI processing happens on-premise — no data leaves your server.

### AI Endpoints Usage

```bash
# Categorize an issue
curl -X POST http://localhost:3001/api/v1/ai/categorize \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "There is a massive pothole on Main Street causing car damage"}'

# Response: {"category": "INFRASTRUCTURE", "confidence": 0.92}

# Score priority
curl -X POST http://localhost:3001/api/v1/ai/priority \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Water main break flooding the street", "category": "UTILITIES"}'

# Response: {"score": 5, "justification": "Critical safety hazard..."}

# Chat with CivicAssist
curl -X POST http://localhost:3001/api/v1/ai/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "How do I report a pothole?"}]}'
```

---

## 🗄 Database

The PostgreSQL database contains **23 tables**:

| Category | Tables |
|----------|--------|
| **Auth** | User, RefreshToken |
| **Geography** | Ward, Department, DepartmentWard |
| **Issues** | Issue, IssueTag, StatusHistory, Attachment |
| **Voting** | Vote, Poll, PollOption, Survey, SurveyQuestion, SurveyResponse |
| **Communication** | Comment, Message, Notification, Announcement |
| **Events** | Event, EventRSVP |
| **Governance** | Resolution |
| **Audit** | AuditLog |

### Database Management

```bash
# Open Prisma Studio (visual database browser)
cd apps/backend
npx prisma studio

# Reset database (⚠️ destroys all data)
npx prisma db push --force-reset

# Re-seed after reset
npx tsx src/db/seed.ts
```

---

## ⚙️ Environment Variables

### Backend (`apps/backend/.env`)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/direct_democracy

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret-key
REFRESH_TOKEN_EXPIRES_IN=7d

# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma2:2b

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200
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
│   ├── frontend/                    # Angular 18 SPA
│   │   └── src/app/
│   │       ├── core/                # Auth service, API service, guards, interceptors
│   │       ├── shared/              # Layout component (sidebar + topbar)
│   │       └── features/
│   │           ├── auth/            # Login, Register, Unauthorized
│   │           ├── admin/           # Super Admin dashboard
│   │           ├── mayor/           # Mayor dashboard
│   │           ├── department/      # Department Head dashboard
│   │           ├── council/         # Council Member dashboard
│   │           ├── staff/           # Staff/Agent dashboard
│   │           ├── ward/            # Ward Rep dashboard
│   │           ├── citizen/         # Citizen dashboard
│   │           ├── volunteer/       # Volunteer dashboard
│   │           ├── auditor/         # Auditor dashboard
│   │           ├── media/           # Media/Press dashboard
│   │           └── issues/          # Issue list + detail views
│   │
│   └── backend/                     # Express.js 5 API
│       └── src/
│           ├── config/              # Environment configuration
│           ├── db/                  # Prisma client + seed script
│           ├── middleware/          # Auth, RBAC, validation, error handler
│           ├── routes/              # API route definitions
│           ├── services/            # Business logic (auth, issues, users, notifications)
│           ├── ai/                  # Ollama/Gemma AI service
│           └── index.ts             # Express app entry point
│
├── packages/
│   └── shared-types/                # TypeScript interfaces shared between frontend & backend
│       └── src/index.ts             # 10 enums, 30+ interfaces
│
├── docker/
│   └── docker-compose.yml           # PostgreSQL 16 + Redis 7
│
├── PLAN.md                          # Architecture plan document
├── package.json                     # Monorepo root (npm workspaces)
├── tsconfig.base.json               # Shared TypeScript config
└── .gitignore
```

---

## 🧪 Health Check

Verify all services are running:

```bash
# Backend API
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"...","version":"1.0.0"}

# PostgreSQL
docker exec dd_postgres pg_isready
# → accepting connections

# Ollama
curl http://localhost:11434/api/tags
# → {"models":[{"name":"gemma2:2b",...}]}

# Redis
docker exec dd_redis redis-cli ping
# → PONG
```

---

## 📄 License

MIT

---

Built with ❤️ for democratic governance.
