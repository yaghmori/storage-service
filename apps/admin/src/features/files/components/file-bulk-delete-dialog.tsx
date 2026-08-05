"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  Input,
  Label,
} from "@workspace/ui/components";
import { useEffect, useState } from "react";

type FileBulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: { id: string; originalFileName: string }[];
  isPending?: boolean;
  /** When true, only permanent delete is allowed (soft-deleted view). */
  forcePermanent?: boolean;
  onConfirm: (options: { deleteFromStorage: boolean }) => void;
};

const CONFIRM_PHRASE = "DELETE";

/**
 * Bulk soft-delete by default; optional permanent delete removes DB rows + storage.
 */
export function FileBulkDeleteDialog({
  open,
  onOpenChange,
  files,
  isPending,
  forcePermanent = false,
  onConfirm,
}: FileBulkDeleteDialogProps) {
  const [value, setValue] = useState("");
  const [deleteFromStorage, setDeleteFromStorage] = useState(forcePermanent);
  const count = files.length;
  const matched = value.trim() === CONFIRM_PHRASE;
  const previewFiles = files.slice(0, 5);
  const remaining = Math.max(0, count - previewFiles.length);
  const permanent = forcePermanent || deleteFromStorage;

  useEffect(() => {
    if (!open) {
      setValue("");
      setDeleteFromStorage(false);
    } else if (forcePermanent) {
      setDeleteFromStorage(true);
    }
  }, [open, forcePermanent]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {permanent
              ? `Permanently delete ${count} files?`
              : `Soft-delete ${count} files?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p>
                  You are about to delete{" "}
                  <span className="font-medium text-foreground">
                    {count} files
                  </span>
                  :
                </p>
                <ul className="max-h-32 list-disc space-y-1 overflow-y-auto pl-5">
                  {previewFiles.map((file) => (
                    <li
                      key={file.id}
                      className="truncate text-foreground"
                      dir="auto"
                    >
                      {file.originalFileName}
                    </li>
                  ))}
                </ul>
                {remaining > 0 && (
                  <p className="text-xs">…and {remaining} more</p>
                )}
              </div>

              {!forcePermanent && (
                <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                  <Checkbox
                    id="bulk-delete-from-storage"
                    checked={deleteFromStorage}
                    onCheckedChange={(checked) =>
                      setDeleteFromStorage(checked === true)
                    }
                    disabled={isPending}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="bulk-delete-from-storage"
                      className="cursor-pointer text-sm font-medium text-foreground"
                    >
                      Also delete from storage
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Removes objects and image/video variants from MinIO/S3 and
                      deletes the database rows. Soft-delete alone only hides the
                      files.
                    </p>
                  </div>
                </div>
              )}

              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Type "${CONFIRM_PHRASE}" to confirm`}
                autoComplete="off"
                autoFocus
              />

              <Alert variant="destructive">
                <AlertTitle>
                  {permanent ? "This cannot be undone" : "Soft-delete only"}
                </AlertTitle>
                <AlertDescription>
                  {permanent
                    ? "File bytes and all variants will be removed from the storage provider."
                    : "Files stay in storage and can still be hard-deleted later."}
                </AlertDescription>
              </Alert>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!matched || isPending || count < 1}
            onClick={() => {
              if (!matched) return;
              onConfirm({ deleteFromStorage: permanent });
            }}
          >
            {isPending
              ? "Working…"
              : permanent
                ? `Delete permanently (${count})`
                : `Soft delete (${count})`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
