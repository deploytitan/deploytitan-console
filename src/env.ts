/**
 * Central place for browser-exposed environment variables.
 *
 * Next.js only exposes variables prefixed with NEXT_PUBLIC_ to client code.
 */

const publicEnv = process.env;

export const GRAFANA_FARO_URL: string =
  publicEnv.NEXT_PUBLIC_GRAFANA_FARO_URL ?? "";

export const GRAFANA_FARO_APP_NAME: string =
  publicEnv.NEXT_PUBLIC_GRAFANA_FARO_APP_NAME ?? "";

export const GRAFANA_FARO_APP_ENV: string =
  publicEnv.NEXT_PUBLIC_VERCEL_ENV ?? "preview";

export const GRAFANA_FARO_ENABLED: boolean = GRAFANA_FARO_URL.length > 0;
