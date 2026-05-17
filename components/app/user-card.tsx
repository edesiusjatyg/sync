import type { CSSProperties } from "react";
import { Clock3Icon, TargetIcon } from "lucide-react";

import { SkillBadge } from "@/components/app/skill-badge";
import { UserAvatar } from "@/components/app/user-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UserCardProps {
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  skills: {
    name: string;
    category: string;
    rating: number;
  }[];
  productiveHours: number[];
  goalTypes: string[];
  compatibilityScore: number;
  className?: string;
  style?: CSSProperties;
}

const hourLabels: Record<number, string> = {
  0: "Dini Hari",
  6: "Pagi",
  12: "Siang",
  17: "Sore",
  20: "Malam",
};

function formatGoal(goal: string) {
  return goal.replaceAll("_", " ");
}

export function UserCard({
  name,
  avatarUrl,
  bio,
  skills,
  productiveHours,
  goalTypes,
  compatibilityScore,
  className,
  style,
}: UserCardProps) {
  return (
    <article className={cn("surface-panel surface-grid overflow-hidden", className)} style={style}>
      <div className="space-y-8 p-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-4 min-w-0">
            <UserAvatar name={name} avatarUrl={avatarUrl} className="size-16 shrink-0" />
            <div className="min-w-0">
              <p className="section-kicker">Candidate</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold uppercase truncate">{name}</h2>
            </div>
          </div>
          <div className="border border-primary/20 bg-primary/10 px-4 py-3 text-right">
            <p className="section-kicker">Compatibility</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{Math.round(compatibilityScore * 100)}%</p>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{bio ?? "No bio shared yet."}</p>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock3Icon className="size-4 text-primary" />
            <p className="section-kicker">Productive Hours</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {productiveHours.map((hour) => (
              <Badge key={hour} variant="secondary" className="border border-primary/15 px-3 py-2 text-primary">
                {hourLabels[hour] ?? `${hour}:00`}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TargetIcon className="size-4 text-primary" />
            <p className="section-kicker">Current Goals</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {goalTypes.map((goal) => (
              <Badge key={goal} variant="outline" className="border border-border/80 px-3 py-2">
                {formatGoal(goal)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="section-kicker">Top Skills</p>
          <div className="flex flex-wrap gap-3">
            {skills.slice(0, 6).map((skill) => (
              <SkillBadge key={`${skill.category}-${skill.name}`} {...skill} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
