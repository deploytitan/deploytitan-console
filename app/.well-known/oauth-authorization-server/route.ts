import { getWorkOSAuthKitDomain } from "@/lib/workos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authKitDomain = getWorkOSAuthKitDomain();
  if (!authKitDomain) {
    return Response.json(
      {
        error: "WORKOS_AUTHKIT_DOMAIN is not configured.",
      },
      { status: 500 },
    );
  }

  const response = await fetch(`${authKitDomain}/.well-known/oauth-authorization-server`, {
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
