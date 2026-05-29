import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import "@/index.css";
import { AppProviders } from "@/app/router-shell";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DeployTitan Console",
  description: "DeployTitan deployment operations console",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={jetbrainsMono.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
