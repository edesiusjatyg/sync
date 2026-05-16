import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/utils";
import { getGroupDetail } from "@/app/actions/group.actions";
import type { ActionData } from "@/components/app/action-data";
import { GroupOverview } from "@/components/app/group-overview";
import { PageShell } from "@/components/app/page-shell";

type GroupDetail = ActionData<typeof getGroupDetail>;

export default async function GroupOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, groupResult] = await Promise.all([auth(), getGroupDetail({ groupId: id })]);
  const user = getSessionUser(session);
  const group: GroupDetail | null = groupResult.success ? groupResult.data : null;
  const error = groupResult.success ? null : groupResult.error;

  return (
    <PageShell>
      <GroupOverview group={group} currentUserId={user?.id ?? ""} initialError={error} />
    </PageShell>
  );
}
