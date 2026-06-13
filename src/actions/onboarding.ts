"use server";

import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs";
import { convexSyncSession } from "@/lib/console/convexServer";

export type CreateOrgResult =
  | { success: true; orgId: string }
  | { success: false; error: string };

export async function createOrganizationAction(
  orgName: string,
): Promise<CreateOrgResult> {
  const trimmed = orgName.trim();

  if (!trimmed) {
    return { success: false, error: "Organization name is required." };
  }

  if (trimmed.length < 2) {
    return {
      success: false,
      error: "Organization name must be at least 2 characters.",
    };
  }

  try {
    const { user, accessToken } = await withAuth({ ensureSignedIn: true });
    if (!accessToken) {
      return { success: false, error: "Not authenticated." };
    }

    const organization = await getWorkOS().organizations.createOrganization({
      name: trimmed,
    });

    await getWorkOS().userManagement.createOrganizationMembership({
      userId: user.id,
      organizationId: organization.id,
    });

    await convexSyncSession(accessToken, {
      user: {
        workosUserId: user.id,
        email: user.email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
      },
      organization: {
        workosOrgId: organization.id,
        name: organization.name,
      },
    });

    return { success: true, orgId: organization.id };
  } catch (err) {
    console.error("[createOrganizationAction] fetch error", err);
    return {
      success: false,
      error: "Failed to create organization. Please try again.",
    };
  }
}
