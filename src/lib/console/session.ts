import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { convexSyncSession } from "@/lib/console/convexServer";
import { ResultAsync } from "neverthrow";

export async function syncAuthenticatedSessionToConvex(): Promise<{
  organizationId: string | null;
}> {
  const { user, organizationId, accessToken } = await withAuth({
    ensureSignedIn: true,
  });

  if (!accessToken) {
    throw new Error("Missing WorkOS access token.");
  }

  if (!organizationId) {
    throw new Error("Missing WorkOS organization ID.");
  }

  const orgFetchResult = await ResultAsync.fromPromise(
    getWorkOS().organizations.getOrganization(organizationId),
    (err) => {
      console.error(
        "[syncAuthenticatedSessionToConvex] getOrganization error",
        err,
      );
      return err;
    },
  );
  if (orgFetchResult.isErr()) {
    throw new Error("Failed to fetch WorkOS organization.");
  }
  const organization = orgFetchResult.match(
    (org) => org,
    (err) => null,
  );

  await convexSyncSession(accessToken, {
    user: {
      workosUserId: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    },
    organization: organization
      ? {
          workosOrgId: organization.id,
          name: organization.name,
        }
      : null,
    defaultWorkosOrgId: organizationId ?? null,
  });

  return { organizationId: organizationId ?? null };
}
