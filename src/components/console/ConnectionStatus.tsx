"use client";

export function ConnectionStatus() {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 opacity-80 pointer-events-none"
      aria-label="Console status: live"
      title="Console status: live"
    >
      <span
        className="shrink-0 inline-block"
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "0.5px",
          backgroundColor: "var(--color-signal-success)",
        }}
        aria-hidden="true"
      />
      <span
        className="font-mono uppercase tracking-[0.08em] leading-none select-none"
        style={{
          fontSize: "9px",
          color: "var(--sidebar-foreground)",
        }}
      >
        Live
      </span>
    </div>
  );
}
