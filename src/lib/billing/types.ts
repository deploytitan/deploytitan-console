export type BillingProvider = "paddle" | "polar";

export type BillingCheckoutRequest = {
  organizationWorkosOrgId: string;
  organizationName: string;
  customerEmail: string | null;
  returnUrl: string;
  planId: string;
};

export type BillingPortalRequest = {
  organizationWorkosOrgId: string;
  organizationName: string;
  customerEmail: string | null;
  returnUrl: string;
};

export type BillingCheckoutResult = {
  provider: BillingProvider;
  url: string;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  metadata: Record<string, string>;
};

export type BillingPortalResult = {
  provider: BillingProvider;
  url: string;
  metadata: Record<string, string>;
};

export type BillingProviderAdapter = {
  provider: BillingProvider;
  createCheckoutSession: (
    input: BillingCheckoutRequest,
  ) => Promise<BillingCheckoutResult>;
  createPortalSession: (
    input: BillingPortalRequest,
  ) => Promise<BillingPortalResult>;
};
