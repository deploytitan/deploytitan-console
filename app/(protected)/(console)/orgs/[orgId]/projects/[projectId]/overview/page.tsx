"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@deploytitan/zero-schema";
import { Shield, LayoutGrid } from "lucide-react";
import Link from "next/link";

function formatDate(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

export default function OverviewPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const projectId = params?.projectId as string;

  const [project] = useQuery(queries.projectById({ id: projectId }));

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
              <p className="mt-1 font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50">
                {project.id}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-6 animate-fade-up">
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
                    <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground/60">
                      Created {formatDate(project.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div>
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-muted-foreground/50 mb-2">
            Sections
          </p>
          <div className="grid grid-cols-1 gap-px border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
            <Link
              href={`/orgs/${orgId}/projects/${projectId}/policies`}
              className="group flex items-center gap-3 px-5 py-3.5 bg-background border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors duration-100"
            >
              <Shield
                className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors duration-100 shrink-0"
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground leading-none">
                  Policies
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60 leading-relaxed">
                  Release gates, freeze windows, and approval rules for this project
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

