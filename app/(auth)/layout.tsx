import type { ReactNode } from "react";

const FeatureCards = () => (
  <div className="grid gap-4 text-sm text-muted-foreground grid-cols-1 sm:grid-cols-3">
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
);

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-8 md:px-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        
        <section className="surface-panel surface-grid relative flex flex-col gap-8 overflow-hidden p-6 md:p-10 lg:order-1 lg:justify-between">
          <div className="space-y-5">
            <p className="section-kicker">Study Matchmaker</p>
            <h1 className="max-w-xl font-heading text-3xl font-bold leading-none uppercase text-balance md:text-5xl lg:text-6xl">
              Build study groups with complementary strengths.
            </h1>
            <p className="max-w-lg text-sm leading-8 text-muted-foreground md:text-base">
              Sync. helps students find collaborators who cover missing skills, overlap in productive
              hours, and actually want the same outcome.
            </p>
          </div>
          <div className="hidden lg:block">
            <FeatureCards />
          </div>
        </section>

        <section className="flex items-center justify-center w-full md:mx-auto md:max-w-2xl lg:mx-0 lg:max-w-none lg:order-2">
          {children}
        </section>

        <section className="hidden md:block lg:hidden w-full md:mx-auto md:max-w-2xl order-3">
          <FeatureCards />
        </section>

      </div>
    </div>
  );
}
