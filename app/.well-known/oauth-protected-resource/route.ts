import {
  getDeployTitanMcpResourceUrl,
  getWorkOSAuthorizationServerIssuer,
} from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const authorizationServer = getWorkOSAuthorizationServerIssuer();

  return Response.json({
    resource: getDeployTitanMcpResourceUrl(origin),
    authorization_servers: authorizationServer ? [authorizationServer] : [],
    bearer_methods_supported: ["header"],
  });
}
