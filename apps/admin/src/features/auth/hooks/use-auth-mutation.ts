"use client";

import { useAuth } from "@/provider/auth-provider";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { MUTATION_KEYS } from "@/lib/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export function useSignIn() {
  const { signIn } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: MUTATION_KEYS.AUTH.LOGIN,
    mutationFn: async (credentials: { email: string; password: string }) => {
      await signIn(credentials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationKey: MUTATION_KEYS.AUTH.FORGOT_PASSWORD,
    mutationFn: async (input: { email: string }) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Failed to reset password");
      }
      return {
        message:
          data.message ||
          "If an account exists for that email, a temporary password was written to the service container logs.",
      };
    },
  });
}

export function useLogout() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationKey: MUTATION_KEYS.AUTH.LOGOUT,
    mutationFn: async () => {
      await signOut();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push(PAGE_ROUTES.AUTH.LOGIN);
      router.refresh();
    },
  });
}
