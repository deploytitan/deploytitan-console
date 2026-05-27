"use client";

import { ReactNode, Suspense, useRef } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { ZeroProvider } from "@rocicorp/zero/react";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { initGrafanaFaro } from "@/lib/grafanaFaro";
import { installFrontendTelemetry } from "@/lib/frontendTelemetry";
import { createZero } from "@/zero/provider";
import {
  AuthKitProvider,
  useAccessToken,
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

function ZeroWithAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { accessToken } = useAccessToken();

  const zeroRef = useRef<ReturnType<typeof createZero> | null>(null);

  const userId = user?.id;

  const { data: zeroInstance, isLoading } = useQuery({
    queryKey: ["zero-instance", userId, accessToken],
    queryFn: ({ queryKey }) => {
      const _userId = queryKey[1];
      const _accessToken = queryKey[2];
      zeroRef.current?.close();
      const instance = createZero(_accessToken, _userId);
      zeroRef.current = instance;
      return instance;
    },
    enabled: !loading,
  });

  if (!zeroInstance || isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="font-mono text-sm text-ink-tertiary">Loading...</span>
      </div>
    );
  }

  return <ZeroProvider zero={zeroInstance}>{children}</ZeroProvider>;
}

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
        <div className="fixed top-0 right-0 z-50 mx-4 my-2 hover:opacity-30 transition-all duration-200 ease-in-out">
          <ConnectionStatus />
        </div>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <FrontendTelemetryBootstrap />
            <ZeroWithAuth>{children}</ZeroWithAuth>
          </ThemeProvider>
        </QueryClientProvider>
        <Toaster />
      </Suspense>
    </AuthKitProvider>
  );
}
