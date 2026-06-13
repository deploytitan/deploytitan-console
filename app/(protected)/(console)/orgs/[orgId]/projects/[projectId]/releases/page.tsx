"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  PackageX,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";

type ReleaseStatus = "draft" | "ready" | "in_progress" | "shipped" | "blocked";

const statusConfig: Record<
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

function StatusBadge({ status }: { status: ReleaseStatus }) {
  const { label, icon: Icon, cls } = statusConfig[status];
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

export default function ReleasesPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const data = useQuery(api.console.getProjectReleases, {
    projectPublicId: projectId,
  });
  const isLoading = data === undefined;
  const createRelease = useMutation(api.console.createRelease);
  const deleteRelease = useMutation(api.console.deleteRelease);

  const project = data?.project;
  const releases = data?.releases ?? [];

  return (
    <div className="min-h-screen bg-background px-8 py-7">
      <div className="mb-8">
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-2">
          Releases
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {project?.name ?? "Project"}
        </h1>
      </div>

      <div className="border border-border bg-muted/20 p-4 mb-6" style={{ borderRadius: "4px" }}>
        <div className="grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Release name"
            className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
            style={{ borderRadius: "4px" }}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short release summary"
            className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
            style={{ borderRadius: "4px" }}
          />
        </div>
        <Button
          className="mt-3"
          size="sm"
          disabled={!name.trim()}
          onClick={async () => {
            await createRelease({
              projectPublicId: projectId,
              name,
              description,
            });
            setName("");
            setDescription("");
          }}
        >
          <Plus className="size-3.5" />
          Create Release
        </Button>
      </div>

      <div className="border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-[52px] animate-pulse bg-muted/40 border-b border-border last:border-b-0" />
          ))
        ) : releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <PackageX className="mb-4 size-8 text-text-tertiary" />
            <p className="text-[14px] font-medium text-foreground">No releases yet</p>
            <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              Start a release packet as soon as work begins so the team is coordinating
              in product, not in chat archaeology.
            </p>
          </div>
        ) : (
          releases.map((release) => (
            <div
              key={release.id}
              className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
            >
              <Link
                href={`/orgs/${orgId}/projects/${projectId}/releases/${release.publicId}`}
                className="min-w-0 flex-1"
              >
                <p className="text-[14px] font-medium text-foreground">{release.name}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {release.description || "No release summary yet."}
                </p>
              </Link>
              <StatusBadge status={release.status} />
              <button
                className="text-text-tertiary hover:text-signal-danger-text"
                onClick={() =>
                  deleteRelease({ releasePublicId: release.publicId })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
              <Link href={`/orgs/${orgId}/projects/${projectId}/releases/${release.publicId}`}>
                <ArrowRight className="size-3.5 text-text-tertiary" />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
