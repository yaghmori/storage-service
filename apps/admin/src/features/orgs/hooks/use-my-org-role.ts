"use client";

import { useMembersQuery } from "@/features/members/hooks/use-members-queries";
import { useAuth } from "@/provider/auth-provider";
import { useActiveOrg } from "@/provider/org-provider";
import { useMemo } from "react";

export type OrgMemberRole = "owner" | "admin" | "member";

/** Current user's active membership role in the selected organization. */
export function useMyOrgRole() {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrg();
  const { data = [], isLoading } = useMembersQuery(activeOrg?.id, "member");

  const role = useMemo((): OrgMemberRole | null => {
    if (!user) return null;
    const mine = data.find(
      (m) =>
        m.type === "member" &&
        m.status === "active" &&
        (m.user?.id === user.id || m.email === user.email),
    );
    if (!mine) return null;
    if (mine.role === "owner" || mine.role === "admin" || mine.role === "member") {
      return mine.role;
    }
    return "member";
  }, [data, user]);

  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    isLoading,
  };
}
