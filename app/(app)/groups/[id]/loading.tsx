import { LoadingSpinner } from "@/components/app/loading-spinner";
import { PageShell } from "@/components/app/page-shell";

export default function GroupLoading() {
  return (
    <PageShell className="py-20">
      <LoadingSpinner label="Loading group workspace..." />
    </PageShell>
  );
}
