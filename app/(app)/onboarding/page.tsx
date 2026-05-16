import { getMyProfile, getSkillCatalog } from "@/app/actions/profile.actions";
import type { ActionData } from "@/components/app/action-data";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { PageShell } from "@/components/app/page-shell";

type ExistingProfile = Exclude<ActionData<typeof getMyProfile>, null>;
type SkillCatalogItem = ActionData<typeof getSkillCatalog>[number];

export default async function OnboardingPage() {
  const [profileResult, catalogResult] = await Promise.all([getMyProfile(), getSkillCatalog()]);

  const initialProfile: ExistingProfile | null =
    profileResult.success && profileResult.data ? (profileResult.data as ExistingProfile) : null;
  const skillCatalog: SkillCatalogItem[] = catalogResult.success ? catalogResult.data : [];
  const initialError = !profileResult.success
    ? profileResult.error
    : !catalogResult.success
      ? catalogResult.error
      : null;

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="section-kicker">Protected Flow</p>
          <h1 className="font-heading text-4xl font-bold uppercase sm:text-5xl">
            Tell Sync. how you work.
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Your answers drive ranking, profile completeness, and where middleware sends you next.
          </p>
        </div>
        <OnboardingWizard
          initialProfile={initialProfile}
          skillCatalog={skillCatalog}
          initialError={initialError}
        />
      </div>
    </PageShell>
  );
}
