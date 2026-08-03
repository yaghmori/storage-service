"use client";

import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { HiOutlineCloudUpload } from "react-icons/hi";
import { TbSearch } from "react-icons/tb";
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
};

export function ImageUploader({
  displayPreview = true,
  value,
  onChange,
  onBlur,
  disabled,
  className,
  previewClassName,
  inputClassName,
  align = "center",
  size = 3 * 1024 * 1024, // Default 3MB
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        if (acceptedFiles[0]?.size && acceptedFiles[0].size > size) {
          const errorMessage = `File size is too large. Maximum size is ${size / 1024 / 1024}MB`;
          setError(errorMessage);
          toast.error(errorMessage);
          return;
        }
        setError(null);
        onChange(acceptedFiles[0] ?? null);
      }
    },
    [onChange, size]
  );

  const onDropRejected = useCallback(
    (fileRejections: FileRejection[]) => {
      fileRejections.forEach((rejection) => {
        if (rejection.errors.some((error) => error.code === "file-too-large")) {
          const errorMessage = `File size is too large. Maximum size is ${size / 1024 / 1024}MB`;
          setError(errorMessage);
          toast.error(errorMessage);
        } else {
          rejection.errors.forEach((error) => {
            setError(error.message);
            toast.error(error.message);
          });
        }
      });
    },
    [size]
  );

  const removeImage = () => {
    onChange(null);
    setPreview(null);
    setError(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { "image/*": [] },
    multiple: false,
    disabled,
    maxSize: size,
  });

  useEffect(() => {
    if (value) {
      const objectUrl = URL.createObjectURL(value);
      setPreview(objectUrl);
      setError(null); // Clear error when a valid file is set
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreview(null);
      setError(null); // Clear error when value is cleared
    }
  }, [value]);

  return (
    <div className={cn("flex h-full flex-col gap-2", className)}>
      {preview ? (
        <div
          className={cn(
            "rounded-x flex h-full flex-col gap-2 py-10",
            align === "left" && "self-start",
            align === "right" && "self-end"
          )}
        >
          {displayPreview && (
            <img
              src={preview}
              alt="Preview"
              className={cn(
                "h-full w-full max-w-[220px] self-center rounded-md object-cover",
                previewClassName
              )}
            />
          )}

          <Button
            type="button"
            size="sm"
            className="w-fit self-center"
            variant="ghost"
            onClick={removeImage}
            disabled={disabled}
          >
            <X className="h-4 w-4 text-red-500" />
            Remove
          </Button>
        </div>
      ) : (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "flex h-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-[#F9FAFB] p-10 transition-all duration-300",
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300",
              disabled && "pointer-events-none opacity-50",
              error && "border-destructive",
              inputClassName
            )}
          >
            <input {...getInputProps({ onBlur })} />
            <div
              className={cn(
                "text-muted-foreground flex w-full flex-col items-center gap-2 text-center text-xs"
              )}
            >
              <HiOutlineCloudUpload
                size={32}
                strokeWidth={1.5}
                className="text-muted-foreground/50"
              />
              <p className="text-sm font-semibold">
                Click to upload{" "}
                <span className="font-normal">or drag and drop</span>
              </p>
              <div className="text-muted-foreground text-xs font-semibold">
                Max. File Size: {size / 1024 / 1024}MB
              </div>

              <div className="flex items-center justify-center gap-3">
                <Separator /> OR <Separator />
              </div>
              <Button size="sm" type="button" disabled={disabled}>
                <TbSearch /> Browse file
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm font-normal">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
