"use client";

import { useQuery, useZero } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { queries, mutators } from "@deploytitan/zero-schema";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  MessageSquareShare,
  Minus,
  PackageCheck,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  startTransition,
  type ElementType,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { mergeAllReleasePacket } from "@/lib/api";

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
type PacketApprovalKey = "stakeholders" | "teamLead" | "qa";

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

type PacketPrRow = {
  packetPrId: string;
  pr: PR;
};

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
  title: string;
  kind: ReleaseItemKind;
  summary: string;
  impact: string;
  prIds: string[];
  status: ReleaseItemStatus;
};

const ITEM_KIND_META: Record<
  ReleaseItemKind,
  { label: string; badge: string; accent: string }
> = {
  feature: {
    label: "Feature",
    badge: "text-signal-deploy-text bg-signal-deploy/10 border-signal-deploy/25",
    accent: "text-signal-deploy-text",
  },
  bug: {
    label: "Bug fix",
    badge: "text-signal-danger-text bg-signal-danger/10 border-signal-danger/20",
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
    cls: "text-text-tertiary bg-muted/70 border-border",
  },
  review: {
    label: "In review",
    cls: "text-primary-accessible bg-primary/10 border-primary/20",
  },
  approved: {
    label: "Approved",
    cls: "text-signal-success-text bg-signal-success/10 border-signal-success/25",
  },
};

const PACKET_STATUS_META: Record<PacketStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "text-text-tertiary bg-muted/70 border-border" },
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

const TEMPLATE_ITEMS: Array<Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">> = [
  {
    kind: "feature",
    title: "Customer-facing launch",
    summary: "Group the changes customers and internal stakeholders should understand first.",
    impact: "Describe what changes, who notices, and what success looks like after deploy.",
  },
  {
    kind: "bug",
    title: "Quality and bug fixes",
    summary: "Collect regressions, fixes, and cleanup work that reduces release risk.",
    impact: "Call out what breaks today and how this release resolves it.",
  },
  {
    kind: "performance",
    title: "Performance improvements",
    summary: "Track latency wins, reliability improvements, and scaling work worth announcing.",
    impact: "Translate infra wins into customer or business outcomes.",
  },
  {
    kind: "infrastructure",
    title: "Platform and rollout work",
    summary: "Bundle operational changes, migrations, and sequencing that support the launch.",
    impact: "Document dependencies, coordination, and checks before rollout.",
  },
];

function generateId() {
  return crypto.randomUUID();
}

function createReleaseItem(
  template?: Partial<Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">>,
): ReleaseItem {
  return {
    id: generateId(),
    title: template?.title ?? "New release item",
    kind: template?.kind ?? "feature",
    summary: template?.summary ?? "",
    impact: template?.impact ?? "",
    prIds: [],
    status: "planning",
  };
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
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function displayNameFromEmail(email: string) {
  const [localPart] = email.split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
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
  ) {
    return status;
  }
  return "draft";
}

function packetTopologicalWaves(
  entries: PacketPrRow[],
  deps: Array<{ dependentPrId: string; prerequisitePrId: string }>,
) {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const entry of entries) {
    inDegree.set(entry.pr.id, 0);
    graph.set(entry.pr.id, []);
  }

  for (const dep of deps) {
    if (!inDegree.has(dep.dependentPrId) || !inDegree.has(dep.prerequisitePrId)) {
      continue;
    }
    graph.get(dep.prerequisitePrId)?.push(dep.dependentPrId);
    inDegree.set(dep.dependentPrId, (inDegree.get(dep.dependentPrId) ?? 0) + 1);
  }

  const levels: string[][] = [];
  let queue = entries
    .map((entry) => entry.pr.id)
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
        if (deg === 0 && !placed.has(neighbor)) {
          next.push(neighbor);
        }
      }
    }
    queue = next;
  }

  const remaining = entries
    .map((entry) => entry.pr.id)
    .filter((id) => !placed.has(id));
  if (remaining.length > 0) {
    levels.push(remaining);
  }

  const entryMap = new Map(entries.map((entry) => [entry.pr.id, entry]));
  return levels.map((level) =>
    level
      .map((id) => entryMap.get(id))
      .filter((entry): entry is PacketPrRow => Boolean(entry)),
  );
}

function PacketStatusBadge({ status }: { status: PacketStatus }) {
  const meta = PACKET_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
        meta.cls,
      )}
      style={{ borderRadius: "2px" }}
    >
      {meta.label}
    </span>
  );
}

function MergeStatusBadge({ status }: { status: MergeStatus }) {
  const meta = MERGE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em]",
        meta.cls,
      )}
      style={{ borderRadius: "2px" }}
    >
      {meta.spin ? (
        <Loader2 className="size-2 animate-spin" strokeWidth={2.5} />
      ) : (
        <Circle className="size-1.5 fill-current" strokeWidth={0} />
      )}
      {meta.label}
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
  if (draft) {
    return (
      <span
        className="border border-border bg-muted/70 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] text-text-tertiary"
        style={{ borderRadius: "2px" }}
      >
        Draft
      </span>
    );
  }

  if (state === "open") {
    return (
      <span
        className="border border-signal-success/25 bg-signal-success/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] text-signal-success-text"
        style={{ borderRadius: "2px" }}
      >
        Open
      </span>
    );
  }

  if (state === "closed") {
    return (
      <span
        className="border border-border bg-muted/70 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.06em] text-text-tertiary"
        style={{ borderRadius: "2px" }}
      >
        Closed
      </span>
    );
  }

  return null;
}

function SectionEyebrow({
  icon: Icon,
  children,
}: {
  icon: ElementType;
  children: string;
}) {
  return (
    <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
      <Icon className="size-3" strokeWidth={1.75} />
      {children}
    </p>
  );
}

function ReadinessMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-border bg-background px-4 py-3" style={{ borderRadius: "4px" }}>
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function ApprovalChip({
  active,
  onToggle,
  label,
  detail,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start justify-between gap-3 border px-4 py-3 text-left transition-colors",
        active
          ? "border-signal-success/25 bg-signal-success/10"
          : "border-border bg-background hover:bg-muted/40",
      )}
      style={{ borderRadius: "4px" }}
    >
      <div>
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
      <span
        className={cn(
          "mt-0.5 inline-flex size-5 items-center justify-center border",
          active
            ? "border-signal-success/30 bg-signal-success/15 text-signal-success-text"
            : "border-border text-text-disabled",
        )}
        style={{ borderRadius: "2px" }}
      >
        {active ? <Check className="size-3" strokeWidth={2.25} /> : null}
      </span>
    </button>
  );
}

function EditableName({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full max-w-xl min-w-0 border-b border-primary/40 bg-transparent pb-px text-[22px] font-semibold tracking-tight text-foreground outline-none"
        maxLength={120}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="group min-w-0 text-left"
    >
      <span className="text-[22px] font-semibold tracking-tight text-foreground">
        {value}
      </span>
      <span className="ml-2 opacity-0 text-[11px] uppercase tracking-[0.08em] text-text-tertiary transition-opacity group-hover:opacity-100">
        Rename
      </span>
    </button>
  );
}

function StakeholderAvatar({ stakeholder }: { stakeholder: PacketPerson }) {
  return (
    <div className="flex items-center gap-3 border border-border bg-background px-3 py-2.5" style={{ borderRadius: "4px" }}>
      <div
        className="flex size-9 shrink-0 items-center justify-center border border-primary/20 bg-primary/10 font-mono text-[11px] uppercase tracking-[0.06em] text-primary-accessible"
        style={{ borderRadius: "4px" }}
      >
        {initials(displayNameFromEmail(stakeholder.email))}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">
          {displayNameFromEmail(stakeholder.email)}
        </p>
        <p className="truncate font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
          {roleLabel(stakeholder.role)}
        </p>
      </div>
    </div>
  );
}

function ReleaseItemCard({
  item,
  participantCount,
  onOpen,
}: {
  item: ReleaseItem;
  participantCount: number;
  onOpen: () => void;
}) {
  const itemMeta = ITEM_KIND_META[item.kind];
  const statusMeta = ITEM_STATUS_META[item.status];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col justify-between border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/30"
      style={{ borderRadius: "4px" }}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={cn(
                "inline-flex border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.08em]",
                itemMeta.badge,
              )}
              style={{ borderRadius: "2px" }}
            >
              {itemMeta.label}
            </span>
            <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-foreground">
              {item.title}
            </h3>
          </div>
          <ChevronRight className="size-4 shrink-0 text-text-disabled transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {item.summary || "Add a release summary so stakeholders know why this work matters."}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
            PRs
          </p>
          <p className="mt-1 font-medium text-foreground">{item.prIds.length}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
            Packet approvers
          </p>
          <p className="mt-1 font-medium text-foreground">{participantCount}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
            Status
          </p>
          <span
            className={cn(
              "mt-1 inline-flex border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.08em]",
              statusMeta.cls,
            )}
            style={{ borderRadius: "2px" }}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>
    </button>
  );
}

function ReleaseItemComposer({
  onCreate,
}: {
  onCreate: (
    template?: Partial<Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">>,
  ) => void;
}) {
  const [customTitle, setCustomTitle] = useState("");

  return (
    <div className="space-y-3 border border-border bg-muted/20 px-4 py-4" style={{ borderRadius: "4px" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionEyebrow icon={Sparkles}>Release items</SectionEyebrow>
          <p className="mt-2 max-w-[56ch] text-[13px] leading-relaxed text-muted-foreground">
            Start from a business lane, then drop into engineering detail only after the packet story is clear.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onCreate()}>
          <Plus className="size-3.5" />
          Blank item
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {TEMPLATE_ITEMS.map((template) => (
          <button
            key={template.title}
            type="button"
            onClick={() => onCreate(template)}
            className="border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/40"
            style={{ borderRadius: "4px" }}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
              {ITEM_KIND_META[template.kind].label}
            </p>
            <p className="mt-2 text-[14px] font-medium text-foreground">{template.title}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {template.summary}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 border border-border bg-background px-4 py-4 md:flex-row md:items-center" style={{ borderRadius: "4px" }}>
        <div className="flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
            Custom lane
          </p>
          <Input
            value={customTitle}
            onChange={(event) => setCustomTitle(event.target.value)}
            placeholder="Example: Partner launch communications"
            className="mt-2"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            const title = customTitle.trim();
            if (!title) return;
            onCreate({ title, kind: "operations" });
            setCustomTitle("");
          }}
          disabled={!customTitle.trim()}
        >
          <Plus className="size-3.5" />
          Add lane
        </Button>
      </div>
    </div>
  );
}

function StakeholderRoster({
  stakeholders,
  availableUsers,
  onAdd,
  onToggleApproval,
  onRemove,
}: {
  stakeholders: PacketPerson[];
  availableUsers: Array<{ id: string; email: string }>;
  onAdd: (participant: { userId: string; role: PacketParticipantRole }) => void;
  onToggleApproval: (participant: PacketPerson) => void;
  onRemove: (participantId: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<PacketParticipantRole>("stakeholder");
  const alreadyAssigned = stakeholders.some(
    (stakeholder) => stakeholder.userId === userId && stakeholder.role === role,
  );

  return (
    <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
      <SectionEyebrow icon={Users}>Stakeholders</SectionEyebrow>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Pull approvers from the real org user list so the release packet can collect explicit sign-off.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="h-9 w-full rounded-[4px] border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Select user</option>
          {availableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as PacketParticipantRole)}
          className="h-9 w-full rounded-[4px] border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
          disabled={!userId || alreadyAssigned}
        >
          <Plus className="size-3.5" />
          Add approver
        </Button>
      </div>

      {alreadyAssigned ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          This user already has that packet role.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stakeholders.length === 0 ? (
          <div className="border border-dashed border-border bg-muted/20 px-4 py-5 text-[12px] leading-relaxed text-muted-foreground" style={{ borderRadius: "4px" }}>
            No one is assigned yet. Add stakeholders, QA, and team leads to make approvals concrete.
          </div>
        ) : (
          stakeholders.map((stakeholder) => (
            <div
              key={stakeholder.id}
              className="space-y-2 border border-border bg-muted/20 px-3 py-3"
              style={{ borderRadius: "4px" }}
            >
              <StakeholderAvatar stakeholder={stakeholder} />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={stakeholder.approvalStatus === "approved" ? "default" : "outline"}
                  onClick={() => onToggleApproval(stakeholder)}
                >
                  {stakeholder.approvalStatus === "approved" ? "Approved" : "Mark approved"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(stakeholder.id)}
                  className="text-muted-foreground"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PRPoolPanel({
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
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return allPRs.filter((pr) => {
      if (itemPrIds.has(pr.id)) return false;
      if (!query) return true;
      return (
        pr.title?.toLowerCase().includes(query) ||
        String(pr.prNumber).includes(query) ||
        pr.sourceBranch?.toLowerCase().includes(query)
      );
    });
  }, [allPRs, deferredSearch, itemPrIds]);

  return (
    <div className="flex h-full flex-col border border-border bg-background" style={{ borderRadius: "4px" }}>
      <div className="border-b border-border px-4 py-3">
        <SectionEyebrow icon={Search}>PR pool</SectionEyebrow>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-text-tertiary" strokeWidth={1.75} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search PRs, branch names, numbers"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse bg-muted/50"
                style={{ borderRadius: "4px", opacity: 1 - index * 0.12 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] leading-relaxed text-muted-foreground">
            {search
              ? "No matching pull requests in this project."
              : "All currently useful pull requests are already mapped to this release item."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => onAdd(pr)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/35"
              >
                <GitPullRequest className="mt-0.5 size-4 shrink-0 text-text-tertiary" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {pr.title || `PR #${pr.prNumber}`}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                      #{pr.prNumber}
                    </span>
                    {pr.sourceBranch ? (
                      <span className="truncate font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                        {pr.sourceBranch}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Plus className="mt-0.5 size-4 shrink-0 text-text-disabled" strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemPRRow({
  entry,
  onRemove,
}: {
  entry: PacketPrRow;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GitPullRequest className="mt-0.5 size-4 shrink-0 text-text-tertiary" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">
            {entry.pr.title || `PR #${entry.pr.prNumber}`}
          </p>
          <StateBadge state={entry.pr.state} draft={entry.pr.draft} />
          {entry.pr.mergeStatus !== "pending" ? (
            <MergeStatusBadge status={entry.pr.mergeStatus} />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
            #{entry.pr.prNumber}
          </span>
          {entry.pr.sourceBranch ? (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
              <GitBranch className="size-2.5" strokeWidth={1.8} />
              {entry.pr.sourceBranch}
            </span>
          ) : null}
          {entry.pr.authorLogin ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
              {entry.pr.authorLogin}
            </span>
          ) : null}
        </div>
        {entry.pr.htmlUrl ? (
          <a
            href={entry.pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            View on GitHub
            <ExternalLink className="size-3" strokeWidth={1.8} />
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-[2px] border border-transparent p-1 text-text-disabled transition-colors hover:border-border hover:text-signal-danger-text"
        aria-label="Remove pull request from release item"
      >
        <Minus className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function DependencyPanel({
  entries,
  deps,
  onAddDep,
  onRemoveDep,
}: {
  entries: PacketPrRow[];
  deps: Array<{ id: string; dependentPrId: string; prerequisitePrId: string }>;
  onAddDep: (dependentPrId: string, prerequisitePrId: string) => void;
  onRemoveDep: (id: string) => void;
}) {
  const dependentMap = new Map(
    entries.map((entry) => [entry.pr.id, entry]),
  );

  if (entries.length === 0) {
    return (
      <div className="border border-border bg-background px-4 py-6" style={{ borderRadius: "4px" }}>
        <SectionEyebrow icon={GitMerge}>Dependencies</SectionEyebrow>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Add pull requests to this release item before sequencing merge dependencies.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-background" style={{ borderRadius: "4px" }}>
      <div className="border-b border-border px-4 py-3">
        <SectionEyebrow icon={GitMerge}>Dependencies</SectionEyebrow>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Model merge order inside this business lane without losing the release narrative above it.
        </p>
      </div>

      <div className="space-y-4 p-4">
        {entries.map((entry) => {
          const currentDeps = deps.filter((dep) => dep.dependentPrId === entry.pr.id);
          const currentDepIds = new Set(currentDeps.map((dep) => dep.prerequisitePrId));
          const eligible = entries.filter(
            (candidate) =>
              candidate.pr.id !== entry.pr.id && !currentDepIds.has(candidate.pr.id),
          );

          return (
            <div key={entry.pr.id} className="border border-border bg-muted/20 px-3 py-3" style={{ borderRadius: "4px" }}>
              <p className="text-[13px] font-medium text-foreground">
                {entry.pr.title || `PR #${entry.pr.prNumber}`}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                waits for
              </p>

              <div className="mt-3 space-y-2">
                {currentDeps.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    No prerequisites yet.
                  </p>
                ) : (
                  currentDeps.map((dep) => {
                    const prerequisite = dependentMap.get(dep.prerequisitePrId);
                    if (!prerequisite) return null;
                    return (
                      <div
                        key={dep.id}
                        className="flex items-center gap-2 border border-border bg-background px-3 py-2"
                        style={{ borderRadius: "4px" }}
                      >
                        <CheckCircle2 className="size-3 shrink-0 text-signal-success-text" strokeWidth={2} />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                          #{prerequisite.pr.prNumber} {prerequisite.pr.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveDep(dep.id)}
                          className="text-text-disabled transition-colors hover:text-signal-danger-text"
                        >
                          <Minus className="size-3" strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {eligible.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {eligible.map((candidate) => (
                    <button
                      key={candidate.pr.id}
                      type="button"
                      onClick={() => onAddDep(entry.pr.id, candidate.pr.id)}
                      className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:bg-muted/40"
                      style={{ borderRadius: "4px" }}
                    >
                      <Plus className="size-3" strokeWidth={2} />
                      #{candidate.pr.prNumber}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MergeWaveView({
  entries,
  deps,
}: {
  entries: PacketPrRow[];
  deps: Array<{ dependentPrId: string; prerequisitePrId: string }>;
}) {
  const waves = packetTopologicalWaves(entries, deps);

  return (
    <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
      <SectionEyebrow icon={WandSparkles}>Merge waves</SectionEyebrow>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {waves.length === 0 ? (
          <div className="text-[12px] leading-relaxed text-muted-foreground">
            No merge wave data yet.
          </div>
        ) : (
          waves.map((wave, index) => (
            <div key={index} className="border border-border bg-muted/20 px-3 py-3" style={{ borderRadius: "4px" }}>
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                Wave {index + 1}
              </p>
              <div className="mt-3 space-y-2">
                {wave.map((entry) => (
                  <div
                    key={entry.pr.id}
                    className="border border-border bg-background px-3 py-2"
                    style={{ borderRadius: "4px" }}
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                      #{entry.pr.prNumber}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-foreground">
                      {entry.pr.title || `PR #${entry.pr.prNumber}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MergeLog({
  jobs,
  entries,
}: {
  jobs: Array<{ pullRequestId: string; prNumber: number; jobId: string }>;
  entries: PacketPrRow[];
}) {
  const entryMap = new Map(entries.map((entry) => [entry.pr.id, entry]));

  return (
    <div className="border border-border bg-background" style={{ borderRadius: "4px" }}>
      <div className="border-b border-border px-4 py-3">
        <SectionEyebrow icon={Rocket}>Merge queue</SectionEyebrow>
      </div>
      <div className="divide-y divide-border">
        {jobs.map((job, index) => {
          const entry = entryMap.get(job.pullRequestId);
          return (
            <div key={job.jobId} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <MergeStatusBadge status={entry?.pr.mergeStatus ?? "pending"} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                {entry?.pr.title || `PR #${job.prNumber}`}
              </span>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                #{job.prNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const z = useZero();

  const orgId = params?.orgId as string;
  const projectPublicId = params?.projectId as string;
  const releasePublicId = params?.releaseId as string;

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

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mergeLog, setMergeLog] = useState<
    Array<{ pullRequestId: string; prNumber: number; jobId: string }> | null
  >(null);

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
      .filter((entry): entry is PacketPrRow => entry !== null);
  }, [packetPrRows, prMap]);

  const packetPrIds = useMemo(
    () => new Set(packetEntries.map((entry) => entry.pr.id)),
    [packetEntries],
  );

  const itemAssignments = useMemo(() => {
    const map = new Map<string, string[]>();
    releaseItems.forEach((item) => {
      map.set(item.id, []);
    });
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
    normalizedItems.find((item) => item.id === selectedItemId) ?? null;

  const packetPeople = useMemo((): PacketPerson[] => {
    const userMap = new Map(orgUsers.map((user) => [user.id, user]));
    return releaseParticipants.map((participant) => {
      const user = userMap.get(participant.userId);
      return {
        id: participant.id,
        userId: participant.userId,
        email: user?.email ?? "unknown@deploytitan.local",
        role: participant.role as PacketParticipantRole,
        approvalStatus: participant.approvalStatus as "pending" | "approved",
        approvedAt: participant.approvedAt ?? null,
      };
    });
  }, [orgUsers, releaseParticipants]);

  const roleApprovals = useMemo((): Record<PacketApprovalKey, boolean> => {
    const stakeholders = packetPeople.filter((person) => person.role === "stakeholder");
    const teamLeads = packetPeople.filter((person) => person.role === "team_lead");
    const qaPeople = packetPeople.filter((person) => person.role === "qa");
    return {
      stakeholders:
        stakeholders.length > 0 &&
        stakeholders.every((person) => person.approvalStatus === "approved"),
      teamLead:
        teamLeads.length > 0 &&
        teamLeads.every((person) => person.approvalStatus === "approved"),
      qa:
        qaPeople.length > 0 &&
        qaPeople.every((person) => person.approvalStatus === "approved"),
    };
  }, [packetPeople]);

  const itemEntries = useMemo(() => {
    if (!selectedItem) return [];
    const selectedIds = new Set(selectedItem.prIds);
    return packetEntries.filter((entry) => selectedIds.has(entry.pr.id));
  }, [packetEntries, selectedItem]);

  const itemPrIds = useMemo(
    () => new Set(itemEntries.map((entry) => entry.pr.id)),
    [itemEntries],
  );

  const packetDeps = useMemo(
    () =>
      allProjectDeps
        .filter(
          (dep) =>
            packetPrIds.has(dep.dependentPrId) &&
            packetPrIds.has(dep.prerequisitePrId),
        )
        .map((dep) => ({
          id: dep.id,
          dependentPrId: dep.dependentPrId,
          prerequisitePrId: dep.prerequisitePrId,
        })),
    [allProjectDeps, packetPrIds],
  );

  const itemDeps = useMemo(
    () =>
      packetDeps.filter(
        (dep) =>
          itemPrIds.has(dep.dependentPrId) && itemPrIds.has(dep.prerequisitePrId),
      ),
    [itemPrIds, packetDeps],
  );

  const itemPool = useMemo((): PR[] => {
    return allProjectPRs
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
      }));
  }, [allProjectPRs, itemPrIds]);

  const mergeAllMutation = useMutation({
    mutationFn: () => mergeAllReleasePacket(packet?.id ?? ""),
    onSuccess: (response) => {
      setMergeLog(response.data.jobs);
    },
  });

  async function handleRename(name: string) {
    if (!packet) return;
    await z.mutate(mutators.releasePacket.update({ id: packet.id, name })).client;
  }

  async function handleStatusChange(status: PacketStatus) {
    if (!packet) return;
    await z.mutate(mutators.releasePacket.update({ id: packet.id, status })).client;
  }

  async function handlePacketFieldBlur(
    field: "summary" | "launchWindow" | "slackHeadline",
    value: string,
  ) {
    if (!packet) return;
    const existing =
      field === "summary"
        ? packet.summary ?? ""
        : field === "launchWindow"
          ? packet.launchWindow ?? ""
          : packet.slackHeadline ?? "";
    const trimmed = value.trim();
    if (trimmed === existing) return;
    await z.mutate(mutators.releasePacket.update({ id: packet.id, [field]: trimmed })).client;
  }

  async function createItem(
    template?: Partial<Pick<ReleaseItem, "kind" | "title" | "summary" | "impact">>,
  ) {
    if (!packet) return;
    const item = createReleaseItem(template);
    await z.mutate(
      mutators.releasePacketItem.create({
        id: item.id,
        publicId: `rpi_${Math.random().toString(36).slice(2, 18)}`,
        releasePacketId: packet.id,
        title: item.title,
        kind: item.kind,
        summary: item.summary || undefined,
        impact: item.impact || undefined,
        status: item.status,
        position: normalizedItems.length,
      }),
    ).client;
    startTransition(() => setSelectedItemId(item.id));
  }

  async function handleItemFieldBlur(
    itemId: string,
    field: "title" | "summary" | "impact",
    value: string,
  ) {
    const existing = normalizedItems.find((item) => item.id === itemId);
    if (!existing) return;
    const nextValue = value.trim();
    if (nextValue === existing[field]) return;
    await z.mutate(mutators.releasePacketItem.update({ id: itemId, [field]: nextValue })).client;
  }

  async function handleItemStatusUpdate(itemId: string, status: ReleaseItemStatus) {
    await z.mutate(mutators.releasePacketItem.update({ id: itemId, status })).client;
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
    if (selectedItem.status === "planning") {
      await handleItemStatusUpdate(selectedItem.id, "review");
    }
  }

  async function handleRemovePRFromItem(prId: string) {
    if (!selectedItem) return;

    const remainingInOtherItems = normalizedItems.some(
      (item) => item.id !== selectedItem.id && item.prIds.includes(prId),
    );

    const itemPrRow = releaseItemPrRows.find(
      (row) => row.releasePacketItemId === selectedItem.id && row.pullRequestId === prId,
    );
    if (itemPrRow) {
      await z.mutate(mutators.releasePacketItemPr.remove({ id: itemPrRow.id })).client;
    }

    if (remainingInOtherItems) return;

    const packetRow = packetEntries.find((entry) => entry.pr.id === prId);
    if (packetRow) {
      await z.mutate(mutators.releasePacketPr.remove({ id: packetRow.packetPrId })).client;
    }

    for (const dep of packetDeps) {
      if (dep.dependentPrId === prId || dep.prerequisitePrId === prId) {
        await z.mutate(mutators.prDependency.remove({ id: dep.id })).client;
      }
    }
  }

  async function handleAddDep(dependentPrId: string, prerequisitePrId: string) {
    const dependent = itemEntries.find((entry) => entry.pr.id === dependentPrId);
    const prerequisite = itemEntries.find(
      (entry) => entry.pr.id === prerequisitePrId,
    );
    if (!dependent || !prerequisite || !project) return;
    await z.mutate(
      mutators.prDependency.add({
        id: generateId(),
        publicId: `prd_${Math.random().toString(36).slice(2, 18)}`,
        projectId: project.id,
        dependentPrId,
        prerequisitePrId,
        dependentPrNumber: dependent.pr.prNumber,
        prerequisitePrNumber: prerequisite.pr.prNumber,
        source: "ui",
        waitForDeploy: false,
      }),
    ).client;
  }

  async function handleRemoveDep(id: string) {
    await z.mutate(mutators.prDependency.remove({ id })).client;
  }

  async function handleAddParticipant(userId: string, role: PacketParticipantRole) {
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

  async function handleToggleParticipantsByRole(role: PacketParticipantRole, active: boolean) {
    const relevant = packetPeople.filter((person) => person.role === role);
    await Promise.all(
      relevant.map((person) =>
        z.mutate(
          mutators.releasePacketParticipant.update({
            id: person.id,
            approvalStatus: active ? "pending" : "approved",
            approvedAt: active ? null : Date.now(),
          }),
        ).client,
      ),
    );
  }

  async function handleToggleParticipantApproval(person: PacketPerson) {
    const nextApproved = person.approvalStatus !== "approved";
    await z.mutate(
      mutators.releasePacketParticipant.update({
        id: person.id,
        approvalStatus: nextApproved ? "approved" : "pending",
        approvedAt: nextApproved ? Date.now() : null,
      }),
    ).client;
  }

  async function handleRemoveParticipant(id: string) {
    await z.mutate(mutators.releasePacketParticipant.remove({ id })).client;
  }

  const approvalsComplete = Object.values(roleApprovals).filter(Boolean).length;
  const itemCount = normalizedItems.length;
  const assignedPrCount = normalizedItems.reduce((count, item) => count + item.prIds.length, 0);
  const completeItems = normalizedItems.filter(
    (item) =>
      Boolean(item.summary.trim()) &&
      Boolean(item.impact.trim()) &&
      item.prIds.length > 0,
  ).length;
  const packetState = packetStatus(packet?.status ?? null);
  const canMerge =
    packetEntries.length > 0 &&
    !mergeAllMutation.isPending &&
    packetState !== "merged" &&
    packetState !== "merging";

  if (!packet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-pulse bg-muted/60" style={{ borderRadius: "4px" }} />
          <p className="text-[13px] text-muted-foreground">Loading release packet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-muted/15">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(`/orgs/${orgId}/projects/${projectPublicId}/releases`)
              }
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.75} />
              All releases
            </button>
            <span className="text-text-disabled">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              {project?.name ?? "Project"}
            </span>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[72ch]">
              <SectionEyebrow icon={PackageCheck}>Release packet</SectionEyebrow>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <EditableName value={packet.name} onSave={handleRename} />
                <PacketStatusBadge status={packetState} />
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                Turn this release into a company-ready packet first, then drop into item-level PR orchestration only where engineering detail is needed.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {selectedItem ? (
                <Button variant="outline" size="sm" onClick={() => setSelectedItemId(null)}>
                  <ArrowLeft className="size-3.5" />
                  Release overview
                </Button>
              ) : null}

              {packetState === "draft" ? (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange("ready")}>
                  <ShieldCheck className="size-3.5" />
                  Mark ready
                </Button>
              ) : null}

              <Button
                size="sm"
                onClick={() => mergeAllMutation.mutate()}
                disabled={!canMerge}
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReadinessMetric
              label="Release items"
              value={`${itemCount}`}
              hint={
                itemCount === 0
                  ? "Add business lanes before this packet becomes approval-ready."
                  : `${completeItems} lanes already have story, impact, and mapped pull requests.`
              }
            />
            <ReadinessMetric
              label="Approvals"
              value={`${approvalsComplete}/3`}
              hint="Track stakeholder, team lead, and QA sign-off in one place."
            />
            <ReadinessMetric
              label="Mapped PRs"
              value={`${assignedPrCount}`}
              hint="The mergeable packet stays in sync underneath item-level planning."
            />
            <ReadinessMetric
              label="Last activity"
              value={formatRelative(packet.updatedAt)}
              hint={`Created ${formatDate(packet.createdAt)}.`}
            />
          </div>

          {mergeAllMutation.isError ? (
            <div className="flex items-center gap-2 border border-signal-danger/20 bg-signal-danger/10 px-4 py-3" style={{ borderRadius: "4px" }}>
              <AlertTriangle className="size-4 shrink-0 text-signal-danger-text" strokeWidth={1.75} />
              <p className="text-[12px] leading-relaxed text-signal-danger-text">
                {mergeAllMutation.error instanceof Error
                  ? mergeAllMutation.error.message
                  : "The merge run failed. Check packet dependencies and PR status."}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6 lg:px-8">
        {!selectedItem ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-6">
                <div className="border border-border bg-background px-5 py-5" style={{ borderRadius: "4px" }}>
                  <SectionEyebrow icon={Rocket}>Launch narrative</SectionEyebrow>
                  <textarea
                    key={`summary-${packet.id}-${packet.updatedAt ?? 0}`}
                    defaultValue={
                      packet.summary ??
                      "Describe the business story for this release so the packet reads clearly before anyone thinks about pull requests."
                    }
                    onBlur={(event) => handlePacketFieldBlur("summary", event.target.value)}
                    className="mt-3 min-h-[120px] w-full resize-y border border-border bg-background px-3 py-3 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary/30"
                    style={{ borderRadius: "4px" }}
                  />

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                        Launch window
                      </p>
                      <Input
                        key={`launch-window-${packet.id}-${packet.updatedAt ?? 0}`}
                        defaultValue={packet.launchWindow ?? ""}
                        onBlur={(event) =>
                          handlePacketFieldBlur("launchWindow", event.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                        Slack headline preview
                      </p>
                      <Input
                        key={`slack-headline-${packet.id}-${packet.updatedAt ?? 0}`}
                        defaultValue={packet.slackHeadline ?? ""}
                        onBlur={(event) =>
                          handlePacketFieldBlur("slackHeadline", event.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>

                <ReleaseItemComposer onCreate={createItem} />

                <div className="grid gap-4 lg:grid-cols-2">
                  {normalizedItems.length === 0 ? (
                    <div className="border border-dashed border-border bg-muted/15 px-5 py-8 text-center" style={{ borderRadius: "4px" }}>
                      <p className="text-[14px] font-medium text-foreground">
                        Build the packet narrative first
                      </p>
                      <p className="mx-auto mt-2 max-w-[46ch] text-[12px] leading-relaxed text-muted-foreground">
                        Add release items like features, bug fixes, or rollout work. Each item becomes the doorway into the detailed PR workflow.
                      </p>
                    </div>
                  ) : (
                    normalizedItems.map((item) => (
                      <ReleaseItemCard
                        key={item.id}
                        item={item}
                        participantCount={packetPeople.length}
                        onOpen={() => setSelectedItemId(item.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
                  <SectionEyebrow icon={ShieldCheck}>Approval spine</SectionEyebrow>
                  <div className="mt-4 space-y-3">
                    <ApprovalChip
                      active={roleApprovals.stakeholders}
                      onToggle={() =>
                        handleToggleParticipantsByRole("stakeholder", roleApprovals.stakeholders)
                      }
                      label="Stakeholder approval"
                      detail="Business stakeholders agree the packet tells the right release story."
                    />
                    <ApprovalChip
                      active={roleApprovals.teamLead}
                      onToggle={() =>
                        handleToggleParticipantsByRole("team_lead", roleApprovals.teamLead)
                      }
                      label="Team lead approval"
                      detail="Engineering leadership signs off on scope, sequencing, and launch timing."
                    />
                    <ApprovalChip
                      active={roleApprovals.qa}
                      onToggle={() =>
                        handleToggleParticipantsByRole("qa", roleApprovals.qa)
                      }
                      label="QA approval"
                      detail="Quality confirms coverage, sign-off, and packet readiness before rollout."
                    />
                  </div>
                </div>

                <StakeholderRoster
                  stakeholders={packetPeople}
                  availableUsers={orgUsers
                    .filter(
                      (user) =>
                        !packetPeople.some((person) => person.userId === user.id && person.role === "stakeholder"),
                    )
                    .map((user) => ({ id: user.id, email: user.email }))}
                  onAdd={({ userId, role }) => handleAddParticipant(userId, role)}
                  onToggleApproval={handleToggleParticipantApproval}
                  onRemove={handleRemoveParticipant}
                />

                <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
                  <SectionEyebrow icon={MessageSquareShare}>Slack publish preview</SectionEyebrow>
                  <div className="mt-4 border border-border bg-muted/20 px-4 py-4" style={{ borderRadius: "4px" }}>
                    <p className="text-[13px] font-medium text-foreground">
                      {packet.slackHeadline || "Add a Slack headline to frame this release for the company."}
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                      Launch window: {packet.launchWindow || "Not set yet"}. This preview will roll up approved release items into one company-readable changelog.
                    </p>
                    <div className="mt-4 space-y-3">
                      {normalizedItems.length === 0 ? (
                        <p className="text-[12px] text-muted-foreground">
                          Add release items to build the changelog preview.
                        </p>
                      ) : (
                        normalizedItems.map((item) => (
                          <div key={item.id} className="border border-border bg-background px-3 py-3" style={{ borderRadius: "4px" }}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] font-medium text-foreground">
                                {item.title}
                              </p>
                              <span
                                className={cn(
                                  "inline-flex border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.08em]",
                                  ITEM_STATUS_META[item.status].cls,
                                )}
                                style={{ borderRadius: "2px" }}
                              >
                                {ITEM_STATUS_META[item.status].label}
                              </span>
                            </div>
                            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                              {item.impact || item.summary || "Add impact notes so the publish message feels intentional."}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {mergeLog ? <MergeLog jobs={mergeLog} entries={packetEntries} /> : null}
          </>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <div className="space-y-6">
              <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
                <SectionEyebrow icon={Sparkles}>Release item</SectionEyebrow>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.08em]",
                      ITEM_KIND_META[selectedItem.kind].badge,
                    )}
                    style={{ borderRadius: "2px" }}
                  >
                    {ITEM_KIND_META[selectedItem.kind].label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.08em]",
                      ITEM_STATUS_META[selectedItem.status].cls,
                    )}
                    style={{ borderRadius: "2px" }}
                  >
                    {ITEM_STATUS_META[selectedItem.status].label}
                  </span>
                </div>

                <Input
                  key={`item-title-${selectedItem.id}-${selectedItem.title}`}
                  defaultValue={selectedItem.title}
                  onBlur={(event) =>
                    handleItemFieldBlur(selectedItem.id, "title", event.target.value)
                  }
                  className="mt-3"
                />

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                      Business summary
                    </p>
                    <textarea
                      key={`item-summary-${selectedItem.id}-${selectedItem.summary}`}
                      defaultValue={selectedItem.summary}
                      onBlur={(event) =>
                        handleItemFieldBlur(selectedItem.id, "summary", event.target.value)
                      }
                      className="mt-2 min-h-[110px] w-full resize-y border border-border bg-background px-3 py-3 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary/30"
                      style={{ borderRadius: "4px" }}
                    />
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                      Customer or company impact
                    </p>
                    <textarea
                      key={`item-impact-${selectedItem.id}-${selectedItem.impact}`}
                      defaultValue={selectedItem.impact}
                      onBlur={(event) =>
                        handleItemFieldBlur(selectedItem.id, "impact", event.target.value)
                      }
                      className="mt-2 min-h-[110px] w-full resize-y border border-border bg-background px-3 py-3 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary/30"
                      style={{ borderRadius: "4px" }}
                    />
                  </div>
                </div>
              </div>

              <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
                <SectionEyebrow icon={Users}>Packet approvers</SectionEyebrow>
                <div className="mt-4 grid gap-3">
                  {packetPeople.length === 0 ? (
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      Add approvers on the overview first. Every release item inherits the same release packet sign-off group today.
                    </p>
                  ) : (
                    packetPeople.map((person) => (
                      <StakeholderAvatar key={person.id} stakeholder={person} />
                    ))
                  )}
                </div>

                <div className="mt-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                    Approval model
                  </p>
                  <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                    Item-specific owner assignment is not modeled in the current schema yet, so this lane uses packet-level stakeholders, team leads, and QA sign-off.
                  </p>
                </div>
              </div>

              <div className="border border-border bg-background px-4 py-4" style={{ borderRadius: "4px" }}>
                <SectionEyebrow icon={ShieldCheck}>Readiness cues</SectionEyebrow>
                <div className="mt-4 space-y-3">
                  <ApprovalChip
                    active={selectedItem.status === "review" || selectedItem.status === "approved"}
                    onToggle={() =>
                      handleItemStatusUpdate(
                        selectedItem.id,
                        selectedItem.status === "planning"
                          ? "review"
                          : selectedItem.status === "review"
                            ? "planning"
                            : "review",
                      )
                    }
                    label="Ready for review"
                    detail="Signal that the business story is ready for engineering and approvals."
                  />
                  <ApprovalChip
                    active={selectedItem.status === "approved"}
                    onToggle={() =>
                      handleItemStatusUpdate(
                        selectedItem.id,
                        selectedItem.status === "approved" ? "review" : "approved",
                      )
                    }
                    label="Approved lane"
                    detail="Use after team lead, QA, and stakeholders are aligned on this item."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border border-border bg-muted/15 px-5 py-5" style={{ borderRadius: "4px" }}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-[60ch]">
                    <SectionEyebrow icon={GitPullRequest}>Engineering detail</SectionEyebrow>
                    <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">
                      {selectedItem.title}
                    </h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                      This is the original PR planning workflow, now scoped to a single release item so business context stays intact.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ReadinessMetric
                      label="PRs"
                      value={`${selectedItem.prIds.length}`}
                      hint="Work mapped to this lane."
                    />
                    <ReadinessMetric
                      label="Approvers"
                      value={`${packetPeople.length}`}
                      hint="Packet-level sign-off shared across every lane."
                    />
                    <ReadinessMetric
                      label="Waves"
                      value={`${packetTopologicalWaves(itemEntries, itemDeps).length || 0}`}
                      hint="Sequential merge groups."
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 2xl:grid-cols-[320px_1fr]">
                <PRPoolPanel
                  allPRs={itemPool}
                  itemPrIds={itemPrIds}
                  loading={prsStatus.type === "unknown"}
                  onAdd={handleAddPRToItem}
                />

                <div className="space-y-6">
                  <div className="border border-border bg-background" style={{ borderRadius: "4px" }}>
                    <div className="border-b border-border px-4 py-3">
                      <SectionEyebrow icon={GitPullRequest}>Mapped pull requests</SectionEyebrow>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                        Pull requests added here remain part of the packet-wide merge run, but the planning conversation is now item-specific.
                      </p>
                    </div>
                    <div>
                      {packetPrStatus.type === "unknown" ? (
                        <div className="space-y-2 p-4">
                          {[...Array(3)].map((_, index) => (
                            <div
                              key={index}
                              className="h-[72px] animate-pulse bg-muted/50"
                              style={{ borderRadius: "4px", opacity: 1 - index * 0.14 }}
                            />
                          ))}
                        </div>
                      ) : itemEntries.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[12px] leading-relaxed text-muted-foreground">
                          Add pull requests from the pool to connect this release item with real engineering work.
                        </div>
                      ) : (
                        itemEntries.map((entry) => (
                          <ItemPRRow
                            key={entry.packetPrId}
                            entry={entry}
                            onRemove={() => handleRemovePRFromItem(entry.pr.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <MergeWaveView entries={itemEntries} deps={itemDeps} />
                  <DependencyPanel
                    entries={itemEntries}
                    deps={itemDeps}
                    onAddDep={handleAddDep}
                    onRemoveDep={handleRemoveDep}
                  />
                  {mergeLog ? <MergeLog jobs={mergeLog} entries={packetEntries} /> : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
