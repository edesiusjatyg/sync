import type { ReactNode } from "react";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="surface-panel surface-grid relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-5">
            <p className="section-kicker">Study Matchmaker</p>
            <h1 className="max-w-xl font-heading text-6xl font-bold leading-none uppercase text-balance">
              Build study groups with complementary strengths.
            </h1>
            <p className="max-w-lg text-base leading-8 text-muted-foreground">
              Sync. helps students find collaborators who cover missing skills, overlap in productive
              hours, and actually want the same outcome.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="border border-border/80 bg-background/70 p-4">
              <p className="section-kicker">Profile</p>
              <p className="mt-3 leading-7">Map your skills, work rhythm, and goals in one pass.</p>
            </div>
            <div className="border border-border/80 bg-background/70 p-4">
              <p className="section-kicker">Match</p>
              <p className="mt-3 leading-7">Swipe through ranked candidates who complement your stack.</p>
            </div>
            <div className="border border-border/80 bg-background/70 p-4">
              <p className="section-kicker">Ship</p>
              <p className="mt-3 leading-7">Turn mutual matches into group plans, tasks, and sessions.</p>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center">{children}</section>
      </div>
    </div>
  );
}
