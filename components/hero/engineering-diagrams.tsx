"use client";

import type { CSSProperties, PointerEvent as RPointerEvent, KeyboardEvent as RKeyEvent, MouseEvent as RMouseEvent, ReactNode, Ref, SVGProps } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { N, Spec } from "./engineering-explorer";

/* ============================================================================
 * Diagram renderers for /engineering. Same `Spec` data as the old Explorer (boxes, zones, wires, spots),
 * three drawing styles:
 *
 *   hotspot  Dark canvas, flat cards, small square markers. A card with a looping mini animation follows the
 *            active marker and cycles on its own. Hover or click a marker to hold it.
 *   layered  Zones as soft panels with a label chip, icon cards, accent wires with label pills.
 *   sketch   Whiteboard style: banded zones, wobbly strokes, handwritten text, rotated wire labels.
 *
 * Colours are the docs palette (ACCENT, OK, BAD, HOT mirror engineering-explorer). Which diagram uses which style
 * is the KIND table near the bottom. This file only imports TYPES from engineering-explorer, so there is no cycle.
 * ========================================================================== */

const ACCENT = "#8b93ff";
const BG = "#0b0b0c";
const DOTS = "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)";

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fit = (txt: string, w: number, lo: number, hi: number, k = 0.58) => clamp(w / Math.max(1, txt.length * k), lo, hi);

/* ---------------------------------- icons ---------------------------------- */

const IC: Record<string, string> = {
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  layers: "M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  terminal: "M4 5h16v14H4zM7.5 10l3 2-3 2M12.5 15h4",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  cloud: "M7 18a4 4 0 01-.5-8A6 6 0 0118 9.5 4.3 4.3 0 0117.5 18H7z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  check: "M12 3a9 9 0 100 18 9 9 0 000-18zM8 12.5l3 3 5-6",
  lock: "M7 11V8a5 5 0 0110 0v3M5 11h14v9H5zM12 15v2",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
};

/** Picks an icon from what a box is called. Only used by the layered style and zone headers. */
function iconFor(label: string, sub = ""): string {
  const s = `${label} ${sub}`.toLowerCase();
  if (/planner|classifier|model|answer|agent|dispatch|finish|llm|gpt/.test(s)) return IC.spark;
  if (/vector|embed|chunk|search|bm25|dense|profile/.test(s)) return IC.search;
  if (/s3|object|upload|original|registry|ecr|files/.test(s)) return IC.upload;
  if (/redis|queue|cache|lane|key \d/.test(s)) return IC.layers;
  if (/mysql|\bdb\b|table|sql|database|rds|primary|structured/.test(s)) return IC.table;
  if (/worker|docker|container|build|process|ec2|pull|git/.test(s)) return IC.terminal;
  if (/api|nginx|server|django|proxy|groq|provider/.test(s)) return IC.server;
  if (/web|client|browser|user|frontend|vercel|message|question/.test(s)) return IC.cloud;
  if (/lock|jwt|token|otp/.test(s)) return IC.lock;
  if (/valid|guard|rule|check|route|login|register/.test(s)) return IC.check;
  if (/parse|rank|fuse|rerank/.test(s)) return IC.code;
  return IC.file;
}

/* ---------------------------------- wires ---------------------------------- */

type Pt = [number, number];
interface Route { d: string; lx: number; ly: number; anchor: "start" | "middle" | "end"; vertical: boolean }

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

function route(a: N, b: N, label?: string): Route {
  const need = (label ? label.length : 0) * 7.2 + 16;
  const ac = a.y + a.h / 2;
  const bc = b.y + b.h / 2;
  const fwd = b.x >= a.x + a.w - 1;
  const back = b.x + b.w <= a.x + 1;
  if (fwd || back) {
    const sx = fwd ? a.x + a.w : a.x;
    const ex = fwd ? b.x : b.x + b.w;
    const mx = (sx + ex) / 2;
    if (Math.abs(ac - bc) < 2) return { d: rounded([[sx, ac], [ex, ac]]), lx: mx, ly: ac - 9, anchor: "middle", vertical: false };
    const d = rounded([[sx, ac], [mx, ac], [mx, bc], [ex, bc]]);
    if (Math.abs(ex - mx) >= need) return { d, lx: ex + (fwd ? -10 : 10), ly: bc - 9, anchor: fwd ? "end" : "start", vertical: false };
    return { d, lx: mx + 9, ly: (ac + bc) / 2 + 4, anchor: "start", vertical: false };
  }
  const down = b.y >= a.y;
  const sx = a.x + a.w / 2;
  const ex = b.x + b.w / 2;
  const sy = down ? a.y + a.h : a.y;
  const ey = down ? b.y : b.y + b.h;
  const my = (sy + ey) / 2;
  if (Math.abs(sx - ex) < 2) return { d: rounded([[sx, sy], [sx, ey]]), lx: sx + 9, ly: my + 4, anchor: "start", vertical: true };
  return { d: rounded([[sx, sy], [sx, my], [ex, my], [ex, ey]]), lx: ex + 9, ly: (my + ey) / 2 + 4, anchor: "start", vertical: true };
}

function anchorOf(spec: Spec, at: string): Pt {
  const n = spec.nodes.find((x) => x.id === at);
  if (n) return [n.x + n.w / 2, n.y];
  const z = spec.zones?.find((x) => x.id === at);
  if (z) return [z.x + z.w - 20, z.y];
  return [spec.w / 2, 0];
}

/* ------------------------------ shared behaviour ------------------------------ */

type G = SVGProps<SVGGElement>;

function useDiagram(spec: Spec, auto: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [live, setLive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const n = spec.spots.length;

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const f = () => setReduced(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setLive(true); return; }
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !live || reduced || held || pinned !== null || n < 2) return;
    const id = window.setInterval(() => setCur((c) => (c + 1) % n), 3400);
    return () => window.clearInterval(id);
  }, [auto, live, reduced, held, pinned, n]);

  const active = pinned ?? cur;
  const nodeById = useMemo(() => Object.fromEntries(spec.nodes.map((x) => [x.id, x])) as Record<string, N>, [spec]);
  const spotOf = useMemo(() => {
    const m: Record<string, number> = {};
    spec.spots.forEach((s, i) => { if (m[s.at] === undefined) m[s.at] = i; });
    return m;
  }, [spec]);

  const members = useMemo(() => {
    const s = new Set<string>();
    const at = spec.spots[active]?.at;
    if (!at) return s;
    if (nodeById[at]) { s.add(at); return s; }
    const z = spec.zones?.find((q) => q.id === at);
    if (z) spec.nodes.forEach((x) => {
      const cx = x.x + x.w / 2, cy = x.y + x.h / 2;
      if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) s.add(x.id);
    });
    return s;
  }, [active, spec, nodeById]);

  const pick = (i: number) => { setPinned((p) => (p === i ? null : i)); setCur(i); };
  const peek = (i: number | null) => { if (i === null) setHeld(false); else { setHeld(true); setCur(i); } };
  const lit = (a: string, b: string) => members.has(a) || members.has(b) || hover === a || hover === b;

  /** Pointer, focus and click handlers for one box or zone. */
  const bind = (id: string, label: string): G => {
    const si = spotOf[id];
    const base: G = {
      onPointerEnter: (e: RPointerEvent<SVGGElement>) => { if (e.pointerType === "mouse") setHover(id); },
      onPointerLeave: () => setHover((h) => (h === id ? null : h)),
      onFocus: () => setHover(id),
      onBlur: () => setHover((h) => (h === id ? null : h)),
    };
    if (si === undefined) return base;
    return {
      ...base,
      role: "button",
      tabIndex: 0,
      "aria-label": `${label}: show details`,
      "aria-pressed": si === active,
      style: { cursor: "pointer" },
      onClick: (e: RMouseEvent<SVGGElement>) => { e.stopPropagation(); pick(si); },
      onKeyDown: (e: RKeyEvent<SVGGElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(si); } },
    };
  };

  return { ref, active, members, spotOf, nodeById, hover, setHover, pick, peek, lit, bind };
}
type D = ReturnType<typeof useDiagram>;

const CSS = `
.qd .qd-mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;font-variant-ligatures:none}
.qd .qd-hand{font-family:var(--font-hand),"Caveat","Kalam","Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS",cursive}
.qd .qd-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}
@keyframes qd-bar{0%,100%{transform:scaleY(.2)}50%{transform:scaleY(1)}}
@keyframes qd-blink{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes qd-run{0%{transform:translateX(0);opacity:0}15%,85%{opacity:1}100%{transform:translateX(80px);opacity:0}}
@keyframes qd-rise{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-62px);opacity:0}}
@keyframes qd-sweep{0%{transform:translateY(-34px);opacity:0}30%,70%{opacity:.9}100%{transform:translateY(34px);opacity:0}}
@keyframes qd-lift{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes qd-draw{0%{stroke-dashoffset:1}60%,100%{stroke-dashoffset:0}}
@keyframes qd-flow{to{stroke-dashoffset:-24}}
@keyframes qd-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes qd-ping{0%{transform:scale(.6);opacity:.8}100%{transform:scale(1.6);opacity:0}}
.qd .qd-bar{transform-box:fill-box;transform-origin:50% 100%;animation:qd-bar 2.2s ease-in-out infinite}
.qd .qd-blink{animation:qd-blink 1.8s ease-in-out infinite}
.qd .qd-run{transform-box:fill-box;animation:qd-run 2.4s ease-in-out infinite}
.qd .qd-rise{transform-box:fill-box;animation:qd-rise 2.4s ease-in infinite}
.qd .qd-sweep{transform-box:fill-box;animation:qd-sweep 2.4s ease-in-out infinite}
.qd .qd-lift{transform-box:fill-box;animation:qd-lift 2.2s ease-in-out infinite}
.qd .qd-draw{stroke-dasharray:1;animation:qd-draw 2.4s ease-out infinite}
.qd .qd-flow{stroke-dasharray:6 6;animation:qd-flow 1s linear infinite}
.qd .qd-in{animation:qd-in .25s both}
.qd .qd-ping{transform-box:fill-box;transform-origin:center;animation:qd-ping 1.6s ease-out infinite}
.qd g[role=button]:focus-visible{outline:none}
.qd g[role=button]:focus-visible .qd-body{stroke:#fff;stroke-width:2}
@media (prefers-reduced-motion:reduce){.qd *{animation:none!important}}
`;

function Shell({ r, bg, W, H, label, children, foot }: { r: Ref<HTMLDivElement>; bg?: CSSProperties; W: number; H: number; label: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <figure className="mt-7">
      <style>{CSS}</style>
      <div ref={r} className="qd overflow-hidden rounded-[10px] border border-white/[0.14]" style={{ background: BG, ...bg }}>
        <div className="qd-scroll overflow-x-auto">
          <div className="relative min-w-[760px]" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block h-full w-full" role="group" aria-label={label}>{children}</svg>
          </div>
        </div>
        {foot}
      </div>
    </figure>
  );
}

/** Detail strip under the layered and sketch styles. One tiny square per spot, so every box's note is reachable. */
function Caption({ spec, d, title, hand }: { spec: Spec; d: D; title: string; hand?: boolean }) {
  const s = spec.spots[d.active];
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-white/10 px-5 py-4">
      <div className="min-w-0 flex-1 basis-[320px]" aria-live="polite">
        <p className={hand ? "qd-hand text-[21px] leading-tight text-white" : "text-[16px] font-medium text-white"}>{s.title}</p>
        <p className="mt-1 max-w-[760px] text-[14.5px] leading-[1.6] text-white/65">{s.desc}</p>
        {s.lines && <p className="qd-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-white/45">{s.lines.map((l) => <span key={l}>{l}</span>)}</p>}
      </div>
      <div role="group" aria-label={`${title}: notes`} className="flex flex-wrap gap-2 pt-1.5">
        {spec.spots.map((x, i) => (
          <button
            key={x.at}
            type="button"
            title={x.title}
            aria-label={x.title}
            aria-pressed={i === d.active}
            onClick={() => d.pick(i)}
            className="size-3 rounded-[2px] border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            style={{ borderColor: i === d.active ? ACCENT : "rgba(255,255,255,.3)", background: i === d.active ? ACCENT : "transparent" }}
          />
        ))}
      </div>
    </div>
  );
}

/* =============================== 1. hotspot =============================== */

type Neon = "bars" | "pipe" | "lock" | "grid" | "scatter" | "stack" | "rain" | "branch" | "lanes";
const SCATTER: Pt[] = [[26, 40], [44, 72], [60, 34], [78, 58], [92, 40], [34, 90], [70, 88], [98, 80], [52, 56], [20, 66], [84, 24], [60, 98]];

function NeonArt({ kind }: { kind: Neon }) {
  const w = "#fff";
  let body: ReactNode = null;
  if (kind === "bars") body = [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} className="qd-bar" x={20 + i * 13} y={30} width={8} height={64} fill={w} opacity={0.9} style={{ animationDelay: `${i * 0.18}s` }} />);
  if (kind === "pipe") body = (<>
    {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} className="qd-blink" x={16 + i * 16} y={55} width={10} height={10} fill={w} style={{ animationDelay: `${i * 0.25}s` }} />)}
    <rect className="qd-run" x={16} y={50} width={4} height={20} fill={ACCENT} />
  </>);
  if (kind === "lock") body = (<>
    <path d={IC.lock} transform="translate(36 30) scale(2)" fill="none" stroke={w} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    <line className="qd-sweep" x1={18} x2={102} y1={60} y2={60} stroke={ACCENT} strokeWidth={1.5} />
  </>);
  if (kind === "grid") body = Array.from({ length: 16 }, (_, i) => <rect key={i} className="qd-blink" x={24 + (i % 4) * 18} y={24 + Math.floor(i / 4) * 18} width={14} height={14} fill={i % 5 === 0 ? ACCENT : w} style={{ animationDelay: `${((i * 7) % 11) * 0.2}s` }} />);
  if (kind === "scatter") body = (<>
    {SCATTER.map(([x, y], i) => <line key={`l${i}`} x1={60} y1={60} x2={x} y2={y} stroke="rgba(255,255,255,.12)" />)}
    {SCATTER.map(([x, y], i) => <circle key={i} className="qd-blink" cx={x} cy={y} r={3} fill={i % 4 === 0 ? ACCENT : w} style={{ animationDelay: `${(i % 6) * 0.3}s` }} />)}
    <circle cx={60} cy={60} r={5} fill="none" stroke={ACCENT} strokeWidth={1.5} />
  </>);
  if (kind === "stack") body = [66, 50, 34].map((y, i) => <rect key={y} className={i === 2 ? "qd-lift" : undefined} x={28} y={y} width={64} height={12} rx={2} fill="none" stroke={w} strokeOpacity={0.85} strokeWidth={1.4} />);
  if (kind === "rain") body = Array.from({ length: 8 }, (_, i) => <rect key={i} className="qd-rise" x={18 + i * 12} y={98} width={5} height={5} fill={i % 3 === 0 ? ACCENT : w} style={{ animationDelay: `${(i * 0.37) % 2.4}s` }} />);
  if (kind === "branch") body = (<>
    <path d="M20 70H60" stroke={w} strokeWidth={1.6} fill="none" />
    <circle cx={20} cy={70} r={4} fill={w} /><circle cx={60} cy={70} r={4} fill={w} />
    <path className="qd-draw" pathLength={1} d="M60 70C78 70 78 40 98 40" stroke={ACCENT} strokeWidth={1.8} fill="none" />
    <circle className="qd-blink" cx={98} cy={40} r={4} fill={ACCENT} />
  </>);
  if (kind === "lanes") body = [38, 60, 82].map((y, i) => (
    <g key={y}>
      <line x1={16} x2={104} y1={y} y2={y} stroke="rgba(255,255,255,.28)" />
      <rect className="qd-run" x={16} y={y - 4} width={8} height={8} fill={i === 1 ? ACCENT : w} style={{ animationDelay: `${i * 0.6}s` }} />
    </g>
  ));
  const c = "rgba(255,255,255,.4)";
  return (
    <svg viewBox="0 0 120 120" width={120} height={120} className="shrink-0" aria-hidden="true">
      <rect width="120" height="120" rx="4" fill="#161718" />
      <path d="M6 14V6h8M106 6h8v8M114 106v8h-8M14 114H6v-8" fill="none" stroke={c} />
      {body}
    </svg>
  );
}

function Hotspot({ spec, title, art }: { spec: Spec; title: string; art: Record<string, Neon> }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const d = useDiagram(spec, true);
  const { w: W, h: H } = spec;
  const S = 190, CW = 520, CH = 164;
  const marks = useMemo(() => spec.spots.map((s) => anchorOf(spec, s.at)), [spec]);
  const sp = spec.spots[d.active];
  const [mx, my] = marks[d.active];
  const cx = clamp(mx - CW / 2, 8, W - CW - 8);
  const lx = clamp(mx, cx + 28, cx + CW - 28);

  return (
    <Shell r={d.ref} W={W} H={H + S} label={title} bg={{ backgroundImage: DOTS, backgroundSize: "18px 18px" }}>
      <defs>
        <marker id={`a${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>
        <marker id={`b${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker>
      </defs>

      <g transform={`translate(0 ${S})`}>
        {spec.zones?.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={12} fill={z.solid ? hexA(ACCENT, 0.03) : "rgba(255,255,255,.015)"} stroke={z.solid ? hexA(ACCENT, 0.35) : "rgba(255,255,255,.16)"} strokeDasharray={z.solid ? undefined : "5 4"} />
            <svg x={z.x + 16} y={z.y + 12} width={15} height={15} viewBox="0 0 24 24"><path d={iconFor(z.label)} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
            <text x={z.x + 38} y={z.y + 24} fontSize={13.5} fill="rgba(255,255,255,.7)">{z.label}</text>
          </g>
        ))}

        {spec.edges.map(([from, to, text], i) => {
          const r = route(d.nodeById[from], d.nodeById[to], text);
          const on = d.lit(from, to);
          return (
            <g key={i} opacity={d.hover && !on ? 0.3 : 1} style={{ transition: "opacity .25s" }}>
              <path d={r.d} fill="none" stroke={on ? ACCENT : "rgba(255,255,255,.28)"} strokeWidth={on ? 1.6 : 1.2} className={on ? "qd-flow" : undefined} markerEnd={`url(#${on ? "b" : "a"}${uid})`} />
              {text && <text x={r.lx} y={r.ly} textAnchor={r.anchor} fontSize={12.5} className="qd-mono" fill={on ? ACCENT : "rgba(255,255,255,.55)"} stroke={BG} strokeWidth={4} paintOrder="stroke">{text}</text>}
            </g>
          );
        })}

        {spec.nodes.map((n) => {
          const sel = d.members.has(n.id);
          const on = sel || d.hover === n.id;
          const lf = fit(n.label, n.w - 18, 13.5, 17, 0.56);
          const sf = n.sub ? fit(n.sub, n.w - 20, 10.5, 13, 0.6) : 0;
          return (
            <g key={n.id} opacity={n.ghost ? 0.7 : 1} {...d.bind(n.id, n.label)}>
              <rect className="qd-body" x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill={sel ? hexA(ACCENT, 0.1) : "rgba(255,255,255,.035)"} stroke={on ? ACCENT : "rgba(255,255,255,.16)"} strokeDasharray={n.ghost ? "4 3" : undefined} strokeWidth={on ? 1.5 : 1} style={{ transition: "stroke .2s, fill .2s" }} />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -3 : 5)} textAnchor="middle" fontSize={lf} fontWeight={500} fill="#fff" pointerEvents="none">{n.label}</text>
              {n.sub && <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 14} textAnchor="middle" fontSize={sf} className="qd-mono" fill="rgba(255,255,255,.5)" pointerEvents="none">{n.sub}</text>}
            </g>
          );
        })}

        {spec.spots.map((s, i) => {
          const [x, y] = marks[i];
          const on = i === d.active;
          return (
            <g
              key={s.at}
              role="button"
              tabIndex={0}
              aria-label={`${s.title}: show details`}
              aria-pressed={on}
              style={{ cursor: "pointer" }}
              onPointerEnter={(e: RPointerEvent<SVGGElement>) => { if (e.pointerType === "mouse") d.peek(i); }}
              onPointerLeave={() => d.peek(null)}
              onFocus={() => d.peek(i)}
              onBlur={() => d.peek(null)}
              onClick={(e: RMouseEvent<SVGGElement>) => { e.stopPropagation(); d.pick(i); }}
              onKeyDown={(e: RKeyEvent<SVGGElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); d.pick(i); } }}
            >
              <rect x={x - 14} y={y - 14} width={28} height={28} fill="transparent" />
              {on && <rect className="qd-ping" x={x - 7} y={y - 7} width={14} height={14} fill="none" stroke={ACCENT} />}
              <rect className="qd-body" x={x - 5} y={y - 5} width={10} height={10} fill={BG} stroke={on ? "#fff" : ACCENT} strokeWidth={1.5} />
              <rect x={x - 2} y={y - 2} width={4} height={4} fill={on ? "#fff" : ACCENT} />
            </g>
          );
        })}
      </g>

      <path d={`M${lx} ${12 + CH}L${mx} ${S + my}`} stroke="rgba(255,255,255,.4)" strokeWidth={1} fill="none" />
      <foreignObject x={cx} y={12} width={CW} height={CH}>
        <div key={d.active} className="qd-in flex h-full gap-4 rounded-lg border border-white/[0.16] bg-[#101112] p-3.5">
          <NeonArt kind={art[sp.at] ?? "pipe"} />
          <div className="min-w-0">
            <p className="qd-mono text-[12.5px] uppercase tracking-[0.08em] text-white">{sp.title}</p>
            <p className="mt-2 line-clamp-5 text-[13.5px] leading-[1.5] text-white/65">{sp.desc}</p>
            {sp.lines && <p className="qd-mono mt-2 text-[12px] leading-[1.5] text-white/40">{sp.lines.join("  ·  ")}</p>}
          </div>
        </div>
      </foreignObject>
    </Shell>
  );
}

/* =============================== 2. layered =============================== */

function Layered({ spec, title }: { spec: Spec; title: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const d = useDiagram(spec, false);
  const { w: W, h: H } = spec;

  return (
    <Shell r={d.ref} W={W} H={H} label={title} foot={<Caption spec={spec} d={d} title={title} />}>
      <defs>
        <marker id={`a${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke={hexA(ACCENT, 0.6)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker>
        <marker id={`b${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></marker>
      </defs>

      {spec.zones?.map((z) => {
        const on = d.members.size > 0 && spec.spots[d.active].at === z.id;
        const cw = z.label.length * 7.4 + 24;
        return (
          <g key={z.id} {...d.bind(z.id, z.label)}>
            <rect className="qd-body" x={z.x} y={z.y} width={z.w} height={z.h} rx={16} fill={z.solid ? hexA(ACCENT, 0.035) : "rgba(255,255,255,.022)"} stroke={on ? ACCENT : z.solid ? hexA(ACCENT, 0.3) : "rgba(255,255,255,.09)"} />
            <rect x={z.x + 14} y={z.y + 12} width={cw} height={24} rx={7} fill="rgba(255,255,255,.06)" />
            <text x={z.x + 26} y={z.y + 28} fontSize={11.5} letterSpacing="0.08em" className="qd-mono" fill="rgba(255,255,255,.75)" style={{ textTransform: "uppercase" }}>{z.label}</text>
          </g>
        );
      })}

      {spec.edges.map(([from, to, text], i) => {
        const r = route(d.nodeById[from], d.nodeById[to], text);
        const on = d.lit(from, to);
        const pw = (text?.length ?? 0) * 7 + 18;
        const px = r.anchor === "end" ? r.lx - pw : r.anchor === "start" ? r.lx : r.lx - pw / 2;
        return (
          <g key={i} opacity={d.hover && !on ? 0.35 : 1} style={{ transition: "opacity .25s" }}>
            <path d={r.d} fill="none" stroke={on ? "#fff" : hexA(ACCENT, 0.6)} strokeWidth={on ? 1.9 : 1.5} className={on && d.hover ? "qd-flow" : undefined} markerEnd={`url(#${on ? "b" : "a"}${uid})`} />
            {text && (
              <g>
                <rect x={px} y={r.ly - 14} width={pw} height={20} rx={10} fill={BG} stroke={on ? hexA(ACCENT, 0.7) : "rgba(255,255,255,.16)"} />
                <text x={px + pw / 2} y={r.ly} textAnchor="middle" fontSize={11.5} className="qd-mono" fill={on ? "#fff" : "rgba(255,255,255,.75)"}>{text}</text>
              </g>
            )}
          </g>
        );
      })}

      {spec.nodes.map((n) => {
        const sel = d.members.has(n.id);
        const on = sel || d.hover === n.id;
        const icon = n.w >= 170 && n.h >= 50;
        const avail = n.w - (icon ? 60 : 16);
        const lf = fit(n.label, avail, 12.5, 16);
        const sf = n.sub ? fit(n.sub, avail, 9.5, 12.5, 0.6) : 0;
        const tx = icon ? n.x + 46 : n.x + n.w / 2;
        const ta = icon ? "start" : "middle";
        const clickable = d.spotOf[n.id] !== undefined;
        return (
          <g key={n.id} opacity={n.ghost ? 0.75 : 1} {...d.bind(n.id, n.label)}>
            <rect className="qd-body" x={n.x} y={n.y} width={n.w} height={n.h} rx={12} fill={sel ? hexA(ACCENT, 0.1) : "#111113"} stroke={on ? ACCENT : "rgba(255,255,255,.13)"} strokeDasharray={n.ghost ? "4 3" : undefined} strokeWidth={on ? 1.5 : 1} style={{ transition: "stroke .2s, fill .2s" }} />
            {icon && <svg x={n.x + 14} y={n.y + n.h / 2 - 10} width={20} height={20} viewBox="0 0 24 24"><path d={iconFor(n.label, n.sub)} fill="none" stroke="rgba(255,255,255,.8)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>}
            <text x={tx} y={n.y + n.h / 2 + (n.sub ? -4 : 5.5)} textAnchor={ta} fontSize={lf} fontWeight={600} fill="#fff" pointerEvents="none">{n.label}</text>
            {n.sub && <text x={tx} y={n.y + n.h / 2 + 13} textAnchor={ta} fontSize={sf} className="qd-mono" fill="rgba(255,255,255,.5)" pointerEvents="none">{n.sub}</text>}
            {clickable && <rect x={n.x + n.w - 13} y={n.y + 8} width={4} height={4} fill={ACCENT} />}
          </g>
        );
      })}
    </Shell>
  );
}

/* ================================ 3. sketch ================================ */

function Sketch({ spec, title }: { spec: Spec; title: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const d = useDiagram(spec, false);
  const { w: W, h: H } = spec;
  const ink = "rgba(255,255,255,.82)";

  return (
    <Shell r={d.ref} W={W} H={H} label={title} foot={<Caption spec={spec} d={d} title={title} hand />}>
      <defs>
        <filter id={`r${uid}`} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <marker id={`a${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>
        <marker id={`b${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></marker>
      </defs>

      {spec.zones?.map((z) => {
        const on = spec.spots[d.active].at === z.id;
        return (
          <g key={z.id} {...d.bind(z.id, z.label)}>
            <rect className="qd-body" x={z.x} y={z.y} width={z.w} height={z.h} rx={6} fill={z.solid ? hexA(ACCENT, 0.08) : "rgba(255,255,255,.03)"} stroke={on ? ACCENT : "rgba(255,255,255,.1)"} strokeDasharray="2 5" />
            <text x={z.x + z.w - 14} y={z.y + z.h - 12} textAnchor="end" fontSize={19} className="qd-hand" fill={z.solid ? hexA(ACCENT, 0.95) : "rgba(255,255,255,.5)"}>{z.label}</text>
          </g>
        );
      })}

      <g filter={`url(#r${uid})`}>
        {spec.edges.map(([from, to, text], i) => {
          const r = route(d.nodeById[from], d.nodeById[to], text);
          const on = d.lit(from, to);
          return <path key={i} d={r.d} fill="none" stroke={on ? ACCENT : ink} strokeOpacity={on ? 1 : 0.7} strokeWidth={on ? 1.9 : 1.5} strokeLinecap="round" markerEnd={`url(#${on ? "b" : "a"}${uid})`} />;
        })}
      </g>

      <g filter={`url(#r${uid})`}>
        {spec.nodes.map((n) => {
          const sel = d.members.has(n.id);
          const on = sel || d.hover === n.id;
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={3} fill={sel ? "#15162a" : BG} stroke={on ? ACCENT : ink} strokeWidth={1.5} strokeDasharray={n.ghost ? "5 4" : undefined} />
              {!n.ghost && <rect x={n.x + 2} y={n.y - 1.5} width={n.w - 3} height={n.h + 2} rx={3} fill="none" stroke={on ? ACCENT : "rgba(255,255,255,.3)"} strokeWidth={1} />}
            </g>
          );
        })}
      </g>

      {spec.edges.map(([from, to, text], i) => {
        if (!text) return null;
        const r = route(d.nodeById[from], d.nodeById[to], text);
        const on = d.lit(from, to);
        const common = { fontSize: 15, className: "qd-hand", fill: on ? ACCENT : "rgba(255,255,255,.78)", stroke: BG, strokeWidth: 4, paintOrder: "stroke" as const };
        return r.vertical
          ? <text key={i} x={r.lx + 5} y={r.ly} textAnchor="middle" transform={`rotate(-90 ${r.lx + 5} ${r.ly})`} {...common}>{text}</text>
          : <text key={i} x={r.lx} y={r.ly} textAnchor={r.anchor} {...common}>{text}</text>;
      })}

      {spec.nodes.map((n) => {
        const lf = fit(n.label, n.w - 20, 13, 20, 0.54);
        const sf = n.sub ? fit(n.sub, n.w - 20, 10.5, 15, 0.52) : 0;
        return (
          <g key={n.id} opacity={n.ghost ? 0.75 : 1} {...d.bind(n.id, n.label)}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} fill="transparent" />
            <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -3 : 6)} textAnchor="middle" fontSize={lf} className="qd-hand" fill="#fff" pointerEvents="none">{n.label}</text>
            {n.sub && <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 15} textAnchor="middle" fontSize={sf} className="qd-hand" fill="rgba(255,255,255,.55)" pointerEvents="none">{n.sub}</text>}
          </g>
        );
      })}
    </Shell>
  );
}

/* ------------------------------ which style, where ------------------------------ */

type Kind = "hotspot" | "layered" | "sketch";

/** Keyed by the title each `DIA(...)` block is given in the page. */
const KIND: Record<string, Kind> = {
  "Database architecture": "hotspot",
  "Request path and storage services": "hotspot",
  "Tasks, key lanes and provider": "hotspot",
  "Scope Guard routing": "layered",
  "Hybrid retrieval": "layered",
  "agent, dispatch, finish": "layered",
  "One chat request": "layered",
  "From source to a running container": "layered",
  "Relational model": "sketch",
  "Registration, login and refresh rotation": "sketch",
  "Policy evidence and record evidence": "sketch",
  "Ingestion and storage fan-out": "sketch",
  "From planner output to a read-only result": "sketch",
};

/** Mini animation shown on the hotspot card, per spot id. */
const NEON: Record<string, Record<string, Neon>> = {
  "Database architecture": { wk: "pipe", pl: "lock", pm: "grid", sm: "grid", vz: "scatter", ck: "scatter", pf: "stack", rd: "rain", fs: "stack" },
  "Request path and storage services": { vc: "branch", ng: "pipe", ap: "bars", wk: "bars", rd: "rain", sv: "scatter" },
  "Tasks, key lanes and provider": { k1: "lanes", k2: "lanes", k3: "lanes", groq: "bars" },
};

export const hasDiagram = (title: string) => title in KIND;

export function Diagram({ spec, title }: { spec: Spec; title: string }) {
  switch (KIND[title]) {
    case "hotspot": return <Hotspot spec={spec} title={title} art={NEON[title] ?? {}} />;
    case "sketch": return <Sketch spec={spec} title={title} />;
    default: return <Layered spec={spec} title={title} />;
  }
}
