"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import {
  MembersEndpoints,
  InvitesEndpoints,
  replacePathParams,
} from "@/lib/constants/endpoints";
import { invalidateMembers, memberKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type UnifiedMemberRow = {
  id: string;
  type: "member" | "invitation";
  orgId: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited";
  email: string;
  message: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  } | null;
};

export type InvitePreview = {
  id: string;
  email: string;
  role: string;
  status: string;
  org: { id: string; name: string; slug: string };
};

export function useMembersQuery(
  orgId: string | undefined,
  type: "all" | "member" | "invitation" = "all",
) {
  return useQuery({
    queryKey: memberKeys.list(orgId, type),
    enabled: Boolean(orgId),
    queryFn: async () => {
      const response = await upstream.get(
        replacePathParams(MembersEndpoints.List, orgId!),
        { params: { type } },
      );
      const payload = unwrapApiData<{ items: UnifiedMemberRow[] }>(
        response.data,
      );
      return payload.items;
    },
  });
}

export function useInviteMemberMutation(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      role: "admin" | "member";
      message?: string;
    }) => {
      const response = await upstream.post(
        replacePathParams(MembersEndpoints.Invite, orgId!),
        input,
      );
      return unwrapApiData<UnifiedMemberRow>(response.data);
    },
    onSuccess: () => invalidateMembers(qc),
  });
}

export function useResendInviteMutation(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await upstream.post(
        replacePathParams(MembersEndpoints.Resend, orgId!, memberId),
      );
      return unwrapApiData<UnifiedMemberRow>(response.data);
    },
    onSuccess: () => invalidateMembers(qc),
  });
}

export function useChangeMemberRoleMutation(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; role: "admin" | "member" }) => {
      const response = await upstream.patch(
        replacePathParams(MembersEndpoints.ChangeRole, orgId!, input.memberId),
        { role: input.role },
      );
      return unwrapApiData<UnifiedMemberRow>(response.data);
    },
    onSuccess: () => invalidateMembers(qc),
  });
}

export function useRemoveMemberMutation(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      await upstream.delete(
        replacePathParams(MembersEndpoints.Remove, orgId!, memberId),
      );
    },
    onSuccess: () => invalidateMembers(qc),
  });
}

export function useTransferOwnershipMutation(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await upstream.post(
        replacePathParams(MembersEndpoints.Transfer, orgId!),
        { memberId },
      );
      return unwrapApiData<{ message: string }>(response.data);
    },
    onSuccess: () => invalidateMembers(qc),
  });
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const response = await upstream.get(
    replacePathParams(InvitesEndpoints.Preview, token),
  );
  return unwrapApiData<InvitePreview>(response.data);
}

export async function acceptInvite(input: {
  token: string;
  password?: string;
  name?: string;
}): Promise<{
  token: string;
  orgId: string;
  role: string;
  admin: { id: string; email: string; role: string; name?: string | null };
}> {
  const response = await upstream.post(
    replacePathParams(InvitesEndpoints.Accept, input.token),
    { password: input.password, name: input.name },
  );
  return unwrapApiData(response.data);
}
