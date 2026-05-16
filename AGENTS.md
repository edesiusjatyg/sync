<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:sync-project-rules -->
# Sync. — Multi-Agent Rules

> These rules exist because agents cannot communicate with each other.
> The PRD (`sync-prd.md`) and this file are the only shared context.
> When in doubt: read the PRD, pick the minimal option, and leave a TODO — never assume.

---

## 1. Who You Are

Before doing anything, identify which agent you are:

- **DB Agent** — you own the database layer
- **API Agent** — you own the business logic layer
- **Frontend Agent** — you own the presentation layer

If your task is ambiguous about which agent should do it, check Section 2.

---

## 2. Ownership Boundaries

This is absolute. No exceptions.

### DB Agent
**Owns (read + write):**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/`
- `lib/db.ts`

**May read (never write):**
- `sync-prd.md` for schema requirements

**Never touches:**
- `app/`, `components/`, `lib/auth.ts`, `lib/matching.ts`, `lib/utils.ts`, `middleware.ts`

---

### API Agent
**Owns (read + write):**
- `app/actions/**`
- `lib/auth.ts`
- `lib/matching.ts`
- `lib/utils.ts`
- `middleware.ts`

**May read (never write):**
- `prisma/schema.prisma` — to know available types and relations
- `sync-prd.md` — for action specs and algorithm details

**Never touches:**
- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`
- `app/**/page.tsx`, `app/**/layout.tsx`, `components/`

---

### Frontend Agent
**Owns (read + write):**
- `app/**/page.tsx`
- `app/**/layout.tsx`
- `components/app/**`
- `app/globals.css`

**May read (never write):**
- `app/actions/**` — to know function signatures and return types only
- `sync-prd.md` — for page specs, design tokens, and component requirements

**Never touches:**
- `prisma/`, `lib/`, `middleware.ts`, `app/actions/**`

---

## 3. Execution Order

Agents run in phases. A phase must be complete before the next begins.

```
PHASE 1 — DB Agent
  ✓ prisma/schema.prisma written
  ✓ prisma generate succeeds (no errors)
  ✓ prisma migrate dev succeeds
  ✓ prisma/seed.ts written and runnable
  → Signal: @prisma/client is available and typed

PHASE 2 — API Agent
  Prerequisite: Phase 1 complete (@prisma/client exists and is typed)
  Internal order within Phase 2:
    1. lib/db.ts
    2. lib/auth.ts
    3. lib/utils.ts (shared guards first)
    4. lib/matching.ts
    5. app/actions/ (matching.ts must exist before swipe.actions.ts)
    6. middleware.ts
  → Signal: all action files export their functions with correct signatures

PHASE 3 — Frontend Agent
  Prerequisite: Phase 2 complete (action signatures exist)
  Exception: /login and /register pages may be built in parallel with Phase 2
  since they only call signIn and registerUser — the simplest actions.
```

---

## 4. Interface Contracts

These are fixed. No agent may change them unilaterally.

### Server Action Return Shape

Every action in `app/actions/**` MUST return this shape:

```typescript
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

For actions that return no data on success:
```typescript
type ActionResult = { success: true } | { success: false; error: string }
```

**API Agent rule:** Never throw to the client. Always catch and return `{ success: false, error: string }`.

**Frontend Agent rule:** Always handle both branches. Never assume `success` is `true`. Every action call must have an error path in the UI.

---

### Prisma Client Usage

```typescript
// lib/db.ts — written by DB Agent, imported by API Agent only
import { db } from '@/lib/db'
```

Frontend Agent never imports `db` or anything from `lib/`. If data is needed, a Server Action provides it.

---

### Auth Session Shape

This is the contract between API Agent (who defines it) and Frontend Agent (who consumes it):

```typescript
interface SessionUser {
  id: string
  email: string
  name: string
  role: 'student' | 'admin'
  hasCompletedOnboarding: boolean
}
```

Frontend Agent accesses this via `useSession()` or `auth()`. It never derives these values itself.

---

## 5. Naming Conventions

Shared vocabulary — use these exactly so file references across agents stay consistent.

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `swipe.actions.ts`, `user-card.tsx` |
| Components | PascalCase | `UserCard`, `SkillBadge`, `PageShell` |
| Server Actions | camelCase, verbNoun | `createGroup`, `getMyMatches`, `recordSwipe` |
| Types/Interfaces | PascalCase, descriptive suffix | `CandidateCard`, `GroupDetail`, `ActionResult` |
| Env vars | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `NEXTAUTH_SECRET` |
| Prisma models | PascalCase singular | `User`, `GroupMember`, `StudySession` |
| DB columns | camelCase in schema | `createdAt`, `compatibilityScore` |

---

## 6. Scope Lock

If something is not in `sync-prd.md`, do not build it.

```
DO NOT:
  - Install npm packages not required by the PRD tech stack
  - Add columns or tables not in the schema spec (Section 4.3 of PRD)
  - Create routes not in the route map (Section 6.4 of PRD)
  - Implement any feature listed in Section 11 (Out of Scope / YAGNI)
  - Add UI elements for out-of-scope features as "placeholders"

IF a required implementation detail is missing from the PRD:
  - Pick the most minimal implementation that satisfies the stated behavior
  - Leave a comment: // TODO: PRD does not specify — chose minimal implementation
  - Do not design for future extensibility that isn't needed now
```

Out-of-scope features (do not implement, do not stub):
- Skill Gap Analyzer
- Meeting Time Optimizer
- Group Health Scoring
- Adaptive Rematching
- Endorsement UI (schema exists, actions and UI are deferred)
- Google OAuth
- Real-time / websocket features
- Email notifications

---

## 7. What To Do When Ambiguous

Agents cannot ask each other. Follow this decision tree in order:

```
1. Is the answer in sync-prd.md?
   YES → follow the PRD exactly
   NO  → continue

2. Does it affect another agent's owned files?
   YES → do not implement. Leave a comment:
         // TODO: requires coordination — not specified in PRD
   NO  → continue

3. Does it require a new npm package?
   YES → do not install. Use what's already in the stack.
   NO  → continue

4. Choose the minimal implementation that satisfies the visible requirement.
   Leave a comment explaining the choice.
```

---

## 8. Shared Stack Reference

All agents must use only these. Do not introduce alternatives.

| Concern | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI primitives | shadcn/ui + Tailwind CSS |
| Database | Neon Postgres via Prisma ORM |
| Auth | NextAuth v5 (Auth.js) — Credentials provider only |
| Validation | Zod (API Agent in action files; Frontend Agent in form schemas) |
| Forms | react-hook-form (Frontend Agent only) |
| Password hashing | bcryptjs (API Agent only) |
| Deployment | Vercel — CI/CD is automatic, no custom pipeline |
| Package manager | Check `package.json` — do not switch managers |

Build script in `package.json` must be:
```json
"build": "prisma migrate deploy && next build"
```
This ensures migrations run on every Vercel deploy.

---

## 9. Environment Variables

All required. Document any addition in `.env.example` before using it.

```
DATABASE_URL       # Neon connection string (pooled)
DIRECT_URL         # Neon direct connection string (for migrations)
NEXTAUTH_SECRET    # Random secret for JWT signing
NEXTAUTH_URL       # Full deployment URL (e.g. https://sync.vercel.app)
```

DB Agent: use `DATABASE_URL` + `DIRECT_URL` in `schema.prisma` datasource block.
API Agent: read via `process.env` in `lib/auth.ts` and server-only code.
Frontend Agent: never access env vars directly. Use session or actions.

---

## 10. Error Handling Rules

### DB Agent
- Every foreign key relation must have an explicit `onDelete` strategy in schema.
- Unique constraints that enforce business rules must live in the schema, not in action logic.
- If a constraint is violated, the error must be catch-able as a Prisma `PrismaClientKnownRequestError`.

### API Agent
- Wrap every action body in `try/catch`.
- Log the full error server-side: `console.error('[actionName]', error)`.
- Return to client: `{ success: false, error: 'A generic safe message' }` — never expose raw DB errors or stack traces.
- Authorization failures return `{ success: false, error: 'Unauthorized' }` — same shape, no special status codes needed since these are Server Actions.

### Frontend Agent
- Every Server Action call must handle both `success: true` and `success: false`.
- Display errors via shadcn/ui `toast` (error variant) or inline form error — never silent failures.
- Every async operation must have a loading state (use `useTransition` or `useFormStatus`).
- Every list/collection UI must have an `EmptyState` component for when `data = []`.

---

## 11. Authorization Rules

### API Agent must enforce these in every relevant action:

| Check | How |
|---|---|
| User is authenticated | Call `auth()` at top of action, return Unauthorized if no session |
| User is a group member | Call `assertGroupMember(userId, groupId)` from `lib/utils.ts` |
| User is group admin | Call `assertGroupAdmin(userId, groupId)` from `lib/utils.ts` |
| User is platform admin | Check `session.user.role === 'admin'` |
| Resource belongs to user | Fetch resource, compare `createdById` or `loggedById` to session user id |

### Frontend Agent must enforce these in routing:

| Condition | Behavior |
|---|---|
| No session | Middleware redirects to `/login` |
| Session but no Profile | Middleware redirects to `/onboarding` |
| Session with role `admin` landing on `/discover` | Middleware redirects to `/admin` |

Frontend Agent does not implement auth logic — middleware (owned by API Agent) handles all redirects. Frontend Agent only needs to handle the post-redirect states.

---

## 12. Testing Responsibilities

Each agent is responsible for the correctness of their own layer.

**DB Agent:**
- `prisma/seed.ts` must produce enough data to exercise every feature:
  - 3+ student accounts with complete profiles and populated `matchingVector`
  - Skills seeded across all categories
  - At least 1 mutual match and 1 group with tasks and a session
- Run `prisma validate` before declaring Phase 1 complete.

**API Agent:**
- Every action must handle the empty/null case (e.g., `getCandidates` with no candidates returns `{ success: true, data: [] }`, not an error).
- Manually verify the end-to-end happy path before declaring Phase 2 complete:
  `register → saveOnboardingProfile → getCandidates → recordSwipe (mutual) → createGroup → createTask → logSession`

**Frontend Agent:**
- Every page must be visually complete at three states: loading, empty, and with data.
- Test with the seed data from DB Agent before declaring Phase 3 complete.
- Responsive check: all pages must be usable at 375px (mobile) and 1280px (desktop).

<!-- END:sync-project-rules -->
