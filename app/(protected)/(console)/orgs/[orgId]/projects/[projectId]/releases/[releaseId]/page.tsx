"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { mutators, queries } from "@deploytitan/zero-schema";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  type ElementType,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mergeAllReleasePacket, mergePullRequest } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

type MergeStatus =
  | "pending"
  | "checking"
  | "merging"
  | "merged"
  | "failed"
  | "blocked";
type PacketStatus = "draft" | "ready" | "merging" | "merged" | "failed";
type ReleaseItemKind =
  | "feature"
  | "bug"
  | "performance"
  | "infrastructure"
  | "operations";
type ReleaseItemStatus = "planning" | "review" | "approved";
type PacketParticipantRole = "stakeholder" | "team_lead" | "qa";

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

type PacketPrRow = { packetPrId: string; pr: PR };

type PacketPerson = {
  id: string;
  userId: string;
  email: string;
  role: PacketParticipantRole;
  approvalStatus: "pending" | "approved";
  approvedAt: number | null;
};

type ReleaseItem = {
  id: string;
  publicId: string | null;
  title: string;
  kind: ReleaseItemKind;
  summary: string;
  impact: string;
  prIds: string[];
  status: ReleaseItemStatus;
};

// ── Metadata maps ──────────────────────────────────────────────────────────────

const ITEM_KIND_META: Record<
  ReleaseItemKind,
  { label: string; badge: string; accent: string }
> = {
  feature: {
    label: "Feature",
    badge:
      "text-signal-deploy-text bg-signal-deploy/10 border-signal-deploy/25",
    accent: "text-signal-deploy-text",
  },
  bug: {
    label: "Bug fix",
    badge:
      "text-signal-danger-text bg-signal-danger/10 border-signal-danger/20",
    accent: "text-signal-danger-text",
  },
  performance: {
    label: "Performance",
    badge:
      "text-signal-success-text bg-signal-success/10 border-signal-success/25",
    accent: "text-signal-success-text",
  },
  infrastructure: {
    label: "Infrastructure",
    badge: "text-primary-accessible bg-primary/10 border-primary/20",
    accent: "text-primary-accessible",
  },
  operations: {
    label: "Operations",
    badge: "text-text-tertiary bg-muted/70 border-border",
    accent: "text-text-tertiary",
  },
};

const ITEM_STATUS_META: Record<
  ReleaseItemStatus,
  { label: string; cls: string }
> = {
  planning: {
    label: "Planning",
    cls: "text-signal-warning-text bg-signal-warning/10 border-signal-warning/25",
  },
  review: {
    label: "In review",
    cls: "text-signal-deploy-text bg-signal-deploy/10 border-signal-deploy/25",
  },
  approved: {
    label: "Approved",
    cls: "text-signal-success-text bg-signal-success/10 border-signal-success/25",
  },
};

const PACKET_STATUS_META: Record<PacketStatus, { label: string; cls: string }> =
  {
    draft: {
      label: "Draft",
      cls: "text-text-tertiary bg-muted/70 border-border",
    },
    ready: {
      label: "Ready",
      cls: "text-signal-success-text bg-signal-success/10 border-signal-success/25",
    },
    merging: {
      label: "Merging",
      cls: "text-signal-deploy-text bg-signal-deploy/10 border-signal-deploy/25",
    },
    merged: {
      label: "Merged",
      cls: "text-signal-success-text bg-signal-success/10 border-signal-success/25",
    },
    failed: {
      label: "Failed",
      cls: "text-signal-danger-text bg-signal-danger/10 border-signal-danger/20",
    },
  };

const MERGE_STATUS_META: Record<
  MergeStatus,
  { label: string; cls: string; spin?: boolean }
> = {
  pending: {
    label: "Pending",
    cls: "text-text-tertiary bg-muted/70 border-border",
  },
  checking: {
    label: "Checking",
    cls: "text-signal-deploy-text bg-signal-deploy/10 border-signal-deploy/25",
    spin: true,
  },
  merging: {
    label: "Merging",
    cls: "text-signal-warning-text bg-signal-warning/10 border-signal-warning/25",
    spin: true,
  },
  merged: {
    label: "Merged",
    cls: "text-signal-success-text bg-signal-success/10 border-signal-success/25",
  },
  failed: {
    label: "Failed",
    cls: "text-signal-danger-text bg-signal-danger/10 border-signal-danger/20",
  },
  blocked: {
    label: "Blocked",
    cls: "text-signal-warning-text bg-signal-warning/10 border-signal-warning/25",
  },
};

const TEMPLATE_ITEMS: Array<
  Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">
> = [
  {
    kind: "feature",
    title: "Customer-facing launch",
    summary:
      "Group the changes customers and internal stakeholders should understand first.",
    impact:
      "Describe what changes, who notices, and what success looks like after deploy.",
  },
  {
    kind: "bug",
    title: "Quality and bug fixes",
    summary:
      "Collect regressions, fixes, and cleanup work that reduces release risk.",
    impact: "Call out what breaks today and how this release resolves it.",
  },
  {
    kind: "performance",
    title: "Performance improvements",
    summary:
      "Track latency wins, reliability improvements, and scaling work worth announcing.",
    impact: "Translate infra wins into customer or business outcomes.",
  },
  {
    kind: "infrastructure",
    title: "Platform and rollout work",
    summary:
      "Bundle operational changes, migrations, and sequencing that support the launch.",
    impact: "Document dependencies, coordination, and checks before rollout.",
  },
];

// ── Utilities ──────────────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID();
}

function formatRelative(ts: number | null) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(ts: number | null) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function displayNameFromEmail(email: string) {
  const [localPart] = email.split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}

function roleLabel(role: PacketParticipantRole) {
  if (role === "team_lead") return "Team lead";
  if (role === "qa") return "QA";
  return "Stakeholder";
}

function packetStatus(status: string | null): PacketStatus {
  if (
    status === "draft" ||
    status === "ready" ||
    status === "merging" ||
    status === "merged" ||
    status === "failed"
  )
    return status;
  return "draft";
}

function packetTopologicalWaves(
  entries: PacketPrRow[],
  deps: Array<{ dependentPrId: string; prerequisitePrId: string }>,
) {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  for (const e of entries) {
    inDegree.set(e.pr.id, 0);
    graph.set(e.pr.id, []);
  }
  for (const dep of deps) {
    if (!inDegree.has(dep.dependentPrId) || !inDegree.has(dep.prerequisitePrId))
      continue;
    graph.get(dep.prerequisitePrId)?.push(dep.dependentPrId);
    inDegree.set(dep.dependentPrId, (inDegree.get(dep.dependentPrId) ?? 0) + 1);
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
  const remaining = entries.map((e) => e.pr.id).filter((id) => !placed.has(id));
  if (remaining.length > 0) levels.push(remaining);
  const em = new Map(entries.map((e) => [e.pr.id, e]));
  return levels.map((level) =>
    level.map((id) => em.get(id)).filter((e): e is PacketPrRow => Boolean(e)),
  );
}

// ── Tiny shared UI ─────────────────────────────────────────────────────────────

function Eyebrow({
  icon: Icon,
  children,
}: {
  icon: ElementType;
  children: string;
}) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
      <Icon className="size-3" strokeWidth={1.75} />
      {children}
    </p>
  );
}

function KindBadge({ kind }: { kind: ReleaseItemKind }) {
  const m = ITEM_KIND_META[kind];
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] rounded-sm",
        m.badge,
      )}
    >
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ReleaseItemStatus }) {
  const m = ITEM_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] rounded-sm",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

function PacketBadge({ status }: { status: PacketStatus }) {
  const m = PACKET_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] rounded-sm",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

function MergeStatusBadge({ status }: { status: MergeStatus }) {
  const m = MERGE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] rounded-sm",
        m.cls,
      )}
    >
      {m.spin ? (
        <Loader2 className="size-2 animate-spin" strokeWidth={2.5} />
      ) : (
        <Circle className="size-1.5 fill-current" strokeWidth={0} />
      )}
      {m.label}
    </span>
  );
}

function StateBadge({
  state,
  draft,
}: {
  state: string | null;
  draft: boolean | null;
}) {
  if (draft)
    return (
      <span className="border border-border bg-muted/70 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] text-text-tertiary rounded-sm">
        Draft
      </span>
    );
  if (state === "open")
    return (
      <span className="border border-signal-success/25 bg-signal-success/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] text-signal-success-text rounded-sm">
        Open
      </span>
    );
  if (state === "closed")
    return (
      <span className="border border-border bg-muted/70 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] text-text-tertiary rounded-sm">
        Closed
      </span>
    );
  return null;
}

// ── Inline editing ─────────────────────────────────────────────────────────────

function InlineTitle({
  value,
  onSave,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  function commit() {
    const t = draft.trim();
    if (t && t !== value) onSave(t);
    setEditing(false);
  }

  if (!editing) {
    return (
      <h1
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "cursor-text rounded-md px-1 -mx-1 hover:bg-muted/40 transition-colors text-[20px] font-semibold tracking-tight text-foreground",
          className,
        )}
        title="Click to rename"
      >
        {value}
      </h1>
    );
  }

  return (
    <input
      ref={ref}
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
      className={cn(
        "w-full bg-transparent text-[20px] font-semibold tracking-tight text-foreground outline-none border-b-2 border-primary/50 pb-px",
        className,
      )}
      maxLength={120}
    />
  );
}

function InlineText({
  value,
  onSave,
  placeholder = "Click to edit",
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  function commit() {
    const t = draft.trim();
    if (t !== value) onSave(t);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "cursor-text rounded px-1 -mx-1 hover:bg-muted/40 transition-colors",
          !value && "text-muted-foreground italic",
          className,
        )}
      >
        {value || placeholder}
      </span>
    );
  }

  return (
    <input
      ref={ref}
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
      className={cn(
        "w-full bg-transparent outline-none border-b border-primary/40 pb-px",
        className,
      )}
      maxLength={200}
    />
  );
}

function InlineArea({
  value,
  onSave,
  placeholder = "Click to add",
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "cursor-text rounded-lg px-3 py-2.5 -mx-3 hover:bg-muted/30 transition-colors whitespace-pre-wrap text-[13px] leading-relaxed",
          !value && "text-muted-foreground italic",
          className,
        )}
      >
        {value || placeholder}
      </div>
    );
  }

  return (
    <textarea
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value) onSave(draft.trim());
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn(
        "w-full min-h-[100px] resize-y rounded-lg border border-primary/30 bg-muted/10 px-3 py-2.5 -mx-3 text-[13px] leading-relaxed text-foreground outline-none focus:border-primary/50 focus:bg-muted/20 transition-colors",
        className,
      )}
    />
  );
}

// ── PR health helpers ──────────────────────────────────────────────────────────

type PRHealth = {
  total: number;
  merged: number;
  failed: number;
  blocked: number;
  inFlight: number;
};

function getItemHealth(
  prIds: string[],
  packetEntries: PacketPrRow[],
): PRHealth | null {
  const relevant = packetEntries.filter((e) => prIds.includes(e.pr.id));
  if (relevant.length === 0) return null;
  return {
    total: relevant.length,
    merged: relevant.filter((e) => e.pr.mergeStatus === "merged").length,
    failed: relevant.filter((e) => e.pr.mergeStatus === "failed").length,
    blocked: relevant.filter((e) => e.pr.mergeStatus === "blocked").length,
    inFlight: relevant.filter(
      (e) => e.pr.mergeStatus === "merging" || e.pr.mergeStatus === "checking",
    ).length,
  };
}

function PRHealthLine({ health }: { health: PRHealth | null }) {
  if (!health) return null;
  const { total, merged, failed, blocked, inFlight } = health;
  const issues = failed + blocked;

  if (issues > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-signal-danger-text">
        <AlertTriangle className="size-3" strokeWidth={1.75} />
        {issues} PR{issues > 1 ? "s" : ""}{" "}
        {failed > 0 && blocked > 0
          ? "failed / blocked"
          : failed > 0
            ? "failed"
            : "blocked"}
      </span>
    );
  }
  if (merged === total && total > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-signal-success-text">
        <CheckCircle2 className="size-3" strokeWidth={1.75} />
        All {total} PRs merged
      </span>
    );
  }
  if (inFlight > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-signal-deploy-text">
        <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
        Merging ({merged}/{total})
      </span>
    );
  }
  const open = health ? total - merged - failed - blocked : 0;
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      {total} PR{total > 1 ? "s" : ""} · {open} open
      {merged > 0 ? ` · ${merged} merged` : ""}
    </span>
  );
}

// ── Release item row (overview list) ──────────────────────────────────────────

function ReleaseItemRow({
  item,
  health,
  onOpen,
  onDelete,
}: {
  item: ReleaseItem;
  health: PRHealth | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 bg-signal-danger/5">
        <span className="flex-1 text-[13px] text-foreground">
          Delete <span className="font-medium">{item.title}</span>?
        </span>
        <button
          onClick={onDelete}
          className="font-mono text-[10px] uppercase tracking-[0.06em] text-signal-danger-text hover:underline"
        >
          Delete
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/25 transition-colors">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 min-w-0 items-center gap-3 text-left"
      >
        <KindBadge kind={item.kind} />
        <span className="flex-1 min-w-0 text-[14px] font-medium text-foreground truncate">
          {item.title}
        </span>
        <span className="hidden sm:block shrink-0">
          <PRHealthLine health={health} />
        </span>
        <StatusBadge status={item.status} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="shrink-0 p-1.5 text-text-disabled opacity-0 group-hover:opacity-100 hover:text-signal-danger-text transition-all"
        aria-label="Delete release item"
      >
        <Trash2 className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ── Kind dropdown (used in add row and item detail) ───────────────────────────

function ItemKindDropdown({
  kind,
  onChange,
}: {
  kind: ReleaseItemKind;
  onChange: (k: ReleaseItemKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const kinds: ReleaseItemKind[] = [
    "feature",
    "bug",
    "performance",
    "infrastructure",
    "operations",
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 group"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <KindBadge kind={kind} />
        <ChevronDown
          className={cn(
            "size-2.5 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-[2px] border border-border bg-background shadow-md overflow-hidden"
        >
          {kinds.map((k) => (
            <button
              key={k}
              role="option"
              aria-selected={k === kind}
              type="button"
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/30",
                k === kind && "bg-muted/20",
              )}
            >
              <KindBadge kind={k} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add item (collapsed → picker → inline) ────────────────────────────────────

function AddItemRow({
  onCreate,
}: {
  onCreate: (
    t?: Partial<Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">>,
  ) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "picker" | "inline">("idle");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftKind, setDraftKind] = useState<ReleaseItemKind>("feature");
  const [draftTemplate, setDraftTemplate] = useState<
    (typeof TEMPLATE_ITEMS)[0] | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Commit ref avoids stale closures in the outside-click listener
  const commitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (phase === "inline") {
      // Small timeout so the input is mounted before we focus
      const t = setTimeout(() => inputRef.current?.select(), 0);
      return () => clearTimeout(t);
    }
  }, [phase]);

  function openInline(t: (typeof TEMPLATE_ITEMS)[0] | null) {
    setDraftKind(t?.kind ?? "feature");
    setDraftTitle(t?.title ?? "");
    setDraftTemplate(t);
    setPhase("inline");
  }

  function commit() {
    const title = draftTitle.trim();
    if (!title) {
      reset();
      return;
    }
    const payload: Partial<
      Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">
    > = draftTemplate
      ? {
          kind: draftKind,
          title,
          summary: draftTemplate.summary,
          impact: draftTemplate.impact,
        }
      : { kind: draftKind, title };
    onCreate(payload);
    reset();
  }

  commitRef.current = commit;

  function reset() {
    setPhase("idle");
    setDraftTitle("");
    setDraftKind("feature");
    setDraftTemplate(null);
  }

  // Save on outside click
  useEffect(() => {
    if (phase !== "inline") return;
    function onMouseDown(e: MouseEvent) {
      if (!rowRef.current?.contains(e.target as Node)) {
        commitRef.current();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [phase]);

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => setPhase("picker")}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-dashed border-border"
      >
        <Plus className="size-3.5" />
        Add release item
      </button>
    );
  }

  if (phase === "picker") {
    return (
      <div className="border-t border-border px-4 py-3 bg-muted/20">
        <div className="flex items-center justify-between mb-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            Start from a template
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-text-disabled hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_ITEMS.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => openInline(t)}
              className="flex items-center gap-2 rounded-[2px] border border-border bg-background px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              <span
                className={cn(
                  "font-mono text-[8px] uppercase tracking-[0.08em]",
                  ITEM_KIND_META[t.kind].accent,
                )}
              >
                {ITEM_KIND_META[t.kind].label}
              </span>
              <span className="text-[12px] font-medium text-foreground">
                {t.title}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => openInline(null)}
            className="flex items-center gap-2 rounded-[2px] border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <Plus className="size-3" strokeWidth={2} />
            Blank
          </button>
        </div>
      </div>
    );
  }

  // phase === "inline"
  return (
    <div
      ref={rowRef}
      className="flex items-center gap-2.5 border-t border-border px-4 py-2.5 bg-muted/5"
    >
      <ItemKindDropdown
        kind={draftKind}
        onChange={setDraftKind}
      />
      <input
        ref={inputRef}
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") reset();
        }}
        placeholder="Item title…"
        className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-foreground outline-none placeholder:text-muted-foreground border-b border-primary/40 pb-px"
        maxLength={120}
      />
      <button
        type="button"
        onClick={commit}
        disabled={!draftTitle.trim()}
        className="shrink-0 flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary-accessible hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Save item"
      >
        <Check className="size-3.5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={reset}
        className="shrink-0 text-text-disabled hover:text-foreground transition-colors"
        aria-label="Cancel"
      >
        <X className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ── Inline PR search (item detail) ─────────────────────────────────────────────

function InlinePRSearch({
  allPRs,
  itemPrIds,
  loading,
  onAdd,
}: {
  allPRs: PR[];
  itemPrIds: Set<string>;
  loading: boolean;
  onAdd: (pr: PR) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return allPRs.filter((pr) => {
      if (itemPrIds.has(pr.id)) return false;
      if (!q) return true;
      return (
        pr.title?.toLowerCase().includes(q) ||
        String(pr.prNumber).includes(q) ||
        pr.sourceBranch?.toLowerCase().includes(q)
      );
    });
  }, [allPRs, deferredSearch, itemPrIds]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/20 transition-colors"
      >
        <Plus className="size-3.5" />
        Add pull request
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PR title, number, or branch"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSearch("");
          }}
          className="text-text-disabled hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-md bg-muted/50"
                style={{ opacity: 1 - i * 0.2 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
            {search ? "No matching pull requests." : "All PRs already mapped."}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.slice(0, 15).map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => {
                  onAdd(pr);
                  setSearch("");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                <GitPullRequest
                  className="size-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-foreground">
                  {pr.title || `PR #${pr.prNumber}`}
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
                  #{pr.prNumber}
                </span>
                <Plus
                  className="size-3.5 shrink-0 text-text-disabled"
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

// ── PR row (item detail) ───────────────────────────────────────────────────────

function PRRow({
  entry,
  onRemove,
}: {
  entry: PacketPrRow;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GitPullRequest
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        strokeWidth={1.8}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">
            {entry.pr.title || `PR #${entry.pr.prNumber}`}
          </p>
          <StateBadge state={entry.pr.state} draft={entry.pr.draft} />
          {entry.pr.mergeStatus !== "pending" && (
            <MergeStatusBadge status={entry.pr.mergeStatus} />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
            #{entry.pr.prNumber}
          </span>
          {entry.pr.sourceBranch && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
              <GitBranch className="size-2.5" strokeWidth={1.8} />
              {entry.pr.sourceBranch}
            </span>
          )}
          {entry.pr.authorLogin && (
            <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
              {entry.pr.authorLogin}
            </span>
          )}
        </div>
        {entry.pr.htmlUrl && (
          <a
            href={entry.pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            View on GitHub <ExternalLink className="size-3" strokeWidth={1.8} />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-text-disabled rounded hover:text-signal-danger-text hover:bg-signal-danger/10 transition-colors"
        aria-label="Remove PR"
      >
        <Minus className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Avatar stack ──────────────────────────────────────────────────────────────

function AvatarStack({
  people,
  maxShow = 5,
}: {
  people: PacketPerson[];
  maxShow?: number;
}) {
  const shown = people.slice(0, maxShow);
  const overflow = Math.max(0, people.length - maxShow);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "flex size-7 items-center justify-center rounded-[2px] border-2 border-background font-mono text-[9px] uppercase tracking-[0.04em] transition-colors",
            p.approvalStatus === "approved"
              ? "bg-signal-success/20 text-signal-success-text"
              : "bg-primary/15 text-primary-accessible",
          )}
          style={{ marginLeft: i > 0 ? "-6px" : 0, zIndex: shown.length - i }}
          title={`${displayNameFromEmail(p.email)} — ${p.approvalStatus === "approved" ? "Approved" : "Pending"}`}
        >
          {initials(displayNameFromEmail(p.email))}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex size-7 items-center justify-center rounded-[2px] border-2 border-background bg-muted font-mono text-[9px] text-muted-foreground"
          style={{ marginLeft: "-6px", zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ── Readiness panel ───────────────────────────────────────────────────────────

function computeReadinessScore(
  items: ReleaseItem[],
  people: PacketPerson[],
  packetEntries: PacketPrRow[],
  packetState: PacketStatus,
): number {
  let score = 0;
  // Items quality: up to 40 pts
  if (items.length > 0) {
    const raw = items.reduce((acc, item) => {
      return (
        acc +
        (item.summary.trim() ? 1 : 0) +
        (item.impact.trim() ? 1 : 0) +
        (item.prIds.length > 0 ? 1 : 0)
      );
    }, 0);
    score += (raw / (items.length * 3)) * 40;
  } else {
    score += 10; // no items yet — partial credit
  }
  // Approvals: 10 pts per fully-approved role group
  const roles: PacketParticipantRole[] = ["stakeholder", "team_lead", "qa"];
  for (const role of roles) {
    const group = people.filter((p) => p.role === role);
    if (group.length > 0 && group.every((p) => p.approvalStatus === "approved"))
      score += 10;
  }
  // PR health: up to 20 pts
  if (packetEntries.length > 0) {
    const ok = packetEntries.filter(
      (e) => e.pr.mergeStatus !== "failed" && e.pr.mergeStatus !== "blocked",
    ).length;
    score += (ok / packetEntries.length) * 20;
  } else {
    score += 10; // neutral when no PRs
  }
  // Packet status: 10 pts
  if (packetState === "ready" || packetState === "merged") score += 10;
  return Math.round(Math.min(100, Math.max(0, score)));
}

function ReadinessPanel({
  items,
  people,
  packetEntries,
  packetState,
}: {
  items: ReleaseItem[];
  people: PacketPerson[];
  packetEntries: PacketPrRow[];
  packetState: PacketStatus;
}) {
  const score = computeReadinessScore(
    items,
    people,
    packetEntries,
    packetState,
  );
  const confidence = score >= 85 ? "High" : score >= 60 ? "Medium" : "Low";
  const confidenceColor =
    score >= 85
      ? "text-signal-success-text"
      : score >= 60
        ? "text-signal-warning-text"
        : "text-muted-foreground";

  const roleGroups: Array<{ role: PacketParticipantRole; label: string }> = [
    { role: "stakeholder", label: "Stakeholders" },
    { role: "team_lead", label: "Team lead" },
    { role: "qa", label: "QA" },
  ];

  const populatedGroups = roleGroups.filter(({ role }) =>
    people.some((p) => p.role === role),
  );

  return (
    <div className="rounded-xl border border-border bg-background px-5 py-4">
      <div className="flex flex-wrap items-start gap-6">
        {/* Score + bar */}
        <div className="flex-1 min-w-[160px]">
          <Eyebrow icon={ShieldCheck}>Release readiness</Eyebrow>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-[36px] font-semibold tracking-tight text-foreground leading-none">
              {score}
            </span>
            <div>
              <p
                className={cn(
                  "text-[12px] font-medium leading-none",
                  confidenceColor,
                )}
              >
                {confidence} confidence
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {score === 100
                  ? "All checks complete."
                  : score >= 85
                    ? "Approved and ready to schedule."
                    : "Complete items and collect approvals."}
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground text-right">
            {score}%
          </p>
        </div>

        {/* Approval avatar groups */}
        {populatedGroups.length > 0 && (
          <div className="flex items-start gap-5 pt-1">
            {populatedGroups.map(({ role, label }) => {
              const group = people.filter((p) => p.role === role);
              const approved = group.filter(
                (p) => p.approvalStatus === "approved",
              ).length;
              const allApproved = approved === group.length;
              return (
                <div key={role}>
                  <AvatarStack people={group} maxShow={4} />
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 font-mono text-[10px] font-semibold",
                      allApproved
                        ? "text-signal-success-text"
                        : "text-muted-foreground",
                    )}
                  >
                    {approved}/{group.length}
                    {allApproved ? " ✓" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approval roster ────────────────────────────────────────────────────────────

function ApprovalRoster({
  people,
  currentUserId,
  availableUsers,
  onAdd,
  onApprove,
  onRevoke,
  onRemove,
}: {
  people: PacketPerson[];
  currentUserId: string | null;
  availableUsers: Array<{ id: string; email: string }>;
  onAdd: (p: { userId: string; role: PacketParticipantRole }) => void;
  onApprove: (p: PacketPerson) => void;
  onRevoke: (p: PacketPerson) => void;
  onRemove: (id: string) => void;
}) {
  const [managing, setManaging] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<PacketParticipantRole>("stakeholder");

  const groups: Record<PacketParticipantRole, PacketPerson[]> = {
    stakeholder: people.filter((p) => p.role === "stakeholder"),
    team_lead: people.filter((p) => p.role === "team_lead"),
    qa: people.filter((p) => p.role === "qa"),
  };

  const roleGroups: Array<{ role: PacketParticipantRole; label: string }> = [
    { role: "stakeholder", label: "Stakeholders" },
    { role: "team_lead", label: "Team lead" },
    { role: "qa", label: "QA" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow icon={Users}>Approvers</Eyebrow>
        <button
          type="button"
          onClick={() => setManaging(!managing)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {managing ? "Done" : "+ Add"}
        </button>
      </div>

      {managing && (
        <div className="mb-4 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Assign approver
          </p>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none focus:border-primary/40"
          >
            <option value="">Select person</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as PacketParticipantRole)}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none focus:border-primary/40"
            >
              <option value="stakeholder">Stakeholder</option>
              <option value="team_lead">Team lead</option>
              <option value="qa">QA</option>
            </select>
            <Button
              size="sm"
              onClick={() => {
                if (!userId) return;
                onAdd({ userId, role });
                setUserId("");
                setRole("stakeholder");
              }}
              disabled={!userId}
            >
              Assign
            </Button>
          </div>
        </div>
      )}

      {people.length === 0 && !managing ? (
        <p className="text-[12px] text-muted-foreground">
          No approvers assigned yet.
        </p>
      ) : (
        <div className="space-y-4">
          {roleGroups.map(({ role: r, label }) => {
            const group = groups[r];
            if (group.length === 0) return null;
            return (
              <div key={r}>
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  {label}
                </p>
                <div className="space-y-1.5">
                  {group.map((person) => {
                    const isMe = person.userId === currentUserId;
                    const approved = person.approvalStatus === "approved";
                    return (
                      <div
                        key={person.id}
                        className="flex items-center gap-2.5"
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-[2px] border border-primary/20 bg-primary/10 font-mono text-[10px] uppercase tracking-[0.06em] text-primary-accessible">
                          {initials(displayNameFromEmail(person.email))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-[12px] font-medium text-foreground">
                            {displayNameFromEmail(person.email)}
                          </p>
                        </div>
                        {isMe ? (
                          <button
                            type="button"
                            onClick={() =>
                              approved ? onRevoke(person) : onApprove(person)
                            }
                            className={cn(
                              "shrink-0 rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] transition-colors",
                              approved
                                ? "border-signal-success/30 bg-signal-success/10 text-signal-success-text hover:bg-signal-success/20"
                                : "border-primary/30 bg-primary/10 text-primary-accessible hover:bg-primary/20",
                            )}
                          >
                            {approved ? "✓ Approved" : "Approve"}
                          </button>
                        ) : (
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[9px] uppercase tracking-[0.06em]",
                              approved
                                ? "text-signal-success-text"
                                : "text-text-disabled",
                            )}
                          >
                            {approved ? "✓" : "Pending"}
                          </span>
                        )}
                        {managing && (
                          <button
                            type="button"
                            onClick={() => onRemove(person.id)}
                            className="shrink-0 text-text-disabled hover:text-signal-danger-text transition-colors"
                          >
                            <X className="size-3" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Slack preview dialog ───────────────────────────────────────────────────────

function SlackPreviewDialog({
  slackChannel,
  launchWindow,
  items,
}: {
  slackChannel: string;
  launchWindow: string;
  items: ReleaseItem[];
}) {
  return (
    <Dialog>
      <DialogTrigger className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        Preview ↗
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Slack message preview</DialogTitle>
        </DialogHeader>
        <div className="mt-2 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Rocket
                className="size-4 text-primary-accessible"
                strokeWidth={1.75}
              />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                DeployTitan
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {slackChannel || "#releases"}
              </p>
            </div>
          </div>
          <p className="text-[13px] font-medium text-foreground mb-1">
            {launchWindow
              ? `Release shipping at ${launchWindow}`
              : "Release shipping soon"}
          </p>
          {items.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              No release items yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex rounded-sm border px-1.5 py-px font-mono text-[7px] uppercase tracking-[0.06em] shrink-0",
                      ITEM_KIND_META[item.kind].badge,
                    )}
                  >
                    {ITEM_KIND_META[item.kind].label}
                  </span>
                  <div>
                    <p className="text-[12px] font-medium text-foreground">
                      {item.title}
                    </p>
                    {item.impact && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {item.impact}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Item status selector ───────────────────────────────────────────────────────

function ItemStatusSelector({
  status,
  onChange,
}: {
  status: ReleaseItemStatus;
  onChange: (s: ReleaseItemStatus) => void;
}) {
  const statuses: ReleaseItemStatus[] = ["planning", "review", "approved"];
  return (
    <div className="flex flex-col gap-1">
      {statuses.map((s) => {
        const m = ITEM_STATUS_META[s];
        const active = status === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? m.cls
                : "border-transparent text-muted-foreground hover:bg-muted/30",
            )}
          >
            <span
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                active ? "border-current" : "border-border",
              )}
            >
              {active && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <span className="text-[13px] font-medium">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Compact merge waves ────────────────────────────────────────────────────────

function CompactWaves({
  entries,
  deps,
}: {
  entries: PacketPrRow[];
  deps: Array<{ dependentPrId: string; prerequisitePrId: string }>;
}) {
  const waves = packetTopologicalWaves(entries, deps);
  if (waves.length <= 1) return null;
  return (
    <div>
      <Eyebrow icon={WandSparkles}>Merge waves</Eyebrow>
      <div className="mt-3 space-y-2">
        {waves.map((wave, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="shrink-0 w-12 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              Wave {i + 1}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {wave.map((e) => (
                <span
                  key={e.pr.id}
                  className="rounded-sm border border-border bg-muted/40 px-2 py-px font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground"
                >
                  #{e.pr.prNumber}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dependency panel ───────────────────────────────────────────────────────────

function DependencyPanel({
  entries,
  deps,
  onAddDep,
  onRemoveDep,
}: {
  entries: PacketPrRow[];
  deps: Array<{ id: string; dependentPrId: string; prerequisitePrId: string }>;
  onAddDep: (dep: string, pre: string) => void;
  onRemoveDep: (id: string) => void;
}) {
  if (entries.length < 2) return null;
  const em = new Map(entries.map((e) => [e.pr.id, e]));

  return (
    <div>
      <Eyebrow icon={GitMerge}>Dependencies</Eyebrow>
      <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
        Model merge order within this lane.
      </p>
      <div className="space-y-3">
        {entries.map((entry) => {
          const currentDeps = deps.filter(
            (d) => d.dependentPrId === entry.pr.id,
          );
          const currentDepIds = new Set(
            currentDeps.map((d) => d.prerequisitePrId),
          );
          const eligible = entries.filter(
            (c) => c.pr.id !== entry.pr.id && !currentDepIds.has(c.pr.id),
          );
          return (
            <div
              key={entry.pr.id}
              className="rounded-lg border border-border bg-muted/20 px-3 py-3"
            >
              <p className="text-[12px] font-medium text-foreground">
                #{entry.pr.prNumber} {entry.pr.title}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                waits for
              </p>
              <div className="mt-2 space-y-1.5">
                {currentDeps.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No prerequisites.
                  </p>
                ) : (
                  currentDeps.map((dep) => {
                    const prereq = em.get(dep.prerequisitePrId);
                    if (!prereq) return null;
                    return (
                      <div
                        key={dep.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5"
                      >
                        <CheckCircle2
                          className="size-3 shrink-0 text-signal-success-text"
                          strokeWidth={2}
                        />
                        <span className="flex-1 min-w-0 truncate text-[11px] text-foreground">
                          #{prereq.pr.prNumber} {prereq.pr.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveDep(dep.id)}
                          className="text-text-disabled hover:text-signal-danger-text transition-colors"
                        >
                          <X className="size-3" strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              {eligible.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {eligible.map((c) => (
                    <button
                      key={c.pr.id}
                      type="button"
                      onClick={() => onAddDep(entry.pr.id, c.pr.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <Plus className="size-2.5" strokeWidth={2} />#
                      {c.pr.prNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Merge log ──────────────────────────────────────────────────────────────────

function MergeLog({
  jobs,
  entries,
}: {
  jobs: Array<{ pullRequestId: string; prNumber: number; jobId: string }>;
  entries: PacketPrRow[];
}) {
  const em = new Map(entries.map((e) => [e.pr.id, e]));
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <Eyebrow icon={Rocket}>Merge queue</Eyebrow>
      </div>
      <div className="divide-y divide-border">
        {jobs.map((job, i) => {
          const entry = em.get(job.pullRequestId);
          return (
            <div key={job.jobId} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 font-mono text-[9px] uppercase text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <MergeStatusBadge status={entry?.pr.mergeStatus ?? "pending"} />
              <span className="flex-1 min-w-0 truncate text-[12px] text-foreground">
                {entry?.pr.title || `PR #${job.prNumber}`}
              </span>
              <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">
                #{job.prNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReleaseDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const z = useZero();

  const orgId = params?.orgId as string;
  const projectPublicId = params?.projectId as string;
  const releasePublicId = params?.releaseId as string;
  const itemPublicIdParam = searchParams.get("item");

  const [project] = useQuery(
    queries.projectByPublicId({ publicId: projectPublicId }),
  );
  const [packet] = useQuery(
    queries.releasePacketByPublicId({ publicId: releasePublicId }),
  );
  const releasePacketId = packet?.id ?? "";

  const [packetPrRows, packetPrStatus] = useQuery(
    queries.releasePacketPrsByPacketId({ releasePacketId }),
  );
  const [allProjectDeps] = useQuery(
    queries.prDependenciesByProjectId({ projectId: project?.id ?? "" }),
  );
  const [allProjectPRs, prsStatus] = useQuery(
    queries.pullRequestsByProjectId({ projectId: project?.id ?? "" }),
  );
  const [releaseItems] = useQuery(
    queries.releasePacketItemsByPacketId({ releasePacketId }),
  );
  const [releaseItemPrRows] = useQuery(
    queries.releasePacketItemPrsByPacketId({ releasePacketId }),
  );
  const [releaseParticipants] = useQuery(
    queries.releasePacketParticipantsByPacketId({ releasePacketId }),
  );
  const [orgUsers] = useQuery(queries.usersByOrgId({ orgId }));

  const [mergeLog, setMergeLog] = useState<Array<{
    pullRequestId: string;
    prNumber: number;
    jobId: string;
  }> | null>(null);
  const [itemMerging, setItemMerging] = useState(false);

  const currentOrgUser = useMemo(
    () => orgUsers.find((u) => u.email === user?.email) ?? null,
    [orgUsers, user?.email],
  );
  const currentUserId = currentOrgUser?.id ?? null;

  const prMap = useMemo(() => {
    const map = new Map<string, (typeof allProjectPRs)[number]>();
    for (const pr of allProjectPRs) map.set(pr.id, pr);
    return map;
  }, [allProjectPRs]);

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

  const itemAssignments = useMemo(() => {
    const map = new Map<string, string[]>();
    releaseItems.forEach((item) => map.set(item.id, []));
    releaseItemPrRows.forEach((row) => {
      if (!packetPrIds.has(row.pullRequestId)) return;
      const current = map.get(row.releasePacketItemId) ?? [];
      current.push(row.pullRequestId);
      map.set(row.releasePacketItemId, current);
    });
    return map;
  }, [packetPrIds, releaseItemPrRows, releaseItems]);

  const normalizedItems = useMemo(
    () =>
      releaseItems.map((item) => ({
        id: item.id,
        publicId: item.publicId ?? null,
        title: item.title,
        kind: item.kind as ReleaseItemKind,
        summary: item.summary ?? "",
        impact: item.impact ?? "",
        prIds: itemAssignments.get(item.id) ?? [],
        status: item.status as ReleaseItemStatus,
      })),
    [itemAssignments, releaseItems],
  );

  const selectedItem =
    normalizedItems.find(
      (item) =>
        item.publicId === itemPublicIdParam || item.id === itemPublicIdParam,
    ) ?? null;

  function selectItem(item: (typeof normalizedItems)[number] | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (item) next.set("item", item.publicId ?? item.id);
    else next.delete("item");
    router.replace(`?${next.toString()}`, { scroll: false } as Parameters<
      typeof router.replace
    >[1]);
  }

  const packetPeople = useMemo((): PacketPerson[] => {
    const userMap = new Map(orgUsers.map((u) => [u.id, u]));
    return releaseParticipants.map((p) => {
      const u = userMap.get(p.userId);
      return {
        id: p.id,
        userId: p.userId,
        email: u?.email ?? "unknown@deploytitan.local",
        role: p.role as PacketParticipantRole,
        approvalStatus: p.approvalStatus as "pending" | "approved",
        approvedAt: p.approvedAt ?? null,
      };
    });
  }, [orgUsers, releaseParticipants]);

  const itemEntries = useMemo(() => {
    if (!selectedItem) return [];
    const ids = new Set(selectedItem.prIds);
    return packetEntries.filter((e) => ids.has(e.pr.id));
  }, [packetEntries, selectedItem]);

  const itemPrIds = useMemo(
    () => new Set(itemEntries.map((e) => e.pr.id)),
    [itemEntries],
  );

  const packetDeps = useMemo(
    () =>
      allProjectDeps
        .filter(
          (d) =>
            packetPrIds.has(d.dependentPrId) &&
            packetPrIds.has(d.prerequisitePrId),
        )
        .map((d) => ({
          id: d.id,
          dependentPrId: d.dependentPrId,
          prerequisitePrId: d.prerequisitePrId,
        })),
    [allProjectDeps, packetPrIds],
  );

  const itemDeps = useMemo(
    () =>
      packetDeps.filter(
        (d) =>
          itemPrIds.has(d.dependentPrId) && itemPrIds.has(d.prerequisitePrId),
      ),
    [itemPrIds, packetDeps],
  );

  const itemPool = useMemo(
    (): PR[] =>
      allProjectPRs
        .filter((pr) => !itemPrIds.has(pr.id))
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
        })),
    [allProjectPRs, itemPrIds],
  );

  const mergeAllMutation = useMutation({
    mutationFn: () => mergeAllReleasePacket(packet?.id ?? ""),
    onSuccess: (res) => setMergeLog(res.data.jobs),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRename(name: string) {
    if (!packet) return;
    await z.mutate(mutators.releasePacket.update({ id: packet.id, name }))
      .client;
  }

  async function handleStatusChange(status: PacketStatus) {
    if (!packet) return;
    await z.mutate(mutators.releasePacket.update({ id: packet.id, status }))
      .client;
  }

  async function handlePacketField(
    field: "summary" | "launchWindow" | "slackHeadline",
    value: string,
  ) {
    if (!packet) return;
    const existing =
      field === "summary"
        ? (packet.summary ?? "")
        : field === "launchWindow"
          ? (packet.launchWindow ?? "")
          : (packet.slackHeadline ?? "");
    if (value.trim() === existing) return;
    await z.mutate(
      mutators.releasePacket.update({ id: packet.id, [field]: value.trim() }),
    ).client;
  }

  async function createItem(
    template?: Partial<
      Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">
    >,
  ) {
    if (!packet) return;
    const id = generateId();
    const publicId = `rpi_${Math.random().toString(36).slice(2, 18)}`;
    await z.mutate(
      mutators.releasePacketItem.create({
        id,
        publicId,
        releasePacketId: packet.id,
        title: template?.title ?? "New release item",
        kind: template?.kind ?? "feature",
        summary: template?.summary || undefined,
        impact: template?.impact || undefined,
        status: "planning",
        position: normalizedItems.length,
      }),
    ).client;
  }

  async function handleDeleteItem(itemId: string) {
    await z.mutate(mutators.releasePacketItem.delete({ id: itemId })).client;
  }

  async function handleItemField(
    itemId: string,
    field: "title" | "summary" | "impact",
    value: string,
  ) {
    const item = normalizedItems.find((i) => i.id === itemId);
    if (!item || value.trim() === item[field]) return;
    await z.mutate(
      mutators.releasePacketItem.update({ id: itemId, [field]: value.trim() }),
    ).client;
  }

  async function handleItemStatus(itemId: string, status: ReleaseItemStatus) {
    await z.mutate(mutators.releasePacketItem.update({ id: itemId, status }))
      .client;
  }

  async function handleItemKind(itemId: string, kind: ReleaseItemKind) {
    const item = normalizedItems.find((i) => i.id === itemId);
    if (!item || kind === item.kind) return;
    await z.mutate(mutators.releasePacketItem.update({ id: itemId, kind }))
      .client;
  }

  async function ensurePacketPR(pr: PR) {
    if (!packet || packetPrIds.has(pr.id)) return;
    await z.mutate(
      mutators.releasePacketPr.add({
        id: generateId(),
        releasePacketId: packet.id,
        pullRequestId: pr.id,
      }),
    ).client;
  }

  async function handleAddPRToItem(pr: PR) {
    if (!selectedItem) return;
    await ensurePacketPR(pr);
    await z.mutate(
      mutators.releasePacketItemPr.add({
        id: generateId(),
        releasePacketItemId: selectedItem.id,
        pullRequestId: pr.id,
      }),
    ).client;
    if (selectedItem.status === "planning")
      await handleItemStatus(selectedItem.id, "review");
  }

  async function handleRemovePRFromItem(prId: string) {
    if (!selectedItem) return;
    const inOtherItems = normalizedItems.some(
      (item) => item.id !== selectedItem.id && item.prIds.includes(prId),
    );
    const itemPrRow = releaseItemPrRows.find(
      (row) =>
        row.releasePacketItemId === selectedItem.id &&
        row.pullRequestId === prId,
    );
    if (itemPrRow)
      await z.mutate(mutators.releasePacketItemPr.remove({ id: itemPrRow.id }))
        .client;
    if (inOtherItems) return;
    const packetRow = packetEntries.find((e) => e.pr.id === prId);
    if (packetRow)
      await z.mutate(
        mutators.releasePacketPr.remove({ id: packetRow.packetPrId }),
      ).client;
    for (const dep of packetDeps) {
      if (dep.dependentPrId === prId || dep.prerequisitePrId === prId)
        await z.mutate(mutators.prDependency.remove({ id: dep.id })).client;
    }
  }

  async function handleAddDep(dependentPrId: string, prerequisitePrId: string) {
    const dep = itemEntries.find((e) => e.pr.id === dependentPrId);
    const pre = itemEntries.find((e) => e.pr.id === prerequisitePrId);
    if (!dep || !pre || !project) return;
    await z.mutate(
      mutators.prDependency.add({
        id: generateId(),
        publicId: `prd_${Math.random().toString(36).slice(2, 18)}`,
        projectId: project.id,
        dependentPrId,
        prerequisitePrId,
        dependentPrNumber: dep.pr.prNumber,
        prerequisitePrNumber: pre.pr.prNumber,
        source: "ui",
        waitForDeploy: false,
      }),
    ).client;
  }

  async function handleRemoveDep(id: string) {
    await z.mutate(mutators.prDependency.remove({ id })).client;
  }

  async function handleAddParticipant(
    userId: string,
    role: PacketParticipantRole,
  ) {
    if (!packet) return;
    await z.mutate(
      mutators.releasePacketParticipant.add({
        id: generateId(),
        releasePacketId: packet.id,
        userId,
        role,
      }),
    ).client;
  }

  async function handleApprove(person: PacketPerson) {
    await z.mutate(
      mutators.releasePacketParticipant.update({
        id: person.id,
        approvalStatus: "approved",
        approvedAt: Date.now(),
      }),
    ).client;
  }

  async function handleRevoke(person: PacketPerson) {
    await z.mutate(
      mutators.releasePacketParticipant.update({
        id: person.id,
        approvalStatus: "pending",
        approvedAt: null,
      }),
    ).client;
  }

  async function handleRemoveParticipant(id: string) {
    await z.mutate(mutators.releasePacketParticipant.remove({ id })).client;
  }

  async function handleMergeItem() {
    if (!selectedItem || itemMerging) return;
    const waves = packetTopologicalWaves(itemEntries, itemDeps);
    const orderedEntries = waves.flat();
    const mergeable = orderedEntries.filter(
      (e) => e.pr.installationId !== null && e.pr.mergeStatus !== "merged",
    );
    if (mergeable.length === 0) return;
    setItemMerging(true);
    try {
      for (const entry of mergeable) {
        if (!entry.pr.installationId) continue;
        await mergePullRequest({
          repoId: entry.pr.repoId,
          pullNumber: entry.pr.prNumber,
          headSha: entry.pr.headSha,
          installationId: entry.pr.installationId,
          mergeMethod: "squash",
        });
      }
    } finally {
      setItemMerging(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const packetState = packetStatus(packet?.status ?? null);
  const canPacketMerge =
    packetEntries.length > 0 &&
    !mergeAllMutation.isPending &&
    packetState !== "merged" &&
    packetState !== "merging";
  const assignedPrCount = normalizedItems.reduce(
    (n, item) => n + item.prIds.length,
    0,
  );

  const overallHealth = useMemo(() => {
    if (packetEntries.length === 0) return null;
    const failed = packetEntries.filter(
      (e) => e.pr.mergeStatus === "failed",
    ).length;
    const blocked = packetEntries.filter(
      (e) => e.pr.mergeStatus === "blocked",
    ).length;
    const merged = packetEntries.filter(
      (e) => e.pr.mergeStatus === "merged",
    ).length;
    const inFlight = packetEntries.filter(
      (e) => e.pr.mergeStatus === "merging" || e.pr.mergeStatus === "checking",
    ).length;
    return { total: packetEntries.length, merged, failed, blocked, inFlight };
  }, [packetEntries]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (!packet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-pulse rounded-xl bg-muted/60" />
          <p className="text-[13px] text-muted-foreground">
            Loading release packet...
          </p>
        </div>
      </div>
    );
  }

  // ── Item detail view ─────────────────────────────────────────────────────────

  if (selectedItem) {
    const itemHealth = getItemHealth(selectedItem.prIds, packetEntries);
    const canItemMerge = itemEntries.some(
      (e) => e.pr.installationId !== null && e.pr.mergeStatus !== "merged",
    );

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-muted/10">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-5 lg:px-8">
            <button
              type="button"
              onClick={() => selectItem(null)}
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.75} />
              {packet.name}
            </button>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <ItemKindDropdown
                    kind={selectedItem.kind}
                    onChange={(k) => handleItemKind(selectedItem.id, k)}
                  />
                  {selectedItem.publicId && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground select-all">
                      {selectedItem.publicId}
                    </span>
                  )}
                </div>
                <InlineTitle
                  value={selectedItem.title}
                  onSave={(v) => handleItemField(selectedItem.id, "title", v)}
                />
                <div className="mt-2 flex items-center gap-3">
                  <PRHealthLine health={itemHealth} />
                  {itemEntries.length > 0 && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {itemEntries.length} PR{itemEntries.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={selectedItem.status} />
                {canItemMerge && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMergeItem}
                    disabled={itemMerging}
                  >
                    {itemMerging ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <GitMerge className="size-3.5" />
                    )}
                    {itemMerging ? "Merging…" : "Merge item"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-8 lg:flex-row">
          {/* Main */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Business summary */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                Business summary
              </p>
              <InlineArea
                key={`summary-${selectedItem.id}`}
                value={selectedItem.summary}
                onSave={(v) => handleItemField(selectedItem.id, "summary", v)}
                placeholder="What does this change, and why does it matter?"
              />
            </div>

            {/* Impact */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                Customer or company impact
              </p>
              <InlineArea
                key={`impact-${selectedItem.id}`}
                value={selectedItem.impact}
                onSave={(v) => handleItemField(selectedItem.id, "impact", v)}
                placeholder="Click to describe the impact…"
              />
            </div>

            {/* Pull requests */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Eyebrow icon={GitPullRequest}>Pull requests</Eyebrow>
              </div>

              <div className="rounded-xl border border-border bg-background overflow-hidden">
                {packetPrStatus.type === "unknown" ? (
                  <div className="space-y-2 p-4">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-lg bg-muted/50"
                        style={{ opacity: 1 - i * 0.14 }}
                      />
                    ))}
                  </div>
                ) : itemEntries.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                    No pull requests mapped yet. Add one below.
                  </div>
                ) : (
                  itemEntries.map((entry) => (
                    <PRRow
                      key={entry.packetPrId}
                      entry={entry}
                      onRemove={() => handleRemovePRFromItem(entry.pr.id)}
                    />
                  ))
                )}
                <div className="p-3 border-t border-border">
                  <InlinePRSearch
                    allPRs={itemPool}
                    itemPrIds={itemPrIds}
                    loading={prsStatus.type === "unknown"}
                    onAdd={handleAddPRToItem}
                  />
                </div>
              </div>
            </div>

            {/* Merge waves + deps (only when meaningful) */}
            {itemEntries.length > 1 && (
              <>
                <div className="border-t border-border" />
                <CompactWaves entries={itemEntries} deps={itemDeps} />
                <DependencyPanel
                  entries={itemEntries}
                  deps={itemDeps}
                  onAddDep={handleAddDep}
                  onRemoveDep={handleRemoveDep}
                />
              </>
            )}

            {mergeLog && <MergeLog jobs={mergeLog} entries={packetEntries} />}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[240px] shrink-0 space-y-6">
            {/* Status */}
            <div>
              <Eyebrow icon={ShieldCheck}>Status</Eyebrow>
              <div className="mt-3">
                <ItemStatusSelector
                  status={selectedItem.status}
                  onChange={(s) => handleItemStatus(selectedItem.id, s)}
                />
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Approvers */}
            <ApprovalRoster
              people={packetPeople}
              currentUserId={currentUserId}
              availableUsers={orgUsers.map((u) => ({
                id: u.id,
                email: u.email,
              }))}
              onAdd={({ userId, role }) => handleAddParticipant(userId, role)}
              onApprove={handleApprove}
              onRevoke={handleRevoke}
              onRemove={handleRemoveParticipant}
            />

            {itemEntries.length > 1 && (
              <>
                <div className="border-t border-border" />
                <CompactWaves entries={itemEntries} deps={itemDeps} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Release overview ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-muted/10">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-5 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/orgs/${orgId}/projects/${projectPublicId}/releases`,
                )
              }
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.75} />
              All releases
            </button>
            <span className="text-text-disabled">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {project?.name ?? "Project"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-2">
                <PackageCheck
                  className="size-3.5 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Release packet
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <InlineTitle value={packet.name} onSave={handleRename} />
                <PacketBadge status={packetState} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {normalizedItems.length} item
                  {normalizedItems.length !== 1 ? "s" : ""}
                </span>
                <span className="text-text-disabled">·</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {assignedPrCount} PR{assignedPrCount !== 1 ? "s" : ""}
                </span>
                <span className="text-text-disabled">·</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {formatRelative(packet.updatedAt)}
                </span>
                {overallHealth && (
                  <>
                    <span className="text-text-disabled">·</span>
                    <PRHealthLine health={overallHealth} />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {packetState === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("ready")}
                >
                  <ShieldCheck className="size-3.5" />
                  Mark ready
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => mergeAllMutation.mutate()}
                disabled={!canPacketMerge}
              >
                {mergeAllMutation.isPending || packetState === "merging" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Coordinating merge
                  </>
                ) : packetState === "merged" ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Release merged
                  </>
                ) : (
                  <>
                    <Rocket className="size-3.5" />
                    Launch merge run
                  </>
                )}
              </Button>
            </div>
          </div>

          {mergeAllMutation.isError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-signal-danger/20 bg-signal-danger/10 px-4 py-3">
              <AlertTriangle
                className="size-4 shrink-0 text-signal-danger-text"
                strokeWidth={1.75}
              />
              <p className="text-[12px] text-signal-danger-text">
                {mergeAllMutation.error instanceof Error
                  ? mergeAllMutation.error.message
                  : "Merge run failed. Check dependencies and PR status."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-8 xl:flex-row xl:gap-10">
        {/* Main */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Readiness panel */}
          <ReadinessPanel
            items={normalizedItems}
            people={packetPeople}
            packetEntries={packetEntries}
            packetState={packetState}
          />

          {/* Launch narrative */}
          <div>
            <Eyebrow icon={Rocket}>Launch narrative</Eyebrow>
            <div className="mt-3">
              <InlineArea
                key={`summary-${packet.id}`}
                value={packet.summary ?? ""}
                onSave={(v) => handlePacketField("summary", v)}
                placeholder="Describe the business story for this release. Click to edit."
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  Launch window
                </p>
                <input
                  type="datetime-local"
                  defaultValue={packet.launchWindow ?? ""}
                  onBlur={(e) =>
                    handlePacketField("launchWindow", e.target.value)
                  }
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-[13px] text-foreground outline-none focus:border-primary/40 transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    Slack channel
                  </p>
                  <SlackPreviewDialog
                    slackChannel={packet.slackHeadline ?? ""}
                    launchWindow={packet.launchWindow ?? ""}
                    items={normalizedItems}
                  />
                </div>
                <input
                  key={`slack-${packet.id}`}
                  defaultValue={packet.slackHeadline ?? ""}
                  onBlur={(e) =>
                    handlePacketField("slackHeadline", e.target.value)
                  }
                  placeholder="#releases"
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-[13px] text-foreground outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Release items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Eyebrow icon={Sparkles}>Release items</Eyebrow>
            </div>

            <div className="rounded-xl border border-border bg-background overflow-hidden">
              {normalizedItems.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[14px] font-medium text-foreground">
                    No release items yet
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[40ch] text-[12px] text-muted-foreground leading-relaxed">
                    Add lanes like "Customer-facing launch" or "Quality fixes".
                    Each lane holds its own PRs and approval context.
                  </p>
                </div>
              ) : (
                normalizedItems.map((item) => (
                  <ReleaseItemRow
                    key={item.id}
                    item={item}
                    health={getItemHealth(item.prIds, packetEntries)}
                    onOpen={() => selectItem(item)}
                    onDelete={() => handleDeleteItem(item.id)}
                  />
                ))
              )}
              <AddItemRow onCreate={createItem} />
            </div>
          </div>

          {mergeLog && <MergeLog jobs={mergeLog} entries={packetEntries} />}
        </div>

        {/* Sidebar */}
        <div className="w-full xl:w-[280px] shrink-0 space-y-6">
          {/* Approvers */}
          <ApprovalRoster
            people={packetPeople}
            currentUserId={currentUserId}
            availableUsers={orgUsers.map((u) => ({ id: u.id, email: u.email }))}
            onAdd={({ userId, role }) => handleAddParticipant(userId, role)}
            onApprove={handleApprove}
            onRevoke={handleRevoke}
            onRemove={handleRemoveParticipant}
          />

          <div className="border-t border-border" />

          {/* Sign-off summary with avatar stacks */}
          <div>
            <Eyebrow icon={ShieldCheck}>Sign-off</Eyebrow>
            <div className="mt-3 space-y-4">
              {(
                ["stakeholder", "team_lead", "qa"] as PacketParticipantRole[]
              ).map((role) => {
                const group = packetPeople.filter((p) => p.role === role);
                if (group.length === 0) return null;
                const approvedCount = group.filter(
                  (p) => p.approvalStatus === "approved",
                ).length;
                const allApproved = approvedCount === group.length;
                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                        {role === "team_lead"
                          ? "Team lead"
                          : role === "qa"
                            ? "QA"
                            : "Stakeholders"}
                      </p>
                      <span
                        className={cn(
                          "font-mono text-[10px] font-semibold",
                          allApproved
                            ? "text-signal-success-text"
                            : "text-muted-foreground",
                        )}
                      >
                        {approvedCount}/{group.length}
                        {allApproved ? " ✓" : ""}
                      </span>
                    </div>
                    <AvatarStack people={group} maxShow={6} />
                  </div>
                );
              })}
            </div>

            {/* Publish CTA — only shown when all assigned roles are fully approved */}
            {packetPeople.length > 0 &&
              packetPeople.every((p) => p.approvalStatus === "approved") && (
                <div className="mt-5 rounded-xl border border-signal-success/25 bg-signal-success/8 px-4 py-3">
                  <p className="text-[12px] font-medium text-signal-success-text">
                    All approvals complete
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Ready to publish to Slack and mark as launched.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => handleStatusChange("merged")}
                  >
                    <Rocket className="size-3.5" />
                    Publish &amp; mark launched
                  </Button>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
