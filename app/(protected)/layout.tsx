"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { UpdateNeededReason } from "@rocicorp/zero";
import {
  useAccessToken,
  useAuth,
} from "@workos-inc/authkit-nextjs/components";
import { useQuery } from "@tanstack/react-query";
import { createZero } from "@/zero/provider";
import { ZeroProvider } from "@rocicorp/zero/react";
import { ZeroSchemaMismatchScreen } from "@/components/errors/ZeroSchemaMismatchScreen";
import { logFrontendEvent } from "@/lib/frontendTelemetry";

function ZeroWithAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { accessToken } = useAccessToken();
  const [schemaMismatchMessage, setSchemaMismatchMessage] = useState<
    string | undefined
  >(undefined);

  const zeroRef = useRef<ReturnType<typeof createZero> | null>(null);

  const userId = user?.id;

  const handleUpdateNeeded = useCallback((reason: UpdateNeededReason) => {
    logFrontendEvent({
      level: reason.type === "SchemaVersionNotSupported" ? "error" : "warn",
      message: "zero.update_needed",
      context: reason,
    });

    if (reason.type === "SchemaVersionNotSupported") {
      setSchemaMismatchMessage(reason.message);
      return;
    }

    window.location.reload();
  }, []);

  // Keyed only on userId — the Zero instance is created once per user session.
  const { data: zeroInstance, isLoading } = useQuery({
    queryKey: ["zero-instance", userId],
    queryFn: ({ queryKey }) => {
      const _userId = queryKey[1];
      zeroRef.current?.close();
      setSchemaMismatchMessage(undefined);
      const instance = createZero({
        token: accessToken,
        userId: _userId,
        onUpdateNeeded: handleUpdateNeeded,
      });
      zeroRef.current = instance;
      return instance;
    },
    enabled: !loading,
  });

  // Push token refreshes to the existing Zero instance without recreating it.
  // This prevents JWTExpired errors when WorkOS rotates the access token.
  useEffect(() => {
    if (!zeroInstance || !accessToken) return;
    void zeroInstance.connection.connect({ auth: accessToken });
  }, [zeroInstance, accessToken]);

  if (schemaMismatchMessage !== undefined) {
    return <ZeroSchemaMismatchScreen message={schemaMismatchMessage} />;
  }

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
