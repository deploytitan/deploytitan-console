"use client";

import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-surface px-6 py-16 text-ink sm:px-10">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 border border-line bg-surface-alt p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-tertiary">
            GITHUB_SETUP
          </p>
          <h1 className="font-display text-3xl font-medium tracking-[-0.022em] text-ink sm:text-4xl">
            GitHub automation is being reconnected
          </h1>
          <p className="max-w-2xl text-base leading-7 text-ink-secondary">
            The console has moved off the old backend stack. Use manual repository
            and pull request entry inside each project while the new GitHub flow is
            finalized on Convex.
          </p>
        </div>

        <div className="border border-line bg-surface p-4 font-mono text-sm text-ink-secondary">
          integration.mode=manual
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="border border-ink bg-ink px-5 py-3 text-sm font-medium text-surface transition hover:border-primary"
          >
            Return to console
          </Link>
        </div>
      </section>
    </main>
  );
}
