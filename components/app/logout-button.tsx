"use client";

import { useTransition } from "react";
import { LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await signOut({ callbackUrl: "/login" });
        });
      }}
    >
      <LogOutIcon />
      {isPending ? "Signing Out" : "Sign Out"}
    </Button>
  );
}
