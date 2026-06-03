"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { createOrganizationAction } from "@/actions/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

        <div className="corner-accent relative z-10 flex flex-col items-center gap-7 px-12 py-14 w-full max-w-sm">
          {/* Logo */}
          <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
            <BrandLogo variant="dark-mode" className="w-44" priority />
          </div>

          {/* Step label */}
          <p
            className="font-mono text-[0.625rem] tracking-[0.22em] uppercase text-primary animate-fade-in"
            style={{ animationDelay: "60ms" }}
          >
            Step 1 of 1 · Create your organization
          </p>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="w-full flex flex-col gap-4 animate-fade-up"
            style={{ animationDelay: "110ms" }}
          >
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

            {error && (
              <p className="font-mono text-[0.625rem] tracking-[0.08em] text-signal-danger-text">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending || !orgName.trim()}
              className="mt-1 inline-flex items-center justify-center rounded-[2px] bg-primary px-8 py-4 text-[0.8125rem] font-medium tracking-wide text-primary-foreground transition-all duration-200 hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_30%,transparent),0_2px_12px_color-mix(in_srgb,var(--color-surface)_70%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Creating…" : "Create organization"}
            </button>
          </form>

          {/* Invite hint */}
          <p
            className="text-text-disabled text-[0.6875rem] tracking-[0.02em] text-center leading-relaxed animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            Joining an existing org?{" "}
            <span className="text-muted-foreground">
              Ask your admin to send you an invite.
            </span>
          </p>
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
