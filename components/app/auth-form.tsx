"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getMyMatches } from "@/app/actions/match.actions";
import { getCandidates } from "@/app/actions/swipe.actions";
import { registerUser } from "@/app/actions/auth.actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
});

type AuthFormValues = {
  name?: string;
  email: string;
  password: string;
};

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AuthFormValues>({
    defaultValues: {
      email: "",
      password: "",
      ...(mode === "register" ? { name: "" } : {}),
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    startTransition(async () => {
      if (mode === "login") {
        const parsed = loginSchema.safeParse(values);

        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const fieldName = issue.path[0];

            if (typeof fieldName === "string") {
              setError(fieldName as keyof AuthFormValues, {
                type: "validate",
                message: issue.message,
              });
            }
          }

          return;
        }

        const result = await signIn("credentials", {
          email: parsed.data.email,
          password: parsed.data.password,
          redirect: false,
        });

        if (result?.error) {
          setFormError("Incorrect email or password.");
          return;
        }

        // Pre-warm the cache for better UX. Fire and forget so we don't block the redirect.
        // We wait for getCandidates to finish before getMyMatches as requested.
        getCandidates()
          .then(() => getMyMatches())
          .catch((error) => console.error("Cache pre-warming failed:", error));

        router.push("/discover");
        router.refresh();
        return;
      }

      const parsed = registerSchema.safeParse(values);

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const fieldName = issue.path[0];

          if (typeof fieldName === "string") {
            setError(fieldName as keyof AuthFormValues, {
              type: "validate",
              message: issue.message,
            });
          }
        }

        return;
      }

      const result = await registerUser(parsed.data);

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      router.push("/discover");
      router.refresh();
    });
  });

  return (
    <Card className="surface-panel w-full max-w-xl py-0">
      <CardHeader className="border-b border-border/80 py-8">
        <p className="section-kicker">{mode === "login" ? "Welcome Back" : "Create Account"}</p>
        <CardTitle className="text-3xl md:text-5xl">
          {mode === "login" ? "Sign in to continue matching." : "Start building your study profile."}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Use your credentials to return to your queue, matches, and groups."
            : "Registration signs you in automatically, then middleware routes you into onboarding if needed."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 py-8">
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t continue</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-6" onSubmit={onSubmit}>
          {mode === "register" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" autoComplete="name" {...register("name")} aria-invalid={Boolean(errors.name)} />
              {errors.name?.message ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email?.message ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              {...register("password")}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password?.message ? (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            ) : null}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending
              ? mode === "login"
                ? "Signing In"
                : "Creating Account"
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {mode === "login" ? "Need an account?" : "Already registered?"}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Register here" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
