"use client";

import { readActiveThemeCookie } from "@/lib/active-theme-cookie";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActiveThemeProvider } from "@workspace/ui/providers/active-theme";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "./auth-provider";
import { LocalTimezoneProvider } from "./local-timezone-provider";

function useIsMobileOrTablet() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobileOrTablet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobileOrTablet;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const isMobileOrTablet = useIsMobileOrTablet();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: unknown) => {
              const status = (error as { status?: number })?.status;
              if (status === 401) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );
  const [initialTheme] = useState(() => readActiveThemeCookie());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ActiveThemeProvider initialTheme={initialTheme}>
            <LocalTimezoneProvider>
              {children}
              <Toaster
                position={isMobileOrTablet ? "top-center" : "bottom-right"}
                richColors
                duration={5000}
              />
            </LocalTimezoneProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
