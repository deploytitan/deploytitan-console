import { cookies } from "next/headers";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { api } from "@convex/_generated/api";
import { convexQuery } from "@/lib/console/convexServer";
import {
  buildVercelAuthorizationUrl,
  createPkceChallenge,
  generateOauthRandomString,
  isVercelAppConfigured,
} from "@/lib/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { accessToken } = await withAuth({ ensureSignedIn: true });
  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!isVercelAppConfigured()) {
    return Response.json(
      { error: "Vercel app configuration is incomplete." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const continuationToken = url.searchParams.get("token") ?? "";
  const requestedProjectPublicId = url.searchParams.get("projectPublicId") ?? "";
  const actor = await convexQuery(accessToken, api.actors.getActorContext, {});
  const onboardingGuide = await convexQuery(accessToken, api.platform.getOnboardingGuide, {});
  const projectPublicId =
    requestedProjectPublicId || onboardingGuide.projects[0]?.publicId || "";

  if (!actor.activeWorkosOrgId || !projectPublicId) {
    return Response.json(
      { error: "Create an organization and project before connecting Vercel." },
      { status: 400 },
    );
  }

  const state = generateOauthRandomString();
  const nonce = generateOauthRandomString();
  const codeVerifier = generateOauthRandomString(48);
  const codeChallenge = await createPkceChallenge(codeVerifier);
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const maxAge = 10 * 60;

  cookieStore.set("vercel_oauth_state", state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
  cookieStore.set("vercel_oauth_nonce", nonce, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
  cookieStore.set("vercel_oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
  cookieStore.set(
    "vercel_oauth_context",
    JSON.stringify({
      continuationToken,
      projectPublicId,
      organizationId: actor.activeWorkosOrgId,
    }),
    {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge,
      path: "/",
    },
  );

  return Response.redirect(
    buildVercelAuthorizationUrl({
      state,
      nonce,
      codeChallenge,
    }),
  );
}
