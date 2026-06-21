import crypto from "node:crypto";
import { getDeployTitanBaseUrl } from "@/lib/workos";

type VercelTokenResponse = {
  access_token: string;
  token_type: string;
  id_token: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
};

type VercelUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

export function getVercelClientId() {
  return (
    process.env.VERCEL_APP_CLIENT_ID ??
    process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID ??
    ""
  );
}

export function getVercelClientSecret() {
  return process.env.VERCEL_APP_CLIENT_SECRET ?? "";
}

export function getVercelAuthScopes() {
  return process.env.VERCEL_APP_SCOPES ?? "openid email profile offline_access";
}

export function getVercelCallbackUrl() {
  const explicit = process.env.VERCEL_APP_REDIRECT_URI ?? "";
  if (explicit) {
    return explicit;
  }

  const baseUrl = getDeployTitanBaseUrl();
  return baseUrl ? `${baseUrl}/api/integrations/vercel/callback` : "";
}

export function isVercelAppConfigured() {
  return Boolean(
    getVercelClientId() &&
      getVercelClientSecret() &&
      getVercelCallbackUrl() &&
      process.env.DEPLOYTITAN_INTEGRATION_SECRET,
  );
}

export function generateOauthRandomString(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

export async function createPkceChallenge(codeVerifier: string) {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
}

export function buildVercelAuthorizationUrl(input: {
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const params = new URLSearchParams({
    client_id: getVercelClientId(),
    redirect_uri: getVercelCallbackUrl(),
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    response_type: "code",
    scope: getVercelAuthScopes(),
  });

  return `https://vercel.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeVercelCodeForTokens(input: {
  code: string;
  codeVerifier: string;
}) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getVercelClientId(),
    client_secret: getVercelClientSecret(),
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: getVercelCallbackUrl(),
  });

  const response = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    body: params,
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as VercelTokenResponse | null;
  if (!response.ok || !json?.access_token) {
    throw new Error(
      `Failed to exchange Vercel authorization code. ${
        json ? JSON.stringify(json) : response.statusText
      }`,
    );
  }

  return json;
}

export async function getVercelUserInfo(accessToken: string) {
  const response = await fetch("https://api.vercel.com/login/oauth/userinfo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as VercelUserInfo | null;
  if (!response.ok || !json?.sub) {
    throw new Error(
      `Failed to fetch Vercel user info. ${
        json ? JSON.stringify(json) : response.statusText
      }`,
    );
  }

  return json;
}

export function decodeIdTokenNonce(idToken: string) {
  const [, payload] = idToken.split(".");
  if (!payload) {
    throw new Error("Vercel id_token payload is missing.");
  }

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    nonce?: string;
  };

  if (!decoded.nonce) {
    throw new Error("Vercel id_token nonce is missing.");
  }

  return decoded.nonce;
}
