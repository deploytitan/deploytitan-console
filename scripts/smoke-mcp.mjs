#!/usr/bin/env node

const baseUrl = (
  process.env.DEPLOYTITAN_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

const bearerToken = process.env.DEPLOYTITAN_BEARER_TOKEN || null;
const standaloneExternalAuthId = "smoke_external_auth_id";

function logStep(message) {
  console.log(`\n[smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    response,
    json,
    text,
  };
}

async function fetchResponse(path, init = {}) {
  return await fetch(`${baseUrl}${path}`, init);
}

async function postMcp(body, token) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return await fetchJson("/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function runPublicChecks() {
  logStep(`Checking diagnostics at ${baseUrl}`);
  const diagnostics = await fetchJson("/api/diagnostics");
  assert(diagnostics.response.ok, "Diagnostics endpoint failed.");
  assert(diagnostics.json?.mcp?.endpoint, "Diagnostics did not return an MCP endpoint.");
  console.log(`[pass] diagnostics endpoint -> ${diagnostics.json.mcp.endpoint}`);

  logStep("Checking protected resource metadata");
  const protectedResource = await fetchJson("/.well-known/oauth-protected-resource");
  assert(protectedResource.response.ok, "Protected resource metadata failed.");
  assert(
    protectedResource.json?.resource === diagnostics.json.mcp.endpoint,
    "Protected resource metadata does not match diagnostics endpoint.",
  );
  if (diagnostics.json?.workos?.authKitDomain) {
    assert(
      Array.isArray(protectedResource.json?.authorization_servers) &&
        protectedResource.json.authorization_servers.includes(
          diagnostics.json.workos.authKitDomain,
        ),
      "Protected resource metadata is missing the configured AuthKit authorization server.",
    );
  }
  console.log("[pass] protected resource metadata");

  logStep("Checking authorization server metadata proxy");
  const authServer = await fetchJson("/.well-known/oauth-authorization-server");
  assert(authServer.response.ok, "Authorization server metadata proxy failed.");
  assert(
    typeof authServer.json?.issuer === "string" || authServer.text.length > 0,
    "Authorization server metadata returned an empty payload.",
  );
  if (diagnostics.json?.workos?.authKitDomain) {
    assert(
      authServer.json?.issuer === diagnostics.json.workos.authKitDomain,
      "Authorization server metadata issuer does not match the configured AuthKit domain.",
    );
  }
  console.log("[pass] authorization server metadata proxy");

  logStep("Checking standalone login handoff preserves external_auth_id");
  const loginRedirect = await fetchResponse(
    `/login?external_auth_id=${encodeURIComponent(standaloneExternalAuthId)}`,
    {
      redirect: "manual",
    },
  );
  assert(
    loginRedirect.status >= 300 && loginRedirect.status < 400,
    `Expected login route redirect, got ${loginRedirect.status}.`,
  );
  const loginLocation = loginRedirect.headers.get("location") || "";
  assert(loginLocation.length > 0, "Login route did not return a redirect location.");
  const loginUrl = new URL(loginLocation);
  assert(
    loginUrl.searchParams.get("redirect_uri") === `${baseUrl}/auth/callback`,
    "Login redirect is using an unexpected AuthKit callback URI.",
  );
  assert(
    loginUrl.searchParams.get("state"),
    "Login redirect is missing the AuthKit state parameter needed for standalone handoff.",
  );
  console.log("[pass] standalone login handoff");

  logStep("Checking unauthenticated MCP challenge");
  const unauthorized = await postMcp(
    {
      jsonrpc: "2.0",
      id: "unauth",
      method: "initialize",
      params: {},
    },
    null,
  );
  assert(
    unauthorized.response.status === 401,
    `Expected 401 from unauthenticated MCP request, got ${unauthorized.response.status}.`,
  );
  const challenge = unauthorized.response.headers.get("www-authenticate") || "";
  assert(
    challenge.includes("resource_metadata="),
    "Missing resource metadata in WWW-Authenticate header.",
  );
  assert(
    challenge.includes("/.well-known/oauth-protected-resource"),
    "WWW-Authenticate challenge is missing the protected resource metadata URL.",
  );
  console.log("[pass] unauthenticated MCP challenge");
}

async function runAuthenticatedChecks() {
  if (!bearerToken) {
    console.log(
      "\n[skip] Authenticated MCP checks skipped. Set DEPLOYTITAN_BEARER_TOKEN to enable them.",
    );
    return;
  }

  logStep("Checking authenticated MCP initialize");
  const initialize = await postMcp(
    {
      jsonrpc: "2.0",
      id: "initialize",
      method: "initialize",
      params: {},
    },
    bearerToken,
  );
  assert(initialize.response.ok, "Authenticated initialize request failed.");
  assert(
    initialize.json?.result?.serverInfo?.name === "deploytitan-mcp",
    "Unexpected MCP server identity.",
  );
  console.log("[pass] authenticated initialize");

  logStep("Checking tools/list");
  const tools = await postMcp(
    {
      jsonrpc: "2.0",
      id: "tools",
      method: "tools/list",
      params: {},
    },
    bearerToken,
  );
  assert(tools.response.ok, "tools/list failed.");
  const toolNames = (tools.json?.result?.tools || []).map((tool) => tool.name);
  assert(toolNames.includes("get_onboarding_guide"), "Missing get_onboarding_guide tool.");
  assert(toolNames.includes("answer_product_question"), "Missing answer_product_question tool.");
  console.log(`[pass] tools/list -> ${toolNames.length} tools`);

  logStep("Checking get_onboarding_guide tool");
  const onboarding = await postMcp(
    {
      jsonrpc: "2.0",
      id: "onboarding",
      method: "tools/call",
      params: {
        name: "get_onboarding_guide",
        arguments: {},
      },
    },
    bearerToken,
  );
  assert(onboarding.response.ok, "get_onboarding_guide failed.");
  assert(
    onboarding.json?.result?.structuredContent,
    "get_onboarding_guide did not return structured content.",
  );
  console.log("[pass] get_onboarding_guide");
}

async function main() {
  console.log(`DeployTitan MCP smoke test\nBase URL: ${baseUrl}`);
  await runPublicChecks();
  await runAuthenticatedChecks();
  console.log("\n[done] Smoke checks completed successfully.");
}

main().catch((error) => {
  console.error(`\n[fail] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
