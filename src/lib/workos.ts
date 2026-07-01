export function getWorkOSAuthKitDomain() {
  return (process.env.WORKOS_AUTHKIT_DOMAIN ?? "").replace(/\/+$/, "");
}

export function getWorkOsClientId() {
  return process.env.WORKOS_CLIENT_ID;
}

export function getWorkOSUserManagementIssuerUrl() {
  const clientId = getWorkOsClientId();
  if (!clientId) return "";
  return `https://api.workos.com/user_management/${clientId}`;
}

export function getWorkOSUserManagementJwksUrl() {
  const clientId = getWorkOsClientId();
  if (!clientId) return "";
  return clientId ? `https://api.workos.com/sso/jwks/${clientId}` : "";
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
