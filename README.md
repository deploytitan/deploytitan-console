# DeployTitan Console

DeployTitan now ships from this repo as a `Next.js + Convex + WorkOS` app. The
old GCP, Zero, and Postgres-backed path is retired.

## Architecture

- `app/`
  - App Router UI, auth flows, and console pages
- `convex/`
  - Product data model and backend functions
- `src/lib/console/`
  - Server-side helpers for WorkOS-to-Convex session sync

For product work, build here first. Do not add new product backend logic to the
legacy monorepo.

## Development

```bash
pnpm install
pnpm dev
```

The local console runs on `http://localhost:4000`.

To work locally, set:

```bash
NEXT_PUBLIC_CONVEX_URL=
CONVEX_URL=
CONVEX_DEPLOY_KEY=
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
WORKOS_COOKIE_PASSWORD=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:4000/auth/callback
```

## WorkOS Auth

WorkOS AuthKit runs in this console app. Set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, and a redirect URI in the console runtime environment.

For Vercel, configure the console with:

```bash
NEXT_PUBLIC_CONVEX_URL=
CONVEX_URL=
CONVEX_DEPLOY_KEY=
NEXT_PUBLIC_DEV_BYPASS_AUTH=false
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
WORKOS_COOKIE_PASSWORD=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://console.deploytitan.com/auth/callback
```

`WORKOS_REDIRECT_URI` is also accepted for server-side compatibility, but `NEXT_PUBLIC_WORKOS_REDIRECT_URI` is the AuthKit SDK default. The redirect URI should point back to the console callback route, for example:

```bash
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://console.deploytitan.com/auth/callback
```

`/login` and `/signup` start the AuthKit flow, `/auth/callback` exchanges the WorkOS code, and `/logout` clears session state.

## Current product posture

- Repository and pull request data can be entered manually inside each project.
- The GitHub install callback route is currently a placeholder while the new
  Convex-native integration path is rebuilt.