import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="surface-panel surface-grid flex flex-col items-center justify-center gap-5 p-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <Icon className="size-7" />
      </div>
      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-bold uppercase">{title}</h2>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}
