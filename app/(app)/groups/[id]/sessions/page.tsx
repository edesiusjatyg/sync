import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/utils";
import { getGroupDetail } from "@/app/actions/group.actions";
import { getGroupSessions } from "@/app/actions/session.actions";
import type { ActionData } from "@/components/app/action-data";
import { PageShell } from "@/components/app/page-shell";
import { SessionLog } from "@/components/app/session-log";

type GroupDetail = ActionData<typeof getGroupDetail>;
type SessionItem = ActionData<typeof getGroupSessions>[number];

export default async function GroupSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, groupResult, sessionsResult] = await Promise.all([
    auth(),
    getGroupDetail({ groupId: id }),
    getGroupSessions({ groupId: id }),
  ]);

  const user = getSessionUser(session);
  const group: GroupDetail | null = groupResult.success ? groupResult.data : null;
  const sessions: SessionItem[] = sessionsResult.success ? sessionsResult.data : [];
  const error = !groupResult.success ? groupResult.error : !sessionsResult.success ? sessionsResult.error : null;

  return (
    <PageShell>
      <SessionLog
        groupId={id}
        groupName={group?.name ?? "Group"}
        currentUserId={user?.id ?? ""}
        initialSessions={sessions}
        initialError={error}
      />
    </PageShell>
  );
}
