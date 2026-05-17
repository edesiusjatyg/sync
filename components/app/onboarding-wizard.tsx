"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckIcon } from "lucide-react";

import { getMyProfile, getSkillCatalog, saveOnboardingProfile } from "@/app/actions/profile.actions";
import type { ActionData } from "@/components/app/action-data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";

type ExistingProfile = Exclude<ActionData<typeof getMyProfile>, null>;
type SkillCatalogItem = ActionData<typeof getSkillCatalog>[number];

const onboardingSchema = z.object({
  bio: z.string().trim().max(1000).optional(),
  productiveHours: z.array(z.number().int().min(0).max(23)).min(1, "Pick at least one time block."),
  workStyleSync: z.enum(["async", "sync"]),
  workStyleDriven: z.enum(["deadline", "milestone"]),
  workStyleRole: z.enum(["leader", "executor", "flexible"]),
  goalTypes: z
    .array(z.enum(["tugas", "side_project", "kompetisi", "riset", "lainnya"]))
    .min(1, "Pick at least one goal."),
  skills: z
    .array(
      z.object({
        skillId: z.string().uuid(),
        rating: z.number().int().min(1).max(10),
      }),
    )
    .min(1, "Select at least one skill."),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const hourOptions = [
  { value: 0, label: "Dini Hari", time: "00:00" },
  { value: 6, label: "Pagi", time: "06:00" },
  { value: 12, label: "Siang", time: "12:00" },
  { value: 17, label: "Sore", time: "17:00" },
  { value: 20, label: "Malam", time: "20:00" },
] as const;

const goalOptions = [
  { value: "tugas", label: "Coursework" },
  { value: "side_project", label: "Side Project" },
  { value: "kompetisi", label: "Competition" },
  { value: "riset", label: "Research" },
  { value: "lainnya", label: "Other" },
] as const;

const steps = [
  { title: "Skills", description: "Select the strengths you can bring to a team." },
  { title: "Hours", description: "Choose the time blocks where you are most productive." },
  { title: "Style", description: "Set expectations for how you like to work." },
  { title: "Goals", description: "Define why you are looking for collaborators right now." },
] as const;

interface OnboardingWizardProps {
  initialProfile: ExistingProfile | null;
  skillCatalog: SkillCatalogItem[];
  initialError?: string | null;
}

function toggleArrayValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function OnboardingWizard({
  initialProfile,
  skillCatalog,
  initialError = null,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  const groupedSkills = useMemo(() => {
    return skillCatalog.reduce<Record<string, SkillCatalogItem[]>>((groups, skill) => {
      groups[skill.category] ??= [];
      groups[skill.category].push(skill);
      return groups;
    }, {});
  }, [skillCatalog]);

  const {
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    defaultValues: {
      bio: initialProfile?.bio ?? "",
      productiveHours: initialProfile?.productiveHours ?? [],
      workStyleSync: initialProfile?.workStyleSync ?? "async",
      workStyleDriven: initialProfile?.workStyleDriven ?? "milestone",
      workStyleRole: initialProfile?.workStyleRole ?? "flexible",
      goalTypes: initialProfile?.goalTypes ?? [],
      skills:
        initialProfile?.skills.map((skill) => ({
          skillId: skill.skillId,
          rating: skill.rating,
        })) ?? [],
    },
  });

  const selectedSkills = watch("skills");
  const productiveHours = watch("productiveHours");
  const goalTypes = watch("goalTypes");
  const workStyleSync = watch("workStyleSync");
  const workStyleDriven = watch("workStyleDriven");
  const workStyleRole = watch("workStyleRole");

  const submitForm = handleSubmit((values) => {
    setFormError(null);

    const parsed = onboardingSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];

        if (typeof fieldName === "string") {
          setError(fieldName as keyof OnboardingFormValues, {
            type: "validate",
            message: issue.message,
          });
        }
      }

      const firstStepWithError = parsed.error.issues.some((issue) => issue.path[0] === "skills")
        ? 0
        : parsed.error.issues.some((issue) => issue.path[0] === "productiveHours")
          ? 1
          : parsed.error.issues.some(
                (issue) =>
                  issue.path[0] === "workStyleSync" ||
                  issue.path[0] === "workStyleDriven" ||
                  issue.path[0] === "workStyleRole",
              )
            ? 2
            : 3;

      setStep(firstStepWithError);
      return;
    }

    startTransition(async () => {
      const result = await saveOnboardingProfile(parsed.data);

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      router.push("/discover");
      router.refresh();
    });
  });

  const selectedSkillIds = new Set(selectedSkills.map((skill) => skill.skillId));

  return (
    <Card className="surface-panel w-full py-0">
      <CardHeader className="border-b border-border/80 py-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="section-kicker">Onboarding</p>
            <CardTitle className="text-3xl sm:text-4xl">Build the profile your matches will see.</CardTitle>
            <CardDescription className="max-w-2xl">{steps[step].description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`size-3 border transition-colors ${
                  index === step ? "border-primary bg-primary" : index < step ? "border-primary/60 bg-primary/20" : "border-border bg-background"
                }`}
                onClick={() => setStep(index)}
                aria-label={`Go to step ${index + 1}: ${item.title}`}
              />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 py-8">
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t save your profile</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {step === 0 ? (
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold uppercase">Select skills and rate them</h2>
              <p className="text-sm text-muted-foreground">
                Ratings run from 1 to 10. Pick every area you actively contribute to.
              </p>
              {errors.skills?.message ? <p className="text-sm text-destructive">{errors.skills.message}</p> : null}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(groupedSkills).map(([category, skills]) => (
                <div key={category} className="border border-border/80 bg-background p-5">
                  <p className="section-kicker">{category}</p>
                  <div className="mt-4 space-y-4">
                    {skills.map((skill) => {
                      const currentSkill = selectedSkills.find((item) => item.skillId === skill.skillId);
                      const isSelected = selectedSkillIds.has(skill.skillId);

                      return (
                        <div key={skill.skillId} className="border border-border/70 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <label className="flex min-w-0 items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {
                                  const nextSkills = isSelected
                                    ? selectedSkills.filter((item) => item.skillId !== skill.skillId)
                                    : [...selectedSkills, { skillId: skill.skillId, rating: 7 }];

                                  setValue("skills", nextSkills, { shouldDirty: true, shouldValidate: true });
                                }}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{skill.name}</p>
                                <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                  {category}
                                </p>
                              </div>
                            </label>
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                                <CheckIcon className="size-3.5" />
                                Active
                              </span>
                            ) : null}
                          </div>
                          {isSelected ? (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                <span>Skill Rating</span>
                                <span>{currentSkill?.rating ?? 7}/10</span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={10}
                                value={currentSkill?.rating ?? 7}
                                className="w-full accent-[var(--primary)]"
                                onChange={(event) => {
                                  const rating = Number(event.target.value);
                                  const nextSkills = selectedSkills.map((item) =>
                                    item.skillId === skill.skillId ? { ...item, rating } : item,
                                  );

                                  setValue("skills", nextSkills, { shouldDirty: true, shouldValidate: true });
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold uppercase">Choose your strongest time blocks</h2>
              <p className="text-sm text-muted-foreground">
                These five blocks match the seeded schedule vector used by ranking.
              </p>
              {errors.productiveHours?.message ? (
                <p className="text-sm text-destructive">{errors.productiveHours.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {hourOptions.map((option) => {
                const isSelected = productiveHours.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`border p-5 text-left transition-colors ${
                      isSelected ? "border-primary bg-primary/10 text-primary" : "border-border/80 bg-background"
                    }`}
                    onClick={() =>
                      setValue("productiveHours", toggleArrayValue(productiveHours, option.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <p className="section-kicker">{option.time}</p>
                    <p className="mt-3 font-heading text-2xl font-bold uppercase">{option.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4 border border-border/80 p-5">
              <p className="section-kicker">Collaboration Mode</p>
              <div className="flex flex-wrap gap-3">
                {["async", "sync"].map((value) => (
                  <Toggle
                    key={value}
                    pressed={workStyleSync === value}
                    onPressedChange={() =>
                      setValue("workStyleSync", value as OnboardingFormValues["workStyleSync"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    variant="outline"
                  >
                    {value}
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="space-y-4 border border-border/80 p-5">
              <p className="section-kicker">Planning Style</p>
              <div className="flex flex-wrap gap-3">
                {["deadline", "milestone"].map((value) => (
                  <Toggle
                    key={value}
                    pressed={workStyleDriven === value}
                    onPressedChange={() =>
                      setValue("workStyleDriven", value as OnboardingFormValues["workStyleDriven"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    variant="outline"
                  >
                    {value}
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="space-y-4 border border-border/80 p-5">
              <p className="section-kicker">Team Role</p>
              <div className="flex flex-wrap gap-3">
                {["leader", "executor", "flexible"].map((value) => (
                  <Toggle
                    key={value}
                    pressed={workStyleRole === value}
                    onPressedChange={() =>
                      setValue("workStyleRole", value as OnboardingFormValues["workStyleRole"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    variant="outline"
                  >
                    {value}
                  </Toggle>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="font-heading text-2xl font-bold uppercase">State your goals and context</h2>
              {errors.goalTypes?.message ? <p className="text-sm text-destructive">{errors.goalTypes.message}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {goalOptions.map((goal) => {
                const isSelected = goalTypes.includes(goal.value);

                return (
                  <button
                    key={goal.value}
                    type="button"
                    className={`border p-4 text-left transition-colors ${
                      isSelected ? "border-primary bg-primary/10 text-primary" : "border-border/80 bg-background"
                    }`}
                    onClick={() =>
                      setValue("goalTypes", toggleArrayValue(goalTypes, goal.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <p className="font-semibold uppercase tracking-[0.18em]">{goal.label}</p>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Short Bio</Label>
              <Textarea
                id="bio"
                rows={5}
                defaultValue={initialProfile?.bio ?? ""}
                onChange={(event) =>
                  setValue("bio", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="What kind of collaborator are you? What do you care about in a study group?"
              />
              {errors.bio?.message ? <p className="text-sm text-destructive">{errors.bio.message}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-border/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker">
              Step {step + 1} of {steps.length}
            </p>
            <p className="text-sm text-muted-foreground">{steps[step].title}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} disabled={step === 0 || isPending}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((currentStep) => Math.min(steps.length - 1, currentStep + 1))}>
                Continue
              </Button>
            ) : (
              <Button onClick={submitForm} disabled={isPending}>
                {isPending ? "Saving Profile" : "Save Profile"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
