import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { convexMutation } from "@/lib/console/convexServer";

type SessionSyncArgs = {
  user: {
    workosUserId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  organization:
    | {
        workosOrgId: string;
        name: string;
      }
    | null;
};

export async function syncAuthenticatedSessionToConvex(): Promise<{
  organizationId: string | null;
}> {
  const { user, organizationId } = await withAuth({ ensureSignedIn: true });

  const organization = organizationId
    ? await getWorkOS().organizations.getOrganization(organizationId)
    : null;

  await convexMutation<SessionSyncArgs, null>("console:syncSession", {
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
