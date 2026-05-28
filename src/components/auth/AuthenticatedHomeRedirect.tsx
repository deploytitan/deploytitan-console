"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthenticatedHomeRedirect({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/orgs/${organizationId}`);
  }, [organizationId, router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <span className="font-mono text-sm text-ink-tertiary">Loading...</span>
    </div>
  );
}
