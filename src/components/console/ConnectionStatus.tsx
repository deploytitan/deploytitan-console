"use client";

/**
 * ConnectionStatus — ambient sync state indicator for the console sidebar footer.
 *
 * Sits above the user menu in the sidebar footer. Shows the current Zero
 * connection state as a small StatusDot + mono label chip. Invisible when
 * not needed (returns null when Zero is unavailable / SSR).
 *
 * Design intent: the indicator should be nearly invisible when healthy.
 * It earns attention only when something is wrong.
 */

import { useConnectionState } from "@rocicorp/zero/react";

type StatusConfig = {
  dotColor: string;
  label: string;
  pulse?: boolean;
};

function getStatusConfig(stateName: string): StatusConfig {
  switch (stateName) {
    case "connected":
      return { dotColor: "#22c55e", label: "Synced" };
    case "connecting":
      return { dotColor: "#f59e0b", label: "Syncing", pulse: true };
    case "disconnected":
      return { dotColor: "#ef4444", label: "Offline" };
    case "error":
      return { dotColor: "#ef4444", label: "Sync error" };
    case "needs-auth":
      return { dotColor: "#f59e0b", label: "Session expired", pulse: true };
    case "closed":
      return { dotColor: "#ef4444", label: "Disconnected" };
    default:
      return { dotColor: "#9e9189", label: "Unknown" };
  }
}

export function ConnectionStatus() {
  const state = useConnectionState();

  // Not available (SSR / unauthenticated / pre-mount) — render nothing.
  if (state === null) return null;

  // When connected and stable, render a quiet indicator.
  // When in a bad or transient state, render with more presence.
  const { dotColor, label, pulse } = getStatusConfig(state.name);
  const isHealthy = state.name === "connected";
  const isBad =
    state.name === "disconnected" ||
    state.name === "error" ||
    state.name === "closed";

  return (
    <div
      className={[
        "flex items-center gap-2 px-2 py-1.5 mx-0",
        "transition-opacity duration-200 pointer-events-none",
        isHealthy ? "opacity-70" : "opacity-100",
      ].join(" ")}
      aria-label={`Sync status: ${label}`}
      title={`Sync status: ${label}`}
    >
      {/* Status dot — micro-sharp square, matches StatusDot component spec */}
      <span
        className={[
          "shrink-0 inline-block",
          pulse ? "animate-pulse-dot" : "",
        ].join(" ")}
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "0.5px",
          backgroundColor: dotColor,
          boxShadow: isBad ? `0 0 4px ${dotColor}60` : undefined,
        }}
        aria-hidden="true"
      />

      {/* Label */}
      <span
        className="font-mono uppercase tracking-[0.08em] leading-none select-none"
        style={{
          fontSize: "9px",
          color: isHealthy
            ? "var(--sidebar-foreground)"
            : isBad
              ? dotColor
              : "var(--sidebar-foreground)",
          opacity: isHealthy ? 1 : 0.9,
        }}
      >
        {label}
      </span>
    </div>
  );
}
