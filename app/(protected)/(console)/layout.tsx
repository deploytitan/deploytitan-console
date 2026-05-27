import type { ReactNode } from "react";
import { ConsoleLayoutComponent } from "@/components/console/ConsoleLayoutComponent";

// All console pages require authentication and real-time data
// Disable static generation for this route segment
export const dynamic = "force-dynamic";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleLayoutComponent>{children}</ConsoleLayoutComponent>;
}
