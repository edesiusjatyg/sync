"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createGroup } from "@/app/actions/group.actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/app/modal";

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required.").max(100, "Group name is too long."),
  maxMembers: z.coerce.number().int().min(2).max(10),
  goalTypes: z
    .array(z.enum(["tugas", "side_project", "kompetisi", "riset", "lainnya"]))
    .min(1, "Pick at least one goal."),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;

const goalOptions = [
  { value: "tugas", label: "Coursework" },
  { value: "side_project", label: "Side Project" },
  { value: "kompetisi", label: "Competition" },
  { value: "riset", label: "Research" },
  { value: "lainnya", label: "Other" },
] as const;

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  invitedUserIds?: string[];
  defaultName?: string;
}

export function CreateGroupModal({
  open,
  onClose,
  invitedUserIds = [],
  defaultName = "",
}: CreateGroupModalProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateGroupValues>({
    defaultValues: {
      name: defaultName,
      maxMembers: Math.max(2, invitedUserIds.length + 1, 4),
      goalTypes: [],
    },
  });

  const goalTypes = watch("goalTypes");

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      name: defaultName,
      maxMembers: Math.max(2, invitedUserIds.length + 1, 4),
      goalTypes: [],
    });
    setFormError(null);
  }, [defaultName, invitedUserIds.length, open, reset]);

  const onSubmit = (values: CreateGroupValues) => {
    setFormError(null);
    const parsed = createGroupSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];

        if (typeof fieldName === "string") {
          setError(fieldName as keyof CreateGroupValues, {
            type: "validate",
            message: issue.message,
          });
        }
      }

      return;
    }

    startTransition(async () => {
      const result = await createGroup({
        ...parsed.data,
        invitedUserIds,
      });

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      reset();
      onClose();
      router.push(`/groups/${result.data.groupId}`);
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Group"
      description="Turn a match or idea into a real study group with goals, capacity, and a working space."
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((values) => onSubmit(values))} disabled={isPending}>
            {isPending ? "Creating Group" : "Create Group"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t create the group</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="group-name">Group Name</Label>
          <Input id="group-name" {...register("name")} aria-invalid={Boolean(errors.name)} />
          {errors.name?.message ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-members">Max Members</Label>
          <Input
            id="max-members"
            type="number"
            min={2}
            max={10}
            {...register("maxMembers", { valueAsNumber: true })}
            aria-invalid={Boolean(errors.maxMembers)}
          />
          {errors.maxMembers?.message ? (
            <p className="text-sm text-destructive">{errors.maxMembers.message}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <Label>Goal Types</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {goalOptions.map((goal) => {
              const isSelected = goalTypes.includes(goal.value);

              return (
                <label key={goal.value} className="flex items-center gap-3 border border-border/80 p-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      const nextGoals = isSelected
                        ? goalTypes.filter((item) => item !== goal.value)
                        : [...goalTypes, goal.value];

                      setValue("goalTypes", nextGoals, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <span className="font-medium">{goal.label}</span>
                </label>
              );
            })}
          </div>
          {errors.goalTypes?.message ? (
            <p className="text-sm text-destructive">{errors.goalTypes.message}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
