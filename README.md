# Sync.
### Study Matchmaker — Find Collaborators Who Actually Complement You

> **Live Demo:** [sync-early-alpha.vercel.app](https://sync-early-alpha.vercel.app)

---

## The Problem

University study groups form by accident, not design. Students end up with teammates who have identical skills and incompatible work rhythms — everyone's a frontend developer, nobody handles backend, and half the group works at midnight while the other half disappears after 3pm.

Sync. fixes this by treating study group formation the way it should be treated: as a matching problem with real data.

---

## What It Does

Sync. is a **Study Matchmaker** web app. Students build a profile, an algorithm surfaces the most compatible peers, they swipe to match, then form groups with shared task boards and study session logs.

The core UX metaphor is Bumble for study groups — **swipe, match, connect**.

### Core Features

**Student Profiling**
Students declare their skills (self-rated 1–10), productive hours (Dini Hari / Pagi / Siang / Sore / Malam), working style (Async/Sync, Deadline/Milestone, Leader/Executor), and current goals (Coursework, Side Project, Competition, Research).

**Matching Algorithm**
Profiles are encoded as float vectors and scored using weighted vector scoring across three dimensions:
- **Skill Score (50%)** — higher when skills are *different* (complementarity, not similarity)
- **Schedule Score (30%)** — higher when productive hours *overlap*
- **Goals Score (20%)** — higher when goal types *match*

Candidates are ranked by composite score and presented as swipeable cards.

**Swipe & Match**
Tinder-style swipe interface with drag gesture support. Mutual likes create a Match automatically. Optimistic UI ensures the swipe feels instant regardless of server response time.

**Group Workspace**
Mutual matches can be converted into Groups. Each group has:
- Member roster with skill badges and role indicators
- Shared task board (Todo / In Progress / Done) with assignees and deadlines
- Study session logging with start/end times, notes, and post-session effectiveness ratings (1–5)

**Admin Dashboard**
Platform admins can moderate users and groups without participating in the core matching flow.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| Database | Neon Postgres (serverless) |
| ORM | Prisma |
| Auth | NextAuth v5 — email + password, JWT strategy |
| Caching | Redis Cloud (ioredis) |
| Deployment | Vercel |

---

## Architecture

The project was built using a **multi-agent workflow** with strict separation of concerns across three layers:

```
DB Agent          → prisma/schema.prisma, lib/db.ts
API Agent         → app/actions/**, lib/matching.ts, lib/cache.ts, lib/auth.ts
Frontend Agent    → app/**/page.tsx, components/app/**
```

Each layer owns its domain exclusively. Server Actions are the only interface between frontend and backend — no raw DB calls in components, no UI logic in actions.

### Key Technical Decisions

**Cache-Aside with Redis**
`getCandidates`, `getMyMatches`, and `getGroupDetail` are cached with explicit TTLs (2–5 minutes). All write actions invalidate affected keys immediately. Redis failure falls through gracefully to direct DB queries — the cache is an optimization, never a hard dependency.

**Optimistic UI on Swipe**
`recordSwipe` removes the card from the queue immediately on interaction, fires the Server Action in the background via `useTransition`, and rolls back only on failure. This makes the swipe feel instant regardless of server latency.

**Constraint-First Validation**
Rather than pre-checking uniqueness before writes (SELECT then INSERT), the app writes optimistically and catches Prisma constraint errors (`P2002` for duplicates, `P2003` for missing foreign keys, `P2025` for missing records). This halved the round-trip count on write-heavy actions like `recordSwipe`, `registerUser`, and `inviteMember`.

**Matching Vector Storage**
`matchingVector: Float[]` is computed once on profile save and stored on the `Profile` model. Candidate ranking reads pre-computed vectors from cache — no vector recomputation on every discover request.

---

## Database Schema

12 models covering the full domain:

```
User → Profile → UserSkill → Skill
User → Swipe (swiper ↔ target)
User → Match (userA ↔ userB)
User → GroupMember → Group
Group → Task (creator, assignee)
Group → StudySession (loggedBy)
User → Endorsement (from, to, skill, group)
```

All foreign keys have explicit `onDelete` strategies. Unique constraints enforce business rules at the DB level.

---

## API Layer

All data mutations and fetches go through **Next.js Server Actions**. Every action returns a typed discriminated union:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Authorization is enforced server-side on every action via `auth()` session checks and shared guard functions (`assertGroupMember`, `assertGroupAdmin`).

---

## Performance

Query optimization was a significant focus. Key improvements:

| Action | Before | After |
|---|---|---|
| `recordSwipe` | 4–5 round trips | 2 round trips |
| `getMyMatches` | ~9 round trips (fan-out) | 1 round trip (nested include) |
| `getCandidates` | 6 round trips | 2 round trips + Redis HIT in ~60ms |
| `registerUser` | 2 round trips + double bcrypt | 1 round trip + single bcrypt |
| `inviteMember` | 3 round trips | 2 round trips |

Cache HIT response time on `getCandidates`: **~60–90ms** end-to-end.

---

## Testing

Full test suite covering three layers:

**Unit Tests (Vitest)**
Pure function coverage for `lib/matching.ts` (vector computation, scoring, ranking) and `lib/cache.ts` (HIT/MISS behavior, fallback on Redis failure, serialization).

**Integration Tests (Vitest)**
Server Actions tested end-to-end against a real test database. Every action has happy path + critical failure paths. Redis is real (not mocked) with per-test cache flush. Only `auth()` is mocked.

**E2E Tests (Playwright)**
Full browser flows: Registration → Onboarding, Discover → Match, Create Group → Tasks, Session Log. Each spec seeds its own data and runs independently.

---

## Project Structure

```
/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── lib/
│   ├── db.ts              # Prisma singleton
│   ├── auth.ts            # NextAuth config
│   ├── matching.ts        # Vector computation + scoring
│   ├── cache.ts           # Redis cache helpers
│   └── utils.ts           # Shared guards + utilities
├── app/
│   ├── actions/           # All Server Actions
│   ├── (auth)/            # Login, Register
│   └── (app)/             # Protected app shell
│       ├── onboarding/
│       ├── discover/
│       ├── matches/
│       ├── groups/[id]/
│       └── admin/
├── components/
│   ├── ui/                # shadcn/ui primitives
│   └── app/               # Composed app components
├── tests/
│   ├── unit/
│   ├── integration/
│   └── helpers/
└── e2e/
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Postgres database (Neon recommended)
- Redis instance (Redis Cloud or local)

### Setup

```bash
git clone https://github.com/edesiusjatyg/sync
cd sync
npm install
```

Copy environment variables:
```bash
cp .env.example .env
```

Fill in `.env`:
```
DATABASE_URL=postgresql://...?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...
REDIS_URL=rediss://:password@host:port
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

Run migrations and seed:
```bash
npx prisma migrate deploy
npx prisma db seed
```

Start dev server:
```bash
npm run dev
```

### Running Tests

```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests (requires DATABASE_URL_TEST)
npm run test:e2e           # E2E tests (requires running dev server)
npm run test:all           # Everything
```

---

## Roadmap

Features documented but intentionally deferred from MVP:

- **Skill Gap Analyzer** — LLM-powered skill gap detection with learning resource recommendations
- **Meeting Time Optimizer** — Auto-suggest optimal meeting times from member schedules
- **Group Health Scoring** — Anomaly detection (Z-score) on session logs to surface ghosting members
- **Adaptive Rematching** — Re-run matching algorithm mid-project to suggest member swaps
- **Endorsement System** — Graph-based trust scoring for post-project skill endorsements

---

## License

MIT

---

*Built by [Edesius Jaty Giovanni](https://github.com/edesiusjatyg) · Universitas Brawijaya · 2026*
