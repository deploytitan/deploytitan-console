#!/bin/sh
set -e

# VERCEL_ENV is 'production' on prod, 'preview' or 'development' on staging.
# Staging installs the 'staging' dist-tag (published from develop on each push).
# Prod uses normal pnpm install which resolves 'latest' from package.json.
if [ "$VERCEL_ENV" = "production" ]; then
  pnpm install
else
  pnpm install && pnpm add @deploytitan/zero-schema@staging
fi
