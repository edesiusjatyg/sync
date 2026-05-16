import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser, isProfileComplete, type SessionUser } from "@/lib/utils";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type AuthorizedUser = SessionUser;

async function findUserForAuth(email: string) {
  return db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      isActive: true,
      profile: {
        select: {
          goalTypes: true,
        },
      },
      userSkills: {
        select: {
          skillId: true,
        },
        take: 1,
      },
    },
  });
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(rawCredentials) {
        const credentials = credentialsSchema.safeParse(rawCredentials);

        if (!credentials.success) {
          return null;
        }

        const user = await findUserForAuth(credentials.data.email.toLowerCase());

        if (!user || !user.isActive) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(credentials.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hasCompletedOnboarding: isProfileComplete(user.profile, user.userSkills.length),
        } satisfies AuthorizedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authorizedUser = user as AuthorizedUser;
        token.id = authorizedUser.id;
        token.email = authorizedUser.email;
        token.name = authorizedUser.name;
        token.role = authorizedUser.role;
        token.hasCompletedOnboarding = authorizedUser.hasCompletedOnboarding;
      }

      if (trigger === "update" && session?.user) {
        const updatedUser = session.user as Partial<SessionUser>;

        if (typeof updatedUser.name === "string") {
          token.name = updatedUser.name;
        }

        if (typeof updatedUser.email === "string") {
          token.email = updatedUser.email;
        }

        if (updatedUser.role === "student" || updatedUser.role === "admin") {
          token.role = updatedUser.role;
        }

        if (typeof updatedUser.hasCompletedOnboarding === "boolean") {
          token.hasCompletedOnboarding = updatedUser.hasCompletedOnboarding;
        }
      }

      return token;
    },
    async session({ session, token }) {
      const currentUser = getSessionUser(session);
      const sessionUser = {
        ...(session.user ?? {}),
        id: typeof token.id === "string" ? token.id : currentUser?.id ?? "",
        email: typeof token.email === "string" ? token.email : currentUser?.email ?? "",
        name: typeof token.name === "string" ? token.name : currentUser?.name ?? "",
        role: token.role === "admin" ? "admin" : "student",
        hasCompletedOnboarding: Boolean(token.hasCompletedOnboarding),
      };

      session.user = sessionUser as typeof session.user;

      return session;
    },
  },
});
