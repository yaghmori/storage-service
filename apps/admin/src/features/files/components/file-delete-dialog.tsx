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

type FileDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  isPending?: boolean;
  /** When true, only permanent delete is allowed (already soft-deleted). */
  forcePermanent?: boolean;
  onConfirm: (options: { deleteFromStorage: boolean }) => void;
};

/**
 * Soft-delete by default; optional permanent delete removes DB row + storage object/variants.
 */
export function FileDeleteDialog({
  open,
  onOpenChange,
  fileName,
  isPending,
  forcePermanent = false,
  onConfirm,
}: FileDeleteDialogProps) {
  const [value, setValue] = useState("");
  const [deleteFromStorage, setDeleteFromStorage] = useState(forcePermanent);
  const expected = fileName.trim();
  const matched = expected.length > 0 && value.trim() === expected;
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
            {permanent ? "Permanently delete file?" : "Soft-delete file?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                You are about to delete{" "}
                <span className="font-medium text-foreground">{fileName}</span>.
              </p>

              {!forcePermanent && (
                <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                  <Checkbox
                    id="delete-from-storage"
                    checked={deleteFromStorage}
                    onCheckedChange={(checked) =>
                      setDeleteFromStorage(checked === true)
                    }
                    disabled={isPending}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="delete-from-storage"
                      className="cursor-pointer text-sm font-medium text-foreground"
                    >
                      Also delete from storage
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Removes the object and image/video variants from MinIO/S3
                      and deletes the database row. Soft-delete alone only hides
                      the file.
                    </p>
                  </div>
                </div>
              )}

              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Type "${expected}" to confirm`}
                autoComplete="off"
                autoFocus
              />

              <Alert variant="destructive">
                <AlertTitle>
                  {permanent ? "This cannot be undone" : "Soft-delete only"}
                </AlertTitle>
                <AlertDescription>
                  {permanent
                    ? "The file bytes and all variants will be removed from the storage provider."
                    : "The object stays in storage. The file moves to the Deleted tab and can be restored until retention purge."}
                </AlertDescription>
              </Alert>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!matched || isPending || !expected}
            onClick={() => {
              if (!matched) return;
              onConfirm({ deleteFromStorage: permanent });
            }}
          >
            {isPending
              ? "Working…"
              : permanent
                ? "Delete permanently"
                : "Soft delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
