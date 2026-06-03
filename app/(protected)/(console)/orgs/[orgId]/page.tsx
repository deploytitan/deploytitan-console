"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@deploytitan/zero-schema";
import Link from "next/link";
import { ArrowRight, FolderGit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/console/CreateProjectDialog";
import { cn } from "@/lib/utils";

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

function planLabel(allocatedPlanId: string | null): string {
  if (!allocatedPlanId) return "Starter";
  const lower = allocatedPlanId.toLowerCase();
  if (lower.includes("enterprise")) return "Enterprise";
  if (lower.includes("pro")) return "Pro";
  const words = allocatedPlanId.replace(/[-_]/g, " ").split(" ");
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function StatRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {loading ? (
        <span
          className="inline-block w-14 h-3 bg-muted animate-pulse"
          style={{ borderRadius: "2px" }}
        />
      ) : (
        <span className="font-mono text-[10px] tracking-[0.05em] text-foreground">
          {value}
        </span>
      )}
    </div>
  );
}

export default function OrgOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [dialogOpen, setDialogOpen] = useState(false);

  const [org] = useQuery(queries.orgById({ workosOrgId: orgId }));
  const [projects, projectsStatus] = useQuery(
    queries.projectsByOrgId({ orgId }),
  );

  const isLoading = projectsStatus.type === "unknown";
  const orgLoading = !org;

  const sortedProjects = [...projects].sort(
    (a, b) =>
      (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
  );

  const totalCount = projects.length;

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              {orgLoading ? (
                <div
                  className="h-[17px] w-40 bg-muted animate-pulse"
                  style={{ borderRadius: "2px" }}
                />
              ) : (
                <h1 className="text-[17px] font-semibold text-foreground tracking-tight leading-none">
                  {org.name}
                </h1>
              )}
              <p className="mt-1.5 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                {orgLoading ? "—" : `${planLabel(org.allocatedPlanId)} plan`}
              </p>
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

        {/* Body */}
        <div className="px-8 py-7 animate-fade-up">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 items-start">
            {/* Left: Projects */}
            <section>
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-3">
                Projects
              </p>

              {isLoading ? (
                <div
                  className="border border-border overflow-hidden"
                  style={{ borderRadius: "4px" }}
                >
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-[56px] bg-muted/40 animate-pulse border-b border-border last:border-b-0"
                      style={{
                        animationDelay: `${i * 60}ms`,
                        opacity: 1 - i * 0.18,
                      }}
                    />
                  ))}
                </div>
              ) : sortedProjects.length > 0 ? (
                <div
                  className="border border-border overflow-hidden"
                  style={{ borderRadius: "4px" }}
                >
                  {sortedProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/orgs/${orgId}/projects/${project.publicId ?? project.id}/overview`}
                      className={cn(
                        "group flex items-center gap-4 px-5 py-3.5",
                        "border-b border-border last:border-b-0",
                        "transition-colors duration-100 hover:bg-muted/50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-foreground truncate leading-snug">
                          {project.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-text-tertiary">
                          {project.updatedAt
                            ? `Updated ${formatDate(project.updatedAt)}`
                            : `Created ${formatDate(project.createdAt)}`}
                        </p>
                      </div>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-text-tertiary transition-all duration-100 group-hover:text-muted-foreground group-hover:translate-x-0.5"
                        strokeWidth={1.75}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-16 border border-border"
                  style={{ borderRadius: "4px", borderStyle: "dashed" }}
                >
                  <div
                    className="mb-4 flex size-10 items-center justify-center border border-border bg-muted/60"
                    style={{ borderRadius: "4px" }}
                  >
                    <FolderGit2
                      className="size-4 text-text-tertiary"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="mb-1 text-[14px] font-medium text-foreground tracking-tight">
                    No projects yet
                  </p>
                  <p className="mb-5 text-[12px] text-muted-foreground text-center max-w-[260px] leading-relaxed">
                    Projects organize services, rollouts, and release policies
                    for a bounded scope of your system.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    New Project
                  </Button>
                </div>
              )}
            </section>

            {/* Right: Org stats + quick links */}
            <aside className="space-y-5">
              {/* Stats */}
              <div>
                <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-3">
                  Organization
                </p>
                <div
                  className="border border-border divide-y divide-border bg-muted/20"
                  style={{ borderRadius: "4px" }}
                >
                  <StatRow
                    label="Plan"
                    value={org ? planLabel(org.allocatedPlanId) : null}
                    loading={orgLoading}
                  />
                  <StatRow
                    label="Projects"
                    value={isLoading ? null : String(totalCount)}
                    loading={isLoading}
                  />
                  <StatRow
                    label="Created"
                    value={org ? formatDate(org.createdAt) : null}
                    loading={orgLoading}
                  />
                </div>
              </div>

              {/* Quick links */}
              <div>
                <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-3">
                  Navigate
                </p>
                <div
                  className="border border-border divide-y divide-border overflow-hidden"
                  style={{ borderRadius: "4px" }}
                >
                  <Link
                    href={`/orgs/${orgId}/settings`}
                    className="group flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors duration-100"
                  >
                    <span className="text-[13px] text-foreground group-hover:text-foreground transition-colors duration-100">
                      Settings
                    </span>
                    <ArrowRight
                      className="size-3.5 text-text-tertiary group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-100"
                      strokeWidth={1.75}
                    />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
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
