import { Suspense } from "react";
import { JobsListView } from "@/features/jobs/components/jobs-list-view";

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading jobs…</div>}>
      <JobsListView />
    </Suspense>
  );
}
