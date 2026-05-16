import { DiscoverBoard } from "@/components/app/discover-board";
import { PageShell } from "@/components/app/page-shell";

export default function DiscoverPage() {
  return (
    <PageShell className="space-y-6">
      <div className="space-y-3">
        <p className="section-kicker">Discover</p>
        <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">Swipe into balanced teams.</h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          Sync. ranks people by complementarity, overlapping productive hours, and goal alignment.
          Like who fits. Pass on who doesn&apos;t.
        </p>
      </div>
      <DiscoverBoard />
    </PageShell>
  );
}
