import {
  encodeState,
  getWorkOSAuthorizationEndpoint,
} from "@/lib/mcp/oauthProxy";
import { getDeployTitanBaseUrl, getWorkOSUserManagementIssuerId } from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const clientRedirectUri = incoming.searchParams.get("redirect_uri") ?? "";
  const clientState = incoming.searchParams.get("state") ?? "";

  if (!clientRedirectUri || !isAllowedRedirectUri(clientRedirectUri)) {
    return new Response(
      JSON.stringify({ error: "invalid_request", error_description: "redirect_uri must be a localhost URI" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const internalState = encodeState({ clientRedirectUri, clientState });
  const origin = incoming.origin;
  const baseUrl = getDeployTitanBaseUrl() || origin;
  const callbackUri = `${baseUrl}/api/mcp/auth/callback`;
  const workosEndpoint = getWorkOSAuthorizationEndpoint();
  const clientId = process.env.WORKOS_CLIENT_ID || getWorkOSUserManagementIssuerId();

  const params = new URLSearchParams(incoming.searchParams);
  params.set("client_id", clientId);
  params.set("redirect_uri", callbackUri);
  params.set("state", internalState);

  return Response.redirect(`${workosEndpoint}?${params.toString()}`);
}
