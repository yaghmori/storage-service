"use client";

import { cn } from "@workspace/ui/lib/utils";
import { UploadIcon } from "lucide-react";
import React from "react";
import {
  useDropzone,
  type DropzoneOptions,
  type FileRejection,
} from "react-dropzone";

interface AvatarUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: File[];
  onValueChange?: React.Dispatch<React.SetStateAction<File[]>>;
  currentImageUrl?: string;
  fallbackText?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  accept?: DropzoneOptions["accept"];
  maxSize?: DropzoneOptions["maxSize"];
  disabled?: boolean;
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
  xl: "h-40 w-40",
  "2xl": "h-48 w-48",
  "3xl": "h-56 w-56",
  "4xl": "h-64 w-64",
  "5xl": "h-72 w-72",
};

export function AvatarUploader({
  value: valueProp,
  onValueChange,
  currentImageUrl,
  fallbackText = "U",
  size = "md",
  accept = { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
  maxSize = 1024 * 1024 * 2, // 2MB
  disabled = false,
  className,
  ...divProps
}: AvatarUploaderProps) {
  const [files, setFiles] = React.useState<File[]>([]);

  React.useEffect(() => {
    if (valueProp) {
      setFiles(valueProp);
    }
  }, [valueProp]);

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (acceptedFiles.length === 0) return;

      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, { preview: URL.createObjectURL(file) })
      );

      setFiles(newFiles);
      onValueChange?.(newFiles);
    },
    [onValueChange]
  );

  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (isFileWithPreview(file)) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const firstFile = files[0];
  let currentImage: string | undefined = currentImageUrl || undefined;
  if (firstFile && isFileWithPreview(firstFile)) {
    currentImage = firstFile.preview;
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  return (
    <div className={cn("relative inline-block", className)} {...divProps}>
      <div
        {...getRootProps()}
        className={cn(
          "group relative cursor-pointer rounded-full transition-all duration-200",
          isDragActive && "ring-2 ring-blue-500 ring-offset-2",
          disabled && "pointer-events-none opacity-60",
          sizeClasses[size]
        )}
      >
        <input {...getInputProps()} />

        {/* Avatar */}
        <div
          style={{
            maskImage: "url(/shape.png)",
            maskSize: "100%",
            maskRepeat: "no-repeat",
          }}
          className={cn("h-full w-full overflow-hidden", sizeClasses[size])}
        >
          {currentImage ? (
            <img
              src={currentImage}
              alt="Profile"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-foreground/70">
              <span className="select-none text-2xl font-semibold">
                {fallbackText?.slice(0, 1) || "U"}
              </span>
            </div>
          )}
        </div>

        {/* Upload overlay */}
        <div
          style={{
            maskImage: "url(/shape.png)",
            maskSize: "100%",
            maskRepeat: "no-repeat",
          }}
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
            isDragActive && "opacity-100"
          )}
        >
          <div className="flex flex-col items-center gap-1 text-white">
            <UploadIcon className="h-6 w-6" />
            <span className="text-xs font-medium">
              {isDragActive ? "Drop here" : "Upload"}
            </span>
          </div>
        </div>

        {/* Drag active indicator */}
        {isDragActive && (
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/50" />
        )}
      </div>
    </div>
  );
}

function isFileWithPreview(file: File): file is File & { preview: string } {
  return "preview" in file && typeof file.preview === "string";
}
