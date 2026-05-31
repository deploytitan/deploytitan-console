"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";

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

  const { accessToken } = await withAuth({ ensureSignedIn: true });

  if (!accessToken) {
    return { success: false, error: "Not authenticated." };
  }

  const origin = process.env.NEXT_PUBLIC_API_URL ?? "";

  let data: { workosOrgId: string };
  try {
    const res = await fetch(`${origin}/orgs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: trimmed }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[createOrganizationAction] POST /orgs failed", res.status, text);
      return {
        success: false,
        error: "Failed to create organization. Please try again.",
      };
    }

    data = await res.json();
  } catch (err) {
    console.error("[createOrganizationAction] fetch error", err);
    return {
      success: false,
      error: "Failed to create organization. Please try again.",
    };
  }

  return { success: true, orgId: data.workosOrgId };
}
