#!/usr/bin/env node

const args = process.argv.slice(2);
const [command = "help", subcommand] = args;

function getBaseUrl() {
  return (
    process.env.DEPLOYTITAN_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

async function fetchJson(path) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }

  return body;
}

function printHelp() {
  console.log(`DeployTitan CLI

Usage:
  deploytitan setup
  deploytitan auth doctor
  deploytitan integrations check
  deploytitan github install
  deploytitan help [topic]
`);
}

async function main() {
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "setup") {
    const diagnostics = await fetchJson("/api/diagnostics");
    console.log("DeployTitan MCP setup");
    console.log(`Base URL: ${getBaseUrl()}`);
    console.log(`MCP endpoint: ${diagnostics.mcp.endpoint}`);
    console.log(
      `Protected resource metadata: ${diagnostics.mcp.protectedResourceMetadata}`,
    );
    console.log(
      `Auth server metadata proxy: ${diagnostics.mcp.authServerMetadata}`,
    );
    return;
  }

  if (command === "auth" && subcommand === "doctor") {
    const diagnostics = await fetchJson("/api/diagnostics");
    console.log("DeployTitan auth doctor");
    console.log(
      `WorkOS AuthKit domain: ${diagnostics.workos.authKitDomain ?? "not configured"}`,
    );
    console.log(
      `User-management issuer configured: ${diagnostics.workos.userManagementIssuerConfigured}`,
    );
    return;
  }

  if (command === "integrations" && subcommand === "check") {
    const diagnostics = await fetchJson("/api/diagnostics");
    console.log("DeployTitan integration check");
    console.log(`GitHub install URL: ${diagnostics.github.installUrl ?? "missing"}`);
    console.log(
      `Slack base URL configured: ${diagnostics.integrations.slackConfigured}`,
    );
    return;
  }

  if (command === "github" && subcommand === "install") {
    const diagnostics = await fetchJson("/api/diagnostics");
    if (!diagnostics.github.installUrl) {
      throw new Error("GitHub install URL is not configured.");
    }
    console.log(diagnostics.github.installUrl);
    return;
  }

  if (command === "help") {
    const topic = subcommand || "getting-started";
    const diagnostics = await fetchJson("/api/diagnostics");
    console.log(`DeployTitan help topic: ${topic}`);
    console.log(
      `Use your MCP client and ask: "Answer this DeployTitan question: ${topic}"`,
    );
    console.log(`MCP endpoint: ${diagnostics.mcp.endpoint}`);
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
