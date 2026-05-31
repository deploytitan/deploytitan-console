"use client";

import { ReactNode, Suspense } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { initGrafanaFaro } from "@/lib/grafanaFaro";
import { installFrontendTelemetry } from "@/lib/frontendTelemetry";
import {
  AuthKitProvider,
  useAuth,
} from "@workos-inc/authkit-nextjs/components";
import { ConnectionStatus } from "@/components/console/ConnectionStatus";
import { Toaster } from "@/components/ui/Toaster";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ("status" in error) {
          const status = (error as { status: number }).status;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});

function FrontendTelemetryBootstrap() {
  const { user } = useAuth();

  useQuery({
    queryKey: ["init-grafana-faro", user?.id, user?.email],
    queryFn: async () => {
      await initGrafanaFaro();
      installFrontendTelemetry(user);
      return null;
    },
  });

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <Suspense fallback={null}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FrontendTelemetryBootstrap />
            {children}
          </ThemeProvider>
          <Toaster />
        </QueryClientProvider>
      </Suspense>
    </AuthKitProvider>
  );
}
