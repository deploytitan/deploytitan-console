"use client";

import { useConnectionToast } from "@/hooks/useConnectionToast";

export function ConsoleLayoutComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  useConnectionToast();

  return <div>{children}</div>;
}
