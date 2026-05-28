import { ErrorPageShell } from "@/components/errors/ErrorPageShell";
import { AppProviders } from "@/app/router-shell";

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <ErrorPageShell variant="not-found" />;
        </AppProviders>
      </body>
    </html>
  );
}
