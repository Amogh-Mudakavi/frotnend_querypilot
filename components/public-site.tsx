"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { FileSpreadsheet, FileText, Menu, PanelRight, Plus, Waypoints, X } from "lucide-react";

import { authApi } from "@/lib/django-api";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";
import { QueryPilotDemo } from "@/components/hero/querypilot-demo";
import { AgentTrace, MONO, QP, SANS, alpha, type TraceRun } from "@/components/hero/agent-trace-demo";
import FinalCTASection from "@/components/hero/component_last_cta";
import EngineeringPreview from "@/components/hero/engineering-preview";
import { FeaturesSection } from "@/components/demos/features-showcase";

/* ============================================================================
 * QueryPilot public site. Dark only.
 * Tokens: canvas #0A0A0A, hairline white/10, primary #3A44A8.
 * ========================================================================== */

/** The one page frame. Nav, hero, demo and every section share it so edges line up. */
const FRAME = "w-[var(--qp-frame,min(92vw,1120px))]";
const BRAND_BLUE = "#3a44a8";
const BRAND_DISSOLVE_BLUE = "#2a3282";
const GITHUB_URL = "https://github.com/Amogh-Mudakavi/QueryPilot_backend";
// Relative on purpose: resolves to localhost:3000/engineering in dev and to your own domain in production.
const ENGINEERING_HREF = "/engineering";
// Where a signed-in person lands (same place the auth page sends them after login).
const APP_HREF = "/workspaces";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";

/** Shared look for the small pill buttons (nav, menu, ghost). Same overrides the auth page uses. */
const PD_PILL = "!rounded-full !min-h-0 !px-4 !text-[13px] !font-medium !normal-case !tracking-normal";
/** Tighter on very small phones so the nav row never overflows. */
const PD_TINY = "max-[399px]:!gap-1.5 max-[399px]:!px-3";
/** Outlined, see-through button. Pair with textColor / dissolveColor below. */
const PD_GHOST_BORDER = "border !border-white/15";
const GHOST_TEXT = "rgba(255,255,255,0.8)";
const GHOST_DISSOLVE = "#4A4A4A";
/** The white pill (sign up / open). */
const WHITE_DISSOLVE = "#BDBDBD";
const WHITE_TEXT = "#0A0A0A";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* ------------------------------------------------------------------ nav -- */

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#engineering" },
  { label: "Engineering", href: ENGINEERING_HREF },
] as const;

function GithubIcon({ className = "size-[14px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.455-1.157-1.11-1.466-1.11-1.466-.908-.62.069-.607.069-.607 1.004.07 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-1.087.635-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.269.098-2.647 0 0 .839-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.746-1.025 2.746-1.025.546 1.378.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.843-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  );
}

/**
 * Header sizes in the wild: 56 to 64px is the norm for product sites, marketing sites run 64 to 72px.
 * Here it is 64px, 72px on large screens (the `--qp-nav-h` variable below), with 14px links and a 24px mark.
 * Transparent at the top of the page, a blurred bar with a hairline once you scroll.
 */
const navLink = `rounded-md px-3 py-1.5 text-[14px] text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white ${focusRing}`;

/** Props kept so existing call sites compile; the bar is dark only. */
export function PublicNav(_props: { initialTheme?: "light" | "dark"; autoTheme?: boolean; showProgress?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // null while we have not looked yet, so signed-out buttons never flash for a signed-in person.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Signed in? A saved token shows "Open QueryPilot" straight away, then we confirm with the server.
  useEffect(() => {
    let cancelled = false;
    let hasToken = false;

    try {
      hasToken = authApi.hasAccess();
    } catch {
      hasToken = false;
    }

    if (!hasToken) {
      setAuthed(false);
      return;
    }

    setAuthed(true);

    authApi.me().catch(() => {
      if (!cancelled) setAuthed(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    // If the window grows to desktop width while the menu is open, close it.
    const wide = window.matchMedia("(min-width: 1000px)");

    const onWide = () => {
      if (wide.matches) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const solid = scrolled || open;
  const checking = authed === null;

  return (
    <header
      data-querypilot-nav
      className={`fixed inset-x-0 top-0 z-[60] border-b transition-[background-color,border-color] duration-300 ${
        solid
          ? "border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div
        className={`mx-auto grid grid-cols-[1fr_auto] items-center gap-4 min-[1000px]:grid-cols-[1fr_auto_1fr] ${FRAME}`}
        style={{ height: "var(--qp-nav-h, 64px)" }}
      >
        {/* Brand + GitHub */}
        <div className="inline-flex items-center gap-3 justify-self-start">

          <Link
            href="/"
            aria-label="QueryPilot home"
            className={`inline-flex items-center gap-2.5 rounded-md text-[16px] font-semibold tracking-[-0.02em] text-white ${focusRing}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/querypilot-logo.svg"
              alt=""
              aria-hidden="true"
              className="size-6 object-contain"
            />
            QueryPilot
          </Link>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="QueryPilot on GitHub"
            title="GitHub"
            className={`inline-flex size-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white ${focusRing}`}
          >
            <GithubIcon className="size-6" />
          </a>

        </div>

        {/* Desktop navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 min-[1000px]:flex"
        >
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={navLink}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-1 justify-self-end">

          <div
            className={`flex items-center gap-1 ${checking ? "invisible" : ""}`}
            aria-hidden={checking ? true : undefined}
          >
            {authed ? (
              <PixelDissolveButton
                label="Open QueryPilot"
                href={APP_HREF}
                color="#ffffff"
                textColor={WHITE_TEXT}
                dissolveColor={WHITE_DISSOLVE}
                cellSize={4}
                className={`ml-1 ${PD_PILL} ${PD_TINY} !h-9`}
              />
            ) : (
              <>
                <PixelDissolveButton
                  label="Log in"
                  href="/login"
                  color="transparent"
                  textColor={GHOST_TEXT}
                  dissolveColor={GHOST_DISSOLVE}
                  cellSize={4}
                  className={`${PD_PILL} ${PD_GHOST_BORDER} !h-9 max-[519px]:!hidden`}
                />

                <PixelDissolveButton
                  label="Sign up"
                  href="/signup"
                  color="#ffffff"
                  textColor={WHITE_TEXT}
                  dissolveColor={WHITE_DISSOLVE}
                  cellSize={4}
                  className={`ml-1 ${PD_PILL} ${PD_TINY} !h-9`}
                />
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="qp-mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className={`ml-1 inline-flex size-9 items-center justify-center rounded-md text-white/80 hover:bg-white/[0.06] min-[1000px]:hidden ${focusRing}`}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

        </div>
      </div>

      {/* Mobile navigation */}
      {open ? (
        <div
          id="qp-mobile-menu"
          className="absolute inset-x-0 top-full overflow-y-auto border-t border-white/10 bg-[#0A0A0A] min-[1000px]:hidden"
          style={{ height: "calc(100svh - var(--qp-nav-h, 64px))" }}
        >
          <ul className={`mx-auto flex flex-col pt-2 ${FRAME}`}>
            {[...NAV_LINKS, { label: "GitHub", href: GITHUB_URL }].map((l) => (
              <li key={l.label} className="border-b border-white/[0.08]">
                {l.href.startsWith("http") ? (
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-4 text-[18px] text-white/85"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-4 text-[18px] text-white/85"
                  >
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          <div className={`mx-auto flex flex-col gap-3 py-6 ${FRAME}`}>
            {authed ? (
              <PixelDissolveButton
                label="Open QueryPilot"
                href={APP_HREF}
                onClick={() => setOpen(false)}
                color="#ffffff"
                textColor={WHITE_TEXT}
                dissolveColor={WHITE_DISSOLVE}
                cellSize={5}
                className={`${PD_PILL} !h-11 !w-full !text-[15px]`}
              />
            ) : (
              <>
                <PixelDissolveButton
                  label="Log in"
                  href="/login"
                  onClick={() => setOpen(false)}
                  color="transparent"
                  textColor={GHOST_TEXT}
                  dissolveColor={GHOST_DISSOLVE}
                  cellSize={5}
                  className={`${PD_PILL} ${PD_GHOST_BORDER} !h-11 !w-full !text-[15px]`}
                />

                <PixelDissolveButton
                  label="Sign up"
                  href="/signup"
                  onClick={() => setOpen(false)}
                  color="#ffffff"
                  textColor={WHITE_TEXT}
                  dissolveColor={WHITE_DISSOLVE}
                  cellSize={5}
                  className={`${PD_PILL} !h-11 !w-full !text-[15px]`}
                />
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

/* ----------------------------------------------------------------- hero -- */

/**
 * Hero copy lives here; the layout does not depend on the words.
 * Same idea, other voices, if you want to try them:
 *   "Don't just search your data. Understand it."
 *   "Search finds files. QueryPilot finds answers."
 *   "Your data has answers, not just matches."
 */
const HERO = {
  line1: "Stop searching your data.",
  line2: "Start understanding it.",
  pitch: "QueryPilot searches across your documents, brings scattered pieces of evidence together, and shows you exactly where the answer comes from.",
} as const;

const DOTS: CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,.1) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  WebkitMaskImage: "radial-gradient(ellipse 70% 95% at 88% 0%, #000 0%, transparent 72%)",
  maskImage: "radial-gradient(ellipse 70% 95% at 88% 0%, #000 0%, transparent 72%)",
};

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-[#0A0A0A] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={DOTS} />

      <div className={`relative mx-auto pb-5 ${FRAME}`} style={{ paddingTop: "calc(var(--qp-nav-h, 64px) + clamp(1.25rem, 3svh, 2.25rem))" }}>
        {/* Size: 26px on phones, scales with the viewport, and caps at 48px on large screens. */}
        <h1 id="hero-heading" className="text-[clamp(18px,2.0vw,40px)] font-medium leading-[1.1] tracking-[-0.03em]">
          <span className="qp-rise block text-white/50">{HERO.line1}</span>
          <span className="qp-rise block" style={{ animationDelay: "160ms" }}>
            {HERO.line2}
          </span>
        </h1>

        <p className="qp-rise mt-3 max-w-[40rem] text-[clamp(14px,0.99vw,16px)] leading-[1.55] text-white/60" style={{ animationDelay: "340ms" }}>
          {HERO.pitch}
        </p>

        <div className="qp-rise mt-4 flex flex-wrap items-center gap-3" style={{ animationDelay: "520ms" }}>
          <PixelDissolveButton
            label="Try QueryPilot"
            href="/login"
            color={BRAND_BLUE}
            dissolveColor={BRAND_DISSOLVE_BLUE}
            cellSize={5}
            className="!rounded-full overflow-hidden"
          />
          <PixelDissolveButton
            label="Read the engineering docs"
            href={ENGINEERING_HREF}
            color="transparent"
            textColor={GHOST_TEXT}
            dissolveColor={GHOST_DISSOLVE}
            cellSize={5}
            className={`${PD_PILL} ${PD_GHOST_BORDER} !h-[42px] !px-5 !text-[14px]`}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ workspace -- */

/**
 * The demo as a dark web app.
 *
 *   - The chat is the page. A slim sidebar sits on its left when there is room.
 *   - The graph panel starts closed. The moment a run starts it slides open on the right and builds
 *     step by step next to the chat.
 *   - A new message opens it again. "View in graph" on an old answer opens it too.
 *   - Close it with the X, or from the panel icon at the top right of the chat.
 *   - Drag the edge between chat and graph to resize them (arrow keys work on it, double-click resets).
 *   - Narrow screens: the sidebar hides and the graph opens below the chat instead of beside it.
 *
 * `QueryPilotDemo` and `AgentTrace` keep their own look; this only arranges them and wires them together.
 */

// Fills whatever is left of the first screen after the nav and the (now slightly larger) hero, so the demo is in view without scrolling.
const DEMO_H = "clamp(560px, calc(100svh - 24rem), 880px)";
const SIDE_W = 232;
const SIDE_FROM = 1080; // frame width where the sidebar appears
const SIDE_KEEP_OPEN_FROM = 1400; // below this the sidebar steps aside while the graph is open
const STACK_BELOW = 900; // frame width where the graph moves under the chat
const STACK_CHAT_H = 600;
const STACK_PANEL_H = 580;
const EASE = ".55s cubic-bezier(.22,.8,.2,1)";
const MIN_PANEL = 380; // narrowest the graph panel can be dragged to
const MIN_CHAT = 300; // narrowest the chat can be squeezed to
const SPLIT_STEP = 24; // px per arrow-key press on the divider

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ink = (a: number | string) => alpha(QP.ink, a);

/** The four sources the demo reads, with the one-line fact shown next to each. */
const SOURCES = [
  { file: "salary.xlsx", note: "10 rows", pdf: false },
  { file: "leave.xlsx", note: "10 rows", pdf: false },
  { file: "taxslabs.pdf", note: "7 slabs", pdf: true },
  { file: "leavepolicy.pdf", note: "policy", pdf: true },
] as const;

/*
 * The button reset below is wrapped in :where() so it has zero specificity.
 * A plain `.qpw button` rule beats single-class selectors such as `.qd-chip` and strips their borders,
 * padding and background, which is what flattened the follow-up chips and the send button.
 */
const WORKSPACE_CSS = `
.qpw, .qpw * { box-sizing: border-box; }
.qpw {
  position: relative; isolation: isolate; display: flex; width: 100%; min-width: 0; overflow: hidden;
  border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: #050506;
  color: ${QP.ink}; font-family: ${SANS}; color-scheme: dark;
  box-shadow: 0 0 0 1px rgba(0,0,0,.7), 0 40px 90px -40px rgba(0,0,0,.95);
}
.qpw[data-stacked="1"] { flex-direction: column; }
.qpw[data-drag="1"] { user-select: none; cursor: col-resize; }
.qpw[data-drag="1"] .qpw-main, .qpw[data-drag="1"] .qpw-panel { pointer-events: none; }

/* draggable edge between chat and graph: zero layout width, a 12px hit area straddling the border */
.qpw-split { position: relative; flex: none; width: 0; z-index: 5; }
.qpw-hit { position: absolute; top: 0; bottom: 0; left: -6px; display: flex; align-items: center; justify-content: center; width: 12px; cursor: col-resize; touch-action: none; outline: none; }
.qpw-hit::after { content: ""; width: 2px; height: 100%; background: transparent; transition: background .15s; }
.qpw-hit i { position: absolute; top: 50%; width: 4px; height: 36px; margin-top: -18px; border-radius: 99px; background: rgba(255,255,255,.35); opacity: 0; transition: opacity .15s; pointer-events: none; }
.qpw-hit:hover::after, .qpw-hit:focus-visible::after, .qpw[data-drag="1"] .qpw-hit::after { background: ${QP.hi}; }
.qpw-hit:hover i, .qpw-hit:focus-visible i, .qpw[data-drag="1"] .qpw-hit i { opacity: 1; }
:where(.qpw) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.qpw button:focus-visible { outline: 2px solid rgba(236,233,222,.8); outline-offset: 2px; }

/* sidebar */
.qpw-side { flex: none; overflow: hidden; background: #08080a; border-right: 1px solid rgba(255,255,255,.08); }
.qpw-sin { display: flex; flex-direction: column; gap: 18px; width: ${SIDE_W}px; height: 100%; padding: 14px 10px; }
.qpw-ws { display: flex; align-items: center; gap: 10px; padding: 2px 8px 4px; min-width: 0; }
.qpw-mark { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.04); color: ${QP.hi}; }
.qpw-wn { min-width: 0; line-height: 1.25; }
.qpw-wn b { display: block; font-size: 14px; font-weight: 580; letter-spacing: -.01em; color: ${QP.ink}; }
.qpw-wn span { display: block; font-size: 12px; color: ${ink(0.45)}; }
.qpw-nav { display: grid; gap: 2px; }
.qpw-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 34px; padding: 0 10px; border-radius: 9px; font-size: 14px; text-align: left; color: ${ink(0.72)}; transition: background .15s, color .15s; }
.qpw-row:hover { background: rgba(255,255,255,.05); color: ${QP.ink}; }
.qpw-row[data-on="1"] { background: rgba(255,255,255,.07); color: ${QP.ink}; }
.qpw-row svg { flex: none; color: ${ink(0.5)}; }
.qpw-row[data-on="1"] svg { color: ${QP.ink}; }
.qpw-live { margin-left: auto; width: 6px; height: 6px; border-radius: 99px; background: ${QP.hi}; box-shadow: 0 0 0 3px ${alpha(QP.hi, 0.22)}; animation: qpw-pulse 1.1s ease-in-out infinite; }
.qpw-lab { padding: 0 10px 6px; font-size: 12px; color: ${ink(0.42)}; }
.qpw-src { display: flex; align-items: center; gap: 10px; min-height: 32px; padding: 0 10px; font-size: 13.5px; color: ${ink(0.72)}; }
.qpw-src i { margin-left: auto; font-style: normal; font-family: ${MONO}; font-size: 11.5px; color: ${ink(0.4)}; }

/* chat column */
.qpw-main { position: relative; flex: 1 1 0%; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.qpw-bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 44px; padding: 0 12px 0 18px; font-size: 13px; color: ${ink(0.5)}; }
.qpw-bar span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qpw-tg { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 8px; color: ${ink(0.55)}; transition: background .15s, color .15s; }
.qpw-tg:hover { background: rgba(255,255,255,.06); color: ${QP.ink}; }
.qpw-tg[aria-pressed="true"] { background: rgba(255,255,255,.08); color: ${QP.ink}; }
.qpw-body { position: relative; flex: 1 1 0%; min-height: 0; }
/* the chat fills its slot; the window already draws the outer border and corners */
.qpw-chat.qd { position: absolute; inset: 0; border: 0; border-radius: 0; box-shadow: none; }

/* graph panel */
.qpw-panel { position: relative; flex: none; overflow: hidden; background: ${QP.bg}; }
.qpw-pin { display: flex; flex-direction: column; min-width: 0; }
.qpw-ph { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 44px; padding: 0 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
.qpw-tab { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 8px; background: rgba(255,255,255,.07); font-size: 13px; color: ${QP.ink}; white-space: nowrap; }
.qpw-tab svg { color: ${ink(0.6)}; }
.qpw-ps { display: flex; align-items: center; gap: 8px; min-width: 0; margin-left: auto; font-family: ${MONO}; font-size: 12px; color: ${ink(0.55)}; }
.qpw-ps span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qpw-dot { flex: none; width: 7px; height: 7px; border-radius: 99px; }
.qpw-dot[data-p="1"] { animation: qpw-pulse 1.3s ease-in-out infinite; }
.qpw-x { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 8px; color: ${ink(0.55)}; transition: background .15s, color .15s; }
.qpw-x:hover { background: rgba(255,255,255,.07); color: ${QP.ink}; }
.qpw-trace { flex: 1 1 0%; min-height: 0; }

@keyframes qpw-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
@media (prefers-reduced-motion: reduce) {
  .qpw, .qpw-panel, .qpw-side { transition: none !important; }
  .qpw-live, .qpw-dot[data-p="1"] { animation: none; }
}
`;

function runStatus(run: TraceRun | null): { label: string; ink: string; pulse: boolean } {
  if (!run) return { label: "Standing by", ink: ink(0.35), pulse: false };
  switch (run.status) {
    case "running":
      return { label: "Running", ink: QP.hi, pulse: true };
    case "completed":
      return { label: "Completed", ink: QP.ok, pulse: false };
    case "blocked":
      return { label: "Blocked by guard", ink: QP.bad, pulse: false };
    default:
      return { label: "Failed", ink: QP.bad, pulse: false };
  }
}

function QueryPilotWorkspace({ title = "Payroll workspace" }: { title?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastRunId = useRef("");
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [run, setRun] = useState<TraceRun | null>(null);
  const [open, setOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  /** Graph panel width chosen by dragging, in px. `null` means "use the default share". */
  const [userW, setUserW] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Measure the real frame, not the viewport, so the layout follows the site's constrained width.
  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const bw = Math.round(r.width);
      const bh = Math.round(r.height);
      setBox((p) => (p.w === bw && p.h === bh ? p : { w: bw, h: bh }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** The chat reports every step of a run here. A run we have not seen before opens the graph. */
  const onTraceChange = useCallback((next: TraceRun | null) => {
    setRun(next);
    if (!next) {
      lastRunId.current = "";
      setOpen(false);
      return;
    }
    if (next.id !== lastRunId.current) {
      lastRunId.current = next.id;
      setOpen(true);
    }
  }, []);

  const newChat = () => {
    lastRunId.current = "";
    setRun(null);
    setOpen(false);
    setChatKey((k) => k + 1);
  };

  const measured = box.w > 0;
  const stacked = measured && box.w < STACK_BELOW;
  const hasSide = measured && !stacked && box.w >= SIDE_FROM;
  // With the graph open on a mid-size frame the sidebar steps aside, so the chat keeps a readable width.
  const sideOn = hasSide && (!open || box.w >= SIDE_KEEP_OPEN_FROM);
  const sideW = sideOn ? SIDE_W : 0;
  // The graph keeps at least MIN_PANEL, the chat at least MIN_CHAT; inside that the person decides.
  const defaultPanelW = clampN(Math.round((box.w - sideW) * 0.5), 420, 760);
  const maxPanelW = Math.max(MIN_PANEL, box.w - sideW - MIN_CHAT);
  const panelW = stacked ? box.w : clampN(userW ?? defaultPanelW, MIN_PANEL, maxPanelW);
  const status = runStatus(run);
  const running = run?.status === "running";

  const onSplitDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onSplitMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !rootRef.current) return;
    // The graph panel is the right-most column, so its width is the distance from the pointer to the frame's right edge.
    const right = rootRef.current.getBoundingClientRect().right - 1;
    setUserW(clampN(Math.round(right - e.clientX), MIN_PANEL, maxPanelW));
  };
  const onSplitUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onSplitKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? SPLIT_STEP * 3 : SPLIT_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setUserW(clampN(panelW + step, MIN_PANEL, maxPanelW));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setUserW(clampN(panelW - step, MIN_PANEL, maxPanelW));
    } else if (e.key === "Home") {
      e.preventDefault();
      setUserW(null);
    }
  };

  const hide = (isOpen: boolean) => `visibility 0s linear ${isOpen ? "0s" : ".55s"}`;
  const line = ink(0.08);
  const panelStyle: CSSProperties = stacked
    ? { width: "100%", height: open ? STACK_PANEL_H : 0, transition: `height ${EASE}, ${hide(open)}`, borderTop: `1px solid ${open ? line : "transparent"}`, visibility: open ? "visible" : "hidden" }
    : {
        width: open ? panelW : 0,
        height: "100%",
        // No width animation while dragging, so the panel follows the pointer exactly.
        transition: dragging ? hide(open) : `width ${EASE}, ${hide(open)}`,
        borderLeft: `1px solid ${open ? line : "transparent"}`,
        visibility: open ? "visible" : "hidden",
      };

  return (
    <div
      ref={rootRef}
      data-stacked={stacked ? "1" : "0"}
      data-drag={dragging ? "1" : "0"}
      className="qpw"
      style={{ height: stacked ? (open ? STACK_CHAT_H + STACK_PANEL_H : STACK_CHAT_H) : DEMO_H, transition: stacked ? `height ${EASE}` : undefined }}
    >
      <style>{WORKSPACE_CSS}</style>

      {hasSide ? (
        <aside
          className="qpw-side"
          aria-label="Workspace"
          aria-hidden={!sideOn}
          style={{ width: sideW, transition: `width ${EASE}, ${hide(sideOn)}`, visibility: sideOn ? "visible" : "hidden", borderRightColor: sideOn ? line : "transparent" }}
        >
          <div className="qpw-sin">
            <div className="qpw-ws">
              <span className="qpw-mark" aria-hidden>
                <Waypoints size={15} strokeWidth={2} />
              </span>
              <div className="qpw-wn">
                <b>QueryPilot</b>
                <span>{title}</span>
              </div>
            </div>

            <nav className="qpw-nav" aria-label="Actions">
              <button type="button" className="qpw-row" data-on="1" onClick={newChat}>
                <Plus size={15} strokeWidth={1.9} aria-hidden />
                New chat
              </button>
              <button type="button" className="qpw-row" data-on={open ? "1" : "0"} onClick={() => setOpen((v) => !v)} aria-pressed={open}>
                <Waypoints size={15} strokeWidth={1.9} aria-hidden />
                Execution trace
                {running ? <span className="qpw-live" aria-hidden /> : null}
              </button>
            </nav>

            <div>
              <div className="qpw-lab">Sources</div>
              {SOURCES.map((s) => {
                const Icon = s.pdf ? FileText : FileSpreadsheet;
                return (
                  <div key={s.file} className="qpw-src">
                    <Icon size={15} strokeWidth={1.8} aria-hidden style={{ color: s.pdf ? QP.docs : QP.table }} />
                    {s.file}
                    <i>{s.note}</i>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      ) : null}

      <section className="qpw-main" aria-label="Chat">
        <div className="qpw-bar">
          <span>{hasSide ? "New chat" : `QueryPilot · ${title}`}</span>
          <button
            type="button"
            className="qpw-tg"
            onClick={() => setOpen((v) => !v)}
            aria-pressed={open}
            aria-label={open ? "Close the execution graph" : "Open the execution graph"}
            title={open ? "Close graph" : "Open graph"}
          >
            <PanelRight size={16} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        <div className="qpw-body">
          <QueryPilotDemo key={chatKey} className="qpw-chat" title={title} autoPlayFirst={chatKey === 0} onTraceChange={onTraceChange} />
        </div>
      </section>

      {open && measured && !stacked ? (
        <div className="qpw-split">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat and execution graph. Arrow keys resize, Home resets."
            aria-valuemin={MIN_PANEL}
            aria-valuemax={maxPanelW}
            aria-valuenow={panelW}
            tabIndex={0}
            className="qpw-hit"
            onPointerDown={onSplitDown}
            onPointerMove={onSplitMove}
            onPointerUp={onSplitUp}
            onPointerCancel={onSplitUp}
            onKeyDown={onSplitKey}
            onDoubleClick={() => setUserW(null)}
          >
            <i aria-hidden />
          </div>
        </div>
      ) : null}

      {measured ? (
        <aside className="qpw-panel" style={panelStyle} aria-label="Execution graph" aria-hidden={!open}>
          <div className="qpw-pin" style={{ width: stacked ? "100%" : panelW, height: stacked ? STACK_PANEL_H : "100%" }}>
            <div className="qpw-ph">
              <span className="qpw-tab">
                <Waypoints size={14} strokeWidth={1.9} aria-hidden />
                Execution trace
              </span>
              <span className="qpw-ps font-mono">
                <i className="qpw-dot" data-p={status.pulse ? "1" : "0"} style={{ background: status.ink }} aria-hidden />
                <span>{run?.label ? `${status.label} · ${run.label}` : status.label}</span>
              </span>
              <button type="button" className="qpw-x" onClick={() => setOpen(false)} aria-label="Close the execution graph" title="Close graph">
                <X size={15} strokeWidth={1.9} aria-hidden />
              </button>
            </div>
            <AgentTrace run={run} className="qpw-trace" />
          </div>
        </aside>
      ) : null}
    </div>
  );
}

/** The first showcase starts when the chat scrolls into view, and the graph opens as soon as it does. */
/** A soft cool-grey wash that shows only outside the card's left and right edges, fading in and out vertically. */
const HUE_MASK = "linear-gradient(to bottom, transparent 0%, #000 22%, #000 70%, transparent 100%)";
const HUE: CSSProperties = {
  background:
    "radial-gradient(ellipse 15% 58% at 10.9% 52%, rgba(160,172,240,.2), transparent 75%), radial-gradient(ellipse 15% 58% at 89.1% 52%, rgba(160,172,240,.2), transparent 75%)",
  WebkitMaskImage: HUE_MASK,
  maskImage: HUE_MASK,
};

function DemoSection() {
  return (
    <section aria-label="QueryPilot product demo" className="bg-[#0A0A0A] pb-[clamp(2.5rem,5.5vh,3.5rem)]">
      <div className={`qp-card relative isolate mx-auto ${FRAME}`}>
        <div aria-hidden="true" className="qp-hue pointer-events-none absolute -inset-x-[14%] -bottom-[22%] -top-[8%] -z-10" style={HUE} />
        <QueryPilotWorkspace />
      </div>
    </section>
  );
}

/** Fades and lifts a section the first time it scrolls into view. Skipped for reduced motion (see the CSS). */
function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="qp-reveal" data-seen={seen ? "1" : "0"}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- engineering -- */

// The animated cards live in components/hero/engineering-preview.tsx.
// Re-exported so anything that imported this file's default export keeps working.
export default EngineeringPreview;

/* --------------------------------------------------------- landing page -- */

const PAGE_CSS = `
        :root {
          --qp-nav-h: 64px; /* 56 to 64px is the norm; large screens get 72px */
        }

        @media (min-width: 1600px) {
          :root {
            --qp-nav-h: 72px;
          }
        }

        html,
        body {
          background-color: #0a0a0a;
          overscroll-behavior-y: none;
        }

        html {
          scroll-padding-top: calc(var(--qp-nav-h) + 16px);
        }

        @media (prefers-reduced-motion: no-preference) {
          html {
            scroll-behavior: smooth;
          }
        }

        /* Motion. Until the page is ready only the bar is on screen. Then the hero text lifts in from below, the demo
           card follows, a soft hue comes up beside it and fades away again, and later sections rise once as they
           scroll into view. The hidden start state lives in this server-rendered CSS, so nothing flashes first. */
        .qp-rise,
        .qp-card,
        .qp-hue {
          opacity: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .qp-rise,
          .qp-card {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: no-preference) {
          [data-qp-ready="1"] .qp-rise {
            animation: qp-rise 1.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          [data-qp-ready="1"] .qp-card {
            animation: qp-card 1.7s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both;
          }
          [data-qp-ready="1"] .qp-hue {
            animation: qp-hue 7s ease-in-out 1.1s both;
          }
          .qp-reveal[data-seen="0"] {
            opacity: 0;
            transform: translateY(24px);
          }
          .qp-reveal[data-seen="1"] {
            opacity: 1;
            transform: none;
            transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes qp-rise {
          from {
            opacity: 0;
            transform: translateY(16px);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: none;
            filter: none;
          }
        }
        @keyframes qp-card {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes qp-hue {
          0% {
            opacity: 0;
          }
          22% {
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        /* One frame for everything: 92vw on phones, 1120px on laptops, wider on big screens, up to 1560px on TVs. */
        .querypilot-public-site {
          --qp-frame: min(92vw, clamp(1120px, 68vw, 1560px));
          overflow-x: clip;
        }

        .querypilot-public-site,
        .querypilot-public-site * {
          font-family: var(--font-geist), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .querypilot-public-site .font-mono,
        .querypilot-public-site [class*="font-mono"],
        .querypilot-public-site pre,
        .querypilot-public-site code {
          font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
        }
`;

const ENGINEERING_CSS = `
        .querypilot-engineering-page, .querypilot-engineering-page * { font-family: var(--font-geist), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
`;


export function LandingPage() {
  const [ready, setReady] = useState(false);

  // Start the motion only after hydration, the first measurement of the demo and the fonts, so the page never
  // paints a half-built state first. A short timeout keeps a slow font from holding the page back.
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const go = () => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => alive && setReady(true));
      });
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      // `go` runs on failure too, so a font error can never leave the hero invisible.
      Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 500))]).then(go, go);
    } else {
      go();
    }
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // After a hard reload, start at the top instead of restoring the old scroll.
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type !== "reload") return;

    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  return (
    <div data-qp-ready={ready ? "1" : "0"} className="querypilot-public-site min-h-screen bg-[#0A0A0A] text-white">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <noscript>
        <style>{".qp-rise,.qp-card{opacity:1!important}"}</style>
      </noscript>

      <PublicNav />

      <main>
        <Hero />
        <DemoSection />
        <Reveal>
          <FeaturesSection />
        </Reveal>
        <Reveal>
          <EngineeringPreview />
        </Reveal>
        <Reveal>
          <FinalCTASection />
        </Reveal>
      </main>
    </div>
  );
}

/* ------------------------------------------------------ engineering page -- */

/** Placeholder while the full engineering page is being rebuilt. */
export function EngineeringPage() {
  return (
    <div className="querypilot-engineering-page flex min-h-screen flex-col bg-[#0A0A0A] text-white">
      <style dangerouslySetInnerHTML={{ __html: ENGINEERING_CSS }} />

      <header className="border-b border-white/10">
        <div className={`mx-auto flex items-center justify-between ${FRAME}`} style={{ height: "var(--qp-nav-h, 64px)" }}>
          <Link href="/" className={`inline-flex items-center gap-2 rounded text-[14px] font-medium tracking-[-0.01em] ${focusRing}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/querypilot-logo.svg" alt="" aria-hidden="true" className="size-5 object-contain" />
            QueryPilot
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className={`mx-auto ${FRAME}`}>
          <h1 className="max-w-[40rem] text-[clamp(26px,2.8vw,36px)] font-medium leading-[1.2] tracking-[-0.03em]">
            The engineering write-up is being rebuilt.
          </h1>
          <p className="mt-4 max-w-[34rem] text-[15px] leading-[1.6] text-white/60">
            The architecture, routing and evidence checks will be documented here shortly.
          </p>
          <PixelDissolveButton
            label="Back to home"
            href="/"
            color="transparent"
            textColor={GHOST_TEXT}
            dissolveColor={GHOST_DISSOLVE}
            cellSize={5}
            className={`mt-8 ${PD_PILL} ${PD_GHOST_BORDER} !h-10`}
          />
        </div>
      </main>
    </div>
  );
}