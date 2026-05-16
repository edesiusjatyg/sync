# PRD — Sync.
**Study Matchmaker for University Students**
Version: 1.0 | Status: Ready for Implementation
Stack: Next.js 15 (App Router) · shadcn/ui · Neon Postgres · Prisma ORM · Vercel
Auth: Email + Password (NextAuth v5 / Auth.js Credentials Provider)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guiding Principles](#2-guiding-principles)
3. [Architecture Overview](#3-architecture-overview)
4. [Agent 1 — DB Agent](#4-agent-1--db-agent)
5. [Agent 2 — API Agent](#5-agent-2--api-agent)
6. [Agent 3 — Frontend Agent](#6-agent-3--frontend-agent)
7. [Feature Specifications](#7-feature-specifications)
8. [Matching Algorithm Spec](#8-matching-algorithm-spec)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Implementation Schedule](#10-implementation-schedule)
11. [Out of Scope (YAGNI)](#11-out-of-scope-yagni)

---

## 1. Overview

### 1.1 Problem

University study groups form by accident, not design. This produces two failure modes:

- **Skill Mismatch** — All members share the same strengths; no one covers gaps.
- **Work Rhythm Mismatch** — Conflicting productive hours and working styles create coordination chaos.

### 1.2 Solution

Sync. is a Study Matchmaker web app. Students build a profile, the algorithm surfaces compatible peers, they swipe/match, form groups, and collaborate via shared task boards and study session logging.

Core UX metaphor: **Bumble for study groups** — swipe, match, connect.

### 1.3 Users & Roles

| Role | Scope | Capabilities |
|---|---|---|
| `student` | Global | Register, profile, swipe, match, join groups, log sessions, endorse skills |
| `group_admin` | Per-group | Kick members, edit group info, transfer admin role |
| `admin` | Global | Moderate users and groups via dashboard. Cannot participate in core activity (swipe, match, sessions) |

---

## 2. Guiding Principles

These apply to **all three agents**:

- **KISS** — Implement the simplest solution that satisfies the requirement. No speculative abstractions.
- **DRY** — Shared logic (vector computation, score normalization) is defined once. Agents import from `lib/`, never duplicate.
- **SOLID** — Each module has one reason to change. DB schema, business logic, and UI are fully decoupled.
- **YAGNI** — Optional features (Skill Gap Analyzer, Adaptive Rematching, Endorsement System, Meeting Time Optimizer, Group Health Scoring) are defined in scope but **not implemented** in the 4-week sprint unless core loop is complete and time remains. No placeholder code for them.
- **Separation of Concerns** — DB Agent owns data shape. API Agent owns business logic. Frontend Agent owns presentation. No agent reaches into another's domain.

---

## 3. Architecture Overview

```
/
├── prisma/
│   └── schema.prisma          ← DB Agent owns this entirely
│
├── lib/
│   ├── db.ts                  ← Prisma client singleton (DB Agent)
│   ├── auth.ts                ← NextAuth config (API Agent)
│   ├── matching.ts            ← Vector computation + scoring (API Agent)
│   └── utils.ts               ← Shared pure utilities (both agents)
│
├── app/
│   ├── api/
│   │   └── auth/[...nextauth]/ ← Auth route (API Agent)
│   ├── (auth)/                ← Login / Register pages (Frontend Agent)
│   ├── (app)/                 ← Protected app shell (Frontend Agent)
│   │   ├── onboarding/        ← Profile setup flow
│   │   ├── discover/          ← Swipe screen
│   │   ├── matches/           ← Match list + group creation
│   │   ├── groups/[id]/       ← Group dashboard, tasks, sessions
│   │   └── admin/             ← Admin moderation dashboard
│   └── actions/               ← Server Actions (API Agent owns all files here)
│       ├── auth.actions.ts
│       ├── profile.actions.ts
│       ├── swipe.actions.ts
│       ├── match.actions.ts
│       ├── group.actions.ts
│       ├── task.actions.ts
│       └── session.actions.ts
│
└── components/
    ├── ui/                    ← shadcn/ui primitives (Frontend Agent, read-only)
    └── app/                   ← Composed app components (Frontend Agent)
```

**Data flow rule:** Frontend calls Server Actions only. Server Actions call `lib/` functions only. `lib/` functions call Prisma only. No raw SQL in Server Actions. No Prisma calls in components.

---

## 4. Agent 1 — DB Agent

### 4.1 Responsibilities

- Write and maintain `prisma/schema.prisma`
- Write and run all migrations via `prisma migrate dev`
- Maintain `lib/db.ts` (Prisma client singleton)
- Seed script at `prisma/seed.ts` for development data
- Own all index definitions and referential integrity

### 4.2 Constraints

- Do NOT write business logic. Schema only.
- Do NOT write Server Actions or components.
- Every foreign key has an explicit `onDelete` strategy.
- All timestamps use `@default(now())` or `@updatedAt`.
- Enums are defined at the Prisma level, not as raw strings.

### 4.3 Full Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum UserRole {
  student
  admin
}

enum WorkStyleSync {
  async
  sync
}

enum WorkStyleDriven {
  deadline
  milestone
}

enum WorkStyleRole {
  leader
  executor
  flexible
}

enum SwipeDirection {
  like
  pass
}

enum MatchStatus {
  pending
  accepted
  declined
}

enum GroupMemberRole {
  admin
  member
}

enum TaskStatus {
  todo
  in_progress
  done
}

enum GoalType {
  tugas
  side_project
  kompetisi
  riset
  lainnya
}

// ─────────────────────────────────────────
// CORE IDENTITY
// ─────────────────────────────────────────

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  avatarUrl    String?
  role         UserRole @default(student)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  // Relations
  profile       Profile?
  userSkills    UserSkill[]
  swipesGiven   Swipe[]        @relation("SwiperRelation")
  swipesReceived Swipe[]       @relation("TargetRelation")
  matchesAsA    Match[]        @relation("UserARelation")
  matchesAsB    Match[]        @relation("UserBRelation")
  groupsCreated Group[]        @relation("GroupCreatorRelation")
  groupMembers  GroupMember[]
  tasksCreated  Task[]         @relation("TaskCreatorRelation")
  tasksAssigned Task[]         @relation("TaskAssigneeRelation")
  sessionsLogged StudySession[]
  endorsementsGiven    Endorsement[] @relation("EndorsementFromRelation")
  endorsementsReceived Endorsement[] @relation("EndorsementToRelation")
}

// ─────────────────────────────────────────
// PROFILE & SKILLS
// ─────────────────────────────────────────

model Profile {
  id              String         @id @default(uuid())
  userId          String         @unique
  bio             String?
  productiveHours Int[]          // 0-23 hour indices
  workStyleSync   WorkStyleSync  @default(async)
  workStyleDriven WorkStyleDriven @default(milestone)
  workStyleRole   WorkStyleRole  @default(flexible)
  goalTypes       GoalType[]
  matchingVector  Float[]        // Computed and stored after onboarding
  updatedAt       DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Skill {
  id         String      @id @default(uuid())
  name       String      @unique
  category   String

  userSkills UserSkill[]
  endorsements Endorsement[]
}

model UserSkill {
  userId  String
  skillId String
  rating  Int    // 1–10

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@id([userId, skillId])
}

// ─────────────────────────────────────────
// SWIPE & MATCH
// ─────────────────────────────────────────

model Swipe {
  id        String         @id @default(uuid())
  swiperId  String
  targetId  String
  direction SwipeDirection
  createdAt DateTime       @default(now())

  swiper User @relation("SwiperRelation", fields: [swiperId], references: [id], onDelete: Cascade)
  target User @relation("TargetRelation", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([swiperId, targetId])
  @@index([swiperId])
  @@index([targetId])
}

model Match {
  id                 String      @id @default(uuid())
  userAId            String
  userBId            String
  compatibilityScore Float
  status             MatchStatus @default(pending)
  createdAt          DateTime    @default(now())

  userA User @relation("UserARelation", fields: [userAId], references: [id], onDelete: Cascade)
  userB User @relation("UserBRelation", fields: [userBId], references: [id], onDelete: Cascade)

  @@unique([userAId, userBId])
  @@index([userAId])
  @@index([userBId])
}

// ─────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────

model Group {
  id          String     @id @default(uuid())
  name        String
  goalTypes   GoalType[]
  maxMembers  Int        @default(5)
  isOpen      Boolean    @default(true)
  createdById String
  createdAt   DateTime   @default(now())

  createdBy    User          @relation("GroupCreatorRelation", fields: [createdById], references: [id], onDelete: Restrict)
  members      GroupMember[]
  tasks        Task[]
  sessions     StudySession[]
  endorsements Endorsement[]
}

model GroupMember {
  groupId  String
  userId   String
  role     GroupMemberRole @default(member)
  joinedAt DateTime        @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([groupId, userId])
  @@index([userId])
}

// ─────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────

model Task {
  id          String     @id @default(uuid())
  groupId     String
  createdById String
  assignedToId String?
  title       String
  status      TaskStatus @default(todo)
  deadline    DateTime?
  createdAt   DateTime   @default(now())

  group      Group  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  createdBy  User   @relation("TaskCreatorRelation", fields: [createdById], references: [id], onDelete: Restrict)
  assignedTo User?  @relation("TaskAssigneeRelation", fields: [assignedToId], references: [id], onDelete: SetNull)

  @@index([groupId])
}

// ─────────────────────────────────────────
// STUDY SESSIONS
// ─────────────────────────────────────────

model StudySession {
  id                 String   @id @default(uuid())
  groupId            String
  loggedById         String
  startedAt          DateTime
  endedAt            DateTime
  notes              String?
  effectivenessScore Int?     // 1–5, from post-session survey

  group    Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  loggedBy User  @relation(fields: [loggedById], references: [id], onDelete: Restrict)

  @@index([groupId])
}

// ─────────────────────────────────────────
// ENDORSEMENTS
// ─────────────────────────────────────────

model Endorsement {
  id         String   @id @default(uuid())
  fromUserId String
  toUserId   String
  skillId    String
  groupId    String
  createdAt  DateTime @default(now())

  fromUser User  @relation("EndorsementFromRelation", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUser   User  @relation("EndorsementToRelation", fields: [toUserId], references: [id], onDelete: Cascade)
  skill    Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)
  group    Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([fromUserId, toUserId, skillId, groupId])
  @@index([toUserId])
}
```

### 4.4 Seed Data (`prisma/seed.ts`)

Seed must provide:
- 5 predefined skills per category (Frontend, Backend, AI/ML, UI/UX, Research, Writing)
- 3 student accounts with complete profiles and `matchingVector` populated
- 1 admin account

### 4.5 `lib/db.ts`

```typescript
// Standard Prisma singleton pattern for Next.js
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

---

## 5. Agent 2 — API Agent

### 5.1 Responsibilities

- Write all Server Actions under `app/actions/`
- Write `lib/auth.ts` (NextAuth Credentials config)
- Write `lib/matching.ts` (vector computation + weighted scoring)
- Write `lib/utils.ts` (shared pure functions)
- Handle all input validation (use `zod`)
- Handle all error states and return typed results to the Frontend Agent

### 5.2 Constraints

- Do NOT write components or UI logic.
- Do NOT write Prisma schema.
- All Server Actions are `async` functions with `'use server'` directive.
- All Server Actions return `{ success: true, data: T } | { success: false, error: string }`.
- Never throw unhandled errors to the client — catch and return error shape.
- Password hashing via `bcryptjs`. Never store plaintext passwords.
- Session via NextAuth JWT strategy.

### 5.3 Auth (`lib/auth.ts`)

**Provider:** Credentials (email + password only)
**Strategy:** JWT
**Session shape:**
```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    role: 'student' | 'admin'
    hasCompletedOnboarding: boolean // derived from Profile existence
  }
}
```

**Login flow:**
1. Receive email + password
2. Find user by email in DB
3. Compare password with `bcryptjs.compare`
4. Return user object or `null`

**Register flow (Server Action):**
1. Validate input with Zod (email format, password min 8 chars, name required)
2. Check email uniqueness
3. Hash password with `bcryptjs.hash(password, 12)`
4. Create User record
5. Return session (auto-sign-in after register)

**Middleware (`middleware.ts`):**
- Redirect unauthenticated users from `/app/*` routes to `/login`
- Redirect authenticated users with no Profile from any `/app/*` route (except `/app/onboarding`) to `/app/onboarding`
- Redirect `admin` role to `/app/admin` if they land on `/app/discover`

### 5.4 Server Actions Specification

All actions import `db` from `lib/db` and `auth` from `lib/auth`. All are validated with Zod schemas defined at the top of each file.

---

#### `app/actions/auth.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `registerUser` | `{ name, email, password }` | Validate → hash → create User | `{ success, userId }` |

---

#### `app/actions/profile.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `saveOnboardingProfile` | `{ bio?, productiveHours, workStyleSync, workStyleDriven, workStyleRole, goalTypes, skills: [{skillId, rating}] }` | Upsert Profile + UserSkills → compute + save matchingVector | `{ success }` |
| `getMyProfile` | — | Fetch Profile + UserSkills for current session user | `{ success, data: ProfileWithSkills }` |
| `updateProfile` | Partial of onboarding input | Same as save, recompute vector | `{ success }` |

**Vector computation** is delegated to `lib/matching.ts::computeMatchingVector(profile, userSkills)`.

---

#### `app/actions/swipe.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `getCandidates` | `{ limit?: number }` | Fetch users not yet swiped by current user, sorted by compatibility score descending | `{ success, data: CandidateCard[] }` |
| `recordSwipe` | `{ targetId, direction }` | Insert Swipe → if `like` and reciprocal like exists, create Match | `{ success, matched: boolean, matchId?: string }` |

**`CandidateCard` shape:**
```typescript
interface CandidateCard {
  userId: string
  name: string
  avatarUrl: string | null
  bio: string | null
  skills: { name: string; category: string; rating: number }[]
  productiveHours: number[]
  goalTypes: string[]
  compatibilityScore: number
}
```

**Candidate ranking logic** (delegated to `lib/matching.ts::rankCandidates`):
1. Fetch all users with completed profiles who haven't been swiped by current user
2. For each candidate, compute weighted score against current user's vector
3. Return sorted descending by score, limited to `limit` (default 20)

---

#### `app/actions/match.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `getMyMatches` | — | Fetch all accepted matches for current user with peer profile data | `{ success, data: MatchWithPeer[] }` |
| `updateMatchStatus` | `{ matchId, status: 'accepted' \| 'declined' }` | Update Match.status | `{ success }` |

---

#### `app/actions/group.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `createGroup` | `{ name, goalTypes, maxMembers, invitedUserIds? }` | Create Group + GroupMember (admin) + invite members | `{ success, groupId }` |
| `getMyGroups` | — | Fetch all groups where current user is a member | `{ success, data: GroupSummary[] }` |
| `getGroupDetail` | `{ groupId }` | Fetch group + members + tasks + sessions (recent 5) | `{ success, data: GroupDetail }` |
| `updateGroupInfo` | `{ groupId, name?, goalTypes?, maxMembers?, isOpen? }` | Validate group_admin role → update | `{ success }` |
| `inviteMember` | `{ groupId, userId }` | Check capacity + not already member → insert GroupMember | `{ success }` |
| `kickMember` | `{ groupId, userId }` | Validate group_admin + not self → delete GroupMember | `{ success }` |
| `transferAdmin` | `{ groupId, userId }` | Validate caller is group_admin → update both members' roles | `{ success }` |
| `leaveGroup` | `{ groupId }` | Remove self from GroupMember. If last member, delete group. If group_admin, block unless transfer first | `{ success }` |

---

#### `app/actions/task.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `createTask` | `{ groupId, title, assignedToId?, deadline? }` | Validate member → insert Task | `{ success, taskId }` |
| `updateTask` | `{ taskId, title?, status?, assignedToId?, deadline? }` | Validate member → update Task | `{ success }` |
| `deleteTask` | `{ taskId }` | Validate creator or group_admin → delete Task | `{ success }` |
| `getGroupTasks` | `{ groupId }` | Fetch all tasks for group with assignee name | `{ success, data: TaskWithAssignee[] }` |

---

#### `app/actions/session.actions.ts`

| Action | Input | Logic | Returns |
|---|---|---|---|
| `logSession` | `{ groupId, startedAt, endedAt, notes? }` | Validate member + endedAt > startedAt → insert StudySession | `{ success, sessionId }` |
| `submitEffectivenessScore` | `{ sessionId, score: 1\|2\|3\|4\|5 }` | Validate logger is session owner → update effectivenessScore | `{ success }` |
| `getGroupSessions` | `{ groupId, limit?: number }` | Fetch sessions for group, sorted by startedAt desc | `{ success, data: SessionWithLogger[] }` |

---

### 5.5 Matching Algorithm (`lib/matching.ts`)

See full specification in **Section 8**.

### 5.6 Input Validation Rules (Zod)

All Zod schemas are co-located in each action file, not in a separate schema file (KISS).

| Field | Rule |
|---|---|
| email | `z.string().email()` |
| password | `z.string().min(8).max(100)` |
| name | `z.string().min(1).max(100)` |
| rating | `z.number().int().min(1).max(10)` |
| productiveHours | `z.array(z.number().int().min(0).max(23)).min(1)` |
| goalTypes | `z.array(z.nativeEnum(GoalType)).min(1)` |
| effectivenessScore | `z.number().int().min(1).max(5)` |
| limit | `z.number().int().min(1).max(50).default(20)` |

### 5.7 Authorization Guards

Each Server Action that requires group-level role must call a shared guard:

```typescript
// lib/utils.ts
export async function assertGroupAdmin(userId: string, groupId: string): Promise<void>
export async function assertGroupMember(userId: string, groupId: string): Promise<void>
```

These throw a typed `AuthorizationError` that Server Actions catch and return as `{ success: false, error: 'Unauthorized' }`.

---

## 6. Agent 3 — Frontend Agent

### 6.1 Responsibilities

- Write all pages and components under `app/` and `components/app/`
- Use only shadcn/ui primitives from `components/ui/`
- Call Server Actions for all data mutations and fetches (no direct DB access)
- Handle loading states, empty states, and error states for every async operation
- Implement responsive layout (mobile-first, works on desktop)

### 6.2 Constraints

- Do NOT write Server Actions or Prisma logic.
- Do NOT install additional UI libraries — use shadcn/ui + Tailwind only.
- All forms use `react-hook-form` + `zod` for client-side validation before calling actions.
- Use Next.js `<Image>` for all images.
- Use `useTransition` or `useFormStatus` for pending states on mutations.
- Do NOT use `any` TypeScript type.

### 6.3 Design System

**Palette (CSS variables in `globals.css`):**

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#F97316` (Orange) | CTAs, active states, match indicator |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--background` | `#FAFAFA` | Page background |
| `--card` | `#FFFFFF` | Card surface |
| `--muted` | `#F1F5F9` | Secondary surfaces |
| `--destructive` | `#EF4444` | Error, delete |

**Typography:**
- Heading: `font-bold` + appropriate size scale
- Body: Default shadcn/ui sans

**Reusable component conventions:**
- `SkillBadge` — displays skill name + rating chip
- `UserCard` — swipeable profile card (name, avatar, skills, productive hours, goals)
- `PageShell` — padded container with max-width for all inner pages
- `EmptyState` — icon + title + optional CTA, used for empty lists
- `LoadingSpinner` — centered spinner for async states

### 6.4 Page & Route Map

| Route | Page | Auth Required | Notes |
|---|---|---|---|
| `/` | Landing / redirect | No | Redirect to `/discover` if logged in, else `/login` |
| `/login` | Login page | No | Email + password form |
| `/register` | Register page | No | Name + email + password form |
| `/onboarding` | Onboarding flow | Yes | Multi-step: Skills → Hours → Work Style → Goals |
| `/discover` | Swipe / Discover | Yes | Main card swipe UI |
| `/matches` | Match list | Yes | List of mutual matches |
| `/groups` | My groups list | Yes | Cards for each group |
| `/groups/[id]` | Group dashboard | Yes | Members, tasks, sessions |
| `/groups/[id]/tasks` | Task board | Yes | Full CRUD task board |
| `/groups/[id]/sessions` | Session log | Yes | Log + history |
| `/admin` | Admin dashboard | Yes (admin) | User + group moderation list |

### 6.5 Page Specifications

---

#### `/login` and `/register`

**Components:** `Card`, `Input`, `Button`, `Form`
**Behavior:**
- On submit: call `signIn` (login) or `registerUser` action (register)
- Show inline error on failure
- Redirect to `/discover` on success (middleware handles onboarding redirect)

---

#### `/onboarding`

**Flow:** 4-step wizard stored in local component state. Submit only on final step.

| Step | Fields | Component |
|---|---|---|
| 1 — Skills | Multi-select skill picker + rating slider per skill | Custom `SkillPicker` with shadcn `Slider` |
| 2 — Hours | Timeblock grid (Pagi/Siang/Sore/Malam/Dini hari) | Toggle button grid |
| 3 — Work Style | 3 toggle groups (Sync/Async, Deadline/Milestone, Leader/Executor/Flexible) | `ToggleGroup` |
| 4 — Goals | Multi-select goal type + bio textarea | Checkbox group + `Textarea` |

**On complete:** call `saveOnboardingProfile` → redirect to `/discover`

**Progress indicator:** Step dots at top of wizard.

---

#### `/discover`

**Components:** `UserCard` (stacked), swipe buttons (Like / Pass), loading skeleton

**Behavior:**
1. On mount: call `getCandidates` → load cards into local queue
2. Like button / swipe right → call `recordSwipe({ direction: 'like' })` → if `matched: true`, show match toast/modal
3. Pass button / swipe left → call `recordSwipe({ direction: 'pass' })` → remove card
4. When queue is empty → show `EmptyState` ("No more candidates right now")
5. Swipe gesture support via mouse drag (CSS transform, no external lib required)

**Match notification:** shadcn `Dialog` — "It's a match! You and [Name] are compatible." with CTA to view matches.

---

#### `/matches`

**Components:** List of `MatchCard` (avatar, name, compatibility score badge, skill badges)
**Actions:** "Create Group" button → opens `Dialog` with group name input → calls `createGroup` with both user IDs as invited members.

---

#### `/groups`

**Components:** Grid of `GroupCard` (name, member count, goal badges, open/closed indicator)
**Actions:** "New Group" button → `CreateGroupDialog`

---

#### `/groups/[id]`

**Layout:** Tabs — Overview | Tasks | Sessions

**Overview tab:**
- Group header (name, goal badges, open/closed toggle for group_admin)
- Member list with avatars, skill badges, role indicator
- group_admin actions: Invite member (search by email), Kick member, Transfer admin

**Tasks tab (`/groups/[id]/tasks`):**
- Column view: Todo | In Progress | Done
- Each task card: title, assignee avatar, deadline badge
- "Add Task" button → inline form (title, assign to, deadline)
- Click task → expand to edit status, assignee, deadline, or delete

**Sessions tab (`/groups/[id]/sessions`):**
- "Log Session" button → `Dialog` (start time, end time, notes)
- Session history list: date, duration, logger name, notes, effectiveness score
- Post-session survey: if session has no effectivenessScore and logged by current user → prompt with 1–5 star rating

---

#### `/admin`

**Components:** Tabs — Users | Groups

**Users tab:** Table with columns: Name, Email, Role, Status, Actions (Deactivate/Activate, Change Role)
**Groups tab:** Table with columns: Name, Members, Creator, Created At, Actions (Delete group)

All admin actions call dedicated admin Server Actions (to be added to `group.actions.ts` and a new `admin.actions.ts` — scope for API Agent to add `deactivateUser`, `activateUser`, `deleteGroup`).

---

## 7. Feature Specifications

### 7.1 Student Profiling

- Skills are seeded in DB (not user-created). User selects from list and rates 1–10.
- Productive hours are stored as array of integers (0 = Dini Hari/00:00, 6 = Pagi, 12 = Siang, 17 = Sore, 20 = Malam).
- Profile is considered complete when Profile record exists with at least one UserSkill and one goalType.

### 7.2 Swipe & Matching

- A Match is created only when **both** users have swiped `like` on each other.
- A user cannot swipe the same target twice (enforced by DB unique constraint).
- Candidates exclude: already swiped users, current user.
- Compatibility score (0.0–1.0) is stored on the Match record.

### 7.3 Groups

- A group can have 2–10 members (configurable via maxMembers, min enforced as 2).
- A user can be in multiple groups.
- Only group_admin can invite/kick members and edit group info.
- Deleting a group cascades to all tasks, sessions, and endorsements.
- A group_admin cannot leave without transferring admin first (enforced in `leaveGroup` action).

### 7.4 Tasks

- Task status transitions: `todo` → `in_progress` → `done` (any member can update status).
- Only task creator or group_admin can delete a task.
- Deadline is optional.

### 7.5 Study Sessions

- Session duration = `endedAt - startedAt`. Frontend enforces `endedAt > startedAt`.
- Effectiveness score is optional and submitted separately post-session.
- Only the session logger can submit the effectiveness score.

---

## 8. Matching Algorithm Spec

**File:** `lib/matching.ts`

### 8.1 Vector Structure

Each user profile is encoded as a flat float vector. Structure:

```
[
  // SKILL BLOCK (normalized 0–1, one value per skill slot)
  // Skills are sorted by a fixed global skill ID order (seeded)
  skill_0_rating,   // e.g., 0.4 (rating 4/10)
  skill_1_rating,
  ...
  skill_N_rating,

  // SCHEDULE BLOCK (binary, one per hour slot: 0=Dini hari, 6=Pagi, 12=Siang, 17=Sore, 20=Malam)
  hour_0,   // 1.0 if active, 0.0 if not
  hour_6,
  hour_12,
  hour_17,
  hour_20,

  // GOALS BLOCK (binary, one per GoalType enum value)
  goal_tugas,
  goal_side_project,
  goal_kompetisi,
  goal_riset,
  goal_lainnya,
]
```

### 8.2 Score Computation

```typescript
function computeScore(userVector: Float[], candidateVector: Float[]): number {
  const skillScore = computeSkillScore(userVector, candidateVector)      // weight 0.5
  const scheduleScore = computeScheduleScore(userVector, candidateVector) // weight 0.3
  const goalsScore = computeGoalsScore(userVector, candidateVector)       // weight 0.2

  return 0.5 * skillScore + 0.3 * scheduleScore + 0.2 * goalsScore
}
```

**Skill Score** — Higher when skills are *different* (complementarity):
```
skillDiff = mean(|userSkill_i - candidateSkill_i|) for all i
skillScore = skillDiff  // 0 = identical skills, 1 = maximally different
```

**Schedule Score** — Higher when productive hours *overlap*:
```
overlap = count of hours where both user and candidate = 1.0
total   = count of hours where either user or candidate = 1.0
scheduleScore = overlap / total  (Jaccard similarity)
               = 0 if total = 0
```

**Goals Score** — Higher when goal types *match*:
```
goalsScore = Jaccard(userGoals, candidateGoals)
```

### 8.3 `computeMatchingVector`

```typescript
export function computeMatchingVector(
  profile: Profile,
  userSkills: UserSkill[],
  allSkillIds: string[]  // ordered list from seed — defines vector slots
): number[]
```

This is called in `saveOnboardingProfile` and `updateProfile`. Result is stored in `Profile.matchingVector`.

### 8.4 `rankCandidates`

```typescript
export function rankCandidates(
  currentUser: { vector: Float[] },
  candidates: { userId: string; vector: Float[] }[]
): { userId: string; score: number }[]
// Returns sorted descending by score
```

---

## 9. Non-Functional Requirements

| Concern | Requirement |
|---|---|
| **Performance** | Candidate ranking runs in-process (JS). Max candidate pool before ranking: 500 users. If user base exceeds 500, add pagination offset to `getCandidates`. |
| **Security** | All Server Actions verify session via `auth()`. No client-facing route returns another user's password hash. Admin-only actions check `session.user.role === 'admin'`. |
| **Validation** | Zod validates all Server Action inputs. Invalid inputs return `{ success: false, error: string }` — never throw to client. |
| **Error handling** | All Server Actions wrapped in try/catch. DB errors logged server-side, generic message returned to client. |
| **Type safety** | No `any`. All Server Action return types are explicitly typed. |
| **Environment variables** | `DATABASE_URL`, `DIRECT_URL` (Neon), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. All documented in `.env.example`. |
| **CI/CD** | Vercel auto-deploy on push to `main`. Preview deployments on PRs. No custom pipeline needed. |
| **Migrations** | Run `prisma migrate deploy` in Vercel build step via `package.json` build script: `"build": "prisma migrate deploy && next build"` |

---

## 10. Implementation Schedule

### Week 1 — Foundation

**DB Agent:**
- Write full `prisma/schema.prisma`
- Run initial migration
- Seed skills data

**API Agent:**
- Setup NextAuth with Credentials provider (`lib/auth.ts`)
- `registerUser` Server Action
- `saveOnboardingProfile` Server Action
- `lib/matching.ts` — `computeMatchingVector` function
- `lib/db.ts` singleton

**Frontend Agent:**
- `/login` and `/register` pages
- `/onboarding` 4-step wizard
- Global layout, nav shell, `PageShell`, `SkillBadge` components
- Middleware for auth + onboarding redirect

### Week 2 — Core Matching Loop

**DB Agent:**
- Verify indexes on `swipes` and `matches` tables

**API Agent:**
- `getCandidates` Server Action
- `recordSwipe` Server Action (with mutual match detection)
- `lib/matching.ts` — `rankCandidates` function
- `getMyMatches` Server Action

**Frontend Agent:**
- `/discover` page with `UserCard` swipe UI
- Match notification dialog
- `/matches` page
- `CreateGroupDialog` (from matches)

### Week 3 — Groups & Tasks

**DB Agent:**
- Verify cascade rules on `groups`, `group_members`, `tasks`

**API Agent:**
- All `group.actions.ts` actions
- All `task.actions.ts` actions

**Frontend Agent:**
- `/groups` page
- `/groups/[id]` dashboard with tabs
- Task board (3-column status view)
- Member list with admin controls
- Invite/kick member dialogs

### Week 4 — Sessions, Polish & Testing

**API Agent:**
- All `session.actions.ts` actions
- Admin actions (`admin.actions.ts`)

**Frontend Agent:**
- Session log UI + history
- Post-session effectiveness survey
- `/admin` dashboard
- Responsive layout audit
- Loading skeletons, empty states, error toasts for all async operations
- End-to-end happy path test: Register → Onboard → Discover → Match → Create Group → Add Task → Log Session

---

## 11. Out of Scope (YAGNI)

The following features are documented in the source proposal but **will not be implemented** in the 4-week sprint. No placeholder code, no stub functions, no UI elements for these:

| Feature | Reason |
|---|---|
| Skill Gap Analyzer (LLM) | Requires external LLM API integration; adds cost + complexity |
| Meeting Time Optimizer | Nice-to-have; rule-based but not core loop |
| Group Health Scoring (anomaly detection) | Requires sufficient session history data; premature |
| Adaptive Rematching | Depends on sustained user behavior data |
| Endorsement System | Schema is ready; UI and actions deferred post-launch |
| Google OAuth | Explicitly out of scope per product decision |
| Mobile app | Web-only; responsive web is sufficient for MVP |
| Real-time features (websockets, live task updates) | Polling or refetch on focus is sufficient for MVP |
| Email notifications | Not required for core loop |

---

*End of PRD v1.0 — Sync. Study Matchmaker*
*Generated for multi-agent implementation: DB Agent / API Agent / Frontend Agent*
