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
      {/* Very subtle outer edge — same neutral hairline used by every other
          window shell on the page (feature DemoWindow, page frame borders),
          so this hero window reads as part of the same system rather than
          its own peach-toned artifact. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] border border-white/[0.06]"
      />

      {/* Main window */}
      <div
        className="relative flex h-full w-full flex-col overflow-hidden border border-[#302C25] bg-[#0D0C0A] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_60px_-12px_rgba(0,0,0,0.55),0_60px_140px_-20px_rgba(0,0,0,0.45)]"
        style={{
          borderRadius: radius,
        }}
      >
        {/* Browser / macOS style top bar — same solid header tone as the
            feature-section DemoWindow, so the bar reads as a real title bar
            instead of a near-invisible tint. */}
        <div className="relative flex h-9 flex-none items-center justify-between border-b border-[#302C25] bg-[#15130F] px-3.5">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>

          {/* Center title */}
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium tracking-[0.02em] text-[#A7A29A]">
            {label}
          </span>

          {/* Live status */}
          <span className="flex items-center gap-1.5 rounded-full border border-[#2C4D35] bg-[#18251C] px-2 py-0.5 text-[9.5px] font-medium text-[#4FA36A]">
            <span className="querypilot-live-dot h-1.5 w-1.5 rounded-full bg-[#4FA36A]" />
            Live
          </span>
        </div>

        {/* Content area — the actual product surface. Kept light/off-white
            on purpose: it's meant to read as a real app screenshot sitting
            inside a dark frame, the same way the rest of the page contrasts
            dark chrome against light content panels. */}
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
            box-shadow: 0 0 0 0 rgba(79, 163, 106, 0.35);
          }

          50% {
            box-shadow: 0 0 0 3px rgba(79, 163, 106, 0);
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