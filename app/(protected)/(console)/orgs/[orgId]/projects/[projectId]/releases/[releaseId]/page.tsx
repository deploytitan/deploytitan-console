// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestDraft,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";

type ReleaseStatus = "draft" | "ready" | "in_progress" | "shipped" | "blocked";
type PRStatus = "open" | "merged" | "closed" | "draft";

function derivePrStatus(status: string, mergedAt: number | null): PRStatus {
  if (mergedAt) return "merged";
  if (status === "closed") return "closed";
  if (status === "draft") return "draft";
  return "open";
}

const releaseStatusConfig: Record<
  ReleaseStatus,
  { label: string; icon: React.ElementType; cls: string }
> = {
  draft: {
    label: "draft",
    icon: Clock,
    cls: "text-text-tertiary bg-muted/50 border-border",
  },
  ready: {
    label: "ready",
    icon: CheckCircle2,
    cls: "text-signal-success-text bg-signal-success/8 border-signal-success/25",
  },
  in_progress: {
    label: "active",
    icon: Loader2,
    cls: "text-signal-deploy-text bg-signal-deploy/8 border-signal-deploy/25",
  },
  shipped: {
    label: "shipped",
    icon: CheckCircle2,
    cls: "text-signal-success-text bg-signal-success/8 border-signal-success/25",
  },
  blocked: {
    label: "blocked",
    icon: AlertTriangle,
    cls: "text-signal-danger-text bg-signal-danger/8 border-signal-danger/25",
  },
};

function ReleaseBadge({ status }: { status: ReleaseStatus }) {
  const { label, icon: Icon, cls } = releaseStatusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border",
        cls,
      )}
      style={{ borderRadius: "1px" }}
    >
      <Icon className={cn("size-2", status === "in_progress" && "animate-spin")} />
      {label}
    </span>
  );
}

const prStatusIcons: Record<PRStatus, React.ElementType> = {
  open: GitPullRequest,
  merged: GitMerge,
  closed: X,
  draft: GitPullRequestDraft,
};

const prStatusCls: Record<PRStatus, string> = {
  open: "text-signal-deploy-text",
  merged: "text-signal-success-text",
  closed: "text-signal-danger-text",
  draft: "text-text-tertiary",
};

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "danger" | "warning" | "success";
}) {
  const valueClass =
    accent === "danger"
      ? "text-signal-danger-text"
      : accent === "warning"
        ? "text-signal-warning-text"
        : accent === "success"
          ? "text-signal-success-text"
          : "text-foreground";

  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-1">
        {label}
      </p>
      <p className={cn("text-[22px] font-semibold tracking-tight leading-none", valueClass)}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">{sub}</p>
      )}
    </div>
  );
}

function AiSummaryCard({
  prCount,
  repoCount,
  authorNames,
}: {
  prCount: number;
  repoCount: number;
  authorNames: string[];
}) {
  const authorText =
    authorNames.length === 0
      ? "the team"
      : authorNames.length === 1
        ? authorNames[0]
        : authorNames.length === 2
          ? `${authorNames[0]} and ${authorNames[1]}`
          : `${authorNames[0]}, ${authorNames[1]}, and ${authorNames.length - 2} other${authorNames.length - 2 > 1 ? "s" : ""}`;

  const summary =
    prCount === 0
      ? "No pull requests attached to this release yet. Add PRs from the PR list or attach them below."
      : `This release bundles ${prCount} pull request${prCount > 1 ? "s" : ""} across ${repoCount} repo${repoCount > 1 ? "s" : ""} from ${authorText}. All changes should be reviewed and approved before marking ready. Check workflow status on each PR before merging.`;

  return (
    <div
      className="bg-muted/30 border border-border p-4 mb-6"
      style={{ borderRadius: "8px" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-primary/10 border border-primary/20"
          style={{ borderRadius: "4px" }}
        >
          <Sparkles className="size-3.5 text-primary-accessible" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-1.5">
            AI Summary
          </p>
          <p className="text-[13px] text-foreground leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const Element = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
        {label}
      </span>
      <Element
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/30 transition-colors"
        style={{ borderRadius: "4px", minHeight: multiline ? "88px" : undefined }}
      />
    </label>
  );
}

export default function ReleaseDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const releaseId = params.releaseId as string;
  const orgId = params.orgId as string;

  const data = useQuery(api.console.getReleaseDetail, {
    projectPublicId: projectId,
    releasePublicId: releaseId,
  });
  const isLoading = data === undefined;
  const updateRelease = useMutation(api.console.updateRelease);
  const addReleaseItem = useMutation(api.console.addReleaseItem);
  const updateReleaseItem = useMutation(api.console.updateReleaseItem);
  const removeReleaseItem = useMutation(api.console.removeReleaseItem);
  const attachPullRequestToRelease = useMutation(api.console.attachPullRequestToRelease);
  const detachPullRequestFromRelease = useMutation(api.console.detachPullRequestFromRelease);

  const release = data?.release;
  const allPullRequests = data?.pullRequests ?? [];

  const includedPullRequests = useMemo(
    () => allPullRequests.filter((pr) => release?.pullRequestPublicIds.includes(pr.publicId)),
    [allPullRequests, release?.pullRequestPublicIds],
  );
  const availablePullRequests = useMemo(
    () => allPullRequests.filter((pr) => !release?.pullRequestPublicIds.includes(pr.publicId)),
    [allPullRequests, release?.pullRequestPublicIds],
  );

  const includedRepoCount = useMemo(
    () => new Set(includedPullRequests.map((pr) => pr.repositoryPublicId).filter(Boolean)).size,
    [includedPullRequests],
  );
  const includedAuthorNames = useMemo(
    () => Array.from(new Set(includedPullRequests.map((pr) => pr.authorName).filter(Boolean) as string[])),
    [includedPullRequests],
  );
  const workflowFailures = 0; // to be wired when CI data is available
  const missingApprovals = includedPullRequests.filter((pr) => derivePrStatus(pr.status, pr.mergedAt) === "open").length;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [shipPlan, setShipPlan] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [selectedPullRequest, setSelectedPullRequest] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  useEffect(() => {
    if (!release) return;
    setName(release.name);
    setDescription(release.description);
    setOutcome(release.outcome);
    setSuccessMetric(release.successMetric);
    setShipPlan(release.shipPlan);
  }, [release]);

  async function handleSave() {
    setIsSaving(true);
    await updateRelease({ releasePublicId: releaseId, name, description, outcome, successMetric, shipPlan });
    setIsSaving(false);
  }

  async function handleMarkReady() {
    await updateRelease({ releasePublicId: releaseId, status: "ready" });
  }

  if (isLoading || !release) {
    return (
      <div className="min-h-screen bg-background px-8 py-7">
        <div className="space-y-3">
          <div className="h-4 w-20 bg-muted animate-pulse" style={{ borderRadius: "2px" }} />
          <div className="h-7 w-64 bg-muted animate-pulse" style={{ borderRadius: "2px" }} />
          <div className="h-px bg-border mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                Release Packet
              </p>
              <ReleaseBadge status={release.status} />
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground leading-tight">
              {release.name}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {release.status === "draft" && (
              <Button variant="outline" size="sm" onClick={handleMarkReady}>
                <CheckCircle2 className="size-3.5" />
                Mark Ready
              </Button>
            )}
            {includedPullRequests.length > 0 && release.status !== "shipped" && (
              <Button
                size="sm"
                onClick={() => setShowMergeConfirm(true)}
                className="gap-1.5"
              >
                <Zap className="size-3.5" />
                Merge All PRs
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div
          className="mt-4 grid grid-cols-4 border border-border bg-muted/10 divide-x divide-border overflow-hidden"
          style={{ borderRadius: "4px" }}
        >
          <StatCard label="Pull Requests" value={includedPullRequests.length} />
          <StatCard label="Repos" value={includedRepoCount} />
          <StatCard
            label="CI Failures"
            value={workflowFailures}
            accent={workflowFailures > 0 ? "danger" : undefined}
            sub={workflowFailures === 0 ? "all passing" : undefined}
          />
          <StatCard
            label="Pending Review"
            value={missingApprovals}
            accent={missingApprovals > 0 ? "warning" : "success"}
            sub={missingApprovals === 0 ? "all approved" : `${missingApprovals} open`}
          />
        </div>
      </div>

      <div className="px-8 py-6">
        {/* AI Summary */}
        <AiSummaryCard
          prCount={includedPullRequests.length}
          repoCount={includedRepoCount}
          authorNames={includedAuthorNames}
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {/* Left: editable fields */}
          <section className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={name} onChange={setName} />
              <label className="block">
                <span className="mb-1.5 block font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                  Status
                </span>
                <select
                  value={release.status}
                  onChange={(e) =>
                    updateRelease({
                      releasePublicId: releaseId,
                      status: e.target.value as ReleaseStatus,
                    })
                  }
                  className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/30 transition-colors"
                  style={{ borderRadius: "4px" }}
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="in_progress">In progress</option>
                  <option value="shipped">Shipped</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
            </div>

            <Field label="Summary" value={description} onChange={setDescription} multiline />
            <Field label="Outcome" value={outcome} onChange={setOutcome} multiline />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Success Metric" value={successMetric} onChange={setSuccessMetric} />
              <Field label="Ship Plan" value={shipPlan} onChange={setShipPlan} multiline />
            </div>

            {/* Checklist */}
            <div>
              <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                Checklist
              </p>
              <div className="mb-2 flex gap-2">
                <input
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="Add a task, risk, or note"
                  className="flex-1 border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/30 transition-colors"
                  style={{ borderRadius: "4px" }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && itemTitle.trim()) {
                      await addReleaseItem({ releasePublicId: releaseId, title: itemTitle });
                      setItemTitle("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!itemTitle.trim()}
                  onClick={async () => {
                    await addReleaseItem({ releasePublicId: releaseId, title: itemTitle });
                    setItemTitle("");
                  }}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {release.items.length > 0 && (
                <div className="border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
                  {release.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 border-b border-border last:border-b-0 px-3 py-2.5"
                    >
                      <button
                        className={cn(
                          "flex items-center justify-center size-4 border shrink-0 transition-colors",
                          item.status === "done"
                            ? "bg-signal-success/20 border-signal-success/40 text-signal-success-text"
                            : "border-border hover:border-foreground/40 bg-background",
                        )}
                        style={{ borderRadius: "2px" }}
                        onClick={() =>
                          updateReleaseItem({
                            releasePublicId: releaseId,
                            itemId: item.id,
                            status: item.status === "done" ? "todo" : "done",
                          })
                        }
                      >
                        {item.status === "done" && <Check className="size-2.5" strokeWidth={3} />}
                      </button>
                      <span
                        className={cn(
                          "flex-1 text-[13px]",
                          item.status === "done" ? "line-through text-text-tertiary" : "text-foreground",
                        )}
                      >
                        {item.title}
                      </span>
                      <button
                        className="text-text-tertiary hover:text-signal-danger-text transition-colors"
                        onClick={() => removeReleaseItem({ releasePublicId: releaseId, itemId: item.id })}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right: PRs + participants */}
          <aside className="space-y-6">
            {/* Included PRs */}
            <div>
              <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                Included Pull Requests
              </p>

              {/* Attach PR */}
              {availablePullRequests.length > 0 && (
                <div className="mb-3 flex gap-2">
                  <select
                    value={selectedPullRequest}
                    onChange={(e) => setSelectedPullRequest(e.target.value)}
                    className="flex-1 border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:border-foreground/30 transition-colors"
                    style={{ borderRadius: "4px" }}
                  >
                    <option value="">Attach a pull request…</option>
                    {availablePullRequests.map((pr) => (
                      <option key={pr.id} value={pr.publicId}>
                        {pr.number ? `#${pr.number} ` : ""}{pr.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedPullRequest}
                    onClick={async () => {
                      await attachPullRequestToRelease({
                        releasePublicId: releaseId,
                        pullRequestPublicId: selectedPullRequest,
                      });
                      setSelectedPullRequest("");
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              )}

              {includedPullRequests.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-8 text-center border border-border"
                  style={{ borderRadius: "4px", borderStyle: "dashed" }}
                >
                  <GitPullRequest className="size-5 text-text-tertiary mb-2" strokeWidth={1.5} />
                  <p className="text-[12px] text-muted-foreground">No PRs attached</p>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    Add from the list above or the{" "}
                    <a
                      href={`/orgs/${orgId}/pull-requests`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Pull Requests page
                    </a>
                  </p>
                </div>
              ) : (
                <div className="border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
                  {includedPullRequests.map((pr) => {
                    const prStatus = derivePrStatus(pr.status, pr.mergedAt);
                    const PrIcon = prStatusIcons[prStatus];
                    return (
                      <div
                        key={pr.id}
                        className="group flex items-start gap-2.5 border-b border-border last:border-b-0 px-3 py-2.5"
                      >
                        <PrIcon
                          className={cn("size-3.5 mt-0.5 shrink-0", prStatusCls[prStatus])}
                          strokeWidth={2}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-foreground leading-snug truncate">
                            {pr.number ? (
                              <span className="font-mono text-text-tertiary mr-1">#{pr.number}</span>
                            ) : null}
                            {pr.title}
                          </p>
                          {(pr.authorName || pr.headBranch) && (
                            <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">
                              {[pr.authorName, pr.headBranch].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        {pr.url && (
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-tertiary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                        <button
                          className="text-text-tertiary hover:text-signal-danger-text transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                          onClick={() =>
                            detachPullRequestFromRelease({
                              releasePublicId: releaseId,
                              pullRequestPublicId: pr.publicId,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Participants */}
            {release.participants.length > 0 && (
              <div>
                <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                  Participants
                </p>
                <div className="border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
                  {release.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 border-b border-border last:border-b-0 px-3 py-2.5"
                    >
                      <div
                        className="flex size-6 shrink-0 items-center justify-center bg-muted border border-border font-mono text-[9px] text-text-tertiary"
                        style={{ borderRadius: "50%" }}
                      >
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-foreground leading-snug">
                          {participant.name}
                        </p>
                        <p className="font-mono text-[10px] text-text-tertiary">{participant.role}</p>
                      </div>
                      <span
                        className={cn(
                          "font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border",
                          participant.status === "complete"
                            ? "text-signal-success-text bg-signal-success/8 border-signal-success/25"
                            : participant.status === "confirmed"
                              ? "text-signal-deploy-text bg-signal-deploy/8 border-signal-deploy/25"
                              : "text-text-tertiary bg-muted/40 border-border",
                        )}
                        style={{ borderRadius: "1px" }}
                      >
                        {participant.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Merge All confirmation overlay */}
      {showMergeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMergeConfirm(false); }}
        >
          <div
            className="w-full max-w-sm mx-4 bg-background border border-border shadow-[0_8px_40px_color-mix(in_srgb,var(--color-ink)_20%,transparent)] p-6"
            style={{ borderRadius: "12px" }}
          >
            <div
              className="mb-4 flex size-10 items-center justify-center bg-signal-warning/10 border border-signal-warning/25"
              style={{ borderRadius: "8px" }}
            >
              <Zap className="size-5 text-signal-warning-text" />
            </div>
            <h2 className="text-[16px] font-semibold text-foreground tracking-tight mb-1.5">
              Merge {includedPullRequests.length} pull request{includedPullRequests.length !== 1 ? "s" : ""}?
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              This will merge all open PRs in this release. Make sure CI is passing and all approvals are in place before proceeding.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowMergeConfirm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowMergeConfirm(false);
                  updateRelease({ releasePublicId: releaseId, status: "in_progress" });
                }}
              >
                <GitMerge className="size-3.5" />
                Merge All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
