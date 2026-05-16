"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  activateUser,
  changeUserRole,
  deactivateUser,
  deleteGroup,
  getAdminGroups,
  getAdminUsers,
} from "@/app/actions/admin.actions";
import type { ActionData } from "@/components/app/action-data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminUserRow = ActionData<typeof getAdminUsers>[number];
type AdminGroupRow = ActionData<typeof getAdminGroups>[number];

interface AdminDashboardProps {
  initialUsers: AdminUserRow[];
  initialGroups: AdminGroupRow[];
  initialError?: string | null;
}

export function AdminDashboard({
  initialUsers,
  initialGroups,
  initialError = null,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="section-kicker">Moderation</p>
        <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">Admin dashboard</h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          Review user activity, deactivate accounts, shift roles, and remove groups when moderation is needed.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t complete admin action</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button variant={activeTab === "users" ? "default" : "outline"} onClick={() => setActiveTab("users")}>
          Users
        </Button>
        <Button variant={activeTab === "groups" ? "default" : "outline"} onClick={() => setActiveTab("groups")}>
          Groups
        </Button>
      </div>

      {activeTab === "users" ? (
        <div className="surface-panel p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.hasCompletedOnboarding ? "Complete" : "Incomplete"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = user.isActive
                              ? await deactivateUser({ userId: user.userId })
                              : await activateUser({ userId: user.userId });

                            if (!result.success) {
                              setError(result.error);
                              return;
                            }

                            router.refresh();
                          });
                        }}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await changeUserRole({
                              userId: user.userId,
                              role: user.role === "admin" ? "student" : "admin",
                            });

                            if (!result.success) {
                              setError(result.error);
                              return;
                            }

                            router.refresh();
                          });
                        }}
                      >
                        Make {user.role === "admin" ? "Student" : "Admin"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="surface-panel p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialGroups.map((group) => (
                <TableRow key={group.groupId}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>{group.memberCount}</TableCell>
                  <TableCell>{group.creatorName}</TableCell>
                  <TableCell>{group.createdAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant={group.isOpen ? "secondary" : "outline"}>
                      {group.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          const result = await deleteGroup({ groupId: group.groupId });

                          if (!result.success) {
                            setError(result.error);
                            return;
                          }

                          router.refresh();
                        });
                      }}
                    >
                      Delete Group
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
