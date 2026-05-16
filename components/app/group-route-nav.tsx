import Link from "next/link";

import { cn } from "@/lib/utils";

interface GroupRouteNavProps {
  groupId: string;
  current: "overview" | "tasks" | "sessions";
}

const tabs = [
  { key: "overview", href: (groupId: string) => `/groups/${groupId}`, label: "Overview" },
  { key: "tasks", href: (groupId: string) => `/groups/${groupId}/tasks`, label: "Tasks" },
  { key: "sessions", href: (groupId: string) => `/groups/${groupId}/sessions`, label: "Sessions" },
] as const;

export function GroupRouteNav({ groupId, current }: GroupRouteNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href(groupId)}
          className={cn(
            "border px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase transition-colors",
            current === tab.key
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/80 bg-background hover:border-primary hover:text-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
