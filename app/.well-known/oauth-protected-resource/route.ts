import { getDeployTitanMcpResourceUrl, getWorkOSAuthKitDomain } from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const authKitDomain = getWorkOSAuthKitDomain();

  return Response.json({
    resource: getDeployTitanMcpResourceUrl(origin),
    authorization_servers: authKitDomain ? [authKitDomain] : [],
    bearer_methods_supported: ["header"],
  });
}
