import { api } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

function getConvexUrl() {
  return process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
}

function getWebhookSecret() {
  return process.env.POLAR_WEBHOOK_SECRET ?? "";
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("polar-signature") ?? "";
  const rawBody = await request.text();

  const secret = getWebhookSecret();
  if (secret && !timingSafeEqual(signature, secret)) {
    return new Response("Invalid Polar signature.", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>)
      : {};
  const organizationWorkosOrgId =
    typeof metadata.organizationWorkosOrgId === "string"
      ? metadata.organizationWorkosOrgId
      : typeof metadata.org === "string"
        ? metadata.org
        : typeof payload.organizationWorkosOrgId === "string"
          ? payload.organizationWorkosOrgId
          : null;

  if (!organizationWorkosOrgId) {
    return new Response("Missing organizationWorkosOrgId.", { status: 400 });
  }

  const eventType =
    typeof payload.type === "string" ? payload.type : "unknown";
  const status =
    eventType.includes("canceled")
      ? "cancelled"
      : eventType.includes("checkout")
        ? "checkout_pending"
        : eventType.includes("created") || eventType.includes("confirmed")
          ? "active"
          : "active";

  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const client = new ConvexHttpClient(getConvexUrl(), { logger: false });
  await client.mutation(api.platform.recordBillingWebhookEvent, {
    workosOrgId: organizationWorkosOrgId,
    provider: "polar",
    kind: eventType,
    externalId:
      typeof payload.id === "string" ? payload.id : undefined,
    payloadJson: rawBody,
  });

  await client.mutation(api.platform.upsertBillingAccount, {
    workosOrgId: organizationWorkosOrgId,
    provider: "polar",
    status,
    customerId:
      typeof data.customer_id === "string"
        ? data.customer_id
        : typeof data.customerId === "string"
          ? data.customerId
          : undefined,
    subscriptionId:
      typeof data.subscription_id === "string"
        ? data.subscription_id
        : typeof data.subscriptionId === "string"
          ? data.subscriptionId
          : undefined,
    planId:
      typeof data.product_id === "string"
        ? data.product_id
        : typeof data.planId === "string"
          ? data.planId
          : undefined,
    metadataJson: rawBody,
  });

  return Response.json({ ok: true });
}
