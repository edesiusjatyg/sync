import type { ReactNode } from "react";

import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/utils";
import { AppChrome } from "@/components/app/app-chrome";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = getSessionUser(await auth());

  return <AppChrome user={user}>{children}</AppChrome>;
}
