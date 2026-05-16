import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageShellProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
}

export function PageShell({ children, className, ...props }: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props}>
      {children}
    </div>
  );
}
