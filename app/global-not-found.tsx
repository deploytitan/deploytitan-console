import { JetBrains_Mono } from "next/font/google";

import "@/index.css";
import { ErrorPageShell } from "@/components/errors/ErrorPageShell";
import { AppProviders } from "@/app/router-shell";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={jetbrainsMono.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <AppProviders>
          <ErrorPageShell variant="not-found" />
        </AppProviders>
      </body>
    </html>
  );
}
