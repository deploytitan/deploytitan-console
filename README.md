# DeployTitan Console

Standalone Next.js console for DeployTitan, intended to run on Vercel while the original monorepo continues to own backend services and private packages.

## Development

```bash
pnpm install
pnpm dev
```

The local console runs on `http://localhost:8080` so the backend API can keep its default `http://localhost:3000` port. The app reads browser-safe values from `NEXT_PUBLIC_*` variables. For local backend proxying, set `API_PROXY_ORIGIN` to the DeployTitan API origin; Next will rewrite `/auth/*`, `/orgs/*`, `/github/*`, `/pull-requests/*`, `/billing/*`, and `/onboarding/signup` to that origin.

## WorkOS Auth

WorkOS AuthKit runs in this console app. Set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, and a redirect URI in the console runtime environment.

For Vercel, configure the console with:

```bash
NEXT_PUBLIC_API_URL=
API_PROXY_ORIGIN=https://api.deploytitan.com
NEXT_PUBLIC_ZERO_SERVER=https://zero.deploytitan.com
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
