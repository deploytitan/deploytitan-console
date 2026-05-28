"use client";

import { useConnectionToast } from "@/hooks/useConnectionToast";
import { ConsoleSidebar } from "./ConsoleSidebar";

export function ConsoleLayoutComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  useConnectionToast();

  return (
    <div className="flex min-h-screen bg-background">
      <ConsoleSidebar />
      <main className="flex-1 min-w-0 ml-[220px]">{children}</main>
    </div>
  );
}
