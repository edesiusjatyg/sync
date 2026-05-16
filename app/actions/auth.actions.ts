'use server';

import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { signIn } from "@/lib/auth";
import {
  getActionErrorMessage,
  logActionError,
  type DataActionResult,
} from "@/lib/utils";

const registerUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

export async function registerUser(
  input: z.infer<typeof registerUserSchema>,
): Promise<DataActionResult<{ userId: string }>> {
  try {
    const { name, email, password } = registerUserSchema.parse(input);
    const normalizedEmail = email.toLowerCase();

    const passwordHash = await bcrypt.hash(password, 12);

    let user;
    try {
      user = await db.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { success: false, error: "An account with this email already exists." };
      }
      throw error;
    }

    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
    });

    return {
      success: true,
      data: {
        userId: user.id,
      },
    };
  } catch (error) {
    logActionError("registerUser", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to register user."),
    };
  }
}
