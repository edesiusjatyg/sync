import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/utils";

const PUBLIC_ROUTES = ["/login", "/register"];
const PROTECTED_PREFIXES = ["/onboarding", "/discover", "/matches", "/groups", "/admin"];

function getAuthenticatedRedirectPath(user: ReturnType<typeof getSessionUser>) {
  if (!user) {
    return "/login";
  }

  if (user.role === "admin") {
    return "/admin";
  }

  return user.hasCompletedOnboarding ? "/discover" : "/onboarding";
}

// TODO: PRD specifies `middleware.ts`, but this Next.js version deprecates that
// convention in favor of `proxy.ts`, so route protection lives here.
export default auth((request) => {
  const user = getSessionUser(request.auth);
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (protectedPrefix) => pathname === protectedPrefix || pathname.startsWith(`${protectedPrefix}/`),
  );

  if (pathname === "/") {
    return NextResponse.redirect(new URL(getAuthenticatedRedirectPath(user), request.url));
  }

  if (isPublicRoute && user) {
    return NextResponse.redirect(new URL(getAuthenticatedRedirectPath(user), request.url));
  }

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user) {
    return NextResponse.next();
  }

  if (user.role === "student") {
    if (!user.hasCompletedOnboarding && pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    if (user.hasCompletedOnboarding && pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/discover", request.url));
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return NextResponse.redirect(new URL(getAuthenticatedRedirectPath(user), request.url));
    }
  }

  if (user.role === "admin" && (pathname === "/discover" || pathname.startsWith("/discover/"))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
