"use client";

import { useMemo, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestDraft,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type PRStatus = "open" | "merged" | "closed" | "draft";

function derivePrStatus(status: string, mergedAt: number | null): PRStatus {
  if (mergedAt) return "merged";
  if (status === "closed") return "closed";
  if (status === "draft") return "draft";
  return "open";
}

const prStatusConfig: Record<PRStatus, { label: string; cls: string; icon: React.ElementType }> = {
  open: {
    label: "open",
    icon: GitPullRequest,
    cls: "text-signal-deploy-text bg-signal-deploy/8 border-signal-deploy/25",
  },
  merged: {
    label: "merged",
    icon: GitMerge,
    cls: "text-signal-success-text bg-signal-success/8 border-signal-success/25",
  },
  closed: {
    label: "closed",
    icon: X,
    cls: "text-signal-danger-text bg-signal-danger/8 border-signal-danger/25",
  },
  draft: {
    label: "draft",
    icon: GitPullRequestDraft,
    cls: "text-text-tertiary bg-muted/40 border-border",
  },
};

function PrStatusBadge({ status }: { status: PRStatus }) {
  const { label, icon: Icon, cls } = prStatusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border shrink-0",
        cls,
      )}
      style={{ borderRadius: "1px" }}
    >
      <Icon className="size-2.5" strokeWidth={2} />
      {label}
    </span>
  );
}

function BranchChip({ branch }: { branch: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[10px] text-text-tertiary bg-muted/50 border border-border px-1.5 py-px truncate max-w-[120px]" style={{ borderRadius: "2px" }}>
      {branch}
    </span>
  );
}

interface CreateReleaseDialogProps {
  selectedCount: number;
  projects: Array<{ publicId: string; name: string }>;
  onConfirm: (projectPublicId: string, name: string) => Promise<void>;
  onClose: () => void;
}

function CreateReleaseDialog({ selectedCount, projects, onConfirm, onClose }: CreateReleaseDialogProps) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const [name, setName] = useState(`Sprint Release ${dateStr}`);
  const [projectId, setProjectId] = useState(projects[0]?.publicId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!name.trim() || !projectId) return;
    startTransition(async () => {
      await onConfirm(projectId, name.trim());
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg mb-0 bg-background border border-border shadow-[0_-4px_32px_color-mix(in_srgb,var(--color-ink)_12%,transparent)]"
        style={{ borderRadius: "12px 12px 0 0" }}
      >
        <div className="px-6 pt-5 pb-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-0.5">
                New Release
              </p>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                {selectedCount} PR{selectedCount !== 1 ? "s" : ""} selected
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center size-7 text-text-tertiary hover:text-foreground hover:bg-muted/60 transition-colors"
              style={{ borderRadius: "4px" }}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-3 pb-5">
            <div>
              <label className="block mb-1.5 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                Release name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/40 transition-colors"
                style={{ borderRadius: "4px" }}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              />
            </div>

            {projects.length > 1 && (
              <div>
                <label className="block mb-1.5 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                  Project
                </label>
                <div className="relative">
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full appearance-none border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none pr-8 focus:border-foreground/40 transition-colors"
                    style={{ borderRadius: "4px" }}
                  >
                    {projects.map((p) => (
                      <option key={p.publicId} value={p.publicId}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={!name.trim() || !projectId || isPending}
                onClick={handleConfirm}
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Create Release
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrgPullRequestsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();

  const data = useQuery(api.console.getOrgPullRequests, { workosOrgId: orgId });
  const createReleaseWithPRs = useMutation(api.console.createReleaseWithPullRequests);

  const isLoading = data === undefined;
  const pullRequests = data?.pullRequests ?? [];
  const projects = data?.projects ?? [];

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const uniqueBranches = useMemo(() => {
    const branches = new Set(pullRequests.map((pr) => pr.baseBranch).filter(Boolean) as string[]);
    return Array.from(branches).sort();
  }, [pullRequests]);

  const filtered = useMemo(() => {
    return pullRequests.filter((pr) => {
      const prStatus = derivePrStatus(pr.status, pr.mergedAt);

      if (statusFilter !== "all" && prStatus !== statusFilter) return false;

      if (branchFilter !== "all" && pr.baseBranch !== branchFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = pr.title.toLowerCase().includes(q);
        const repoMatch = pr.repoName?.toLowerCase().includes(q);
        const authorMatch = pr.authorName?.toLowerCase().includes(q);
        if (!titleMatch && !repoMatch && !authorMatch) return false;
      }

      return true;
    });
  }, [pullRequests, search, branchFilter, statusFilter]);

  const allFilteredIds = useMemo(() => filtered.map((pr) => pr.publicId), [filtered]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleOne(publicId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  async function handleCreateRelease(projectPublicId: string, name: string) {
    const selectedPrPublicIds = Array.from(selectedIds).filter((id) =>
      filtered.some((pr) => pr.publicId === id),
    );

    const result = await createReleaseWithPRs({
      projectPublicId,
      name,
      pullRequestPublicIds: selectedPrPublicIds,
    });

    const project = projects.find((p) => p.publicId === projectPublicId);
    if (project && result?.publicId) {
      router.push(`/orgs/${orgId}/projects/${project.publicId}/releases/${result.publicId}`);
    }
  }

  const statusTabs: Array<{ value: string; label: string }> = [
    { value: "open", label: "Open" },
    { value: "draft", label: "Draft" },
    { value: "merged", label: "Merged" },
    { value: "closed", label: "Closed" },
    { value: "all", label: "All" },
  ];

  const openCount = pullRequests.filter((pr) => derivePrStatus(pr.status, pr.mergedAt) === "open").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight leading-none">
              Pull Requests
            </h1>
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
              {isLoading ? "—" : `${openCount} open across ${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {someSelected && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Sparkles className="size-3.5" />
              Create Release ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border bg-muted/20 px-8 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PRs, repos, authors…"
            className="w-full border border-border bg-background pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-foreground/30 transition-colors"
            style={{ borderRadius: "4px" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Branch filter */}
        {uniqueBranches.length > 0 && (
          <div className="relative">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="appearance-none border border-border bg-background pl-3 pr-7 py-1.5 text-[12px] text-foreground outline-none focus:border-foreground/30 transition-colors"
              style={{ borderRadius: "4px" }}
            >
              <option value="all">All branches</option>
              {uniqueBranches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-text-tertiary pointer-events-none" />
          </div>
        )}

        {/* Status tabs */}
        <div className="flex items-center border border-border bg-background" style={{ borderRadius: "4px" }}>
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "px-3 py-1.5 text-[11px] transition-colors duration-100 border-r border-border last:border-r-0",
                statusFilter === tab.value
                  ? "bg-foreground text-background font-medium"
                  : "text-text-tertiary hover:text-foreground hover:bg-muted/40",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {someSelected && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-foreground transition-colors"
          >
            <X className="size-3" />
            Clear {selectedIds.size} selected
          </button>
        )}
      </div>

      {/* Table */}
      <div className="px-8 py-5">
        <div className="border border-border overflow-hidden" style={{ borderRadius: "2px" }}>
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border">
            <div className="flex items-center justify-center w-4 shrink-0">
              <button
                onClick={toggleAll}
                className={cn(
                  "flex items-center justify-center size-4 border transition-colors",
                  allSelected
                    ? "bg-foreground border-foreground text-background"
                    : "border-border hover:border-foreground/40 bg-background",
                )}
                style={{ borderRadius: "2px" }}
                aria-label="Select all"
              >
                {allSelected && <Check className="size-2.5" strokeWidth={3} />}
              </button>
            </div>
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary flex-1">
              Pull Request
            </span>
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary w-[140px] hidden md:block">
              Repository
            </span>
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary w-[100px] hidden lg:block">
              Target
            </span>
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary w-[70px] text-right">
              Status
            </span>
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary w-[52px] text-right hidden sm:block">
              Updated
            </span>
          </div>

          {/* Rows */}
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 animate-pulse"
              >
                <div className="size-4 bg-muted shrink-0" style={{ borderRadius: "2px" }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted w-2/3" style={{ borderRadius: "2px" }} />
                  <div className="h-2.5 bg-muted/60 w-1/3" style={{ borderRadius: "2px" }} />
                </div>
                <div className="h-3 w-[120px] bg-muted hidden md:block" style={{ borderRadius: "2px" }} />
                <div className="h-3 w-[80px] bg-muted hidden lg:block" style={{ borderRadius: "2px" }} />
                <div className="h-4 w-[60px] bg-muted" style={{ borderRadius: "1px" }} />
                <div className="h-2.5 w-[40px] bg-muted hidden sm:block" style={{ borderRadius: "2px" }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-4 flex size-10 items-center justify-center border border-border bg-muted/40"
                style={{ borderRadius: "4px" }}
              >
                <GitPullRequest className="size-4 text-text-tertiary" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-medium text-foreground mb-1">
                {pullRequests.length === 0 ? "No pull requests yet" : "No matching pull requests"}
              </p>
              <p className="text-[12px] text-muted-foreground max-w-[280px] leading-relaxed">
                {pullRequests.length === 0
                  ? "Connect a GitHub repository and open a PR to see it here."
                  : "Try adjusting your filters or search query."}
              </p>
              {(search || branchFilter !== "all") && (
                <button
                  className="mt-4 text-[11px] text-text-tertiary hover:text-foreground underline underline-offset-2"
                  onClick={() => { setSearch(""); setBranchFilter("all"); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filtered.map((pr) => {
              const prStatus = derivePrStatus(pr.status, pr.mergedAt);
              const isSelected = selectedIds.has(pr.publicId);
              return (
                <div
                  key={pr.publicId}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors duration-100 cursor-pointer",
                    isSelected
                      ? "bg-primary/4 border-l-2 border-l-primary"
                      : "hover:bg-muted/30",
                  )}
                  onClick={() => toggleOne(pr.publicId)}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center w-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleOne(pr.publicId)}
                      className={cn(
                        "flex items-center justify-center size-4 border transition-colors",
                        isSelected
                          ? "bg-foreground border-foreground text-background"
                          : "border-border group-hover:border-foreground/40 bg-background",
                      )}
                      style={{ borderRadius: "2px" }}
                      aria-label={`Select PR: ${pr.title}`}
                    >
                      {isSelected && <Check className="size-2.5" strokeWidth={3} />}
                    </button>
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {pr.number && (
                        <span className="font-mono text-[10px] text-text-tertiary shrink-0">
                          #{pr.number}
                        </span>
                      )}
                      <p className="text-[13px] font-medium text-foreground truncate leading-snug">
                        {pr.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {pr.authorName && (
                        <span className="font-mono text-[10px] text-text-tertiary">
                          {pr.authorName}
                        </span>
                      )}
                      {pr.headBranch && (
                        <span className="font-mono text-[10px] text-text-tertiary truncate max-w-[140px] md:hidden">
                          {pr.repoName ? `${pr.repoName}` : pr.headBranch}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Repository */}
                  <div className="w-[140px] shrink-0 hidden md:flex items-center gap-1.5">
                    {pr.repoName ? (
                      <div className="min-w-0">
                        <p className="text-[12px] text-foreground truncate leading-snug">
                          {pr.repoName}
                        </p>
                        {pr.repoOwner && (
                          <p className="font-mono text-[10px] text-text-tertiary truncate">
                            {pr.repoOwner}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-tertiary">—</span>
                    )}
                    {pr.url && (
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-text-tertiary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>

                  {/* Target branch */}
                  <div className="w-[100px] shrink-0 hidden lg:block">
                    {pr.baseBranch ? (
                      <BranchChip branch={pr.baseBranch} />
                    ) : (
                      <span className="text-[11px] text-text-tertiary">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="w-[70px] shrink-0 flex justify-end">
                    <PrStatusBadge status={prStatus} />
                  </div>

                  {/* Updated */}
                  <div className="w-[52px] shrink-0 text-right hidden sm:block">
                    <span className="font-mono text-[10px] text-text-tertiary">
                      {timeAgo(pr.updatedAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Result count */}
        {!isLoading && filtered.length > 0 && (
          <p className="mt-3 font-mono text-[10px] text-text-tertiary">
            Showing {filtered.length} of {pullRequests.length} pull requests
            {someSelected && ` · ${selectedIds.size} selected`}
          </p>
        )}
      </div>

      {/* Floating create release banner when PRs selected */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-4">
          <div
            className="pointer-events-auto flex items-center gap-3 bg-foreground text-background px-5 py-3 shadow-[0_8px_32px_color-mix(in_srgb,var(--color-ink)_25%,transparent)]"
            style={{ borderRadius: "8px" }}
          >
            <AlertCircle className="size-3.5 shrink-0 opacity-60" />
            <span className="text-[13px] font-medium">
              {selectedIds.size} PR{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="h-4 w-px bg-current opacity-20" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
              onClick={() => setShowCreateDialog(true)}
            >
              <Sparkles className="size-3.5" />
              Create Release
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Create Release Dialog */}
      {showCreateDialog && (
        <CreateReleaseDialog
          selectedCount={selectedIds.size}
          projects={projects}
          onConfirm={handleCreateRelease}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
