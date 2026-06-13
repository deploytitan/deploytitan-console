"use server";

import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs";
import { convexMutation } from "@/lib/console/convexServer";

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
    const { user } = await withAuth({ ensureSignedIn: true });
    const organization = await getWorkOS().organizations.createOrganization({
      name: trimmed,
    });

    await getWorkOS().userManagement.createOrganizationMembership({
      userId: user.id,
      organizationId: organization.id,
    });

    await convexMutation("console:createOrganization", {
      workosOrgId: organization.id,
      name: organization.name,
      userWorkosId: user.id,
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
