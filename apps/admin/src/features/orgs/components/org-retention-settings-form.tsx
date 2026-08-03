"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { Button, Card, CardContent, Input, Label } from "@workspace/ui/components";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useOrgRetentionQuery,
  useUpdateOrgRetentionMutation,
} from "../hooks/use-orgs-queries";

export function OrgRetentionSettingsForm({ orgId }: { orgId: string }) {
  const query = useOrgRetentionQuery(orgId);
  const updateMutation = useUpdateOrgRetentionMutation(orgId);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    if (query.data) setDays(query.data.softDeleteRetentionDays);
  }, [query.data]);

  if (query.isLoading || days == null) {
    return (
      <div className="flex h-24 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading retention…
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
        Failed to load retention settings
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 p-6">
          <Label htmlFor="retention-days">Soft-delete retention (days)</Label>
          <Input
            id="retention-days"
            type="number"
            min={1}
            max={3650}
            className="max-w-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
          />
          <p className="text-xs text-muted-foreground">
            Soft-deleted files are hard-purged after this many days by a daily
            cleanup job. Quota is freed only after hard purge.
          </p>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          disabled={updateMutation.isPending}
          onClick={() => {
            if (days < 1 || days > 3650) {
              toast.error("Retention must be between 1 and 3650 days");
              return;
            }
            updateMutation.mutate(
              { softDeleteRetentionDays: days },
              {
                onSuccess: () => toast.success("Retention saved"),
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Save failed")),
              },
            );
          }}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save retention"
          )}
        </Button>
      </div>
    </div>
  );
}
