"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { PlusIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getGroupTasks, createTask, deleteTask, updateTask } from "@/app/actions/task.actions";
import type { ActionData } from "@/components/app/action-data";
import { GroupRouteNav } from "@/components/app/group-route-nav";
import { UserAvatar } from "@/components/app/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskItem = ActionData<typeof getGroupTasks>[number];
const unassignedValue = "__unassigned__";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  assignedToId: z.string().optional(),
  deadline: z.string().optional(),
});

interface TaskBoardProps {
  groupId: string;
  groupName: string;
  members: {
    userId: string;
    name: string;
    avatarUrl: string | null;
  }[];
  initialTasks: TaskItem[];
  initialError?: string | null;
}

const columns = [
  { key: "todo", title: "Todo" },
  { key: "in_progress", title: "In Progress" },
  { key: "done", title: "Done" },
] as const;

function nextStatus(status: TaskItem["status"]) {
  if (status === "todo") {
    return "in_progress";
  }

  if (status === "in_progress") {
    return "done";
  }

  return null;
}

export function TaskBoard({
  groupId,
  groupName,
  members,
  initialTasks,
  initialError = null,
}: TaskBoardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<z.infer<typeof createTaskSchema>>({
    defaultValues: {
      title: "",
      assignedToId: unassignedValue,
      deadline: "",
    },
  });

  const selectedAssignee = watch("assignedToId");
  const groupedTasks = columns.map((column) => ({
    ...column,
    tasks: initialTasks.filter((task) => task.status === column.key),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="section-kicker">{groupName}</p>
          <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">Task board</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Create tasks, move them through the allowed state transitions, and keep assignments visible.
          </p>
        </div>
        <GroupRouteNav groupId={groupId} current="tasks" />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t update tasks</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="surface-panel py-0">
        <CardHeader className="border-b border-border/80 py-6 flex-row items-center justify-between">
          <CardTitle>New Task</CardTitle>
          <Button variant="outline" onClick={() => setShowCreateForm((value) => !value)}>
            <PlusIcon />
            {showCreateForm ? "Hide Form" : "Add Task"}
          </Button>
        </CardHeader>
        {showCreateForm ? (
          <CardContent className="grid gap-5 py-6 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title")} />
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select
                value={selectedAssignee ?? unassignedValue}
                onValueChange={(value) => {
                  setValue("assignedToId", value ?? unassignedValue, { shouldDirty: true });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={unassignedValue}>Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" type="date" {...register("deadline")} />
            </div>
            <div className="lg:col-span-4 flex justify-end">
              <Button
                onClick={handleSubmit((values) => {
                  const parsed = createTaskSchema.safeParse(values);

                  if (!parsed.success) {
                    setError("Provide a task title and valid task data.");
                    return;
                  }

                  setError(null);
                  startTransition(async () => {
                    const result = await createTask({
                      groupId,
                      title: parsed.data.title,
                      assignedToId:
                        parsed.data.assignedToId && parsed.data.assignedToId !== unassignedValue
                          ? parsed.data.assignedToId
                          : undefined,
                      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
                    });

                    if (!result.success) {
                      setError(result.error);
                      return;
                    }

                    reset();
                    setShowCreateForm(false);
                    router.refresh();
                  });
                })}
                disabled={isPending}
              >
                Create Task
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        {groupedTasks.map((column) => (
          <Card key={column.key} className="surface-panel py-0">
            <CardHeader className="border-b border-border/80 py-6">
              <CardTitle>{column.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-6">
              {column.tasks.length === 0 ? (
                <p className="text-sm leading-7 text-muted-foreground">No tasks in this column.</p>
              ) : (
                column.tasks.map((task) => (
                  <EditableTaskCard
                    key={task.taskId}
                    task={task}
                    members={members}
                    onError={setError}
                    onRefresh={() => router.refresh()}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EditableTaskCard({
  task,
  members,
  onError,
  onRefresh,
}: {
  task: TaskItem;
  members: TaskBoardProps["members"];
  onError: (message: string | null) => void;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.userId ?? unassignedValue);
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.slice(0, 10) : "");
  const [isPending, startTransition] = useTransition();
  const moveTarget = nextStatus(task.status);

  return (
    <div className="space-y-4 border border-border/80 bg-background p-4">
      <div className="space-y-2">
        <Label htmlFor={`task-title-${task.taskId}`}>Title</Label>
        <Input id={`task-title-${task.taskId}`} value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Assignee</Label>
        <Select value={assignedToId} onValueChange={(value) => setAssignedToId(value ?? unassignedValue)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={unassignedValue}>Unassigned</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`task-deadline-${task.taskId}`}>Deadline</Label>
        <Input
          id={`task-deadline-${task.taskId}`}
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
        />
      </div>

      {task.assignedTo ? (
        <div className="flex items-center gap-3 border border-border/80 p-3">
          <UserAvatar name={task.assignedTo.name} avatarUrl={task.assignedTo.avatarUrl} className="size-9" />
          <p className="text-sm text-muted-foreground">Currently assigned to {task.assignedTo.name}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => {
            onError(null);
            startTransition(async () => {
              const result = await updateTask({
                taskId: task.taskId,
                title,
                assignedToId: assignedToId === unassignedValue ? null : assignedToId,
                deadline: deadline ? new Date(deadline) : null,
              });

              if (!result.success) {
                onError(result.error);
                return;
              }

              onRefresh();
            });
          }}
        >
          Save
        </Button>
        {moveTarget ? (
          <Button
            disabled={isPending}
            onClick={() => {
              onError(null);
              startTransition(async () => {
                const result = await updateTask({
                  taskId: task.taskId,
                  status: moveTarget,
                });

                if (!result.success) {
                  onError(result.error);
                  return;
                }

                onRefresh();
              });
            }}
          >
            Move to {moveTarget === "in_progress" ? "In Progress" : "Done"}
          </Button>
        ) : null}
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() => {
            onError(null);
            startTransition(async () => {
              const result = await deleteTask({ taskId: task.taskId });

              if (!result.success) {
                onError(result.error);
                return;
              }

              onRefresh();
            });
          }}
        >
          Delete
        </Button>
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Created {format(new Date(task.createdAt), "dd MMM yyyy")}
      </p>
    </div>
  );
}
