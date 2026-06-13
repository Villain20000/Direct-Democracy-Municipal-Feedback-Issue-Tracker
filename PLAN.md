# Direct Democracy - Municipal Feedback & Issue Tracker

## Full-Stack Architecture Plan

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Angular | 18+ (Standalone Components, Signals, @if/@for) |
| **Backend** | Express.js | 5.x (TypeScript) |
| **Database** | PostgreSQL | 16 (via Docker) |
| **ORM** | Prisma | Latest |
| **AI Engine** | Ollama + Gemma 2B | Local CPU inference |
| **Auth** | JWT + Refresh Tokens | Access (15m) + Refresh (7d, httpOnly cookie) |
| **Monorepo** | npm workspaces | `/apps` + `/packages` structure |

---

## 2. Monorepo Structure

```
Direct-Democracy-Municipal-Feedback-Issue-Tracker/
├── apps/
│   ├── frontend/                  # Angular 18 SPA
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/          # Auth, guards, interceptors, services
│   │   │   │   ├── shared/        # Reusable UI components (design system)
│   │   │   │   ├── features/      # Feature modules
│   │   │   │   │   ├── auth/      # Login, Register, Forgot Password
│   │   │   │   │   ├── citizen/   # Citizen dashboard
│   │   │   │   │   ├── admin/     # Super Admin dashboard
│   │   │   │   │   ├── mayor/     # Mayor dashboard
│   │   │   │   │   ├── department/# Department Head dashboard
│   │   │   │   │   ├── council/   # Council Member dashboard
│   │   │   │   │   ├── staff/     # Staff/Agent dashboard
│   │   │   │   │   ├── ward/      # Ward Rep dashboard
│   │   │   │   │   ├── volunteer/ # Volunteer dashboard
│   │   │   │   │   ├── auditor/   # Auditor dashboard
│   │   │   │   │   └── media/     # Media/Press dashboard
│   │   │   │   └── layouts/       # Dashboard layouts per role
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   └── styles/
│   │   └── angular.json
│   │
│   └── backend/                   # Express.js 5 API
│       ├── src/
│       │   ├── controllers/       # Route handlers
│       │   ├── services/          # Business logic
│       │   ├── middleware/        # Auth, RBAC, validation, error
│       │   ├── routes/            # API v1 route definitions
│       │   ├── models/            # Prisma schema & client
│       │   ├── ai/                # Ollama/Gemma integration
│       │   ├── config/            # Environment config
│       │   └── utils/             # Helpers, validators
│       └── package.json
│
├── packages/
│   └── shared-types/              # TypeScript interfaces shared between frontend & backend
│       └── src/
│           ├── user.types.ts
│           ├── issue.types.ts
│           ├── feedback.types.ts
│           └── ...
│
├── docker/
│   ├── docker-compose.yml         # PostgreSQL + optional services
│   └── Dockerfile.*
│
├── package.json                   # Workspace root
├── tsconfig.base.json
└── README.md
```

---

## 3. The 10 Roles

### Role 1: Super Admin
**Description:** Full system control. Manages all users, roles, departments, wards, system settings, and has unrestricted access to all data and features.
**Dashboard Color:** Deep Red (#DC2626)

### Role 2: Mayor / City Administrator
**Description:** Top elected/appointed official. Views city-wide analytics, approves major resolutions, communicates with citizens, and oversees department performance.
**Dashboard Color:** Royal Blue (#2563EB)

### Role 3: Department Head
**Description:** Manages a specific department (e.g., Public Works, Sanitation, Public Safety). Assigns staff, tracks department-specific issues, manages budgets, and generates reports.
**Dashboard Color:** Forest Green (#16A34A)

### Role 4: Council Member
**Description:** Elected representative for a district/ward. Tracks issues in their area, votes on resolutions, attends meetings, and communicates with constituents.
**Dashboard Color:** Purple (#7C3AED)

### Role 5: Staff / Agent
**Description:** Front-line municipal worker. Handles assigned issues, updates statuses, communicates with citizens, documents field work, and escalates when needed.
**Dashboard Color:** Orange (#EA580C)

### Role 6: Ward / District Representative
**Description:** Community-level representative. Aggregates neighborhood feedback, organizes local events, bridges communication between citizens and council.
**Dashboard Color:** Teal (#0D9488)

### Role 7: Citizen / Resident
**Description:** General public user. Submits issues, votes on priorities, comments on discussions, tracks their submitted issues, and participates in community forums.
**Dashboard Color:** Sky Blue (#0284C7)

### Role 8: Volunteer
**Description:** Community volunteer helping with civic projects. Joins cleanup events, reports neighborhood observations, and assists with community surveys.
**Dashboard Color:** Amber (#D97706)

### Role 9: Auditor / Inspector
**Description:** Oversight and compliance role. Reviews audit trails, inspects resolution quality, ensures transparency, generates compliance reports, and flags irregularities.
**Dashboard Color:** Slate Gray (#475569)

### Role 10: Media / Press
**Description:** Journalist or media outlet with read-only analytical access. Views public statistics, downloads reports, tracks trending issues, and accesses press releases.
**Dashboard Color:** Indigo (#4F46E5)

---

## 4. The 30 Features

### Issue Management (Features 1-6)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 1 | **Issue Submission** | Citizens submit issues with title, description, category, location (map pin), photos, and urgency level | Citizen, Volunteer, Staff, Ward Rep |
| 2 | **Issue Tracking Dashboard** | Real-time tracking with status pipeline: Submitted → Acknowledged → In Progress → Resolved → Verified | All Roles |
| 3 | **Smart Routing & Assignment** | Auto-assign issues to correct departments based on category + ward/district | Admin, Department Head, Staff |
| 4 | **Priority Queue** | AI-scored priority ranking (1-5) with manual override capability | Department Head, Mayor, Admin |
| 5 | **Bulk Issue Management** | Batch update status, reassign, or close multiple issues | Admin, Department Head |
| 6 | **Issue Templates** | Pre-built templates for common complaints (pothole, noise, graffiti, etc.) | All Roles |

### AI-Powered Features (Features 7-12)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 7 | **AI Auto-Categorization** | Gemma 2B classifies issues into categories: Infrastructure, Public Safety, Sanitation, Utilities, Housing, Environment, Other | All Roles |
| 8 | **AI Priority Scoring** | Gemma 2B analyzes urgency based on text content, assigns score 1-5 with justification | Department Head, Mayor, Admin |
| 9 | **AI Sentiment Analysis** | Gemma 2B gauges public sentiment (Positive/Neutral/Negative) on feedback and comments | Council, Mayor, Auditor |
| 10 | **AI Summary Generation** | Gemma 2B creates executive summaries of issues for council briefings | Mayor, Council, Admin |
| 11 | **AI Chatbot Assistant** | In-app chatbot powered by Gemma for FAQ answers, navigation help, and issue guidance | All Roles |
| 12 | **AI Trend Detection** | Gemma analyzes patterns across issues to identify emerging neighborhood problems | Mayor, Department Head, Admin |

### Voting & Democratic Features (Features 13-16)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 13 | **Issue Upvoting** | Citizens upvote issues to signal community priority; vote counts visible on dashboards | Citizen, Volunteer, Ward Rep |
| 14 | **Community Polls** | Create and vote on municipal polls (e.g., park design, budget allocation preferences) | All Roles (create: Admin, Council, Mayor) |
| 15 | **Resolution Voting** | Council members vote on proposed resolutions with transparent vote tracking | Council, Mayor (tiebreak) |
| 16 | **Referendum Tracker** | Track active and historical referendums with results visualization | All Roles |

### Communication Features (Features 17-20)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 17 | **Comment & Discussion Threads** | Threaded discussions on each issue with @mentions and notifications | All Roles |
| 18 | **Notification System** | In-app + email notifications for status changes, assignments, mentions, and votes | All Roles |
| 19 | **Public Announcements** | Post city-wide announcements visible on all dashboards and the public portal | Admin, Mayor |
| 20 | **Direct Messaging** | Internal messaging between staff, between citizen↔official | All Roles |

### Analytics & Reporting (Features 21-24)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 21 | **Dashboard Analytics** | Role-specific KPIs, charts, graphs, and real-time metrics | All Roles |
| 22 | **Geographic Heat Map** | Map visualization showing issue density by ward/district with drill-down | Admin, Mayor, Department Head, Council |
| 23 | **Report Export (PDF/CSV)** | Generate downloadable reports for issues, budgets, resolutions, and compliance | Admin, Department Head, Auditor, Media |
| 24 | **Transparency Portal** | Public-facing portal showing all issues, resolutions, budgets, and meeting minutes | All Roles (public read) |

### Administration Features (Features 25-28)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 25 | **User Management** | CRUD operations for users with role assignment, activation/deactivation | Admin |
| 26 | **Department & Ward Management** | Configure departments, wards/districts, boundaries, and hierarchies | Admin |
| 27 | **Audit Trail & Compliance** | Immutable log of all actions with timestamp, user, action, and before/after state | Auditor, Admin |
| 28 | **Role-Based Dashboard Layouts** | Each role gets a customized dashboard with relevant widgets, metrics, and shortcuts | All Roles |

### Community Features (Features 29-30)
| # | Feature | Description | Roles |
|---|---------|-------------|-------|
| 29 | **Community Forums** | Public discussion boards organized by ward/district and topic | Citizen, Volunteer, Ward Rep |
| 30 | **Event & Meeting Calendar** | Schedule, RSVP, and track public meetings, hearings, volunteer events | All Roles |

---

## 5. Feature-to-Role Matrix

| Feature | Super Admin | Mayor | Dept Head | Council | Staff | Ward Rep | Citizen | Volunteer | Auditor | Media |
|---------|:-----------:|:-----:|:---------:|:-------:|:-----:|:--------:|:-------:|:---------:|:-------:|:-----:|
| 1. Issue Submission | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 2. Issue Tracking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. Smart Routing | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 4. Priority Queue | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 5. Bulk Management | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 6. Issue Templates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7. AI Categorization | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8. AI Priority Score | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 9. AI Sentiment | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| 10. AI Summary | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 11. AI Chatbot | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 12. AI Trend Detection | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| 13. Issue Upvoting | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14. Community Polls | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 15. Resolution Voting | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 16. Referendum Tracker | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 17. Comments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 18. Notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 19. Announcements | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 20. Direct Messaging | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| 21. Dashboard Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 22. Heat Map | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| 23. Report Export | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 24. Transparency Portal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 25. User Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 26. Dept/Ward Mgmt | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 27. Audit Trail | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 28. Custom Dashboards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 29. Community Forums | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 30. Event Calendar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 6. Database Schema (PostgreSQL + Prisma)

### Core Tables

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// === AUTHENTICATION & USERS ===

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  firstName     String
  lastName      String
  phone         String?
  avatarUrl     String?
  role          UserRole
  isActive      Boolean   @default(true)
  isVerified    Boolean   @default(false)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relationships
  issues        Issue[]           @relation("IssueReporter")
  assignedIssues Issue[]          @relation("IssueAssignee")
  comments      Comment[]
  votes         Vote[]
  surveys       Survey[]
  surveyResponses SurveyResponse[]
  notifications Notification[]
  auditLogs     AuditLog[]
  announcements Announcement[]
  events        Event[]
  eventRSVPs    EventRSVP[]
  messages      Message[]         @relation("MessageSender")
  receivedMessages Message[]      @relation("MessageReceiver")
  refreshToken  RefreshToken?

  // Ward/District relationship
  ward          Ward?             @relation("WardRepresentative")
  wardId        String?

  // Department relationship (for Department Heads)
  department    Department?       @relation("DepartmentHead")
  departmentId  String?
}

enum UserRole {
  SUPER_ADMIN
  MAYOR
  DEPARTMENT_HEAD
  COUNCIL_MEMBER
  STAFF
  WARD_REP
  CITIZEN
  VOLUNTEER
  AUDITOR
  MEDIA
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// === GEOGRAPHIC STRUCTURE ===

model Ward {
  id          String   @id @default(uuid())
  name        String
  code        String   @unique
  description String?
  boundary    Json?    // GeoJSON polygon
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  representative User?  @relation("WardRepresentative")
  users      User[]
  issues     Issue[]
  departments DepartmentWard[]
}

model Department {
  id          String   @id @default(uuid())
  name        String
  code        String   @unique
  description String?
  budget      Decimal? @db.Decimal(12, 2)
  headId      String?
  head        User?    @relation("DepartmentHead")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  issues      Issue[]
  wards       DepartmentWard[]
}

model DepartmentWard {
  id           String     @id @default(uuid())
  departmentId String
  wardId       String
  department   Department @relation(fields: [departmentId], references: [id])
  ward         Ward       @relation(fields: [wardId], references: [id])

  @@unique([departmentId, wardId])
}

// === ISSUES & FEEDBACK ===

model Issue {
  id            String      @id @default(uuid())
  title         String
  description   String
  category      IssueCategory
  status        IssueStatus @default(SUBMITTED)
  priority      Int?        // AI-scored 1-5, nullable until scored
  priorityJustification String?
  location      String      // Address text
  latitude      Decimal?    @db.Decimal(9, 6)
  longitude     Decimal?    @db.Decimal(9, 6)
  upvotes       Int         @default(0)
  viewCount     Int         @default(0)
  isPublic      Boolean     @default(true)
  reporterId    String
  reporter      User        @relation("IssueReporter", fields: [reporterId], references: [id])
  assigneeId    String?
  assignee      User?       @relation("IssueAssignee", fields: [assigneeId], references: [id])
  departmentId  String?
  department    Department? @relation(fields: [departmentId], references: [id])
  wardId        String?
  ward          Ward?       @relation(fields: [wardId], references: [id])
  aiCategory    String?     // AI-assigned category
  aiSentiment   String?     // POSITIVE, NEUTRAL, NEGATIVE
  searchVector  String?     // tsvector as string, populated by trigger
  resolvedAt    DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  comments      Comment[]
  votes         Vote[]
  attachments   Attachment[]
  statusHistory StatusHistory[]
  tags          IssueTag[]
}

enum IssueCategory {
  INFRASTRUCTURE
  PUBLIC_SAFETY
  SANITATION
  UTILITIES
  HOUSING
  ENVIRONMENT
  TRANSPORTATION
  EDUCATION
  HEALTH
  OTHER
}

enum IssueStatus {
  SUBMITTED
  ACKNOWLEDGED
  IN_PROGRESS
  PENDING_REVIEW
  RESOLVED
  VERIFIED
  REJECTED
  REOPENED
}

// === VOTING ===

model Vote {
  id        String   @id @default(uuid())
  value     Int      // 1 = upvote, -1 = downvote
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  issueId   String?
  issue     Issue?   @relation(fields: [issueId], references: [id])
  surveyId  String?
  survey    Survey?  @relation(fields: [surveyId], references: [id])
  pollId    String?
  poll      Poll?    @relation(fields: [pollId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, issueId])
  @@unique([userId, surveyId])
  @@unique([userId, pollId])
}

// === COMMENTS & DISCUSSIONS ===

model Comment {
  id        String   @id @default(uuid())
  content   String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  issueId   String
  issue     Issue    @relation(fields: [issueId], references: [id])
  parentId  String?
  parent    Comment? @relation("CommentThread", fields: [parentId], references: [id])
  children  Comment[] @relation("CommentThread")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// === SURVEYS & POLLS ===

model Survey {
  id          String   @id @default(uuid())
  title       String
  description String?
  creatorId   String
  creator     User     @relation(fields: [creatorId], references: [id])
  isActive    Boolean  @default(true)
  closesAt    DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  questions   SurveyQuestion[]
  responses   SurveyResponse[]
  votes       Vote[]
}

model SurveyQuestion {
  id        String   @id @default(uuid())
  surveyId  String
  survey    Survey   @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  text      String
  type      QuestionType
  options   Json?    // For multiple choice
  order     Int
}

enum QuestionType {
  TEXT
  MULTIPLE_CHOICE
  RATING
  YES_NO
}

model SurveyResponse {
  id         String   @id @default(uuid())
  surveyId   String
  survey     Survey   @relation(fields: [surveyId], references: [id])
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  answers    Json
  createdAt  DateTime @default(now())
}

model Poll {
  id          String   @id @default(uuid())
  title       String
  description String?
  creatorId   String
  isActive    Boolean  @default(true)
  closesAt    DateTime?
  createdAt   DateTime @default(now())

  options     PollOption[]
  votes       Vote[]
}

model PollOption {
  id     String @id @default(uuid())
  pollId String
  poll   Poll   @relation(fields: [pollId], references: [id], onDelete: Cascade)
  text   String
  votes  Int    @default(0)
}

// === NOTIFICATIONS ===

model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  message   String
  data      Json?    // Related entity info
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}

enum NotificationType {
  ISSUE_ASSIGNED
  ISSUE_STATUS_CHANGED
  ISSUE_COMMENT
  ISSUE_MENTION
  VOTE_RECEIVED
  ANNOUNCEMENT
  EVENT_REMINDER
  SURVEY_NEW
  RESOLUTION_VOTE
  SYSTEM
}

// === AUDIT & COMPLIANCE ===

model AuditLog {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String   // CREATE, UPDATE, DELETE, ASSIGN, RESOLVE, etc.
  entity     String   // Issue, User, Survey, etc.
  entityId   String
  oldValues  Json?
  newValues  Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
}

// === DOCUMENTS & MEDIA ===

model Attachment {
  id        String   @id @default(uuid())
  fileName  String
  fileUrl   String
  fileSize  Int
  mimeType  String
  issueId   String
  issue     Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
  uploadedBy String
  createdAt DateTime @default(now())
}

// === ANNOUNCEMENTS ===

model Announcement {
  id         String   @id @default(uuid())
  title      String
  content    String
  authorId   String
  author     User     @relation(fields: [authorId], references: [id])
  isPinned   Boolean  @default(false)
  publishedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// === EVENTS & CALENDAR ===

model Event {
  id          String   @id @default(uuid())
  title       String
  description String?
  location    String?
  startTime   DateTime
  endTime     DateTime
  creatorId   String
  creator     User     @relation(fields: [creatorId], references: [id])
  type        EventType
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())

  rsvps       EventRSVP[]
}

enum EventType {
  COUNCIL_MEETING
  PUBLIC_HEARING
  COMMUNITY_EVENT
  VOLUNTEER_EVENT
  TOWN_HALL
  WORKSHOP
}

model EventRSVP {
  id       String  @id @default(uuid())
  eventId  String
  event    Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId   String
  user     User    @relation(fields: [userId], references: [id])
  status   RSVPStatus

  @@unique([eventId, userId])
}

enum RSVPStatus {
  GOING
  MAYBE
  NOT_GOING
}

// === MESSAGING ===

model Message {
  id         String   @id @default(uuid())
  content    String
  senderId   String
  sender     User     @relation("MessageSender", fields: [senderId], references: [id])
  receiverId String
  receiver   User     @relation("MessageReceiver", fields: [receiverId], references: [id])
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
}

// === RESOLUTION TRACKING ===

model Resolution {
  id           String   @id @default(uuid())
  title        String
  description  String
  issueId      String?
  issue        Issue?   @relation(fields: [issueId], references: [id])
  proposedById String
  status       ResolutionStatus @default(DRAFT)
  votesFor     Int      @default(0)
  votesAgainst Int      @default(0)
  votedByIds   String[] // Council member IDs who voted
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  decidedAt    DateTime?
}

enum ResolutionStatus {
  DRAFT
  PROPOSED
  VOTING
  PASSED
  REJECTED
  IMPLEMENTED
}

// === TAG SYSTEM ===

model IssueTag {
  id      String @id @default(uuid())
  issueId String
  issue   Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)
  tag     String

  @@unique([issueId, tag])
}

// === STATUS HISTORY ===

model StatusHistory {
  id        String     @id @default(uuid())
  issueId   String
  issue     Issue      @relation(fields: [issueId], references: [id], onDelete: Cascade)
  oldStatus IssueStatus?
  newStatus IssueStatus
  changedBy String
  note      String?
  createdAt DateTime   @default(now())
}
```

---

## 7. AI Integration Architecture (Ollama + Gemma 2B)

### Service Layer

```
backend/src/ai/
├── ollama.service.ts          # Ollama API client wrapper
├── prompts/
│   ├── categorize.prompt.ts   # Issue categorization system prompt
│   ├── priority.prompt.ts     # Priority scoring system prompt
│   ├── sentiment.prompt.ts    # Sentiment analysis system prompt
│   ├── summary.prompt.ts      # Summary generation system prompt
│   ├── trend.prompt.ts        # Trend detection system prompt
│   └── chatbot.prompt.ts      # Chatbot system prompt
├── ai.controller.ts           # AI API endpoints
└── ai.routes.ts               # POST /api/v1/ai/*
```

### AI Endpoints

| Endpoint | Method | Purpose | Input | Output |
|----------|--------|---------|-------|--------|
| `/api/v1/ai/categorize` | POST | Auto-categorize issue text | `{ text: string }` | `{ category, confidence }` |
| `/api/v1/ai/priority` | POST | Score issue urgency | `{ text: string, category: string }` | `{ score: 1-5, justification }` |
| `/api/v1/ai/sentiment` | POST | Analyze feedback sentiment | `{ text: string }` | `{ sentiment, score, justification }` |
| `/api/v1/ai/summary` | POST | Generate executive summary | `{ text: string, maxLength?: number }` | `{ summary }` |
| `/api/v1/ai/trends` | POST | Detect emerging trends | `{ issues: Issue[] }` | `{ trends: Trend[] }` |
| `/api/v1/ai/chat` | POST | Chatbot conversation | `{ messages: Message[] }` | `{ response }` |

### System Prompts (Gemma 2B)

```
CATEGORIZE:
"You are a municipal issue classifier. Classify citizen reports into exactly one category:
INFRASTRUCTURE, PUBLIC_SAFETY, SANITATION, UTILITIES, HOUSING, ENVIRONMENT,
TRANSPORTATION, EDUCATION, HEALTH, or OTHER. Output JSON: {\"category\": \"...\", \"confidence\": 0.0-1.0}"

PRIORITY:
"You are a municipal urgency assessor. Rate issue urgency from 1 (low) to 5 (critical)
based on public safety risk, severity, and community impact. Output JSON:
{\"score\": N, \"justification\": \"...\"}"

SENTIMENT:
"You are a sentiment analyst for municipal feedback. Classify as POSITIVE, NEUTRAL, or NEGATIVE.
Output JSON: {\"sentiment\": \"...\", \"score\": 0.0-1.0, \"justification\": \"...\"}"

SUMMARY:
"You are a municipal briefing assistant. Summarize the following civic issue in under 50 words
suitable for a city council agenda item. Be factual and concise."

CHATBOT:
"You are CivicAssist, an AI assistant for the municipal government. Help citizens navigate
the issue reporting process, answer frequently asked questions about city services, and guide
them to the appropriate department. Be friendly, professional, and helpful."
```

### Integration Points

1. **Issue Creation** → Auto-trigger categorization + priority scoring on submit
2. **Comment Analysis** → Batch sentiment analysis on feedback threads
3. **Council Reports** → Auto-generate weekly/monthly summaries
4. **Trend Dashboard** → Background job analyzes issue clusters
5. **Chatbot** → Real-time conversational interface in all dashboards

---

## 8. Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────────┐
│  Angular  │ ──────► │ Express  │ ──────► │  PostgreSQL  │
│  Client   │ ◄────── │  Server  │ ◄────── │  (Users)     │
└──────────┘         └──────────┘         └──────────────┘
     │                      │
     │   POST /auth/login   │
     │─────────────────────►│
     │   { email, password }│
     │                      │── Validate credentials
     │                      │── Generate JWT (15min)
     │   ◄──────────────────│── Generate Refresh (7d)
     │   { accessToken,     │── Store refresh hash
     │     refreshToken }   │
     │                      │
     │   GET /api/v1/...    │
     │   Authorization:     │
     │   Bearer <token>     │
     │─────────────────────►│
     │                      │── Verify JWT
     │                      │── Check RBAC role
     │                      │── Set req.user
     │   ◄──────────────────│── Return data
     │                      │
     │   POST /auth/refresh │
     │   Cookie: refresh    │
     │─────────────────────►│
     │                      │── Validate refresh token
     │   ◄──────────────────│── Issue new access token
     │                      │
     │   POST /auth/logout  │
     │─────────────────────►│
     │                      │── Delete refresh token
     │   ◄──────────────────│── Clear cookie
```

---

## 9. RBAC Middleware Pattern

```typescript
// backend/src/middleware/rbac.middleware.ts
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};

// Usage in routes:
router.get('/issues', verifyJwt, authorize('SUPER_ADMIN', 'MAYOR', 'DEPARTMENT_HEAD'), controller.getAll);
router.post('/users', verifyJwt, authorize('SUPER_ADMIN'), controller.createUser);
router.post('/resolutions/:id/vote', verifyJwt, authorize('COUNCIL_MEMBER'), controller.vote);
```

---

## 10. Dashboard Widget Specifications

### Super Admin Dashboard
- Total Issues (open/resolved/escalated) counter widgets
- System health metrics (active users, response times)
- User management table with quick role assignment
- Department performance comparison bar chart
- Ward issue distribution pie chart
- Recent audit log timeline
- AI trend alerts panel
- Announcement composer

### Mayor Dashboard
- City-wide issue summary (KPI cards)
- Department performance ranking table
- Budget allocation vs spending chart
- Sentiment trend line graph (last 30 days)
- Priority issues requiring attention list
- AI-generated weekly briefing summary
- Upcoming events/meetings calendar
- Public announcements manager

### Department Head Dashboard
- Department-specific issue queue (filtered)
- Staff workload distribution chart
- Issue category breakdown donut chart
- Average resolution time metric
- Department budget tracker
- AI priority-ranked issue list
- Team performance metrics
- Bulk action tools panel

### Council Member Dashboard
- Constituent issues in district (map view)
- Resolution voting queue
- Upcoming council meeting agenda
- Constituent sentiment analysis
- Budget impact reports
- Direct messaging inbox
- Community poll management
- Public feedback summary

### Staff/Agent Dashboard
- My assigned issues list (sortable)
- Issue status pipeline (Kanban view)
- Quick status update form
- Field notes & photo upload
- Escalation workflow button
- Department announcements
- Today's task list
- Communication inbox

### Ward Rep Dashboard
- Ward-specific issue map with heatmap
- Neighborhood feedback aggregation
- Community event organizer
- Local poll creator
- Resident communication tools
- Ward performance metrics
- Upcoming community events
- Volunteer coordination panel

### Citizen Dashboard
- My submitted issues tracker
- Nearby issues on interactive map
- Voting & polling participation
- Community forum access
- Upcoming public events
- AI chatbot helper
- Notification center
- Issue submission quick form

### Volunteer Dashboard
- Available community projects
- My volunteer activities & history
- Neighborhood observation reporter
- Upcoming volunteer events calendar
- Community impact metrics
- Task board for active projects
- Direct messaging with coordinators
- Achievement/recognition badges

### Auditor Dashboard
- Compliance overview metrics
- Audit log explorer (filterable)
- Issue resolution quality scores
- Budget expenditure audit trail
- Anomaly detection alerts
- Report generator (PDF/CSV)
- Resolution timeline analysis
- Entity relationship graph

### Media Dashboard
- Public statistics overview
- Trending issues by category
- Downloadable press reports
- Meeting minutes archive
- Public announcements feed
- Geographic issue visualization
- Historical data comparisons
- RSS/API data access info

---

## 11. Implementation Phases

### Phase 1: Foundation (Steps 1-4)
1. Initialize monorepo with npm workspaces
2. Set up Docker Compose for PostgreSQL
3. Configure Angular 18 project with routing
4. Configure Express.js 5 backend with TypeScript

### Phase 2: Authentication & RBAC (Steps 5-7)
5. Database schema with Prisma + migrations
6. JWT auth system (login, register, refresh, logout)
7. RBAC middleware + Angular route guards

### Phase 3: Core Backend (Steps 8-10)
8. Issue CRUD + comment system
9. Voting, polls, and surveys
10. Notifications + announcements

### Phase 4: AI Integration (Steps 11-12)
11. Install Ollama + Gemma 2B, create AI service layer
12. AI endpoints + frontend integration

### Phase 5: Dashboards (Steps 13-16)
13. Super Admin + Mayor dashboards
14. Department Head + Council + Staff dashboards
15. Ward Rep + Citizen + Volunteer dashboards
16. Auditor + Media dashboards

### Phase 6: Polish & Deploy (Steps 17-19)
17. Heat maps, analytics charts, report export
18. Community forums, events calendar, messaging
19. Full testing, code review, README update

---

## 12. Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/direct_democracy

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret-key
REFRESH_TOKEN_EXPIRES_IN=7d

# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma2:2b

# App
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200

# Frontend
API_URL=http://localhost:3001/api/v1
```
