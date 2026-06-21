import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { api } from "@convex/_generated/api";
import { convexMutation } from "@/lib/console/convexServer";
import { encryptSecret } from "@/lib/crypto";
import {
  decodeIdTokenNonce,
  exchangeVercelCodeForTokens,
  getVercelUserInfo,
} from "@/lib/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearOauthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  for (const name of [
    "vercel_oauth_state",
    "vercel_oauth_nonce",
    "vercel_oauth_code_verifier",
    "vercel_oauth_context",
  ]) {
    cookieStore.set(name, "", {
      maxAge: 0,
      path: "/",
    });
  }
}

export async function GET(request: Request) {
  const { accessToken } = await withAuth({ ensureSignedIn: true });
  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();

  if (error) {
    clearOauthCookies(cookieStore);
    redirect(`/onboarding?error=${encodeURIComponent(`Vercel authorization failed: ${error}`)}`);
  }

  const expectedState = cookieStore.get("vercel_oauth_state")?.value;
  const expectedNonce = cookieStore.get("vercel_oauth_nonce")?.value;
  const codeVerifier = cookieStore.get("vercel_oauth_code_verifier")?.value;
  const contextCookie = cookieStore.get("vercel_oauth_context")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
    clearOauthCookies(cookieStore);
    redirect("/onboarding?error=vercel_oauth_state_mismatch");
  }

  if (!contextCookie) {
    clearOauthCookies(cookieStore);
    redirect("/onboarding?error=vercel_oauth_context_missing");
  }

  const context = JSON.parse(contextCookie) as {
    continuationToken?: string;
    projectPublicId?: string;
  };

  if (!context.projectPublicId) {
    clearOauthCookies(cookieStore);
    redirect("/onboarding?error=vercel_project_missing");
  }

  const tokens = await exchangeVercelCodeForTokens({
    code,
    codeVerifier,
  });
  const returnedNonce = decodeIdTokenNonce(tokens.id_token);
  if (!expectedNonce || returnedNonce !== expectedNonce) {
    clearOauthCookies(cookieStore);
    redirect("/onboarding?error=vercel_oauth_nonce_mismatch");
  }
  const userInfo = await getVercelUserInfo(tokens.access_token);

  await convexMutation(accessToken, api.platform.upsertVercelIntegration, {
    projectPublicId: context.projectPublicId,
    accessTokenCiphertext: encryptSecret(tokens.access_token),
    refreshTokenCiphertext: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : undefined,
    tokenScope: tokens.scope,
    accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    vercelUserId: userInfo.sub,
    vercelUserEmail: userInfo.email,
    vercelUserName: userInfo.preferred_username ?? userInfo.name,
    vercelUserAvatarUrl: userInfo.picture,
  });

  if (context.continuationToken) {
    await convexMutation(accessToken, api.platform.completeBrowserContinuation, {
      continuationToken: context.continuationToken,
      completedStep: "vercel",
    });
  }

  clearOauthCookies(cookieStore);
  redirect("/onboarding?connected=vercel");
}
