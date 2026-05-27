"use client";

/**
 * ConsoleLayout — wraps all protected pages.
 *
 * At the root "/" route the sidebar is hidden; a slim top bar with the
 * brand mark and user menu is rendered instead. All other routes get the
 * standard sidebar + inset layout.
 *
 * Uses the Next-compatible match helper to detect the index route.
 */

import { useMatchRoute } from "@/lib/navigation";
import { ConsoleSidebar } from "./ConsoleSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { RootTopBar } from "./RootTopBar";
import { useConnectionToast } from "@/hooks/useConnectionToast";

export function ConsoleLayoutComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  const matchRoute = useMatchRoute();
  const isRoot = matchRoute({ to: "/", fuzzy: false });

  // Fire debounced toasts on Zero sync state changes.
  // Safe to call unconditionally — no-ops when Zero is not in context.
  useConnectionToast();

  if (isRoot) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <RootTopBar />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ConsoleSidebar />
      <SidebarInset className="min-h-screen bg-surface">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
