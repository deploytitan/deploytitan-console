const DEFAULT_USER_MANAGEMENT_ISSUER_ID = "client_01KP99QCE9S1WNMVD5H5FHTMQJ";

export function getWorkOSAuthKitDomain() {
  return (
    process.env.WORKOS_AUTHKIT_DOMAIN ??
    process.env.NEXT_PUBLIC_WORKOS_AUTHKIT_DOMAIN ??
    ""
  ).replace(/\/+$/, "");
}

export function getWorkOSUserManagementIssuerId() {
  return (
    process.env.WORKOS_USER_MANAGEMENT_ISSUER_ID ??
    DEFAULT_USER_MANAGEMENT_ISSUER_ID
  );
}

export function getWorkOSUserManagementIssuerUrl() {
  return `https://api.workos.com/user_management/${getWorkOSUserManagementIssuerId()}`;
}

export function getWorkOSUserManagementJwksUrl() {
  const clientId =
    process.env.WORKOS_CLIENT_ID ?? getWorkOSUserManagementIssuerId();
  return clientId ? `https://api.workos.com/sso/jwks/${clientId}` : "";
}

export function getWorkOSAuthorizationServerIssuer() {
  return getWorkOSAuthKitDomain() || getWorkOSUserManagementIssuerUrl();
}

export function getWorkOSAuthorizationServerMetadataUrl() {
  const authKitDomain = getWorkOSAuthKitDomain();
  if (authKitDomain) {
    return `${authKitDomain}/.well-known/oauth-authorization-server`;
  }

  return `${getWorkOSUserManagementIssuerUrl()}/.well-known/openid-configuration`;
}

export function getDeployTitanBaseUrl() {
  return (
    process.env.DEPLOYTITAN_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).replace(/\/+$/, "");
}

export function getDeployTitanMcpResourceUrl(baseUrl?: string) {
  const explicit = (
    process.env.DEPLOYTITAN_MCP_RESOURCE_URL ??
    baseUrl ??
    getDeployTitanBaseUrl()
  ).replace(/\/+$/, "");

  if (!explicit) {
    return "";
  }

  return explicit.endsWith("/api/mcp") ? explicit : `${explicit}/api/mcp`;
}

export function getGithubAppInstallUrl() {
  const explicit = process.env.GITHUB_APP_INSTALL_URL ?? "";
  if (explicit) {
    return explicit;
  }

  const slug = process.env.GITHUB_APP_SLUG ?? "";
  return slug ? `https://github.com/apps/${slug}/installations/new` : "";
}

export function getVercelConnectUrl(baseUrl?: string) {
  const origin = (baseUrl ?? getDeployTitanBaseUrl()).replace(/\/+$/, "");
  return origin ? `${origin}/api/integrations/vercel/connect` : "";
}
