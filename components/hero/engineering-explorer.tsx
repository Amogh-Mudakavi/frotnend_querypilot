"use client";

import Link from "next/link";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject, CSSProperties } from "react";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { createCssVariablesTheme, createHighlighter } from "shiki";
import type { BundledLanguage, ThemedToken } from "shiki";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";
import { Diagram, hasDiagram } from "./engineering-diagrams";

/* ============================================================================
 * Engineering docs kit.
 *
 *  - Palette: near-black surfaces, white at different strengths, and ONE accent (ACCENT, a soft indigo, the
 *    product's brand hue). OK / BAD mean state only (a check passed / failed). HOT (muted amber) is for warnings
 *    and for the PATCH method chip. No glow, no gradient fills.
 *  - Diagrams (Explorer): service cards joined by rounded elbow wires. Hover a card and the wires touching it
 *    light up. Click a card (or Tab to it and press Enter) to open its details. "Trace" sends a packet down every wire.
 *  - Mechanism cards (BuildCanvas, RequestFlow, Isolation, SqlLocks, WorkerPool, MessageLifecycle): start still or
 *    self-play, pause on hover, show their final state when reduced motion is preferred.
 *  - Docs blocks: paragraphs, tables, callouts, code panels, numbered steps, split blocks, link cards, fact tiles
 *    and an API endpoint table. Inline links: [label](c:chapter-id) or [label](https://...).
 *  - Hub: hero with a live code panel, fact strip, reading-path picker, lifecycle card, trace-a-question, section index.
 *  - Steps and Split blocks put the numbered text on the left and the Shiki code panel on the right (sticky on wide screens).
 *  - Code never scrolls sideways: long lines wrap.
 *
 * Nothing here is a host, ID, bucket, key, port or file path.
 * ========================================================================== */

/** The one accent: the product's brand indigo, lifted so it reads on near-black. */
export const ACCENT = "#8b93ff";
/** A lighter tint of the accent for inline links. */
export const LINK = "#aab0ff";
/** State only: a check passed, a job finished, a node came up. */
export const OK = "#5fcf99";
/** State only: a check failed, a request was rejected. */
export const BAD = "#e5665a";
/** A muted amber, only for warnings and the PATCH chip. */
export const HOT = "#d8b176";

/** One muted hue per documentation section. Used for small cues only (dots, rules), never for fills. */
export const HUE: Record<string, string> = {
  overview: "#8b93ff", architecture: "#5fb7a5", backend: "#7fa7d9", ingestion: "#c9a266", ai: "#b78fc4",
  ops: "#8fa3b8", reference: "#a8a8b0", roadmap: "#cf8d96", development: "#5fb7a5",
};
export const hue = (group: string) => HUE[group] ?? ACCENT;

/** "#rrggbb" + alpha -> "rgba(...)". */
export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* ------------------------------ button dissolve ------------------------------ */

/** Same look as the landing page pills. */
export const PD_PILL = "!rounded-full !min-h-0 !px-4 !text-[13px] !font-medium !normal-case !tracking-normal";
/** Slightly larger pill for the hero buttons on the docs home. */
export const PD_LG = "!rounded-full !min-h-0 !h-11 !px-5 !text-[14px] !font-medium !normal-case !tracking-normal";
export const PD_GHOST = "border !border-white/15";
export const PD_COLORS = { ghostText: "rgba(255,255,255,0.8)", ghostFx: "#4A4A4A", whiteFx: "#BDBDBD", whiteText: "#0A0A0A" };
const PD_CELL = 4;

const fxHash = (x: number, y: number, s: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453123;
  return v - Math.floor(v);
};

/** Light buttons get the grey dissolve, everything else the dark one. */
function fxColor(host: Element): string {
  const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(host).backgroundColor);
  if (!m) return PD_COLORS.ghostFx;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (!(a >= 0.5)) return PD_COLORS.ghostFx;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.58 ? PD_COLORS.whiteFx : PD_COLORS.ghostFx;
}

/**
 * Mount once inside the docs root. Hovering any <button> inside `.qpd` runs the pixel dissolve behind its content.
 * Skipped: touch, reduced motion, disabled buttons, `data-nofx`, absolutely positioned buttons (backdrops) and very wide ones.
 */
export function ButtonFx() {
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    type Live = { host: HTMLElement; canvas: HTMLCanvasElement; raf: number };
    let cur: Live | null = null;

    const stop = () => {
      if (!cur) return;
      cancelAnimationFrame(cur.raf);
      cur.canvas.remove();
      cur = null;
    };

    const start = (host: HTMLElement) => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.setAttribute("aria-hidden", "true");
      canvas.dataset.fx = "1";
      Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", width: `${w}px`, height: `${h}px`, zIndex: "-1", pointerEvents: "none", imageRendering: "pixelated" });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      host.prepend(canvas);

      const cols = Math.ceil(w / PD_CELL);
      const rows = Math.ceil(h / PD_CELL);
      const phase = new Float32Array(cols * rows);
      const speed = new Float32Array(cols * rows);
      const jitter = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          phase[i] = fxHash(c, r, 3.17) * Math.PI * 2;
          speed[i] = 0.6 + fxHash(c, r, 8.9) * 0.8;
          jitter[i] = fxHash(c, r, 13.4) - 0.5;
        }
      }

      const color = fxColor(host);
      const live: Live = { host, canvas, raf: 0 };
      cur = live;

      const draw = (now: number) => {
        if (cur !== live) return;
        if (!host.isConnected) { stop(); return; }
        if (!canvas.isConnected) host.prepend(canvas);
        live.raf = requestAnimationFrame(draw);
        const t = now * 0.001;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const wave = 0.5 + 0.5 * Math.sin(t * speed[i] * 2.4 + phase[i]);
            const strength = Math.abs((Math.min(1, Math.max(0, wave + jitter[i] * 0.15)) - 0.5) * 2);
            if (strength < 0.08) continue;
            ctx.globalAlpha = Math.min(0.82, 0.08 + strength * 0.72);
            ctx.fillRect(c * PD_CELL, r * PD_CELL, PD_CELL, PD_CELL);
          }
        }
        ctx.globalAlpha = 1;
      };
      live.raf = requestAnimationFrame(draw);
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const host = (e.target as Element | null)?.closest?.("button") as HTMLButtonElement | null;
      if (!host || host === cur?.host || !host.closest(".qpd")) return;
      stop();
      if (host.disabled || host.dataset.nofx !== undefined) return;
      if (host.querySelector(":scope > canvas:not([data-fx])")) return;
      const cs = getComputedStyle(host);
      if (cs.position === "absolute" || cs.position === "fixed" || host.offsetWidth > 700) return;
      start(host);
    };

    const out = (e: PointerEvent) => {
      if (!cur) return;
      const to = e.relatedTarget as Node | null;
      if (to && cur.host.contains(to)) return;
      stop();
    };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      stop();
    };
  }, []);

  return null;
}

/* ---------------------------------- icons ---------------------------------- */

export type IconName =
  | "home" | "upload" | "spark" | "search" | "menu" | "close" | "chev" | "copy" | "arrow" | "info" | "warn"
  | "layers" | "server" | "table" | "check" | "cloud" | "code" | "flag" | "play" | "stop" | "up" | "terminal" | "tick" | "replay"
  | "pause" | "step" | "lock" | "book" | "github" | "external" | "file";

const ICONS: Record<IconName, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5M10 20v-5h4v5",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  chev: "M9 6l6 6-6 6",
  copy: "M9 9h10v11H9zM5 15V4h10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  info: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8h.01M11 12h1v5h1",
  warn: "M12 4 3 20h18L12 4zM12 10v4M12 17h.01",
  layers: "M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  check: "M12 3a9 9 0 100 18 9 9 0 000-18zM8 12.5l3 3 5-6",
  cloud: "M7 18a4 4 0 01-.5-8A6 6 0 0118 9.5 4.3 4.3 0 0117.5 18H7z",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  play: "M7 4.5v15l12-7.5z",
  stop: "M6 6h12v12H6z",
  up: "M12 19V5M6 11l6-6 6 6",
  terminal: "M4 5h16v14H4zM7.5 10l3 2-3 2M12.5 15h4",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  replay: "M4 12a8 8 0 108-8M4 4v5h5",
  pause: "M8 5v14M16 5v14",
  step: "M6 5v14M10 5l9 7-9 7z",
  lock: "M7 11V8a5 5 0 0110 0v3M5 11h14v9H5zM12 15v2",
  book: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h11",
  github: "M9 19c-4 1.5-4-2-6-2m12 4v-3.5a3 3 0 00-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 00-6.2 0C6.3 2.1 5.3 2.4 5.3 2.4a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 003.9 8.8c0 4.6 2.8 5.7 5.5 6a3 3 0 00-.8 2.3V21",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
};

export function Icon({ n, className = "h-4 w-4" }: { n: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[n]} />
    </svg>
  );
}

/* ------------------------------ rich text + code ------------------------------ */

const LINK_CLS = "rounded-sm text-[#aab0ff] underline decoration-[#aab0ff]/30 underline-offset-[3px] transition-colors hover:decoration-[#aab0ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60";

/** `code`, **bold** and [label](c:chapter-id | https://...) inside plain strings, so content stays data. */
export function rich(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).map((s, i) => {
    if (s.length > 2 && s.startsWith("`") && s.endsWith("`")) {
      return <code key={i} className="qpe-mono rounded-md border border-white/[0.14] bg-white/[0.07] px-1.5 py-0.5 text-[0.88em] text-white [overflow-wrap:anywhere]">{s.slice(1, -1)}</code>;
    }
    if (s.length > 4 && s.startsWith("**") && s.endsWith("**")) return <strong key={i} className="font-semibold text-white">{s.slice(2, -2)}</strong>;
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(s);
    if (m) {
      if (m[2].startsWith("c:")) return <Link key={i} href={to(m[2].slice(2))} scroll={false} className={LINK_CLS}>{m[1]}</Link>;
      return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>{m[1]}</a>;
    }
    return s;
  });
}

const TOKEN = /(#.*$|--.*$)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(def|return|if|else|elif|for|in|with|raise|import|from|not|and|or|None|True|False|while|break|class|SELECT|FROM|WHERE|WITH|SUM|COUNT|GROUP|BY|ORDER|LIMIT|AS|JOIN|ON)\b|(\b\d+(?:\.\d+)?\b)/gm;

/** Comments dim, strings white, keywords in the accent, numbers soft white. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    if (m[1]) out.push(<span key={k++} className="text-white/45">{m[0]}</span>);
    else if (m[2]) out.push(<span key={k++} className="text-white">{m[0]}</span>);
    else if (m[3]) out.push(<span key={k++} style={{ color: ACCENT }}>{m[0]}</span>);
    else out.push(<span key={k++} className="text-white/65">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  out.push(code.slice(last));
  return out;
}

/** Shell lines: the command in the accent, its arguments in white, `# comments` dimmed. */
function shell(code: string): ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const nl = i < lines.length - 1 ? "\n" : "";
    if (/^\s*#/.test(line)) return <Fragment key={i}><span className="text-white/45">{line}</span>{nl}</Fragment>;
    const m = /^(\s*)(\S+)(.*?)(\s+#.*)?$/.exec(line);
    if (!m) return <Fragment key={i}>{line}{nl}</Fragment>;
    return (
      <Fragment key={i}>
        {m[1]}
        <span style={{ color: ACCENT }}>{m[2]}</span>
        <span className="text-white/85">{m[3]}</span>
        {m[4] && <span className="text-white/45">{m[4]}</span>}
        {nl}
      </Fragment>
    );
  });
}

export const EXPLORER_CSS = `
@keyframes qpe-flow{to{stroke-dashoffset:-24}}
@keyframes qpe-fade{from{opacity:0}to{opacity:1}}
@keyframes qpe-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes qpe-spin{to{transform:rotate(360deg)}}
@keyframes qpe-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes qpe-caret{50%{opacity:0}}
@keyframes qpe-rain{0%{transform:translateY(0);opacity:0}15%{opacity:.9}85%{opacity:.9}100%{transform:translateY(-34px);opacity:0}}
@keyframes qpe-slide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes qpe-pulse{0%,100%{opacity:.35}50%{opacity:1}}
.qpe-mono,.qpe-mono code{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono","Courier New",monospace;font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0;tab-size:2}
.qpe-flow{stroke-dasharray:3 9;animation:qpe-flow 1.6s linear infinite}
.qpe-on{stroke-dasharray:7 5;animation-duration:.5s}
.qpe-pop{animation:qpe-fade .18s both}
.qpe-rise{animation:qpe-rise .45s cubic-bezier(.2,.7,.2,1) both}
.qpe-slide{animation:qpe-slide .4s cubic-bezier(.2,.7,.2,1) both}
.qpe-draw{stroke-dasharray:1;animation:qpe-draw .7s ease-out both}
.qpe-spin{transform-box:fill-box;transform-origin:center;animation:qpe-spin .9s linear infinite}
.qpe-caret{animation:qpe-caret 1s step-end 3}
.qpe-live{animation:qpe-pulse 2s ease-in-out 2}
.qpe-rain>i{position:absolute;bottom:0;display:block;width:3px;height:3px;background:${OK};opacity:0;animation:qpe-rain 1.8s linear 2}
.qpe-panel{background-color:#0b0b0c}
.qpd{--shiki-foreground:#e6e6e6;--shiki-background:transparent;--shiki-token-constant:#ffa657;--shiki-token-string:#a5d6ff;--shiki-token-comment:#6e7681;--shiki-token-keyword:#ff7b72;--shiki-token-parameter:#ffa657;--shiki-token-function:#79c0ff;--shiki-token-string-expression:#7ee787;--shiki-token-punctuation:#9aa4b2;--shiki-token-link:#79c0ff}
.qpe-card{transition:border-color .2s,background-color .2s}
.qpe-card:hover{border-color:rgba(255,255,255,.45)}
.qpe-node{outline:none}
.qpe-node:focus-visible rect.qpe-body{stroke:#fff!important;stroke-width:2}
.qpe-step{container-type:inline-size}
.qpe-sg{display:grid;gap:18px 36px;grid-template-columns:minmax(0,1fr)}
.qpe-code{transition:border-color .3s}
.qpe-step[data-on="1"] .qpe-code{border-color:rgba(255,255,255,.45)}
.qpe-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}
:where(.qpd) button{position:relative;isolation:isolate;overflow:hidden}
.qpe-cw{container-type:inline-size}
.qpe-two,.qpe-lc{display:grid;grid-template-columns:minmax(0,1fr)}
.qpe-two>.qpe-two-b{border-top:1px solid rgba(255,255,255,.1)}
.qpe-lc>.qpe-lc-l{border-bottom:1px solid rgba(255,255,255,.1)}
.qpe-pool{grid-template-columns:minmax(0,1fr)}
.qpe-ex{grid-template-columns:minmax(0,1fr)}
.qpe-ex-tabs{flex-direction:row}
.qpe-locks{flex-direction:column}
.qpe-locks>.qpe-arr{display:none}
@container (min-width:760px){.qpe-ex{grid-template-columns:250px minmax(0,1fr)}.qpe-ex-tabs{flex-direction:column}}
@container (min-width:860px){.qpe-pool{grid-template-columns:minmax(0,.8fr) minmax(0,1.3fr) minmax(0,1fr)}}
@container (min-width:880px){.qpe-two{grid-template-columns:repeat(2,minmax(0,1fr))}.qpe-two>.qpe-two-b{border-top:0;border-left:1px solid rgba(255,255,255,.1)}}
@container (min-width:900px){.qpe-lc{grid-template-columns:repeat(2,minmax(0,1fr))}.qpe-lc>.qpe-lc-l{border-bottom:0;border-right:1px solid rgba(255,255,255,.1)}.qpe-locks{flex-direction:row;align-items:stretch}.qpe-locks>.qpe-arr{display:grid}}
@container (min-width:700px){
  .qpe-sg{grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr)}
  .qpe-sg>.qpe-sticky{align-self:start;position:sticky;top:calc(var(--nav,60px) + 20px)}
}
@media (prefers-reduced-motion:reduce){
  .qpe-flow,.qpe-spin,.qpe-caret,.qpe-rain>i,.qpe-rise,.qpe-slide,.qpe-draw,.qpe-live{animation:none!important}
  .qpe-dot{display:none}.qpe-rain{display:none}.qpe-step *{transition:none!important}.qpe-pop{animation:none}
}
`;

/* -------------------------------- diagram engine -------------------------------
 *
 * Every diagram is data: boxes, optional zones, edges and a list of "spots" (what each box does).
 * The engine draws service cards, joins them with rounded elbow wires, and keeps the spot text in a panel
 * beside the picture. Nothing floats over the diagram, so nothing can cover a box.
 */

export interface Box { x: number; y: number; w: number; h: number }
export interface N extends Box { id: string; label: string; sub?: string; ghost?: boolean }
interface Z extends Box { id: string; label: string; solid?: boolean }
type E = [from: string, to: string, label?: string];
type Side = "tr" | "tl" | "t" | "r" | "b" | "l";
/** `at` is a box id (node or zone). The panel shows this text when that box is in focus. `side` is kept for old specs and ignored. */
export interface Spot { at: string; title: string; desc: string; lines?: string[]; side?: Side }
export interface Spec { w: number; h: number; nodes: N[]; zones?: Z[]; edges: E[]; spots: Spot[] }

export const nd = (id: string, label: string, sub: string | undefined, x: number, y: number, w = 150, h = 56, ghost = false): N => ({ id, label, sub, x, y, w, h, ghost });
export const zn = (id: string, label: string, x: number, y: number, w: number, h: number, solid = false): Z => ({ id, label, x, y, w, h, solid });

type Pt = [number, number];
export interface Route { d: string; lx: number; ly: number; anchor: "start" | "middle" | "end"; a: Pt; b: Pt }

/** A polyline with every corner rounded. Segments shorter than twice the radius round less. */
function rounded(pts: Pt[], r = 12): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.5) { d += `L${cx} ${cy}`; continue; }
    d += `L${cx - ((cx - px) / l1) * rr} ${cy - ((cy - py) / l1) * rr}Q${cx} ${cy} ${cx + ((nx - cx) / l2) * rr} ${cy + ((ny - cy) / l2) * rr}`;
  }
  const e = pts[pts.length - 1];
  return `${d}L${e[0]} ${e[1]}`;
}

export function route(a: N, b: N, label?: string): Route {
  const need = (label ? label.length : 0) * 7.2 + 16;
  const ac = a.y + a.h / 2;
  const bc = b.y + b.h / 2;
  const fwd = b.x >= a.x + a.w - 1;
  const back = b.x + b.w <= a.x + 1;
  if (fwd || back) {
    const sx = fwd ? a.x + a.w : a.x;
    const ex = fwd ? b.x : b.x + b.w;
    const mx = (sx + ex) / 2;
    if (Math.abs(ac - bc) < 2) return { d: rounded([[sx, ac], [ex, ac]]), lx: mx, ly: ac - 9, anchor: "middle", a: [sx, ac], b: [ex, ac] };
    const d = rounded([[sx, ac], [mx, ac], [mx, bc], [ex, bc]]);
    if (Math.abs(ex - mx) >= need) return { d, lx: ex + (fwd ? -10 : 10), ly: bc - 9, anchor: fwd ? "end" : "start", a: [sx, ac], b: [ex, bc] };
    return { d, lx: mx + 9, ly: (ac + bc) / 2 + 4, anchor: "start", a: [sx, ac], b: [ex, bc] };
  }
  const down = b.y >= a.y;
  const sx = a.x + a.w / 2;
  const ex = b.x + b.w / 2;
  const sy = down ? a.y + a.h : a.y;
  const ey = down ? b.y : b.y + b.h;
  const my = (sy + ey) / 2;
  if (Math.abs(sx - ex) < 2) return { d: rounded([[sx, sy], [sx, ey]]), lx: sx + 9, ly: my + 4, anchor: "start", a: [sx, sy], b: [ex, ey] };
  return { d: rounded([[sx, sy], [sx, my], [ex, my], [ex, ey]]), lx: ex + 9, ly: (my + ey) / 2 + 4, anchor: "start", a: [sx, sy], b: [ex, ey] };
}

const ctl = "inline-flex h-8 items-center gap-1.5 rounded-md border border-white/20 px-2.5 text-[13.5px] text-white/85 transition-colors hover:border-white/55 hover:text-white disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";

export function Explorer({ spec, title }: { spec: Spec; title: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { w: W, h: H } = spec;
  const [active, setActive] = useState<number | null>(null);
  /** Trace step. null = off. k = wires before k are done, wire k is live, k === wires.length = finished. */
  const [flow, setFlow] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const nodeById = useMemo(() => Object.fromEntries(spec.nodes.map((n) => [n.id, n])) as Record<string, N>, [spec]);
  /** Box id -> index of its spot, so a click on the box opens its details. */
  const spotOf = useMemo(() => {
    const m: Record<string, number> = {};
    spec.spots.forEach((s, i) => { if (m[s.at] === undefined) m[s.at] = i; });
    return m;
  }, [spec]);

  const members = useMemo(() => {
    const s = new Set<string>();
    if (active === null) return s;
    const at = spec.spots[active].at;
    if (nodeById[at]) { s.add(at); return s; }
    const z = spec.zones?.find((q) => q.id === at);
    if (z) spec.nodes.forEach((n) => {
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) s.add(n.id);
    });
    return s;
  }, [active, spec, nodeById]);

  const flowNodes = useMemo(() => {
    const s = new Set<string>();
    if (flow === null) return s;
    spec.edges.slice(0, Math.min(flow + 1, spec.edges.length)).forEach(([a, b]) => { s.add(a); s.add(b); });
    return s;
  }, [flow, spec.edges]);

  // Trace: one wire at a time, then hold on the finished picture for a moment and switch off.
  useEffect(() => {
    if (flow === null) return;
    if (flow >= spec.edges.length) {
      const t = setTimeout(() => setFlow(null), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setFlow((f) => (f === null ? null : f + 1)), 320);
    return () => clearTimeout(t);
  }, [flow, spec.edges.length]);

  const pick = (i: number) => { setFlow(null); setActive((a) => (a === i ? null : i)); };
  const toggleFlow = () => { if (flow === null) { setActive(null); setFlow(0); } else setFlow(null); };

  const caption =
    flow === null
      ? "Hover or click a box to light its wires. Trace sends one packet down every wire."
      : flow >= spec.edges.length
        ? "Trace complete"
        : (() => {
            const [a, b, l] = spec.edges[flow];
            return `Step ${flow + 1} of ${spec.edges.length}: ${nodeById[a].label} → ${nodeById[b].label}${l ? ` (${l})` : ""}`;
          })();

  return (
    <figure className="mt-7" onKeyDown={(e: ReactKeyboardEvent) => { if (e.key === "Escape") { setActive(null); setFlow(null); } }}>
      <div className="grid gap-4">
        <div className="qpe-panel min-w-0 overflow-hidden rounded-[10px] border border-white/[0.14]">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
            <span className="qpe-mono min-w-0 flex-1 truncate text-[13.5px] text-white/60">{title}</span>
            <span className="qpe-mono hidden shrink-0 text-[13px] text-white/40 sm:block">{spec.nodes.length} boxes · {spec.edges.length} wires</span>
            <button type="button" onClick={toggleFlow} className={ctl}>
              <Icon n={flow === null ? "play" : "stop"} className="h-3.5 w-3.5" />
              {flow === null ? "Trace" : "Stop"}
            </button>
          </div>

          <div className="qpe-scroll overflow-x-auto">
            <div className="relative min-w-[760px]" style={{ aspectRatio: `${W} / ${H}` }}>
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block h-full w-full" role="img" aria-label={title} onClick={() => setActive(null)}>
                <defs>
                  <marker id={`a${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>
                  <marker id={`b${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker>
                </defs>

                {spec.zones?.map((z) => {
                  const zi = spotOf[z.id];
                  const on = zi !== undefined && zi === active;
                  return (
                    <g key={z.id}>
                      <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="12" fill={z.solid ? hexA(ACCENT, 0.035) : "rgba(255,255,255,.018)"} stroke={on ? ACCENT : z.solid ? hexA(ACCENT, 0.32) : "rgba(255,255,255,.11)"} strokeWidth={on ? 1.6 : 1} style={{ transition: "stroke .2s" }} />
                      <text x={z.x + 16} y={z.y + 24} fontSize="12.5" letterSpacing="0.06em" className="qpe-mono" fill={z.solid ? hexA(ACCENT, 0.95) : "rgba(255,255,255,.5)"} style={{ textTransform: "uppercase" }}>{z.label}</text>
                      {zi !== undefined && (
                        <rect
                          x={z.x} y={z.y} width={z.w} height="34" fill="transparent" style={{ cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); pick(zi); }}
                        />
                      )}
                    </g>
                  );
                })}

                {spec.edges.map(([from, to, text], i) => {
                  const r = route(nodeById[from], nodeById[to], text);
                  const st = flow === null ? "rest" : i < flow ? "done" : i === flow ? "live" : "idle";
                  const near = hover !== null && (from === hover || to === hover);
                  const on = members.has(from) || members.has(to) || st === "live" || near;
                  const lit = on || st === "done";
                  const opacity = st === "idle" ? 0.2 : hover !== null && !near && st === "rest" ? 0.3 : 1;
                  return (
                    <g key={i} opacity={opacity} style={{ transition: "opacity .25s" }}>
                      <path
                        d={r.d}
                        fill="none"
                        stroke={lit ? ACCENT : "rgba(255,255,255,.3)"}
                        strokeWidth={on ? 1.7 : 1.2}
                        className={on ? "qpe-flow qpe-on" : ""}
                        markerEnd={`url(#${lit ? "b" : "a"}${uid})`}
                        style={{ transition: "stroke .2s" }}
                      />
                      <circle cx={r.a[0]} cy={r.a[1]} r="3" fill="#0b0b0c" stroke={lit ? ACCENT : "rgba(255,255,255,.4)"} strokeWidth="1.2" />
                      {text && <text x={r.lx} y={r.ly} textAnchor={r.anchor} fontSize="13" className="qpe-mono" fill={lit ? ACCENT : "rgba(255,255,255,.62)"} stroke="#0b0b0c" strokeWidth="4" paintOrder="stroke">{text}</text>}
                      {on && (
                        <circle r={st === "live" ? 4 : 3} fill="#fff" className="qpe-dot"><animateMotion dur={st === "live" ? "0.9s" : "1.4s"} repeatCount="indefinite" path={r.d} /></circle>
                      )}
                    </g>
                  );
                })}

                {spec.nodes.map((n) => {
                  const sel = members.has(n.id);
                  const on = sel || flowNodes.has(n.id) || hover === n.id;
                  const dim = flow !== null && !flowNodes.has(n.id);
                  const si = spotOf[n.id];
                  const lf = Math.max(13.5, Math.min(18, (n.w - 18) / (n.label.length * 0.56)));
                  const sf = n.sub ? Math.max(11, Math.min(14, (n.w - 20) / (n.sub.length * 0.6))) : 0;
                  return (
                    <g
                      key={n.id}
                      className="qpe-node"
                      role={si !== undefined ? "button" : undefined}
                      tabIndex={si !== undefined ? 0 : undefined}
                      aria-label={si !== undefined ? `${n.label}: highlight connections` : undefined}
                      aria-pressed={si !== undefined ? sel : undefined}
                      opacity={n.ghost ? 0.8 : dim ? 0.4 : 1}
                      style={{ cursor: si !== undefined ? "pointer" : "default", transition: "opacity .25s" }}
                      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(n.id); }}
                      onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                      onFocus={() => setHover(n.id)}
                      onBlur={() => setHover((h) => (h === n.id ? null : h))}
                      onClick={(e) => { e.stopPropagation(); if (si !== undefined) pick(si); }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && si !== undefined) { e.preventDefault(); pick(si); } }}
                    >
                      <rect
                        className="qpe-body"
                        x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                        fill={sel ? hexA(ACCENT, 0.1) : "#111113"}
                        stroke={on ? ACCENT : "rgba(255,255,255,.15)"}
                        strokeDasharray={n.ghost ? "4 3" : undefined}
                        strokeWidth={on ? 1.5 : 1}
                        style={{ transition: "stroke .2s, fill .2s" }}
                      />
                      <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -3 : 5)} textAnchor="middle" fontSize={lf} fontWeight={500} fill="#fff" pointerEvents="none">{n.label}</text>
                      {n.sub && <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 14} textAnchor="middle" fontSize={sf} className="qpe-mono" fill="rgba(255,255,255,.55)" pointerEvents="none">{n.sub}</text>}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="flex min-h-[40px] items-center gap-3 border-t border-white/10 px-4 py-2 text-[13.5px]">
            {flow !== null && (
              <span aria-hidden="true" className="h-[3px] w-24 shrink-0 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, ((flow + 1) / (spec.edges.length + 1)) * 100)}%`, background: ACCENT }} />
              </span>
            )}
            <span aria-live="polite" className={`min-w-0 [overflow-wrap:anywhere] ${flow === null ? "text-white/50" : "qpe-mono text-white/90"}`}>{caption}</span>
          </div>
        </div>
      </div>
    </figure>
  );
}


/* ------------------------------------ diagrams ------------------------------------ */

/**
 * The whole product on one picture. Read left to right: web app, API, then the question pipeline, the queue,
 * the worker and the stores. Edges only join neighbouring columns so nothing crosses a box.
 */
export const PRODUCT: Spec = {
  w: 1000, h: 430,
  zones: [zn("derived", "derived from uploaded files", 720, 50, 270, 240)],
  nodes: [
    nd("web", "Web app", "Next.js on Vercel", 20, 187, 140),
    nd("api", "Django API", "JWT + ownership", 210, 187, 150),
    nd("pipe", "Question pipeline", "Scope Guard, planner, graph", 440, 20, 180),
    nd("redis", "Redis", "job queue, cache, limits", 440, 102, 180),
    nd("worker", "Ingestion worker", "parse, chunk, embed", 440, 184, 180),
    nd("mysql", "Primary MySQL", "accounts, chats, jobs", 440, 266, 180),
    nd("files", "Object storage", "original uploads", 440, 348, 180),
    nd("vec", "Vector storage", "chunks, profiles", 740, 90, 230),
    nd("sql", "Structured MySQL", "one table per extracted table", 740, 210, 230),
  ],
  edges: [
    ["web", "api", "HTTPS"],
    ["api", "pipe"], ["api", "redis"], ["api", "mysql"], ["api", "files"],
    ["redis", "worker"],
    ["pipe", "vec", "search"], ["pipe", "sql", "SQL"],
    ["worker", "vec", "index"], ["worker", "sql", "tables"],
  ],
  spots: [
    { at: "web", title: "Web app", desc: "Next.js on Vercel, on its own origin. It talks only to the API, which is why the backend lists trusted origins for CORS and CSRF." },
    { at: "api", title: "Django API", desc: "One Django project split into apps. Every request carries a JWT and ids are checked against the owner. It serves requests and does nothing slow.", lines: ["custom JWT", "ownership in the query"] },
    { at: "pipe", title: "Question pipeline", desc: "Scope Guard routes the message, the planner says what has to be established, dispatch collects evidence and finish writes the answer.", lines: ["12 tool calls max", "2 recovery attempts"] },
    { at: "redis", title: "Redis", desc: "Carries the job id from the API to the worker, and holds cache and rate-limit counters. Job status lives in MySQL, so a lost message can be recovered." },
    { at: "worker", title: "Ingestion worker", desc: "Separate process, same image as the API. It is the only writer into the structured database.", lines: ["python manage.py", "ingestion_worker"] },
    { at: "mysql", title: "Primary MySQL", desc: "Accounts, tokens, workspaces, documents, jobs, conversations, messages and memory. The source of truth for job status." },
    { at: "files", title: "Object storage", desc: "The original uploaded files. Every chunk, row and profile is derived from them.", lines: ["dev: filesystem", "prod: S3"] },
    { at: "vec", title: "Vector storage", desc: "Embedded text chunks and document profiles. Chroma in development, S3 Vectors in production." },
    { at: "sql", title: "Structured MySQL", desc: "Real tables created from valid extracted tables. The question pipeline reads them through a read-only connection." },
  ],
};

export const SYSTEM: Spec = {
  w: 1000, h: 380,
  nodes: [
    nd("client", "Client", "Next.js on Vercel", 20, 200, 150),
    nd("api", "Django API", "JWT + ownership", 250, 200, 150),
    nd("mysql", "Primary MySQL", "application records", 470, 20, 170),
    nd("redis", "Redis", "queue, cache, limits", 470, 110, 170),
    nd("plan", "Planner graph", "Scope Guard + tools", 470, 200, 170),
    nd("files", "Object storage", "original uploads", 470, 290, 170),
    nd("worker", "Ingestion worker", "parse, chunk, embed", 740, 110, 200),
    nd("vec", "Vector storage", "chunks, profiles", 740, 200, 200),
    nd("sql", "Structured MySQL", "extracted tables", 740, 290, 200),
  ],
  edges: [["client", "api"], ["api", "mysql"], ["api", "redis"], ["api", "plan", "question"], ["api", "files"], ["redis", "worker", "job id"], ["plan", "vec", "search"], ["plan", "sql", "SQL"], ["worker", "vec", "index"]],
  spots: [
    { at: "api", title: "Django REST API", desc: "Every request needs a valid JWT. Workspace, document and conversation ids are checked against the owner.", lines: ["custom JWT", "ownership in the query"] },
    { at: "mysql", title: "Primary MySQL", desc: "Relational source of truth, including job status. Redis never holds the only copy of anything." },
    { at: "redis", title: "Redis", desc: "Job ids, cache and rate-limit counters. A lost message is recoverable because job state is in MySQL." },
    { at: "worker", title: "Ingestion worker", desc: "Separate process, same image as the API. Upload returns after validation; the worker does the slow part.", lines: ["python manage.py", "ingestion_worker"] },
    { at: "plan", title: "Planner graph", desc: "Scope Guard routes the message, the planner decides what has to be established, dispatch gathers evidence." },
    { at: "vec", title: "Vector storage", desc: "Embedded chunks and document profiles. Chroma in dev, S3 Vectors in production." },
    { at: "sql", title: "Structured MySQL", desc: "Real tables created from extracted tables. Queried with validated, read-only SQL." },
  ],
};

export const AUTH: Spec = {
  w: 1000, h: 370,
  zones: [zn("zr", "register", 40, 8, 790, 104), zn("zl", "login and refresh", 40, 132, 790, 224)],
  nodes: [
    nd("reg", "Register", "validate details", 80, 42, 150),
    nd("pend", "Pending signup", "hashed password", 270, 42, 150),
    nd("otp", "Email OTP", "hashed, 10 min", 460, 42, 150),
    nd("user", "Create user", "OTP marked used", 650, 42, 150),
    nd("login", "Login", "password check", 80, 170, 150),
    nd("access", "Access JWT", "15 min, HS256", 270, 170, 150),
    nd("call", "Protected call", "user id in token", 460, 170, 150),
    nd("refresh", "Refresh token", "7 days, SHA-256", 270, 276, 150),
    nd("rotate", "Rotate", "revoke old token", 460, 276, 150),
    nd("pair", "New pair", "new hash stored", 650, 276, 150),
  ],
  edges: [["reg", "pend"], ["pend", "otp"], ["otp", "user"], ["login", "access"], ["access", "call"], ["access", "refresh"], ["refresh", "rotate"], ["rotate", "pair"]],
  spots: [
    { at: "pend", title: "Pending signup", desc: "No real account until the email is verified. Password and OTP are hashed before they are saved." },
    { at: "otp", title: "OTP limits", desc: "Expires after 10 minutes, 5 verification attempts, a 60-second resend cooldown, and hourly caps of 3 per email and 10 per IP. Single use.", lines: ["10 min · 5 tries", "3/h per email · 10/h per IP"] },
    { at: "login", title: "Login limits", desc: "Failed logins are rate limited per email and per IP inside a 15-minute window, before the password is compared.", lines: ["10 per email", "30 per IP"] },
    { at: "access", title: "Access token", desc: "Short lived. Logout can't revoke it; it expires." },
    { at: "refresh", title: "Refresh token", desc: "Only the SHA-256 hash is stored, so it can be tracked and revoked." },
    { at: "rotate", title: "Rotation", desc: "A revoked token showing up again is treated as reuse and the user's remaining tokens are revoked." },
  ],
};

export const STORAGE: Spec = {
  w: 1000, h: 520,
  zones: [
    zn("data", "QueryPilot data layer", 280, 16, 705, 490, true),
    zn("mysql", "MySQL", 300, 44, 665, 156),
    zn("vz", "Vector storage · Chroma (dev) / S3 Vectors (prod)", 300, 212, 665, 124),
  ],
  nodes: [
    nd("api", "Django API", "request path", 20, 84, 160),
    nd("wk", "Ingestion worker", "background process", 20, 236, 160),
    nd("pl", "Planner + SQL tool", "per question", 20, 388, 160),
    nd("pm", "Primary DB", "alias default · users, workspaces, documents, jobs, conversations, messages", 320, 80, 625, 52),
    nd("sm", "Structured DB", "aliases structured (write) and structured_read (read-only) · one table per extracted table", 320, 140, 625, 52),
    nd("ck", "Text chunks", "embeddings + chunk metadata", 320, 254, 305),
    nd("pf", "Document profiles", "sections, table descriptions", 640, 254, 305),
    nd("rd", "Redis", "job queue · cache · rate limits", 320, 356, 625, 52),
    nd("fs", "Object storage", "original uploads · local disk in dev, S3 in production", 320, 428, 625, 52),
  ],
  edges: [["api", "pm", "default"], ["api", "rd", "enqueue"], ["api", "fs"], ["wk", "sm", "write"], ["wk", "ck", "embed"], ["pl", "sm", "read-only"], ["pl", "ck", "search"]],
  spots: [
    { at: "wk", title: "Only writer", desc: "The ingestion worker is the only process that creates tables and inserts rows in the structured database.", lines: ["conn: structured", "DDL + INSERT"] },
    { at: "pl", title: "Read path", desc: "Generated SQL runs on a separate connection whose database account cannot write. Validation is the first lock, this is the second.", lines: ["conn: structured_read", "SELECT only"] },
    { at: "pm", title: "Primary DB", desc: "Relational source of truth: accounts, tokens, workspaces, documents, ingestion jobs, chats. Job status lives here, not in Redis.", lines: ["alias: default", "Django ORM + migrations"] },
    { at: "sm", title: "Structured DB", desc: "Validated tables from uploaded files, created at ingestion time. Rows are queried with SQL and never embedded.", lines: ["TEXT columns", "table name carries workspace + document"] },
    { at: "vz", title: "Vector backend", desc: "Chosen by configuration. It holds searchable representations, not application records.", lines: ["dev: ChromaDB", "prod: AWS S3 Vectors"] },
    { at: "ck", title: "Text chunks", desc: "Normalised 1024-d embeddings with workspace, document, page, heading and chunk type as metadata.", lines: ["mxbai-embed-large-v1"] },
    { at: "pf", title: "Document profiles", desc: "Title, section headings and previews, table titles, columns and row counts. Written through the vector layer; the planner reads them to pick sources." },
    { at: "rd", title: "Redis", desc: "Queue entries, cache, rate-limit counters. The job id is published after the DB commit, and status stays in MySQL." },
    { at: "fs", title: "Original files", desc: "Source of truth for every derived chunk, row and profile.", lines: ["dev: filesystem", "prod: S3"] },
  ],
};

export const ERD: Spec = {
  w: 1000, h: 650,
  zones: [zn("acc", "accounts", 10, 8, 450, 404), zn("docs", "workspaces and documents", 480, 8, 510, 346), zn("chat", "chat", 250, 428, 740, 218)],
  nodes: [
    nd("refresh", "RefreshToken", "user FK · hashed · revoked", 30, 46, 190),
    nd("google", "GoogleIdentity", "user 1:1 · Google account id", 30, 116, 190),
    nd("oauth", "OAuthLoginCode", "user FK · one-time", 30, 186, 190),
    nd("otp", "EmailOTP", "keyed by email, no FK", 30, 276, 190, 52, true),
    nd("pending", "PendingRegistration", "keyed by email, no FK", 30, 346, 190, 52, true),
    nd("user", "User", "identity · role · blocked", 285, 116, 155),
    nd("ws", "Workspace", "owner FK", 510, 116, 160),
    nd("doc", "Document", "workspace · hash · status", 730, 46, 240),
    nd("job", "IngestionJob", "document 1:1 · status · retries", 730, 126, 240),
    nd("dmeta", "DocumentMetadata", "1:1 with Document · not the live store", 730, 206, 240, 52, true),
    nd("wtab", "WorkspaceTable", "not the live table catalogue", 730, 276, 240, 52, true),
    nd("cdoc", "ConversationDocument", "unique (conversation, document)", 270, 518, 190),
    nd("conv", "Conversation", "workspace · creator", 510, 518, 160),
    nd("msg", "Message", "role · content · metadata", 730, 446, 240),
    nd("set", "ConversationSettings", "memory + citations flags", 730, 518, 240),
    nd("mem", "ConversationMemory", "summary + checkpoint", 730, 590, 240),
  ],
  edges: [["refresh", "user", "N:1"], ["google", "user", "1:1"], ["oauth", "user", "N:1"], ["user", "ws", "1:N"], ["ws", "doc", "1:N"], ["doc", "job", "1:1"], ["ws", "conv", "1:N"], ["cdoc", "conv", "N:1"], ["conv", "msg", "1:N"], ["conv", "set", "1:1"], ["conv", "mem", "1:1"]],
  spots: [
    { at: "user", title: "User", desc: "Central identity. Refresh tokens, the Google identity and one-time login codes all point at it." },
    { at: "refresh", title: "Many tokens per user", desc: "Rotation creates a new row per refresh. Old rows are kept as revoked so reuse can be detected." },
    { at: "otp", title: "No foreign key", desc: "The user doesn't exist yet when sign-up starts, so OTPs and pending registrations are matched by email." },
    { at: "ws", title: "Isolation boundary", desc: "Documents, tables and retrieval filters hang off a workspace. Ownership is checked inside the query." },
    { at: "doc", title: "Document", desc: "Unique on (workspace, file hash). Optional uploaded_by FK to the user.", lines: ["pending > processing", "> ready | failed"] },
    { at: "job", title: "IngestionJob", desc: "Status is separate from the document: the job can retry while the document is still processing.", lines: ["pending > processing", "> completed | failed"] },
    { at: "dmeta", title: "Present, not populated", desc: "DocumentProfileBuilder writes profiles through the vector layer, not into this model." },
    { at: "wtab", title: "Not the catalogue", desc: "Live structured tables are discovered from MySQL information_schema." },
    { at: "conv", title: "Conversation", desc: "Belongs to a workspace and records its creator. Chat endpoints look conversations up by that creator, so another user's id returns nothing." },
    { at: "cdoc", title: "Join model", desc: "Links conversations and documents, at most 3 per conversation. The model exists; there is no public attach endpoint today." },
    { at: "mem", title: "Rolling memory", desc: "Summary of older messages plus a checkpoint for the last summarised one. Messages themselves stay stored." },
  ],
};

export const INGEST: Spec = {
  w: 1000, h: 470,
  nodes: [
    nd("up", "Upload", "hash + limits", 20, 40, 170),
    nd("q", "Redis queue", "after commit", 250, 40, 170),
    nd("wk", "Worker", "locks the job row", 480, 40, 170),
    nd("ps", "Parse", "LiteParse > LlamaParse", 710, 40, 170),
    nd("ch", "Chunk + embed", "mxbai, 1024-d", 480, 230, 170),
    nd("tb", "Validate tables", "SQL or labelled text", 710, 230, 170),
    nd("pf", "Doc profile", "title, sections, tables", 250, 380, 170),
    nd("vx", "Vector index", "chunks", 480, 380, 170),
    nd("ms", "Structured DB", "physical table", 710, 380, 170),
  ],
  edges: [["up", "q"], ["q", "wk"], ["wk", "ps"], ["ps", "ch", "text"], ["ps", "tb", "tables"], ["ch", "vx"], ["ch", "pf", "profile"], ["tb", "ms", "valid"]],
  spots: [
    { at: "up", title: "Upload request", desc: "Validates and records: owner, file type and size, a SHA-256 duplicate check and the three-document limit (failed documents don't count). Document and job are saved in one transaction, then the API answers 202.", lines: [".pdf .docx .xlsx .csv", "max 50 MB"] },
    { at: "wk", title: "Worker loop", desc: "Thread pool, row lock on claim, heartbeats, stale-job recovery, three tries, cleanup on terminal failure.", lines: ["concurrency: 3", "heartbeat: 30 s", "stale after: 30 min"] },
    { at: "ps", title: "Parser chain", desc: "PDFs go to LiteParse first with LlamaParse as the fallback; every other supported format uses LlamaParse. Output is normalised to text and table nodes so later stages don't depend on which parser ran." },
    { at: "ch", title: "Structure-aware chunks", desc: "About 500 tokens, heading and page aware, two sentences of overlap. Every chunk carries its heading." },
    { at: "tb", title: "Table validation", desc: "Valid tables become physical MySQL tables. The rest become labelled text like 'Status: Processed' and are embedded as text." },
    { at: "pf", title: "Profile", desc: "Compact summary of what the document contains, stored in the vector profile index." },
  ],
};

export const SCOPE: Spec = {
  w: 1000, h: 400,
  zones: [zn("guard", "Scope Guard", 196, 36, 450, 338)],
  nodes: [
    nd("q", "Message", "plus bounded history", 14, 172, 148),
    nd("rules", "Deterministic rules", "greeting, product, out of scope", 216, 80, 210),
    nd("llm", "LLM classifier", "JSON route", 216, 264, 210),
    nd("rv", "Route validation", "ids vs allow-list", 476, 172, 150),
    nd("r1", "DOCUMENT", "planner + tools", 706, 20, 274),
    nd("r2", "CONVERSATION", "chat history", 706, 90, 274),
    nd("r3", "WORKSPACE", "catalogue questions", 706, 160, 274),
    nd("r4", "PRODUCT", "public product info", 706, 230, 274),
    nd("r5", "CHITCHAT / OUT / CLARIFY", "no retrieval", 706, 300, 274),
  ],
  edges: [["q", "rules"], ["q", "llm"], ["rules", "llm", "no match"], ["rules", "rv", "hit"], ["llm", "rv"], ["rv", "r1"], ["rv", "r2"], ["rv", "r3"], ["rv", "r4"], ["rv", "r5"]],
  spots: [
    { at: "guard", title: "Scope Guard", desc: "The routing step that runs before the planner. Rules decide the obvious cases, a classifier handles the rest, and the route is validated against the backend's allow-list before anything is retrieved." },
    { at: "rules", title: "Deterministic first", desc: "Obvious cases never reach a model: greetings, clear out-of-scope requests, questions about QueryPilot itself." },
    { at: "llm", title: "Classifier input", desc: "Current query, bounded history, the workspace document catalogue and the allowed document ids. Returns structured JSON.", lines: ["model: gpt-oss-20b", "max 500 tokens"] },
    { at: "rv", title: "The real boundary", desc: "Document ids the classifier returns are checked against the backend's own allow-list. The model's output is never the access rule." },
    { at: "r1", title: "DOCUMENT", desc: "Questions that need uploaded document or table content. These go on to the planner." },
    { at: "r5", title: "No retrieval", desc: "Small talk, out-of-scope or protected requests, and unresolved references that need a question back." },
  ],
};

export const GRAPH: Spec = {
  w: 1000, h: 320,
  zones: [zn("st", "AgentState: one object passed from node to node", 150, 20, 700, 256)],
  nodes: [
    nd("start", "START", undefined, 20, 132, 90),
    nd("agent", "agent", "plan + resolve", 190, 132, 140),
    nd("dispatch", "dispatch", "run the tools", 470, 70, 140),
    nd("finish", "finish", "write the answer", 680, 132, 150),
    nd("end", "END", undefined, 890, 132, 90),
  ],
  edges: [["start", "agent"], ["agent", "dispatch", "needs data"], ["agent", "finish", "answerable now"], ["dispatch", "finish"], ["finish", "end"]],
  spots: [
    { at: "agent", title: "agent node", desc: "Reads the query and context, builds structured understanding, validates requirements, resolves references, builds the execution plan." },
    { at: "dispatch", title: "dispatch node", desc: "Runs the chosen capabilities: document search, table selection, SQL, metadata, memory, cross-document evidence, recovery.", lines: ["12 tool calls max", "2 recovery attempts", "60 s execution deadline"] },
    { at: "finish", title: "finish node", desc: "Takes collected evidence and requirements and calls answer generation." },
    { at: "st", title: "AgentState", desc: "Query, planning query, workspace and allowed document ids, understanding, requirements, execution plan, evidence, tool history, table scope, error and recovery counters." },
  ],
};

export const SQLF: Spec = {
  w: 1000, h: 340,
  nodes: [
    nd("plan", "Planner output", "fields, entities, operation", 20, 60, 190),
    nd("sel", "Table selector", "schemas + sample values", 270, 60, 190),
    nd("gen", "SQL generation", "separate LLM call", 520, 60, 190),
    nd("val", "Validation", "reject if unsafe", 770, 60, 190),
    nd("exec", "Read-only run", "structured_read", 770, 220, 190),
    nd("res", "Structured result", "evidence, max 100 rows", 520, 220, 190),
  ],
  edges: [["plan", "sel"], ["sel", "gen", "tables"], ["gen", "val", "raw SQL"], ["val", "exec"], ["exec", "res"]],
  spots: [
    { at: "sel", title: "Table choice", desc: "Chosen from the workspace's real tables using titles, columns, row counts and sample values. It does not expand to every table when nothing matches. If the model call fails it can fall back to the smaller model on the same key.", lines: ["gpt-oss-120b", "fallback: gpt-oss-20b"] },
    { at: "gen", title: "SQL generation", desc: "Gets the selected schema, requested fields, resolved entities and operation. Returns needs_sql, the query and parameters. One bounded repair if an attempt failed.", lines: ["gpt-oss-120b", "max 2,600 tokens"] },
    { at: "val", title: "Checks first", desc: "SELECT or WITH only, one statement, no comments, no writes or admin or file operations, no locking reads, own tables only, identifiers and parameters validated." },
    { at: "exec", title: "Second lock", desc: "Runs on a connection whose database account cannot write, with a session execution timeout and a 100-row cap." },
  ],
};

export const RETR: Spec = {
  w: 1000, h: 360,
  zones: [zn("sc", "scoped to workspace + allowed documents", 190, 24, 220, 312)],
  nodes: [
    nd("q", "Query", "text only", 20, 152, 130),
    nd("dn", "Dense search", "embedding, top 20", 205, 80, 190),
    nd("bm", "BM25", "fielded, top 20", 205, 224, 190),
    nd("rrf", "RRF", "k = 60", 470, 152, 130),
    nd("rr", "Dedupe + rerank", "reranker optional", 660, 152, 160),
    nd("ev", "Evidence", "top 5", 880, 152, 100),
  ],
  edges: [["q", "dn"], ["q", "bm"], ["dn", "rrf"], ["bm", "rrf"], ["rrf", "rr"], ["rr", "ev"]],
  spots: [
    { at: "dn", title: "Dense", desc: "Same embedding model as ingestion. Matches meaning when the wording differs.", lines: ["mxbai-embed-large-v1"] },
    { at: "bm", title: "BM25", desc: "Matches the actual words: codes, names, numbers. Scores content, heading and title with different weights.", lines: ["content 1.0", "heading 0.8", "title 0.3"] },
    { at: "rrf", title: "Rank fusion", desc: "Scores from the two searchers aren't comparable, so only rank positions are used. A chunk both like rises." },
    { at: "rr", title: "Optional reranker", desc: "A cross-encoder reads the query with each candidate (up to 60) plus title and heading. Off unless enabled. If it fails, the RRF order is kept.", lines: ["mmarco-mMiniLMv2-L12-H384-v1"] },
    { at: "sc", title: "Scope", desc: "Search is filtered by workspace and allowed documents, and returned candidates are checked again. It asks for text evidence only, not table rows." },
  ],
};

export const CROSS: Spec = {
  w: 1000, h: 340,
  nodes: [
    nd("pl", "Planner", "needs rule + records", 20, 142, 130),
    nd("ds", "Document search", "policy source", 210, 52, 170),
    nd("ts", "Table selection", "orders source", 210, 232, 170),
    nd("pe", "Rule evidence", "policy passages", 440, 52, 170),
    nd("sq", "SQL run", "record evidence", 440, 232, 170),
    nd("ea", "Evidence assembly", "keep sources apart", 690, 142, 150),
    nd("an", "Answer", undefined, 890, 142, 90),
  ],
  edges: [["pl", "ds"], ["pl", "ts"], ["ds", "pe"], ["ts", "sq"], ["pe", "ea"], ["sq", "ea"], ["ea", "an"]],
  spots: [
    { at: "pe", title: "Rules come from text", desc: "A refund percentage or eligibility condition is read from the policy, never produced by SQL." },
    { at: "sq", title: "Values come from rows", desc: "Order amounts and dates come from the structured tables, never guessed from a paragraph." },
    { at: "ea", title: "Assembly", desc: "Normalises both kinds of evidence, keeps source and table identity, ties evidence to requirements and notes what is missing." },
  ],
};

export const CHAT: Spec = {
  w: 1000, h: 300,
  zones: [zn("sse", "one SSE response", 556, 80, 430, 124)],
  nodes: [
    nd("m", "Message", "saved first", 10, 122, 112),
    nd("mem", "Memory", "summary + last 10", 150, 122, 112),
    nd("sg", "Scope Guard", "route", 290, 122, 112),
    nd("pl", "Planner + tools", "evidence", 430, 122, 112),
    nd("an", "Answer model", "from evidence", 570, 122, 112),
    nd("sse", "Token stream", "text/event-stream", 710, 122, 112),
    nd("sv", "Persist", "assistant message", 850, 122, 112),
  ],
  edges: [["m", "mem"], ["mem", "sg"], ["sg", "pl"], ["pl", "an"], ["an", "sse"], ["sse", "sv"]],
  spots: [
    { at: "mem", title: "Context, not proof", desc: "Helps resolve a follow-up. Facts still come from documents or tables." },
    { at: "an", title: "Answer model", desc: "Gets the question, requirements, evidence, source info and relevant history. Should say so when evidence is incomplete." },
    { at: "sse", title: "Server-Sent Events", desc: "A normal HTTP response held open (StreamingHttpResponse). One-way. Not WebSockets, not Channels." },
  ],
};

export const DEPLOY: Spec = {
  w: 1000, h: 480,
  zones: [zn("ec2", "EC2 · Ubuntu · Docker", 340, 20, 360, 440)],
  nodes: [
    nd("us", "User", "browser", 10, 212, 110),
    nd("vc", "Frontend", "Vercel", 170, 212, 110),
    nd("ng", "Nginx", "HTTPS, SSE", 365, 212, 120),
    nd("ap", "Django API", "ASGI, Uvicorn", 540, 100, 140),
    nd("wk", "Ingestion worker", "same image", 540, 324, 140),
    nd("db", "RDS MySQL", "relational data", 780, 30, 190),
    nd("rd", "Redis", "queue + cache", 780, 130, 190),
    nd("s3", "S3", "original documents", 780, 250, 190),
    nd("sv", "S3 Vectors", "production vectors", 780, 350, 190),
  ],
  edges: [["us", "vc"], ["vc", "ng", "HTTPS"], ["ng", "ap"], ["ap", "db"], ["ap", "rd"], ["ap", "s3"], ["wk", "rd"], ["wk", "sv"]],
  spots: [
    { at: "vc", title: "Two origins", desc: "Frontend on Vercel, API on AWS. That is why CORS and CSRF trusted origins need setting. CORS is not authorization." },
    { at: "ng", title: "Reverse proxy", desc: "Terminates HTTPS and tells Django the original protocol. Buffering and timeouts matter for the SSE chat; the chat response also sends a no-buffering hint for Nginx." },
    { at: "ap", title: "API container", desc: "Serves requests only. Non-root user, ASGI, embedding model baked into the image." },
    { at: "wk", title: "Worker container", desc: "Same code and image, different command. Slow work stays off the request path." },
    { at: "rd", title: "Redis", desc: "Job queue, cache and rate limits. Not the record of job status." },
    { at: "sv", title: "S3 Vectors", desc: "Production vector backend, selected by configuration. ChromaDB locally." },
  ],
};

export const SHIP: Spec = {
  w: 1000, h: 240,
  nodes: [
    nd("g", "Git source", "latest code", 10, 92, 170),
    nd("b", "Docker build", "layer cache reused", 205, 92, 170),
    nd("r", "ECR registry", "private image", 400, 92, 170),
    nd("p", "EC2 pulls", "no rebuild on server", 595, 92, 170),
    nd("u", "Updated service", "check logs", 790, 92, 170),
  ],
  edges: [["g", "b"], ["b", "r", "push"], ["r", "p"], ["p", "u"]],
  spots: [
    { at: "b", title: "Build cache", desc: "The previous image is used as cache, so a code-only change doesn't reinstall every dependency." },
    { at: "r", title: "Image per revision", desc: "Images are tied to a source revision, so you can tell what is running." },
    { at: "u", title: "Incremental update", desc: "Only the service that changed is replaced. Zero downtime isn't claimed; it hasn't been measured." },
  ],
};

/** Which model and which key lane runs each logical task. Mirrors the backend's task profiles. */
export const LLMF: Spec = {
  w: 1000, h: 500,
  zones: [zn("l1", "key lane 1 · planning and control", 330, 14, 300, 214), zn("l2", "key lane 2 · structured data", 330, 240, 300, 128), zn("l3", "key lane 3 · answers", 330, 380, 300, 108)],
  nodes: [
    nd("scope", "Scope Guard", "gpt-oss-20b · 500 tokens", 20, 30, 230, 52),
    nd("chit", "Chitchat", "gpt-oss-20b · 500 tokens", 20, 92, 230, 52),
    nd("title", "Title", "gpt-oss-20b · 200 tokens", 20, 154, 230, 52),
    nd("plan", "Planner", "gpt-oss-120b · 3,400 tokens", 20, 216, 230, 52),
    nd("tsel", "Table selection", "gpt-oss-120b · 2,200 tokens", 20, 278, 230, 52),
    nd("sqlg", "SQL generation", "gpt-oss-120b · 2,600 tokens", 20, 340, 230, 52),
    nd("ans", "Answer generation", "gpt-oss-120b · up to 4,000", 20, 424, 230, 52),
    nd("k1", "Key 1", "planner, scope, chitchat, title", 360, 100, 240),
    nd("k2", "Key 2", "table selection, SQL", 360, 290, 240),
    nd("k3", "Key 3", "answer generation", 360, 410, 240),
    nd("groq", "Groq API", "rate limits enforced here", 740, 218, 230),
  ],
  edges: [["scope", "k1"], ["chit", "k1"], ["title", "k1"], ["plan", "k1"], ["tsel", "k2"], ["sqlg", "k2"], ["ans", "k3"], ["k1", "groq"], ["k2", "groq"], ["k3", "groq"]],
  spots: [
    { at: "k1", title: "Lane 1: planning and control", desc: "Scope Guard, chitchat and titles use the 20B model; the planner uses the 120B model. A planner call is allowed 40 seconds, the others 20.", lines: ["planner: 3,400 token ceiling"] },
    { at: "k2", title: "Lane 2: structured data", desc: "Table selection and SQL generation share a key. Table selection may fall back to the 20B model, and the fallback stays on this same key." },
    { at: "k3", title: "Lane 3: answers", desc: "Answer generation has its own key so a long answer never competes with planning. Output caps are 2,000 (normal), 2,600 (arithmetic) and 3,200 tokens (multi-step), with 4,000 as the ceiling." },
    { at: "groq", title: "Provider", desc: "Groq enforces rate limits. The backend has no token scheduler, no key rotation and no cross-lane borrowing; a 429 or an authentication failure surfaces immediately." },
  ],
};

/* ------------------------------ docs blocks ------------------------------ */

export const to = (id: string) => `/engineering?c=${id}`;

/**
 * `term` renders the tab as a terminal panel (shell colouring, no line numbers). `note` is a short
 * sentence shown above the terminal. Everything else is code with line numbers, or `plain` text with no colouring.
 */
export interface CodeTab { label: string; code: string; file?: string; plain?: boolean; term?: boolean; note?: string; lang?: string }

export interface StepDef { title: string; text: string[]; code?: CodeTab[] }
export interface CardDef { title: string; text: string; to?: string; tag?: string }
export interface FactDef { k: string; v: string; sub?: string }
/** One side of a Compare block: numbered lines, then how it ends. */
export interface CmpSide { tag: string; title: string; lines: string[]; verdict: string; good?: boolean }

export type Block =
  | { t: "p"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "dia"; spec: Spec; title: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "code"; tabs: CodeTab[] }
  | { t: "split"; text: string[]; list?: string[]; tabs: CodeTab[] }
  | { t: "note"; kind: "note" | "warn"; title: string; text: string }
  | { t: "steps"; items: StepDef[] }
  | { t: "viz"; id: VizId }
  | { t: "cards"; items: CardDef[] }
  | { t: "facts"; items: FactDef[] }
  | { t: "cmp"; q: string; sides: [CmpSide, CmpSide] }
  | { t: "api"; rows: string[][] };
export interface Section { h: string; blocks: Block[] }

export const P = (text: string): Block => ({ t: "p", text });
export const H3 = (text: string): Block => ({ t: "h3", text });
export const UL = (items: string[]): Block => ({ t: "ul", items });
export const OL = (items: string[]): Block => ({ t: "ol", items });
export const DIA = (spec: Spec, title: string): Block => ({ t: "dia", spec, title });
export const TBL = (head: string[], rows: string[][]): Block => ({ t: "table", head, rows });
export const CODE = (...tabs: CodeTab[]): Block => ({ t: "code", tabs });
export const SPLIT = (text: string[], tabs: CodeTab[], list?: string[]): Block => ({ t: "split", text, tabs, list });
export const NOTE = (kind: "note" | "warn", title: string, text: string): Block => ({ t: "note", kind, title, text });
export const STEPS = (items: StepDef[]): Block => ({ t: "steps", items });
/** An animated card: "build", "flow", "isolation", "locks" or "pool". */
export const VIZ = (id: VizId): Block => ({ t: "viz", id });
/** A grid of link cards. `to` is a chapter id. */
export const CARDS = (items: CardDef[]): Block => ({ t: "cards", items });
/** A strip of key/value fact tiles. */
export const FACTS = (items: FactDef[]): Block => ({ t: "facts", items });
/** An endpoint table. Each row is [method, path, auth ("JWT" or "Public"), what it does]. */
export const API = (rows: string[][]): Block => ({ t: "api", rows });
/** Two columns for one question: what a typical RAG pipeline does with it, and what QueryPilot does. */
export const CMP = (q: string, sides: [CmpSide, CmpSide]): Block => ({ t: "cmp", q, sides });

/* ---------------------------- animated cards (viz) ----------------------------
 *
 * Cards, each showing one mechanism that the page around it describes:
 *   build      the system coming up, service by service (architecture, upload path, question path)
 *   flow       one chat message through all thirteen stages, with checks that tick
 *   isolation  ownership checked inside the query: your id, someone else's id, an id that doesn't exist
 *   locks      generated SQL meeting two independent locks
 *   pool       ingestion jobs claimed under a row lock, a worker dying, a job recovered
 *
 * Shared rules: a card only ticks while it is on screen, it pauses when the pointer is over it, and with
 * reduced motion it shows its final state. Colours: white, the accent, and OK / BAD for state only.
 */

type Hov = { onPointerEnter: (e: ReactPointerEvent) => void; onPointerLeave: () => void };

/** Everything an animated card needs to decide whether to tick. */
function useLive() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const f = () => setReduced(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hoverProps: Hov = { onPointerEnter: () => {}, onPointerLeave: () => {} };
  return { ref, run: inView && !reduced, reduced, hoverProps };
}

function VizFrame({ title, right, foot, children, frameRef, hov }: {
  title: string; right?: ReactNode; foot?: ReactNode; children: ReactNode; frameRef: RefObject<HTMLDivElement | null>; hov: Hov;
}) {
  return (
    <figure className="qpe-cw mt-7">
      <div ref={frameRef} {...hov} className="qpe-panel overflow-hidden rounded-[10px] border border-white/[0.14]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5">
          <span className="qpe-mono min-w-0 flex-1 truncate text-[13.5px] text-white/60">{title}</span>
          {right}
        </div>
        {children}
        {foot && <div className="flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-2.5 text-[14px]">{foot}</div>}
      </div>
    </figure>
  );
}


const Glyph = ({ kind, s = 15 }: { kind: "ok" | "bad" | "run" | "wait"; s?: number }) => {
  if (kind === "run") {
    return (
      <svg viewBox="0 0 16 16" width={s} height={s} aria-hidden="true" className="qpe-spin shrink-0">
        <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.6" />
        <path d="M8 2a6 6 0 016 6" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "wait") return <svg viewBox="0 0 16 16" width={s} height={s} aria-hidden="true" className="shrink-0"><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.4" /></svg>;
  const c = kind === "ok" ? OK : BAD;
  return (
    <svg viewBox="0 0 16 16" width={s} height={s} aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6.5" fill={hexA(c, 0.12)} stroke={c} strokeWidth="1.3" />
      <path d={kind === "ok" ? "M4.9 8.3l2.2 2.2 4-4.4" : "M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ------------------------------- build canvas ------------------------------- */

interface BNode extends N { icon: IconName; st: string }
interface BScene { id: string; tab: string; caption: string; h: number; nodes: BNode[]; edges: [string, string, string?][] }

const BW = 176;
const BH = 58;
const BVW = 912;
const bn = (id: string, label: string, sub: string, icon: IconName, st: string, x: number, y: number): BNode => ({ id, label, sub, icon, st, x, y, w: BW, h: BH });
const C1 = 8, C2 = 248, C3 = 488, C4 = 728;
const R1 = 20, R2 = 118, R3 = 216;

const BUILD: BScene[] = [
  {
    id: "arch", tab: "Architecture", h: 354,
    caption: "One Django backend and one frontend, arranged around five stores and two kinds of work: slow work at upload, fast work at question time.",
    nodes: [
      bn("web", "Web app", "Next.js on Vercel", "cloud", "own origin", C1, 148),
      bn("api", "Django API", "JWT + ownership", "server", "serving", C2, 148),
      bn("pipe", "Question pipeline", "Guard, planner, graph", "spark", "ready", C3, 8),
      bn("redis", "Redis", "job ids, cache, limits", "layers", "online", C3, 78),
      bn("wk", "Ingestion worker", "parse, chunk, embed", "terminal", "listening", C3, 148),
      bn("mysql", "Primary MySQL", "accounts, chats, jobs", "table", "online", C3, 218),
      bn("files", "Object storage", "original uploads", "upload", "online", C3, 288),
      bn("vec", "Vector storage", "chunks, profiles", "search", "online", C4, 43),
      bn("sql", "Structured MySQL", "one table per table", "table", "online", C4, 148),
    ],
    edges: [["web", "api"], ["api", "pipe"], ["api", "redis"], ["api", "mysql"], ["api", "files"], ["redis", "wk"], ["pipe", "vec"], ["pipe", "sql"], ["wk", "vec"], ["wk", "sql"]],
  },
  {
    id: "upload", tab: "Upload path", h: 290,
    caption: "Upload returns after validation. A separate worker does the parsing and embedding, and Redis carries only the job id.",
    nodes: [
      bn("up", "Upload request", "hash, limits, owner", "upload", "validated", C1, R1),
      bn("db", "Primary MySQL", "Document + IngestionJob", "table", "committed", C2, R1),
      bn("q", "Redis queue", "job id only", "layers", "queued", C3, R1),
      bn("wk", "Ingestion worker", "row lock, heartbeat", "terminal", "claimed", C4, R1),
      bn("ps", "Parser", "LiteParse, LlamaParse", "code", "parsed", C4, R2),
      bn("ch", "Chunk + embed", "~500 tokens, 1024-d", "layers", "embedded", C3, R2),
      bn("vx", "Vector storage", "chunks + profile", "search", "indexed", C2, R2),
      bn("tb", "Table check", "valid: SQL, else text", "check", "validated", C3, R3),
      bn("ms", "Structured MySQL", "physical table", "table", "created", C2, R3),
    ],
    edges: [["up", "db"], ["db", "q", "after commit"], ["q", "wk", "job id"], ["wk", "ps"], ["ps", "ch", "text"], ["ch", "vx"], ["ps", "tb", "tables"], ["tb", "ms"]],
  },
  {
    id: "ask", tab: "Question path", h: 290,
    caption: "A message is authorised, routed, planned and answered from collected evidence. Nothing is answered from the question alone.",
    nodes: [
      bn("msg", "Chat message", "JWT + ids", "flag", "authorised", C1, R1),
      bn("sg", "Scope Guard", "rules, then classifier", "info", "DOCUMENT", C2, R1),
      bn("pl", "Planner", "requirements, sources", "spark", "2 requirements", C3, R1),
      bn("dp", "Dispatch", "12 tool calls max", "play", "running", C4, R1),
      bn("ret", "Hybrid retrieval", "dense + BM25, RRF", "search", "top 5", C3, R2),
      bn("sql", "SQL tool", "validated, read-only", "table", "1 row", C3, R3),
      bn("ev", "Evidence", "sources kept apart", "layers", "assembled", C2, R2),
      bn("an", "Answer model", "from evidence only", "spark", "writing", C1, R2),
      bn("sse", "Token stream", "text/event-stream", "arrow", "streaming", C1, R3),
    ],
    edges: [["msg", "sg"], ["sg", "pl"], ["pl", "dp"], ["dp", "ret"], ["dp", "sql"], ["ret", "ev"], ["sql", "ev"], ["ev", "an"], ["an", "sse"]],
  },
];

const BUILD_MS = 240;

/** A compact service card: icon and name on the first line, what it holds on the second, state as a dot. */
function BCard({ n, up, fresh }: { n: BNode; up: boolean; fresh: boolean }) {
  const fs = Math.max(9.5, Math.min(11, (n.w - 24) / ((n.sub?.length ?? 1) * 0.6)));
  return (
    <g className="qpe-rise">
      <title>{`${n.label}: ${up ? n.st : "starting"}`}</title>
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" fill="#111113" stroke={fresh ? ACCENT : "rgba(255,255,255,.14)"} style={{ transition: "stroke .5s" }} />
      <svg x={n.x + 12} y={n.y + 11} width="14" height="14" viewBox="0 0 24 24"><path d={ICONS[n.icon]} fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <text x={n.x + 34} y={n.y + 22} fontSize="12.5" fontWeight={500} fill="#fff">{n.label}</text>
      <text x={n.x + 12} y={n.y + 43} fontSize={fs} className="qpe-mono" fill="rgba(255,255,255,.5)">{n.sub}</text>
      <g transform={`translate(${n.x + n.w - 18} ${n.y + 17})`}>
        {up ? (
          <circle r="3.5" fill={OK} />
        ) : (
          <g className="qpe-spin"><circle r="4.5" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.3" /><path d="M0 -4.5A4.5 4.5 0 014.5 0" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" /></g>
        )}
      </g>
    </g>
  );
}

export function BuildCanvas() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { ref, run, reduced, hoverProps } = useLive();
  const [sc, setSc] = useState(0);
  const [t, setT] = useState(0);
  const scene = BUILD[sc];
  const total = scene.nodes.length + 1;
  const tt = reduced ? total : t;

  useEffect(() => {
    if (!run || t >= total) return;
    const id = window.setTimeout(() => setT(t + 1), BUILD_MS);
    return () => window.clearTimeout(id);
  }, [run, t, total]);

  const idx = useMemo(() => Object.fromEntries(scene.nodes.map((n, i) => [n.id, i])) as Record<string, number>, [scene]);
  const byId = useMemo(() => Object.fromEntries(scene.nodes.map((n) => [n.id, n])) as Record<string, BNode>, [scene]);

  const upCount = Math.min(scene.nodes.length, Math.max(0, tt));

  const tabs = (
    <div role="tablist" aria-label="Scene" className="flex flex-wrap gap-1">
      {BUILD.map((b, i) => (
        <button
          key={b.id}
          type="button"
          role="tab"
          aria-selected={i === sc}
          onClick={() => { setSc(i); setT(0); }}
          className={`rounded-md px-2.5 py-1 text-[13.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 ${i === sc ? "bg-white/[0.09] text-white" : "text-white/55 hover:text-white"}`}
        >
          {b.tab}
        </button>
      ))}
    </div>
  );

  return (
    <VizFrame
      title="querypilot / how it comes up"
      right={tabs}
      frameRef={ref}
      hov={hoverProps}
      foot={
        <>
          <span className="min-w-0 flex-1 text-white/70 [overflow-wrap:anywhere]" aria-live="off">{scene.caption}</span>
          <span className="qpe-mono shrink-0 text-[13px] text-white/40">{upCount}/{scene.nodes.length} up</span>
          <button type="button" className={ctl} onClick={() => setT(0)}><Icon n="replay" className="h-3.5 w-3.5" />Replay</button>
          
        </>
      }
    >
      <div className="qpe-scroll overflow-x-auto">
        <div className="relative min-w-[700px]" style={{ aspectRatio: `${BVW} / ${scene.h}` }}>
          <svg key={scene.id} viewBox={`0 0 ${BVW} ${scene.h}`} className="absolute inset-0 block h-full w-full" role="img" aria-label={`${scene.tab}: ${scene.nodes.map((n) => n.label).join(", ")}`}>
            <defs>
              <marker id={`bm${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>
            </defs>

            {scene.edges.map(([a, b, label]) => {
              if (tt < Math.max(idx[a], idx[b]) + 1) return null;
              const r = route(byId[a], byId[b], label);
              return (
                <g key={`${a}-${b}`}>
                  <path d={r.d} pathLength={1} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" className="qpe-draw" markerEnd={`url(#bm${uid})`} />
                  <circle cx={r.a[0]} cy={r.a[1]} r="3" fill="#0b0b0c" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" />
                  {label && <text x={r.lx} y={r.ly} textAnchor={r.anchor} fontSize="10" className="qpe-mono qpe-pop" fill="rgba(255,255,255,.55)" stroke="#0b0b0c" strokeWidth="4" paintOrder="stroke">{label}</text>}

                </g>
              );
            })}

            {scene.nodes.map((n, i) => (tt >= i ? <BCard key={n.id} n={n} up={tt >= i + 1} fresh={tt === i + 1} /> : null))}
          </svg>
        </div>
      </div>
    </VizFrame>
  );
}

/* ------------------------------- request flow ------------------------------- */

interface FlowStage {
  sec: number; title: string; route: string; text: string; checks: string[];
  code: { label: string; code: string; file?: string; plain?: boolean };
  tamper?: { label: string; at: number; result: string };
}

const FLOW_SECTIONS = ["Secure request", "Query processing", "Retrieval", "Generation"];

const FLOW: FlowStage[] = [
  {
    sec: 0, title: "The user sends a message", route: "Frontend → Backend",
    text: "The user types a question and presses Send. The browser opens the chat streaming endpoint on the Django backend and keeps the response open.",
    checks: ["The message text (must not be blank)", "The conversation id; the workspace comes from the conversation", "The access JWT, in the Authorization header", "The request reaches the chat streaming endpoint"],
    code: { label: "Request", file: "POST /api/chat/messages/stream/", code: `POST  /api/chat/messages/stream/
Authorization: Bearer <access token>
Accept: text/event-stream

{
  "conversation_id": 7,
  "message": "How many orders were delivered?"
}` },
  },
  {
    sec: 0, title: "JWT authentication", route: "Backend → Authentication",
    text: "Before anything is processed, the backend works out who is calling. Access tokens are short lived and never stored.",
    checks: ["Extract the JWT from the Authorization header", "Verify the signature", "Check expiry (access tokens last 15 minutes)", "Identify the user the token belongs to"],
    code: { label: "Access token claims", file: "as issued by the backend", code: `{
  "user_id": 12,
  "email": "<the user's email>",
  "type": "access",
  "iat": <issued at>,
  "exp": <issued at + 15 min>
}
# HS256. Invalid or expired: the request stops here.` },
    tamper: { label: "Send an expired token", at: 2, result: "401 · the request stops here, nothing downstream runs" },
  },
  {
    sec: 0, title: "Ownership and limits", route: "Authentication → Chat view",
    text: "Authentication only says who the user is. This step says what they may touch, so a guessed id can't reach someone else's conversation, and applies the per-user question limit before any model is called.",
    checks: ["The conversation exists", "It was created by this user", "The user is under the question limit (50, then a 2-hour cooldown)", "The request is accepted and execution starts"],
    code: { label: "Ownership is inside the query", file: "simplified sketch", code: `def get_owned_conversation(user, conversation_id):
    # a guessed id raises DoesNotExist, never leaks a row
    return Conversation.objects.get(
        id=conversation_id, created_by=user)

# then: Redis counter per user
#   questions 1-50   allowed
#   question 51      rejected, 2-hour cooldown` },
    tamper: { label: "Guess another user's conversation id", at: 1, result: "404 · Conversation not found, no data left the database" },
  },
  {
    sec: 0, title: "Conversation and message", route: "Backend → Chat service",
    text: "With access settled, the chat service saves the new message so the exchange survives a dropped connection, then loads the context the pipeline starts with.",
    checks: ["Validate and save the user's message", "Load the conversation settings (memory on or off)", "Load context: rolling summary and the latest ten messages", "Start the question pipeline"],
    code: { label: "Context", plain: true, file: "what the pipeline starts with", code: `saved     message (role: user)
events    query_received, conversation_loaded
context   rolling summary + latest 10 messages
next      Scope Guard` },
  },
  {
    sec: 1, title: "Scope Guard routes the message", route: "Chat service → Router",
    text: "Not every message is a question about the documents. Classifying first keeps greetings and unrelated requests out of retrieval.",
    checks: ["Rules settle the obvious cases: greetings, out of scope, product questions", "Anything else goes to an LLM classifier that returns JSON", "Returned document ids are checked against the backend's own allow-list", "Only the DOCUMENT route continues to the planner"],
    code: { label: "Classifier output", file: "illustrative", code: `{
  "route": "DOCUMENT",
  "target": "document",
  "deliverable": "number",
  "relevant_document_ids": [12],
  "reason": "asks for a count over an uploaded sheet"
}` },
  },
  {
    sec: 1, title: "Planner: what has to be established", route: "Router → Planner LLM",
    text: "The planner describes the evidence needed. It doesn't write SQL and it doesn't write the answer.",
    checks: ["What is being asked, and what operation it is", "Which separate requirements it contains (up to 12)", "Which depend on which (validated, no cycles)", "Which need document text and which need table rows"],
    code: { label: "Requirements", file: "illustrative", code: `Q: refund policy for damaged products, and how long does it take?

R1  text / rule   refund policy for damaged products
R2  text / fact   refund processing timeline
    depends_on: []` },
  },
  {
    sec: 2, title: "Hybrid retrieval", route: "Planner → Retrieval engine",
    text: "Dense search matches meaning, BM25 matches the exact words. They fail in different places, so both run and their ranks are merged.",
    checks: ["Dense: embed the query (1024-d), nearest chunks from the vector store", "BM25: exact terms, names and ids (content 1.0, heading 0.8, title 0.3)", "Both are scoped to the workspace and allowed documents", "Merged by Reciprocal Rank Fusion, k = 60"],
    code: { label: "Settings", plain: true, file: "as implemented", code: `dense candidates    20
bm25 candidates     20
rrf constant        60
final top-k         5` },
  },
  {
    sec: 2, title: "Reranking and coverage", route: "Retrieval engine → Reranker",
    text: "Candidates are tidied, optionally re-scored, and checked against what the planner said was needed.",
    checks: ["Remove duplicate chunks", "Optional cross-encoder reads the query with title, heading and chunk (off unless configured)", "The top five go forward as evidence", "A requirement with no evidence is noted, not silently dropped"],
    code: { label: "Evidence", plain: true, file: "shape", code: `R1  3 chunks   refund eligibility (p.3)
R2  1 chunk    processing time (p.4)
missing: none` },
  },
  {
    sec: 2, title: "Structured data path", route: "Planner → Tables",
    text: "Only when a requirement needs table rows. Counts and sums are computed by SQL, not estimated from retrieved rows.",
    checks: ["Table selection picks the smallest set of tables", "SQL generation, a separate call, returns the query and its parameters", "The validator accepts SELECT or WITH, one statement, own tables only", "It runs on the read-only connection with a 100-row cap"],
    code: { label: "Read-only SQL", file: "illustrative, not a fixed output", code: `SELECT COUNT(*) AS delivered_orders
FROM selected_orders
WHERE Status = %s;

-- params, bound separately: ["Delivered"]` },
  },
  {
    sec: 2, title: "Context construction", route: "Retrieval → Context builder",
    text: "Before the answer model is called, everything it may use is assembled in one place, with its source attached.",
    checks: ["The original question", "Conversation history (context, never evidence)", "Planner requirements and reranked chunks", "Structured results and source references"],
    code: { label: "Context package", plain: true, file: "shape", code: `question       effective query
history        summary + latest 10
requirements   R1 .. Rn
evidence       top-5 chunks, table rows
sources        ids for citations` },
  },
  {
    sec: 3, title: "Provider routing", route: "Context builder → Provider layer",
    text: "Each logical task has its own model, output ceiling and API-key lane. A normal document question doesn't touch SQL generation at all.",
    checks: ["Pick the model and token ceiling for this task", "Pick the API key lane assigned to this task", "Build the request and handle the response", "Retry once on a timeout, connection error or 5xx; surface a 429 immediately"],
    code: { label: "Models by task", plain: true, file: "as configured", code: `scope guard         gpt-oss-20b    key 1
chitchat            gpt-oss-20b    key 1
title               gpt-oss-20b    key 1
planner             gpt-oss-120b   key 1
table selection     gpt-oss-120b   key 2
sql generation      gpt-oss-120b   key 2
answer generation   gpt-oss-120b   key 3` },
  },
  {
    sec: 3, title: "The model writes the answer", route: "Provider → Backend",
    text: "The answer model receives the assembled context. It is instructed to stay inside the evidence.",
    checks: ["Receives the question, evidence, history and structured results", "Answers only from that evidence", "Says so when evidence is incomplete", "The backend collects the answer and its source references"],
    code: { label: "Answer step", plain: true, file: "shape", code: `input    question, requirements, evidence, history
rule     answer from evidence; say what is missing
output   text, streamed as it is produced` },
  },
  {
    sec: 3, title: "Streaming to the browser", route: "Backend → Frontend",
    text: "One open HTTP response carries progress and tokens to the page, so the answer appears while it is being written.",
    checks: ["Server-Sent Events: a normal HTTP response held open", "Progress events while the earlier stages run", "answer_delta events fill the assistant's message", "complete persists and closes the exchange; error replaces it on failure"],
    code: { label: "Stream", file: "event names as emitted", code: `event: query_received
event: conversation_loaded
event: agent_started
event: planning
event: generating_answer
event: answer_delta
data: {"message": "..."}

event: complete
data: {"message": "Request completed.",
       "data": {"answer": "...", "conversation_title": "..."}}` },
  },
];

const FLOW_MS = 140;

export function RequestFlow() {
  const { ref, run, reduced, hoverProps } = useLive();
  const [s, setS] = useState(0);
  const [k, setK] = useState(0);
  const [tamper, setTamper] = useState(false);
  const st = FLOW[s];
  const failAt = tamper && st.tamper ? st.tamper.at : -1;
  const limit = failAt >= 0 ? failAt + 1 : st.checks.length;
  const shown = reduced ? limit : Math.min(k, limit);
  const finished = shown >= limit;

  useEffect(() => { setK(0); }, [s, tamper]);

  useEffect(() => {
    if (!run || k >= limit) return;
    const id = window.setTimeout(() => setK((x) => x + 1), FLOW_MS);
    return () => window.clearTimeout(id);
  }, [run, k, limit]);

  const go = (n: number) => { setTamper(false); setS((n + FLOW.length) % FLOW.length); };
  const state = (i: number): "ok" | "bad" | "run" | "wait" => {
    if (i < shown) return i === failAt ? "bad" : "ok";
    if (i === shown && shown < limit) return "run";
    return "wait";
  };

  return (
    <VizFrame
      title="request / one chat message, thirteen stages"
      frameRef={ref}
      hov={hoverProps}
      right={
        <span className="flex items-center gap-2">
          <button type="button" className={ctl} onClick={() => go(s - 1)} aria-label="Previous stage"><Icon n="arrow" className="h-3.5 w-3.5 rotate-180" /></button>
          
          <button type="button" className={ctl} onClick={() => go(s + 1)} aria-label="Next stage"><Icon n="arrow" className="h-3.5 w-3.5" /></button>
        </span>
      }
    >
      <div className="qpe-scroll flex gap-7 overflow-x-auto border-b border-white/10 px-4 py-4">
        {FLOW_SECTIONS.map((name, si) => {
          const here = st.sec === si;
          return (
            <div key={name} className="shrink-0">
              <p className={`qpe-mono mb-2 text-[12.5px] uppercase tracking-[0.08em] transition-colors ${here ? "text-white" : "text-white/40"}`}>0{si + 1} · {name}</p>
              <div className="flex items-center">
                {FLOW.map((x, i) => (x.sec !== si ? null : (
                  <Fragment key={i}>
                    {FLOW[i - 1]?.sec === si && <span aria-hidden="true" className="h-px w-3" style={{ background: i <= s ? ACCENT : "rgba(255,255,255,.18)" }} />}
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-label={`Stage ${i + 1}: ${x.title}`}
                      aria-current={i === s ? "step" : undefined}
                      className="qpe-mono grid h-[26px] w-[26px] place-items-center rounded-full border text-[12.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                      style={i === s ? { background: ACCENT, borderColor: ACCENT, color: "#0a0a0a", fontWeight: 600 } : i < s ? { borderColor: hexA(ACCENT, 0.6), color: "#fff" } : { borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.5)" }}
                    >
                      {i + 1}
                    </button>
                  </Fragment>
                )))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="qpe-two">
        <div className="min-w-0 p-5">
          <p className="qpe-mono text-[13px] text-white/45">Stage {s + 1} of {FLOW.length} · {st.route}</p>
          <h3 key={s} className="qpe-pop mt-2 text-[21px] font-medium leading-snug tracking-[-0.01em] text-white">{st.title}</h3>
          <p className="mt-2.5 text-[15.5px] leading-[1.65] text-white/70">{rich(st.text)}</p>
          <ul className="mt-5 space-y-2.5">
            {st.checks.map((c, i) => {
              const g = state(i);
              const skipped = failAt >= 0 && i > failAt;
              return (
                <li key={`${s}-${i}`} className={`flex items-start gap-3 text-[15px] leading-[1.55] transition-colors duration-300 ${skipped ? "text-white/25 line-through" : g === "ok" ? "text-white/90" : g === "bad" ? "text-white" : g === "run" ? "text-white/80" : "text-white/40"}`}>
                  <span className="mt-[3px]"><Glyph kind={skipped ? "wait" : g} /></span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{c}</span>
                </li>
              );
            })}
          </ul>
          {st.tamper && (
            <div className="mt-5">
              <button type="button" onClick={() => setTamper((v) => !v)} aria-pressed={tamper} className={ctl}>
                {tamper ? "Back to a normal request" : `Try it: ${st.tamper.label.charAt(0).toLowerCase()}${st.tamper.label.slice(1)}`}
              </button>
              {tamper && finished && <p className="qpe-pop qpe-mono mt-3 text-[13.5px] leading-[1.55]" style={{ color: BAD }}>{st.tamper.result}</p>}
            </div>
          )}
        </div>
        <div className="qpe-two-b min-w-0 p-4">
          <CodePanel key={s} tabs={[st.code]} />
        </div>
      </div>
    </VizFrame>
  );
}

/* --------------------------------- isolation --------------------------------- */

interface IsoCase { label: string; id: number; home: "A" | "B" | null; result: string; ok: boolean }
const ISO_CASES: IsoCase[] = [
  { label: "Your conversation", id: 7, home: "A", result: "1 row · the conversation loads", ok: true },
  { label: "Another user's conversation id", id: 41, home: "B", result: "DoesNotExist · 404, nothing returned, nothing leaked", ok: false },
  { label: "An id that doesn't exist", id: 99, home: null, result: "DoesNotExist · 404, nothing returned", ok: false },
];
const ISO_A: [number, string][] = [[7, "Refund policy questions"], [9, "Orders summary"]];
const ISO_B: [number, string][] = [[41, "Pricing review"], [44, "Vendor notes"]];

export function Isolation() {
  const { ref, run, reduced, hoverProps } = useLive();
  const [c, setC] = useState(0);
  const [t, setT] = useState(0);
  const cs = ISO_CASES[c];
  const tt = reduced ? 4 : t;

  useEffect(() => {
    if (!run || t >= 4) return;
    const id = window.setTimeout(() => setT(t + 1), 380);
    return () => window.clearTimeout(id);
  }, [run, t]);

  const win = (name: string, who: string, home: "A" | "B", rows: [number, string][]) => {
    const mine = home === "A";
    const targeted = cs.home === home;
    return (
      <div className="min-w-0 overflow-hidden rounded-lg border bg-[#0e0e10] transition-colors duration-300" style={{ borderColor: tt >= 3 && targeted ? (cs.ok ? hexA(OK, 0.6) : hexA(BAD, 0.6)) : "rgba(255,255,255,.12)" }}>
        <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
          <span className="text-[14.5px] font-medium text-white">{name}</span>
          <span className="qpe-mono text-[12.5px]" style={{ color: mine ? ACCENT : "rgba(255,255,255,.45)" }}>{who}</span>
        </div>
        <ul className="p-2">
          {rows.map(([id, label]) => {
            const hit = tt >= 3 && cs.id === id;
            return (
              <li key={id} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14.5px] transition-colors duration-300" style={{ background: hit ? hexA(cs.ok ? OK : BAD, 0.1) : "transparent", color: hit ? "#fff" : "rgba(255,255,255,.7)" }}>
                <span className="qpe-mono w-9 shrink-0 text-[13px] text-white/40">#{id}</span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {hit && (
                  <span className="qpe-pop qpe-mono inline-flex shrink-0 items-center gap-1.5 text-[12.5px]" style={{ color: cs.ok ? OK : BAD }}>
                    <Glyph kind={cs.ok ? "ok" : "bad"} s={13} />{cs.ok ? "match" : "creator ≠ you"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <VizFrame
      title="isolation / ownership lives inside the query"
      frameRef={ref}
      hov={hoverProps}
      
      foot={<span className="text-white/65">Ownership is part of the query, so a guessed id finds no row. There is no separate "is this yours?" check that could be skipped. Documents work the same way through their workspace owner.</span>}
    >
      <div className="p-4 sm:p-5">
        <div role="radiogroup" aria-label="Request" className="flex flex-wrap gap-2">
          {ISO_CASES.map((x, i) => (
            <button
              key={x.label}
              type="button"
              role="radio"
              aria-checked={i === c}
              onClick={() => { setC(i); setT(0); }}
              className={`rounded-md border px-3 py-1.5 text-[14px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 ${i === c ? "border-white/70 bg-white/[0.07] text-white" : "border-white/20 text-white/65 hover:border-white/50 hover:text-white"}`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {win("Your conversations", "created by: you", "A", ISO_A)}
          {win("Another user's conversations", "created by: someone else", "B", ISO_B)}
        </div>

        <div className="qpe-mono mt-4 min-h-[104px] space-y-1.5 overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0d] p-3.5 text-[13.5px] leading-[1.6]">
          {tt >= 1 && <p key={`r${c}`} className="qpe-slide text-white/75"><span className="text-white/40">request </span>conversation_id = <span style={{ color: ACCENT }}>{cs.id}</span>, user = <span className="text-white">you</span></p>}
          {tt >= 2 && <p key={`q${c}`} className="qpe-slide text-white/75 [overflow-wrap:anywhere]"><span className="text-white/40">query   </span>Conversation.objects.get(id=<span style={{ color: ACCENT }}>{cs.id}</span>, created_by=user)</p>}
          {tt >= 3 && <p key={`o${c}`} className="qpe-slide" style={{ color: cs.ok ? OK : BAD }}><span className="text-white/40">result  </span>{cs.result}</p>}
        </div>
      </div>
    </VizFrame>
  );
}

/* ---------------------------------- two locks ---------------------------------- */

interface LockCase { label: string; sql: string; l1: [boolean, string]; l2: [boolean, string] | null; out: string; note?: string }
const LOCKS: LockCase[] = [
  { label: "A count", sql: "SELECT COUNT(*) FROM selected_orders WHERE Status = %s", l1: [true, "SELECT, one statement, own tables"], l2: [true, "read-only account"], out: "rows returned, capped at 100" },
  { label: "A write", sql: "DELETE FROM selected_orders WHERE 1 = 1", l1: [false, "only SELECT or WITH"], l2: null, out: "never reaches the database" },
  { label: "Two statements", sql: "SELECT 1; DROP TABLE users", l1: [false, "one statement only"], l2: null, out: "never reaches the database" },
  { label: "Another workspace", sql: "SELECT * FROM ws_9_doc_4_table_0", l1: [false, "table outside this workspace's set"], l2: null, out: "never reaches the database" },
  { label: "If validation missed", sql: "UPDATE selected_orders SET Status = 'x'", l1: [true, "suppose a validator bug let it by"], l2: [false, "permission denied: no write grant"], out: "the database refuses the write", note: "Hypothetical. This is why there is a second lock." },
];
const LOCK_MS = 300;

export function SqlLocks() {
  const { ref, run, reduced, hoverProps } = useLive();
  const [c, setC] = useState(0);
  const [t, setT] = useState(0);
  const cs = LOCKS[c];
  const tt = reduced ? 6 : t;

  useEffect(() => {
    if (!run || t >= 6) return;
    const id = window.setTimeout(() => setT(t + 1), LOCK_MS);
    return () => window.clearTimeout(id);
  }, [run, t]);

  const reached = cs.l1[0] && cs.l2 !== null && cs.l2[0];
  const l1k = tt >= 2 ? (cs.l1[0] ? "ok" : "bad") : tt >= 1 ? "run" : "wait";
  const l2k = cs.l1[0] ? (tt >= 4 ? (cs.l2 && cs.l2[0] ? "ok" : "bad") : tt >= 3 ? "run" : "wait") : "wait";
  const dbk = tt >= 5 ? (reached ? "ok" : "bad") : "wait";

  const col = (title: string, kind: "ok" | "bad" | "run" | "wait", body: ReactNode, sub?: string) => (
    <div className="min-w-0 flex-1 rounded-lg border bg-[#0e0e10] p-3.5 transition-colors duration-300" style={{ borderColor: kind === "ok" ? hexA(OK, 0.5) : kind === "bad" ? hexA(BAD, 0.55) : kind === "run" ? hexA(ACCENT, 0.6) : "rgba(255,255,255,.12)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="qpe-mono text-[12.5px] uppercase tracking-[0.07em] text-white/45">{title}</span>
        <Glyph kind={kind} s={14} />
      </div>
      <div className="mt-2.5 text-[14px] leading-[1.5] text-white/80">{body}</div>
      {sub && <p className="qpe-mono mt-2 text-[13px] leading-[1.5]" style={{ color: kind === "bad" ? BAD : kind === "ok" ? OK : "rgba(255,255,255,.4)" }}>{sub}</p>}
    </div>
  );

  return (
    <VizFrame
      title="sql / two independent locks"
      frameRef={ref}
      hov={hoverProps}
      
      foot={<span className="text-white/65">{cs.note ?? "Validation and a database account that can't write protect against different failures. Neither is treated as enough alone."}</span>}
    >
      <div className="p-4 sm:p-5">
        <div role="radiogroup" aria-label="Statement" className="flex flex-wrap gap-2">
          {LOCKS.map((x, i) => (
            <button
              key={x.label}
              type="button"
              role="radio"
              aria-checked={i === c}
              onClick={() => { setC(i); setT(0); }}
              className={`rounded-md border px-3 py-1.5 text-[14px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 ${i === c ? "border-white/70 bg-white/[0.07] text-white" : "border-white/20 text-white/65 hover:border-white/50 hover:text-white"}`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="qpe-locks mt-4 flex gap-2.5">
          {col("Generated SQL", "wait", <code className="qpe-mono block text-[13.5px] leading-[1.55] text-white [overflow-wrap:anywhere]">{cs.sql}<span className="qpe-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-white/70" /></code>)}
          <span aria-hidden="true" className="qpe-arr place-items-center text-white/30"><Icon n="arrow" className="h-4 w-4" /></span>
          {col("Lock 1 · validator", l1k, tt >= 2 ? cs.l1[1] : "checking the statement", tt >= 2 ? (cs.l1[0] ? "passed" : "rejected") : undefined)}
          <span aria-hidden="true" className="qpe-arr place-items-center text-white/30"><Icon n="arrow" className="h-4 w-4" /></span>
          {col("Lock 2 · database account", l2k, cs.l1[0] ? (tt >= 4 && cs.l2 ? cs.l2[1] : "structured_read, no write grants") : "not reached", tt >= 4 && cs.l1[0] ? (cs.l2 && cs.l2[0] ? "allowed" : "refused") : undefined)}
          <span aria-hidden="true" className="qpe-arr place-items-center text-white/30"><Icon n="arrow" className="h-4 w-4" /></span>
          {col("Structured MySQL", dbk, tt >= 5 ? cs.out : "waiting")}
        </div>

        <div className="mt-4 flex justify-center">
          <div className="relative inline-flex max-w-full flex-wrap items-center gap-x-0 overflow-hidden rounded-full border px-1 py-1 text-[13.5px] transition-colors duration-500" style={{ borderColor: reached && tt >= 5 ? hexA(OK, 0.5) : "rgba(255,255,255,.14)", background: reached && tt >= 5 ? hexA(OK, 0.1) : "rgba(255,255,255,.03)" }}>
            <span className="mr-1 grid h-6 w-6 place-items-center rounded-full" style={{ background: reached && tt >= 5 ? hexA(OK, 0.25) : "rgba(255,255,255,.08)" }}><Glyph kind={reached && tt >= 5 ? "ok" : "wait"} s={14} /></span>
            {["structured_read", "SELECT only", "timeout", "100-row cap"].map((x, i) => (
              <span key={x} className={`qpe-mono px-3 py-1 text-white/80 ${i ? "border-l border-white/15" : ""}`}>{x}</span>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className={`qpe-rain relative mx-auto mt-0 h-9 w-[220px] ${reached && tt >= 5 ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}>
          {Array.from({ length: 14 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.23) % 1.8}s` }} />)}
        </div>
      </div>
    </VizFrame>
  );
}

/* ---------------------------------- worker pool ---------------------------------- */

interface PFrame { cap: string; queue: number[]; slots: ({ job: number; stage: string; bad?: boolean } | null)[]; status: Record<number, string> }
const P0 = { 101: "pending", 102: "pending", 103: "pending", 104: "pending", 105: "pending" };
const POOL: PFrame[] = [
  { cap: "Five uploads were validated and committed. Their job ids are in Redis; their status is in MySQL.", queue: [101, 102, 103, 104, 105], slots: [null, null, null], status: P0 },
  { cap: "Three threads each claim one job with a row lock. A second worker would find the row already taken.", queue: [104, 105], slots: [{ job: 101, stage: "claimed" }, { job: 102, stage: "claimed" }, { job: 103, stage: "claimed" }], status: { ...P0, 101: "processing", 102: "processing", 103: "processing" } },
  { cap: "Parse. LiteParse first, LlamaParse if it fails. A heartbeat is written every 30 seconds while the job runs.", queue: [104, 105], slots: [{ job: 101, stage: "parse" }, { job: 102, stage: "parse" }, { job: 103, stage: "parse" }], status: { ...P0, 101: "processing", 102: "processing", 103: "processing" } },
  { cap: "Chunk and embed. Valid tables become SQL tables; the rest become labelled text.", queue: [104, 105], slots: [{ job: 101, stage: "embed" }, { job: 102, stage: "embed" }, { job: 103, stage: "parse" }], status: { ...P0, 101: "processing", 102: "processing", 103: "processing" } },
  { cap: "A worker thread dies mid-job. Its heartbeat stops.", queue: [104, 105], slots: [{ job: 101, stage: "index" }, { job: 102, stage: "heartbeat lost", bad: true }, { job: 103, stage: "embed" }], status: { ...P0, 101: "processing", 102: "processing", 103: "processing" } },
  { cap: "Stale-job recovery reads MySQL, finds a job with no heartbeat for 30 minutes (the default) and queues it again. Attempt 2 of 3.", queue: [104, 105, 102], slots: [{ job: 101, stage: "index" }, null, { job: 103, stage: "embed" }], status: { ...P0, 101: "processing", 102: "retry", 103: "processing" } },
  { cap: "Job 101 finishes: the document is ready. Free threads claim the next jobs, including the retry.", queue: [105], slots: [{ job: 104, stage: "claimed" }, { job: 102, stage: "claimed" }, { job: 103, stage: "index" }], status: { ...P0, 101: "completed", 102: "processing", 103: "processing", 104: "processing" } },
  { cap: "After three failed tries a job is marked failed and its half-written vectors and tables are cleaned up.", queue: [], slots: [{ job: 104, stage: "embed" }, { job: 102, stage: "parse" }, { job: 105, stage: "claimed" }], status: { ...P0, 101: "completed", 102: "processing", 103: "completed", 104: "processing", 105: "processing" } },
];
const POOL_MS = 600;
const STATUS_COLOR: Record<string, string> = { pending: "rgba(255,255,255,.45)", processing: ACCENT, retry: HOT, completed: OK, failed: BAD };

export function WorkerPool() {
  const { ref, run, reduced, hoverProps } = useLive();
  const [f, setF] = useState(0);
  const fi = reduced ? POOL.length - 1 : f;
  const fr = POOL[fi];

  useEffect(() => {
    if (!run || f >= POOL.length - 1) return;
    const id = window.setTimeout(() => setF((x) => x + 1), POOL_MS);
    return () => window.clearTimeout(id);
  }, [run, f]);

  const chip = (job: number, extra?: ReactNode) => (
    <span className="qpe-mono inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[13px] text-white/85">job {job}{extra}</span>
  );

  return (
    <VizFrame
      title="ingestion / queue, worker threads, job status"
      frameRef={ref}
      hov={hoverProps}
      right={
        <span className="flex items-center gap-2">
          <span className="qpe-mono hidden text-[13px] text-white/40 sm:block">{fi + 1}/{POOL.length}</span>
          <button type="button" className={ctl} onClick={() => setF(0)}><Icon n="replay" className="h-3.5 w-3.5" />Replay</button>
          
        </span>
      }
      foot={<span key={fi} className="qpe-pop text-white/75">{fr.cap}</span>}
    >
      <div className="qpe-pool grid gap-3 p-4 sm:p-5">
        <div className="min-w-0 rounded-lg border border-white/12 bg-[#0e0e10] p-3.5">
          <p className="qpe-mono text-[12.5px] uppercase tracking-[0.07em] text-white/45">Redis queue · ids only</p>
          <div className="mt-3 flex min-h-[132px] flex-wrap content-start gap-2">
            {fr.queue.length === 0 && <span className="text-[13.5px] text-white/35">empty</span>}
            {fr.queue.map((j) => <span key={`${fi}-${j}`} className="qpe-rise">{chip(j)}</span>)}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-white/12 bg-[#0e0e10] p-3.5">
          <p className="qpe-mono text-[12.5px] uppercase tracking-[0.07em] text-white/45">Worker · 3 threads · row lock on claim</p>
          <ul className="mt-3 space-y-2">
            {fr.slots.map((sl, i) => (
              <li key={i} className="flex min-h-[38px] items-center gap-3 rounded-md border px-3 py-1.5 transition-colors duration-300" style={{ borderColor: sl?.bad ? hexA(BAD, 0.6) : sl ? hexA(ACCENT, 0.35) : "rgba(255,255,255,.1)", background: sl?.bad ? hexA(BAD, 0.07) : "transparent" }}>
                <span className="qpe-mono w-6 shrink-0 text-[13px] text-white/40">T{i + 1}</span>
                {sl ? (
                  <span key={`${fi}-${sl.job}-${sl.stage}`} className="qpe-slide flex min-w-0 flex-1 items-center justify-between gap-2">
                    {chip(sl.job)}
                    <span className="qpe-mono inline-flex items-center gap-1.5 text-[13px]" style={{ color: sl.bad ? BAD : "rgba(255,255,255,.7)" }}>
                      <Glyph kind={sl.bad ? "bad" : "run"} s={13} />{sl.stage}
                    </span>
                  </span>
                ) : <span className="text-[13.5px] text-white/35">idle</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-lg border border-white/12 bg-[#0e0e10] p-3.5">
          <p className="qpe-mono text-[12.5px] uppercase tracking-[0.07em] text-white/45">MySQL · job status</p>
          <ul className="mt-3 space-y-2">
            {([101, 102, 103, 104, 105] as const).map((j) => {
              const s = fr.status[j];
              return (
                <li key={j} className="flex items-center justify-between gap-2 text-[13.5px]">
                  {chip(j)}
                  <span className="qpe-mono inline-flex items-center gap-1.5 transition-colors duration-300" style={{ color: STATUS_COLOR[s] }}>
                    {s === "completed" ? <Glyph kind="ok" s={13} /> : s === "processing" ? <Glyph kind="run" s={13} /> : <Glyph kind="wait" s={13} />}{s}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </VizFrame>
  );
}

/* ------------------------------------ switch ------------------------------------ */

export type VizId = "build" | "flow" | "isolation" | "locks" | "pool";

export function Viz({ id }: { id: VizId }) {
  switch (id) {
    case "build": return <BuildCanvas />;
    case "flow": return <RequestFlow />;
    case "isolation": return <Isolation />;
    case "locks": return <SqlLocks />;
    case "pool": return <WorkerPool />;
    default: return null;
  }
}

/* ------------------------------- trace a question ------------------------------- */

type Stage = "scope" | "plan" | "dispatch" | "finish";
const STAGES: { id: Stage; label: string }[] = [
  { id: "scope", label: "Scope Guard" },
  { id: "plan", label: "Planner" },
  { id: "dispatch", label: "Dispatch" },
  { id: "finish", label: "Finish" },
];
const STAGE_LABEL: Record<Stage, string> = { scope: "scope", plan: "planner", dispatch: "dispatch", finish: "finish" };

interface Trace { q: string; lines: [Stage, string][] }

/** Illustrative traces of the documented question paths. Stages and tools only: no timings, none were measured. */
const TRACES: Trace[] = [
  {
    q: "What is the refund window after cancelling?",
    lines: [
      ["scope", "rules: no match, classifier called"],
      ["scope", "route = DOCUMENT, ids checked against the allow-list"],
      ["plan", "category_hint = document, operation = lookup"],
      ["plan", 'R1 kind=text type=rule "cancellation refund conditions"'],
      ["dispatch", "search_evidence: dense top 20 + BM25 top 20"],
      ["dispatch", "RRF k=60, dedupe, keep top 5"],
      ["finish", "answer from the passages, streamed over SSE"],
    ],
  },
  {
    q: "How many orders were delivered?",
    lines: [
      ["scope", "route = DOCUMENT"],
      ["plan", "category_hint = structured, operation = aggregate"],
      ["plan", 'R1 kind=table type=numeric "count of delivered orders"'],
      ["dispatch", "query_tables: select tables (roles: output, filter)"],
      ["dispatch", "generate SQL: SELECT ... WHERE Status = %s"],
      ["dispatch", "validate: SELECT only, one statement, own tables"],
      ["dispatch", "run on structured_read, 100-row cap"],
      ["finish", "answer from the structured result"],
    ],
  },
  {
    q: "Which delivered orders qualify for a refund?",
    lines: [
      ["scope", "route = DOCUMENT"],
      ["plan", "category_hint = mixed, operation = filter"],
      ["plan", 'R1 kind=text type=rule "refund eligibility conditions"'],
      ["plan", 'R2 kind=table type=entity "delivered orders"'],
      ["dispatch", "search_evidence: the rule comes from policy text"],
      ["dispatch", "query_tables: the records come from validated SQL"],
      ["dispatch", "assemble evidence, sources kept apart"],
      ["finish", "answer, and say so if the rule or the records are missing"],
    ],
  },
  {
    q: "What happened to the one we discussed?",
    lines: [
      ["scope", "route = DOCUMENT, bounded history in the prompt"],
      ["plan", "effective query built from memory: summary + last 10 messages"],
      ["plan", "reference resolved against the catalogue, one match"],
      ["dispatch", "memory is context, not evidence"],
      ["dispatch", "then the normal document or table path"],
      ["finish", "answer from the collected evidence"],
    ],
  },
  {
    q: "Hi",
    lines: [
      ["scope", "rules: greeting matched, classifier skipped"],
      ["scope", "route = CHITCHAT, no retrieval"],
      ["finish", "short reply; planner and dispatch never run"],
    ],
  },
];

function colorize(text: string): ReactNode[] {
  return text.split(/("[^"]*"|\b[A-Z]{4,}\b|\bR\d\b)/g).map((s, i) => {
    if (!s) return null;
    if (s.startsWith('"')) return <span key={i} className="text-white">{s}</span>;
    if (/^([A-Z]{4,}|R\d)$/.test(s)) return <span key={i} style={{ color: ACCENT }}>{s}</span>;
    return s;
  });
}

export function PathTrace() {
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0);
  const [n, setN] = useState(0);

  const t = TRACES[i];
  const total = t.lines.length;

  // New question or replay: start again from the first line.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setN(reduce ? total : 1);
  }, [i, run, total]);

  // Reveal one line every 260ms. The longest trace takes about two seconds.
  useEffect(() => {
    if (n >= total) return;
    const id = window.setTimeout(() => setN((k) => Math.min(total, k + 1)), 260);
    return () => window.clearTimeout(id);
  }, [n, total]);

  const shown = t.lines.slice(0, n);
  const used = new Set(t.lines.map((l) => l[0]));
  const current = shown.length ? shown[shown.length - 1][0] : null;

  return (
    <section aria-label="Trace a question" className="mt-16 border-t border-white/10 pt-12">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-white">Trace a question</h2>
      <p className="mt-2 max-w-[40rem] text-[16.5px] leading-[1.65] text-white/60">Pick a question to see which stages it reaches. A greeting stops at Scope Guard. A mixed question passes through every stage and both evidence paths. Replay it any time. The trace lists stages and tools only; no timings, because none were measured.</p>

      <div className="mt-8 grid gap-5 min-[1200px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div role="radiogroup" aria-label="Sample question" className="flex flex-col gap-2.5">
          {TRACES.map((x, k) => {
            const on = k === i;
            return (
              <button
                key={x.q}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { setI(k); setRun((r) => r + 1); }}
                className={`rounded-lg border px-4 py-3.5 text-left text-[16.5px] leading-[1.45] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 ${on ? "border-white bg-white/[0.07] text-white" : "border-white/[0.18] text-white/80 hover:border-white/45 hover:text-white"}`}
              >
                {x.q}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.16] bg-[#0c0c0c]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 py-2 pl-4 pr-2.5 text-[14.5px] text-white/75">
            <Icon n="terminal" className="h-4 w-4" />
            <span>trace</span>
            <span className="qpe-mono text-[13.5px] text-white/45">{n}/{total}</span>
            <span className="flex-1" />

            <button type="button" className={ctl} onClick={() => setRun((r) => r + 1)}>
              <Icon n="replay" className="h-4 w-4" />Replay
            </button>
          </div>

          <div aria-hidden="true" className="h-[2px] bg-white/10">
            <div className="h-full bg-white transition-[width] duration-300" style={{ width: `${(n / total) * 100}%` }} />
          </div>

          <ol className="flex flex-wrap items-center gap-y-2 border-b border-white/10 px-4 py-3.5 text-[14px]">
            {STAGES.map((s, k) => {
              const skipped = !used.has(s.id);
              const reached = shown.some((l) => l[0] === s.id);
              const now = current === s.id;
              const cls = skipped ? "border-dashed border-white/20 text-white/40" : now ? "border-white bg-white/10 text-white" : reached ? "border-white/50 text-white/90" : "border-white/15 text-white/50";
              return (
                <li key={s.id} className="flex items-center">
                  {k > 0 && <span aria-hidden="true" className="mx-2 h-px w-4 bg-white/25" />}
                  <span className={`rounded border px-2.5 py-1 transition-colors duration-300 ${cls}`}>
                    {s.label}{skipped ? " (skipped)" : ""}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="qpe-mono min-h-[300px] space-y-1.5 p-4 text-[15px] leading-[1.7]">
            <p className="text-white/55">question <span className="text-white">{t.q}</span></p>
            {shown.map(([s, text], k) => (
              <div key={`${i}-${run}-${k}`} className="qpe-pop grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                <span className="text-white/55">{STAGE_LABEL[s]}</span>
                <span className="text-white/85 [overflow-wrap:anywhere]">{colorize(text)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- overview hub + footer ---------------------------- */

/** One of the primary sections. The page file owns the list. */
export interface Group { id: string; num: string; name: string; blurb: string }
export interface HubItem { id: string; title: string; lead: string; group: string }

/** Reading paths: pick one and the matching cards number their pages in reading order. */
interface ReadPath { label: string; blurb: string; pages: string[] }
const READ_PATHS: ReadPath[] = [
  { label: "Ten minutes", blurb: "The shape of the system and the three decisions that matter most.", pages: ["quick-start", "product-architecture", "scope-guard", "planner", "structured-sql"] },
  { label: "Follow a question", blurb: "From the first message to the streamed answer.", pages: ["quick-start", "scope-guard", "planner", "execution-graph", "retrieval", "evidence-and-answers"] },
  { label: "Where the data lives", blurb: "Stores, schema, ingestion and tables.", pages: ["database-architecture-consistency", "workspaces", "document-ingestion-pipeline", "structured-data"] },
  { label: "Integrate with it", blurb: "Every route, limit and setting you need to call or run the backend.", pages: ["api-reference", "limits-and-defaults", "configuration", "security-model"] },
  { label: "Running it for real", blurb: "Sign-in, deployment, and what isn't done yet.", pages: ["authentication-token-lifecycle", "deployment-stories", "known-gaps"] },
];

/** Numbers shown on the hub. Each is a value the backend enforces. */
const HUB_FACTS: { k: string; v: string; sub: string }[] = [
  { k: "13", v: "stages", sub: "from Send to the last streamed token" },
  { k: "3", v: "graph nodes", sub: "agent, dispatch, finish" },
  { k: "12", v: "tool calls", sub: "the most one question may use" },
  { k: "2", v: "SQL locks", sub: "a validator and a read-only account" },
  { k: "5", v: "data stores", sub: "each chosen for one access pattern" },
];


/* ===================== docs components ===================== */

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";

function CopyBtn({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* blocked */ } }}
      className={`grid size-8 shrink-0 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white ${FOCUS}`}
    >
      <Icon n={done ? "tick" : "copy"} className="size-[18px]" />
    </button>
  );
}

/* ------------------------- syntax colouring -------------------------
 * Shiki with its CSS-variables theme: every token gets var(--shiki-token-*), and the real colours are defined in
 * EXPLORER_CSS (search for --shiki-). Change a colour there and every code panel follows.
 * Until Shiki has loaded (or if it fails to load) the small built-in colouring above is used instead.
 */
type Hl = Awaited<ReturnType<typeof createHighlighter>>;
let hlPromise: Promise<Hl> | null = null;

function loadHl(): Promise<Hl> {
  if (!hlPromise) {
    hlPromise = createHighlighter({
      themes: [createCssVariablesTheme({ name: "css-variables", variablePrefix: "--shiki-", variableDefaults: {}, fontStyle: true })],
      langs: ["bash", "python", "sql", "json", "yaml", "http"],
    });
  }
  return hlPromise;
}

/** A tab can set `lang` itself. Otherwise the language is guessed from the code. null = leave it uncoloured. */
function guessLang(code: string): string | null {
  const c = code.trim();
  if (/^(POST|GET|PATCH|PUT|DELETE)\s+\/|^Authorization:/m.test(c)) return "http";
  if (/^event:\s/m.test(c)) return "yaml";
  if (/^(SELECT|WITH)\b/i.test(c)) return "sql";
  if (/\bdef \w+\(|^(from|import) \w|^\s*(if|for|while|with|elif|else)\b.*:\s*$|^\w+ = \w+\(/m.test(c)) return "python";
  if (/^[{[]/.test(c)) return "json";
  return null;
}

function useShiki(code: string, lang: string | null): ThemedToken[][] | null {
  const [res, setRes] = useState<{ code: string; lang: string; toks: ThemedToken[][] } | null>(null);
  useEffect(() => {
    let off = false;
    if (!lang) return;
    loadHl()
      .then((hl) => {
        if (!off) setRes({ code, lang, toks: hl.codeToTokens(code, { lang: lang as BundledLanguage, theme: "css-variables" }).tokens });
      })
      .catch(() => { if (!off) setRes(null); });
    return () => { off = true; };
  }, [code, lang]);
  return res && res.code === code && res.lang === lang ? res.toks : null;
}

export function CodePanel({ tabs }: { tabs: CodeTab[] }) {
  const [i, setI] = useState(0);
  const t = tabs[Math.min(i, tabs.length - 1)];
  const lines = t.code.split("\n");
  const nums = !t.plain && !t.term && lines.length > 3;
  const lang = t.plain ? null : t.term ? "bash" : t.lang ?? guessLang(t.code);
  const toks = useShiki(t.code, lang);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.12] bg-[#0c0c0d]">
      <div className="flex min-h-10 items-stretch border-b border-white/10 pr-2">
        {tabs.length > 1 ? (
          <div role="tablist" className="qpe-scroll flex min-w-0 flex-1 overflow-x-auto">
            {tabs.map((x, k) => (
              <button key={x.label} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)} className={`-mb-px shrink-0 border-b-2 px-4 text-[14.5px] transition-colors ${k === i ? "border-white text-white" : "border-transparent text-white/55 hover:text-white"} ${FOCUS}`}>{x.label}</button>
            ))}
          </div>
        ) : (
          <span className="flex min-w-0 flex-1 items-center truncate px-4 text-[14.5px] font-medium text-white/85">{t.label}</span>
        )}
        {t.file && <span className="qpe-mono hidden max-w-[45%] items-center truncate px-2 text-[14px] text-white/40 sm:flex">{t.file}</span>}
        <span className="flex items-center"><CopyBtn text={t.code} /></span>
      </div>
      {t.note && <p className="border-b border-white/10 px-4 py-3 text-[16px] text-white/70">{t.note}</p>}
      <div className="qpe-mono py-3.5 text-[14.5px] leading-[1.7] text-white/90">
        {lines.map((l, k) => (
          <div key={k} className="flex">
            {nums && <span aria-hidden="true" className="w-12 shrink-0 select-none pr-4 text-right text-white/25">{k + 1}</span>}
            <code className={`min-w-0 flex-1 whitespace-pre-wrap pr-5 [overflow-wrap:anywhere] ${nums ? "" : "pl-5"}`}>
              {toks && toks.length === lines.length
                ? toks[k].map((tk, m) => <span key={m} style={{ color: tk.color, fontStyle: tk.fontStyle !== undefined && tk.fontStyle > 0 && (tk.fontStyle & 1) ? "italic" : undefined }}>{tk.content}</span>)
                : t.plain || !lang ? l : t.term ? shell(l) : highlight(l)}{l === "" ? "\u00a0" : null}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- content blocks ------------------------------- */

const prose = "mt-5 max-w-[780px] text-[17px] leading-[1.7] text-white/70";
const th = "qpe-mono px-4 py-2.5 text-[13px] font-medium uppercase tracking-[0.06em] text-white/45";

function Callout({ kind, title, text }: { kind: "note" | "warn"; title: string; text: string }) {
  const warn = kind === "warn";
  const c = warn ? HOT : ACCENT;
  return (
    <aside
      role="note"
      className="mt-6 flex gap-3 rounded-lg border py-3.5 pl-4 pr-4"
      style={{ borderColor: warn ? hexA(HOT, 0.28) : "rgba(255,255,255,.1)", borderLeftColor: c, borderLeftWidth: 2, background: warn ? hexA(HOT, 0.04) : "rgba(255,255,255,.02)" }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: c }}><Icon n={warn ? "warn" : "info"} className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-[16px] font-medium leading-6" style={{ color: warn ? HOT : "#fff" }}>{title}</p>
        <p className="mt-1 text-[16px] leading-[1.7] text-white/70">{rich(text)}</p>
      </div>
    </aside>
  );
}

function DocTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="qpe-scroll mt-6 overflow-x-auto rounded-lg border border-white/[0.12]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[15.5px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h, k) => <th key={k} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className="border-b border-white/[0.07] transition-colors last:border-0 hover:bg-white/[0.02]">
              {r.map((c, m) => <td key={m} className={`px-4 py-3 align-top leading-[1.6] ${m === 0 ? "font-medium text-white" : "text-white/70"}`}>{rich(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const METHOD_COLOR: Record<string, string> = { GET: OK, POST: ACCENT, PATCH: HOT, PUT: HOT, DELETE: BAD };

/** Endpoint table: a method chip, the path, whether a JWT is needed, and what it does. */
function ApiTable({ rows }: { rows: string[][] }) {
  return (
    <div className="qpe-scroll mt-6 overflow-x-auto rounded-lg border border-white/[0.12]">
      <table className="w-full min-w-[660px] border-collapse text-left text-[15.5px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {["Method", "Path", "Auth", "What it does"].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, p, a, d], k) => {
            const c = METHOD_COLOR[m] ?? "rgba(255,255,255,.7)";
            return (
              <tr key={k} className="border-b border-white/[0.07] transition-colors last:border-0 hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-4 py-3 align-top"><span className="qpe-mono inline-block rounded border px-1.5 py-0.5 text-[13px] font-medium" style={{ color: c, borderColor: hexA(c.startsWith("#") ? c : "#ffffff", 0.4), background: hexA(c.startsWith("#") ? c : "#ffffff", 0.08) }}>{m}</span></td>
                <td className="qpe-mono px-4 py-3 align-top text-[14.5px] text-white [overflow-wrap:anywhere]">{p}</td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-[14.5px] text-white/60">{a === "JWT" ? <span className="inline-flex items-center gap-1.5"><Icon n="lock" className="size-3.5" />JWT</span> : a}</td>
                <td className="px-4 py-3 align-top leading-[1.6] text-white/70">{rich(d)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardGrid({ items }: { items: CardDef[] }) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {items.map((c) => {
        const inner = (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="text-[17px] font-medium tracking-[-0.01em] text-white">{c.title}</span>
              {c.to && <Icon n="arrow" className="size-4 shrink-0 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-white" />}
            </span>
            <span className="mt-1.5 block text-[15px] leading-[1.6] text-white/60">{rich(c.text)}</span>
            {c.tag && <span className="qpe-mono mt-2.5 inline-block text-[12.5px] uppercase tracking-[0.06em] text-white/40">{c.tag}</span>}
          </>
        );
        return (
          <li key={c.title}>
            {c.to
              ? <Link href={to(c.to)} scroll={false} className={`group block h-full rounded-lg border border-white/[0.12] p-4 transition-colors hover:border-white/35 hover:bg-white/[0.025] ${FOCUS}`}>{inner}</Link>
              : <div className="h-full rounded-lg border border-white/[0.12] p-4">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function FactStrip({ items }: { items: FactDef[] }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.12] sm:grid-cols-3">
      {items.map((f) => (
        <div key={f.k + f.v} className="bg-[#0b0b0c] px-4 py-3">
          <dt className="qpe-mono text-[12.5px] uppercase tracking-[0.07em] text-white/40">{f.k}</dt>
          <dd className="mt-1 text-[17px] font-medium leading-snug tracking-[-0.01em] text-white [overflow-wrap:anywhere]">{f.v}</dd>
          {f.sub && <p className="mt-0.5 text-[14px] leading-[1.45] text-white/45">{f.sub}</p>}
        </div>
      ))}
    </dl>
  );
}

/** One question, two columns: what a typical RAG pipeline does with it, and what QueryPilot does. */
function Compare({ q, sides }: { q: string; sides: [CmpSide, CmpSide] }) {
  return (
    <figure className="qpe-step mt-7 overflow-hidden rounded-xl border border-white/[0.14] bg-[#0b0b0c]">
      <figcaption className="border-b border-white/10 px-5 py-4">
        <p className="qpe-mono text-[12.5px] uppercase tracking-[0.08em] text-white/40">Same question, same two files</p>
        <p className="mt-1.5 text-[19px] font-medium leading-snug tracking-[-0.01em] text-white">{q}</p>
      </figcaption>
      <div className="qpe-sg p-4 sm:p-5">
        {sides.map((s) => {
          const c = s.good ? OK : BAD;
          return (
            <div key={s.title} className="flex min-w-0 flex-col rounded-lg border p-4" style={{ borderColor: s.good ? hexA(ACCENT, 0.4) : "rgba(255,255,255,.12)" }}>
              <p className="qpe-mono text-[12.5px] uppercase tracking-[0.08em]" style={{ color: s.good ? ACCENT : "rgba(255,255,255,.45)" }}>{s.tag}</p>
              <h3 className="mt-1.5 text-[18px] font-medium tracking-[-0.01em] text-white">{s.title}</h3>
              <ol className="mt-4 space-y-2.5 text-[15.5px] leading-[1.6] text-white/70">
                {s.lines.map((l, k) => (
                  <li key={k} className="flex gap-3"><span className="qpe-mono w-5 shrink-0 text-[13.5px] leading-[1.75] text-white/35">{k + 1}</span><span className="min-w-0">{rich(l)}</span></li>
                ))}
              </ol>
              <div className="mt-auto pt-5">
                <p className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[15.5px] leading-[1.55] text-white" style={{ borderColor: hexA(c, 0.4), background: hexA(c, 0.07) }}>
                  <span className="mt-[3px]"><Glyph kind={s.good ? "ok" : "bad"} s={16} /></span>
                  <span className="min-w-0">{s.verdict}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/** Numbered rail on the left. Each step is text on the left and its code on the right (stacked on narrow widths). */
function Steps({ items }: { items: StepDef[] }) {
  const [on, setOn] = useState<boolean[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  // A marker fills white once it scrolls into the upper half of the screen, and empties again if you scroll back above it.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setOn(items.map(() => true)); return; }
    const io = new IntersectionObserver((entries) => {
      setOn((prev) => {
        const next = prev.slice();
        entries.forEach((e) => { next[Number((e.target as HTMLElement).dataset.i)] = e.isIntersecting || e.boundingClientRect.top < 0; });
        return next;
      });
    }, { rootMargin: "0px 0px -50% 0px" });
    dots.current.forEach((el) => { if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);

  return (
    <ol className="mt-8">
      {items.map((s, i) => (
        <li key={s.title} className="qpe-step relative pb-10 pl-11 last:pb-0">
          {i < items.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-9 w-px bg-white/10 transition-colors duration-500" style={on[i + 1] ? { background: "#fff" } : undefined} />}
          <span ref={(el) => { dots.current[i] = el; }} data-i={i} className={`qpe-mono absolute left-0 top-0 grid size-7 place-items-center rounded-full border text-[13.5px] transition-colors duration-500 ${on[i] ? "border-white bg-white font-medium text-[#0A0A0A]" : "border-white/20 bg-[#0A0A0A] text-white/85"}`}>{i + 1}</span>
          <div className={s.code ? "qpe-sg" : ""}>
            <div className="min-w-0">
              <h3 className="text-[18.5px] font-medium leading-7 tracking-[-0.01em] text-white">{s.title}</h3>
              {s.text.map((t, k) => <p key={k} className={prose}>{rich(t)}</p>)}
            </div>
            {s.code && <div className="qpe-sticky min-w-0"><CodePanel tabs={s.code} /></div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const Marker = ({ n }: { n: number }) => <span className="qpe-mono w-6 shrink-0 text-[14.5px] leading-[1.95] text-white/40">{n}.</span>;
const list = "mt-5 max-w-[780px] space-y-2.5 text-[17px] leading-[1.7] text-white/70";

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p": return <p key={i} className={prose}>{rich(b.text)}</p>;
          case "h3": return <h3 key={i} className="mt-10 text-[21px] font-semibold tracking-[-0.01em] text-white">{b.text}</h3>;
          case "ul": return (
            <ul key={i} className={list}>
              {b.items.map((t, k) => <li key={k} className="flex gap-3"><span aria-hidden="true" className="mt-[0.95em] h-px w-3 shrink-0 bg-white/40" /><span>{rich(t)}</span></li>)}
            </ul>
          );
          case "ol": return (
            <ol key={i} className={list}>
              {b.items.map((t, k) => <li key={k} className="flex gap-2"><Marker n={k + 1} /><span>{rich(t)}</span></li>)}
            </ol>
          );
          case "dia": return <div key={i} className="qpx-wrap qpx-up">{hasDiagram(b.title) ? <Diagram spec={b.spec} title={b.title} /> : <Explorer spec={b.spec} title={b.title} />}</div>;
          case "viz": return <div key={i} className="qpx-wrap qpx-up"><Viz id={b.id} /></div>;
          case "table": return <DocTable key={i} head={b.head} rows={b.rows} />;
          case "api": return <ApiTable key={i} rows={b.rows} />;
          case "cards": return <CardGrid key={i} items={b.items} />;
          case "facts": return <FactStrip key={i} items={b.items} />;
          case "cmp": return <Compare key={i} q={b.q} sides={b.sides} />;
          case "code": return <div key={i} className="mt-6"><CodePanel tabs={b.tabs} /></div>;
          case "split": return (
            <div key={i} className="qpe-step mt-5">
              <div className="qpe-sg">
                <div className="min-w-0 [&>ol:first-child]:mt-0 [&>p:first-child]:mt-0">
                  {b.text.map((t, k) => <p key={k} className={prose}>{rich(t)}</p>)}
                  {b.list && (
                    <ol className={list}>
                      {b.list.map((t, k) => <li key={k} className="flex gap-2"><Marker n={k + 1} /><span>{rich(t)}</span></li>)}
                    </ol>
                  )}
                </div>
                <div className="qpe-sticky min-w-0"><CodePanel tabs={b.tabs} /></div>
              </div>
            </div>
          );
          case "note": return <Callout key={i} kind={b.kind} title={b.title} text={b.text} />;
          case "steps": return <Steps key={i} items={b.items} />;
          default: return null;
        }
      })}
    </>
  );
}

/* ------------------------- message lifecycle card -------------------------
 *
 * Four sections on the left, one scene on the right. The active row auto-advances (a progress bar fills its
 * right edge); click a row to jump to it. The scene fills in item by item and resolves each one to a status chip.
 * Hover pauses it; reduced motion shows the finished state. Colours: white, the accent, and OK / BAD for state only.
 */

type Tone = "ok" | "bad" | "accent" | "muted";
interface LcItem { stage: number; icon: IconName; label: string; sub: string; tag: string; tone: Tone }
interface LcScene {
  icon: IconName; title: string; blurb: string; from: number; to: number;
  head: { icon: IconName; title: string; sub: string };
  items: LcItem[];
  stream?: string;
}

const LC_STAGES = ["Send", "JWT", "Ownership", "Conversation", "Scope Guard", "Planner", "Hybrid retrieval", "Reranking", "Structured data", "Context", "Provider routing", "Answer", "Streaming"];

const LC: LcScene[] = [
  {
    icon: "check", title: "Secure request processing", from: 1, to: 4,
    blurb: "The JWT proves who is calling. The ownership check decides what they may touch, so a guessed id finds nothing.",
    head: { icon: "server", title: "Django API", sub: "JWT, ownership, conversation" },
    items: [
      { stage: 1, icon: "up", label: "Send message", sub: "POST chat stream · JWT in header", tag: "Received", tone: "ok" },
      { stage: 2, icon: "check", label: "JWT authentication", sub: "signature · expiry · user", tag: "Verified", tone: "ok" },
      { stage: 3, icon: "layers", label: "Ownership check", sub: "created by you · under the limit", tag: "Allowed", tone: "ok" },
      { stage: 3, icon: "warn", label: "Another user’s conversation id", sub: "creator ≠ you · 404", tag: "Blocked", tone: "bad" },
      { stage: 4, icon: "table", label: "Load conversation", sub: "summary + latest 10 messages", tag: "Ready", tone: "accent" },
    ],
  },
  {
    icon: "spark", title: "Intelligent query processing", from: 5, to: 6,
    blurb: "Scope Guard decides whether a message needs the knowledge base at all. The planner then splits a question into separate requirements.",
    head: { icon: "spark", title: "Planner", sub: "Scope Guard, then requirements" },
    items: [
      { stage: 5, icon: "flag", label: "Scope Guard", sub: "rules, then LLM classifier", tag: "DOCUMENT", tone: "accent" },
      { stage: 5, icon: "arrow", label: "Greeting: “Hi”", sub: "chitchat path · no retrieval", tag: "Skipped", tone: "muted" },
      { stage: 6, icon: "spark", label: "Planner", sub: "one question, two requirements", tag: "2 found", tone: "accent" },
      { stage: 6, icon: "search", label: "R1 · damaged-product policy", sub: "text · rule", tag: "Document", tone: "accent" },
      { stage: 6, icon: "search", label: "R2 · refund timeline", sub: "text · fact", tag: "Document", tone: "accent" },
    ],
  },
  {
    icon: "search", title: "Contextual retrieval", from: 7, to: 10,
    blurb: "Meaning and exact words are searched side by side, ranked together, and joined by table rows when needed. Then one context package is built.",
    head: { icon: "search", title: "Retrieval engine", sub: "vector store + BM25, then rerank" },
    items: [
      { stage: 7, icon: "search", label: "Vector search", sub: "Chroma / S3 Vectors · multilingual embeddings", tag: "20 chunks", tone: "accent" },
      { stage: 7, icon: "code", label: "BM25 keywords", sub: "exact terms · names · policy words", tag: "20 chunks", tone: "accent" },
      { stage: 8, icon: "layers", label: "Fuse and rerank", sub: "RRF k = 60 · title, heading, chunk", tag: "Top 5", tone: "ok" },
      { stage: 9, icon: "table", label: "Structured data path", sub: "table select → SQL → read-only", tag: "1 row", tone: "ok" },
      { stage: 10, icon: "check", label: "Context package", sub: "question · history · chunks · rows · sources", tag: "Built", tone: "ok" },
    ],
  },
  {
    icon: "terminal", title: "AI generation and streaming", from: 11, to: 13,
    blurb: "Each task gets its own model and key lane. The answer is written from the supplied evidence and streamed to the browser as it is produced.",
    head: { icon: "server", title: "Provider layer", sub: "Groq, one model per task" },
    items: [
      { stage: 11, icon: "server", label: "Provider routing", sub: "answer generation → gpt-oss-120b · key 3", tag: "Routed", tone: "accent" },
      { stage: 12, icon: "spark", label: "Answer generation", sub: "grounded in the evidence only", tag: "Grounded", tone: "ok" },
      { stage: 13, icon: "arrow", label: "Stream to browser", sub: "SSE · answer_delta events", tag: "Streaming", tone: "accent" },
    ],
    stream: "42 orders were delivered. Source: the orders table.",
  },
];

const LC_STEP = 260;
const LC_TICK = 40;
const LC_TAIL = 300;
const LC_STREAM = 800;
const lcStart = (i: number) => i * LC_STEP + 300;
const lcDur = (s: LcScene) => s.items.length * LC_STEP + 900 + (s.stream ? LC_STREAM : 0) + LC_TAIL;

const LC_TONE: Record<Tone, { c: string; bg: string; bd: string }> = {
  ok: { c: OK, bg: hexA(OK, 0.12), bd: hexA(OK, 0.35) },
  bad: { c: BAD, bg: hexA(BAD, 0.12), bd: hexA(BAD, 0.4) },
  accent: { c: ACCENT, bg: hexA(ACCENT, 0.1), bd: hexA(ACCENT, 0.35) },
  muted: { c: "rgba(255,255,255,.6)", bg: "rgba(255,255,255,.05)", bd: "rgba(255,255,255,.16)" },
};

export function MessageLifecycle() {
  const { ref, run, reduced, hoverProps } = useLive();
  const [c, setC] = useState(0);
  const [ms, setMs] = useState(0);
  const sc = LC[c];
  const dur = lcDur(sc);
  const t = reduced ? dur : ms;



  const over = ms >= dur;
  useEffect(() => {
    if (!run) return;
    if (over) {
      // section finished: roll into the next one, and stop after the last
      if (c >= LC.length - 1) return;
      const tid = window.setTimeout(() => { setC(c + 1); setMs(0); }, 250);
      return () => window.clearTimeout(tid);
    }
    const id = window.setInterval(() => setMs((m) => Math.min(dur, m + LC_TICK)), LC_TICK);
    return () => window.clearInterval(id);
  }, [run, over, dur, c]);



  const pick = (i: number) => { setC(i); setMs(0); };

  const shown = sc.items.filter((_, i) => t >= lcStart(i));
  const stage = shown.length ? shown[shown.length - 1].stage : sc.from;
  const sStart = sc.items.length * LC_STEP + 500;
  const typed = sc.stream ? sc.stream.slice(0, Math.max(0, Math.floor((t - sStart) / 14))) : "";
  const stageNums = Array.from({ length: sc.to - sc.from + 1 }, (_, k) => sc.from + k);

  return (
    <figure className="qpe-cw mt-7">
      <div ref={ref} {...hoverProps} className="overflow-hidden rounded-2xl border border-white/[0.14] bg-[#0b0b0c]">
        <div className="qpe-lc">
          <div role="tablist" aria-label="Lifecycle sections" aria-orientation="vertical" className="qpe-lc-l">
            {LC.map((s, i) => {
              const on = i === c;
              return (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => pick(i)}
                  className={`relative flex w-full items-start gap-4 border-b border-white/10 px-5 py-6 text-left transition-colors last:border-b-0 sm:px-7 ${on ? "bg-white/[0.045]" : "hover:bg-white/[0.02]"} ${FOCUS}`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-lg border transition-colors ${on ? "border-white/25 bg-white/[0.09] text-white" : "border-white/[0.12] text-white/50"}`}>
                    <Icon n={s.icon} className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="qpe-mono block text-[13px] text-white/40">0{i + 1} · stages {s.from}{s.to > s.from ? `–${s.to}` : ""}</span>
                    <span className={`mt-1 block text-[21px] font-medium leading-snug tracking-[-0.01em] transition-colors ${on ? "text-white" : "text-white/60"}`}>{s.title}</span>
                    <span className={`mt-2 block text-[16px] leading-[1.6] transition-colors ${on ? "text-white/70" : "text-white/45"}`}>{s.blurb}</span>
                  </span>
                  {on && !reduced && (
                    <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[3px] bg-white/10">
                      <span className="block w-full" style={{ height: `${Math.min(100, (ms / dur) * 100)}%`, background: ACCENT, transition: `height ${LC_TICK}ms linear` }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" aria-label={sc.title} className="relative flex min-h-[520px] flex-col justify-center px-5 py-14 sm:px-10">
            

            <div key={c} className="mx-auto w-full max-w-[410px]">
              <div className="qpe-rise flex items-center gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-white/[0.14] bg-[#111113] text-white/85"><Icon n={sc.head.icon} className="size-6" /></span>
                <div className="min-w-0">
                  <p className="text-[18.5px] font-medium leading-tight text-white">{sc.head.title}</p>
                  <p className="mt-0.5 text-[15.5px] text-white/50">{sc.head.sub}</p>
                </div>
              </div>

              <ul className="mt-5 space-y-2.5">
                {sc.items.map((it, i) => {
                  if (t < lcStart(i)) return null;
                  const done = t >= lcStart(i) + 300;
                  const tn = LC_TONE[it.tone];
                  return (
                    <li key={`${c}-${i}`} className="qpe-rise flex items-center gap-3 rounded-2xl border bg-[#111113] px-3.5 py-2.5 transition-colors duration-300" style={{ borderColor: done && it.tone === "bad" ? hexA(BAD, 0.4) : "rgba(255,255,255,.12)" }}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/80"><Icon n={it.icon} className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15.5px] text-white">{it.label}</span>
                        <span className="qpe-mono block truncate text-[13px] text-white/45">{it.sub}</span>
                      </span>
                      {done ? (
                        <span className="qpe-pop qpe-mono inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[13px]" style={{ color: tn.c, background: tn.bg, borderColor: tn.bd }}>
                          {(it.tone === "ok" || it.tone === "bad") && <Glyph kind={it.tone} s={12} />}{it.tag}
                        </span>
                      ) : <span className="shrink-0 pr-1"><Glyph kind="run" s={15} /></span>}
                    </li>
                  );
                })}
              </ul>

              {sc.stream && t >= sStart && (
                <div className="qpe-rise mt-4 rounded-2xl border border-white/[0.12] bg-[#111113] px-4 py-3.5">
                  <p className="qpe-mono text-[12.5px] uppercase tracking-[0.08em] text-white/40">Assistant</p>
                  <p className="mt-1.5 min-h-[1.6em] text-[16px] leading-[1.6] text-white/90">
                    {typed}
                    {typed.length < sc.stream.length && <span aria-hidden="true" className="qpe-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-white/70" />}
                  </p>
                </div>
              )}

              <ol aria-label="Stages in this section" className="mt-7 flex flex-wrap gap-1.5">
                {stageNums.map((n) => {
                  const cur = n === stage;
                  const reached = n <= stage && shown.length > 0;
                  return (
                    <li
                      key={n}
                      className="qpe-mono rounded-md border px-2 py-1 text-[13px] transition-colors duration-300"
                      style={cur ? { borderColor: ACCENT, background: hexA(ACCENT, 0.1), color: "#fff" } : reached ? { borderColor: "rgba(255,255,255,.35)", color: "rgba(255,255,255,.85)" } : { borderColor: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.4)" }}
                    >
                      <span className="mr-1.5 text-white/45">{String(n).padStart(2, "0")}</span>{LC_STAGES[n - 1]}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-5 py-2.5 text-[13.5px] text-white/45">
          <span className="qpe-mono">13 stages · 4 sections</span>
          <span>Select a section to replay it.</span>
        </div>
      </div>
    </figure>
  );
}

/* ------------------------------------- hub ------------------------------------- */

/** The hero's code panel: one real request, the events it produces, and the SQL one of the paths ends in. */
const HERO_CODE: CodeTab[] = [
  { label: "Request", file: "POST /api/chat/messages/stream/", code: `POST /api/chat/messages/stream/
Authorization: Bearer <access token>
Accept: text/event-stream

{
  "conversation_id": 7,
  "message": "How many orders were delivered?"
}` },
  { label: "Stream", file: "event names as emitted", code: `event: query_received
event: conversation_loaded
event: agent_started
event: planning
event: generating_answer
event: answer_delta
data: {"message": "42 orders were"}

event: complete` },
  { label: "SQL", file: "illustrative, not a fixed output", code: `SELECT COUNT(*) AS delivered_orders
FROM selected_orders
WHERE Status = %s;

-- params, bound separately: ["Delivered"]
-- runs on structured_read, validated first, 100-row cap` },
];

export function Hub({ groups, items }: { groups: Group[]; items: HubItem[] }) {
  const [pi, setPi] = useState(0);
  const path = READ_PATHS[pi];
  const pathItems = path.pages.map((id) => items.find((x) => x.id === id)).filter((x): x is HubItem => Boolean(x));
  const gname = (id: string) => groups.find((g) => g.id === id)?.name ?? "";

  return (
    <div>
      <section aria-label="QueryPilot engineering documentation" className="grid gap-9 pb-10 pt-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[1100px]:items-center">
        <div>
          <p className="qpe-mono text-[13px] uppercase tracking-[0.14em] text-white/45">QueryPilot<span aria-hidden="true" className="mx-2.5 text-white/20">/</span>Engineering</p>
          <h1 className="mt-5 max-w-[15ch] text-[clamp(38px,4.8vw,64px)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">How QueryPilot answers <span className="text-white/40">from your files.</span></h1>
          <p className="mt-6 max-w-[32rem] text-[18px] leading-[1.65] text-white/65">A plain RAG pipeline finds text that looks similar to the question. QueryPilot finds the rule in one file and the record in another, then works out the answer from both. This is how it does that, written from the code.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <PixelDissolveButton label="Start here" href={to("quick-start")} color="#ffffff" textColor={PD_COLORS.whiteText} dissolveColor={PD_COLORS.whiteFx} cellSize={5} className={PD_LG} />
            <Link href={to("product-architecture")} scroll={false} className={`rounded-sm text-[15.5px] text-white/75 underline decoration-white/25 underline-offset-[5px] transition-colors hover:text-white hover:decoration-white ${FOCUS}`}>Architecture</Link>
            <Link href={to("api-reference")} scroll={false} className={`rounded-sm text-[15.5px] text-white/75 underline decoration-white/25 underline-offset-[5px] transition-colors hover:text-white hover:decoration-white ${FOCUS}`}>API reference</Link>
          </div>
        </div>
        <div className="min-w-0"><CodePanel tabs={HERO_CODE} /></div>
      </section>

      <dl className="grid grid-cols-2 border-y border-white/10 md:grid-cols-5 [&>div:nth-child(n+3)]:max-md:border-t [&>div]:border-white/10 md:[&>div:not(:first-child)]:border-l [&>div:nth-child(even)]:max-md:border-l">
        {HUB_FACTS.map((f) => (
          <div key={f.k + f.v} className="px-4 py-4 max-md:last:col-span-2">
            <dt className="flex items-baseline gap-2"><span className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-white">{f.k}</span><span className="text-[14.5px] text-white/70">{f.v}</span></dt>
            <dd className="mt-1.5 text-[14px] leading-[1.45] text-white/45">{f.sub}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Reading paths" className="mt-14">
        <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-white">Pick a path</h2>
        <p className="mt-2 max-w-[40rem] text-[16.5px] leading-[1.65] text-white/60">Pages are independent. Choose what you are here to do and the pages line up in reading order. The same order is numbered in the section index below.</p>
        <div className="mt-6 grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          <div role="radiogroup" aria-label="Reading path" className="flex flex-col gap-1.5">
            {READ_PATHS.map((r, k) => (
              <button key={r.label} type="button" role="radio" aria-checked={k === pi} onClick={() => setPi(k)} className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${k === pi ? "border-white/40 bg-white/[0.05]" : "border-white/10 hover:border-white/30"} ${FOCUS}`}>
                <span className={`block text-[15.5px] font-medium ${k === pi ? "text-white" : "text-white/75"}`}>{r.label}</span>
                <span className="mt-0.5 block text-[14px] leading-[1.5] text-white/45">{r.blurb}</span>
              </button>
            ))}
          </div>
          <ol className="divide-y divide-white/[0.07] self-start overflow-hidden rounded-xl border border-white/[0.12]">
            {pathItems.map((p, k) => (
              <li key={p.id}>
                <Link href={to(p.id)} scroll={false} className={`group grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] ${FOCUS}`}>
                  <span className="qpe-mono text-[13.5px] text-white/40">{String(k + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium text-white">{p.title}</span>
                    <span className="mt-0.5 line-clamp-1 block text-[14.5px] text-white/50">{p.lead}</span>
                  </span>
                  <span className="hidden items-center gap-2 text-[13.5px] text-white/45 sm:flex"><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: hue(p.group) }} />{gname(p.group)}<Icon n="arrow" className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Message lifecycle" className="mt-16 border-t border-white/10 pt-12">
        <p className="qpe-mono text-[13.5px] uppercase tracking-[0.08em] text-white/45">13 stages in 4 sections</p>
        <h2 className="mt-2.5 text-[clamp(22px,2.4vw,28px)] font-semibold leading-[1.15] tracking-[-0.025em] text-white">End-to-end message lifecycle</h2>
        <p className="mt-3 max-w-[40rem] text-[16.5px] leading-[1.65] text-white/60">What happens between pressing Send and the last streamed token: who is asking, what they may see, what the question needs, what evidence answers it, and how the answer reaches the browser.</p>
        <div className="qpx-wrap qpx-up"><MessageLifecycle /></div>
      </section>

      <div className="qpx-wrap qpx-up"><PathTrace /></div>

      <section className="mt-16 border-t border-white/10 pt-12">
        <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-white">Section index</h2>
        <p className="mt-2 max-w-[40rem] text-[16.5px] leading-[1.65] text-white/60">Every page, grouped the way the sidebar groups them. Pages on the selected path are numbered.</p>
        <ul className="mt-6 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const pages = items.filter((x) => x.group === g.id);
            if (!pages.length) return null;
            return (
              <li key={g.id} className="rounded-xl border border-white/[0.12] p-5" style={{ borderTopColor: hue(g.id), borderTopWidth: 2 }}>
                <div className="flex items-baseline justify-between"><h3 className="text-[17px] font-semibold text-white"><span className="qpe-mono mr-2 text-[13.5px] font-normal" style={{ color: hue(g.id) }}>{g.num}</span>{g.name}</h3><span className="qpe-mono text-[13.5px] text-white/40">{pages.length}</span></div>
                <p className="mt-1.5 text-[15px] leading-[1.55] text-white/55">{g.blurb}</p>
                <ul className="mt-3 border-t border-white/10 pt-2">
                  {pages.map((p) => {
                    const step = path.pages.indexOf(p.id);
                    return (
                      <li key={p.id}>
                        <Link href={to(p.id)} scroll={false} className={`flex items-center gap-3 py-1.5 text-[15.5px] transition-colors hover:text-white ${step >= 0 ? "text-white" : "text-white/65"} ${FOCUS}`}>
                          {step >= 0 ? <span aria-hidden="true" className="qpe-mono grid size-[18px] shrink-0 place-items-center rounded-full bg-white text-[12px] font-medium text-[#0A0A0A]">{step + 1}</span> : <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-white/30" />}
                          <span className="min-w-0 truncate">{p.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export function PageNav({ prev, next }: { prev?: HubItem; next?: HubItem; groups?: Group[] }) {
  const card = (p: HubItem, dir: string) => (
    <li key={p.id}>
      <Link href={to(p.id)} scroll={false} aria-label={`${dir} page: ${p.title}`} className={`group block ${FOCUS}`}>
        <Stage kind={kindOf(p.id)} className="aspect-[2.1/1]">
          <div className="absolute inset-x-[8%] top-[16%] rounded-[10px] border border-white/10 bg-[#0B0B0C] px-4 py-3.5">
            <p className="qpe-mono text-[12px] uppercase tracking-[0.08em] text-white/45">{dir}</p>
            <p className="mt-1.5 text-[17px] font-medium text-white">{p.title}</p>
          </div>
        </Stage>
        <span className="mt-4 line-clamp-2 block text-[15.5px] leading-[1.6] text-white/45">{p.lead}</span>
      </Link>
    </li>
  );
  return (
    <nav aria-label="Neighbouring pages" className="mt-14 border-t border-white/10 pt-8">
      <h2 className="text-[24px] font-medium tracking-[-0.01em] text-white">Read more</h2>
      <ul className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {prev && card(prev, "Previous")}
        {next && card(next, "Next")}
      </ul>
    </nav>
  );
}

/* ===================== /engineering home ===================== */
/* ============================================================================
 * Home of /engineering. Replaces the old Hub and the Quick start chapter.
 * Layout follows the Exa docs: title row, image banner, Examples card, then cards.
 * Put the refined image at  public/engineering-banner.webp
 * ========================================================================== */



interface Ex { label: string; to: string; cta: string; tabs: CodeTab[] }

const EXAMPLES: Ex[] = [
  {
    label: "Ask a question", to: "api-reference", cta: "Open the API reference",
    tabs: [
      { label: "Request", file: "POST /api/chat/messages/stream/", code: `POST /api/chat/messages/stream/
Authorization: Bearer <access token>
Accept: text/event-stream

{
  "conversation_id": 7,
  "message": "How many orders were delivered?"
}` },
      { label: "Stream", file: "event names as emitted", code: `event: query_received
event: conversation_loaded
event: agent_started
event: planning
event: generating_answer
event: answer_delta
data: {"message": "42 orders were"}

event: complete` },
    ],
  },
  {
    label: "Count with SQL", to: "structured-sql", cta: "How SQL is checked",
    tabs: [
      { label: "SQL", file: "illustrative, not a fixed output", code: `SELECT COUNT(*) AS delivered_orders
FROM selected_orders
WHERE Status = %s;

-- runs on structured_read, validated first, 100-row cap` },
      { label: "Params", file: "bound separately", code: `["Delivered"]` },
    ],
  },
  {
    label: "A rule and a record", to: "planner", cta: "How the planner splits a question",
    tabs: [
      { label: "Requirements", plain: true, file: "illustrative", code: `R1  kind=text    type=rule      the tax slabs and their rates
R2  kind=table   type=numeric   Rahul's annual salary
R3  kind=either  type=other     tax payable on R2 under R1
    depends_on: R1, R2` },
      { label: "Slab passage", plain: true, file: "tax_slabs.pdf, p.2 (made-up numbers)", code: `Tax is charged slab by slab.
Up to 3,00,000         nil
3,00,001 to 7,00,000   5%
7,00,001 to 10,00,000  10%
10,00,001 to 15,00,000 15%` },
      { label: "Salary SQL", file: "illustrative, not a fixed output", code: `SELECT CAST(Annual_Salary AS DECIMAL(14,2)) AS annual_salary
FROM selected_salaries
WHERE Name = %s;

-- params, bound separately: ["Rahul"]` },
    ],
  },
  {
    label: "Evidence to answer", to: "evidence-and-answers", cta: "How evidence is assembled",
    tabs: [
      { label: "Evidence", plain: true, file: "shape", code: `R1  1 chunk   tax_slabs.pdf, p.2
R2  1 row     salaries.xlsx, Rahul: 12,00,000
R3  needs R1 and R2
missing: none` },
      { label: "Answer", plain: true, file: "made-up numbers", code: `12,00,000 is taxed slab by slab
  first 3,00,000          nil           0
  next  4,00,000 at 5%               20,000
  next  3,00,000 at 10%              30,000
  last  2,00,000 at 15%              30,000
Tax payable: 80,000` },
    ],
  },
  {
    label: "Block a guessed id", to: "security-model", cta: "Read the security model",
    tabs: [
      { label: "Ownership", file: "simplified sketch", code: `def get_owned_conversation(user, conversation_id):
    # a guessed id raises DoesNotExist, never leaks a row
    return Conversation.objects.get(
        id=conversation_id, created_by=user)` },
      { label: "Response", plain: true, file: "what the caller sees", code: `404  Conversation not found
# same answer for "not yours" and "does not exist"` },
    ],
  },
  {
    label: "Run the two processes", to: "docker-and-delivery", cta: "Docker and delivery",
    tabs: [
      { label: "Processes", term: true, file: "Terminal", code: `# API: ASGI server
uvicorn config.asgi:application

# worker: same image, different command
python manage.py ingestion_worker` },
    ],
  },
];

/* ------------------------------ read more cards ------------------------------ */

function Thumb({ kind, children }: { kind: StageKind; children: ReactNode }) {
  return <Stage kind={kind} className="aspect-[2.1/1] min-h-[190px]">{children}</Stage>;
}

function Mini({ rows }: { rows: [string, string][] }) {
  return (
    <div className="absolute inset-x-[8%] top-[14%] rounded-[10px] border border-white/10 bg-[#0B0B0C] px-3 py-2 text-white">
      {rows.map(([l, r]) => (
        <div key={l} className="flex items-center justify-between gap-3 py-[7px] text-[12.5px]">
          <span className="min-w-0 truncate">{l}</span>
          <span className="qpe-mono shrink-0 text-[11px] text-white/45">{r}</span>
        </div>
      ))}
    </div>
  );
}

const HOME_CARDS: { id: string; title: string; text: string; thumb: ReactNode }[] = [
  {
    id: "scope-guard", title: "Scope Guard", text: "Rules first, a classifier second. The model is never the access rule.",
    thumb: <Mini rows={[["Hi", "CHITCHAT"], ["Refund window after cancelling?", "DOCUMENT"], ["How many orders were delivered?", "DOCUMENT"], ["What's the weather today?", "OUT"]]} />,
  },
  {
    id: "structured-sql", title: "Table selection and SQL", text: "Three steps and two locks. Generated SQL is untrusted input.",
    thumb: (
      <div className="qpe-mono absolute inset-x-[8%] top-[14%] whitespace-pre rounded-[10px] border border-white/10 bg-[#0B0B0C] p-3.5 text-[11.5px] leading-[1.7] text-white/85">{`SELECT COUNT(*) AS delivered
FROM selected_orders
WHERE Status = %s;
-- params: ["Delivered"]
-- structured_read, 100-row cap`}</div>
    ),
  },
  {
    id: "retrieval", title: "Retrieval", text: "Dense search and BM25, merged by rank into five pieces of evidence.",
    thumb: <Mini rows={[["Dense search", "top 20"], ["BM25", "top 20"], ["Reciprocal Rank Fusion", "k = 60"], ["Evidence", "top 5"]]} />,
  },
  {
    id: "document-ingestion-pipeline", title: "Document ingestion", text: "Upload returns fast. A worker parses, chunks, embeds and recovers from crashes.",
    thumb: <Mini rows={[["job 101", "completed"], ["job 102", "retry, attempt 2"], ["job 103", "processing"], ["job 104", "pending"]]} />,
  },
];

/* ----------------------------------- home ----------------------------------- */

export function Home({ startHref }: { startHref: string }) {
  const [i, setI] = useState(0);
  const ex = EXAMPLES[i];

  return (
    <div className="qpe-cw">
      <section className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[32px] font-medium leading-[1.15] tracking-[-0.02em] text-white">How QueryPilot answers from your files</h1>
          <p className="mt-3 max-w-[640px] text-[16px] leading-[1.7] text-white/55">A plain RAG pipeline finds text that looks similar to the question. QueryPilot finds the rule in one file and the record in another, then works out the answer from both. Everything here is written from the code.</p>
        </div>
        <p className="rounded-lg border border-white/10 px-4 py-2.5 text-[14.5px] text-white/60">
          Looking for routes? Read the <Link href={to("api-reference")} scroll={false} className={`text-white underline underline-offset-[3px] ${FOCUS}`}>API reference</Link>
        </p>
      </section>

      <Stage kind="planner" className="mt-8 p-4 sm:p-6">
        <div className="relative flex flex-wrap items-center justify-between gap-5 rounded-[10px] border border-white/10 bg-[#0B0B0C] px-6 py-6 sm:px-8">
          <div>
            <h2 className="text-[24px] font-medium tracking-[-0.01em] text-white">Ask your files a question</h2>
            <p className="mt-1 text-[15px] text-white/60">Upload a PDF or a sheet and get a grounded answer in under a minute</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PixelDissolveButton label="Get started" href={startHref} color="#ffffff" textColor={PD_COLORS.whiteText} dissolveColor={PD_COLORS.whiteFx} cellSize={5} className={PD_LG} />
            <PixelDissolveButton label="Architecture" href={to("product-architecture")} color="transparent" textColor={PD_COLORS.ghostText} dissolveColor={PD_COLORS.ghostFx} cellSize={5} className={`${PD_LG} ${PD_GHOST}`} />
          </div>
        </div>
      </Stage>

      <section aria-label="Examples" className="qpe-ex mt-8 grid gap-5 rounded-[10px] border border-white/[0.12] p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="px-3 pb-3 text-[22px] font-medium tracking-[-0.01em] text-white">Examples</h2>
          <div role="tablist" aria-label="Examples" className="qpe-ex-tabs qpe-scroll flex gap-1 overflow-x-auto">
            {EXAMPLES.map((x, k) => (
              <button
                key={x.label}
                type="button"
                role="tab"
                aria-selected={k === i}
                onClick={() => setI(k)}
                className={`shrink-0 rounded-lg px-3 py-3 text-left text-[15.5px] transition-colors ${k === i ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white"} ${FOCUS}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <CodePanel key={i} tabs={ex.tabs} />
          <div className="mt-3 flex justify-end">
            <Link href={to(ex.to)} scroll={false} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[14px] font-medium text-white/70 transition-colors hover:text-white ${FOCUS}`}>
              {ex.cta}<Icon n="arrow" className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Message lifecycle" className="mt-16">
        <h2 className="text-[24px] font-medium tracking-[-0.01em] text-white">End-to-end message lifecycle</h2>
        <p className="mt-2 max-w-[640px] text-[16px] leading-[1.7] text-white/55">What happens between pressing Send and the last streamed token: who is asking, what they may see, what the question needs, what evidence answers it, and how the answer reaches the browser.</p>
        <MessageLifecycle />
      </section>

      <section aria-label="Read more" className="mt-16">
        <h2 className="text-[24px] font-medium tracking-[-0.01em] text-white">Read more</h2>
        <ul className="mt-6 grid gap-x-8 gap-y-12 sm:grid-cols-2">
          {HOME_CARDS.map((c) => (
            <li key={c.id}>
              <Link href={to(c.id)} scroll={false} className={`group block ${FOCUS}`}>
                <Thumb kind={kindOf(c.id)}>{c.thumb}</Thumb>
                <span className="mt-5 block text-[20px] text-white/70 transition-colors group-hover:text-white">{c.title}</span>
                <span className="mt-2 block text-[15.5px] leading-[1.6] text-white/40">{c.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ===================== stages: CSS backgrounds, no images ===================== */
/* ===================== stages: CSS backgrounds, no images ===================== */
/*
 * Each stage is data: a background plus a few flat layers (dots, lines, rings, discs, squares).
 * No glow, no noise, no images. To add one, add an entry to DEFS and (optionally) pin a page to it in STAGE_OF.
 */

type Layer = { k: "el"; cls: string; style?: CSSProperties } | { k: "bin" };
interface StageDef { bg: string; layers: Layer[] }

const halftone = (color: string, dir = "to left", size = 7): CSSProperties => {
  const mask = `linear-gradient(${dir}, #000 0%, transparent 72%)`;
  return { backgroundImage: `radial-gradient(circle, ${color} 1.1px, transparent 1.6px)`, backgroundSize: `${size}px ${size}px`, WebkitMaskImage: mask, maskImage: mask };
};
const BINARY = Array.from({ length: 700 }, (_, i) => ((i * 7 + 3) % 5 < 2 ? "1" : "0")).join(" ");

const FULL = "absolute inset-0";
const el = (cls: string, style?: CSSProperties): Layer => ({ k: "el", cls, style });
const dots = (color: string, dir = "to left", size = 7) => el(FULL, halftone(color, dir, size));
const stripes = (color: string, angle = 135, gap = 10, w = 1) => el(FULL, { backgroundImage: `repeating-linear-gradient(${angle}deg, ${color} 0 ${w}px, transparent ${w}px ${gap}px)` });
const grid = (color: string, size = 22) => el(FULL, { backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: `${size}px ${size}px` });
const rings = (color: string, at = "85% 20%", gap = 14) => el(FULL, { backgroundImage: `repeating-radial-gradient(circle at ${at}, ${color} 0 1px, transparent 1px ${gap}px)` });
const orb = (color: string, cls: string) => el(`absolute block rounded-full blur-2xl ${cls}`, { background: color });
const disc = (color: string, cls: string) => el(`absolute block rounded-full ${cls}`, { background: color });
const sq = (color: string, cls: string) => el(`absolute block ${cls}`, { background: color });

const DEFS = {
  /* ---- the original six ---- */
  planner: { bg: "#DEDAD0", layers: [dots("rgba(0,0,0,.55)", "to right"), sq("#2B8CFF", "right-[8%] top-[12%] aspect-square h-[30%]"), sq("#2B8CFF", "right-[26%] bottom-[10%] aspect-square h-[16%]")] },
  ingestion: { bg: "linear-gradient(180deg, #0A3A9E 0%, #3F5BCB 45%, #A9A7F2 100%)", layers: [orb("rgba(47,107,255,.7)", "left-[10%] top-[6%] aspect-square h-[70%]"), dots("rgba(255,255,255,.7)", "to top")] },
  memory: { bg: "#E9E9E9", layers: [stripes("rgba(0,0,0,.07)", 0, 3), el("absolute inset-x-0 top-[36%] block h-[24%] bg-white/50 blur-[2px]")] },
  streaming: { bg: "#D3D9E2", layers: [{ k: "bin" }, dots("rgba(0,0,0,.5)", "to right"), sq("#FFB02B", "right-[8%] top-[14%] aspect-square h-[26%]"), sq("#FFB02B", "right-[22%] bottom-[12%] aspect-square h-[14%]")] },
  sheets: { bg: "linear-gradient(180deg, #2A1712 0%, #6B3426 38%, #C28A4A 80%, #E3B466 100%)", layers: [orb("rgba(255,138,43,.7)", "right-[8%] top-[8%] aspect-square h-[70%]"), dots("rgba(0,0,0,.35)", "to top")] },
  isolation: { bg: "#D9DBE8", layers: [dots("rgba(0,0,0,.5)", "to right"), sq("#5865D4", "right-[8%] top-[12%] aspect-square h-[30%]"), sq("#5865D4", "right-[26%] bottom-[10%] aspect-square h-[16%]")] },

  /* ---- new: light, flat ---- */
  rings: { bg: "#E6E1D6", layers: [rings("rgba(0,0,0,.14)", "88% 30%", 13), disc("#FF5A36", "right-[10%] top-[18%] aspect-square h-[26%]")] },
  grid: { bg: "#E4E8E1", layers: [grid("rgba(0,0,0,.08)", 22), sq("#1F7A5C", "right-[9%] top-[14%] aspect-square h-[22%]"), sq("#1F7A5C", "right-[30%] bottom-[12%] aspect-square h-[12%]")] },
  paper: { bg: "#EFEAE0", layers: [stripes("rgba(0,0,0,.09)", 0, 14), sq("#E5484D", "right-[7%] top-[10%] h-[34%] w-[8%]"), sq("#E5484D", "right-[19%] bottom-[10%] h-[14%] w-[8%]")] },
  lilac: { bg: "#DCD3F0", layers: [stripes("rgba(60,40,140,.14)", 135, 12), disc("#6C4DE0", "right-[8%] top-[12%] aspect-square h-[34%]")] },
  mint: { bg: "#CFE3D8", layers: [dots("rgba(10,70,45,.55)", "to right"), sq("#0F9D6B", "right-[8%] bottom-[14%] aspect-square h-[28%]"), sq("#0F9D6B", "right-[30%] top-[12%] aspect-square h-[12%]")] },
  cyan: { bg: "#CDEBF2", layers: [grid("rgba(14,127,166,.14)", 14), sq("#0E7FA6", "right-[8%] top-[12%] aspect-square h-[26%]"), disc("#0E7FA6", "right-[26%] bottom-[10%] aspect-square h-[14%]")] },
  mono: { bg: "#F1F1F1", layers: [stripes("rgba(0,0,0,.08)", 90, 18, 9), sq("#0A0A0A", "right-[8%] top-[12%] aspect-square h-[30%]")] },
  steel: { bg: "#D5DAE0", layers: [stripes("rgba(0,0,0,.08)", 45, 9), stripes("rgba(0,0,0,.08)", 135, 9), sq("#0F8B8D", "right-[8%] bottom-[12%] aspect-square h-[26%]"), sq("#0F8B8D", "right-[24%] top-[12%] aspect-square h-[12%]")] },
  sand: { bg: "linear-gradient(180deg, #EFE5CF 0%, #D9BE8E 100%)", layers: [dots("rgba(90,55,20,.55)", "to top"), disc("#3A2412", "right-[9%] top-[14%] aspect-square h-[28%]")] },
  peach: { bg: "linear-gradient(180deg, #FFE6D6 0%, #FFB394 100%)", layers: [dots("rgba(80,20,0,.45)", "to right"), disc("#FF4D2E", "right-[8%] top-[10%] aspect-square h-[34%]"), sq("#FF4D2E", "right-[30%] bottom-[10%] aspect-square h-[12%]")] },

  /* ---- new: dark gradients ---- */
  bands: { bg: "#151A2E", layers: [stripes("rgba(255,255,255,.07)", 135, 11), sq("#C6F24E", "right-[8%] top-[12%] aspect-square h-[26%]"), sq("#C6F24E", "right-[24%] bottom-[12%] aspect-square h-[12%]")] },
  dusk: { bg: "linear-gradient(180deg, #1B1038 0%, #6A2C6E 42%, #E8685A 80%, #F6B27A 100%)", layers: [dots("rgba(255,255,255,.55)", "to top"), disc("#FFD9A0", "right-[10%] top-[14%] aspect-square h-[30%]")] },
  ocean: { bg: "linear-gradient(180deg, #04222F 0%, #0B5C73 55%, #7CC6C9 100%)", layers: [rings("rgba(255,255,255,.2)", "92% 110%", 16), dots("rgba(255,255,255,.4)", "to top")] },
  slate: { bg: "#2B2F38", layers: [el(FULL, { backgroundImage: "radial-gradient(circle, rgba(255,255,255,.22) 1px, transparent 1.4px)", backgroundSize: "14px 14px" }), sq("#FF7A1A", "right-[8%] top-[12%] aspect-square h-[28%]"), sq("#FF7A1A", "right-[28%] bottom-[12%] aspect-square h-[12%]")] },
  crimson: { bg: "linear-gradient(180deg, #2A0A12 0%, #7A1E2E 55%, #E0675A 100%)", layers: [orb("rgba(255,120,90,.5)", "right-[6%] top-[6%] aspect-square h-[62%]"), dots("rgba(255,255,255,.45)", "to top")] },
  forest: { bg: "linear-gradient(180deg, #0B2A1E 0%, #1F6B4A 55%, #9AD3A6 100%)", layers: [orb("rgba(154,211,166,.45)", "left-[8%] top-[8%] aspect-square h-[60%]"), dots("rgba(255,255,255,.5)", "to top")] },
  indigo: { bg: "linear-gradient(180deg, #1C1F5E 0%, #4A4FD6 100%)", layers: [rings("rgba(255,255,255,.2)", "14% 120%", 15), disc("rgba(255,255,255,.9)", "right-[9%] top-[14%] aspect-square h-[18%]")] },
  gold: { bg: "linear-gradient(180deg, #1A1405 0%, #8A6A12 55%, #F2CF66 100%)", layers: [stripes("rgba(0,0,0,.22)", 0, 8, 2), disc("#F2CF66", "right-[9%] top-[12%] aspect-square h-[28%]")] },
} satisfies Record<string, StageDef>;

export type StageKind = keyof typeof DEFS;
const STAGE_KINDS = Object.keys(DEFS) as StageKind[];

/** Known pages each get their own stage, so no two neighbouring pages look alike. */
const STAGE_OF: Record<string, StageKind> = {
  "quick-start": "planner",
  "product-architecture": "grid",
  "scope-guard": "rings",
  "planner": "paper",
  "structured-sql": "dusk",
  "execution-graph": "bands",
  "retrieval": "mint",
  "evidence-and-answers": "lilac",
  "database-architecture-consistency": "ocean",
  "workspaces": "sand",
  "document-ingestion-pipeline": "ingestion",
  "structured-data": "sheets",
  "api-reference": "mono",
  "limits-and-defaults": "cyan",
  "configuration": "steel",
  "security-model": "isolation",
  "authentication-token-lifecycle": "indigo",
  "deployment-stories": "forest",
  "known-gaps": "crimson",
  "docker-and-delivery": "slate",
};

/** The same page always gets the same stage. Pages not listed above fall back to a hash. */
export function kindOf(id: string): StageKind {
  if (STAGE_OF[id]) return STAGE_OF[id];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STAGE_KINDS[h % STAGE_KINDS.length];
}

function Deco({ kind }: { kind: StageKind }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {DEFS[kind].layers.map((l, i) =>
        l.k === "bin"
          ? <div key={i} className="qpe-mono absolute inset-0 select-none overflow-hidden break-all text-[10px] leading-[1.6] text-black/20">{BINARY}</div>
          : <i key={i} className={l.cls} style={l.style} />
      )}
    </div>
  );
}

/** Coloured stage. Put a black panel (rounded-[10px] border border-white/10 bg-[#0B0B0C]) inside it. */
export function Stage({ kind, className = "", children }: { kind: StageKind; className?: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-[14px] border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.45)] ${className}`} style={{ background: DEFS[kind].bg }}>
      <Deco kind={kind} />
      {children}
    </div>
  );
}

export function ChapterBanner({ id, group, meta, sections }: { id: string; group: string; meta: string; sections: { h: string; id: string }[] }) {
  return (
    <Stage kind={kindOf(id)} className="mt-7 p-4 sm:p-5">
      <div className="relative rounded-[10px] border border-white/10 bg-[#0B0B0C] px-5 py-5 sm:px-6">
        <p className="qpe-mono text-[13px] uppercase tracking-[0.08em] text-white/45">{group}</p>
        <p className="qpe-mono mt-1.5 text-[14px] text-white/60">{meta}</p>
        {sections.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`rounded-md border border-white/15 px-2.5 py-1 text-[14px] text-white/70 transition-colors hover:border-white/45 hover:text-white ${FOCUS}`}>{s.h}</a>
            ))}
          </div>
        )}
      </div>
    </Stage>
  );
}