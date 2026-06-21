export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  keywords: string[];
  body: string;
};

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    summary:
      "How to onboard into DeployTitan from an MCP client with the fewest possible steps.",
    keywords: ["setup", "onboarding", "getting started", "mcp", "codex", "claude"],
    body: `
1. Connect the DeployTitan MCP server in your MCP client.
2. Authenticate through WorkOS when prompted.
3. Run "Set up DeployTitan for my team" or call the onboarding guide tool.
4. Create or select an organization.
5. Create your first project.
6. Connect GitHub so DeployTitan can see your pull requests.
7. Connect Slack for approvals and release updates.
8. Connect Grafana for post-release monitoring.
9. If required, choose a billing plan in the hosted checkout page.

The MCP can resume onboarding at any step. If a browser step interrupts you, return to your client and ask what the next step is.
`.trim(),
  },
  {
    slug: "github",
    title: "GitHub Setup",
    summary:
      "How to install the GitHub App, bind repositories to a project, and make PRs available for release packets.",
    keywords: ["github", "repositories", "pull requests", "installation", "app"],
    body: `
DeployTitan uses a GitHub App installation flow.

- Open the GitHub install URL from onboarding or the CLI.
- Install the app into the GitHub account or organization that owns the repositories you want to track.
- Return to DeployTitan and bind the installation to a project.
- Once repositories are linked, pull requests synced into DeployTitan become selectable in release packets.

If repositories are missing, confirm the GitHub installation includes them and the installation has been applied to the correct project.
`.trim(),
  },
  {
    slug: "slack-approvals",
    title: "Slack Approvals",
    summary:
      "How Slack-based stakeholder approvals work without requiring MCP access.",
    keywords: ["slack", "approvals", "stakeholders", "reminders", "notifications"],
    body: `
Release managers operate through MCP, but stakeholders can approve directly from Slack.

- Configure a Slack integration for the project.
- Request release approvals from MCP and provide approver names and emails.
- DeployTitan posts approval requests to Slack.
- Stakeholders approve or reject without logging into DeployTitan.
- Approval status is stored in DeployTitan and visible from MCP.

If Slack delivery fails, check that the project has a valid incoming webhook or Slack bot configuration.
`.trim(),
  },
  {
    slug: "grafana-monitoring",
    title: "Grafana Monitoring",
    summary:
      "How DeployTitan compares post-release metrics against a baseline and raises alerts.",
    keywords: ["grafana", "monitoring", "metrics", "baseline", "alerts"],
    body: `
DeployTitan starts a monitoring session after merge when Grafana is configured.

- Set a Grafana endpoint and optional API token on the project.
- Choose the metric name or success metric for the release.
- DeployTitan records a baseline, polls the endpoint, and stores snapshots.
- If the metric moves beyond the threshold, DeployTitan queues a Slack alert.

Monitoring is deterministic. It does not require any DeployTitan-managed AI to interpret the metric.
`.trim(),
  },
  {
    slug: "billing",
    title: "Billing and Plans",
    summary:
      "How hosted checkout and portal flows work for Paddle and Polar while keeping organization billing provider-agnostic.",
    keywords: ["billing", "paddle", "polar", "checkout", "portal", "plans", "payment"],
    body: `
DeployTitan creates hosted checkout or billing portal links per organization.

- Billing is organization-scoped.
- The active provider can be Paddle or Polar.
- Checkout opens in a browser using a provider-hosted page.
- After payment, DeployTitan updates the organization billing state from the webhook or return flow.
- Billing portals are opened through server-created provider links so users do not need to navigate a separate billing console manually.

If your organization has no active subscription, onboarding can still proceed until the billing-required step is reached.
`.trim(),
  },
  {
    slug: "vercel-connection",
    title: "Vercel Connection",
    summary:
      "How DeployTitan connects to Vercel through a secure browser handoff instead of asking for pasted credentials.",
    keywords: ["vercel", "oauth", "app", "deployments", "logs", "security"],
    body: `
DeployTitan should connect to Vercel through an app-style OAuth browser flow.

- Start the connection from MCP or onboarding.
- DeployTitan opens a secure browser handoff.
- Vercel asks the user to approve access.
- DeployTitan exchanges the authorization code server-side.
- Resulting tokens are stored encrypted by DeployTitan.

Users should not paste Vercel access tokens into MCP prompts.

This connection is the foundation for:

- deployment status lookup by commit
- build log retrieval
- runtime log retrieval
- release-time health checks against Vercel-hosted apps
`.trim(),
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    summary:
      "Common issues during onboarding, auth, billing, and release setup.",
    keywords: ["troubleshooting", "errors", "auth", "billing", "github", "slack"],
    body: `
Common issues:

- Auth fails: confirm the MCP server URL matches the configured WorkOS Resource Indicator.
- Organization missing: create or switch organization context, then rerun onboarding guide.
- No PRs found: ensure GitHub installation is connected and repositories are bound to the project.
- Slack approvals not delivered: verify the project Slack integration configuration.
- Monitoring not starting: check Grafana endpoint, token, and metric selection.
- Billing not updating: confirm the billing provider webhook reached DeployTitan and the organization is mapped correctly.
`.trim(),
  },
];
