'use server';

import { revalidatePath } from "next/cache";
import {
  GoalType,
  WorkStyleDriven,
  WorkStyleRole,
  WorkStyleSync,
  type Profile,
} from "@prisma/client";
import { z } from "zod";

import { auth, unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeMatchingVector } from "@/lib/matching";
import {
  AuthorizationError,
  getActionErrorMessage,
  getSessionUser,
  isProfileComplete,
  logActionError,
  uniqueStrings,
  type DataActionResult,
  type VoidActionResult,
} from "@/lib/utils";

const ratingSchema = z.number().int().min(1).max(10);
const skillInputSchema = z.object({
  skillId: z.string().uuid(),
  rating: ratingSchema,
});

const productiveHoursSchema = z
  .array(z.number().int().min(0).max(23))
  .min(1)
  .refine((hours) => new Set(hours).size === hours.length, "Hours must be unique.");

const goalTypesSchema = z.array(z.nativeEnum(GoalType)).min(1);

const onboardingProfileSchema = z.object({
  bio: z.string().trim().max(1000).optional(),
  productiveHours: productiveHoursSchema,
  workStyleSync: z.nativeEnum(WorkStyleSync),
  workStyleDriven: z.nativeEnum(WorkStyleDriven),
  workStyleRole: z.nativeEnum(WorkStyleRole),
  goalTypes: goalTypesSchema,
  skills: z
    .array(skillInputSchema)
    .min(1)
    .refine(
      (skills) => new Set(skills.map((skill) => skill.skillId)).size === skills.length,
      "Skills must be unique.",
    ),
});

const updateProfileSchema = onboardingProfileSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

interface ProfileWithSkills {
  userId: string;
  bio: string | null;
  productiveHours: number[];
  workStyleSync: WorkStyleSync;
  workStyleDriven: WorkStyleDriven;
  workStyleRole: WorkStyleRole;
  goalTypes: GoalType[];
  matchingVector: number[];
  updatedAt: string;
  skills: {
    skillId: string;
    name: string;
    category: string;
    rating: number;
  }[];
}

type PersistedProfileInput = z.infer<typeof onboardingProfileSchema>;

async function getAuthenticatedUserId() {
  const user = getSessionUser(await auth());

  if (!user) {
    throw new AuthorizationError();
  }

  return user.id;
}

async function writeProfile(userId: string, input: PersistedProfileInput) {
  return db.$transaction(async (tx) => {
    const profile = await tx.profile.upsert({
      where: { userId },
      update: {
        bio: input.bio?.trim() || null,
        productiveHours: [...input.productiveHours],
        workStyleSync: input.workStyleSync,
        workStyleDriven: input.workStyleDriven,
        workStyleRole: input.workStyleRole,
        goalTypes: [...input.goalTypes],
      },
      create: {
        userId,
        bio: input.bio?.trim() || null,
        productiveHours: [...input.productiveHours],
        workStyleSync: input.workStyleSync,
        workStyleDriven: input.workStyleDriven,
        workStyleRole: input.workStyleRole,
        goalTypes: [...input.goalTypes],
        matchingVector: [],
      },
    });

    await tx.userSkill.deleteMany({
      where: { userId },
    });

    await tx.userSkill.createMany({
      data: input.skills.map((skill) => ({
        userId,
        skillId: skill.skillId,
        rating: skill.rating,
      })),
    });

    const [allSkills, persistedSkills] = await Promise.all([
      tx.skill.findMany({
        orderBy: { id: "asc" },
        select: { id: true },
      }),
      tx.userSkill.findMany({
        where: { userId },
      }),
    ]);

    const matchingVector = computeMatchingVector(
      profile as Profile,
      persistedSkills,
      allSkills.map((skill) => skill.id),
    );

    const updatedProfile = await tx.profile.update({
      where: { userId },
      data: { matchingVector },
    });

    return {
      profile: updatedProfile,
      userSkillCount: persistedSkills.length,
    };
  });
}

function mapProfileWithSkills(profile: {
  userId: string;
  bio: string | null;
  productiveHours: number[];
  workStyleSync: WorkStyleSync;
  workStyleDriven: WorkStyleDriven;
  workStyleRole: WorkStyleRole;
  goalTypes: GoalType[];
  matchingVector: number[];
  updatedAt: Date;
  user: {
    userSkills: {
      skillId: string;
      rating: number;
      skill: {
        name: string;
        category: string;
      };
    }[];
  };
}): ProfileWithSkills {
  return {
    userId: profile.userId,
    bio: profile.bio,
    productiveHours: [...profile.productiveHours],
    workStyleSync: profile.workStyleSync,
    workStyleDriven: profile.workStyleDriven,
    workStyleRole: profile.workStyleRole,
    goalTypes: [...profile.goalTypes],
    matchingVector: [...profile.matchingVector],
    updatedAt: profile.updatedAt.toISOString(),
    skills: profile.user.userSkills.map((skill) => ({
      skillId: skill.skillId,
      name: skill.skill.name,
      category: skill.skill.category,
      rating: skill.rating,
    })),
  };
}

export async function saveOnboardingProfile(
  input: z.infer<typeof onboardingProfileSchema>,
): Promise<VoidActionResult> {
  try {
    const userId = await getAuthenticatedUserId();
    const parsed = onboardingProfileSchema.parse(input);
    const dedupedGoalTypes = uniqueStrings(parsed.goalTypes) as GoalType[];
    const result = await writeProfile(userId, {
      ...parsed,
      goalTypes: dedupedGoalTypes,
    });

    await unstable_update({
      user: {
        hasCompletedOnboarding: isProfileComplete(result.profile, result.userSkillCount),
      } as never,
    });

    revalidatePath("/onboarding");
    revalidatePath("/discover");

    return { success: true };
  } catch (error) {
    logActionError("saveOnboardingProfile", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to save your profile."),
    };
  }
}

export async function getMyProfile(): Promise<DataActionResult<ProfileWithSkills | null>> {
  try {
    const userId = await getAuthenticatedUserId();

    const profile = await db.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            userSkills: {
              include: {
                skill: {
                  select: {
                    name: true,
                    category: true,
                  },
                },
              },
              orderBy: {
                skill: {
                  name: "asc",
                },
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: profile ? mapProfileWithSkills(profile) : null,
    };
  } catch (error) {
    logActionError("getMyProfile", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load your profile."),
    };
  }
}

export async function updateProfile(
  input: z.infer<typeof updateProfileSchema>,
): Promise<VoidActionResult> {
  try {
    const userId = await getAuthenticatedUserId();
    const parsed = updateProfileSchema.parse(input);

    const existingProfile = await db.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            userSkills: {
              select: {
                skillId: true,
                rating: true,
              },
            },
          },
        },
      },
    });

    if (!existingProfile) {
      return { success: false, error: "Profile not found." };
    }

    const mergedSkills =
      parsed.skills?.map((skill) => ({
        skillId: skill.skillId,
        rating: skill.rating,
      })) ??
      existingProfile.user.userSkills.map((skill) => ({
        skillId: skill.skillId,
        rating: skill.rating,
      }));

    const result = await writeProfile(userId, {
      bio: parsed.bio ?? existingProfile.bio ?? undefined,
      productiveHours: parsed.productiveHours ?? existingProfile.productiveHours,
      workStyleSync: parsed.workStyleSync ?? existingProfile.workStyleSync,
      workStyleDriven: parsed.workStyleDriven ?? existingProfile.workStyleDriven,
      workStyleRole: parsed.workStyleRole ?? existingProfile.workStyleRole,
      goalTypes:
        (parsed.goalTypes ? (uniqueStrings(parsed.goalTypes) as GoalType[]) : existingProfile.goalTypes) ??
        [],
      skills: mergedSkills,
    });

    await unstable_update({
      user: {
        hasCompletedOnboarding: isProfileComplete(result.profile, result.userSkillCount),
      } as never,
    });

    revalidatePath("/onboarding");
    revalidatePath("/discover");

    return { success: true };
  } catch (error) {
    logActionError("updateProfile", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to update your profile."),
    };
  }
}
