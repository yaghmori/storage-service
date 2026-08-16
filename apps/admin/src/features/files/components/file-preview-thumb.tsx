"use client";

import { fileContentUrl } from "@/lib/constants/endpoints";
import { cn } from "@/lib/utils";
import {
  FileArchive,
  FileAudio,
  FileCode,
  FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from "lucide-react";
import { useState } from "react";

function isImageMime(mimeType?: string | null): boolean {
  return !!mimeType?.startsWith("image/");
}

function isVideoMime(mimeType?: string | null): boolean {
  return !!mimeType?.startsWith("video/");
}

function isAudioMime(mimeType?: string | null): boolean {
  return !!mimeType?.startsWith("audio/");
}

function FileTypeIcon({
  mimeType,
  className,
}: {
  mimeType?: string | null;
  className?: string;
}) {
  const mime = mimeType?.toLowerCase() ?? "";
  const iconClass = cn("text-muted-foreground", className);

  if (isImageMime(mime)) return <FileImage className={iconClass} />;
  if (isVideoMime(mime)) return <FileVideo className={iconClass} />;
  if (isAudioMime(mime)) return <FileAudio className={iconClass} />;
  if (
    mime.includes("pdf") ||
    mime.startsWith("text/") ||
    mime.includes("msword") ||
    mime.includes("officedocument.word")
  ) {
    return <FileText className={iconClass} />;
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    mime.includes("csv")
  ) {
    return <FileSpreadsheet className={iconClass} />;
  }
  if (
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    mime.includes("tar") ||
    mime.includes("gzip") ||
    mime.includes("compressed")
  ) {
    return <FileArchive className={iconClass} />;
  }
  if (
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("xml") ||
    mime.includes("html")
  ) {
    return <FileCode className={iconClass} />;
  }
  return <FileIcon className={iconClass} />;
}

export function FilePreviewThumb({
  fileId,
  mimeType,
  orgId,
  alt,
  size = "md",
  className,
}: {
  fileId: string;
  mimeType?: string | null;
  orgId?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const box =
    size === "sm"
      ? "size-9"
      : size === "lg"
        ? "size-24"
        : "size-11";

  if (!isImageMime(mimeType) || failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border bg-muted/40",
          box,
          className,
        )}
        title={mimeType ?? undefined}
      >
        <FileTypeIcon
          mimeType={mimeType}
          className={size === "lg" ? "size-10" : "size-5"}
        />
      </div>
    );
  }

  // Always request the small thumbnail variant. The backend generates it on
  // demand when missing, so we never fall back to loading the full-size
  // original for a preview — show the file-type icon instead on error.
  const src = fileContentUrl(fileId, {
    orgId,
    variant: "thumbnail",
  });

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border bg-muted/30",
        box,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? "Preview"}
        className="size-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
