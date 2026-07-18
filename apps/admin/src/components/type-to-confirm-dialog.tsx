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
  Input,
} from "@workspace/ui/components";
import { useEffect, useState } from "react";

type TypeToConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Exact phrase the user must type (usually a name/key/email). */
  confirmPhrase: string;
  confirmLabel?: string;
  warningTitle?: string;
  warningDescription?: string;
  isPending?: boolean;
  onConfirm: () => void;
};

/**
 * Parslinks-style destructive confirmation: type the name/phrase to enable Delete.
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Delete",
  warningTitle = "This action cannot be undone",
  warningDescription = "The resource will be permanently removed.",
  isPending,
  onConfirm,
}: TypeToConfirmDialogProps) {
  const [value, setValue] = useState("");
  const expected = confirmPhrase.trim();
  const matched = expected.length > 0 && value.trim() === expected;

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>{description}</div>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Type "${expected}" to confirm`}
                autoComplete="off"
                autoFocus
              />
              <Alert variant="destructive">
                <AlertTitle>{warningTitle}</AlertTitle>
                <AlertDescription>{warningDescription}</AlertDescription>
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
              onConfirm();
            }}
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
