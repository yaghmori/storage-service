"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { UsersEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { invalidateUsers, userKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: async () => {
      const response = await upstream.get(UsersEndpoints.List);
      const items = unwrapApiData<AdminUserRow[]>(response.data);
      return { items, total: items.length, totalPages: 1 };
    },
  });
}

export function useCreateAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      role?: string;
    }) => {
      const response = await upstream.post(UsersEndpoints.Create, input);
      return unwrapApiData<AdminUserRow>(response.data);
    },
    onSuccess: () => {
      invalidateUsers(queryClient);
    },
  });
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{
        email: string;
        password: string;
        role: string;
        isActive: boolean;
      }>;
    }) => {
      const path = replacePathParams(UsersEndpoints.Update, id);
      const response = await upstream.put(path, input);
      return unwrapApiData<AdminUserRow>(response.data);
    },
    onSuccess: () => {
      invalidateUsers(queryClient);
    },
  });
}

export function useDeleteAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(UsersEndpoints.Delete, id);
      await upstream.delete(path);
    },
    onSuccess: () => {
      invalidateUsers(queryClient);
    },
  });
}
