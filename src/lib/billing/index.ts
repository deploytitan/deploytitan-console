import { getDeployTitanBaseUrl } from "@/lib/workos";
import { paddleBillingAdapter } from "./providers/paddle";
import { polarBillingAdapter } from "./providers/polar";
import type {
  BillingCheckoutRequest,
  BillingPortalRequest,
  BillingProvider,
  BillingProviderAdapter,
} from "./types";

function getConfiguredProvider(): BillingProvider {
  const configured = (
    process.env.DEPLOYTITAN_BILLING_PROVIDER ?? "paddle"
  ).toLowerCase();
  return configured === "polar" ? "polar" : "paddle";
}

export function getAvailableBillingProviders() {
  return ["paddle", "polar"] as const;
}

export function getDefaultBillingProvider() {
  return getConfiguredProvider();
}

function getAdapter(provider?: BillingProvider): BillingProviderAdapter {
  const resolvedProvider = provider ?? getConfiguredProvider();
  return resolvedProvider === "polar"
    ? polarBillingAdapter
    : paddleBillingAdapter;
}

export async function createCheckoutSession(
  input: BillingCheckoutRequest & { provider?: BillingProvider },
) {
  return await getAdapter(input.provider).createCheckoutSession(input);
}

export async function createPortalSession(
  input: BillingPortalRequest & { provider?: BillingProvider },
) {
  return await getAdapter(input.provider).createPortalSession(input);
}

export function getBillingReturnUrl(path = "/onboarding") {
  return `${getDeployTitanBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
