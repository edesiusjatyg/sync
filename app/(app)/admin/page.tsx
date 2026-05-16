import { getAdminGroups, getAdminUsers } from "@/app/actions/admin.actions";
import type { ActionData } from "@/components/app/action-data";
import { AdminDashboard } from "@/components/app/admin-dashboard";
import { PageShell } from "@/components/app/page-shell";

type AdminUserRow = ActionData<typeof getAdminUsers>[number];
type AdminGroupRow = ActionData<typeof getAdminGroups>[number];

export default async function AdminPage() {
  const [usersResult, groupsResult] = await Promise.all([getAdminUsers(), getAdminGroups()]);

  const users: AdminUserRow[] = usersResult.success ? usersResult.data : [];
  const groups: AdminGroupRow[] = groupsResult.success ? groupsResult.data : [];
  const error = !usersResult.success ? usersResult.error : !groupsResult.success ? groupsResult.error : null;

  return (
    <PageShell>
      <AdminDashboard initialUsers={users} initialGroups={groups} initialError={error} />
    </PageShell>
  );
}
