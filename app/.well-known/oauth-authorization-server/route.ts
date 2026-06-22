import { getWorkOSAuthorizationServerMetadataUrl, getDeployTitanBaseUrl } from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const metadataUrl = getWorkOSAuthorizationServerMetadataUrl();
  const response = await fetch(metadataUrl, {
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "application/json";
  const metadata = contentType.includes("application/json")
    ? await response.json()
    : {};

  const baseUrl = getDeployTitanBaseUrl();

  return Response.json(
    {
      ...(metadata as Record<string, unknown>),
      authorization_endpoint: `${baseUrl}/api/mcp/auth/authorize`,
      token_endpoint: `${baseUrl}/api/mcp/auth/token`,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
