import { authkitProxy, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { getWorkOSRedirectUri } from "@/lib/workosRedirectUri";
import {
  createSmokeAuthSession,
  isSmokeAuthEnabled,
  SMOKE_AUTH_COOKIE,
} from "@/lib/testAuth";

const redirectUri = getWorkOSRedirectUri();
console.log("Redirect URI: ", redirectUri);

const defaultProxy = authkitProxy({
  debug: true,
  redirectUri,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/login",
      "/sign-in",
      "/signin",
      "/sign-up",
      "/signup",
      "/register",
      "/auth/callback",
      "/api/diagnostics",
      "/api/mcp",
      "/api/slack/actions",
      "/api/billing/webhooks/paddle",
      "/api/billing/webhooks/polar",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-authorization-server",
    ],
  },
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isSmokeAuthEnabled() && request.cookies.get(SMOKE_AUTH_COOKIE)?.value === "1") {
    const headers = new Headers();
    headers.set("x-workos-middleware", "true");
    headers.set("x-url", request.url);
    if (redirectUri) {
      headers.set("x-redirect-uri", redirectUri);
    }
    headers.set("x-workos-session", await createSmokeAuthSession());

    return handleAuthkitHeaders(request, headers);
  }

  return defaultProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.ico$|.*\\.webp$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.woff2?$|.*\\.ttf$).*)",
  ],
};
