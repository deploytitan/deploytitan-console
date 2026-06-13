"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const Element = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
        {label}
      </span>
      <Element
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
        style={{ borderRadius: "4px", minHeight: multiline ? "88px" : undefined }}
      />
    </label>
  );
}

export default function ReleaseDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const releaseId = params.releaseId as string;

  const data = useQuery(api.console.getReleaseDetail, {
    projectPublicId: projectId,
    releasePublicId: releaseId,
  });
  const isLoading = data === undefined;
  const updateRelease = useMutation(api.console.updateRelease);
  const addReleaseItem = useMutation(api.console.addReleaseItem);
  const updateReleaseItem = useMutation(api.console.updateReleaseItem);
  const removeReleaseItem = useMutation(api.console.removeReleaseItem);
  const addReleaseParticipant = useMutation(api.console.addReleaseParticipant);
  const updateReleaseParticipant = useMutation(api.console.updateReleaseParticipant);
  const removeReleaseParticipant = useMutation(api.console.removeReleaseParticipant);
  const attachPullRequestToRelease = useMutation(api.console.attachPullRequestToRelease);
  const detachPullRequestFromRelease = useMutation(api.console.detachPullRequestFromRelease);
  const addReleaseDependency = useMutation(api.console.addReleaseDependency);
  const removeReleaseDependency = useMutation(api.console.removeReleaseDependency);

  const release = data?.release;
  const pullRequests = data?.pullRequests ?? [];
  const includedPullRequests = useMemo(
    () =>
      pullRequests.filter((pr) =>
        release?.pullRequestPublicIds.includes(pr.publicId),
      ),
    [pullRequests, release?.pullRequestPublicIds],
  );
  const availablePullRequests = useMemo(
    () =>
      pullRequests.filter(
        (pr) => !release?.pullRequestPublicIds.includes(pr.publicId),
      ),
    [pullRequests, release?.pullRequestPublicIds],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [shipPlan, setShipPlan] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantRole, setParticipantRole] = useState("");
  const [selectedPullRequest, setSelectedPullRequest] = useState("");
  const [blockingPrId, setBlockingPrId] = useState("");
  const [blockedPrId, setBlockedPrId] = useState("");

  useEffect(() => {
    if (!release) return;
    setName(release.name);
    setDescription(release.description);
    setOutcome(release.outcome);
    setSuccessMetric(release.successMetric);
    setShipPlan(release.shipPlan);
  }, [release]);

  if (isLoading || !release) {
    return (
      <div className="min-h-screen bg-background px-8 py-7">
        <div className="text-[14px] text-muted-foreground">Loading release...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-8 py-7">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary mb-2">
            Release Packet
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            {release.name}
          </h1>
        </div>
        <Button
          size="sm"
          onClick={() =>
            updateRelease({
              releasePublicId: releaseId,
              name,
              description,
              outcome,
              successMetric,
              shipPlan,
            })
          }
        >
          Save Changes
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" value={name} onChange={setName} />
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
                Status
              </span>
              <select
                value={release.status}
                onChange={(e) =>
                  updateRelease({
                    releasePublicId: releaseId,
                    status: e.target.value as
                      | "draft"
                      | "ready"
                      | "in_progress"
                      | "shipped"
                      | "blocked",
                  })
                }
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In progress</option>
                <option value="shipped">Shipped</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
          </div>
          <Field label="Summary" value={description} onChange={setDescription} multiline />
          <Field label="Outcome" value={outcome} onChange={setOutcome} multiline />
          <Field label="Success Metric" value={successMetric} onChange={setSuccessMetric} />
          <Field label="Ship Plan" value={shipPlan} onChange={setShipPlan} multiline />

          <div>
            <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
              Checklist
            </p>
            <div className="mb-3 flex gap-2">
              <input
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="Add a task, risk, or note"
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              />
              <Button
                size="sm"
                disabled={!itemTitle.trim()}
                onClick={async () => {
                  await addReleaseItem({
                    releasePublicId: releaseId,
                    title: itemTitle,
                  });
                  setItemTitle("");
                }}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              {release.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border border-border bg-muted/20 px-3 py-2"
                  style={{ borderRadius: "4px" }}
                >
                  <input
                    value={item.title}
                    onChange={(e) =>
                      updateReleaseItem({
                        releasePublicId: releaseId,
                        itemId: item.id,
                        title: e.target.value,
                      })
                    }
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none"
                  />
                  <select
                    value={item.status}
                    onChange={(e) =>
                      updateReleaseItem({
                        releasePublicId: releaseId,
                        itemId: item.id,
                        status: e.target.value as "todo" | "doing" | "done",
                      })
                    }
                    className="border border-border bg-background px-2 py-1 text-[12px] text-foreground"
                    style={{ borderRadius: "4px" }}
                  >
                    <option value="todo">Todo</option>
                    <option value="doing">Doing</option>
                    <option value="done">Done</option>
                  </select>
                  <button
                    className="text-text-tertiary hover:text-signal-danger-text"
                    onClick={() =>
                      removeReleaseItem({
                        releasePublicId: releaseId,
                        itemId: item.id,
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div>
            <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
              Included Pull Requests
            </p>
            <div className="mb-3 flex gap-2">
              <select
                value={selectedPullRequest}
                onChange={(e) => setSelectedPullRequest(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              >
                <option value="">Select PR</option>
                {availablePullRequests.map((pr) => (
                  <option key={pr.id} value={pr.publicId}>
                    {pr.title}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!selectedPullRequest}
                onClick={async () => {
                  await attachPullRequestToRelease({
                    releasePublicId: releaseId,
                    pullRequestPublicId: selectedPullRequest,
                  });
                  setSelectedPullRequest("");
                }}
              >
                <Link2 className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              {includedPullRequests.map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center gap-3 border border-border bg-muted/20 px-3 py-2"
                  style={{ borderRadius: "4px" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">{pr.title}</p>
                    <p className="text-[11px] text-text-tertiary">{pr.status}</p>
                  </div>
                  <button
                    className="text-text-tertiary hover:text-signal-danger-text"
                    onClick={() =>
                      detachPullRequestFromRelease({
                        releasePublicId: releaseId,
                        pullRequestPublicId: pr.publicId,
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
              Participants
            </p>
            <div className="mb-3 grid gap-2">
              <input
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Name"
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              />
              <input
                value={participantRole}
                onChange={(e) => setParticipantRole(e.target.value)}
                placeholder="Role"
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              />
              <Button
                size="sm"
                disabled={!participantName.trim() || !participantRole.trim()}
                onClick={async () => {
                  await addReleaseParticipant({
                    releasePublicId: releaseId,
                    name: participantName,
                    role: participantRole,
                  });
                  setParticipantName("");
                  setParticipantRole("");
                }}
              >
                <Plus className="size-3.5" />
                Add Participant
              </Button>
            </div>
            <div className="space-y-2">
              {release.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="border border-border bg-muted/20 px-3 py-2"
                  style={{ borderRadius: "4px" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground">{participant.name}</p>
                      <p className="text-[11px] text-text-tertiary">{participant.role}</p>
                    </div>
                    <select
                      value={participant.status}
                      onChange={(e) =>
                        updateReleaseParticipant({
                          releasePublicId: releaseId,
                          participantId: participant.id,
                          status: e.target.value as
                            | "pending"
                            | "confirmed"
                            | "complete",
                        })
                      }
                      className="border border-border bg-background px-2 py-1 text-[12px] text-foreground"
                      style={{ borderRadius: "4px" }}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="complete">Complete</option>
                    </select>
                    <button
                      className="text-text-tertiary hover:text-signal-danger-text"
                      onClick={() =>
                        removeReleaseParticipant({
                          releasePublicId: releaseId,
                          participantId: participant.id,
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 font-mono text-[9px] tracking-[0.08em] uppercase text-text-tertiary">
              Dependencies
            </p>
            <div className="mb-3 grid gap-2">
              <select
                value={blockingPrId}
                onChange={(e) => setBlockingPrId(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              >
                <option value="">Blocking PR</option>
                {includedPullRequests.map((pr) => (
                  <option key={pr.id} value={pr.publicId}>
                    {pr.title}
                  </option>
                ))}
              </select>
              <select
                value={blockedPrId}
                onChange={(e) => setBlockedPrId(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none"
                style={{ borderRadius: "4px" }}
              >
                <option value="">Blocked PR</option>
                {includedPullRequests.map((pr) => (
                  <option key={pr.id} value={pr.publicId}>
                    {pr.title}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!blockingPrId || !blockedPrId || blockingPrId === blockedPrId}
                onClick={async () => {
                  await addReleaseDependency({
                    releasePublicId: releaseId,
                    blockingPullRequestPublicId: blockingPrId,
                    blockedPullRequestPublicId: blockedPrId,
                  });
                  setBlockingPrId("");
                  setBlockedPrId("");
                }}
              >
                <Plus className="size-3.5" />
                Add Dependency
              </Button>
            </div>
            <div className="space-y-2">
              {release.dependencies.map((dependency) => (
                <div
                  key={dependency.id}
                  className="flex items-center gap-3 border border-border bg-muted/20 px-3 py-2"
                  style={{ borderRadius: "4px" }}
                >
                  <div className="min-w-0 flex-1 text-[12px] text-foreground">
                    {dependency.blockingPullRequestPublicId} blocks{" "}
                    {dependency.blockedPullRequestPublicId}
                  </div>
                  <button
                    className="text-text-tertiary hover:text-signal-danger-text"
                    onClick={() =>
                      removeReleaseDependency({
                        releasePublicId: releaseId,
                        dependencyId: dependency.id,
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
