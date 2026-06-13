import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { convexSyncSession } from "@/lib/console/convexServer";

export async function syncAuthenticatedSessionToConvex(): Promise<{
  organizationId: string | null;
}> {
  const { user, organizationId, accessToken } = await withAuth({
    ensureSignedIn: true,
  });

  if (!accessToken) {
    throw new Error("Missing WorkOS access token.");
  }

  const organization = organizationId
    ? await getWorkOS().organizations.getOrganization(organizationId)
    : null;

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
  });

  return { organizationId: organizationId ?? null };
}
