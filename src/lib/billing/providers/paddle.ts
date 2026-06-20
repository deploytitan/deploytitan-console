import type {
  BillingCheckoutRequest,
  BillingCheckoutResult,
  BillingPortalRequest,
  BillingPortalResult,
  BillingProviderAdapter,
} from "../types";

function getHostedBaseUrl() {
  return (
    process.env.PADDLE_CHECKOUT_URL ??
    process.env.NEXT_PUBLIC_PADDLE_CHECKOUT_URL ??
    ""
  ).replace(/\/+$/, "");
}

function getPortalBaseUrl() {
  return (
    process.env.PADDLE_CUSTOMER_PORTAL_URL ??
    process.env.NEXT_PUBLIC_PADDLE_CUSTOMER_PORTAL_URL ??
    ""
  ).replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, params: Record<string, string | undefined>) {
  if (!baseUrl) {
    throw new Error("Paddle hosted URL is not configured.");
  }

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function createCheckoutSession(
  input: BillingCheckoutRequest,
): Promise<BillingCheckoutResult> {
  const url = buildUrl(getHostedBaseUrl(), {
    plan: input.planId,
    email: input.customerEmail ?? undefined,
    org: input.organizationWorkosOrgId,
    org_name: input.organizationName,
    return_url: input.returnUrl,
  });

  return {
    provider: "paddle",
    url,
    externalCustomerId: null,
    externalSubscriptionId: null,
    metadata: {
      planId: input.planId,
      organizationWorkosOrgId: input.organizationWorkosOrgId,
    },
  };
}

async function createPortalSession(
  input: BillingPortalRequest,
): Promise<BillingPortalResult> {
  const url = buildUrl(getPortalBaseUrl(), {
    email: input.customerEmail ?? undefined,
    org: input.organizationWorkosOrgId,
    return_url: input.returnUrl,
  });

  return {
    provider: "paddle",
    url,
    metadata: {
      organizationWorkosOrgId: input.organizationWorkosOrgId,
    },
  };
}

export const paddleBillingAdapter: BillingProviderAdapter = {
  provider: "paddle",
  createCheckoutSession,
  createPortalSession,
};
