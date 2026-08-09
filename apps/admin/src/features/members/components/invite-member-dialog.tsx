"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import {
  Button,
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemContent,
  ChoiceboxItemHeader,
  ChoiceboxItemIndicator,
  ChoiceboxItemSubtitle,
  ChoiceboxItemTitle,
  Input,
  Label,
  ResponsiveDialog,
  Spinner,
  Textarea,
} from "@workspace/ui/components";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { toast } from "sonner";
import { useInviteMemberMutation } from "../hooks/use-members-queries";
import { INVITE_ROLES } from "../lib/roles";

type Props = {
  orgId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  children?: ReactNode;
  onSuccess?: () => void;
};

export function InviteMemberDialog({
  orgId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  children,
  onSuccess,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const inviteMutation = useInviteMemberMutation(orgId);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen: Dispatch<SetStateAction<boolean>> = (value) => {
    const next = typeof value === "function" ? value(open) : value;
    if (controlledOnOpenChange) controlledOnOpenChange(next);
    else setInternalOpen(next);
  };

  const reset = () => {
    setStep(1);
    setRole("member");
    setEmail("");
    setMessage("");
  };

  const handleOpenChange: Dispatch<SetStateAction<boolean>> = (value) => {
    const next = typeof value === "function" ? value(open) : value;
    setOpen(next);
    if (!next) reset();
  };

  const submit = () => {
    inviteMutation.mutate(
      { email: email.trim(), role, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Invitation sent");
          handleOpenChange(false);
          onSuccess?.();
        },
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Failed to send invitation")),
      },
    );
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger || children}
      size="lg"
    >
      <ResponsiveDialog.Header>
        <div className="space-y-1">
          <ResponsiveDialog.Title className="text-xl font-semibold">
            Invite Team Member
          </ResponsiveDialog.Title>
          <ResponsiveDialog.Description className="text-sm text-muted-foreground">
            {step === 1
              ? "Select a role and continue to send invitation"
              : "Send an invitation to join this organization"}
          </ResponsiveDialog.Description>
        </div>
      </ResponsiveDialog.Header>

      <ResponsiveDialog.Content>
        {step === 1 ? (
          <div className="space-y-4">
            <Choicebox
              value={role}
              onValueChange={(value) =>
                setRole(value === "admin" ? "admin" : "member")
              }
            >
              {INVITE_ROLES.map((r) => (
                <ChoiceboxItem key={r.name} value={r.name}>
                  <ChoiceboxItemHeader>
                    <ChoiceboxItemTitle>{r.label}</ChoiceboxItemTitle>
                    <ChoiceboxItemSubtitle>
                      {r.description}
                    </ChoiceboxItemSubtitle>
                  </ChoiceboxItemHeader>
                  <ChoiceboxItemContent>
                    <ChoiceboxItemIndicator />
                  </ChoiceboxItemContent>
                </ChoiceboxItem>
              ))}
            </Choicebox>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-message">
                Personal message (optional)
              </Label>
              <Textarea
                id="invite-message"
                rows={3}
                placeholder="Add a note for your teammate…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Inviting as <span className="font-medium capitalize">{role}</span>
            </p>
          </div>
        )}
      </ResponsiveDialog.Content>

      <ResponsiveDialog.Footer>
        {step === 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={inviteMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => setStep(2)}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={inviteMutation.isPending}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              disabled={!email.trim() || inviteMutation.isPending}
              onClick={submit}
            >
              {inviteMutation.isPending ? (
                <>
                  <Spinner />
                  Sending Invitation...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </>
        )}
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
