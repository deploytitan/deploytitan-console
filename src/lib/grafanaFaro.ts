import type { Faro } from "@grafana/faro-web-sdk";
import {
  GRAFANA_FARO_APP_ENV,
  GRAFANA_FARO_APP_NAME,
  GRAFANA_FARO_ENABLED,
  GRAFANA_FARO_URL,
} from "../env";

let initialized = false;
let faroInstance: Faro | null = null;
let initPromise: Promise<Faro | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function initGrafanaFaro(): Promise<Faro | null> {
  if (!isBrowser() || !GRAFANA_FARO_ENABLED) {
    return Promise.resolve(null);
  }

  if (initialized) {
    return Promise.resolve(faroInstance);
  }

  initPromise ??= Promise.all([
    import("@grafana/faro-web-sdk"),
    import("@grafana/faro-web-tracing"),
  ])
    .then(
      ([
        { faro, getWebInstrumentations, initializeFaro },
        { TracingInstrumentation },
      ]) => {
        if (initialized) return faroInstance;

        initializeFaro({
          url: GRAFANA_FARO_URL,
          app: {
            name: GRAFANA_FARO_APP_NAME,
            environment: GRAFANA_FARO_APP_ENV,
          },
          instrumentations: [
            ...getWebInstrumentations({
              captureConsole: true,
            }),
            new TracingInstrumentation(),
          ],
        });

        initialized = true;
        faroInstance = faro;
        console.log(
          "[grafana-faro] initialized successfully, sending to:",
          GRAFANA_FARO_URL,
        );
        return faroInstance;
      },
    )
    .catch((err) => {
      console.error("[grafana-faro] initialization failed:", err);
      initPromise = null;
      return null;
    });

  return initPromise;
}

export function getGrafanaFaro() {
  return initialized ? faroInstance : null;
}
