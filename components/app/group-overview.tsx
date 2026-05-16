"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailSearchIcon, UsersIcon } from "lucide-react";

import {
  getGroupDetail,
  inviteMember,
  kickMember,
  leaveGroup,
  searchUsersForGroupInvite,
  transferAdmin,
  updateGroupInfo,
} from "@/app/actions/group.actions";
import type { ActionData } from "@/components/app/action-data";
import { EmptyState } from "@/components/app/empty-state";
import { GroupRouteNav } from "@/components/app/group-route-nav";
import { SkillBadge } from "@/components/app/skill-badge";
import { UserAvatar } from "@/components/app/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type GroupDetail = ActionData<typeof getGroupDetail>;
type InviteCandidate = ActionData<typeof searchUsersForGroupInvite>[number];

interface GroupOverviewProps {
  group: GroupDetail | null;
  currentUserId: string;
  initialError?: string | null;
}

function formatGoal(goal: string) {
  return goal.replaceAll("_", " ");
}

export function GroupOverview({
  group,
  currentUserId,
  initialError = null,
}: GroupOverviewProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<InviteCandidate[]>([]);
  const [isPending, startTransition] = useTransition();

  const [draftName, setDraftName] = useState(group?.name ?? "");
  const [draftMaxMembers, setDraftMaxMembers] = useState(group?.maxMembers ?? 5);
  const [draftIsOpen, setDraftIsOpen] = useState(group?.isOpen ?? true);
  const isAdmin = group?.currentUserRole === "admin";

  const memberCount = group?.members.length ?? 0;

  async function handleSaveGroupInfo() {
    if (!group) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await updateGroupInfo({
        groupId: group.groupId,
        name: draftName,
        maxMembers: draftMaxMembers,
        isOpen: draftIsOpen,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  async function handleSearchInvite() {
    if (!group || !inviteQuery.trim()) {
      return;
    }

    setError(null);
    const result = await searchUsersForGroupInvite({
      groupId: group.groupId,
      query: inviteQuery.trim(),
    });

    if (!result.success) {
      setError(result.error);
      setInviteResults([]);
      return;
    }

    setInviteResults(result.data);
  }

  if (!group) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Group unavailable"
        description={initialError ?? "This group could not be loaded or you no longer have access to it."}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t update the group</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="section-kicker">Group Dashboard</p>
            <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">{group.name}</h1>
            <div className="flex flex-wrap gap-2">
              {group.goalTypes.map((goal) => (
                <Badge key={`${group.groupId}-${goal}`} variant="outline" className="border border-border/80 px-3 py-2">
                  {formatGoal(goal)}
                </Badge>
              ))}
            </div>
          </div>
          <GroupRouteNav groupId={group.groupId} current="overview" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="border border-border/80 bg-card p-5">
            <p className="section-kicker">Members</p>
            <p className="mt-3 text-3xl font-semibold">{memberCount}</p>
          </div>
          <div className="border border-border/80 bg-card p-5">
            <p className="section-kicker">Capacity</p>
            <p className="mt-3 text-3xl font-semibold">{group.maxMembers}</p>
          </div>
          <div className="border border-border/80 bg-card p-5">
            <p className="section-kicker">Status</p>
            <p className="mt-3 text-3xl font-semibold text-primary">{group.isOpen ? "Open" : "Closed"}</p>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <Card className="surface-panel py-0">
          <CardHeader className="border-b border-border/80 py-6">
            <CardTitle>Admin Controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 py-6 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input id="group-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-members">Max Members</Label>
              <Input
                id="max-members"
                type="number"
                min={Math.max(2, memberCount)}
                max={10}
                value={draftMaxMembers}
                onChange={(event) => setDraftMaxMembers(Number(event.target.value))}
              />
            </div>
            <div className="space-y-4">
              <Label htmlFor="is-open">Group Open</Label>
              <div className="flex items-center justify-between border border-border/80 px-4 py-3">
                <div>
                  <p className="font-medium">{draftIsOpen ? "Visible for invites" : "Closed to invites"}</p>
                  <p className="text-sm text-muted-foreground">
                    Members stay intact either way.
                  </p>
                </div>
                <Switch
                  id="is-open"
                  checked={draftIsOpen}
                  onCheckedChange={(checked) => setDraftIsOpen(Boolean(checked))}
                />
              </div>
            </div>
            <div className="lg:col-span-3 flex justify-end">
              <Button onClick={() => void handleSaveGroupInfo()} disabled={isPending}>
                Save Group Info
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card className="surface-panel py-0">
          <CardHeader className="border-b border-border/80 py-6">
            <CardTitle>Invite Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 py-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={inviteQuery}
                onChange={(event) => setInviteQuery(event.target.value)}
                placeholder="Search by email or name"
              />
              <Button variant="outline" onClick={() => void handleSearchInvite()}>
                <MailSearchIcon />
                Search
              </Button>
            </div>
            {inviteResults.length > 0 ? (
              <div className="grid gap-3">
                {inviteResults.map((candidate) => (
                  <div key={candidate.userId} className="flex flex-col gap-4 border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={candidate.name} avatarUrl={candidate.avatarUrl} />
                      <div>
                        <p className="font-semibold">{candidate.name}</p>
                        <p className="text-sm text-muted-foreground">{candidate.email}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        startTransition(async () => {
                          const result = await inviteMember({
                            groupId: group.groupId,
                            userId: candidate.userId,
                          });

                          if (!result.success) {
                            setError(result.error);
                            return;
                          }

                          setInviteQuery("");
                          setInviteResults([]);
                          router.refresh();
                        });
                      }}
                      disabled={isPending}
                    >
                      Invite
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="surface-panel py-0">
        <CardHeader className="border-b border-border/80 py-6">
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-6">
          {group.members.map((member) => (
            <div key={member.userId} className="border border-border/80 p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={member.name} avatarUrl={member.avatarUrl} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{member.name}</p>
                        <Badge variant={member.role === "admin" ? "secondary" : "outline"}>{member.role}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {member.skills.map((skill) => (
                      <SkillBadge key={`${member.userId}-${skill.name}`} {...skill} />
                    ))}
                  </div>
                </div>
                {isAdmin && member.userId !== currentUserId ? (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        startTransition(async () => {
                          const result = await transferAdmin({
                            groupId: group.groupId,
                            userId: member.userId,
                          });

                          if (!result.success) {
                            setError(result.error);
                            return;
                          }

                          router.refresh();
                        });
                      }}
                      disabled={isPending}
                    >
                      Transfer Admin
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        startTransition(async () => {
                          const result = await kickMember({
                            groupId: group.groupId,
                            userId: member.userId,
                          });

                          if (!result.success) {
                            setError(result.error);
                            return;
                          }

                          router.refresh();
                        });
                      }}
                      disabled={isPending}
                    >
                      Kick Member
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface-panel py-0">
        <CardHeader className="border-b border-border/80 py-6">
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 py-6 lg:grid-cols-2">
          <div className="border border-border/80 p-5">
            <p className="section-kicker">Tasks</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {group.tasks.length > 0 ? `${group.tasks.length} task(s) currently tracked.` : "No tasks yet."}
            </p>
            <Link href={`/groups/${group.groupId}/tasks`} className={cn(buttonVariants(), "mt-5 inline-flex")}>
              Open Task Board
            </Link>
          </div>
          <div className="border border-border/80 p-5">
            <p className="section-kicker">Sessions</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {group.recentSessions.length > 0
                ? `${group.recentSessions.length} recent session(s) recorded.`
                : "No sessions logged yet."}
            </p>
            <Link href={`/groups/${group.groupId}/sessions`} className={cn(buttonVariants(), "mt-5 inline-flex")}>
              Open Session Log
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={() => {
            startTransition(async () => {
              const result = await leaveGroup({ groupId: group.groupId });

              if (!result.success) {
                setError(result.error);
                return;
              }

              router.push("/groups");
              router.refresh();
            });
          }}
          disabled={isPending}
        >
          Leave Group
        </Button>
      </div>
    </div>
  );
}
