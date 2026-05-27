"use client";

/**
 * Landing — simple branded sign-in gate.
 *
 * Shows the DeployTitan logo + a single "Sign in" CTA.
 * Clicking the button redirects to the WorkOS AuthKit hosted UI.
 * No auto-redirect ever happens on this page.
 */

import { useState } from "react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Link } from "@/lib/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

export function Landing() {
  const [pending, setPending] = useState(false);
  const { user, refreshAuth } = useAuth();

  const isAuthenticated = !!user;
  const handleSignIn = () => {
    setPending(true);
    // Use refreshAuth to trigger the sign-in flow
    // This properly handles PKCE and state cookies
    void refreshAuth({ ensureSignedIn: true });
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top-right controls */}
      <div className="flex justify-end items-center gap-3 px-6 py-4">
        <ThemeToggle />
        {isAuthenticated && (
          <Link
            to="/overview"
            className="text-xs font-mono text-ink-tertiary hover:text-ink transition-colors"
          >
            Go to console →
          </Link>
        )}
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="w-10 h-10 bg-ink flex items-center justify-center"
            style={{ borderRadius: "2px" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-surface)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="font-display font-medium text-2xl tracking-[-0.01em] text-ink">
            Deploy<span className="text-primary-dark">Titan</span>
          </span>
        </div>

        {/* Tagline */}
        <p className="text-sm text-ink-tertiary mb-10 text-center">
          Deployment safety for engineering teams who ship without fear.
        </p>

        {/* CTA */}
        <button
          onClick={handleSignIn}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3
                     bg-ink text-surface text-sm font-medium
                     hover:opacity-90 transition-opacity active:scale-[0.97]
                     disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{ borderRadius: "2px" }}
        >
          {pending ? (
            <span
              className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          )}
          {pending ? "Redirecting…" : "Sign in"}
        </button>

        {/* Redirect notice */}
        <p className="mt-4 text-[10px] font-mono text-ink-quaternary text-center">
          You'll be redirected to{" "}
          <span className="text-ink-tertiary">authkit.app</span> to sign in,
          then returned here.
        </p>
      </div>
    </div>
  );
}
