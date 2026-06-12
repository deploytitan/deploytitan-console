"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@deploytitan/zero-schema";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  GitBranch,
  GitFork,
  GitPullRequest,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="border border-border overflow-hidden"
      style={{ borderRadius: "4px" }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] animate-pulse bg-muted/40 border-b border-border/50 last:border-b-0"
          style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
        {children}
      </span>
      {count !== undefined && (
        <span className="font-mono text-[9px] tracking-[0.06em] text-text-tertiary">
          {count}
        </span>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptySection({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center py-8 border border-border border-dashed"
      style={{ borderRadius: "4px" }}
    >
      <p className="text-[12px] text-text-tertiary">{message}</p>
    </div>
  );
}

// ── Repositories ──────────────────────────────────────────────────────────────

type Repository = {
  id: string;
  publicId: string | null;
  repoVendor: string | null;
  repoOwner: string;
  repoName: string;
  installationStatus: string | null;
  defaultBranch: string | null;
  createdAt: number | null;
};

const SIGNAL = {
  success: {
    color: "var(--color-signal-success)",
    bg: "color-mix(in srgb, var(--color-signal-success) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-signal-success) 20%, transparent)",
  },
  warning: {
    color: "var(--color-signal-warning)",
    bg: "color-mix(in srgb, var(--color-signal-warning) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-signal-warning) 20%, transparent)",
  },
  danger: {
    color: "var(--color-signal-danger)",
    bg: "color-mix(in srgb, var(--color-signal-danger) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-signal-danger) 20%, transparent)",
  },
  deploy: {
    color: "var(--color-signal-deploy)",
    bg: "color-mix(in srgb, var(--color-signal-deploy) 8%, transparent)",
    border: "color-mix(in srgb, var(--color-signal-deploy) 20%, transparent)",
  },
} as const;

function SignalBadge({
  variant,
  children,
  icon: Icon,
}: {
  variant: keyof typeof SIGNAL;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const s = SIGNAL[variant];
  return (
    <span
      className="inline-flex items-center font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border"
      style={{
        borderRadius: "1px",
        color: s.color,
        backgroundColor: s.bg,
        borderColor: s.border,
      }}
    >
      {Icon && <Icon className="size-2 mr-0.5" strokeWidth={2} />}
      {children}
    </span>
  );
}

function InstallationBadge({ status }: { status: string | null }) {
  const s = status ?? "active";
  const isSuspended = s === "suspended";

  if (isSuspended) {
    return (
      <SignalBadge variant="warning" icon={AlertTriangle}>
        {s}
      </SignalBadge>
    );
  }
  if (s === "active") {
    return <SignalBadge variant="success">{s}</SignalBadge>;
  }
  return (
    <span
      className="inline-flex items-center font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px text-text-tertiary bg-muted/50 border border-border"
      style={{ borderRadius: "1px" }}
    >
      {s}
    </span>
  );
}

function RepoRow({ repo }: { repo: Repository }) {
  return (
    <div className="group flex items-center gap-3 px-5 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors duration-100">
      <GitFork
        className="size-3.5 shrink-0 text-text-tertiary"
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-[12px] text-foreground tracking-tight">
          {repo.repoOwner}
          <span className="text-text-tertiary">/</span>
          {repo.repoName}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {repo.defaultBranch && (
          <span className="hidden sm:flex items-center gap-1 font-mono text-[9px] tracking-[0.04em] text-text-tertiary">
            <GitBranch className="size-2.5" strokeWidth={1.75} />
            {repo.defaultBranch}
          </span>
        )}
        <InstallationBadge status={repo.installationStatus} />
      </div>
    </div>
  );
}

function RepositoriesSection({
  repos,
  loading,
}: {
  repos: Repository[];
  loading: boolean;
}) {
  return (
    <div>
      <SectionLabel count={loading ? undefined : repos.length}>
        Repositories
      </SectionLabel>
      {loading ? (
        <RowSkeleton count={2} />
      ) : repos.length === 0 ? (
        <EmptySection message="No repositories connected" />
      ) : (
        <div
          className="border border-border overflow-hidden"
          style={{ borderRadius: "4px" }}
        >
          {repos.map((repo) => (
            <RepoRow key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

type PullRequest = {
  id: string;
  repoId: string;
  prNumber: number;
  title: string | null;
  authorLogin: string | null;
  htmlUrl: string | null;
  sourceBranch: string | null;
  state: string | null;
  draft: boolean | null;
  mergeStatus: string | null;
  lastError: string | null;
  updatedAt: number | null;
};

function MergeStatusBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") return null;

  const map: Record<string, keyof typeof SIGNAL> = {
    checking: "deploy",
    merging: "warning",
    merged: "success",
    failed: "danger",
    blocked: "warning",
  };
  const variant = map[status];
  if (!variant) return null;

  return <SignalBadge variant={variant}>{status}</SignalBadge>;
}

function StateBadge({
  state,
  draft,
}: {
  state: string | null;
  draft: boolean | null;
}) {
  if (draft) {
    return (
      <span
        className="inline-flex items-center font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px text-text-tertiary bg-muted/60 border border-border"
        style={{ borderRadius: "1px" }}
      >
        draft
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span
        className="inline-flex items-center font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px text-text-tertiary bg-muted/40 border border-border"
        style={{ borderRadius: "1px" }}
      >
        closed
      </span>
    );
  }
  return <SignalBadge variant="success">open</SignalBadge>;
}

function PrRow({ pr, repoName }: { pr: PullRequest; repoName: string }) {
  const content = (
    <div className="group flex items-start gap-3 px-5 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors duration-100 cursor-pointer">
      <GitPullRequest
        className="size-3.5 shrink-0 mt-px text-text-tertiary"
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] text-text-tertiary shrink-0">
            #{pr.prNumber}
          </span>
          <p className="text-[13px] text-foreground truncate leading-snug min-w-0 flex-1">
            {pr.title || "Untitled PR"}
          </p>
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] tracking-[0.04em] text-text-tertiary">
            {repoName}
          </span>
          {pr.authorLogin && (
            <>
              <span className="text-border select-none" aria-hidden>
                ·
              </span>
              <span className="font-mono text-[9px] text-text-tertiary">
                {pr.authorLogin}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-px">
        <StateBadge state={pr.state} draft={pr.draft} />
        <MergeStatusBadge status={pr.mergeStatus} />
        {pr.updatedAt && (
          <span className="hidden sm:flex items-center gap-1 font-mono text-[9px] text-text-tertiary">
            <Clock className="size-2.5" strokeWidth={1.75} />
            {formatRelativeTime(pr.updatedAt)}
          </span>
        )}
        {pr.htmlUrl && (
          <ExternalLink
            className="size-3 text-text-disabled group-hover:text-text-tertiary transition-colors duration-100 shrink-0"
            strokeWidth={1.5}
          />
        )}
      </div>
    </div>
  );

  if (pr.htmlUrl) {
    return (
      <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}

function PullRequestsSection({
  prs,
  repoMap,
  loading,
}: {
  prs: PullRequest[];
  repoMap: Map<string, string>;
  loading: boolean;
}) {
  const openPrs = prs.filter((pr) => pr.state === "open" || pr.draft);

  return (
    <div>
      <SectionLabel count={loading ? undefined : openPrs.length}>
        Pull Requests
      </SectionLabel>
      {loading ? (
        <RowSkeleton count={3} />
      ) : openPrs.length === 0 ? (
        <EmptySection message="No open pull requests" />
      ) : (
        <div
          className="border border-border overflow-hidden"
          style={{ borderRadius: "4px" }}
        >
          {openPrs.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              repoName={repoMap.get(pr.repoId) ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const projectPublicId = params?.projectId as string;

  const [project] = useQuery(
    queries.projectByPublicId({ publicId: projectPublicId }),
  );

  const projectId = project?.id ?? "";

  const [repos, repoDetails] = useQuery(
    queries.repositoriesByProjectId({ projectId }),
  );
  const [prs, prDetails] = useQuery(
    queries.pullRequestsByProjectId({ projectId }),
  );

  const reposLoading = repoDetails.type === "unknown";
  const prsLoading = prDetails.type === "unknown";

  const repoMap = new Map(
    (repos as Repository[]).map((r) => [r.id, `${r.repoOwner}/${r.repoName}`]),
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight leading-none">
              Overview
            </h1>
            {project && (
              <p className="mt-1 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                {project.id}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-8 animate-fade-up">
        {/* Project metadata */}
        {project && (
          <div
            className="border border-border bg-muted/30 px-5 py-4"
            style={{ borderRadius: "4px" }}
          >
            <div className="flex items-start gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground leading-none mb-1">
                  {project.name}
                </p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  {project.createdAt && (
                    <span className="font-mono text-[10px] tracking-[0.04em] text-text-tertiary">
                      Created {formatDate(project.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repositories */}
        <RepositoriesSection
          repos={repos as Repository[]}
          loading={reposLoading}
        />

        {/* Pull Requests */}
        <PullRequestsSection
          prs={prs as PullRequest[]}
          repoMap={repoMap}
          loading={prsLoading}
        />
      </div>
    </div>
  );
}
