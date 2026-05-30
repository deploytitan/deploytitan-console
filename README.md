# DeployTitan Console

Standalone Next.js console for DeployTitan, intended to run on Vercel while the original monorepo continues to own backend services and private packages.

## Companion repositories

| Repo | Path | Purpose |
|---|---|---|
| `deploytitan-monorepo` | `~/projects/deploytitan-monorepo` | Backend API, worker, DB schema, Zero schema, shared packages |
| `deploytitan-console` | `~/projects/deploytitan-console` | This repo — Next.js frontend |

The backend monorepo owns:
- **DB schema** — `packages/db-schema/src/index.ts` (Drizzle ORM tables + Postgres migrations)
- **Zero schema** — `packages/db-schema/zero-schema.gen.ts` (auto-generated; run `pnpm --filter @deploytitan/db-schema generate`)
- **Zero queries** — `packages/zero-schema/src/queries.ts`
- **Zero mutators** — `packages/zero-schema/src/mutators.ts`
- **API** — `apps/api/src/` (Effect HTTP, BullMQ workers)

When adding a new feature that needs new tables or API endpoints:
1. Update `packages/db-schema/src/index.ts`
2. Run `pnpm --filter @deploytitan/db-schema db:generate` (Drizzle migration)
3. Run `pnpm --filter @deploytitan/db-schema generate` (Zero schema regen)
4. Run `pnpm --filter @deploytitan/db-schema build` (publish built types)
5. Update `packages/zero-schema/src/queries.ts` and `mutators.ts`
6. Bump patch versions in both `db-schema` and `zero-schema` `package.json`
7. Add API group + handler in `apps/api/src/api/groups/` and `handlers/`
8. Register in `apps/api/src/api/Api.ts` and `apps/api/src/main.ts`

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
