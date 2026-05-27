import type { LogLevel } from '@grafana/faro-web-sdk'
import { getGrafanaFaro } from './grafanaFaro'

type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface FrontendTelemetryEvent {
  level: FrontendLogLevel
  message: string
  context?: Record<string, unknown>
}

interface FrontendTelemetryEnvelope extends FrontendTelemetryEvent {
  timestamp: string
  page: string
  userAgent: string
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function sanitizeContext(context: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined

  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue
    if (value instanceof Error) {
      next[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
      continue
    }
    next[key] = value
  }
  return next
}

function toFaroContext(
  context: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!context) return undefined

  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue
    next[key] =
      typeof value === 'string'
        ? value
        : value instanceof Error
          ? value.message
          : JSON.stringify(value)
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function toFaroLogLevel(level: FrontendLogLevel): LogLevel {
  switch (level) {
    case 'debug':
      return 'debug' as LogLevel
    case 'warn':
      return 'warn' as LogLevel
    case 'error':
      return 'error' as LogLevel
    case 'info':
    default:
      return 'info' as LogLevel
  }
}

function toEnvelope(event: FrontendTelemetryEvent): FrontendTelemetryEnvelope | null {
  if (!isBrowser()) return null

  const context = sanitizeContext(event.context)
  return {
    ...event,
    ...(context ? { context } : {}),
    timestamp: new Date().toISOString(),
    page: window.location.href,
    userAgent: navigator.userAgent,
  }
}

export function logFrontendEvent(event: FrontendTelemetryEvent): void {
  const envelope = toEnvelope(event)
  if (!envelope) return

  const grafanaFaro = getGrafanaFaro()
  if (!grafanaFaro) return

  try {
    const faroContext = toFaroContext(envelope.context)
    if (event.level === 'error') {
      const error =
        event.context?.['error'] instanceof Error
          ? event.context['error']
          : new Error(event.message)
      grafanaFaro.api.pushError(error, {
        type: 'frontend-event',
        ...(faroContext ? { context: faroContext } : {}),
      })
    } else {
      grafanaFaro.api.pushLog([event.message], {
        level: toFaroLogLevel(event.level),
        ...(faroContext ? { context: faroContext } : {}),
      })
    }
  } catch {
    // Avoid recursive logging loops if the telemetry SDK itself fails.
  }
}

export function installFrontendTelemetry(user: { id: string; email: string } | null): () => void {
  if (!isBrowser()) {
    return () => {}
  }

  logFrontendEvent({
    level: 'info',
    message: 'frontend.telemetry.ready',
    context: {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      path: window.location.pathname,
    },
  })

  const onError = (event: ErrorEvent) => {
    logFrontendEvent({
      level: 'error',
      message: 'frontend.window.error',
      context: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error instanceof Error ? event.error : event.message,
      },
    })
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason =
      event.reason instanceof Error
        ? {
            name: event.reason.name,
            message: event.reason.message,
            stack: event.reason.stack,
          }
        : { value: String(event.reason) }

    logFrontendEvent({
      level: 'error',
      message: 'frontend.promise.unhandled_rejection',
      context: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        reason,
      },
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}
