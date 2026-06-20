"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { createOrganizationAction } from "@/actions/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [billingPending, setBillingPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const onboardingGuide = useQuery(api.platform.getOnboardingGuide, {});
  const actor = useQuery(api.actors.getActorContext, {});
  const updateOnboardingProgress = useMutation(api.platform.updateOnboardingProgress);

  useEffect(() => {
    if (onboardingGuide?.status === "ready" && onboardingGuide.projects[0]) {
      const organization = onboardingGuide.organization;
      const project = onboardingGuide.projects[0];
      if (organization && project) {
        router.replace(`/orgs/${organization.workosOrgId}/projects/${project.publicId}`);
      }
    }
  }, [onboardingGuide, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOrganizationAction(orgName);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Re-auth with the new org so the session token includes organizationId
      const refreshResult = await refreshAuth({
        organizationId: result.orgId,
      });

      if (refreshResult?.error) {
        // Membership was created — just navigate directly
        router.push(`/orgs/${result.orgId}`);
        return;
      }

      router.push(`/orgs/${result.orgId}`);
    });
  };

  const openHostedCheckout = async (provider: "paddle" | "polar") => {
    setError(null);
    setBillingPending(true);

    try {
      const continuation = await updateOnboardingProgress({
        currentStep: "billing",
        pendingBrowserStep: "billing",
      });

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          planId: "starter",
          continuationToken: continuation.continuationToken,
        }),
      });

      const payload = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Failed to create checkout link.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout.");
      setBillingPending(false);
    }
  };

  const openGithubInstall = async () => {
    await updateOnboardingProgress({
      currentStep: "github",
      pendingBrowserStep: "github",
    });

    if (onboardingGuide?.githubInstallUrl) {
      window.location.href = onboardingGuide.githubInstallUrl;
    }
  };

  const organizationMissing =
    onboardingGuide?.nextStep?.key === "organization" || !onboardingGuide?.organization;

  return (
    <div className="dark">
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-surface blueprint-grid">
        {/* Amber scan line */}
        <div className="login-scan-line" aria-hidden="true" />

        {/* Radial vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, color-mix(in srgb, var(--color-surface) 60%, transparent) 100%)",
          }}
        />

        <div className="corner-accent relative z-10 flex flex-col items-center gap-7 px-8 py-10 w-full max-w-3xl">
          {/* Logo */}
          <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
            <BrandLogo variant="dark-mode" className="w-44" priority />
          </div>

          {/* Step label */}
          <p
            className="font-mono text-[0.625rem] tracking-[0.22em] uppercase text-primary animate-fade-in"
            style={{ animationDelay: "60ms" }}
          >
            MCP-first onboarding · Guided setup
          </p>

          <div className="grid w-full gap-5 md:grid-cols-[1.25fr_0.95fr]">
            <section
              className="animate-fade-up border border-border bg-surface/80 p-5"
              style={{ animationDelay: "110ms", borderRadius: "4px" }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.625rem] tracking-[0.18em] uppercase text-muted-foreground">
                    Setup progress
                  </p>
                  <h1 className="mt-2 text-[1.25rem] font-semibold tracking-tight text-foreground">
                    {onboardingGuide?.organization
                      ? onboardingGuide.organization.name
                      : "Set up your team workspace"}
                  </h1>
                  <p className="mt-2 max-w-[52ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
                    Start from MCP, then use this page only for the few browser
                    steps that must happen outside your client.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="inline-flex items-center gap-1 rounded-[2px] border border-border px-3 py-2 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RefreshCcw className="size-3.5" />
                  Refresh
                </button>
              </div>

              <div className="space-y-3">
                {onboardingGuide?.steps?.map((step) => {
                  const complete = step.status === "complete";
                  const pending = step.status === "pending";
                  return (
                    <div
                      key={step.key}
                      className="flex items-start gap-3 rounded-[4px] border border-border bg-surface-alt/70 px-4 py-3"
                    >
                      <div className="pt-0.5">
                        {complete ? (
                          <CheckCircle2 className="size-4 text-signal-success-text" />
                        ) : pending ? (
                          <Circle className="size-4 text-primary" />
                        ) : (
                          <Circle className="size-4 text-text-disabled" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[0.85rem] font-medium text-foreground">
                            {step.label}
                          </p>
                          <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-text-disabled">
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[0.75rem] leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                        {pending && step.key === "github" && onboardingGuide.githubInstallUrl ? (
                          <button
                            type="button"
                            onClick={openGithubInstall}
                            className="mt-3 inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary"
                          >
                            Open GitHub installation
                            <ArrowUpRight className="size-3.5" />
                          </button>
                        ) : null}
                        {pending && step.key === "billing" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void openHostedCheckout("paddle")}
                              disabled={billingPending}
                              className="inline-flex items-center justify-center rounded-[2px] bg-primary px-3 py-2 text-[0.75rem] font-medium text-primary-foreground disabled:opacity-50"
                            >
                              {billingPending ? (
                                <>
                                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                                  Opening Paddle
                                </>
                              ) : (
                                "Checkout with Paddle"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openHostedCheckout("polar")}
                              disabled={billingPending}
                              className="inline-flex items-center justify-center rounded-[2px] border border-border px-3 py-2 text-[0.75rem] font-medium text-foreground disabled:opacity-50"
                            >
                              Backup checkout with Polar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className="animate-fade-up border border-border bg-surface/80 p-5"
              style={{ animationDelay: "160ms", borderRadius: "4px" }}
            >
              <p className="font-mono text-[0.625rem] tracking-[0.18em] uppercase text-muted-foreground">
                Next action
              </p>
              <p className="mt-3 text-[0.95rem] font-medium text-foreground">
                {onboardingGuide?.nextStep
                  ? onboardingGuide.nextStep.label
                  : "Workspace ready"}
              </p>
              <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
                {onboardingGuide?.nextStep?.description ??
                  "Everything required for the release tracker MVP is configured."}
              </p>

              {organizationMissing ? (
                <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="org-name"
                      className="font-mono text-[0.625rem] tracking-[0.18em] uppercase text-muted-foreground"
                    >
                      Organization name
                    </label>
                    <input
                      id="org-name"
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Corp"
                      autoFocus
                      autoComplete="organization"
                      disabled={isPending}
                      className="w-full rounded-[2px] border border-border bg-surface-alt px-4 py-3 text-[0.8125rem] text-foreground placeholder:text-text-disabled outline-none transition-all duration-200 focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_8%,transparent)] disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending || !orgName.trim()}
                    className="inline-flex items-center justify-center rounded-[2px] bg-primary px-6 py-3 text-[0.8125rem] font-medium tracking-wide text-primary-foreground transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPending ? "Creating…" : "Create organization"}
                  </button>
                </form>
              ) : (
                <div className="mt-5 space-y-3 text-[0.75rem] text-muted-foreground">
                  <p>
                    Continue in MCP with a prompt like:
                  </p>
                  <div className="rounded-[4px] border border-border bg-surface-alt px-4 py-3 font-mono text-[0.75rem] text-foreground">
                    Set up DeployTitan for my team and tell me the next step.
                  </div>
                  {actor?.user?.email ? (
                    <p>
                      Signed in as <span className="text-foreground">{actor.user.email}</span>.
                    </p>
                  ) : null}
                </div>
              )}

              {error && (
                <p className="mt-4 font-mono text-[0.625rem] tracking-[0.08em] text-signal-danger-text">
                  {error}
                </p>
              )}

              <div className="mt-6 border-t border-border pt-4 text-[0.72rem] leading-relaxed text-text-disabled">
                Users should not need docs to get started. If you are in Claude Code
                or Codex, ask DeployTitan what the next setup step is and it should
                answer from its embedded help content.
              </div>
            </section>
          </div>
        </div>

        {/* Product identifier */}
        <div
          className="absolute bottom-6 right-6 animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <span className="font-mono text-[0.5625rem] tracking-[0.14em] uppercase text-text-disabled">
            Titan Rollouts
          </span>
        </div>
      </main>
    </div>
  );
}
