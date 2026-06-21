# Vercel App Setup

Last updated: 2026-06-21

## Goal

DeployTitan should connect to Vercel without asking users to paste tokens into MCP prompts.

The secure flow is:

1. user starts from MCP or onboarding
2. browser opens a DeployTitan Vercel connect route
3. DeployTitan redirects to Vercel OAuth consent
4. Vercel redirects back to DeployTitan callback
5. DeployTitan exchanges the code server-side
6. DeployTitan stores encrypted tokens in backend state

## Required Vercel dashboard setup

Create a Vercel app from the Vercel dashboard and configure:

- client ID
- client secret
- redirect URI for staging
- redirect URI for production
- scopes:
  - `openid`
  - `email`
  - `profile`
  - `offline_access`

Recommended callback URLs:

- staging: `https://staging.console.deploytitan.com/api/integrations/vercel/callback`
- production: `https://console.deploytitan.com/api/integrations/vercel/callback`
- local: `http://localhost:4000/api/integrations/vercel/callback`

## Required env vars

Set these in the DeployTitan runtime:

```bash
NEXT_PUBLIC_VERCEL_APP_CLIENT_ID=
VERCEL_APP_CLIENT_SECRET=
VERCEL_APP_REDIRECT_URI=
DEPLOYTITAN_INTEGRATION_SECRET=
```

Optional:

```bash
VERCEL_APP_SCOPES="openid email profile offline_access"
```

## What each env var does

- `NEXT_PUBLIC_VERCEL_APP_CLIENT_ID`
  Used to build the Vercel authorization URL.
- `VERCEL_APP_CLIENT_SECRET`
  Used only server-side during code exchange.
- `VERCEL_APP_REDIRECT_URI`
  Optional override when you do not want the callback derived from `DEPLOYTITAN_BASE_URL`.
- `DEPLOYTITAN_INTEGRATION_SECRET`
  Used to encrypt stored third-party credentials before they are persisted.

## Current implementation status

Implemented:

- secure browser handoff route
- PKCE + state + nonce
- callback route
- encrypted token persistence
- onboarding step
- MCP browser-step support

Not yet implemented:

- team selection
- project selection
- deployment status reads
- build log reads
- runtime log reads
- token refresh / revoke flows
- disconnect UI

## Testing checklist

1. configure the Vercel app in staging
2. set env vars in staging
3. visit `/api/diagnostics`
4. confirm:
   - `vercel.configured` is `true`
   - `vercel.connectUrl` is present
   - `vercel.callbackUrl` matches the Vercel app configuration
5. sign in to DeployTitan
6. open onboarding
7. click `Connect Vercel app`
8. approve in Vercel
9. confirm redirect back to onboarding
10. confirm `Connect Vercel` step becomes `complete`
