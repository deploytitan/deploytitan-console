"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
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

  const { data: zeroInstance, isLoading } = useQuery({
    queryKey: ["zero-instance", userId, accessToken],
    queryFn: ({ queryKey }) => {
      const _userId = queryKey[1];
      const _accessToken = queryKey[2];
      zeroRef.current?.close();
      setSchemaMismatchMessage(undefined);
      const instance = createZero({
        token: _accessToken,
        userId: _userId,
        onUpdateNeeded: handleUpdateNeeded,
      });
      zeroRef.current = instance;
      return instance;
    },
    enabled: !loading,
  });

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
