import * as bcrypt from "bcryptjs";
import {
  GoalType,
  GroupMemberRole,
  MatchStatus,
  PrismaClient,
  SwipeDirection,
  TaskStatus,
  WorkStyleDriven,
  WorkStyleRole,
  WorkStyleSync,
} from "@prisma/client";

const db = new PrismaClient();

const scheduleSlots = [0, 6, 12, 17, 20] as const;
const goalOrder = [
  GoalType.tugas,
  GoalType.side_project,
  GoalType.kompetisi,
  GoalType.riset,
  GoalType.lainnya,
] as const;

const skillSeeds = [
  { id: "00000000-0000-4000-8000-000000000001", category: "Frontend", name: "HTML/CSS" },
  { id: "00000000-0000-4000-8000-000000000002", category: "Frontend", name: "React" },
  { id: "00000000-0000-4000-8000-000000000003", category: "Frontend", name: "Next.js" },
  { id: "00000000-0000-4000-8000-000000000004", category: "Frontend", name: "Tailwind CSS" },
  { id: "00000000-0000-4000-8000-000000000005", category: "Frontend", name: "TypeScript" },
  { id: "00000000-0000-4000-8000-000000000006", category: "Backend", name: "Node.js" },
  { id: "00000000-0000-4000-8000-000000000007", category: "Backend", name: "Express" },
  { id: "00000000-0000-4000-8000-000000000008", category: "Backend", name: "Prisma" },
  { id: "00000000-0000-4000-8000-000000000009", category: "Backend", name: "PostgreSQL" },
  { id: "00000000-0000-4000-8000-00000000000a", category: "Backend", name: "REST API Design" },
  { id: "00000000-0000-4000-8000-00000000000b", category: "AI/ML", name: "Python" },
  { id: "00000000-0000-4000-8000-00000000000c", category: "AI/ML", name: "Data Analysis" },
  { id: "00000000-0000-4000-8000-00000000000d", category: "AI/ML", name: "Machine Learning" },
  { id: "00000000-0000-4000-8000-00000000000e", category: "AI/ML", name: "Deep Learning" },
  { id: "00000000-0000-4000-8000-00000000000f", category: "AI/ML", name: "Prompt Engineering" },
  { id: "00000000-0000-4000-8000-000000000010", category: "UI/UX", name: "Figma" },
  { id: "00000000-0000-4000-8000-000000000011", category: "UI/UX", name: "Wireframing" },
  { id: "00000000-0000-4000-8000-000000000012", category: "UI/UX", name: "Design Systems" },
  { id: "00000000-0000-4000-8000-000000000013", category: "UI/UX", name: "Prototyping" },
  { id: "00000000-0000-4000-8000-000000000014", category: "UI/UX", name: "User Research" },
  { id: "00000000-0000-4000-8000-000000000015", category: "Research", name: "Hypothesis Formulation" },
  { id: "00000000-0000-4000-8000-000000000016", category: "Research", name: "Literature Review" },
  { id: "00000000-0000-4000-8000-000000000017", category: "Research", name: "Survey Design" },
  { id: "00000000-0000-4000-8000-000000000018", category: "Research", name: "Data Interpretation" },
  { id: "00000000-0000-4000-8000-000000000019", category: "Research", name: "Experiment Design" },
  { id: "00000000-0000-4000-8000-00000000001a", category: "Writing", name: "Copywriting" },
  { id: "00000000-0000-4000-8000-00000000001b", category: "Writing", name: "Technical Writing" },
  { id: "00000000-0000-4000-8000-00000000001c", category: "Writing", name: "Presentation Writing" },
  { id: "00000000-0000-4000-8000-00000000001d", category: "Writing", name: "Editing" },
  { id: "00000000-0000-4000-8000-00000000001e", category: "Writing", name: "Documentation" },
] as const;

const users = {
  alya: {
    id: "10000000-0000-4000-8000-000000000001",
    email: "alya@sync.dev",
    name: "Alya Putri",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Alya",
    profile: {
      bio: "Frontend-focused collaborator who likes clear specs and polished UI.",
      productiveHours: [12, 17, 20],
      workStyleSync: WorkStyleSync.sync,
      workStyleDriven: WorkStyleDriven.milestone,
      workStyleRole: WorkStyleRole.leader,
      goalTypes: [GoalType.tugas, GoalType.side_project],
    },
    skills: [
      { skillId: "00000000-0000-4000-8000-000000000002", rating: 9 },
      { skillId: "00000000-0000-4000-8000-000000000003", rating: 8 },
      { skillId: "00000000-0000-4000-8000-000000000004", rating: 8 },
      { skillId: "00000000-0000-4000-8000-000000000010", rating: 7 },
      { skillId: "00000000-0000-4000-8000-000000000012", rating: 8 },
      { skillId: "00000000-0000-4000-8000-00000000001c", rating: 6 },
    ],
  },
  bima: {
    id: "10000000-0000-4000-8000-000000000002",
    email: "bima@sync.dev",
    name: "Bima Saputra",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Bima",
    profile: {
      bio: "Backend builder who enjoys structuring data and shipping reliable APIs.",
      productiveHours: [6, 12, 17],
      workStyleSync: WorkStyleSync.async,
      workStyleDriven: WorkStyleDriven.deadline,
      workStyleRole: WorkStyleRole.executor,
      goalTypes: [GoalType.tugas, GoalType.riset],
    },
    skills: [
      { skillId: "00000000-0000-4000-8000-000000000006", rating: 9 },
      { skillId: "00000000-0000-4000-8000-000000000008", rating: 8 },
      { skillId: "00000000-0000-4000-8000-000000000009", rating: 8 },
      { skillId: "00000000-0000-4000-8000-000000000016", rating: 7 },
      { skillId: "00000000-0000-4000-8000-000000000018", rating: 7 },
      { skillId: "00000000-0000-4000-8000-00000000001e", rating: 6 },
    ],
  },
  citra: {
    id: "10000000-0000-4000-8000-000000000003",
    email: "citra@sync.dev",
    name: "Citra Lestari",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Citra",
    profile: {
      bio: "AI/ML student who likes experiments, research framing, and concise notes.",
      productiveHours: [0, 17, 20],
      workStyleSync: WorkStyleSync.async,
      workStyleDriven: WorkStyleDriven.milestone,
      workStyleRole: WorkStyleRole.flexible,
      goalTypes: [GoalType.kompetisi, GoalType.riset],
    },
    skills: [
      { skillId: "00000000-0000-4000-8000-00000000000b", rating: 8 },
      { skillId: "00000000-0000-4000-8000-00000000000d", rating: 9 },
      { skillId: "00000000-0000-4000-8000-00000000000f", rating: 8 },
      { skillId: "00000000-0000-4000-8000-000000000015", rating: 7 },
      { skillId: "00000000-0000-4000-8000-000000000019", rating: 8 },
      { skillId: "00000000-0000-4000-8000-00000000001b", rating: 7 },
    ],
  },
  admin: {
    id: "10000000-0000-4000-8000-000000000004",
    email: "admin@sync.dev",
    name: "Platform Admin",
    avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Admin",
  },
} as const;

function computeMatchingVector(
  productiveHours: readonly number[],
  goalTypes: readonly GoalType[],
  userSkills: readonly { skillId: string; rating: number }[],
) {
  const ratingBySkillId = new Map(userSkills.map((item) => [item.skillId, item.rating / 10]));

  const skillBlock = skillSeeds.map((skill) => ratingBySkillId.get(skill.id) ?? 0);
  const scheduleBlock = scheduleSlots.map((slot) => (productiveHours.includes(slot) ? 1 : 0));
  const goalsBlock = goalOrder.map((goal) => (goalTypes.includes(goal) ? 1 : 0));

  return [...skillBlock, ...scheduleBlock, ...goalsBlock];
}

function jaccardBinaryBlock(left: number[], right: number[]) {
  let overlap = 0;
  let total = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    if (leftValue === 1 || rightValue === 1) {
      total += 1;
    }

    if (leftValue === 1 && rightValue === 1) {
      overlap += 1;
    }
  }

  return total === 0 ? 0 : overlap / total;
}

function computeCompatibilityScore(leftVector: number[], rightVector: number[]) {
  const skillCount = skillSeeds.length;
  const scheduleCount = scheduleSlots.length;

  const leftSkills = leftVector.slice(0, skillCount);
  const rightSkills = rightVector.slice(0, skillCount);
  const leftSchedule = leftVector.slice(skillCount, skillCount + scheduleCount);
  const rightSchedule = rightVector.slice(skillCount, skillCount + scheduleCount);
  const leftGoals = leftVector.slice(skillCount + scheduleCount);
  const rightGoals = rightVector.slice(skillCount + scheduleCount);

  const skillScore =
    leftSkills.reduce((sum, rating, index) => sum + Math.abs(rating - (rightSkills[index] ?? 0)), 0) /
    skillCount;
  const scheduleScore = jaccardBinaryBlock(leftSchedule, rightSchedule);
  const goalsScore = jaccardBinaryBlock(leftGoals, rightGoals);

  return Number((0.5 * skillScore + 0.3 * scheduleScore + 0.2 * goalsScore).toFixed(4));
}

async function main() {
  // TODO: PRD does not specify seed credentials — chose one shared demo password.
  const demoPasswordHash = await bcrypt.hash("sync-demo-123", 10);

  await db.$transaction(async (tx) => {
    for (const skill of skillSeeds) {
      await tx.skill.upsert({
        where: { id: skill.id },
        update: { name: skill.name, category: skill.category },
        create: skill,
      });
    }

    await tx.user.upsert({
      where: { id: users.admin.id },
      update: {
        email: users.admin.email,
        name: users.admin.name,
        avatarUrl: users.admin.avatarUrl,
        role: "admin",
        isActive: true,
        passwordHash: demoPasswordHash,
      },
      create: {
        id: users.admin.id,
        email: users.admin.email,
        name: users.admin.name,
        avatarUrl: users.admin.avatarUrl,
        role: "admin",
        isActive: true,
        passwordHash: demoPasswordHash,
      },
    });

    for (const student of [users.alya, users.bima, users.citra]) {
      const matchingVector = computeMatchingVector(
        student.profile.productiveHours,
        student.profile.goalTypes,
        student.skills,
      );

      await tx.user.upsert({
        where: { id: student.id },
        update: {
          email: student.email,
          name: student.name,
          avatarUrl: student.avatarUrl,
          role: "student",
          isActive: true,
          passwordHash: demoPasswordHash,
        },
        create: {
          id: student.id,
          email: student.email,
          name: student.name,
          avatarUrl: student.avatarUrl,
          role: "student",
          isActive: true,
          passwordHash: demoPasswordHash,
        },
      });

      await tx.profile.upsert({
        where: { userId: student.id },
        update: {
          bio: student.profile.bio,
          productiveHours: [...student.profile.productiveHours],
          workStyleSync: student.profile.workStyleSync,
          workStyleDriven: student.profile.workStyleDriven,
          workStyleRole: student.profile.workStyleRole,
          goalTypes: [...student.profile.goalTypes],
          matchingVector,
        },
        create: {
          userId: student.id,
          bio: student.profile.bio,
          productiveHours: [...student.profile.productiveHours],
          workStyleSync: student.profile.workStyleSync,
          workStyleDriven: student.profile.workStyleDriven,
          workStyleRole: student.profile.workStyleRole,
          goalTypes: [...student.profile.goalTypes],
          matchingVector,
        },
      });

      await tx.userSkill.deleteMany({
        where: { userId: student.id },
      });

      for (const userSkill of student.skills) {
        await tx.userSkill.create({
          data: {
            userId: student.id,
            skillId: userSkill.skillId,
            rating: userSkill.rating,
          },
        });
      }
    }

    // Generate 30 mock users
    for (let i = 1; i <= 30; i++) {
      const mockId = `50000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      const mockName = `Mock User ${i}`;
      const mockEmail = `mock${i}@sync.dev`;
      const mockAvatarUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=Mock${i}`;
      
      const randomHours = scheduleSlots.filter(() => Math.random() > 0.5);
      const productiveHours = randomHours.length > 0 ? randomHours : [scheduleSlots[0]];
      
      const randomGoals = goalOrder.filter(() => Math.random() > 0.5);
      const goalTypes = randomGoals.length > 0 ? randomGoals : [goalOrder[0]];

      const mockSkills = Array.from({ length: 5 }).map(() => ({
        skillId: skillSeeds[Math.floor(Math.random() * skillSeeds.length)].id,
        rating: Math.floor(Math.random() * 10) + 1,
      })).filter((v, index, a) => a.findIndex(t => (t.skillId === v.skillId)) === index);

      const matchingVector = computeMatchingVector(
        productiveHours,
        goalTypes,
        mockSkills,
      );

      await tx.user.upsert({
        where: { id: mockId },
        update: {
          email: mockEmail,
          name: mockName,
          avatarUrl: mockAvatarUrl,
          role: "student",
          isActive: true,
          passwordHash: demoPasswordHash,
        },
        create: {
          id: mockId,
          email: mockEmail,
          name: mockName,
          avatarUrl: mockAvatarUrl,
          role: "student",
          isActive: true,
          passwordHash: demoPasswordHash,
        },
      });

      const workStyleSyncValues = Object.values(WorkStyleSync);
      const workStyleDrivenValues = Object.values(WorkStyleDriven);
      const workStyleRoleValues = Object.values(WorkStyleRole);

      const mockWorkStyleSync = workStyleSyncValues[Math.floor(Math.random() * workStyleSyncValues.length)];
      const mockWorkStyleDriven = workStyleDrivenValues[Math.floor(Math.random() * workStyleDrivenValues.length)];
      const mockWorkStyleRole = workStyleRoleValues[Math.floor(Math.random() * workStyleRoleValues.length)];

      await tx.profile.upsert({
        where: { userId: mockId },
        update: {
          bio: `This is the bio for ${mockName}.`,
          productiveHours: [...productiveHours],
          workStyleSync: mockWorkStyleSync,
          workStyleDriven: mockWorkStyleDriven,
          workStyleRole: mockWorkStyleRole,
          goalTypes: [...goalTypes],
          matchingVector,
        },
        create: {
          userId: mockId,
          bio: `This is the bio for ${mockName}.`,
          productiveHours: [...productiveHours],
          workStyleSync: mockWorkStyleSync,
          workStyleDriven: mockWorkStyleDriven,
          workStyleRole: mockWorkStyleRole,
          goalTypes: [...goalTypes],
          matchingVector,
        },
      });

      await tx.userSkill.deleteMany({
        where: { userId: mockId },
      });

      for (const userSkill of mockSkills) {
        await tx.userSkill.create({
          data: {
            userId: mockId,
            skillId: userSkill.skillId,
            rating: userSkill.rating,
          },
        });
      }
    }

    await tx.swipe.upsert({
      where: {
        swiperId_targetId: {
          swiperId: users.alya.id,
          targetId: users.bima.id,
        },
      },
      update: {
        direction: SwipeDirection.like,
      },
      create: {
        swiperId: users.alya.id,
        targetId: users.bima.id,
        direction: SwipeDirection.like,
      },
    });

    await tx.swipe.upsert({
      where: {
        swiperId_targetId: {
          swiperId: users.bima.id,
          targetId: users.alya.id,
        },
      },
      update: {
        direction: SwipeDirection.like,
      },
      create: {
        swiperId: users.bima.id,
        targetId: users.alya.id,
        direction: SwipeDirection.like,
      },
    });

    await tx.swipe.upsert({
      where: {
        swiperId_targetId: {
          swiperId: users.citra.id,
          targetId: users.alya.id,
        },
      },
      update: {
        direction: SwipeDirection.pass,
      },
      create: {
        swiperId: users.citra.id,
        targetId: users.alya.id,
        direction: SwipeDirection.pass,
      },
    });

    const alyaVector = computeMatchingVector(
      users.alya.profile.productiveHours,
      users.alya.profile.goalTypes,
      users.alya.skills,
    );
    const bimaVector = computeMatchingVector(
      users.bima.profile.productiveHours,
      users.bima.profile.goalTypes,
      users.bima.skills,
    );

    await tx.match.upsert({
      where: {
        userAId_userBId: {
          userAId: users.alya.id,
          userBId: users.bima.id,
        },
      },
      update: {
        compatibilityScore: computeCompatibilityScore(alyaVector, bimaVector),
        status: MatchStatus.accepted,
      },
      create: {
        userAId: users.alya.id,
        userBId: users.bima.id,
        compatibilityScore: computeCompatibilityScore(alyaVector, bimaVector),
        status: MatchStatus.accepted,
      },
    });

    await tx.group.upsert({
      where: { id: "20000000-0000-4000-8000-000000000001" },
      update: {
        name: "Sync Sprint Crew",
        goalTypes: [GoalType.tugas, GoalType.side_project],
        maxMembers: 5,
        isOpen: true,
        createdById: users.alya.id,
      },
      create: {
        id: "20000000-0000-4000-8000-000000000001",
        name: "Sync Sprint Crew",
        goalTypes: [GoalType.tugas, GoalType.side_project],
        maxMembers: 5,
        isOpen: true,
        createdById: users.alya.id,
      },
    });

    await tx.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: "20000000-0000-4000-8000-000000000001",
          userId: users.alya.id,
        },
      },
      update: { role: GroupMemberRole.admin },
      create: {
        groupId: "20000000-0000-4000-8000-000000000001",
        userId: users.alya.id,
        role: GroupMemberRole.admin,
      },
    });

    await tx.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: "20000000-0000-4000-8000-000000000001",
          userId: users.bima.id,
        },
      },
      update: { role: GroupMemberRole.member },
      create: {
        groupId: "20000000-0000-4000-8000-000000000001",
        userId: users.bima.id,
        role: GroupMemberRole.member,
      },
    });

    await tx.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: "20000000-0000-4000-8000-000000000001",
          userId: users.citra.id,
        },
      },
      update: { role: GroupMemberRole.member },
      create: {
        groupId: "20000000-0000-4000-8000-000000000001",
        userId: users.citra.id,
        role: GroupMemberRole.member,
      },
    });

    await tx.task.upsert({
      where: { id: "30000000-0000-4000-8000-000000000001" },
      update: {
        groupId: "20000000-0000-4000-8000-000000000001",
        createdById: users.alya.id,
        assignedToId: users.bima.id,
        title: "Define Prisma schema ownership boundaries",
        status: TaskStatus.in_progress,
        deadline: new Date("2026-05-20T17:00:00.000Z"),
      },
      create: {
        id: "30000000-0000-4000-8000-000000000001",
        groupId: "20000000-0000-4000-8000-000000000001",
        createdById: users.alya.id,
        assignedToId: users.bima.id,
        title: "Define Prisma schema ownership boundaries",
        status: TaskStatus.in_progress,
        deadline: new Date("2026-05-20T17:00:00.000Z"),
      },
    });

    await tx.task.upsert({
      where: { id: "30000000-0000-4000-8000-000000000002" },
      update: {
        groupId: "20000000-0000-4000-8000-000000000001",
        createdById: users.alya.id,
        assignedToId: users.citra.id,
        title: "Summarize research findings for onboarding prompts",
        status: TaskStatus.todo,
        deadline: new Date("2026-05-22T09:00:00.000Z"),
      },
      create: {
        id: "30000000-0000-4000-8000-000000000002",
        groupId: "20000000-0000-4000-8000-000000000001",
        createdById: users.alya.id,
        assignedToId: users.citra.id,
        title: "Summarize research findings for onboarding prompts",
        status: TaskStatus.todo,
        deadline: new Date("2026-05-22T09:00:00.000Z"),
      },
    });

    await tx.studySession.upsert({
      where: { id: "40000000-0000-4000-8000-000000000001" },
      update: {
        groupId: "20000000-0000-4000-8000-000000000001",
        loggedById: users.alya.id,
        startedAt: new Date("2026-05-15T11:00:00.000Z"),
        endedAt: new Date("2026-05-15T13:00:00.000Z"),
        notes: "Aligned on schema, seed data, and candidate ranking flow.",
        effectivenessScore: 4,
      },
      create: {
        id: "40000000-0000-4000-8000-000000000001",
        groupId: "20000000-0000-4000-8000-000000000001",
        loggedById: users.alya.id,
        startedAt: new Date("2026-05-15T11:00:00.000Z"),
        endedAt: new Date("2026-05-15T13:00:00.000Z"),
        notes: "Aligned on schema, seed data, and candidate ranking flow.",
        effectivenessScore: 4,
      },
    });

    await tx.endorsement.upsert({
      where: {
        fromUserId_toUserId_skillId_groupId: {
          fromUserId: users.bima.id,
          toUserId: users.alya.id,
          skillId: "00000000-0000-4000-8000-000000000002",
          groupId: "20000000-0000-4000-8000-000000000001",
        },
      },
      update: {},
      create: {
        fromUserId: users.bima.id,
        toUserId: users.alya.id,
        skillId: "00000000-0000-4000-8000-000000000002",
        groupId: "20000000-0000-4000-8000-000000000001",
      },
    });
  }, {
    maxWait: 10000,
    timeout: 120000,
  });

  console.log("Seeded Sync development data.");
  console.log("Demo login password: sync-demo-123");
}

main()
  .catch((error) => {
    console.error("Failed to seed database.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
