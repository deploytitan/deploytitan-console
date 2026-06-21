#!/usr/bin/env node

import { spawn } from "node:child_process";

const baseUrl = (
  process.env.DEPLOYTITAN_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

const commands = [
  ["setup"],
  ["auth", "doctor"],
  ["integrations", "check"],
  ["help", "getting-started"],
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["bin/deploytitan.mjs", ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEPLOYTITAN_BASE_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `CLI command failed: deploytitan ${args.join(" ")}\n${stderr || stdout}`,
          ),
        );
        return;
      }

      resolve(stdout.trim());
    });
  });
}

async function main() {
  console.log(`DeployTitan CLI smoke test\nBase URL: ${baseUrl}`);

  for (const args of commands) {
    console.log(`\n[smoke] deploytitan ${args.join(" ")}`);
    const output = await runCli(args);
    console.log(output);

    if (args[0] === "setup") {
      assert(output.includes("MCP endpoint:"), "setup output is missing MCP endpoint.");
      assert(
        output.includes("Protected resource metadata:"),
        "setup output is missing protected resource metadata.",
      );
      assert(
        output.includes("Auth server metadata proxy:"),
        "setup output is missing auth server metadata proxy.",
      );
    }

    if (args[0] === "auth" && args[1] === "doctor") {
      assert(
        output.includes("WorkOS AuthKit domain:"),
        "auth doctor output is missing AuthKit domain.",
      );
      assert(
        output.includes("User-management issuer configured:"),
        "auth doctor output is missing issuer configuration status.",
      );
    }
  }

  console.log("\n[done] CLI smoke checks completed successfully.");
}

main().catch((error) => {
  console.error(`\n[fail] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
