import {
  getDeployTitanMcpResourceUrl,
  getDeployTitanBaseUrl,
  getGithubAppInstallUrl,
  getVercelConnectUrl,
  getWorkOSAuthKitDomain,
  getWorkOsClientId,
} from "@/lib/workos";
import {
  getAvailableBillingProviders,
  getDefaultBillingProvider,
} from "@/lib/billing";
import { getVercelCallbackUrl, isVercelAppConfigured } from "@/lib/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    service: "deploytitan-console",
    mcp: {
      endpoint: getDeployTitanMcpResourceUrl(origin),
      protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource`,
      authServerMetadata: `${origin}/.well-known/oauth-authorization-server`,
    },
    workos: {
      authKitDomain: getWorkOSAuthKitDomain() || null,
      workosClientId: Boolean(getWorkOsClientId()),
    },
    baseUrl: getDeployTitanBaseUrl() || origin,
    github: {
      installUrl: getGithubAppInstallUrl() || null,
    },
    vercel: {
      connectUrl: getVercelConnectUrl(origin) || null,
      callbackUrl: getVercelCallbackUrl() || null,
      configured: isVercelAppConfigured(),
    },
    billing: {
      defaultProvider: getDefaultBillingProvider(),
      availableProviders: getAvailableBillingProviders(),
      paddleCheckoutConfigured: Boolean(process.env.PADDLE_CHECKOUT_URL),
      polarCheckoutConfigured: Boolean(process.env.POLAR_CHECKOUT_URL),
    },
    integrations: {
      slackConfigured: Boolean(process.env.DEPLOYTITAN_BASE_URL),
    },
  });
}
