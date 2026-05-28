"use client";

/**
 * Shared visual shell for error pages (404 not-found and runtime error boundaries).
 * Provides the oscilloscope background, incident report modal, and page header.
 * Imported by:
 *   - routes/$.tsx  (404 catch-all)
 *   - routes/__root.tsx  (root error boundary + not-found component)
 *   - routes/_protected._console.tsx  (console-level error boundary)
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useAccessToken, useAuth } from "@workos-inc/authkit-nextjs/components";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════════════ */

export type ErrorVariant = "not-found" | "error";

export type Action = {
  to: "/" | "/login" | "/overview";
  label: string;
  detail: string;
};

type PageProps = {
  path: string;
  primaryAction: Action | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  dark: boolean;
  onOpenReport: () => void;
  variant: ErrorVariant;
  errorMessage?: string | undefined;
};

/* ═══════════════════════════════════════════════════════════════════════════
   OSCILLOSCOPE BACKGROUND
═══════════════════════════════════════════════════════════════════════════ */

function ScopeBackground({ path, dark }: { path: string; dark: boolean }) {
  const vw = 1200,
    vh = 400;
  const midY = vh / 2;
  const flatX = vw * 0.48;
  const amp = 44,
    period = 72;

  // Main signal
  const mainPts: string[] = [`M 0,${midY}`];
  let x = 0,
    phase = 0;
  while (x < flatX) {
    const nx = Math.min(x + period / 4, flatX);
    const decay = 1 - x / flatX;
    mainPts.push(
      `C ${x + period / 8},${midY - (phase % 2 === 0 ? amp : -amp) * decay * 0.85} ` +
        `${nx - period / 8},${midY + (phase % 2 === 0 ? amp : -amp) * decay * 0.85} ` +
        `${nx},${midY}`,
    );
    x = nx;
    phase++;
  }
  mainPts.push(`L ${vw},${midY}`);
  const mainD = mainPts.join(" ");

  // Ghost trace 1: higher frequency
  const ghost1Pts: string[] = [`M 0,${midY}`];
  x = 0;
  phase = 0;
  const g1P = 52,
    g1FX = vw * 0.38,
    g1A = 28;
  while (x < g1FX) {
    const nx = Math.min(x + g1P / 4, g1FX);
    const decay = 1 - x / g1FX;
    ghost1Pts.push(
      `C ${x + g1P / 8},${midY - (phase % 2 === 0 ? g1A : -g1A) * decay * 0.9} ` +
        `${nx - g1P / 8},${midY + (phase % 2 === 0 ? g1A : -g1A) * decay * 0.9} ` +
        `${nx},${midY}`,
    );
    x = nx;
    phase++;
  }
  ghost1Pts.push(`L ${vw},${midY}`);
  const ghost1D = ghost1Pts.join(" ");

  // Ghost trace 2: slow large wave
  const ghost2Pts: string[] = [`M 0,${midY + 18}`];
  x = 0;
  phase = 1;
  const g2P = 110,
    g2FX = vw * 0.55,
    g2A = 22;
  while (x < g2FX) {
    const nx = Math.min(x + g2P / 4, g2FX);
    const decay = 1 - x / g2FX;
    ghost2Pts.push(
      `C ${x + g2P / 8},${midY + (phase % 2 === 0 ? g2A : -g2A) * decay} ` +
        `${nx - g2P / 8},${midY - (phase % 2 === 0 ? g2A : -g2A) * decay} ` +
        `${nx},${midY}`,
    );
    x = nx;
    phase++;
  }
  ghost2Pts.push(`L ${vw},${midY}`);
  const ghost2D = ghost2Pts.join(" ");

  const hLines = Array.from({ length: 9 }, (_, i) => ((i + 1) / 10) * vh);
  const vLines = Array.from({ length: 11 }, (_, i) => ((i + 1) / 12) * vw);
  const display = path.length > 48 ? path.slice(0, 46) + "…" : path;

  const bg = dark ? "#0d0c0a" : "#f5f4f1";
  const gridLine = dark ? "#2a2825" : "#d8d3cc";
  const midLine = dark ? "#3a3830" : "#c8c2b8";
  const traceMain = dark ? "#c9a84c" : "#a68a3e";
  const traceGlow = "#c9a84c";
  const ghost1Col = "#c9a84c";
  const ghost2Col = dark ? "#d4b454" : "#a68a3e";
  const labelCol = dark ? "#4a453e" : "#9e9189";
  const noSigCol = dark ? "#c9a84c" : "#a68a3e";
  const dotCol = dark ? "#c9a84c" : "#a68a3e";
  const scanColor = dark ? "#c9a84c" : "#a68a3e";
  const scanOp = dark ? "0.18" : "0.10";

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes sc-scan  { from{transform:translateX(-3%)} to{transform:translateX(103%)} }
          @keyframes sc-draw  { from{stroke-dashoffset:4000} to{stroke-dashoffset:0} }
          @keyframes sc-ghost1{ from{stroke-dashoffset:3200} to{stroke-dashoffset:0} }
          @keyframes sc-ghost2{ from{stroke-dashoffset:3600} to{stroke-dashoffset:0} }
          @keyframes sc-blink { 0%,85%,100%{opacity:1} 92%{opacity:0.2} }
          @keyframes sc-glitch {
            0%,90%,100%{transform:translateX(0) scaleY(1)}
            91%{transform:translateX(-2px) scaleY(1.04)}
            93%{transform:translateX(3px) scaleY(0.97)}
            95%{transform:translateX(-1px) scaleY(1.02)}
          }
          @keyframes sc-flicker { 0%,100%{opacity:0.9} 10%{opacity:0.75} 40%{opacity:0.85} 70%{opacity:0.95} }
          @keyframes sc-nosig   { 0%,100%{opacity:0.7} 30%{opacity:0.4} 60%{opacity:0.8} }
          .sc-scan   { animation: sc-scan 10s cubic-bezier(0.37,0,0.63,1) infinite; }
          .sc-draw   { stroke-dasharray:4000; stroke-dashoffset:4000; animation: sc-draw 2.4s cubic-bezier(0.22,1,0.36,1) forwards; }
          .sc-ghost1 { stroke-dasharray:3200; stroke-dashoffset:3200; animation: sc-ghost1 2.0s cubic-bezier(0.22,1,0.36,1) 0.15s forwards; }
          .sc-ghost2 { stroke-dasharray:3600; stroke-dashoffset:3600; animation: sc-ghost2 2.8s cubic-bezier(0.22,1,0.36,1) 0.3s forwards; }
          .sc-blink  { animation: sc-blink 2.8s ease-out 2.6s infinite; }
          .sc-glitch { animation: sc-glitch 6s ease-out 2.5s infinite; }
          .sc-flicker{ animation: sc-flicker 8s ease-in-out infinite; }
          .sc-nosig  { animation: sc-nosig 4s ease-in-out 2.8s infinite; }
        }
      `}</style>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <filter
            id="sc-glow-main"
            x="-30%"
            y="-200%"
            width="160%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="5" result="blur5" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur5" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="sc-glow-ghost"
            x="-20%"
            y="-150%"
            width="140%"
            height="400%"
          >
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="sc-glow-dot"
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="sc-scan-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={scanColor} stopOpacity="0" />
            <stop offset="50%" stopColor={scanColor} stopOpacity={scanOp} />
            <stop offset="100%" stopColor={scanColor} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="sc-vig" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor={bg} stopOpacity="0" />
            <stop
              offset="100%"
              stopColor={bg}
              stopOpacity={dark ? "0.75" : "0.55"}
            />
          </radialGradient>
          <pattern
            id="sc-scanlines"
            x="0"
            y="0"
            width={vw}
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <rect
              x="0"
              y="0"
              width={vw}
              height="1"
              fill={dark ? "rgba(0,0,0,0.18)" : "rgba(200,194,184,0.25)"}
            />
          </pattern>
          <filter id="sc-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grey"
            />
            <feBlend
              in="SourceGraphic"
              in2="grey"
              mode="overlay"
              result="blend"
            />
            <feComposite in="blend" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        <rect width={vw} height={vh} fill={bg} />
        <rect
          width={vw}
          height={vh}
          filter="url(#sc-noise)"
          opacity={dark ? "0.04" : "0.025"}
        />

        {hLines.map((y, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={y}
            x2={vw}
            y2={y}
            stroke={gridLine}
            strokeWidth="0.5"
          />
        ))}
        {vLines.map((x, i) => (
          <line
            key={`v${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={vh}
            stroke={gridLine}
            strokeWidth="0.5"
          />
        ))}

        <line
          x1={0}
          y1={midY}
          x2={vw}
          y2={midY}
          stroke={midLine}
          strokeWidth="1"
        />
        <line
          x1={flatX}
          y1={0}
          x2={flatX}
          y2={vh}
          stroke={midLine}
          strokeWidth="0.75"
          strokeDasharray="4 5"
          opacity="0.5"
        />

        <path
          d={ghost2D}
          fill="none"
          stroke={ghost2Col}
          strokeWidth="5"
          opacity="0.04"
          filter="url(#sc-glow-ghost)"
          className="sc-ghost2 sc-flicker"
        />
        <path
          d={ghost2D}
          fill="none"
          stroke={ghost2Col}
          strokeWidth="1"
          opacity={dark ? "0.22" : "0.18"}
          className="sc-ghost2 sc-flicker"
        />

        <path
          d={ghost1D}
          fill="none"
          stroke={ghost1Col}
          strokeWidth="6"
          opacity="0.05"
          filter="url(#sc-glow-ghost)"
          className="sc-ghost1"
        />
        <path
          d={ghost1D}
          fill="none"
          stroke={ghost1Col}
          strokeWidth="1.25"
          opacity={dark ? "0.3" : "0.22"}
          className="sc-ghost1"
        />

        <path
          d={mainD}
          fill="none"
          stroke={traceGlow}
          strokeWidth="8"
          opacity={dark ? "0.18" : "0.10"}
          filter="url(#sc-glow-main)"
          className="sc-draw sc-glitch"
        />
        <path
          d={mainD}
          fill="none"
          stroke={traceMain}
          strokeWidth="3"
          opacity={dark ? "0.45" : "0.35"}
          filter="url(#sc-glow-ghost)"
          className="sc-draw sc-glitch"
        />
        <path
          d={mainD}
          fill="none"
          stroke={traceMain}
          strokeWidth="1.5"
          opacity={dark ? "0.95" : "0.85"}
          className="sc-draw sc-glitch"
        />

        <circle
          cx={flatX}
          cy={midY}
          r="4"
          fill={dotCol}
          opacity="0.9"
          filter="url(#sc-glow-dot)"
          className="sc-blink"
        />
        <circle
          cx={flatX}
          cy={midY}
          r="2"
          fill={dotCol}
          opacity="1"
          className="sc-blink"
        />

        <text
          x={flatX + 14}
          y={midY - 16}
          fontFamily="'JetBrains Mono',monospace"
          fontSize="9"
          letterSpacing="0.14em"
          fill={noSigCol}
          className="sc-nosig"
        >
          NO SIGNAL
        </text>
        <text
          x="14"
          y={vh - 12}
          fontFamily="'JetBrains Mono',monospace"
          fontSize="8"
          letterSpacing="0.07em"
          fill={labelCol}
        >
          PATH: {display}
        </text>
        <text
          x="14"
          y="18"
          fontFamily="'JetBrains Mono',monospace"
          fontSize="7"
          letterSpacing="0.08em"
          fill={labelCol}
          opacity="0.7"
        >
          CH1 1V/DIV
        </text>
        <text
          x={vw - 14}
          y="18"
          fontFamily="'JetBrains Mono',monospace"
          fontSize="7"
          letterSpacing="0.08em"
          fill={labelCol}
          opacity="0.7"
          textAnchor="end"
        >
          10ms/DIV
        </text>

        <rect
          className="sc-scan"
          x={0}
          y={0}
          width={vw * 0.055}
          height={vh}
          fill="url(#sc-scan-grad)"
        />
        <rect width={vw} height={vh} fill="url(#sc-scanlines)" opacity="1" />
        <rect width={vw} height={vh} fill="url(#sc-vig)" />
      </svg>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNAL PAGE
═══════════════════════════════════════════════════════════════════════════ */

function SignalPage({
  path,
  primaryAction,
  isLoading,
  dark,
  onOpenReport,
  variant,
  errorMessage,
}: PageProps) {
  const bg = dark ? "#0d0c0a" : "#f5f4f1";
  const textPrimary = dark ? "#f5f4f1" : "#1a1512";
  const textSecond = dark ? "#8a8078" : "#6b6059";
  const textMono = dark ? "#c8c2b8" : "#3d3530";
  const amber = dark ? "#c9a84c" : "#7a6530";
  const amberFaint = dark ? "#8a8078" : "#6b6059";
  const topLine = dark
    ? "linear-gradient(90deg,transparent,rgba(201,168,76,0.4),transparent)"
    : "linear-gradient(90deg,transparent,rgba(166,138,62,0.3),transparent)";

  const incidentCode = variant === "not-found" ? "INC-404" : "INC-500";
  const headline =
    variant === "not-found" ? (
      <>
        Signal lost.
        <br />
        Route not found.
      </>
    ) : (
      <>
        System fault.
        <br />
        Unexpected error.
      </>
    );
  const bodyText =
    variant === "not-found" ? (
      <>
        The carrier dropped at{" "}
        <span
          className="font-mono text-[0.8em] break-all"
          style={{ color: textMono }}
        >
          {path}
        </span>
        . No handler matched. Your session is intact.
      </>
    ) : errorMessage ? (
      <>
        An unexpected error occurred.{" "}
        <span
          className="font-mono text-[0.8em] break-all"
          style={{ color: textMono }}
        >
          {errorMessage}
        </span>{" "}
        Your session is intact.
      </>
    ) : (
      <>
        An unexpected error occurred. The runtime threw an unhandled exception.
        Your session is intact.
      </>
    );

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: bg, color: textPrimary }}
    >
      <div className="absolute inset-0">
        <ScopeBackground path={path} dark={dark} />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: topLine }}
      />

      <main className="relative z-10 flex min-h-screen items-end px-6 pb-24 pt-24 sm:px-8 sm:pb-20 sm:pt-0">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-4">
            <p
              className="font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: amber, opacity: 0.9 }}
            >
              {variant === "not-found" ? "Navigation fault" : "Runtime fault"} ·{" "}
              {incidentCode}
            </p>
            <h1
              className="font-display font-medium leading-[1.0] tracking-[-0.03em]"
              style={{
                fontSize: "clamp(1.8rem,4.5vw,3.5rem)",
                color: textPrimary,
              }}
            >
              {headline}
            </h1>
            <p
              className="text-sm leading-[1.75]"
              style={{ color: textSecond, maxWidth: "40ch" }}
            >
              {bodyText}
            </p>
          </div>

          <div
            style={{
              height: "1px",
              width: "2.5rem",
              background: amber,
              opacity: 0.4,
            }}
          />

          <div className="space-y-3">
            {primaryAction ? (
              <Link
                href={primaryAction.to}
                className={buttonVariants({ variant: "outline", size: "md" })}
                style={{
                  borderColor: `${amber}4d`,
                  color: textPrimary,
                  background: dark
                    ? "rgba(201,168,76,0.06)"
                    : "rgba(166,138,62,0.06)",
                }}
              >
                {primaryAction.label}
              </Link>
            ) : (
              <Button variant="outline" size="md" disabled>
                Checking session
              </Button>
            )}

            <button
              onClick={onOpenReport}
              className="group flex items-center gap-2 transition-opacity hover:opacity-100"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                opacity: 0.85,
              }}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em] underline decoration-dotted underline-offset-2 group-hover:decoration-solid"
                style={{ color: amber }}
              >
                View incident report
              </span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 5h6M5 2l3 3-3 3"
                  stroke={amber}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <p
              className="font-mono text-[9px] uppercase tracking-[0.09em]"
              style={{ color: amberFaint, opacity: 0.7 }}
            >
              {isLoading
                ? "Checking session state..."
                : (primaryAction?.detail ?? "")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INCIDENT REPORT MODAL
═══════════════════════════════════════════════════════════════════════════ */

function Field({
  label,
  children,
  ruled = true,
  dark,
}: {
  label: string;
  children: React.ReactNode;
  ruled?: boolean;
  dark: boolean;
}) {
  const ruleLine = dark ? "#2a2825" : "#e5e2dc";
  const labelCol = dark ? "#8a8078" : "#6b6059";
  const textCol = dark ? "#d8d2c8" : "#1a1512";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,8rem) 1fr",
        gap: "0 1rem",
        alignItems: "baseline",
        borderBottom: ruled ? `1px solid ${ruleLine}` : "none",
        paddingBottom: ruled ? "10px" : "0",
        marginBottom: ruled ? "10px" : "0",
      }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.12em] shrink-0"
        style={{ color: labelCol, paddingTop: "2px" }}
      >
        {label}
      </span>
      <span
        className="font-mono text-[11px] leading-[1.6] break-words min-w-0"
        style={{ color: textCol }}
      >
        {children}
      </span>
    </div>
  );
}

function Stamp({ text, color }: { text: string; color: string }) {
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center px-3 py-1"
      aria-hidden="true"
      style={{
        border: `2px solid ${color}`,
        borderRadius: "2px",
        color,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.14em",
        opacity: 0.85,
        transform: "rotate(-2.5deg)",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

function IncidentReportModal({
  path,
  primaryAction,
  isLoading,
  isAuthenticated,
  dark,
  onClose,
  variant,
  errorMessage,
}: {
  path: string;
  primaryAction: Action | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  dark: boolean;
  onClose: () => void;
  variant: ErrorVariant;
  errorMessage?: string | undefined;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const timeStr = today.toTimeString().slice(0, 8) + " UTC";

  const authLine = isLoading
    ? "Verifying..."
    : isAuthenticated
      ? "AUTHENTICATED — session context preserved"
      : "UNAUTHENTICATED — no active session";

  const incidentCode = variant === "not-found" ? "INC-404" : "INC-500";
  const faultType =
    variant === "not-found"
      ? "ROUTE_NOT_FOUND (HTTP 404)"
      : "RUNTIME_ERROR (HTTP 500)";
  const incidentTitle =
    variant === "not-found"
      ? "INCIDENT REPORT — NAVIGATION FAULT"
      : "INCIDENT REPORT — RUNTIME FAULT";

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const cardBg = dark ? "#161512" : "#fafaf9";
  const cardBorder = dark ? "#2a2825" : "#e5e2dc";
  const headerBg = dark ? "#0a0907" : "#f5f4f1";
  const headerText = dark ? "#f5f4f1" : "#1a1512";
  const subLabel = dark ? "#6b6059" : "#6b6059";
  const divider = dark ? "#2a2825" : "#e5e2dc";
  const sectionLbl = dark ? "#8a8078" : "#6b6059";
  const footerTxt = dark ? "#6b6059" : "#9e9189";
  const amber = dark ? "#c9a84c" : "#7a6530";
  const closeIcon = dark ? "#8a8078" : "#6b6059";

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes rpt-in {
            from { opacity:0; transform:translateY(24px) }
            to   { opacity:1; transform:translateY(0) }
          }
          @keyframes rpt-overlay-in { from{opacity:0} to{opacity:1} }
          .rpt-card    { animation: rpt-in 220ms cubic-bezier(0.22,1,0.36,1) forwards; }
          .rpt-overlay { animation: rpt-overlay-in 180ms ease-out forwards; }
        }
      `}</style>

      <div
        ref={overlayRef}
        className="rpt-overlay fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:px-6 sm:py-10"
        style={{ background: "rgba(8,5,3,0.72)" }}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-label={`Incident report ${incidentCode}`}
      >
        <div
          className="rpt-card relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "2px 2px 0 0",
            boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ height: "3px", background: amber, opacity: 0.9 }} />

          <div
            className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8"
            style={{
              background: headerBg,
              borderBottom: `1px solid ${divider}`,
            }}
          >
            <div className="min-w-0">
              <p
                className="font-mono text-[8px] uppercase tracking-[0.18em]"
                style={{ color: subLabel }}
              >
                DeployTitan · {incidentCode}
              </p>
              <p
                className="font-mono text-[10px] tracking-[0.08em] sm:text-[11px] sm:tracking-[0.1em]"
                style={{ color: headerText, marginTop: "2px" }}
              >
                {incidentTitle}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Stamp text="OPEN" color={amber} />
              <button
                ref={closeRef}
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-70"
                style={{
                  background: "none",
                  border: `1px solid ${divider}`,
                  borderRadius: "2px",
                  cursor: "pointer",
                  color: closeIcon,
                }}
                aria-label="Close incident report"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 2l6 6M8 2l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-6 px-5 py-6 sm:space-y-8 sm:px-8 sm:py-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: divider }} />
              <span
                className="font-mono text-[8px] uppercase tracking-[0.14em] sm:text-[9px]"
                style={{ color: sectionLbl }}
              >
                Classification: Internal / Non-sensitive
              </span>
              <div className="h-px flex-1" style={{ background: divider }} />
            </div>

            <div>
              <Field label="Report date" dark={dark}>
                {dateStr}
              </Field>
              <Field label="Report time" dark={dark}>
                {timeStr}
              </Field>
              <Field label="Fault type" dark={dark}>
                {faultType}
              </Field>
              <Field label="Origin" dark={dark}>
                Client navigation
              </Field>
              <Field label="Auth status" dark={dark} ruled={false}>
                {authLine}
              </Field>
            </div>

            <div className="h-px" style={{ background: divider }} />

            <div>
              <p
                className="font-mono text-[9px] uppercase tracking-[0.14em] mb-4"
                style={{ color: sectionLbl }}
              >
                Incident detail
              </p>
              <Field label="Requested path" dark={dark}>
                <span className="break-all">{path}</span>
              </Field>
              {variant === "not-found" ? (
                <>
                  <Field label="Manifest" dark={dark}>
                    47 registered routes — no match found
                  </Field>
                  <Field label="Fallback" dark={dark}>
                    Wildcard catch-all engaged
                  </Field>
                  <Field label="State" dark={dark} ruled={false}>
                    Router context and auth tokens intact.
                  </Field>
                </>
              ) : (
                <>
                  {errorMessage && (
                    <Field label="Error" dark={dark}>
                      <span className="break-all">{errorMessage}</span>
                    </Field>
                  )}
                  <Field label="Boundary" dark={dark}>
                    React error boundary caught exception
                  </Field>
                  <Field label="State" dark={dark} ruled={false}>
                    Router context and auth tokens intact.
                  </Field>
                </>
              )}
            </div>

            <div className="h-px" style={{ background: divider }} />

            <div>
              <p
                className="font-mono text-[9px] uppercase tracking-[0.14em] mb-5"
                style={{ color: sectionLbl }}
              >
                Resolution
              </p>
              <div className="space-y-3">
                {primaryAction ? (
                  <Link
                    href={primaryAction.to}
                    className={buttonVariants({
                      variant: "primary",
                      size: "md",
                    })}
                    onClick={onClose}
                  >
                    {primaryAction.label}
                  </Link>
                ) : (
                  <Button variant="primary" size="md" disabled>
                    Verifying session...
                  </Button>
                )}
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: sectionLbl }}
                >
                  {isLoading
                    ? "Checking session state..."
                    : (primaryAction?.detail ?? "")}
                </p>
              </div>
            </div>

            <div
              className="flex flex-col gap-1 pt-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderTop: `1px solid ${divider}` }}
            >
              <span
                className="font-mono text-[8px] tracking-[0.1em]"
                style={{ color: footerTxt }}
              >
                AUTO-GENERATED BY TITAN ROUTER — DO NOT FILE
              </span>
              <span
                className="font-mono text-[8px] tracking-[0.1em]"
                style={{ color: footerTxt }}
              >
                REF: {path.replace(/\//g, "-").slice(1) || "ROOT"}-
                {variant === "not-found" ? "404" : "500"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE HEADER
═══════════════════════════════════════════════════════════════════════════ */

export function PageHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center transition-opacity hover:opacity-80"
        aria-label="DeployTitan home"
      >
        <BrandLogo
          className="h-5 w-auto"
          variant={dark ? "dark-mode" : "light-mode"}
        />
      </Link>
      <ThemeToggle />
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT EXPORT — ErrorPageShell
   Used by both $.tsx (404) and error boundaries (500-style).
═══════════════════════════════════════════════════════════════════════════ */

export interface ErrorPageShellProps {
  variant: ErrorVariant;
  /** Override the path shown — defaults to current location.pathname */
  path?: string | undefined;
  /** Error message to surface in the incident report (for error boundaries) */
  errorMessage?: string | undefined;
}

export function ErrorPageShell({
  variant,
  path: pathProp,
  errorMessage,
}: ErrorPageShellProps) {
  const auth = useAuth();
  const { loading } = useAccessToken();
  const isAuthenticated = !!auth.user;
  const isLoading = loading ?? false;
  const { resolved } = useTheme();
  const [reportOpen, setReportOpen] = useState(false);
  const pathname = usePathname();

  const isDark = resolved === "dark";
  const path = pathProp ?? pathname ?? "/";

  const primaryAction: Action | null = isLoading
    ? null
    : isAuthenticated
      ? {
          to: "/overview",
          label: "Back to console",
          detail: "Session active. Navigate to a known route.",
        }
      : {
          to: "/login",
          label: "Sign in",
          detail: "Start from a known entry point.",
        };

  return (
    <div className="relative">
      <PageHeader dark={isDark} />
      <SignalPage
        path={path}
        primaryAction={primaryAction}
        isLoading={isLoading}
        isAuthenticated={isAuthenticated}
        dark={isDark}
        onOpenReport={() => setReportOpen(true)}
        variant={variant}
        errorMessage={errorMessage}
      />
      {reportOpen && (
        <IncidentReportModal
          path={path}
          primaryAction={primaryAction}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          dark={isDark}
          onClose={() => setReportOpen(false)}
          variant={variant}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
