import { decodeCode, getWorkOSTokenEndpoint } from "@/lib/mcp/oauthProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status });
}

export async function POST(request: Request) {
  let body: URLSearchParams;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    body = new URLSearchParams(text);
  } else {
    try {
      const json = (await request.json()) as Record<string, string>;
      body = new URLSearchParams(json);
    } catch {
      return jsonError("invalid_request", "Unrecognised request body.");
    }
  }

  const grantType = body.get("grant_type");
  if (grantType !== "authorization_code") {
    return jsonError("unsupported_grant_type", `Unsupported grant type: ${grantType}`);
  }

  const ourCode = body.get("code") ?? "";
  const codeVerifier = body.get("code_verifier") ?? "";

  let decoded;
  try {
    decoded = decodeCode(ourCode);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid code.";
    return jsonError("invalid_grant", message);
  }

  const tokenEndpoint = getWorkOSTokenEndpoint();
  const clientId = process.env.WORKOS_CLIENT_ID ?? "";
  const clientSecret = process.env.WORKOS_API_KEY ?? "";

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: decoded.workosCode,
    redirect_uri: decoded.deployTitanCallbackUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  const upstream = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await upstream.json();
  return Response.json(data, { status: upstream.status });
}
