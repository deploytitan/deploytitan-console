"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useZero } from "@rocicorp/zero/react";
import { queries, mutators } from "@deploytitan/zero-schema";
import {
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  PackageX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReleasePacketStatus = "draft" | "ready" | "merging" | "merged" | "failed";

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function generateId(): string {
  return crypto.randomUUID();
}

function generatePublicId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const statusConfig: Record<
  ReleasePacketStatus,
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
  merging: {
    label: "merging",
    icon: Loader2,
    cls: "text-signal-deploy-text bg-signal-deploy/8 border-signal-deploy/25",
  },
  merged: {
    label: "merged",
    icon: CheckCircle2,
    cls: "text-signal-success-text bg-signal-success/8 border-signal-success/25",
  },
  failed: {
    label: "failed",
    icon: AlertTriangle,
    cls: "text-signal-danger-text bg-signal-danger/8 border-signal-danger/25",
  },
};

function StatusBadge({ status }: { status: ReleasePacketStatus }) {
  const { label, icon: Icon, cls } = statusConfig[status] ?? statusConfig.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[8px] tracking-[0.06em] uppercase px-1.5 py-px border",
        cls,
      )}
      style={{ borderRadius: "1px" }}
    >
      <Icon
        className={cn("size-2", status === "merging" && "animate-spin")}
        strokeWidth={2}
      />
      {label}
    </span>
  );
}

// ── Create dialog (inline) ────────────────────────────────────────────────────

function CreatePacketForm({
  projectId,
  onCreated,
  onCancel,
}: {
  projectId: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const z = useZero();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const id = generateId();
    const publicId = generatePublicId("rp");
    await z.mutate(mutators.releasePacket.create({
      id,
      publicId,
      projectId,
      name: name.trim(),
      description: description.trim() || undefined,
    })).client;
    onCreated(publicId);
  }

  return (
    <form
      onSubmit={handleCreate}
      className="border border-border bg-muted/30 px-5 py-4 space-y-3"
      style={{ borderRadius: "4px" }}
    >
      <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
        New release
      </p>
      <div className="space-y-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Release name"
          className={cn(
            "w-full px-3 py-2 text-[13px] text-foreground bg-background",
            "border border-border focus:border-primary/40 outline-none",
            "placeholder:text-text-tertiary transition-colors duration-100",
          )}
          style={{ borderRadius: "2px" }}
          maxLength={120}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Release summary (optional)"
          className={cn(
            "w-full px-3 py-2 text-[13px] text-foreground bg-background",
            "border border-border focus:border-primary/40 outline-none",
            "placeholder:text-text-tertiary transition-colors duration-100",
          )}
          style={{ borderRadius: "2px" }}
          maxLength={280}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!name.trim() || busy}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Create release
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Delete confirm inline ─────────────────────────────────────────────────────

function DeleteConfirm({
  packetName,
  onConfirm,
  onCancel,
}: {
  packetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-signal-danger/5 border border-signal-danger/20" style={{ borderRadius: "2px" }}>
      <span className="text-[12px] text-foreground min-w-0 flex-1">
        Delete <span className="font-medium">{packetName}</span>?
      </span>
      <button
        onClick={onConfirm}
        className="font-mono text-[10px] tracking-[0.06em] uppercase text-signal-danger-text hover:text-signal-danger-text transition-colors"
      >
        Delete
      </button>
      <button
        onClick={onCancel}
        className="font-mono text-[10px] tracking-[0.06em] uppercase text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PacketRow({
  packet,
  orgId,
  projectPublicId,
}: {
  packet: {
    id: string;
    publicId: string | null;
    name: string;
    status: string | null;
    createdAt: number | null;
    updatedAt: number | null;
  };
  orgId: string;
  projectPublicId: string;
}) {
  const z = useZero();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await z.mutate(mutators.releasePacket.delete({ id: packet.id })).client;
  }

  const href = `/orgs/${orgId}/projects/${projectPublicId}/releases/${packet.publicId ?? packet.id}`;

  if (confirming) {
    return (
      <div className="px-5 py-2.5 border-b border-border last:border-b-0">
        <DeleteConfirm
          packetName={packet.name}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors duration-100">
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => router.push(href)}
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[14px] font-medium text-foreground truncate leading-snug">
            {packet.name}
          </p>
          <StatusBadge status={(packet.status ?? "draft") as ReleasePacketStatus} />
        </div>
        <p className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-text-tertiary">
          {packet.updatedAt
            ? `Updated ${formatDate(packet.updatedAt)}`
            : `Created ${formatDate(packet.createdAt)}`}
        </p>
      </button>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
        <button
          onClick={() => setConfirming(true)}
          className="p-1.5 text-text-tertiary hover:text-signal-danger-text transition-colors duration-100"
          aria-label="Delete packet"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
        <ArrowRight
          className="size-3.5 text-text-tertiary group-hover:translate-x-0.5 transition-all duration-100"
          strokeWidth={1.75}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReleasesPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.orgId as string;
  const projectPublicId = params?.projectId as string;

  const [project] = useQuery(
    queries.projectByPublicId({ publicId: projectPublicId }),
  );

  const [packets, packetsStatus] = useQuery(
    queries.releasePacketsByProjectId({ projectId: project?.id ?? "" }),
  );

  const [showCreate, setShowCreate] = useState(false);
  const isLoading = packetsStatus.type === "unknown" || !project;

  function handleCreated(id: string) {
    setShowCreate(false);
    router.push(
      `/orgs/${orgId}/projects/${projectPublicId}/releases/${id}`,
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight leading-none">
              Releases
            </h1>
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
              Business-first release packets with scoped engineering detail
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            disabled={showCreate}
          >
            <Plus className="size-3.5" />
            New release
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6 space-y-4 animate-fade-up">
        {/* Create form */}
        {showCreate && project && (
          <CreatePacketForm
            projectId={project.id}
            onCreated={handleCreated}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Packet list */}
        {isLoading ? (
          <div
            className="border border-border overflow-hidden"
            style={{ borderRadius: "4px" }}
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-[60px] bg-muted/40 animate-pulse border-b border-border last:border-b-0"
                style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.2 }}
              />
            ))}
          </div>
        ) : packets.length === 0 && !showCreate ? (
          <div
            className="flex flex-col items-center justify-center py-16 border border-border"
            style={{ borderRadius: "4px", borderStyle: "dashed" }}
          >
            <div
              className="mb-4 flex size-10 items-center justify-center border border-border bg-muted/60"
              style={{ borderRadius: "4px" }}
            >
              <PackageX
                className="size-4 text-text-tertiary"
                strokeWidth={1.5}
              />
            </div>
            <p className="mb-1 text-[14px] font-medium text-foreground tracking-tight">
              No releases yet
            </p>
            <p className="mb-5 text-[12px] text-muted-foreground text-center max-w-[280px] leading-relaxed">
              Create a release packet, shape the customer-facing story, then open each release item to map the pull requests behind it.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              New release
            </Button>
          </div>
        ) : packets.length > 0 ? (
          <div>
            <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-2">
              {packets.length} {packets.length === 1 ? "release" : "releases"}
            </p>
            <div
              className="border border-border overflow-hidden"
              style={{ borderRadius: "4px" }}
            >
              {packets.map((packet) => (
                <PacketRow
                  key={packet.id}
                  packet={packet}
                  orgId={orgId}
                  projectPublicId={projectPublicId}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
