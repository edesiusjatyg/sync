import { getMyMatches } from "@/app/actions/match.actions";
import type { ActionData } from "@/components/app/action-data";
import { MatchesPanel } from "@/components/app/matches-panel";
import { PageShell } from "@/components/app/page-shell";

type MatchItem = ActionData<typeof getMyMatches>[number];

export default async function MatchesPage() {
  const result = await getMyMatches();
  const matches: MatchItem[] = result.success ? result.data : [];
  const error = result.success ? null : result.error;

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="section-kicker">Mutual Matches</p>
          <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">People who liked you back.</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Use these accepted matches as the fastest path into real collaboration. Each one can become
            a group with tasks and study sessions immediately.
          </p>
        </div>
        <MatchesPanel initialMatches={matches} initialError={error} />
      </div>
    </PageShell>
  );
}
