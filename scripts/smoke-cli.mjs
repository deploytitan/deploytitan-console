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
  }

  console.log("\n[done] CLI smoke checks completed successfully.");
}

main().catch((error) => {
  console.error(`\n[fail] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
