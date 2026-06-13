"use client";

import { useCallback, useMemo } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import {
  useAccessToken,
  useAuth,
} from "@workos-inc/authkit-nextjs/components";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL must be set before rendering the Convex client.",
  );
}

const convex = new ConvexReactClient(convexUrl);

function useWorkOSConvexAuth() {
  const { user, loading } = useAuth();
  const { getAccessToken } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      if (forceRefreshToken) {
        return (await getAccessToken()) ?? null;
      }
      return (await getAccessToken()) ?? null;
    },
    [getAccessToken, user],
  );

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: Boolean(user),
      fetchAccessToken,
    }),
    [fetchAccessToken, loading, user],
  );
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkOSConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
