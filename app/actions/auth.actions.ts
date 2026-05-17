'use server';

import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
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
          email: true,
          name: true,
          role: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { success: false, error: "An account with this email already exists." };
      }
      throw error;
    }

    const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") || process.env.NODE_ENV === "production";
    const cookieName = useSecureCookies ? "__Secure-authjs.session-token" : "authjs.session-token";

    const sessionToken = await encode({
      salt: cookieName,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCompletedOnboarding: false,
      },
    });

    (await cookies()).set(cookieName, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: useSecureCookies,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
