"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@deploytitan/zero-schema";
import Link from "next/link";
import { Plus, ArrowRight, FolderGit2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateProject } from "@/hooks/useCreateProject";
import { cn } from "@/lib/utils";

function formatDate(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function truncateId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 20)}…` : id;
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 animate-fade-up">
      <div
        className="mb-5 flex size-11 items-center justify-center border border-border bg-muted/60"
        style={{ borderRadius: "2px" }}
      >
        <FolderGit2
          className="size-5 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
      <p className="mb-1.5 text-[15px] font-medium text-foreground tracking-tight">
        No projects yet
      </p>
      <p className="mb-7 text-[13px] text-muted-foreground max-w-[280px] text-center leading-relaxed">
        Projects organize services, rollouts, and release policies for a bounded
        scope of your system.
      </p>
      <Button variant="default" size="sm" onClick={onNew}>
        <Plus className="size-3.5" />
        New Project
      </Button>
    </div>
  );
}

type Project = {
  id: string;
  orgId: string;
  name: string;
  createdAt: number | null;
  updatedAt: number | null;
};

function ProjectRow({ project, href }: { project: Project; href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 px-5 py-3.5 border-b border-border",
        "transition-colors duration-100",
        "hover:bg-muted/50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-foreground truncate leading-snug">
          {project.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2.5">
          <span className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground/70 uppercase">
            {truncateId(project.id)}
          </span>
          {project.createdAt && (
            <>
              <span className="text-border select-none" aria-hidden>
                ·
              </span>
              <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground/50">
                {formatDate(project.createdAt)}
              </span>
            </>
          )}
        </div>
      </div>
      <ArrowRight
        className="size-3.5 shrink-0 text-muted-foreground/40 transition-all duration-100 group-hover:text-muted-foreground group-hover:translate-x-0.5"
        strokeWidth={1.75}
      />
    </Link>
  );
}

function CreateProjectDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { create } = useCreateProject();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const project = await create({ orgId, name: trimmed });
      onOpenChange(false);
      setName("");
      startTransition(() => {
        router.push(`/orgs/${orgId}/projects/${project.id}/overview`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setName("");
      setError(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-[400px]"
        style={{ borderRadius: "2px" }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              New Project
            </DialogTitle>
          </DialogHeader>

          <div className="mt-5 space-y-1.5">
            <label
              htmlFor="project-name"
              className="block font-mono text-[10px] tracking-[0.08em] uppercase text-muted-foreground"
            >
              Name
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-service-rollouts"
              maxLength={64}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="h-8 font-mono text-[13px]"
            />
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Lowercase letters, numbers, and hyphens. Identifies this project
              across rollouts and policies.
            </p>
          </div>

          {error && (
            <div
              className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-destructive/8 border border-destructive/20 text-destructive text-[12px]"
              style={{ borderRadius: "2px" }}
              role="alert"
            >
              <AlertCircle
                className="mt-px size-3.5 shrink-0"
                strokeWidth={1.75}
              />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <DialogFooter className="mt-5 -mx-4 -mb-4 rounded-none border-t border-border/70 bg-muted/30 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={!name.trim()}
            >
              {"Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [projects, details] = useQuery(queries.projectsByOrgId({ orgId }));

  const [dialogOpen, setDialogOpen] = useState(false);

  const isLoading = details.type === "unknown";
  const hasProjects = projects.length > 0;

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Page header */}
        <div className="border-b border-border px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[17px] font-semibold text-foreground tracking-tight leading-none">
                Projects
              </h1>
              {!isLoading && (
                <p className="mt-1 font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50">
                  {projects.length === 0
                    ? "No projects"
                    : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
                </p>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              New Project
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {isLoading ? (
            <div className="space-y-px">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-[60px] animate-pulse bg-muted/40 border border-border/50"
                  style={{
                    borderRadius: "2px",
                    animationDelay: `${i * 60}ms`,
                    opacity: 1 - i * 0.2,
                  }}
                />
              ))}
            </div>
          ) : hasProjects ? (
            <div
              className="border border-border overflow-hidden animate-fade-up"
              style={{ borderRadius: "2px" }}
            >
              {(projects as Project[]).map((project, i) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  href={`/orgs/${orgId}/projects/${project.id}/overview`}
                />
              ))}
            </div>
          ) : (
            <EmptyState onNew={() => setDialogOpen(true)} />
          )}
        </div>
      </div>

      <CreateProjectDialog
        orgId={orgId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
