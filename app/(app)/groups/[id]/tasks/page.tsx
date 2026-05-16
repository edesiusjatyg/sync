import { getGroupDetail } from "@/app/actions/group.actions";
import { getGroupTasks } from "@/app/actions/task.actions";
import type { ActionData } from "@/components/app/action-data";
import { PageShell } from "@/components/app/page-shell";
import { TaskBoard } from "@/components/app/task-board";

type GroupDetail = ActionData<typeof getGroupDetail>;
type TaskItem = ActionData<typeof getGroupTasks>[number];

export default async function GroupTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [groupResult, tasksResult] = await Promise.all([
    getGroupDetail({ groupId: id }),
    getGroupTasks({ groupId: id }),
  ]);

  const group: GroupDetail | null = groupResult.success ? groupResult.data : null;
  const tasks: TaskItem[] = tasksResult.success ? tasksResult.data : [];
  const error = !groupResult.success ? groupResult.error : !tasksResult.success ? tasksResult.error : null;

  return (
    <PageShell>
      <TaskBoard
        groupId={id}
        groupName={group?.name ?? "Group"}
        members={
          group?.members.map((member) => ({
            userId: member.userId,
            name: member.name,
            avatarUrl: member.avatarUrl,
          })) ?? []
        }
        initialTasks={tasks}
        initialError={error}
      />
    </PageShell>
  );
}
