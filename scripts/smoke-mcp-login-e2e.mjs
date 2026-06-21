#!/usr/bin/env node

import { spawn } from "node:child_process";

const baseUrl = (
  process.env.DEPLOYTITAN_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

const smokeRedirectUri =
  process.env.DEPLOYTITAN_SMOKE_STANDALONE_REDIRECT_URI ||
  `${baseUrl}/smoke/mcp-complete`;

const smokeCookie = "deploytitan-smoke-auth=1";
const loginScenarios = [
  { name: "Codex", externalAuthId: "codex_smoke_login" },
  { name: "Claude Code", externalAuthId: "claude_smoke_login" },
];

function logStep(message) {
  console.log(`\n[smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchWithCookie(path, init = {}, includeSmokeCookie = false) {
  const headers = new Headers(init.headers || {});
  if (includeSmokeCookie) {
    headers.set("Cookie", smokeCookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

function startDevServer() {
  return spawn("pnpm", ["dev"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DEPLOYTITAN_BASE_URL: baseUrl,
      DEPLOYTITAN_ENABLE_TEST_AUTH: "1",
      DEPLOYTITAN_SMOKE_STANDALONE_REDIRECT_URI: smokeRedirectUri,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServer() {
  const started = Date.now();
  let lastError = "server not ready";

  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`${baseUrl}/api/diagnostics`);
      if (response.ok) {
        return;
      }
      lastError = `unexpected status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for dev server: ${lastError}`);
}

async function verifyDiscovery() {
  logStep("Checking MCP auth discovery");
  const diagnostics = await fetchWithCookie("/api/diagnostics");
  assert(diagnostics.response.ok, "Diagnostics endpoint failed.");
  assert(diagnostics.json?.mcp?.endpoint === `${baseUrl}/api/mcp`, "Unexpected MCP endpoint.");

  const protectedResource = await fetchWithCookie("/.well-known/oauth-protected-resource");
  assert(protectedResource.response.ok, "Protected resource metadata failed.");
  assert(
    protectedResource.json?.resource === `${baseUrl}/api/mcp`,
    "Protected resource resource indicator mismatch.",
  );

  const authServer = await fetchWithCookie("/.well-known/oauth-authorization-server");
  assert(authServer.response.ok, "Authorization server metadata proxy failed.");
  assert(
    typeof authServer.json?.issuer === "string" || authServer.text.length > 0,
    "Authorization server metadata was empty.",
  );

  const unauthorized = await fetchWithCookie("/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "unauth",
      method: "initialize",
      params: {},
    }),
  });
  assert(unauthorized.response.status === 401, "Expected unauthenticated MCP initialize to return 401.");
  const challenge = unauthorized.response.headers.get("www-authenticate") || "";
  assert(challenge.includes("resource_metadata="), "WWW-Authenticate header is missing resource metadata.");
  console.log("[pass] MCP discovery and auth challenge");
}

async function verifyLoginScenario({ name, externalAuthId }) {
  logStep(`Checking ${name} standalone login flow`);

  const login = await fetchWithCookie(
    `/login?external_auth_id=${encodeURIComponent(externalAuthId)}`,
    { redirect: "manual" },
    true,
  );
  assert(
    login.response.status >= 300 && login.response.status < 400,
    `${name} login did not redirect.`,
  );
  const loginLocation = login.response.headers.get("location") || "";
  assert(
    loginLocation === `${baseUrl}/auth/post-login?external_auth_id=${encodeURIComponent(externalAuthId)}`,
    `${name} login redirect was unexpected: ${loginLocation}`,
  );

  const postLoginPath = loginLocation.replace(baseUrl, "");
  const postLogin = await fetchWithCookie(postLoginPath, { redirect: "manual" }, true);
  assert(
    postLogin.response.status >= 300 && postLogin.response.status < 400,
    `${name} post-login did not redirect.`,
  );
  const postLoginLocation = postLogin.response.headers.get("location") || "";
  const redirectUrl = new URL(postLoginLocation);
  assert(
    redirectUrl.origin + redirectUrl.pathname === smokeRedirectUri,
    `${name} standalone completion redirected to the wrong URI: ${postLoginLocation}`,
  );
  assert(
    redirectUrl.searchParams.get("external_auth_id") === externalAuthId,
    `${name} standalone completion lost external_auth_id.`,
  );
  assert(
    redirectUrl.searchParams.get("user_id") === "user_smoke",
    `${name} standalone completion lost the authenticated user.`,
  );

  console.log(`[pass] ${name} standalone login flow`);
}

async function main() {
  console.log(`DeployTitan MCP login E2E smoke test\nBase URL: ${baseUrl}`);
  const devServer = startDevServer();

  let stdout = "";
  let stderr = "";
  devServer.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  devServer.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer();
    await verifyDiscovery();
    for (const scenario of loginScenarios) {
      await verifyLoginScenario(scenario);
    }
    console.log("\n[done] MCP login E2E smoke test completed successfully.");
  } catch (error) {
    const logs = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    const suffix = logs ? `\n\n[server logs]\n${logs}` : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)}${suffix}`);
  } finally {
    devServer.kill("SIGINT");
    await new Promise((resolve) => devServer.once("exit", resolve));
  }
}

main().catch((error) => {
  console.error(`\n[fail] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
