"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  ResponsiveDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import {
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useChangeMemberRoleMutation,
  useRemoveMemberMutation,
  useResendInviteMutation,
  type UnifiedMemberRow,
} from "../hooks/use-members-queries";
import { INVITE_ROLES } from "../lib/roles";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

type Props = {
  row: UnifiedMemberRow;
  orgId: string;
  canManage: boolean;
  isOwner: boolean;
  allMembers: UnifiedMemberRow[];
};

export function MemberCellAction({
  row,
  orgId,
  canManage,
  isOwner,
  allMembers,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<"admin" | "member">(
    row.role === "admin" ? "admin" : "member",
  );
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const resendMutation = useResendInviteMutation(orgId);
  const removeMutation = useRemoveMemberMutation(orgId);
  const roleMutation = useChangeMemberRoleMutation(orgId);

  const isInvitation = row.type === "invitation";
  const isMember = row.type === "member";
  const isTargetOwner = row.role === "owner";

  // Owner rows are off-limits to everyone except the current owner (transfer only).
  if (!canManage) return null;
  if (isTargetOwner && isMember && !isOwner) return null;

  const showTransfer = isTargetOwner && isMember && isOwner;
  const showMemberManage = isMember && !isTargetOwner;

  if (!showTransfer && !showMemberManage && !isInvitation) return null;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {showMemberManage ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setEditRole(row.role === "admin" ? "admin" : "member");
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit Role
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setRemoveOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Remove Member
              </DropdownMenuItem>
            </>
          ) : null}

          {showTransfer ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setTransferOpen(true)}
            >
              <Shield className="h-4 w-4" />
              Transfer Ownership
            </DropdownMenuItem>
          ) : null}

          {isInvitation ? (
            <>
              <DropdownMenuItem onClick={() => setResendOpen(true)}>
                <RefreshCw className="h-4 w-4" />
                Resend Invitation
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setCancelOpen(true)}
              >
                <XIcon className="h-4 w-4" />
                Cancel Invitation
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {isMember ? (
        <>
          <ResponsiveDialog open={editOpen} onOpenChange={setEditOpen} size="md">
            <ResponsiveDialog.Header>
              <ResponsiveDialog.Title>Edit Role</ResponsiveDialog.Title>
              <ResponsiveDialog.Description>
                Change permissions for {row.email}.
              </ResponsiveDialog.Description>
            </ResponsiveDialog.Header>
            <ResponsiveDialog.Content className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Current Role:{" "}
                <span className="font-medium capitalize">{row.role}</span>
              </div>
              <div className="space-y-2">
                <Label>New role</Label>
                <Select
                  value={editRole}
                  onValueChange={(v) => setEditRole(v as "admin" | "member")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem
                        key={r.name}
                        value={r.name}
                        disabled={r.name === row.role}
                      >
                        {r.label}
                        {r.name === row.role ? " (Current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-muted-foreground">
                Role changes take effect immediately for this organization.
              </p>
            </ResponsiveDialog.Content>
            <ResponsiveDialog.Footer>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={roleMutation.isPending || editRole === row.role}
                onClick={() => {
                  roleMutation.mutate(
                    { memberId: row.id, role: editRole },
                    {
                      onSuccess: () => {
                        toast.success("Role updated");
                        setEditOpen(false);
                      },
                      onError: (err) =>
                        toast.error(
                          extractApiErrorMessage(err, "Failed to update role"),
                        ),
                    },
                  );
                }}
              >
                {roleMutation.isPending ? "Saving…" : "Save Role"}
              </Button>
            </ResponsiveDialog.Footer>
          </ResponsiveDialog>

          <TransferOwnershipDialog
            orgId={orgId}
            members={allMembers}
            open={transferOpen}
            onOpenChange={setTransferOpen}
          />

          <TypeToConfirmDialog
            open={removeOpen}
            onOpenChange={setRemoveOpen}
            title="Remove Member"
            description={`Remove ${row.email} from this organization?`}
            confirmLabel="Remove Member"
            confirmPhrase={row.email}
            isPending={removeMutation.isPending}
            onConfirm={() => {
              removeMutation.mutate(row.id, {
                onSuccess: () => {
                  toast.success("Member removed");
                  setRemoveOpen(false);
                },
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Remove failed")),
              });
            }}
          />
        </>
      ) : null}

      {isInvitation ? (
        <>
          <TypeToConfirmDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title="Cancel Invitation"
            description={`Cancel the pending invitation for ${row.email}?`}
            confirmLabel="Cancel Invitation"
            confirmPhrase={row.email}
            isPending={removeMutation.isPending}
            onConfirm={() => {
              removeMutation.mutate(row.id, {
                onSuccess: () => {
                  toast.success("Invitation cancelled");
                  setCancelOpen(false);
                },
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Cancel failed")),
              });
            }}
          />

          <TypeToConfirmDialog
            open={resendOpen}
            onOpenChange={setResendOpen}
            title="Resend Invitation"
            description={`Resend the invitation email to ${row.email}?`}
            confirmLabel="Resend Invitation"
            confirmPhrase={row.email}
            warningTitle="A new invite link will be generated"
            warningDescription="The previous invitation link will stop working."
            isPending={resendMutation.isPending}
            onConfirm={() => {
              resendMutation.mutate(row.id, {
                onSuccess: () => {
                  toast.success("Invitation resent");
                  setResendOpen(false);
                },
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Resend failed")),
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}
