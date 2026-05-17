import bcrypt from 'bcryptjs';
import { testDb } from './db';
import { computeMatchingVector } from '@/lib/matching';
import { GoalType, WorkStyleSync, WorkStyleDriven, WorkStyleRole, TaskStatus, Profile, User, Match, Group, Task, StudySession, UserSkill } from '@prisma/client';

type UserWithProfile = User & { profile: Profile, userSkills: UserSkill[] };

export async function createUser(overrides?: Partial<User>): Promise<User> {
  const passwordHash = await bcrypt.hash('password123', 10);
  const email = overrides?.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  
  return testDb.user.create({
    data: {
      email,
      name: overrides?.name ?? 'Test User',
      passwordHash,
      role: overrides?.role ?? 'student',
      isActive: overrides?.isActive ?? true,
      avatarUrl: overrides?.avatarUrl,
      ...overrides,
    }
  });
}

export async function createUserWithProfile(overrides?: Partial<User>): Promise<UserWithProfile> {
  const user = await createUser(overrides);
  
  const profile = await testDb.profile.create({
    data: {
      userId: user.id,
      bio: 'Test bio',
      productiveHours: [6, 12, 17],
      workStyleSync: WorkStyleSync.async,
      workStyleDriven: WorkStyleDriven.milestone,
      workStyleRole: WorkStyleRole.flexible,
      goalTypes: [GoalType.tugas, GoalType.side_project],
      matchingVector: [],
    }
  });

  let skills = await testDb.skill.findMany({ take: 3 });
  if (skills.length < 3) {
    await testDb.skill.createMany({
      data: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'TypeScript', category: 'Frontend' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Node.js', category: 'Backend' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Figma', category: 'Design' }
      ],
      skipDuplicates: true
    });
    skills = await testDb.skill.findMany({ take: 3 });
  }
  
  const allSkills = await testDb.skill.findMany({ select: { id: true } });

  const userSkillsData = skills.map(s => ({
    userId: user.id,
    skillId: s.id,
    rating: 8
  }));

  await testDb.userSkill.createMany({ data: userSkillsData });

  const userSkills = await testDb.userSkill.findMany({ where: { userId: user.id } });

  const vector = computeMatchingVector(profile, userSkills, allSkills.map(s => s.id));
  
  const updatedProfile = await testDb.profile.update({
    where: { userId: user.id },
    data: { matchingVector: vector }
  });

  return {
    ...user,
    profile: updatedProfile,
    userSkills
  };
}

export async function createMatch(userAId: string, userBId: string, status: 'pending'|'accepted'|'declined' = 'accepted'): Promise<Match> {
  const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  return testDb.match.create({
    data: {
      userAId: a,
      userBId: b,
      compatibilityScore: 0.85,
      status,
    }
  });
}

export async function createGroup(createdById: string, memberIds: string[] = []): Promise<Group> {
  const members = [{ userId: createdById, role: 'admin' as const }];
  for (const id of memberIds) {
    if (id !== createdById) {
      members.push({ userId: id, role: 'member' as const });
    }
  }

  return testDb.group.create({
    data: {
      name: 'Test Group',
      createdById,
      goalTypes: [GoalType.tugas],
      maxMembers: 5,
      members: {
        create: members
      }
    }
  });
}

export async function createTask(groupId: string, createdById: string, overrides?: Partial<Task>): Promise<Task> {
  return testDb.task.create({
    data: {
      groupId,
      createdById,
      title: overrides?.title ?? 'Test Task',
      status: overrides?.status ?? TaskStatus.todo,
      assignedToId: overrides?.assignedToId,
      deadline: overrides?.deadline,
    }
  });
}

export async function createSession(groupId: string, loggedById: string, overrides?: Partial<StudySession>): Promise<StudySession> {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  
  return testDb.studySession.create({
    data: {
      groupId,
      loggedById,
      startedAt: overrides?.startedAt ?? now,
      endedAt: overrides?.endedAt ?? later,
      notes: overrides?.notes,
      effectivenessScore: overrides?.effectivenessScore,
    }
  });
}
