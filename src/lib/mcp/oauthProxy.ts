import { createHmac } from "crypto";
import { getWorkOSAuthKitDomain, getDeployTitanBaseUrl } from "@/lib/workos";

function getSigningSecret() {
  const secret =
    process.env.WORKOS_COOKIE_PASSWORD ??
    process.env.WORKOS_API_KEY ??
    "";
  if (!secret) {
    throw new Error("No signing secret available for MCP OAuth state.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
}

function encodePayload<T>(data: T): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decodePayload<T>(encoded: string): T {
  const dot = encoded.lastIndexOf(".");
  if (dot === -1) throw new Error("Malformed token: missing signature.");
  const payload = encoded.slice(0, dot);
  const sig = encoded.slice(dot + 1);
  if (sig !== sign(payload)) throw new Error("Signature mismatch.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp: number };
  if (data.exp < Date.now()) throw new Error("Token has expired.");
  return data;
}

export type McpOAuthState = {
  clientRedirectUri: string;
  clientState: string;
  exp: number;
};

export type McpOAuthCode = {
  workosCode: string;
  deployTitanCallbackUri: string;
  exp: number;
};

export const encodeState = (state: Omit<McpOAuthState, "exp">): string =>
  encodePayload<McpOAuthState>({ ...state, exp: Date.now() + 10 * 60 * 1000 });

export const decodeState = (encoded: string): McpOAuthState =>
  decodePayload<McpOAuthState>(encoded);

export const encodeCode = (code: Omit<McpOAuthCode, "exp">): string =>
  encodePayload<McpOAuthCode>({ ...code, exp: Date.now() + 5 * 60 * 1000 });

export const decodeCode = (encoded: string): McpOAuthCode =>
  decodePayload<McpOAuthCode>(encoded);

export function getMcpCallbackUri(): string {
  return `${getDeployTitanBaseUrl()}/api/mcp/auth/callback`;
}

export function getWorkOSAuthorizationEndpoint(): string {
  const domain = getWorkOSAuthKitDomain();
  if (!domain) throw new Error("WORKOS_AUTHKIT_DOMAIN is not configured.");
  return `${domain}/oauth2/authorize`;
}

export function getWorkOSTokenEndpoint(): string {
  const domain = getWorkOSAuthKitDomain();
  if (!domain) throw new Error("WORKOS_AUTHKIT_DOMAIN is not configured.");
  return `${domain}/oauth2/token`;
}
