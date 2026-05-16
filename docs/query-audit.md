<!--
# Query Audit Report

## getMyMatches — app/actions/match.actions.ts
**Current round trips:** 1
**Queries:**
1. SELECT "Match" with nested includes for userA and userB (purpose: fetch matches and peers)
**Problems identified:**
- [Resolved] None. The query ALREADY uses a single `findMany` with consolidated nested `include` as per Priority 1 target. The codebase appears to have been partially optimized prior to this audit.
**Actual round trips after fix:** 1
**Fix priority:** low

## recordSwipe — app/actions/swipe.actions.ts
**Current round trips:** 4-5
**Queries:**
1. SELECT "User" (purpose: check target is active)
2. SELECT "Swipe" (purpose: check duplicate swipe)
3. INSERT "Swipe" (purpose: record swipe)
4. SELECT "Swipe" (purpose: check reciprocal like)
5. SELECT "User" (purpose: fetch profiles for both users to calculate score, only if matched)
6. INSERT/UPDATE "Match" (purpose: create match)
**Problems identified:**
- [Resolved] Redundant check: duplicate swipe check can be replaced with P2002 catch on create.
- [Resolved] Redundant check: target user isActive check can be skipped by trusting DB and valid UI state.
- [Resolved] Fan-out: Query 5 can be eliminated by including the `profile` and `matchingVector` in the reciprocal swipe query using nested selects (`swiper` and `target` relations on `Swipe`).
**Actual round trips after fix:** 2 (3 if matched)
**Fix priority:** high

## getCandidates — app/actions/swipe.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "User" (purpose: fetch currentUser profile vector and swipesGiven)
2. SELECT "User" (purpose: fetch eligible candidates)
**Problems identified:**
- [Resolved] None. It already fetches candidates with full nested include in one go and has `take: 500`. (Priority 3 target is already met in the current code).
**Actual round trips after fix:** 2
**Fix priority:** low

## registerUser — app/actions/auth.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "User" (purpose: check existing email)
2. INSERT "User" (purpose: create user)
**Problems identified:**
- [Resolved] Redundant check: email unique check can be replaced with P2002 catch.
**Actual round trips after fix:** 1
**Fix priority:** medium

## updateMatchStatus — app/actions/match.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "Match" (purpose: verify ownership)
2. UPDATE "Match" (purpose: change status)
**Problems identified:**
- [Resolved] Redundant check: ownership can be enforced by adding `userAId` / `userBId` to an `updateMany` where clause.
**Actual round trips after fix:** 1
**Fix priority:** medium

## createGroup — app/actions/group.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "User" (purpose: verify invited users)
2. INSERT "Group" (purpose: create group and members)
**Problems identified:**
- [Resolved] Redundant check: verifying invited users can be skipped. If they don't exist, the transaction will fail due to DB foreign key constraints (we can catch P2003).
**Actual round trips after fix:** 1
**Fix priority:** medium

## inviteMember — app/actions/group.actions.ts
**Current round trips:** 3
**Queries:**
1. SELECT "Group", "GroupMember", "User" (purpose: verify capacity, membership, active user)
2. SELECT COUNT "GroupMember" (purpose: check capacity)
3. INSERT "GroupMember"
**Problems identified:**
- [Resolved] Missing select: Group capacity and member count can be fetched in a single query (`_count.members`).
- [Resolved] Redundant check: Duplicate membership check can be caught via P2002 on insert.
- [Resolved] Redundant check: User existence check can rely on foreign key constraints.
**Actual round trips after fix:** 2
**Fix priority:** medium

## searchUsersForGroupInvite — app/actions/group.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "GroupMember" (purpose: fetch current members)
2. SELECT "User" (purpose: search invitable users)
**Problems identified:**
- [Resolved] Fan-out: Can be reduced to 1 query by using relational filters (`groupMembers: { none: { groupId } }`).
**Actual round trips after fix:** 1
**Fix priority:** medium

## kickMember — app/actions/group.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "GroupMember" (purpose: verify member)
2. DELETE "GroupMember" (purpose: remove member)
**Problems identified:**
- [Resolved] Redundant check: `findUnique` check can be replaced with P2025 catch on delete.
**Actual round trips after fix:** 1
**Fix priority:** medium

## transferAdmin — app/actions/group.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "GroupMember" (purpose: verify member)
2. UPDATE "GroupMember" x2 (purpose: swap roles)
**Problems identified:**
- [Resolved] Redundant check: initial `findUnique` can be removed. The transaction can attempt the role updates directly and we handle any P2025 errors.
**Actual round trips after fix:** 1
**Fix priority:** medium

## updateTask — app/actions/task.actions.ts
**Current round trips:** 3
**Queries:**
1. SELECT "Task" (purpose: verify task)
2. SELECT "GroupMember" (purpose: verify assignee membership)
3. UPDATE "Task"
**Problems identified:**
- [Skipped] Sequential awaits: Queries 1 and 2 cannot be parallelized because the `assertAssigneeIsGroupMember` query requires the `groupId`, which is fetched from the first query (`db.task.findUnique`).
**Actual round trips after fix:** 3
**Fix priority:** medium

## submitEffectivenessScore — app/actions/session.actions.ts
**Current round trips:** 2
**Queries:**
1. SELECT "StudySession" (purpose: verify ownership)
2. UPDATE "StudySession"
**Problems identified:**
- [Skipped] Redundant check: ownership check cannot be safely combined into `updateMany` because we need the `session.groupId` returned from the first query in order to properly invalidate Next.js caches (`revalidatePath` and `invalidate`). Prisma's `updateMany` does not return the updated records.
**Actual round trips after fix:** 2
**Fix priority:** medium

## All other actions
**Current round trips:** 1 (or fully optimized transaction)
**Problems identified:**
- `getMyProfile`, `getSkillCatalog`, `updateProfile` (no easy optimization without rewriting vector logic)
- `getMyGroups`, `getGroupDetail`, `getGroupTasks`, `getGroupSessions` (already use includes correctly)
- `leaveGroup`, `createTask`, `deleteTask` (require authorization checks that cannot be easily bypassed with updateMany)
- `admin.actions.ts` (all single queries)
**Fix priority:** low
-->
