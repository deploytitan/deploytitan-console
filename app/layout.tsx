import type { Metadata } from "next";

import "@/index.css";
import { AppProviders } from "@/app/router-shell";

export const metadata: Metadata = {
  title: "DeployTitan Console",
  description: "DeployTitan deployment operations console",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
