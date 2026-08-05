"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  CloudUploadIcon,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

type Props = {
  className?: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  displayPreview?: boolean;
  previewClassName?: string;
  inputClassName?: string;
  size?: number;
  align?: "center" | "left" | "right";
  accept?: Record<string, string[]>;
  maxFiles?: number;
};

const getFileIcon = (file: File) => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type.startsWith("image/"))
    return <FileImage className="text-muted-foreground h-8 w-8" />;
  if (type.startsWith("video/"))
    return <FileVideo className="text-muted-foreground h-8 w-8" />;
  if (type.startsWith("audio/"))
    return <FileAudio className="text-muted-foreground h-8 w-8" />;
  if (name.endsWith(".csv") || type === "text/csv")
    return <FileSpreadsheet className="text-muted-foreground h-8 w-8" />;
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    type.includes("spreadsheet") ||
    type.includes("excel")
  )
    return <FileSpreadsheet className="text-muted-foreground h-8 w-8" />;

  if (type.startsWith("text/"))
    return <FileText className="text-muted-foreground h-8 w-8" />;
  if (type.includes("pdf"))
    return <FileText className="text-muted-foreground h-8 w-8" />;
  if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z"))
    return <FileArchive className="text-muted-foreground h-8 w-8" />;

  // Excel and CSV files

  return <File className="h-8 w-8 text-gray-500" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function FileUploader({
  displayPreview = true,
  value,
  onChange,
  onBlur,
  disabled,
  className,
  previewClassName,
  inputClassName,
  align = "center",
  size,
  accept,
  maxFiles = 1,
}: Props) {
  const [preview, setPreview] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        if (size && acceptedFiles[0]?.size && acceptedFiles[0].size > size) {
          toast.error("File size is too large");
          return;
        }
        onChange(acceptedFiles[0] ?? null);
      }
    },
    [onChange, size]
  );

  const removeFile = () => {
    onChange(null);
    setPreview(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: maxFiles > 1,
    disabled,
    maxFiles,
  });

  useEffect(() => {
    if (value) {
      setPreview({
        name: value.name,
        size: value.size,
        type: value.type,
      });
    } else {
      setPreview(null);
    }
  }, [value]);

  return (
    <div className={cn("flex h-full flex-col gap-2", className)}>
      {preview ? (
        <div
          className={cn(
            "rounded-x flex h-full flex-col gap-2 py-6",
            align === "left" && "self-start",
            align === "right" && "self-end"
          )}
        >
          {displayPreview && (
            <div
              className={cn(
                "bg-accent flex items-center gap-3 rounded-lg border p-4",
                previewClassName
              )}
            >
              {getFileIcon(value!)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900" dir="auto">
                  {preview.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(preview.size)} •{" "}
                  {preview.type || "Unknown type"}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghostDestructive"
                onClick={removeFile}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "bg-accent flex h-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-300",
            isDragActive
              ? "bg-accent border-blue-500"
              : "border-gray-200 hover:border-gray-300",
            disabled && "pointer-events-none opacity-50",
            inputClassName
          )}
        >
          <input {...getInputProps({ onBlur })} />
          <div
            className={cn(
              "text-muted-foreground flex w-full flex-col items-center gap-3 text-center text-xs"
            )}
          >
            <CloudUploadIcon
              size={42}
              strokeWidth={1}
              className="text-muted-foreground/50"
            />
            <p className="text-sm font-semibold">
              Click to upload{" "}
              <span className="font-normal">or drag and drop</span>
            </p>
            {size && (
              <div className="text-muted-foreground text-xs font-semibold">
                Max. File Size: {formatFileSize(size)}
              </div>
            )}

            <Button
              size="sm"
              type="button"
              className="mt-2"
              disabled={disabled}
            >
              <SearchIcon /> Browse file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
