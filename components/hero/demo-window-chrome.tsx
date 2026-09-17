"use client";

import type { ReactNode } from "react";

interface DemoWindowChromeProps {
  children: ReactNode;
  label?: string;
  radius?: number;
  className?: string;
  /** Set true to tint the content area a warm beige instead of pure white */
  warmCard?: boolean;
}

export function DemoWindowChrome({
  children,
  label = "QueryPilot — Live demo",
  radius = 18,
  className = "",
  warmCard = true,
}: DemoWindowChromeProps) {
  return (
    <div
      className={`relative h-full w-full ${className}`}
      style={{
        borderRadius: radius + 2,
      }}
    >
      {/* Very subtle outer edge — warmed slightly to match the dusk sky */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] border border-[#F2C6A0]/[0.14]"
      />

      {/* Main window */}
      <div
        className="relative flex h-full w-full flex-col overflow-hidden border border-[#F2C6A0]/[0.16] bg-[#12100D] shadow-[inset_0_1px_0_rgba(255,235,215,0.08),0_24px_60px_-12px_rgba(120,72,30,0.35),0_60px_140px_-20px_rgba(90,50,20,0.35)]"
        style={{
          borderRadius: radius,
        }}
      >
        {/* Browser / macOS style top bar — warm-tinted glass instead of cool white */}
        <div className="relative flex h-9 flex-none items-center justify-between border-b border-[#F2C6A0]/[0.08] bg-[#F2C6A0]/[0.03] px-3.5">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>

          {/* Center title */}
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium tracking-[0.02em] text-[#F2E4D5]/45">
            {label}
          </span>

          {/* Live status */}
          <span className="flex items-center gap-1.5 rounded-full bg-[#3FB984]/10 px-2 py-0.5 text-[9.5px] font-medium text-[#3FB984]">
            <span className="querypilot-live-dot h-1.5 w-1.5 rounded-full bg-[#3FB984]" />
            Live
          </span>
        </div>

        {/* Content area — warm beige card instead of stark white */}
        <div
          className="relative min-h-0 min-w-0 flex-1"
          style={
            warmCard
              ? { backgroundColor: "#FAF6EF" }
              : undefined
          }
        >
          {children}
        </div>
      </div>

      <style jsx global>{`
        .querypilot-live-dot {
          animation: querypilot-live-pulse 1.4s ease-in-out infinite;
        }

        @keyframes querypilot-live-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(63, 185, 132, 0.3);
          }

          50% {
            box-shadow: 0 0 0 3px rgba(63, 185, 132, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .querypilot-live-dot {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}