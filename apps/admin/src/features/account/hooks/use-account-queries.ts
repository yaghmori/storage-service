"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { AdminAuthEndpoints } from "@/lib/constants/endpoints";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AccountMe = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export function useAccountMeQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.ACCOUNT.ME,
    queryFn: async () => {
      const response = await upstream.get(AdminAuthEndpoints.Me);
      return unwrapApiData<AccountMe>(response.data);
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNT.ME });
    },
  });
}
