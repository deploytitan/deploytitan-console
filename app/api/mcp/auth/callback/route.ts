import { decodeState, encodeCode, getMcpCallbackUri } from "@/lib/mcp/oauthProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return new Response(
      JSON.stringify({ error, error_description: desc }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!code || !state) {
    return new Response(
      JSON.stringify({ error: "invalid_request", error_description: "Missing code or state." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let decoded;
  try {
    decoded = decodeState(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid state.";
    return new Response(
      JSON.stringify({ error: "invalid_request", error_description: message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const ourCode = encodeCode({
    workosCode: code,
    deployTitanCallbackUri: getMcpCallbackUri(),
  });

  const redirectTarget = new URL(decoded.clientRedirectUri);
  redirectTarget.searchParams.set("code", ourCode);
  if (decoded.clientState) {
    redirectTarget.searchParams.set("state", decoded.clientState);
  }

  return Response.redirect(redirectTarget.toString());
}
