# DeployTitan Testing Guide

Last updated: 2026-06-20

## Why this matters

We are building an MCP-first release-control product. That means we should validate the system in the same shape users will experience it:

- remote HTTPS MCP endpoint
- WorkOS OAuth
- browser handoffs only where needed
- structured MCP tools usable from Codex or Claude Code

The goal is to avoid building a large amount of backend logic before proving that the basic operator loop works.

## Recommended environments

### 1. Local development

Use local development for fast iteration on UI and backend logic:

- `npx convex dev`
- `pnpm dev`

This is the fastest loop while implementing features, but it is not the best way to validate the real MCP operator flow because:

- remote MCP clients work best with a stable HTTPS endpoint
- OAuth callback flows are easier to verify against a stable public URL
- third-party integrations like GitHub, Slack, and billing vendors often need public callback URLs

### 2. Staging environment

Use staging as the first real integration test target.

Recommended for now:

- deploy the Next.js app to your staging host
- point it at a non-production Convex deployment
- configure WorkOS staging against:
  - `https://staging.console.deploytitan.com`
  - `https://staging.console.deploytitan.com/api/mcp`

This is the best place to test:

- MCP discovery
- OAuth login
- onboarding handoffs
- billing redirects
- Slack interactions
- GitHub app installation flow

### 3. Production

Do **not** use Convex production as the main development test bed yet.

Use production only after staging passes a basic checklist:

- MCP discovery works
- WorkOS auth works
- onboarding completes
- billing callback returns correctly
- at least one release flow works end to end

For now, staging is the right answer, not production.

## Immediate test strategy

We should keep two loops running in parallel:

### Fast inner loop

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:smoke:mcp`
- `pnpm test:smoke:cli`

Run these against local dev while building.

### Real operator loop

Run the same smoke scripts against staging by setting:

```bash
export DEPLOYTITAN_BASE_URL=https://staging.console.deploytitan.com
pnpm test:smoke:mcp
pnpm test:smoke:cli
```

Then test an actual MCP client login from Codex or Claude Code.

## What the smoke scripts cover

### `pnpm test:smoke:mcp`

Checks:

- `/api/diagnostics`
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- unauthenticated MCP challenge behavior

Optional authenticated checks if you set `DEPLOYTITAN_BEARER_TOKEN`:

- MCP `initialize`
- MCP `tools/list`
- MCP `get_onboarding_guide`

### `pnpm test:smoke:cli`

Checks:

- `deploytitan setup`
- `deploytitan auth doctor`
- `deploytitan integrations check`
- `deploytitan help getting-started`

This gives us a stable low-cost regression harness before full end-to-end tests are added.

## How to connect DeployTitan to Codex

Codex supports MCP configuration through `codex mcp` or `~/.codex/config.toml`. The official docs say MCP servers can be added with the CLI and are shared across Codex clients. See:

- [Codex MCP docs](https://developers.openai.com/codex/mcp)
- [Codex config reference](https://developers.openai.com/codex/config-reference)

Recommended first test:

1. Add the staging server.
2. Let Codex trigger the OAuth flow.
3. Ask for the onboarding guide.

Example:

```bash
codex mcp add deploytitan --transport http https://staging.console.deploytitan.com/api/mcp
```

Then inside Codex:

- inspect MCP status if needed
- trigger a request that uses DeployTitan
- complete the browser auth flow when prompted

If your Codex build prefers config-file setup, use the equivalent `config.toml` entry instead of the CLI command.

## How to connect DeployTitan to Claude Code

Claude Code recommends remote HTTP MCP servers for cloud services and supports OAuth discovery when the server returns a `401` or `403` plus `WWW-Authenticate`. See:

- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)

Recommended first test:

```bash
claude mcp add --transport http deploytitan https://staging.console.deploytitan.com/api/mcp
```

Then inside Claude Code:

1. Run `/mcp`
2. Select the DeployTitan server
3. Complete the browser login flow
4. Ask:
   - `Use DeployTitan to get my onboarding guide`
   - `Use DeployTitan to answer how GitHub install works`

## Should we build the CLI right now?

Yes, but only as a helper surface.

We should **not** wait to make the CLI perfect before testing. The current CLI is already useful for:

- setup output
- auth diagnostics
- integration diagnostics
- quick support workflows

That is enough for MVP testing. The MCP server remains the primary product surface.

## Suggested manual acceptance checklist

### Stage 1

- smoke scripts pass locally
- smoke scripts pass against staging
- protected resource metadata matches the MCP endpoint
- unauthorized MCP requests return the expected OAuth challenge

### Stage 2

- Codex can add the MCP server
- Claude Code can add the MCP server
- both clients can complete OAuth against WorkOS staging
- authenticated `tools/list` works

### Stage 3

- user can get onboarding guide entirely from MCP
- browser handoff for GitHub install works
- browser handoff for billing works
- MCP shows updated onboarding state after returning

### Stage 4

- create org/project
- create release packet
- inspect release timeline
- verify Slack approval callback updates release state

## Next test automation to add

After these smoke scripts, the next best automation layer is:

1. route-level integration tests for MCP discovery and auth challenge semantics
2. Playwright staging tests for onboarding browser continuations
3. mocked Slack/GitHub callback contract tests
4. authenticated MCP contract tests using a staging token fixture or test identity flow
