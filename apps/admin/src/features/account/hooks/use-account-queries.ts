"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { AdminAuthEndpoints } from "@/lib/constants/endpoints";
import { accountKeys, invalidateAccount } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AccountMe = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export function useAccountMeQuery() {
  return useQuery({
    queryKey: accountKeys.me,
    queryFn: async () => {
      const response = await upstream.get(AdminAuthEndpoints.Me);
      return unwrapApiData<AccountMe>(response.data);
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name?: string | null;
      avatar?: string | null;
    }) => {
      const response = await upstream.put(
        AdminAuthEndpoints.UpdateProfile,
        input,
      );
      return unwrapApiData<AccountMe>(response.data);
    },
    onSuccess: () => {
      invalidateAccount(queryClient);
    },
  });
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const response = await upstream.put(
        AdminAuthEndpoints.ChangePassword,
        input,
      );
      return unwrapApiData<{ message: string }>(response.data);
    },
    onSuccess: () => {
      invalidateAccount(queryClient);
    },
  });
}
