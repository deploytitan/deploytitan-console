/**
 * Central place for browser-exposed environment variables.
 *
 * Next.js only exposes variables prefixed with NEXT_PUBLIC_ to client code.
 * The legacy VITE_* names are kept in comments below to make env migration easy:
 * NEXT_PUBLIC_API_URL replaces VITE_API_URL.
 * NEXT_PUBLIC_ZERO_SERVER replaces VITE_ZERO_SERVER.
 * NEXT_PUBLIC_DEV_BYPASS_AUTH replaces VITE_DEV_BYPASS_AUTH.
 */

const publicEnv = process.env;

export const ZERO_SERVER: string = publicEnv.NEXT_PUBLIC_ZERO_SERVER || "";

export const GRAFANA_FARO_URL: string =
  publicEnv.NEXT_PUBLIC_GRAFANA_FARO_URL ?? "";

export const GRAFANA_FARO_API_KEY: string =
  publicEnv.NEXT_PUBLIC_GRAFANA_FARO_API_KEY ?? "";

export const GRAFANA_FARO_APP_NAME: string =
  publicEnv.NEXT_PUBLIC_GRAFANA_FARO_APP_NAME ?? "";

export const GRAFANA_FARO_ENABLED: boolean = GRAFANA_FARO_URL.length > 0;
