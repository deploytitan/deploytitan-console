import { withAuth } from "@workos-inc/authkit-nextjs";
import { GitHubInstallCallbackClient } from "@/components/github/GitHubInstallCallbackClient";

function readSingleParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }

  return null;
}

export default async function GitHubInstallCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    installation_id?: string | string[];
    setup_action?: string | string[];
  }>;
}) {
  await withAuth({ ensureSignedIn: true });

  const resolvedSearchParams = await searchParams;
  const installationIdParam = readSingleParam(
    resolvedSearchParams.installation_id,
  );
  const setupAction = readSingleParam(resolvedSearchParams.setup_action);
  const installationId = installationIdParam
    ? Number.parseInt(installationIdParam, 10)
    : null;

  return (
    <GitHubInstallCallbackClient
      installationId={Number.isFinite(installationId) ? installationId : null}
      setupAction={setupAction}
    />
  );
}
