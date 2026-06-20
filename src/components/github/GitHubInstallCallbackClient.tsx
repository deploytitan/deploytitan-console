"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FolderGit2,
  GitPullRequest,
  LoaderCircle,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";

type Props = {
  installationId: number | null;
  setupAction: string | null;
};

function SetupBadge({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
        tone === "neutral" &&
          "border-border bg-muted/30 text-text-tertiary",
        tone === "success" &&
          "border-signal-success/30 bg-signal-success/10 text-signal-success-text",
        tone === "warning" &&
          "border-signal-warning/30 bg-signal-warning/10 text-signal-warning-text",
        tone === "danger" &&
          "border-signal-danger/30 bg-signal-danger/10 text-signal-danger-text",
      )}
      style={{ borderRadius: "999px" }}
    >
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div
      className="border border-border bg-muted/20 p-4"
      style={{ borderRadius: "4px" }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-[20px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        {helper}
      </p>
    </div>
  );
}

export function GitHubInstallCallbackClient({
  installationId,
  setupAction,
}: Props) {
  const router = useRouter();
  const [selectedProjectPublicId, setSelectedProjectPublicId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRouting, startTransition] = useTransition();

  const data = useQuery(
    api.console.getGithubInstallationSetup,
    installationId ? { installationId } : "skip",
  );
  const applyInstallation = useMutation(api.console.applyGithubInstallation);

  const accessibleProjects = data?.accessibleProjects ?? [];
  const installation = data?.installation ?? null;
  const repositories = data?.repositories ?? [];
  const isLoading = installationId !== null && data === undefined;

  useEffect(() => {
    if (!accessibleProjects.length) return;

    const currentSelectionStillExists = accessibleProjects.some(
      (project) => project.publicId === selectedProjectPublicId,
    );
    if (currentSelectionStillExists) return;

    const nextSelection =
      installation?.selectedProjectPublicId ??
      accessibleProjects[0]?.publicId ??
      "";
    setSelectedProjectPublicId(nextSelection);
  }, [accessibleProjects, installation?.selectedProjectPublicId, selectedProjectPublicId]);

  const selectedProject = useMemo(
    () =>
      accessibleProjects.find(
        (project) => project.publicId === selectedProjectPublicId,
      ) ?? null,
    [accessibleProjects, selectedProjectPublicId],
  );

  const conflictCount = useMemo(() => {
    if (!selectedProjectPublicId) return 0;

    return repositories.filter((repository) => {
      const existing = repository.existingConnection;
      if (!existing) return false;
      if (existing.visibility === "restricted") return true;
      return existing.projectPublicId !== selectedProjectPublicId;
    }).length;
  }, [repositories, selectedProjectPublicId]);

  const alreadyLinkedCount = useMemo(
    () =>
      repositories.filter(
        (repository) =>
          repository.existingConnection &&
          repository.existingConnection.visibility === "accessible" &&
          repository.existingConnection.projectPublicId === selectedProjectPublicId,
      ).length,
    [repositories, selectedProjectPublicId],
  );

  const canApply =
    Boolean(installationId) &&
    Boolean(selectedProjectPublicId) &&
    repositories.length > 0 &&
    conflictCount === 0 &&
    !isLoading;

  const handleApply = async () => {
    if (!installationId || !selectedProjectPublicId || !selectedProject) return;

    setError(null);

    try {
      const result = await applyInstallation({
        installationId,
        projectPublicId: selectedProjectPublicId,
      });

      startTransition(() => {
        router.push(
          `/orgs/${selectedProject.orgId}/projects/${result.projectPublicId}/overview`,
        );
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect GitHub installation.",
      );
    }
  };

  if (installationId === null) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 sm:px-10">
        <section
          className="mx-auto max-w-3xl border border-border bg-background p-8"
          style={{ borderRadius: "4px" }}
        >
          <SetupBadge tone="danger">Missing installation ID</SetupBadge>
          <h1 className="mt-5 text-[30px] font-semibold tracking-tight text-foreground">
            We couldn&apos;t read the GitHub installation details
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-muted-foreground">
            Re-open the installation flow from GitHub so the callback includes the
            `installation_id` we need to finish setup.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/">
              <Button size="md">Return to Console</Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 sm:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="flex size-11 items-center justify-center border border-border bg-muted/30"
                style={{ borderRadius: "4px" }}
              >
                {isLoading ? (
                  <LoaderCircle className="size-5 animate-spin text-text-tertiary" />
                ) : (
                  <GitPullRequest className="size-5 text-foreground" />
                )}
              </div>
              <SetupBadge tone={conflictCount > 0 ? "warning" : "success"}>
                {setupAction ?? "install"} setup
              </SetupBadge>
            </div>
            <h1 className="mt-5 text-[32px] font-semibold tracking-tight text-foreground sm:text-[40px]">
              Connect your GitHub installation to a project
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-muted-foreground">
              Review the repositories GitHub sent us, choose the DeployTitan
              project that should own them, and resolve any collisions before we
              finish setup.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => router.refresh()}
            >
              <RefreshCcw className="size-3.5" />
              Refresh
            </Button>
            <Link href="/">
              <Button variant="ghost" size="md">
                Return to Console
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Installation"
            value={String(installationId)}
            helper={
              installation
                ? `${installation.accountLogin} installation is ${installation.status}.`
                : "Waiting for the installation webhook to persist the repo list."
            }
          />
          <SummaryCard
            label="Repositories"
            value={String(repositories.length)}
            helper="These are the repositories GitHub reported for this installation."
          />
          <SummaryCard
            label="Collisions"
            value={String(conflictCount)}
            helper="A collision means at least one repository is already linked to a different project."
          />
        </div>

        {!isLoading && !installation && (
          <div
            className="mt-6 flex items-start gap-3 border border-signal-warning/30 bg-signal-warning/10 px-4 py-4 text-signal-warning-text"
            style={{ borderRadius: "4px" }}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-[13px] font-medium">
                GitHub redirected you here before the installation webhook was processed.
              </p>
              <p className="mt-1 text-[12px] leading-relaxed">
                Give it a moment, then refresh this page. Once the webhook lands,
                the repo list and collision checks will appear here.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside
            className="border border-border bg-muted/10 p-4"
            style={{ borderRadius: "4px" }}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
              Target project
            </p>

            {accessibleProjects.length === 0 ? (
              <div
                className="mt-4 border border-dashed border-border px-4 py-6 text-[12px] leading-relaxed text-muted-foreground"
                style={{ borderRadius: "4px" }}
              >
                No accessible projects found for this account yet. Create a project
                first, then come back to finish the installation.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {accessibleProjects.map((project) => {
                  const selected = project.publicId === selectedProjectPublicId;
                  return (
                    <button
                      key={project.publicId}
                      type="button"
                      onClick={() => setSelectedProjectPublicId(project.publicId)}
                      className={cn(
                        "w-full border px-4 py-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/40",
                      )}
                      style={{ borderRadius: "4px" }}
                    >
                      <p className="text-[13px] font-medium text-foreground">
                        {project.name}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                        {project.orgName}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedProject && (
              <div
                className="mt-4 border border-border bg-background px-4 py-3"
                style={{ borderRadius: "4px" }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                  Selected
                </p>
                <p className="mt-2 text-[13px] font-medium text-foreground">
                  {selectedProject.name}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {selectedProject.orgName}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3">
              <Button
                size="md"
                disabled={!canApply || isRouting}
                onClick={handleApply}
              >
                {isRouting ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Opening Project
                  </>
                ) : (
                  <>
                    Finish GitHub Setup
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
              {alreadyLinkedCount > 0 ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {alreadyLinkedCount} repo{alreadyLinkedCount === 1 ? "" : "s"} already
                  belong to this project and will be refreshed in place.
                </p>
              ) : null}
            </div>
          </aside>

          <section
            className="border border-border bg-background"
            style={{ borderRadius: "4px" }}
          >
            <div className="border-b border-border px-5 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                Repository review
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Every repository is checked against existing project links before we
                attach the installation.
              </p>
            </div>

            {repositories.length === 0 ? (
              <div className="px-5 py-12 text-center text-[12px] text-text-tertiary">
                {isLoading
                  ? "Loading repositories..."
                  : "No repositories available for this installation yet."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {repositories.map((repository) => {
                  const existing = repository.existingConnection;
                  const isConflict =
                    existing &&
                    (existing.visibility === "restricted" ||
                      existing.projectPublicId !== selectedProjectPublicId);
                  const isSameProject =
                    existing &&
                    existing.visibility === "accessible" &&
                    existing.projectPublicId === selectedProjectPublicId;

                  return (
                    <div
                      key={`${repository.repoOwner}/${repository.repoName}`}
                      className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex items-start gap-3">
                        <FolderGit2 className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">
                            {repository.repoOwner}/{repository.repoName}
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                            {repository.isPrivate ? "Private repository" : "Public repository"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!existing ? (
                          <SetupBadge tone="success">
                            <CheckCircle2 className="size-3.5" />
                            Ready to add
                          </SetupBadge>
                        ) : isSameProject ? (
                          <SetupBadge tone="neutral">
                            <CheckCircle2 className="size-3.5" />
                            Already linked here
                          </SetupBadge>
                        ) : isConflict ? (
                          <SetupBadge tone="danger">
                            <ShieldAlert className="size-3.5" />
                            Collision
                          </SetupBadge>
                        ) : (
                          <SetupBadge tone="warning">
                            Existing link
                          </SetupBadge>
                        )}

                        {existing ? (
                          <span className="text-[12px] text-muted-foreground">
                            {existing.visibility === "accessible"
                              ? `Connected to ${existing.projectName}`
                              : "Connected to another project"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {error && (
          <div
            className="mt-6 flex items-start gap-3 border border-signal-danger/30 bg-signal-danger/10 px-4 py-4 text-signal-danger-text"
            style={{ borderRadius: "4px" }}
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-[13px] font-medium">Setup couldn&apos;t be completed</p>
              <p className="mt-1 text-[12px] leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
