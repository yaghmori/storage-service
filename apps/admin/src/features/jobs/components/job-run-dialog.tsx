"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { EditableJsonViewer } from "@/components/editable-json-viewer";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  Button,
  Label,
  ResponsiveDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import {
  ProcessorKeyDescriptions,
  ProcessorKeyLabels,
} from "@workspace/validation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAvailableProcessorsQuery,
  useCreateJobMutation,
  useRerunJobMutation,
  type JobRow,
} from "../hooks/use-jobs-queries";

type JobRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required in create mode; rerun takes the file from the job. */
  fileId?: string;
  /** Present in rerun mode. */
  job?: Pick<
    JobRow,
    "id" | "fileId" | "processorKey" | "priority" | "parameters"
  > | null;
  onDone?: () => void;
};

export function JobRunDialog({
  open,
  onOpenChange,
  fileId,
  job,
  onDone,
}: JobRunDialogProps) {
  const { activeOrg } = useActiveOrg();
  const isRerun = !!job;
  const createMutation = useCreateJobMutation(activeOrg?.id);
  const rerunMutation = useRerunJobMutation(activeOrg?.id);
  const isPending = createMutation.isPending || rerunMutation.isPending;

  const availableQuery = useAvailableProcessorsQuery(
    fileId,
    activeOrg?.id,
    open && !isRerun,
  );
  const availableProcessors = availableQuery.data?.items ?? [];

  const [selectedProcessorKey, setSelectedProcessorKey] = useState("");
  const [parameters, setParameters] = useState<Record<string, unknown>>({});

  const processorKey = isRerun
    ? (job?.processorKey ?? "")
    : selectedProcessorKey;

  useEffect(() => {
    if (!open) return;
    setParameters(
      job?.parameters && typeof job.parameters === "object"
        ? { ...job.parameters }
        : {},
    );
    if (!isRerun) setSelectedProcessorKey("");
  }, [open, job, isRerun]);

  // Preselect as soon as the file has exactly one processor left to add.
  useEffect(() => {
    if (isRerun || selectedProcessorKey || availableProcessors.length !== 1) {
      return;
    }
    setSelectedProcessorKey(String(availableProcessors[0]!.processorKey));
  }, [isRerun, selectedProcessorKey, availableProcessors]);

  const submit = () => {
    const nextParameters =
      Object.keys(parameters).length > 0 ? parameters : undefined;

    if (isRerun && job) {
      rerunMutation.mutate(
        {
          id: job.id,
          fileId: job.fileId,
          parameters: nextParameters,
        },
        {
          onSuccess: () => {
            toast.success("Job queued for rerun");
            onOpenChange(false);
            onDone?.();
          },
          onError: (err) =>
            toast.error(extractApiErrorMessage(err, "Rerun failed")),
        },
      );
      return;
    }

    if (!fileId) {
      toast.error("No file selected for this job");
      return;
    }

    if (!selectedProcessorKey) {
      toast.error("Select a processor for this job");
      return;
    }

    createMutation.mutate(
      {
        fileId,
        processorKey: selectedProcessorKey,
        parameters: nextParameters,
      },
      {
        onSuccess: () => {
          toast.success("Job queued");
          onOpenChange(false);
          onDone?.();
        },
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Could not create job")),
      },
    );
  };

  const selectedProcessorLabel =
    ProcessorKeyLabels[processorKey] ?? processorKey;
  const noProcessorsLeft =
    !isRerun && !availableQuery.isLoading && availableProcessors.length === 0;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        const resolved = typeof next === "function" ? next(open) : next;
        if (!resolved && isPending) return;
        onOpenChange(resolved);
      }}
      size="md"
      canClose={!isPending}
      allowOutsideClick={!isPending}
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Title>
          {isRerun ? "Rerun job" : "Add job"}
        </ResponsiveDialog.Title>
        <ResponsiveDialog.Description>
          {isRerun
            ? "Queues a fresh run of this processor, optionally with new parameters."
            : "Queue a processor for this file with optional parameters."}
        </ResponsiveDialog.Description>
      </ResponsiveDialog.Header>

      <ResponsiveDialog.Content className="space-y-4">
        <div className="space-y-2">
          <Label>Processor</Label>
          {isRerun ? (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Badge variant="outline">{selectedProcessorLabel}</Badge>
              <span className="font-mono text-[11px] text-muted-foreground">
                {processorKey}
              </span>
            </div>
          ) : (
            <>
              <Select
                value={selectedProcessorKey}
                onValueChange={setSelectedProcessorKey}
                disabled={
                  isPending || availableQuery.isLoading || noProcessorsLeft
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      availableQuery.isLoading
                        ? "Loading processors…"
                        : noProcessorsLeft
                          ? "No processors left to add"
                          : "Select a processor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableProcessors.map((processor) => {
                    const key = String(processor.processorKey);
                    return (
                      <SelectItem key={key} value={key}>
                        {ProcessorKeyLabels[key] ?? key}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {noProcessorsLeft
                  ? "Every processor enabled for this file type already has a job. Rerun an existing job instead."
                  : (selectedProcessorKey &&
                      ProcessorKeyDescriptions[selectedProcessorKey]) ||
                    "Processors enabled in the organization's processing settings that this file does not already have."}
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Parameters (JSON, optional)</Label>
          <EditableJsonViewer
            value={parameters}
            onChange={setParameters}
            disabled={isPending}
            rootName="parameters"
          />
          <p className="text-xs text-muted-foreground">
            Leave the object empty to use the processor defaults.
          </p>
        </div>
      </ResponsiveDialog.Content>

      <ResponsiveDialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isPending || (!isRerun && !selectedProcessorKey)}
          onClick={submit}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isRerun ? "Rerun job" : "Queue job"}
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
