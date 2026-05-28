import { ConsoleLayoutComponent } from "@/components/console/ConsoleLayoutComponent";
import { ReactNode } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";

export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  await withAuth({ ensureSignedIn: true });
  return <ConsoleLayoutComponent>{children}</ConsoleLayoutComponent>;
}
