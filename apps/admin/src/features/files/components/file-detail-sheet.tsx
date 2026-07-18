"use client";

import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  Button,
  CopyButton,
  DateDisplay,
  ResponsiveSheet,
  Separator,
} from "@workspace/ui/components";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  useFileDetailQuery,
  useFileSignedUrlQuery,
} from "../hooks/use-files-queries";
import { FilePreviewThumb } from "./file-preview-thumb";
import { fileContentUrl } from "@/lib/constants/endpoints";

function formatBytes(value: number | string | undefined): string {
  if (value == null) return "—";
  const bytes = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function FileDetailSheet({
  fileId,
  open,
  onOpenChange,
}: {
  fileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading } = useFileDetailQuery(
    fileId ?? undefined,
    activeOrg?.id,
  );
  const isImage = !!data?.mimeType?.startsWith("image/");
  const signedUrl = useFileSignedUrlQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId,
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      className="w-full sm:max-w-lg"
    >
      <ResponsiveSheet.Header>
        <ResponsiveSheet.Title>
          {data?.originalFileName ?? "File details"}
        </ResponsiveSheet.Title>
        <ResponsiveSheet.Description>
          Preview, metadata, and signed URL.
        </ResponsiveSheet.Description>
      </ResponsiveSheet.Header>

      <ResponsiveSheet.Content className="space-y-4 px-4 pb-6">
        {isLoading || !data ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <FilePreviewThumb
                fileId={data.id}
                mimeType={data.mimeType}
                orgId={activeOrg?.id}
                alt={data.originalFileName}
                size="lg"
              />
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{data.originalFileName}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {data.mimeType}
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {formatBytes(data.size)}
                </p>
              </div>
            </div>

            {isImage ? (
              <div className="overflow-hidden rounded-lg border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileContentUrl(data.id, { orgId: activeOrg?.id })}
                  alt={data.originalFileName}
                  className="max-h-64 w-full object-contain"
                />
              </div>
            ) : null}

            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Visibility</dt>
                <dd>
                  <Badge variant="outline" className="capitalize">
                    {data.visibility ?? "—"}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Processing</dt>
                <dd>
                  <Badge variant="secondary" className="capitalize">
                    {data.processingStatus ?? "n/a"}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                  <DateDisplay date={data.createdAt} format="datetime" />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Storage key</dt>
                <dd className="max-w-[240px] truncate font-mono text-xs">
                  {data.storageKey}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-2 text-sm">
              <p className="font-medium">Signed URL</p>
              {signedUrl.isLoading ? (
                <p className="text-muted-foreground">Resolving…</p>
              ) : signedUrl.data?.url ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-xs">
                      {signedUrl.data.url}
                    </p>
                    <CopyButton content={signedUrl.data.url} />
                  </div>
                  {signedUrl.data.variant ? (
                    <p className="text-xs text-muted-foreground">
                      Variant: {signedUrl.data.variant}
                    </p>
                  ) : null}
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={signedUrl.data.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-4" />
                      Open
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Unavailable</p>
              )}
            </div>
          </>
        )}
      </ResponsiveSheet.Content>
    </ResponsiveSheet>
  );
}
