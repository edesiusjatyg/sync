import { db } from './db';
import { UserRole, SwipeDirection, MatchStatus, GroupMemberRole, TaskStatus, GoalType, WorkStyleSync, WorkStyleDriven, WorkStyleRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function createUser(overrides: Partial<Parameters<typeof db.user.create>[0]['data']> = {}) {
  const email = overrides.email || `test-${Math.random().toString(36).substring(7)}@test.com`;
  return db.user.create({
    data: {
      email,
      name: 'Test User',
      passwordHash: await bcrypt.hash('password123', 10),
      role: UserRole.student,
      isActive: true,
      ...overrides,
    },
  });
}

export async function createSkill(overrides: Partial<Parameters<typeof db.skill.create>[0]['data']> = {}) {
  const name = overrides.name || `Skill-${Math.random().toString(36).substring(7)}`;
  return db.skill.create({
    data: {
      name,
      category: 'Test Category',
      ...overrides,
    },
  });
}

export async function createProfile(userId: string, overrides: Partial<Parameters<typeof db.profile.create>[0]['data']> = {}) {
  return db.profile.create({
    data: {
      userId,
      productiveHours: [9, 10, 11],
      workStyleSync: WorkStyleSync.async,
      workStyleDriven: WorkStyleDriven.milestone,
      workStyleRole: WorkStyleRole.flexible,
      goalTypes: [GoalType.tugas],
      matchingVector: [0.5, 0.5, 0.5], // Dummy vector
      ...overrides,
    },
  });
}

export async function createGroup(createdById: string, overrides: Partial<Parameters<typeof db.group.create>[0]['data']> = {}) {
  const name = overrides.name || `Group-${Math.random().toString(36).substring(7)}`;
  return db.group.create({
    data: {
      name,
      createdById,
      goalTypes: [GoalType.tugas],
      maxMembers: 5,
      isOpen: true,
      ...overrides,
    },
  });
}

export async function createMatch(userAId: string, userBId: string, overrides: Partial<Parameters<typeof db.match.create>[0]['data']> = {}) {
  return db.match.create({
    data: {
      userAId,
      userBId,
      compatibilityScore: 0.9,
      status: MatchStatus.pending,
      ...overrides,
    },
  });
}
