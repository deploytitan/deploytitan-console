const WORKOS_AUTHKIT_COMPLETE_URL = "https://api.workos.com/authkit/oauth2/complete";

type StandaloneConnectUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

type WorkOSCompleteResponse = {
  redirect_uri?: string;
  error?: string;
  message?: string;
};

export async function completeStandaloneWorkOSLogin(input: {
  externalAuthId: string;
  user: StandaloneConnectUser;
}) {
  const smokeRedirectUri = process.env.DEPLOYTITAN_SMOKE_STANDALONE_REDIRECT_URI;
  if (process.env.DEPLOYTITAN_ENABLE_TEST_AUTH === "1" && smokeRedirectUri) {
    const redirectUrl = new URL(smokeRedirectUri);
    redirectUrl.searchParams.set("external_auth_id", input.externalAuthId);
    redirectUrl.searchParams.set("user_id", input.user.id);
    return redirectUrl.toString();
  }

  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY is not configured.");
  }

  const response = await fetch(WORKOS_AUTHKIT_COMPLETE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_auth_id: input.externalAuthId,
      user: {
        id: input.user.id,
        email: input.user.email,
        first_name: input.user.firstName ?? undefined,
        last_name: input.user.lastName ?? undefined,
      },
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | WorkOSCompleteResponse
    | null;

  if (!response.ok || typeof body?.redirect_uri !== "string" || !body.redirect_uri) {
    throw new Error(
      body?.error || body?.message || "Failed to complete WorkOS standalone login.",
    );
  }

  return body.redirect_uri;
}
