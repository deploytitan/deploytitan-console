"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  completeGitHubInstallation,
  type GitHubInstallCallbackResponse,
} from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

type CallbackState =
  | { status: "syncing" }
  | { status: "success"; result: GitHubInstallCallbackResponse }
  | { status: "error"; message: string };

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function Page() {
  const searchParams = useSearchParams();

  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const installState = searchParams.get("state");

  const installQuery = useQuery({
    queryKey: [
      "complete-github-installation",
      installationId,
      setupAction,
      installState,
    ],
    queryFn: async ({ queryKey }) => {
      const _installationId = queryKey[1];
      const _setupAction = queryKey[2];
      const _installState = queryKey[3];
      if (!_installationId)
        throw new Error("GitHub did not return an installation ID.");
      const response = await completeGitHubInstallation({
        installationId: _installationId,
        setupAction: _setupAction,
        state: _installState,
      });
      return response.data;
    },
    enabled: !!installationId,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const callbackState: CallbackState = !installationId
    ? { status: "error", message: "GitHub did not return an installation ID." }
    : installQuery.isPending
      ? { status: "syncing" }
      : installQuery.isError
        ? { status: "error", message: readErrorMessage(installQuery.error) }
        : { status: "success", result: installQuery.data };

  return (
    <main className="min-h-screen bg-surface px-6 py-16 text-ink sm:px-10">
      <section className="mx-auto flex max-w-3xl flex-col gap-8 border border-line bg-surface-alt p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-tertiary">
            GITHUB_APP_INSTALL
          </p>
          <h1 className="font-display text-3xl font-medium tracking-[-0.022em] text-ink sm:text-4xl">
            {callbackState.status === "syncing" && "Synchronizing installation"}
            {callbackState.status === "success" &&
              "GitHub installation synchronized"}
            {callbackState.status === "error" &&
              "GitHub installation needs attention"}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-ink-secondary">
            {callbackState.status === "syncing" &&
              "DeployTitan is reading the repositories available to this GitHub App installation and indexing open pull requests."}
            {callbackState.status === "success" &&
              "The selected repositories are connected. DeployTitan can now track open pull requests and process guarded merge requests."}
            {callbackState.status === "error" &&
              "The app was installed, but DeployTitan could not complete the repository sync."}
          </p>
        </div>

        {callbackState.status === "syncing" && (
          <div className="border border-line bg-surface p-4 font-mono text-sm text-ink-secondary">
            sync.status=running
          </div>
        )}

        {callbackState.status === "success" && (
          <dl className="grid gap-3 border border-line bg-surface p-4 font-mono text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-tertiary">
                Installation
              </dt>
              <dd className="text-ink">
                {callbackState.result.installationId}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-tertiary">
                Repositories
              </dt>
              <dd className="text-ink">{callbackState.result.repositories}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-tertiary">
                Open PRs
              </dt>
              <dd className="text-ink">{callbackState.result.pullRequests}</dd>
            </div>
          </dl>
        )}

        {callbackState.status === "error" && (
          <div className="border border-line bg-surface p-4 font-mono text-sm text-ink-secondary">
            sync.error={callbackState.message}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="border border-ink bg-ink px-5 py-3 text-sm font-medium text-surface transition hover:border-primary"
          >
            Return to console
          </Link>
          {callbackState.status === "success" &&
            callbackState.result.returnTo && (
              <Link
                href={callbackState.result.returnTo}
                className="border border-line px-5 py-3 text-sm font-medium text-ink-secondary transition hover:border-primary hover:text-ink"
              >
                Continue setup
              </Link>
            )}
        </div>
      </section>
    </main>
  );
}
