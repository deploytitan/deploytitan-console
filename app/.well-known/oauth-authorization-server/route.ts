import { getWorkOSAuthorizationServerMetadataUrl } from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const metadataUrl = getWorkOSAuthorizationServerMetadataUrl();
  const response = await fetch(metadataUrl, {
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "application/json";
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
