"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateProject } from "@/hooks/useCreateProject";

export function CreateProjectDialog({
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const project = await create({ orgId, name: trimmed });
      onOpenChange(false);
      setName("");
      startTransition(() => {
        router.push(`/orgs/${orgId}/projects/${project.publicId}/overview`);
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
        style={{ borderRadius: "4px" }}
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
            <p className="text-[11px] text-text-tertiary leading-relaxed">
              Lowercase letters, numbers, and hyphens. Identifies this project
              across rollouts and policies.
            </p>
          </div>

          {error && (
            <div
              className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-destructive/8 border border-destructive/20 text-destructive text-[12px]"
              style={{ borderRadius: "4px" }}
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
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
