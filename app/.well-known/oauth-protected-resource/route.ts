import { getDeployTitanMcpResourceUrl } from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    resource: getDeployTitanMcpResourceUrl(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
  });
}
