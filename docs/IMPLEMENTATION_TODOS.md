# DeployTitan MCP-First Roadmap TODOs

## Done

- MCP server route and OAuth protected-resource discovery
- Shared WorkOS-backed actor bootstrap for web and MCP
- Release tracker backend foundation for approvals, execution, monitoring, and notifications
- Slack action callback scaffold
- CLI bootstrap and diagnostics entrypoint
- Provider-agnostic billing abstraction scaffold with Paddle-first and Polar-fallback adapters
- Resumable onboarding state storage and browser continuation route
- Embedded help corpus with MCP search and answer tools

## Next

### Auth

- Finalize WorkOS Connect configuration for the staging AuthKit domain
- Verify issued MCP tokens have the expected `aud` for the protected resource URL
- Add production-safe auth error telemetry and clearer operator diagnostics

### Billing

- Add billing webhook routes for Paddle and Polar
- Persist provider webhook updates into organization billing state
- Add plan entitlements and feature gating rules
- Add billing success/cancel browser pages
- Add real portal and checkout session creation if vendor SDK/API integration is required beyond hosted URL templates

### Onboarding

- Expand onboarding state machine to support GitHub, Slack, and Grafana completion callbacks
- Extend onboarding with Vercel team/project selection after secure app connection
- Add explicit skip/defer paths and onboarding blockers
- Surface onboarding guide in the browser onboarding page
- Add CLI-guided setup output driven from the onboarding guide API

### Help

- Expand help corpus with security, permissions, and pricing docs
- Add source-aware answers that reference the exact help article slug
- Add troubleshooting content for failed GitHub installs, missing PRs, and billing failures

### Release Tracker

- Replace placeholder browser-step URLs with dedicated GitHub/Slack/Grafana setup flows
- Add better PR inventory and filtering across project and organization scopes
- Add release packet templates and saved stakeholder groups
- Harden Slack approval delivery and retry behavior

### Future Control Plane Prep

- Add environment-aware project topology and deploy-unit modeling
- Add adapter boundaries for Jenkins, GitHub Actions deploys, Argo, and cloud-specific execution
- Add auditable release decision policies and rule evaluation
- Add Vercel deployment status and log retrieval MCP tools on top of the stored Vercel app connection
