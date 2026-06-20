import { withAuth } from "@workos-inc/authkit-nextjs";
import { api } from "@convex/_generated/api";
import { createPortalSession, getBillingReturnUrl } from "@/lib/billing";
import { convexMutation, convexQuery } from "@/lib/console/convexServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    provider?: "paddle" | "polar";
  };

  const { accessToken } = await withAuth({ ensureSignedIn: true });
  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const actor = await convexQuery(accessToken, api.actors.getActorContext, {});
  const organizations = (actor.organizations ?? []) as Array<{
    workosOrgId: string;
    name: string;
  }>;
  const workosOrgId = actor.activeWorkosOrgId ?? organizations[0]?.workosOrgId ?? null;
  if (!workosOrgId) {
    return Response.json({ error: "No active organization." }, { status: 400 });
  }

  const organization = organizations.find(
    (entry) => entry.workosOrgId === workosOrgId,
  );
  if (!organization) {
    return Response.json({ error: "Organization context is missing." }, { status: 400 });
  }

  const session = await createPortalSession({
    provider: body.provider,
    organizationWorkosOrgId: workosOrgId,
    organizationName: organization.name,
    customerEmail: actor.user?.email ?? null,
    returnUrl: getBillingReturnUrl("/onboarding"),
  });

  await convexMutation(accessToken, api.platform.upsertBillingAccount, {
    workosOrgId,
    provider: session.provider,
    status: "active",
    portalUrl: session.url,
    metadataJson: JSON.stringify(session.metadata),
  });

  return Response.json({
    provider: session.provider,
    portalUrl: session.url,
  });
}
