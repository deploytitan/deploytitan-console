"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "relative border border-line bg-surface p-6 group transition-all duration-300",
        "card-hover-brand",
        "spotlight-card overflow-hidden",
        onClick && "cursor-pointer",
        className,
      )}
      style={{ borderRadius: "4px" }}
      onClick={onClick}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-gold/0 group-hover:border-gold/30 transition-all duration-300" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-gold/0 group-hover:border-gold/30 transition-all duration-300" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
