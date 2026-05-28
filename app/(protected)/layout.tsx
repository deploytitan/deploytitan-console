"use client";

import { ReactNode, Suspense, useRef } from "react";
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from "@workos-inc/authkit-nextjs/components";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createZero } from "@/zero/provider";
import { ZeroProvider } from "@rocicorp/zero/react";

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

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ZeroWithAuth>
      <div className="protected-layout">{children}</div>
    </ZeroWithAuth>
  );
}
