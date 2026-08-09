"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResponsiveDialog,
  Spinner,
  Textarea,
} from "@workspace/ui/components";
import { Check, ChevronsUpDown, Shield } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import {
  useTransferOwnershipMutation,
  type UnifiedMemberRow,
} from "../hooks/use-members-queries";
import { roleLabel } from "../lib/roles";

type Props = {
  orgId: string;
  members: UnifiedMemberRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function displayName(member: UnifiedMemberRow) {
  return member.user?.name?.trim() || member.email;
}

function initials(member: UnifiedMemberRow) {
  const source = displayName(member).trim();
  return source.slice(0, 2).toUpperCase();
}

function MemberOptionRow({
  member,
  className,
}: {
  member: UnifiedMemberRow;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className="size-7 shrink-0">
        {member.user?.avatar ? (
          <AvatarImage
            src={member.user.avatar}
            alt={displayName(member)}
          />
        ) : null}
        <AvatarFallback className="text-[10px] font-medium">
          {initials(member)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate text-sm font-medium">
          {displayName(member)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {member.email} · {roleLabel(member.role)}
        </span>
      </span>
    </span>
  );
}

export function TransferOwnershipDialog({
  orgId,
  members,
  open,
  onOpenChange,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [message, setMessage] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const transferMutation = useTransferOwnershipMutation(orgId);

  const eligibleMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          m.type === "member" &&
          m.status === "active" &&
          m.role !== "owner",
      ),
    [members],
  );

  const selectedMember = useMemo(
    () => eligibleMembers.find((m) => m.id === selectedMemberId) ?? null,
    [eligibleMembers, selectedMemberId],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedMemberId("");
    setMessage("");
    setComboboxOpen(false);
  }, [open]);

  const handleOpenChange: Dispatch<SetStateAction<boolean>> = (value) => {
    const next = typeof value === "function" ? value(open) : value;
    onOpenChange(next);
    if (!next) {
      setSelectedMemberId("");
      setMessage("");
      setComboboxOpen(false);
    }
  };

  const handleTransfer = () => {
    if (!selectedMemberId) return;
    transferMutation.mutate(selectedMemberId, {
      onSuccess: () => {
        toast.success("Ownership transferred");
        handleOpenChange(false);
      },
      onError: (err) =>
        toast.error(extractApiErrorMessage(err, "Transfer failed")),
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange} size="md">
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Title>Transfer Ownership</ResponsiveDialog.Title>
        <ResponsiveDialog.Description>
          Transfer ownership of this organization to another member. You will
          become an admin after the transfer.
        </ResponsiveDialog.Description>
      </ResponsiveDialog.Header>

      <ResponsiveDialog.Content>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transfer-member">Select New Owner</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="transfer-member"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  disabled={eligibleMembers.length === 0}
                  className="h-auto w-full justify-between px-3 py-2 font-normal"
                >
                  {selectedMember ? (
                    <MemberOptionRow member={selectedMember} />
                  ) : (
                    <span className="text-muted-foreground">
                      {eligibleMembers.length === 0
                        ? "No eligible members"
                        : "Choose a member..."}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-(--anchor-width) min-w-(--anchor-width) p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search by name or email..." />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {eligibleMembers.map((member) => {
                        const name = displayName(member);
                        const isSelected = member.id === selectedMemberId;
                        return (
                          <CommandItem
                            key={member.id}
                            value={`${name} ${member.email} ${roleLabel(member.role)}`}
                            onSelect={() => {
                              setSelectedMemberId(member.id);
                              setComboboxOpen(false);
                            }}
                            className="py-2"
                          >
                            <MemberOptionRow
                              member={member}
                              className="flex-1"
                            />
                            <Check
                              className={cn(
                                "ml-2 size-4 shrink-0",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-message">Message (Optional)</Label>
            <Textarea
              id="transfer-message"
              placeholder="Add a personal message to the new owner..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full"
            />
          </div>
        </div>
      </ResponsiveDialog.Content>

      <ResponsiveDialog.Footer>
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={transferMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleTransfer}
          disabled={
            transferMutation.isPending ||
            !selectedMemberId ||
            eligibleMembers.length === 0
          }
        >
          {transferMutation.isPending ? (
            <>
              <Spinner />
              Transferring...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Transfer Ownership
            </>
          )}
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
