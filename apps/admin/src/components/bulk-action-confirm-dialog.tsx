"use client";

import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Button,
} from "@workspace/ui/components";
import type { ReactNode } from "react";

type BulkActionConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  warningTitle?: string;
  warningDescription?: ReactNode;
  isPending?: boolean;
  onConfirm: () => void;
};

/** Confirmation step shared by every bulk action in the files and jobs tables. */
export function BulkActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  warningTitle,
  warningDescription,
  isPending,
  onConfirm,
}: BulkActionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>{description}</div>
              {warningTitle || warningDescription ? (
                <Alert variant={destructive ? "destructive" : "default"}>
                  {warningTitle ? <AlertTitle>{warningTitle}</AlertTitle> : null}
                  {warningDescription ? (
                    <AlertDescription>{warningDescription}</AlertDescription>
                  ) : null}
                </Alert>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
