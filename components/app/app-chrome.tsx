import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";

import type { SessionUser } from "@/lib/utils";
import { PageShell } from "@/components/app/page-shell";
import { LogoutButton } from "@/components/app/logout-button";
import { UserAvatar } from "@/components/app/user-avatar";

interface AppChromeProps {
  children: ReactNode;
  user: SessionUser | null;
}

const studentLinks = [
  { href: "/discover", label: "Discover" },
  { href: "/matches", label: "Matches" },
  { href: "/groups", label: "Groups" },
];

export function AppChrome({ children, user }: AppChromeProps) {
  const links = user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : studentLinks;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur">
        <PageShell className="flex flex-col gap-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <Link href={user?.role === "admin" ? "/admin" : "/discover"} className="section-kicker">
              Sync.
            </Link>
            <h1 className="font-heading text-2xl font-bold uppercase">Balanced Study Groups</h1>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <nav className="flex flex-wrap gap-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border border-border/80 bg-background px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase transition-colors hover:border-primary hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {user ? (
              <div className="flex items-center gap-3 border border-border/80 bg-card px-3 py-2">
                <UserAvatar name={user.name} className="size-10" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {user.role === "admin" ? "Platform Admin" : user.email}
                  </p>
                </div>
                {user.role === "admin" ? <ShieldCheckIcon className="size-4 text-primary" /> : null}
                <LogoutButton />
              </div>
            ) : null}
          </div>
        </PageShell>
      </header>
      <main className="py-8 sm:py-10">{children}</main>
    </div>
  );
}
