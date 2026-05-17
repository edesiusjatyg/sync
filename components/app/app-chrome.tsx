"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, ShieldCheckIcon } from "lucide-react";

import type { SessionUser } from "@/lib/utils";
import { PageShell } from "@/components/app/page-shell";
import { LogoutButton } from "@/components/app/logout-button";
import { UserAvatar } from "@/components/app/user-avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

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
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const links = user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : studentLinks;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur">
        <PageShell className="flex items-center justify-between py-5">
          <div className="space-y-1">
            <Link href={user?.role === "admin" ? "/admin" : "/discover"} className="section-kicker">
              Sync.
            </Link>
            <h1 className="font-heading text-xl font-bold uppercase md:text-2xl">Balanced Study Groups</h1>
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-4">
            <nav className="flex gap-2">
              {links.map((link) => {
                const isActive = pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`border px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase transition-colors hover:border-primary hover:text-primary ${
                      isActive ? "border-primary text-primary" : "border-border/80 bg-background"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
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

          <div className="lg:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-border/80 bg-background text-foreground transition-colors hover:bg-muted">
                <MenuIcon className="size-5" />
                <span className="sr-only">Open Menu</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-80">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col gap-6 pt-10">
                  <nav className="flex flex-col gap-3">
                    {links.map((link) => {
                      const isActive = pathname?.startsWith(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`block border p-4 text-sm font-semibold tracking-[0.2em] uppercase transition-colors hover:border-primary hover:text-primary ${
                            isActive ? "border-primary bg-primary/10 text-primary" : "border-border/80 bg-background"
                          }`}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>

                  {user ? (
                    <>
                      <div className="h-px bg-border/80" />
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.name} className="size-12" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{user.name}</p>
                            <p className="truncate text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              {user.role === "admin" ? "Platform Admin" : user.email}
                            </p>
                          </div>
                          {user.role === "admin" ? <ShieldCheckIcon className="size-5 text-primary" /> : null}
                        </div>
                        <LogoutButton />
                      </div>
                    </>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </PageShell>
      </header>
      <main className="py-8 sm:py-10">{children}</main>
    </div>
  );
}
