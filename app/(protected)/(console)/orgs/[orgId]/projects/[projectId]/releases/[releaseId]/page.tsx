"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { queries, mutators } from "@deploytitan/zero-schema";
import { mergeAllReleasePacket } from "@/lib/api";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type MergeStatus =
  | "pending"
  | "checking"
  | "merging"
  | "merged"
  | "failed"
  | "blocked";

type PacketStatus = "draft" | "ready" | "merging" | "merged" | "failed";

function generateId(): string {
  return crypto.randomUUID();
}

function formatRelative(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Merge status badge ────────────────────────────────────────────────────────

const mergeStatusCfg: Record<
  MergeStatus,
  { label: string; cls: string; spin?: boolean }
> = {
  pending: {
    label: "pending",
    cls: "text-muted-foreground/50 bg-muted/50 border-border",
  },
  checking: {
    label: "checking",
    cls: "text-signal-deploy bg-signal-deploy/8 border-signal-deploy/25",
    spin: true,
  },
  merging: {
    label: "merging",
    cls: "text-signal-warning bg-signal-warning/8 border-signal-warning/25",
    spin: true,
  },
  merged: {
    label: "merged",
    cls: "text-signal-success bg-signal-success/8 border-signal-success/25",
  },
  failed: {
    label: "failed",
    cls: "text-signal-danger bg-signal-danger/8 border-signal-danger/25",
  },
  blocked: {
    label: "blocked",
    cls: "text-signal-warning bg-signal-warning/8 border-signal-warning/25",
  },
};

function MergeStatusBadge({ status }: { status: MergeStatus }) {
  const cfg = mergeStatusCfg[status] ?? mergeStatusCfg.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border",
        cfg.cls,
      )}
      style={{ borderRadius: "1px" }}
    >
      {cfg.spin ? (
        <Loader2 className="size-2 animate-spin" strokeWidth={2.5} />
      ) : (
        <Circle className="size-1.5 fill-current" strokeWidth={0} />
      )}
      {cfg.label}
    </span>
  );
}

// ── PR state badge ────────────────────────────────────────────────────────────

function StateBadge({
  state,
  draft,
}: {
  state: string | null;
  draft: boolean | null;
}) {
  if (draft)
    return (
      <span
        className="font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px text-muted-foreground/50 bg-muted/50 border border-border"
        style={{ borderRadius: "1px" }}
      >
        draft
      </span>
    );
  if (state === "open")
    return (
      <span
        className="font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px text-signal-success bg-signal-success/8 border border-signal-success/25"
        style={{ borderRadius: "1px" }}
      >
        open
      </span>
    );
  if (state === "closed")
    return (
      <span
        className="font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px text-muted-foreground/40 bg-muted/40 border border-border"
        style={{ borderRadius: "1px" }}
      >
        closed
      </span>
    );
  return null;
}

// ── Packet status badge ───────────────────────────────────────────────────────

const packetStatusCfg: Record<PacketStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "text-muted-foreground/60 bg-muted/50 border-border" },
  ready: { label: "Ready", cls: "text-signal-success bg-signal-success/8 border-signal-success/25" },
  merging: { label: "Merging", cls: "text-signal-deploy bg-signal-deploy/8 border-signal-deploy/25" },
  merged: { label: "Merged", cls: "text-signal-success bg-signal-success/8 border-signal-success/25" },
  failed: { label: "Failed", cls: "text-signal-danger bg-signal-danger/8 border-signal-danger/25" },
};

function PacketStatusBadge({ status }: { status: PacketStatus }) {
  const cfg = packetStatusCfg[status] ?? packetStatusCfg.draft;
  return (
    <span
      className={cn(
        "font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border",
        cfg.cls,
      )}
      style={{ borderRadius: "1px" }}
    >
      {cfg.label}
    </span>
  );
}

// ── Editable name ─────────────────────────────────────────────────────────────

function EditableName({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="text-[17px] font-semibold text-foreground tracking-tight leading-none bg-transparent border-b border-primary/40 outline-none pb-px min-w-0 w-full max-w-xs"
        maxLength={120}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="text-[17px] font-semibold text-foreground tracking-tight leading-none hover:text-foreground/80 transition-colors text-left group"
      title="Click to rename"
    >
      {value}
      <span className="ml-2 opacity-0 group-hover:opacity-40 text-[11px] font-normal tracking-normal">
        edit
      </span>
    </button>
  );
}

// ── Left panel: PR pool ───────────────────────────────────────────────────────

type PR = {
  id: string;
  prNumber: number;
  title: string | null;
  sourceBranch: string | null;
  targetBranch: string | null;
  state: string | null;
  draft: boolean | null;
  authorLogin: string | null;
  htmlUrl: string | null;
  mergeStatus: MergeStatus;
  repoId: string;
  headSha: string;
  installationId: number | null;
  updatedAt: number | null;
};

function PRPoolPanel({
  allPRs,
  packetPrIds,
  loading,
  onAdd,
}: {
  allPRs: PR[];
  packetPrIds: Set<string>;
  loading: boolean;
  onAdd: (pr: PR) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allPRs.filter(
      (pr) =>
        !packetPrIds.has(pr.id) &&
        (!q ||
          pr.title?.toLowerCase().includes(q) ||
          String(pr.prNumber).includes(q) ||
          pr.sourceBranch?.toLowerCase().includes(q)),
    );
  }, [allPRs, packetPrIds, search]);

  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50 mb-2">
          PR Pool
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PRs..."
            className={cn(
              "w-full pl-7 pr-3 py-1.5 text-[12px] text-foreground bg-muted/40",
              "border border-border focus:border-primary/40 outline-none",
              "placeholder:text-muted-foreground/35 transition-colors duration-100",
            )}
            style={{ borderRadius: "2px" }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-1.5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[48px] bg-muted/40 animate-pulse"
                style={{ borderRadius: "2px", opacity: 1 - i * 0.2 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4">
            <p className="text-[11px] text-muted-foreground/40 text-center">
              {search ? "No matching PRs" : "All project PRs are in the packet"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((pr) => (
              <button
                key={pr.id}
                onClick={() => onAdd(pr)}
                className="w-full text-left group flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/50 border border-transparent hover:border-border transition-colors duration-100"
                style={{ borderRadius: "2px" }}
              >
                <GitPullRequest
                  className="size-3.5 shrink-0 text-muted-foreground/40 mt-0.5"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-foreground truncate leading-snug font-medium">
                    {pr.title || `PR #${pr.prNumber}`}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[9px] text-muted-foreground/50 tracking-[0.04em]">
                      #{pr.prNumber}
                    </span>
                    {pr.sourceBranch && (
                      <span className="font-mono text-[9px] text-muted-foreground/40 tracking-[0.04em] truncate">
                        {pr.sourceBranch}
                      </span>
                    )}
                  </div>
                </div>
                <Plus
                  className="size-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors duration-100 mt-0.5"
                  strokeWidth={2}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Center panel: packet PR list ──────────────────────────────────────────────

type PacketPrRow = {
  packetPrId: string;
  pr: PR;
};

function PRRow({
  entry,
  index,
  onRemove,
  isSelected,
  onClick,
}: {
  entry: PacketPrRow;
  index: number;
  onRemove: () => void;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { pr } = entry;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors duration-100",
        isSelected
          ? "bg-primary/4 border-l-[2px] border-l-primary/30"
          : "hover:bg-muted/40",
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        <span className="font-mono text-[9px] text-muted-foreground/35 leading-none">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-medium text-foreground truncate leading-snug">
            {pr.title || `PR #${pr.prNumber}`}
          </p>
          <StateBadge state={pr.state} draft={pr.draft} />
          {pr.mergeStatus !== "pending" && (
            <MergeStatusBadge status={pr.mergeStatus} />
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-1">
          <span className="font-mono text-[9px] tracking-[0.04em] text-muted-foreground/50">
            #{pr.prNumber}
          </span>
          {pr.sourceBranch && (
            <span className="flex items-center gap-1 font-mono text-[9px] tracking-[0.04em] text-muted-foreground/40">
              <GitBranch className="size-2.5" strokeWidth={1.75} />
              {pr.sourceBranch}
            </span>
          )}
          {pr.authorLogin && (
            <span className="font-mono text-[9px] text-muted-foreground/35 tracking-[0.04em]">
              {pr.authorLogin}
            </span>
          )}
        </div>
        {pr.htmlUrl && (
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground/35 hover:text-primary transition-colors mt-0.5"
          >
            View on GitHub
            <ExternalLink className="size-2.5" strokeWidth={1.75} />
          </a>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 p-1 text-muted-foreground/30 hover:text-signal-danger transition-colors duration-100 opacity-0 group-hover:opacity-100"
        aria-label="Remove from packet"
      >
        <X className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ── Right panel: dependency editor ────────────────────────────────────────────

function DependencyPanel({
  selectedEntry,
  allEntries,
  deps,
  onAddDep,
  onRemoveDep,
  releasePacketId,
}: {
  selectedEntry: PacketPrRow | null;
  allEntries: PacketPrRow[];
  deps: Array<{ id: string; dependentPrId: string; prerequisitePrId: string }>;
  onAddDep: (dependentPrId: string, prerequisitePrId: string) => void;
  onRemoveDep: (id: string) => void;
  releasePacketId: string;
}) {
  if (!selectedEntry) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div
          className="mb-3 flex size-8 items-center justify-center border border-border bg-muted/60"
          style={{ borderRadius: "4px" }}
        >
          <GitMerge
            className="size-4 text-muted-foreground/40"
            strokeWidth={1.5}
          />
        </div>
        <p className="text-[12px] text-muted-foreground/50 leading-relaxed">
          Select a PR from the packet to configure its dependencies
        </p>
      </div>
    );
  }

  const { pr } = selectedEntry;
  const prerequisites = deps
    .filter((d) => d.dependentPrId === pr.id)
    .map((d) => d.prerequisitePrId);
  const prerequisiteSet = new Set(prerequisites);

  const eligible = allEntries.filter(
    (e) => e.pr.id !== pr.id && !prerequisiteSet.has(e.pr.id),
  );

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50 mb-1.5">
          Dependencies
        </p>
        <p className="text-[12px] text-foreground font-medium truncate">
          {pr.title || `PR #${pr.prNumber}`}
        </p>
        <p className="font-mono text-[9px] text-muted-foreground/40 mt-0.5">
          must wait for:
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Current prerequisites */}
        {prerequisites.length > 0 && (
          <div className="p-3 space-y-1.5">
            {prerequisites.map((prereqId) => {
              const dep = deps.find(
                (d) =>
                  d.dependentPrId === pr.id && d.prerequisitePrId === prereqId,
              );
              const entry = allEntries.find((e) => e.pr.id === prereqId);
              if (!entry || !dep) return null;
              return (
                <div
                  key={prereqId}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border"
                  style={{ borderRadius: "2px" }}
                >
                  <CheckCircle2
                    className="size-3 shrink-0 text-signal-success/60"
                    strokeWidth={2}
                  />
                  <span className="text-[11px] text-foreground font-medium min-w-0 flex-1 truncate">
                    #{entry.pr.prNumber} {entry.pr.title}
                  </span>
                  <button
                    onClick={() => onRemoveDep(dep.id)}
                    className="shrink-0 text-muted-foreground/30 hover:text-signal-danger transition-colors"
                    aria-label="Remove dependency"
                  >
                    <Minus className="size-3" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Addable prerequisites */}
        {eligible.length > 0 && (
          <div className="px-3 pb-3 space-y-1">
            <p className="font-mono text-[8px] tracking-[0.06em] uppercase text-muted-foreground/35 px-0 py-1.5">
              Add prerequisite
            </p>
            {eligible.map((e) => (
              <button
                key={e.pr.id}
                onClick={() => onAddDep(pr.id, e.pr.id)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-muted/50 border border-transparent hover:border-border transition-colors duration-100"
                style={{ borderRadius: "2px" }}
              >
                <Plus
                  className="size-3 shrink-0 text-muted-foreground/30"
                  strokeWidth={2}
                />
                <span className="text-[11px] text-foreground/70 min-w-0 flex-1 truncate">
                  #{e.pr.prNumber} {e.pr.title}
                </span>
              </button>
            ))}
          </div>
        )}

        {prerequisites.length === 0 && eligible.length === 0 && (
          <div className="flex items-center justify-center h-20 px-4">
            <p className="text-[11px] text-muted-foreground/40 text-center">
              No other PRs in the packet
            </p>
          </div>
        )}

        {prerequisites.length === 0 && eligible.length > 0 && (
          <div className="px-4 pb-2">
            <p className="text-[11px] text-muted-foreground/40">
              No prerequisites — this PR can merge immediately.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DAG visual view ───────────────────────────────────────────────────────────

function DAGView({
  entries,
  deps,
}: {
  entries: PacketPrRow[];
  deps: Array<{ dependentPrId: string; prerequisitePrId: string }>;
}) {
  // Build topological levels
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const e of entries) {
    inDegree.set(e.pr.id, 0);
    graph.set(e.pr.id, []);
  }
  for (const { dependentPrId, prerequisitePrId } of deps) {
    if (!inDegree.has(dependentPrId) || !inDegree.has(prerequisitePrId))
      continue;
    graph.get(prerequisitePrId)!.push(dependentPrId);
    inDegree.set(dependentPrId, (inDegree.get(dependentPrId) ?? 0) + 1);
  }

  const levels: string[][] = [];
  let queue = entries
    .map((e) => e.pr.id)
    .filter((id) => (inDegree.get(id) ?? 0) === 0);
  const placed = new Set<string>();

  while (queue.length > 0) {
    levels.push(queue);
    queue.forEach((id) => placed.add(id));
    const next: string[] = [];
    for (const id of queue) {
      for (const neighbor of graph.get(id) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0 && !placed.has(neighbor)) next.push(neighbor);
      }
    }
    queue = next;
  }

  // Leftover (cycle nodes) go in a final level
  const remaining = entries
    .map((e) => e.pr.id)
    .filter((id) => !placed.has(id));
  if (remaining.length > 0) levels.push(remaining);

  const entryMap = new Map(entries.map((e) => [e.pr.id, e]));

  return (
    <div className="flex gap-0 overflow-x-auto">
      {levels.map((level, li) => (
        <div key={li} className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-4 mb-1">
            <div
              className="w-5 h-5 flex items-center justify-center bg-muted/60 border border-border"
              style={{ borderRadius: "2px" }}
            >
              <span className="font-mono text-[8px] text-muted-foreground/50">
                {li + 1}
              </span>
            </div>
            <span className="font-mono text-[8px] uppercase tracking-[0.06em] text-muted-foreground/40">
              Wave {li + 1}
            </span>
          </div>

          <div className="flex flex-col gap-2 px-4 pb-4">
            {level.map((id) => {
              const e = entryMap.get(id);
              if (!e) return null;
              return (
                <div
                  key={id}
                  className="w-[200px] border border-border bg-background px-3 py-2.5"
                  style={{ borderRadius: "4px" }}
                >
                  <p className="font-mono text-[9px] text-muted-foreground/50 tracking-[0.04em]">
                    #{e.pr.prNumber}
                  </p>
                  <p className="text-[11px] text-foreground font-medium leading-snug mt-0.5 line-clamp-2">
                    {e.pr.title || `PR #${e.pr.prNumber}`}
                  </p>
                  <div className="mt-1.5">
                    <MergeStatusBadge status={e.pr.mergeStatus} />
                  </div>
                </div>
              );
            })}
          </div>

          {li < levels.length - 1 && (
            <div className="absolute" style={{ display: "none" }} />
          )}
        </div>
      ))}

      {/* Connector arrows between levels (SVG) */}
    </div>
  );
}

// ── Merge all log ─────────────────────────────────────────────────────────────

function MergeLog({
  jobs,
  entries,
}: {
  jobs: Array<{ pullRequestId: string; prNumber: number; jobId: string }>;
  entries: PacketPrRow[];
}) {
  const entryMap = new Map(entries.map((e) => [e.pr.id, e]));

  return (
    <div className="mt-4 border border-border bg-muted/20" style={{ borderRadius: "4px" }}>
      <div className="px-4 py-2.5 border-b border-border">
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50">
          Merge queue — {jobs.length} PRs queued
        </p>
      </div>
      <div className="divide-y divide-border">
        {jobs.map((job, i) => {
          const entry = entryMap.get(job.pullRequestId);
          const pr = entry?.pr;
          return (
            <div key={job.pullRequestId} className="flex items-center gap-3 px-4 py-2.5">
              <span className="font-mono text-[9px] text-muted-foreground/35 w-4 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <MergeStatusBadge status={pr?.mergeStatus ?? "pending"} />
              <span className="text-[12px] text-foreground min-w-0 flex-1 truncate">
                {pr?.title || `PR #${job.prNumber}`}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/40 shrink-0">
                #{job.prNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const z = useZero();

  const orgId = params?.orgId as string;
  const projectPublicId = params?.projectId as string;
  const releaseId = params?.releaseId as string;

  // Data queries
  const [project] = useQuery(
    queries.projectByPublicId({ publicId: projectPublicId }),
  );

  const [packet] = useQuery(
    queries.releasePacketById({ id: releaseId }),
  );

  const [packetPrRows, packetPrsStatus] = useQuery(
    queries.releasePacketPrsByPacketId({ releasePacketId: releaseId }),
  );

  // Load all deps for this project, then filter client-side to packet members.
  // prDependencies is project-scoped; packet membership is the filter.
  const [allProjectDeps] = useQuery(
    queries.prDependenciesByProjectId({ projectId: project?.id ?? "" }),
  );

  const [allProjectPRs, prsStatus] = useQuery(
    queries.pullRequestsByProjectId({ projectId: project?.id ?? "" }),
  );

  // Local state
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "dag">("edit");
  const [mergeLog, setMergeLog] = useState<
    Array<{ pullRequestId: string; prNumber: number; jobId: string }> | null
  >(null);

  // Build a lookup from pullRequestId -> PR data
  const prMap = useMemo(() => {
    const m = new Map<string, (typeof allProjectPRs)[number]>();
    for (const pr of allProjectPRs) m.set(pr.id, pr);
    return m;
  }, [allProjectPRs]);

  // Build packet entries (ordered by position)
  const packetEntries = useMemo((): PacketPrRow[] => {
    return [...packetPrRows]
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((row) => {
        const pr = prMap.get(row.pullRequestId);
        if (!pr) return null;
        return {
          packetPrId: row.id,
          pr: {
            id: pr.id,
            prNumber: pr.prNumber,
            title: pr.title,
            sourceBranch: pr.sourceBranch,
            targetBranch: pr.targetBranch,
            state: pr.state,
            draft: pr.draft,
            authorLogin: pr.authorLogin,
            htmlUrl: pr.htmlUrl,
            mergeStatus: (pr.mergeStatus ?? "pending") as MergeStatus,
            repoId: pr.repoId,
            headSha: pr.headSha,
            installationId: pr.installationId ?? null,
            updatedAt: pr.updatedAt ?? null,
          },
        };
      })
      .filter((e): e is PacketPrRow => e !== null);
  }, [packetPrRows, prMap]);

  const packetPrIds = useMemo(
    () => new Set(packetEntries.map((e) => e.pr.id)),
    [packetEntries],
  );

  const poolPRs = useMemo((): PR[] => {
    return allProjectPRs
      .filter((pr) => !packetPrIds.has(pr.id))
      .map((pr) => ({
        id: pr.id,
        prNumber: pr.prNumber,
        title: pr.title,
        sourceBranch: pr.sourceBranch,
        targetBranch: pr.targetBranch,
        state: pr.state,
        draft: pr.draft,
        authorLogin: pr.authorLogin,
        htmlUrl: pr.htmlUrl,
        mergeStatus: (pr.mergeStatus ?? "pending") as MergeStatus,
        repoId: pr.repoId,
        headSha: pr.headSha,
        installationId: pr.installationId ?? null,
        updatedAt: pr.updatedAt ?? null,
      }));
  }, [allProjectPRs, packetPrIds]);

  const selectedEntry = useMemo(
    () => packetEntries.find((e) => e.pr.id === selectedPrId) ?? null,
    [packetEntries, selectedPrId],
  );

  // Filter project deps to only those where both ends are in this packet.
  const deps = useMemo(() => {
    return allProjectDeps
      .filter(
        (d) => packetPrIds.has(d.dependentPrId) && packetPrIds.has(d.prerequisitePrId),
      )
      .map((d) => ({
        id: d.id,
        dependentPrId: d.dependentPrId,
        prerequisitePrId: d.prerequisitePrId,
      }));
  }, [allProjectDeps, packetPrIds]);

  // Mutations
  async function handleAddPR(pr: PR) {
    await z.mutate(mutators.releasePacketPr.add({
      id: generateId(),
      releasePacketId: releaseId,
      pullRequestId: pr.id,
    })).client;
  }

  async function handleRemovePR(packetPrId: string, prId: string) {
    if (selectedPrId === prId) setSelectedPrId(null);
    await z.mutate(mutators.releasePacketPr.remove({ id: packetPrId })).client;
    // Also remove any dependencies involving this PR
    for (const dep of deps) {
      if (dep.dependentPrId === prId || dep.prerequisitePrId === prId) {
        await z.mutate(mutators.prDependency.remove({ id: dep.id })).client;
      }
    }
  }

  async function handleAddDep(dependentPrId: string, prerequisitePrId: string) {
    const dependentEntry = packetEntries.find((e) => e.pr.id === dependentPrId);
    const prerequisiteEntry = packetEntries.find((e) => e.pr.id === prerequisitePrId);
    if (!dependentEntry || !prerequisiteEntry || !project) return;
    await z.mutate(mutators.prDependency.add({
      id: generateId(),
      publicId: `prd_${Math.random().toString(36).slice(2, 18)}`,
      projectId: project.id,
      dependentPrId,
      prerequisitePrId,
      dependentPrNumber: dependentEntry.pr.prNumber,
      prerequisitePrNumber: prerequisiteEntry.pr.prNumber,
      source: "ui",
      waitForDeploy: false,
    })).client;
  }

  async function handleRemoveDep(id: string) {
    await z.mutate(mutators.prDependency.remove({ id })).client;
  }

  async function handleRename(name: string) {
    await z.mutate(mutators.releasePacket.update({ id: releaseId, name })).client;
  }

  async function handleStatusChange(status: PacketStatus) {
    await z.mutate(mutators.releasePacket.update({ id: releaseId, status })).client;
  }

  // Merge all mutation
  const mergeAllMutation = useMutation({
    mutationFn: () => mergeAllReleasePacket(releaseId),
    onSuccess: (res) => {
      setMergeLog(res.data.jobs);
    },
  });

  const isMerging =
    mergeAllMutation.isPending || packet?.status === "merging";
  const isMerged = packet?.status === "merged";
  const canMerge = packetEntries.length > 0 && !isMerging && !isMerged;

  if (!packet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 size-10 bg-muted/60 animate-pulse"
            style={{ borderRadius: "4px" }}
          />
          <p className="text-[13px] text-muted-foreground/50">
            Loading packet...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Back */}
          <button
            onClick={() =>
              router.push(`/orgs/${orgId}/projects/${projectPublicId}/releases`)
            }
            className="shrink-0 flex items-center gap-1.5 text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors duration-100"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} />
            Releases
          </button>

          <div className="w-px h-4 bg-border" />

          {/* Name + status */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <EditableName value={packet.name} onSave={handleRename} />
            <PacketStatusBadge status={packet.status as PacketStatus} />
          </div>

          {/* View toggle */}
          <div
            className="flex border border-border overflow-hidden shrink-0"
            style={{ borderRadius: "2px" }}
          >
            <button
              onClick={() => setViewMode("edit")}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium transition-colors duration-100",
                viewMode === "edit"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
              )}
            >
              Edit
            </button>
            <button
              onClick={() => setViewMode("dag")}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium transition-colors duration-100 border-l border-border",
                viewMode === "dag"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50",
              )}
            >
              DAG
            </button>
          </div>

          {/* Status control */}
          {packet.status === "draft" && (
            <button
              onClick={() => handleStatusChange("ready")}
              className="shrink-0 text-[11px] text-signal-success hover:text-signal-success/80 transition-colors font-medium"
            >
              Mark ready
            </button>
          )}

          {/* Merge all CTA */}
          <Button
            size="sm"
            disabled={!canMerge}
            onClick={() => mergeAllMutation.mutate()}
            className={cn(
              "shrink-0",
              isMerging && "opacity-70 cursor-not-allowed",
            )}
          >
            {isMerging ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Merging...
              </>
            ) : isMerged ? (
              <>
                <CheckCircle2 className="size-3.5" />
                Merged
              </>
            ) : (
              <>
                <GitMerge className="size-3.5" />
                Merge All ({packetEntries.length})
              </>
            )}
          </Button>
        </div>

        {/* Error banner */}
        {mergeAllMutation.isError && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-signal-danger/5 border border-signal-danger/20" style={{ borderRadius: "2px" }}>
            <AlertTriangle className="size-3.5 shrink-0 text-signal-danger" strokeWidth={1.75} />
            <p className="text-[12px] text-signal-danger">
              {mergeAllMutation.error instanceof Error
                ? mergeAllMutation.error.message
                : "Merge failed. Check individual PR statuses."}
            </p>
          </div>
        )}
      </div>

      {/* DAG view */}
      {viewMode === "dag" ? (
        <div className="flex-1 overflow-auto p-6">
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50 mb-4">
            Merge order — read-only view
          </p>
          {packetEntries.length === 0 ? (
            <div
              className="flex items-center justify-center py-16 border border-border border-dashed"
              style={{ borderRadius: "4px" }}
            >
              <p className="text-[12px] text-muted-foreground/40">
                Add PRs in the Edit view to see the merge graph
              </p>
            </div>
          ) : (
            <DAGView entries={packetEntries} deps={deps} />
          )}

          {mergeLog && (
            <MergeLog jobs={mergeLog} entries={packetEntries} />
          )}
        </div>
      ) : (
        /* Edit view: three-panel */
        <div
          className="flex-1 grid overflow-hidden"
          style={{ gridTemplateColumns: "260px 1fr 280px" }}
        >
          {/* Left: PR pool */}
          <PRPoolPanel
            allPRs={poolPRs}
            packetPrIds={packetPrIds}
            loading={prsStatus.type === "unknown"}
            onAdd={handleAddPR}
          />

          {/* Center: packet PR list */}
          <div className="flex flex-col overflow-hidden">
            <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between">
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50">
                In this packet
                {packetEntries.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground/35">
                    {packetEntries.length}
                  </span>
                )}
              </p>
              {packetEntries.length > 0 && (
                <p className="font-mono text-[9px] text-muted-foreground/35">
                  Click a PR to set dependencies
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {packetPrsStatus.type === "unknown" ? (
                <div className="p-4 space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-[72px] bg-muted/40 animate-pulse"
                      style={{ borderRadius: "2px", opacity: 1 - i * 0.2 }}
                    />
                  ))}
                </div>
              ) : packetEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full pb-16 px-6 text-center">
                  <GitPullRequest
                    className="size-6 text-muted-foreground/25 mb-3"
                    strokeWidth={1.5}
                  />
                  <p className="text-[13px] font-medium text-foreground/60 mb-1">
                    No PRs in this packet
                  </p>
                  <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
                    Add PRs from the pool on the left
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {packetEntries.map((entry, i) => (
                    <PRRow
                      key={entry.packetPrId}
                      entry={entry}
                      index={i}
                      onRemove={() => handleRemovePR(entry.packetPrId, entry.pr.id)}
                      isSelected={selectedPrId === entry.pr.id}
                      onClick={() =>
                        setSelectedPrId(
                          selectedPrId === entry.pr.id ? null : entry.pr.id,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Merge log */}
            {mergeLog && (
              <div className="shrink-0 border-t border-border p-4 max-h-48 overflow-y-auto">
                <MergeLog jobs={mergeLog} entries={packetEntries} />
              </div>
            )}
          </div>

          {/* Right: dependency editor */}
          <DependencyPanel
            selectedEntry={selectedEntry}
            allEntries={packetEntries}
            deps={deps}
            onAddDep={handleAddDep}
            onRemoveDep={handleRemoveDep}
            releasePacketId={releaseId}
          />
        </div>
      )}
    </div>
  );
}
