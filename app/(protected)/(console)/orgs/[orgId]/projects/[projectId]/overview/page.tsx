"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";

function SectionLabel({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
        {children}
      </span>
      {count !== undefined && (
        <span className="font-mono text-[9px] tracking-[0.06em] text-text-tertiary">
          {count}
        </span>
      )}
    </div>
  );
}

function InlineInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none"
      style={{ borderRadius: "4px" }}
    />
  );
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  const data = useQuery(api.console.getProjectOverview, {
    projectPublicId: projectId,
  });
  const isLoading = data === undefined;

  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [prTitle, setPrTitle] = useState("");
  const [prRepoId, setPrRepoId] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [prNumber, setPrNumber] = useState("");

  const createRepository = useMutation(api.console.createRepository);
  const createPullRequest = useMutation(api.console.createPullRequest);

  const project = data?.project;
  const repositories = data?.repositories ?? [];
  const pullRequests = data?.pullRequests ?? [];

  return (
    <div className="min-h-screen bg-background px-8 py-7">
      <div className="mb-8">
        <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-2">
          Project
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {isLoading ? "Loading..." : project?.name ?? "Project not found"}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Build the GTM dataset directly in the product. Add repositories and pull
          requests here, then shape release packets around the work that matters.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <SectionLabel count={repositories.length}>Repositories</SectionLabel>
          <div className="border border-border bg-muted/20 p-4 mb-4" style={{ borderRadius: "4px" }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <InlineInput
                placeholder="owner"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
              />
              <InlineInput
                placeholder="repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
              <InlineInput
                placeholder="default branch"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
              />
            </div>
            <Button
              className="mt-3"
              size="sm"
              disabled={!repoOwner.trim() || !repoName.trim()}
              onClick={async () => {
                await createRepository({
                  projectPublicId: projectId,
                  repoOwner,
                  repoName,
                  defaultBranch,
                });
                setRepoOwner("");
                setRepoName("");
                setDefaultBranch("main");
              }}
            >
              <Plus className="size-3.5" />
              Add Repository
            </Button>
          </div>

          <div className="border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
            {repositories.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] text-text-tertiary">
                No repositories yet.
              </div>
            ) : (
              repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
                >
                  <FolderGit2 className="size-3.5 text-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12px] text-foreground">
                      {repo.repoOwner}/{repo.repoName}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 font-mono text-[9px] text-text-tertiary">
                    <GitBranch className="size-3" />
                    {repo.defaultBranch ?? "main"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <SectionLabel count={pullRequests.length}>Pull Requests</SectionLabel>
          <div className="border border-border bg-muted/20 p-4 mb-4" style={{ borderRadius: "4px" }}>
            <div className="grid gap-3">
              <InlineInput
                placeholder="PR title"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={prRepoId}
                  onChange={(e) => setPrRepoId(e.target.value)}
                  className="w-full border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none"
                  style={{ borderRadius: "4px" }}
                >
                  <option value="">No repo link</option>
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.publicId}>
                      {repo.repoOwner}/{repo.repoName}
                    </option>
                  ))}
                </select>
                <InlineInput
                  placeholder="PR number"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                />
                <InlineInput
                  placeholder="PR URL"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="mt-3"
              size="sm"
              disabled={!prTitle.trim()}
              onClick={async () => {
                await createPullRequest({
                  projectPublicId: projectId,
                  repositoryPublicId: prRepoId || undefined,
                  number: prNumber ? Number(prNumber) : undefined,
                  title: prTitle,
                  url: prUrl || undefined,
                });
                setPrTitle("");
                setPrRepoId("");
                setPrUrl("");
                setPrNumber("");
              }}
            >
              <Plus className="size-3.5" />
              Add Pull Request
            </Button>
          </div>

          <div className="border border-border overflow-hidden" style={{ borderRadius: "4px" }}>
            {pullRequests.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] text-text-tertiary">
                No pull requests yet.
              </div>
            ) : (
              pullRequests.map((pullRequest) => (
                <div
                  key={pullRequest.id}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
                >
                  <GitPullRequest className="size-3.5 text-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">{pullRequest.title}</p>
                    <p className="font-mono text-[10px] text-text-tertiary">
                      {pullRequest.repositoryPublicId ?? "manual"} · {pullRequest.status}
                    </p>
                  </div>
                  {pullRequest.url ? (
                    <a
                      href={pullRequest.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-tertiary hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="mt-5">
            <Link href={`/orgs/${orgId}/projects/${projectId}/releases`}>
              <Button size="sm">
                Open Releases
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
