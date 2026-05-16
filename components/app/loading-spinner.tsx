import { Spinner } from "@/components/ui/spinner";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({
  label = "Loading...",
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <Spinner className="size-5 text-primary" />
        <p>{label}</p>
      </div>
    </div>
  );
}
