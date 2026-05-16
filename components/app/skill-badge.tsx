import { Badge } from "@/components/ui/badge";

interface SkillBadgeProps {
  name: string;
  rating: number;
  category?: string;
}

export function SkillBadge({ name, rating, category }: SkillBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 border border-border/80 bg-background px-3 py-2 text-xs">
      <div>
        <p className="font-medium uppercase">{name}</p>
        {category ? <p className="text-[0.65rem] text-muted-foreground uppercase">{category}</p> : null}
      </div>
      <Badge variant="secondary" className="ml-1 text-primary">
        {rating}/10
      </Badge>
    </div>
  );
}
