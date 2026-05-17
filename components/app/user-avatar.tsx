import Image from "next/image";

import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  return (
    <div
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-secondary text-xs font-semibold tracking-[0.2em] text-primary uppercase",
        className,
      )}
    >
      {avatarUrl ? (
        <Image unoptimized src={avatarUrl} alt={name} fill sizes="64px" className="object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
