"use client";

import { Button } from "@/components/ui/button";

export function ZeroSchemaMismatchScreen({ message }: { message?: string }) {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <div className="grid min-h-screen place-items-center px-6 py-12">
        <section className="w-full max-w-2xl border border-line bg-surface-alt p-6 shadow-none sm:p-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-5">
              <div className="inline-flex border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-primary-accessible">
                Zero sync blocked
              </div>
              <div className="space-y-3">
                <h1 className="max-w-xl text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-4xl">
                  Client and server schemas are incompatible.
                </h1>
                <p className="max-w-prose text-sm leading-6 text-ink-tertiary">
                  The console cannot safely load replicated data until the Zero cache
                  has been reset or redeployed against the current database schema.
                  Your session is intact, but the app is blocked to avoid rendering
                  stale state.
                </p>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quaternary">
              INC-ZERO-SCHEMA
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-5">
            <dl className="space-y-3 font-mono text-[11px] leading-5">
              <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="uppercase tracking-[0.12em] text-ink-quaternary">
                  Fault
                </dt>
                <dd className="break-words text-ink-secondary">
                  SchemaVersionNotSupported
                </dd>
              </div>
              {message ? (
                <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="uppercase tracking-[0.12em] text-ink-quaternary">
                    Detail
                  </dt>
                  <dd className="whitespace-pre-wrap break-words text-ink-secondary">
                    {message}
                  </dd>
                </div>
              ) : null}
              <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="uppercase tracking-[0.12em] text-ink-quaternary">
                  Action
                </dt>
                <dd className="text-ink-secondary">
                  A new version of DeployTitan is being rolled out. This usually resolves within a few minutes — click Retry to check again.
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" onClick={() => window.location.reload()}>
              Retry connection
            </Button>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quaternary">
              Auto-reload disabled for this fault
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
