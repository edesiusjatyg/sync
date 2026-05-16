import { CompassIcon } from "lucide-react";

import { LoadingSpinner } from "@/components/app/loading-spinner";
import { PageShell } from "@/components/app/page-shell";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <PageShell className="flex min-h-screen items-center justify-center py-16">
        <div className="surface-panel surface-grid flex w-full max-w-2xl flex-col items-center gap-6 p-12 text-center">
          <div className="flex size-18 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <CompassIcon className="size-8" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.28em] text-primary uppercase">Sync.</p>
            <h1 className="font-heading text-4xl font-bold uppercase text-balance sm:text-5xl">
              Routing you into the right study room.
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              The root route is protected by `proxy.ts` and redirects to the correct destination for
              each signed-in user. This screen is just a fast fallback while that handoff resolves.
            </p>
          </div>
          <LoadingSpinner label="Checking your route..." />
        </div>
      </PageShell>
    </main>
  );
}
