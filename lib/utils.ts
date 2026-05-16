import type { Session } from "next-auth";
import { ZodError } from "zod";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
  hasCompletedOnboarding: boolean;
}

export type DataActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type VoidActionResult = { success: true } | { success: false; error: string };

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSessionUser(session: Session | null): SessionUser | null {
  if (!session?.user) {
    return null;
  }

  const user = session.user as Partial<SessionUser>;

  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.name !== "string" ||
    (user.role !== "student" && user.role !== "admin")
  ) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
  };
}

export function isProfileComplete(
  profile: { goalTypes: readonly unknown[] } | null | undefined,
  userSkillCount: number,
) {
  return Boolean(profile && profile.goalTypes.length > 0 && userSkillCount > 0);
}

export function normalizeMatchPair(leftUserId: string, rightUserId: string) {
  return leftUserId < rightUserId
    ? { userAId: leftUserId, userBId: rightUserId }
    : { userAId: rightUserId, userBId: leftUserId };
}

export function serializeDate(date: Date) {
  return date.toISOString();
}

export function serializeNullableDate(date: Date | null) {
  return date ? serializeDate(date) : null;
}

export function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)];
}

export function getActionErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof AuthorizationError) {
    return "Unauthorized";
  }

  if (error instanceof NotFoundError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return "Invalid input.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    switch ((error as { code: string }).code) {
      case "P2002":
        return "A record with that value already exists.";
      case "P2025":
        return "The requested record was not found.";
      default:
        break;
    }
  }

  return fallback;
}

export function logActionError(actionName: string, error: unknown) {
  const digest = (error as any)?.digest;
  if (typeof digest === "string" && (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"))) {
    throw error;
  }
  console.error(`[${actionName}]`, error);
}

export function requireAdmin(user: SessionUser | null): asserts user is SessionUser {
  if (!user || user.role !== "admin") {
    throw new AuthorizationError();
  }
}

export async function assertGroupMember(userId: string, groupId: string): Promise<void> {
  const { db } = await import("@/lib/db");

  const membership = await db.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    select: {
      userId: true,
    },
  });

  if (!membership) {
    throw new AuthorizationError();
  }
}

export async function assertGroupAdmin(userId: string, groupId: string): Promise<void> {
  const { db } = await import("@/lib/db");

  const membership = await db.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership || membership.role !== "admin") {
    throw new AuthorizationError();
  }
}
