"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanbanIcon } from "lucide-react";

import { getMyGroups } from "@/app/actions/group.actions";
import type { ActionData } from "@/components/app/action-data";
import { CreateGroupModal } from "@/components/app/create-group-modal";
import { EmptyState } from "@/components/app/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GroupSummary = ActionData<typeof getMyGroups>[number];

interface GroupsOverviewProps {
  initialGroups: GroupSummary[];
  initialError?: string | null;
}

function formatGoal(goal: string) {
  return goal.replaceAll("_", " ");
}

export function GroupsOverview({ initialGroups, initialError = null }: GroupsOverviewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="section-kicker">Workspace</p>
          <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">Your active groups</h1>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>New Group</Button>
      </div>

      {initialError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load groups</AlertTitle>
          <AlertDescription>{initialError}</AlertDescription>
        </Alert>
      ) : null}

      {initialGroups.length === 0 ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No groups yet"
          description="Create one from a match or start a new study room from scratch with your own goals and member cap."
          actionLabel="Create Group"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {initialGroups.map((group) => (
            <Card key={group.groupId} className="surface-panel py-0">
              <CardHeader className="border-b border-border/80 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-kicker">{group.currentUserRole === "admin" ? "Group Admin" : "Member"}</p>
                    <CardTitle className="text-3xl">{group.name}</CardTitle>
                  </div>
                  <Badge variant={group.isOpen ? "secondary" : "outline"} className="px-3 py-2">
                    {group.isOpen ? "Open" : "Closed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 py-6">
                <div className="flex flex-wrap gap-2">
                  {group.goalTypes.map((goal) => (
                    <Badge key={`${group.groupId}-${goal}`} variant="outline" className="border border-border/80 px-3 py-2">
                      {formatGoal(goal)}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="border border-border/70 p-4">
                    <p className="section-kicker">Members</p>
                    <p className="mt-2 text-2xl font-semibold">{group.memberCount}</p>
                  </div>
                  <div className="border border-border/70 p-4">
                    <p className="section-kicker">Capacity</p>
                    <p className="mt-2 text-2xl font-semibold">{group.maxMembers}</p>
                  </div>
                </div>
                <Link href={`/groups/${group.groupId}`} className={cn(buttonVariants(), "w-full")}>
                  Open Group
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateGroupModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
