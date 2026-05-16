"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { PlusIcon, StarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getGroupSessions, logSession, submitEffectivenessScore } from "@/app/actions/session.actions";
import type { ActionData } from "@/components/app/action-data";
import { GroupRouteNav } from "@/components/app/group-route-nav";
import { UserAvatar } from "@/components/app/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SessionItem = ActionData<typeof getGroupSessions>[number];

const sessionSchema = z.object({
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

interface SessionLogProps {
  groupId: string;
  groupName: string;
  currentUserId: string;
  initialSessions: SessionItem[];
  initialError?: string | null;
}

export function SessionLog({
  groupId,
  groupName,
  currentUserId,
  initialSessions,
  initialError = null,
}: SessionLogProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<z.infer<typeof sessionSchema>>({
    defaultValues: {
      startedAt: "",
      endedAt: "",
      notes: "",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="section-kicker">{groupName}</p>
          <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">Session log</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Record your sessions with start and end times, then score their effectiveness after the fact.
          </p>
        </div>
        <GroupRouteNav groupId={groupId} current="sessions" />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t update sessions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="surface-panel py-0">
        <CardHeader className="border-b border-border/80 py-6 flex-row items-center justify-between">
          <CardTitle>Log Session</CardTitle>
          <Button variant="outline" onClick={() => setShowForm((value) => !value)}>
            <PlusIcon />
            {showForm ? "Hide Form" : "Log Session"}
          </Button>
        </CardHeader>
        {showForm ? (
          <CardContent className="grid gap-5 py-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="started-at">Start Time</Label>
              <Input id="started-at" type="datetime-local" {...register("startedAt")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ended-at">End Time</Label>
              <Input id="ended-at" type="datetime-local" {...register("endedAt")} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={4} {...register("notes")} />
            </div>
            <div className="lg:col-span-2 flex justify-end">
              <Button
                onClick={handleSubmit((values) => {
                  const parsed = sessionSchema.safeParse(values);

                  if (!parsed.success) {
                    setError("Provide a valid session time range.");
                    return;
                  }

                  setError(null);
                  startTransition(async () => {
                    const result = await logSession({
                      groupId,
                      startedAt: new Date(parsed.data.startedAt),
                      endedAt: new Date(parsed.data.endedAt),
                      notes: parsed.data.notes?.trim() || undefined,
                    });

                    if (!result.success) {
                      setError(result.error);
                      return;
                    }

                    reset();
                    setShowForm(false);
                    router.refresh();
                  });
                })}
                disabled={isPending}
              >
                Save Session
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-5">
        {initialSessions.length === 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">No sessions logged for this group yet.</p>
        ) : (
          initialSessions.map((session) => (
            <Card key={session.sessionId} className="surface-panel py-0">
              <CardHeader className="border-b border-border/80 py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <UserAvatar name={session.logger.name} avatarUrl={session.logger.avatarUrl} className="size-12" />
                    <div>
                      <CardTitle className="text-2xl">{format(new Date(session.startedAt), "dd MMM yyyy")}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Logged by {session.logger.name} · {session.durationMinutes} minutes
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(session.startedAt), "HH:mm")} - {format(new Date(session.endedAt), "HH:mm")}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 py-6">
                <p className="text-sm leading-7 text-muted-foreground">{session.notes ?? "No notes added."}</p>
                {session.effectivenessScore ? (
                  <div className="flex items-center gap-2 text-primary">
                    {Array.from({ length: session.effectivenessScore }, (_, index) => (
                      <StarIcon key={`${session.sessionId}-${index}`} className="size-4 fill-current" />
                    ))}
                    <span className="text-sm text-muted-foreground">{session.effectivenessScore}/5 effectiveness</span>
                  </div>
                ) : session.logger.userId === currentUserId ? (
                  <div className="space-y-3">
                    <p className="section-kicker">Rate Effectiveness</p>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <Button
                          key={`${session.sessionId}-${score}`}
                          variant="outline"
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              const result = await submitEffectivenessScore({
                                sessionId: session.sessionId,
                                score,
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
                          {score} Star{score > 1 ? "s" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Awaiting the logger&apos;s effectiveness score.</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
