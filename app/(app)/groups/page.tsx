import { getMyGroups } from "@/app/actions/group.actions";
import type { ActionData } from "@/components/app/action-data";
import { GroupsOverview } from "@/components/app/groups-overview";
import { PageShell } from "@/components/app/page-shell";

type GroupSummary = ActionData<typeof getMyGroups>[number];

export default async function GroupsPage() {
  const result = await getMyGroups();
  const groups: GroupSummary[] = result.success ? result.data : [];
  const error = result.success ? null : result.error;

  return (
    <PageShell>
      <GroupsOverview initialGroups={groups} initialError={error} />
    </PageShell>
  );
}
