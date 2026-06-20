import { withAuth } from "@workos-inc/authkit-nextjs";
import { api } from "@convex/_generated/api";
import { createCheckoutSession, getBillingReturnUrl } from "@/lib/billing";
import { convexMutation, convexQuery } from "@/lib/console/convexServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    provider?: "paddle" | "polar";
    planId?: string;
    continuationToken?: string;
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

  const returnUrl = getBillingReturnUrl(
    `/onboarding/complete?step=billing${
      body.continuationToken ? `&token=${encodeURIComponent(body.continuationToken)}` : ""
    }`,
  );

  const session = await createCheckoutSession({
    provider: body.provider,
    organizationWorkosOrgId: workosOrgId,
    organizationName: organization.name,
    customerEmail: actor.user?.email ?? null,
    returnUrl,
    planId: body.planId ?? "starter",
  });

  await convexMutation(accessToken, api.platform.upsertBillingAccount, {
    workosOrgId,
    provider: session.provider,
    status: "checkout_pending",
    customerId: session.externalCustomerId ?? undefined,
    subscriptionId: session.externalSubscriptionId ?? undefined,
    planId: body.planId ?? "starter",
    checkoutUrl: session.url,
    metadataJson: JSON.stringify(session.metadata),
  });

  return Response.json({
    provider: session.provider,
    checkoutUrl: session.url,
  });
}
