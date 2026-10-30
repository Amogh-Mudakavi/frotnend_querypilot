'use client';

/* components/demos/features-showcase.tsx
   GNOME-style window + tab capsules + six interactive cards on abstract backdrops.
   Desktop (wide + tall screens): SCROLL-DRIVEN. The window pins (position: sticky)
   and scrolling moves it Planner -> ... -> Isolation; the ring on the active tab
   fills with scroll progress. After the last feature it unpins and the page
   carries on. Tab clicks / keys 1-6 scroll to that feature.
   Phones, tablets, short screens, reduced motion: the old auto tour instead
   (ONE round, then rests on Planner; hover / focus pause it, any manual pick
   or a click inside a card ends it for good).
   NOTE: sticky breaks if an ancestor has overflow:hidden/auto - use
   overflow-x: clip instead of hidden on your layout wrappers.
   Dependencies: motion + lucide. */

import Link from 'next/link';
import { PixelDissolveButton } from '@/components/pixel-dissolve-button';
import { Fragment, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import type {
  ComponentType,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react';
import { motion } from 'motion/react';
import type { Variants } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  Clock,
  Cpu,
  Database,
  FileText,
  Layers,
  Lock,
  Play,
  RotateCcw,
  Scissors,
  Search,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const FRAME_CLASS = 'w-[var(--qp-frame,min(100%,1440px))]'; // same frame as the nav / hero / CTA (falls back if the variable is missing)
const TRY_HREF = '/signup'; // <- your real sign-up route
const ENGINEERING_HREF = '/engineering'; // every "See how..." link goes to the engineering page
const DWELL_MS = 8000; // how long each tab stays before the tour moves on
const BULLET_AT = [0.1, 0.28, 0.46]; // tour / scroll progress (within a feature) at which each bullet lights up

/* scroll-driven mode */
const PIN_QUERY = '(min-width: 1100px) and (min-height: 700px)'; // below this the auto tour runs instead
const PIN_TOP = 72; // px - your fixed nav's height plus a little gap
const STEP_VH = 0.7; // scroll distance per feature, as a fraction of the viewport height

const PANEL_BG = '#101011';
const PANEL_LINE = 'rgba(255,255,255,0.10)';
const PANEL_LINE_SOLID = '#282829';
const PANEL_R = 22;
const TAB_ICONS: LucideIcon[] = [Cpu, Layers, Brain, Activity, Table2, ShieldCheck];

const GRAIN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.2 0 0 0 -0.3'/></filter>" +
  "<rect width='100%' height='100%' filter='url(#n)'/></svg>";
const GRAIN_URI = `data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}`;
const GRAIN = `url("${GRAIN_URI}")`;

const RING_R = 6.5;
const RING_C = 2 * Math.PI * RING_R;

/* card tokens */
const INK = '#0B0B0C';
const LINE = 'rgba(255,255,255,0.10)';
const OK = '#2FE0B0';
const OK_BG = 'rgba(47,224,176,0.12)';
const OK_LINE = 'rgba(47,224,176,0.38)';
const BAD = '#FF7A7A';
const WARN = '#FFB84D';
const REDUCED = '(prefers-reduced-motion: reduce)';

const QP_CSS = `
.qp-features-root, .qp-features-root * { font-family: var(--font-geist), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
.qp-features-root .font-mono, .qp-features-root [class*="font-mono"], .qp-features-root pre, .qp-features-root code { font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important; }
.qp-tab{-webkit-tap-highlight-color:transparent}
.qp-tab .qp-tab-icon{transition:color .25s ease,filter .25s ease}
.qp-tab-idle{overflow:hidden;transition:color .25s ease,background-color .25s ease,border-color .25s ease,box-shadow .3s ease}
.qp-tab-idle:hover,.qp-tab-idle:focus-visible{
  color:#737FEA;background-color:#14151B;border-color:rgba(88,101,212,.55);
  box-shadow:inset 0 0 0 1px rgba(58,68,168,.08)}
.qp-tab-idle:active{transform:scale(.99)}
.qp-tab-active:hover .qp-tab-icon,.qp-tab-active:focus-visible .qp-tab-icon{
  color:#737FEA;filter:drop-shadow(0 0 5px rgba(58,68,168,.3))}
.qp-tab:hover .qp-label,.qp-tab:focus-visible .qp-label{color:#737FEA;-webkit-text-fill-color:currentColor}
@media (hover:none){.qp-tab-active .qp-tab-icon{color:#737FEA}}

.qp-cta{transition:color .25s ease}
.qp-cta:hover,.qp-cta:focus-visible{color:#737FEA}
.qp-cta:hover svg,.qp-cta:focus-visible svg{filter:drop-shadow(0 0 4px rgba(58,68,168,.35))}

@keyframes qp-sweep{from{transform:translateX(-100%)}to{transform:translateX(320%)}}
@keyframes qp-travel{from{left:0;opacity:1}to{left:100%;opacity:.2}}
@keyframes qp-ripple{from{transform:translate(-50%,-50%) scale(1);opacity:.8}to{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
.qp-sweep{animation:qp-sweep 1.1s linear infinite}
.qp-travel{animation:qp-travel 90ms linear forwards}
.qp-ripple{animation:qp-ripple .6s ease-out forwards}

@media (prefers-reduced-motion:reduce){
  .qp-tab *,.qp-tab::after{transition:none!important}
  .qp-sweep,.qp-travel,.qp-ripple{animation:none!important}
}
`;

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function useInView<T extends Element>(ref: RefObject<T | null>, threshold = 0.3) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return inView;
}

const useTabRadius = () => {
  const tv = useMediaQuery('(min-width: 1600px)');
  const roomy = useMediaQuery('(min-width: 640px)');
  return tv ? 26 : roomy ? 20 : 14;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0..1 over `ms` while `active` (jumps to 1 for reduced motion, 0 when inactive). */
function useAnim(ms: number, active: boolean) {
  const reduce = useMediaQuery(REDUCED);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!active) {
      setP(0);
      return;
    }
    if (reduce) {
      setP(1);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const v = clamp01((now - t0) / ms);
      setP(v);
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, active, reduce]);
  return active ? p : 0;
}

/** Typewriter: the visible slice of `text`. */
const useTyped = (text: string, active: boolean, cps = 70) =>
  text.slice(0, Math.floor(text.length * useAnim((text.length / cps) * 1000, active)));

/** Eased integer count-up from 0 to `target`. */
function useCountUp(target: number, active: boolean) {
  const p = useAnim(700, active);
  return Math.round(target * (1 - Math.pow(1 - p, 3)));
}

/**
 * Staged "run": returns 0..total, advancing every `gap` ms. `null` = idle.
 * Changing `runKey` restarts from 0 with no stale-frame flash.
 */
function useStages(total: number, gap: number, runKey: string | null) {
  const reduce = useMediaQuery(REDUCED);
  const [s, setS] = useState<{ key: string | null; stage: number }>({ key: null, stage: 0 });
  useEffect(() => {
    if (runKey === null) return;
    if (reduce) {
      setS({ key: runKey, stage: total });
      return;
    }
    setS({ key: runKey, stage: 0 });
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setS({ key: runKey, stage: n });
      if (n >= total) clearInterval(id);
    }, gap);
    return () => clearInterval(id);
  }, [total, gap, runKey, reduce]);
  return runKey !== null && s.key === runKey ? s.stage : 0;
}

/* ------------------------------------------------------------------ */
/* Card atoms: abstract backdrops + black UI panel                     */
/* ------------------------------------------------------------------ */

const ring = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70';

/** Fade + rise, driven by a boolean. */
const reveal = (on: boolean, delay = 0): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'none' : 'translateY(6px)',
  transition: `opacity .35s ease ${on ? delay : 0}ms, transform .35s ease ${on ? delay : 0}ms`,
});

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

/** Round halftone dots that fade out along a mask. */
const dots = (color: string, size: number, mask: string, r = 30): CSSProperties => ({
  backgroundImage: `radial-gradient(${color} ${r}%, transparent ${r + 3}%)`,
  backgroundSize: `${size}px ${size}px`,
  WebkitMaskImage: mask,
  maskImage: mask,
});

const STREAKS =
  "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>" +
  "<filter id='s'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.55' numOctaves='3' seed='7'/>" +
  "<feColorMatrix type='matrix' values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  2.6 0 0 0 -1'/></filter>" +
  "<rect width='100%' height='100%' filter='url(#s)'/></svg>";
const STREAK_URI = `url("data:image/svg+xml,${encodeURIComponent(STREAKS)}")`;

/** A coloured block that drifts with the pointer. `k` is how far it moves. */
const Block = ({ className, k }: { className: string; k: number }) => (
  <span
    aria-hidden="true"
    className={`absolute transition-transform duration-300 ease-out ${className}`}
    style={{ transform: `translate(calc(var(--mx, 0) * ${k}px), calc(var(--my, 0) * ${k}px))` }}
  />
);

/** The coloured backdrop + centred panel. Pointer movement only nudges the blocks. */
function Stage({ bg, backdrop, children }: { bg: string; backdrop: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const leave = () => {
    ref.current?.style.setProperty('--mx', '0');
    ref.current?.style.setProperty('--my', '0');
  };
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className="relative isolate flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[14px] border border-white/10 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] min-[400px]:p-2.5 sm:min-h-[460px] sm:p-4 min-[1600px]:min-h-[520px] min-[1600px]:p-6 min-[2000px]:min-h-[560px] min-[2000px]:p-7 min-[2560px]:min-h-[600px] min-[2560px]:p-8"
      style={{ background: bg }}
    >
      {backdrop}
      <div className="relative w-full min-w-0 max-w-[420px]">{children}</div>
    </div>
  );
}

const Panel = ({ children }: { children: ReactNode }) => (
  <div
    className="rounded-[10px] border p-2.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] min-[400px]:p-3 sm:p-4"
    style={{ background: INK, borderColor: LINE }}
  >
    {children}
  </div>
);

function Badge({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'mute' | 'bad' }) {
  const s =
    tone === 'ok'
      ? { background: OK_BG, color: OK }
      : tone === 'bad'
        ? { background: 'rgba(255,122,122,0.14)', color: BAD }
        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' };
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] leading-none" style={s}>
      {children}
    </span>
  );
}

const Label = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 mt-2.5 text-[12px] text-white/45">{children}</p>
);

const Title = ({ children }: { children: ReactNode }) => (
  <h4 className="text-[16px] font-medium tracking-[-0.01em]">{children}</h4>
);

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`h-7 whitespace-nowrap rounded-full border px-3 text-[12px] transition-colors ${ring} ${
        on ? 'border-transparent bg-white text-black' : 'text-white/70 hover:text-white'
      }`}
      style={on ? undefined : { borderColor: LINE }}
    >
      {children}
    </button>
  );
}

function Btn({
  onClick,
  children,
  ghost,
  small,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  ghost?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:opacity-50 ${ring} ${
        small ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]'
      } ${ghost ? 'text-white/80 hover:bg-white/10' : 'border-transparent bg-white text-black hover:bg-white/85'}`}
      style={ghost ? { borderColor: LINE } : undefined}
    >
      {children}
    </button>
  );
}

const IconBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md border text-white/70 transition-colors hover:bg-white/10 hover:text-white ${ring}`}
    style={{ borderColor: LINE }}
  >
    <RotateCcw size={12} />
  </button>
);

const Caret = () => <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-white/80" />;

/** Small numbered dot that ties a phrase in a question to a field / SQL line. */
function NumBadge({ n, hot = false, className = '', style }: { n: number; hot?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={`inline-flex size-[14px] shrink-0 items-center justify-center rounded-full border font-mono text-[9px] leading-none transition-[color,border-color,opacity] duration-300 ${className}`}
      style={{
        background: INK,
        borderColor: hot ? OK : 'rgba(255,255,255,0.3)',
        color: hot ? OK : 'rgba(255,255,255,0.85)',
        ...style,
      }}
    >
      {n}
    </span>
  );
}

/** [text, ref] - `ref` is the 1-based number of the field / SQL line this phrase maps to. */
type Seg = [text: string, ref: number | null];

/** The question, with mapped phrases highlighted (padding and margin cancel so text never shifts). */
function renderSegs(segs: Seg[], on: boolean, hover: number | null, onHover: (n: number | null) => void) {
  return segs.map(([text, ref], i) => {
    if (ref === null) return <span key={i}>{text}</span>;
    const hot = hover === ref;
    const delay = on ? ref * 140 : 0;
    return (
      <span
        key={i}
        onMouseEnter={() => onHover(ref)}
        onMouseLeave={() => onHover(null)}
        className="relative inline-block rounded-[4px] transition-colors duration-300"
        style={{
          padding: '1px 3px',
          margin: '0 -3px',
          color: on ? '#fff' : undefined,
          background: hot ? 'rgba(47,224,176,0.22)' : on ? 'rgba(255,255,255,0.10)' : 'transparent',
          boxShadow: on ? `inset 0 -1px 0 ${hot ? OK : 'rgba(255,255,255,0.35)'}` : 'none',
          transitionDelay: `${hot ? 0 : delay}ms`,
        }}
      >
        {text}
        <NumBadge n={ref} hot={hot} className="absolute -right-1.5 -top-2 sm:-right-2 sm:-top-2.5" style={{ opacity: on ? 1 : 0, transitionDelay: `${delay}ms` }} />
      </span>
    );
  });
}

/** Keywords in white, string literals in amber. */
function Sql({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\b(?:SELECT|FROM|WHERE|COUNT|SUM|MAX|AS)\b|'[^']*')/g).map((part, i) =>
        i % 2 ? (
          <span key={i} style={part.startsWith("'") ? { color: WARN } : { color: '#fff', fontWeight: 500 }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Planner: question -> numbered fields -> sources scan -> answer   */
/* ------------------------------------------------------------------ */

type SourceName = 'Documents' | 'SQLite' | 'Metadata';
const SRC_ICON: Record<SourceName, LucideIcon> = { Documents: FileText, SQLite: Database, Metadata: Clock };

interface Plan {
  label: string;
  segs: Seg[];
  fields: { text: string; resolved?: string }[];
  src: { name: SourceName; sub: string; result: string }[];
  answer: { n: number; suffix?: string; note: string; cites: string[] };
}

const PLANS: Plan[] = [
  {
    label: 'Refunds',
    segs: [['How many ', null], ['damaged', 1], [' orders were ', null], ['refunded', 2], [' ', null], ['last month', 3], ['?', null]],
    fields: [
      { text: 'reason = damaged' },
      { text: 'status = refunded' },
      { text: 'range = last month', resolved: 'range = :month_start..:month_end' },
    ],
    src: [
      { name: 'Documents', sub: 'refund_policy.pdf', result: 'matched · p.4' },
      { name: 'SQLite', sub: 'refunds + orders', result: '318 rows' },
      { name: 'Metadata', sub: 'date bounds', result: 'bounds applied' },
    ],
    answer: { n: 318, note: '$42,650 refunded across 2 carriers', cites: ['Docs · refund_policy.pdf · p.4', 'SQLite · 318 rows'] },
  },
  {
    label: 'Policy',
    segs: [['What is the ', null], ['return window', 1], [' for ', null], ['sale items', 2], ['?', null]],
    fields: [{ text: 'topic = returns' }, { text: 'item = sale' }],
    src: [{ name: 'Documents', sub: 'returns_sop.md', result: 'l.84–112' }],
    answer: { n: 30, suffix: ' days', note: 'counted from delivery', cites: ['Docs · returns_sop.md · l.84–112'] },
  },
  {
    label: 'Carriers',
    segs: [['Top carriers', 1], [' by ', null], ['refund value', 2], [' in ', null], ['Q3', 3]],
    fields: [
      { text: 'group = carrier' },
      { text: 'metric = SUM(amount)' },
      { text: 'range = Q3', resolved: 'range = :q3_start..:q3_end' },
    ],
    src: [
      { name: 'SQLite', sub: 'orders', result: '1,248 rows' },
      { name: 'Metadata', sub: 'date bounds', result: 'bounds applied' },
    ],
    answer: { n: 2, suffix: ' groups', note: 'ranked by refund value', cites: ['SQLite · 1,248 rows'] },
  },
];

function PlannerCard() {
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const d = PLANS[i];
  const stage = useStages(4, 650, `${i}:${run}`);
  const ready = stage >= 4;
  const count = useCountUp(d.answer.n, ready);

  return (
    <Stage
      bg="#DEDAD0"
      backdrop={
        <>
          <span aria-hidden="true" className="absolute inset-0" style={dots('#0B0B0C', 7, 'linear-gradient(115deg, #000 0%, transparent 55%)', 34)} />
          <span aria-hidden="true" className="absolute inset-0" style={dots('#0B0B0C', 7, 'linear-gradient(295deg, #000 0%, transparent 50%)', 34)} />
          <Block className="right-[8%] top-[-4%] h-[30%] w-[16%] bg-[#2B8CFF]" k={-22} />
          <Block className="bottom-[-4%] left-[34%] h-[18%] w-[15%] bg-[#2B8CFF]" k={18} />
          <Block className="left-[-3%] top-[52%] h-[14%] w-[7%] bg-[#2B8CFF]" k={14} />
        </>
      }
    >
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-[12px] text-white/50">
            <Cpu size={13} /> Planner agent
          </span>
          <span className="flex items-center gap-2">
            <Badge tone={ready ? 'ok' : 'mute'}>
              {ready ? (
                <>
                  <Check size={10} strokeWidth={3} /> Plan ready
                </>
              ) : (
                'Planning…'
              )}
            </Badge>
            <IconBtn label="Replay plan" onClick={() => setRun((r) => r + 1)} />
          </span>
        </div>

        <div role="radiogroup" aria-label="Example question" className="mt-3 flex flex-wrap gap-1.5">
          {PLANS.map((p, k) => (
            <Pill
              key={p.label}
              on={k === i}
              onClick={() => {
                setHover(null);
                if (k === i) setRun((r) => r + 1);
                else setI(k);
              }}
            >
              {p.label}
            </Pill>
          ))}
        </div>

        <div className="mt-3 rounded-lg border px-3 py-2.5 text-[13px] leading-[28px] sm:leading-[24px]" style={{ borderColor: LINE }}>
          {renderSegs(d.segs, stage >= 1, hover, setHover)}
        </div>

        <Label>Understood as</Label>
        <div className="flex flex-wrap gap-1.5">
          {d.fields.map((f, k) => {
            const resolved = Boolean(f.resolved) && stage >= 2;
            const hot = hover === k + 1;
            const lit = resolved || hot;
            return (
              <span
                key={f.text}
                onMouseEnter={() => setHover(k + 1)}
                onMouseLeave={() => setHover(null)}
                className="inline-flex max-w-full items-center gap-1.5 break-all rounded-md border px-2 py-1 font-mono text-[11px] transition-all duration-300 sm:whitespace-nowrap sm:break-normal"
                style={{
                  borderColor: lit ? OK_LINE : LINE,
                  background: lit ? OK_BG : 'rgba(255,255,255,0.04)',
                  color: lit ? OK : 'rgba(255,255,255,0.75)',
                  opacity: stage >= 1 ? 1 : 0,
                  transform: stage >= 1 ? 'none' : 'translateY(4px)',
                  transitionDelay: `${stage >= 2 ? 0 : k * 120}ms`,
                }}
              >
                <NumBadge n={k + 1} hot={hot} />
                {resolved ? f.resolved : f.text}
              </span>
            );
          })}
        </div>

        <Label>Read from</Label>
        {/* one column on narrow phones, one column per source from 400px up */}
        <div
          className="grid grid-cols-1 gap-1.5 min-[400px]:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
          style={{ '--n': d.src.length } as CSSProperties}
        >
          {d.src.map((s) => {
            const Icon = SRC_ICON[s.name];
            const state = stage < 2 ? 'idle' : stage < 3 ? 'active' : 'done';
            return (
              <div
                key={s.name}
                className="relative overflow-hidden rounded-lg border px-2.5 py-2 transition-colors duration-300"
                style={{
                  borderColor: state === 'done' ? OK_LINE : state === 'active' ? 'rgba(255,255,255,0.3)' : LINE,
                  background: state === 'done' ? OK_BG : state === 'active' ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <div className="flex items-center gap-1.5 text-[12px]">
                  <Icon size={13} className="shrink-0 text-white/60" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {state === 'done' ? (
                    <Check size={12} strokeWidth={2.5} style={{ color: OK }} />
                  ) : state === 'active' ? (
                    <span className="size-1.5 animate-pulse rounded-full bg-white/70" />
                  ) : (
                    <span className="size-1.5 rounded-full border border-white/25" />
                  )}
                </div>
                <div className="mt-1 truncate font-mono text-[10.5px]" style={{ color: state === 'done' ? OK : 'rgba(255,255,255,0.45)' }}>
                  {state === 'done' ? s.result : s.sub}
                </div>
                {state === 'active' && (
                  <span
                    aria-hidden="true"
                    className="qp-sweep absolute bottom-0 left-0 h-px w-1/3"
                    style={{ background: 'linear-gradient(90deg, transparent, #fff, transparent)' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          className="mt-3 rounded-lg border p-3 transition-all duration-500"
          style={{ borderColor: ready ? OK_LINE : LINE, background: ready ? OK_BG : 'transparent', opacity: ready ? 1 : 0.45 }}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[24px] leading-none tabular-nums">
              {count}
              {d.answer.suffix}
            </span>
            <span className="min-w-0 text-[12px] text-white/65">{d.answer.note}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.answer.cites.map((c, k) => (
              <span
                key={c}
                className="max-w-full break-words rounded border px-1.5 py-0.5 font-mono text-[10.5px] text-white/75"
                style={{ borderColor: LINE, ...reveal(ready, 300 + k * 150) }}
              >
                {k + 1} · {c}
              </span>
            ))}
          </div>
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Ingestion: parse -> chunk -> embed -> index, vectors fill a grid */
/* ------------------------------------------------------------------ */

const ING_STAGES = ['parse', 'chunk', 'embed', 'index'] as const;
const ING_AT = [0, 15, 35, 85, 100]; // stage boundaries, in percent of a file's progress

interface IngestFile {
  name: string;
  size: string;
  vec: number; // vectors this file contributes
  p: number; // 0..100
}

const SEED: IngestFile = { name: 'refund_policy.pdf', size: '1.4 MB', vec: 16, p: 100 };
const QUEUE: Omit<IngestFile, 'p'>[] = [
  { name: 'returns_sop.md', size: '96 KB', vec: 12 },
  { name: 'carriers.csv', size: '210 KB', vec: 8 },
  { name: 'faq_export.pdf', size: '2.1 MB', vec: 12 },
];
const VEC_TOTAL = SEED.vec + QUEUE.reduce((a, f) => a + f.vec, 0);
const HIT_CELL = 5;
const DEMO_QUERY = 'damaged items photo';
const HIT_TEXT = 'Damaged items are eligible for a refund when photo evidence is submitted within 48 hours.';

const litVectors = (f: IngestFile) => Math.floor(f.vec * clamp01((f.p - 35) / 50));
const ingestStage = (p: number) => (p >= 100 ? 'indexed' : ING_STAGES[ING_AT.findIndex((at, k) => k > 0 && p < at) - 1]);

function IngestionCard() {
  const [files, setFiles] = useState<IngestFile[]>([SEED]);
  const [next, setNext] = useState(0);
  const [text, setText] = useState('');
  const [searched, setSearched] = useState(false);

  const busy = files.some((f) => f.p < 100);
  const indexed = files.filter((f) => f.p >= 100).length;
  const hitText = useTyped(HIT_TEXT, searched && indexed > 0, 90);
  const exhausted = next >= QUEUE.length;

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setFiles((fs) => fs.map((f) => (f.p < 100 ? { ...f, p: Math.min(100, f.p + 3) } : f))), 100);
    return () => clearInterval(id);
  }, [busy]);

  const cells = useMemo(() => {
    const out: (0 | 1 | 2)[] = Array.from({ length: VEC_TOTAL }, () => 0);
    let off = 0;
    files.forEach((f) => {
      for (let m = 0; m < litVectors(f); m++) out[off + m] = f.p >= 100 ? 2 : 1;
      off += f.vec;
    });
    return out;
  }, [files]);

  const add = () => {
    if (exhausted) {
      setFiles([SEED]);
      setNext(0);
      setSearched(false);
      return;
    }
    setFiles((fs) => [...fs, { ...QUEUE[next], p: 0 }]);
    setNext((n) => n + 1);
  };

  const search = () => {
    if (!text) setText(DEMO_QUERY);
    setSearched(true);
  };

  return (
    <Stage
      bg="linear-gradient(180deg, #0A3A9E 0%, #3F5BCB 45%, #A9A7F2 100%)"
      backdrop={
        <>
          <Block className="left-[-10%] top-[-30%] size-[60%] rounded-full bg-[#5B8CFF]/40 blur-3xl" k={30} />
          <span aria-hidden="true" className="absolute inset-0 opacity-30" style={dots('#fff', 6, 'linear-gradient(0deg, #000 0%, transparent 60%)', 22)} />
        </>
      }
    >
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <Title>Ingestion</Title>
          <span className="flex flex-wrap items-center gap-1.5">
            {busy && <Badge tone="mute">202 Accepted</Badge>}
            <Badge tone={busy ? 'mute' : 'ok'}>{busy ? 'Working in background' : 'All indexed'}</Badge>
          </span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {files.map((f) => {
            const done = f.p >= 100;
            return (
              <li key={f.name} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: done ? 'rgba(47,224,176,0.28)' : LINE }}>
                <div className="flex items-center gap-2 text-[13px]">
                  <FileText size={14} className="shrink-0 text-white/50" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="hidden text-[11px] text-white/40 min-[400px]:inline">{f.size}</span>
                  {done ? (
                    <Badge>
                      <Check size={10} strokeWidth={3} /> Indexed
                    </Badge>
                  ) : (
                    <span className="w-[54px] text-right font-mono text-[11px] text-white/70 min-[400px]:w-[62px]">{ingestStage(f.p)}</span>
                  )}
                </div>
                <div className="mt-1.5 flex gap-[3px]" aria-hidden="true">
                  {ING_STAGES.map((s, k) => (
                    <span key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${clamp01((f.p - ING_AT[k]) / (ING_AT[k + 1] - ING_AT[k])) * 100}%`, background: done ? OK : '#B4B7BE' }}
                      />
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-2.5">
          <Btn onClick={add}>
            {exhausted ? (
              <>
                <RotateCcw size={13} /> Reset
              </>
            ) : (
              `Upload ${QUEUE[next].name}`
            )}
          </Btn>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[10.5px] text-white/45">
          <span>vector index</span>
          <span>
            <span className="tabular-nums text-white/85">{cells.filter(Boolean).length}</span> / {VEC_TOTAL}
          </span>
        </div>
        <div className="mt-1.5 grid auto-cols-fr grid-flow-col grid-rows-2 gap-y-1.5" aria-hidden="true">
          {cells.map((c, k) => (
            <span
              key={k}
              className="size-2 justify-self-center rounded-full transition-colors duration-200"
              style={{
                background: c === 2 ? OK : c === 1 ? '#B4B7BE' : 'rgba(255,255,255,0.10)',
                outline: searched && k === HIT_CELL && c === 2 ? '1px solid #fff' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            aria-label="Search the index"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder={busy ? 'Keep typing, the UI is not blocked…' : 'Search the index…'}
            className={`h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-[13px] text-white placeholder:text-white/35 ${ring}`}
            style={{ borderColor: LINE }}
          />
          <Btn ghost onClick={search}>
            <Search size={13} /> Search
          </Btn>
        </div>
        <p className="mt-1.5 min-h-[34px] text-[11px] leading-[15px] text-white/70">
          {searched &&
            (indexed > 0 ? (
              <>
                <span className="font-mono text-white/45">refund_policy.pdf · p.4 · </span>
                <span style={{ color: OK }}>{hitText}</span>
              </>
            ) : (
              <span className="text-white/45">Nothing indexed yet.</span>
            ))}
        </p>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Memory: pronoun -> stored turn -> standalone rewrite -> answer   */
/* ------------------------------------------------------------------ */

type Part = { k: 'text' | 'drop' | 'add'; s: string };
interface FollowUp {
  parts: Part[];
  pron: string;
  ref: string;
  answer: string;
}

const t = (s: string): Part => ({ k: 'text', s });
const drop = (s: string): Part => ({ k: 'drop', s });
const add = (s: string): Part => ({ k: 'add', s });

const FOLLOW_UPS: FollowUp[] = [
  {
    parts: [t('How long does '), drop('it'), add('the refund credit'), t(' take'), add(' to post'), t('?')],
    pron: 'it',
    ref: 'refund credit',
    answer: 'Once verified, the refund credit posts to the original payment method within 3 to 5 business days.',
  },
  {
    parts: [t('Does '), drop('that'), add('the 30-day refund window'), t(' cover sale items?')],
    pron: 'that',
    ref: '30-day window',
    answer: 'Yes. Sale items follow the same 30-day window, counted from delivery.',
  },
  {
    parts: [t('Can I '), drop('do that'), add('submit a refund request'), t(' online?')],
    pron: 'do that',
    ref: 'refund request',
    answer: 'Yes. Refund requests can be submitted from the order page, with photo evidence attached there.',
  },
];

const original = (f: FollowUp) => f.parts.filter((p) => p.k !== 'add');
const MEM_TOKENS = [0, 7, 29, 35, 60]; // illustrative, indexed by turns retained
const MEM_SLOTS = ['turn-1-user', 'turn-1-assistant', 'turn-2-user', 'turn-2-assistant'];

function Bubble({ user = false, active = false, children }: { user?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <div
      className={`w-fit max-w-[92%] rounded-xl border px-3 py-1.5 text-[12.5px] leading-snug ${user ? 'ml-auto' : ''}`}
      style={{
        borderColor: active ? 'rgba(47,224,176,0.5)' : user ? 'rgba(255,255,255,0.26)' : LINE,
        background: user ? 'rgba(255,255,255,0.07)' : active ? OK_BG : 'transparent',
        color: user ? '#fff' : 'rgba(255,255,255,0.8)',
        transition: 'border-color .3s ease, background-color .3s ease',
      }}
    >
      {children}
    </div>
  );
}

const TraceChip = ({ children, lit }: { children: ReactNode; lit: boolean }) => (
  <span
    className="whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10.5px] transition-colors duration-300"
    style={{ borderColor: lit ? OK_LINE : LINE, background: lit ? OK_BG : 'transparent', color: lit ? OK : 'rgba(255,255,255,0.7)' }}
  >
    {children}
  </span>
);

function MemoryCard() {
  const [pick, setPick] = useState<number | null>(null);
  const [run, setRun] = useState(0);

  const stage = useStages(4, 800, pick === null ? null : `${pick}:${run}`);
  const view = FOLLOW_UPS[pick ?? 0]; // placeholder content keeps the layout height stable
  const answer = useTyped(view.answer, stage >= 3, 80);
  const turns = 2 + (pick !== null ? 1 : 0) + (stage >= 3 ? 1 : 0);
  const matching = stage >= 1 && stage < 3;

  return (
    <Stage
      bg="#E9E9E9"
      backdrop={
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-90 transition-transform duration-300 ease-out"
            style={{ backgroundImage: STREAK_URI, backgroundSize: '600px 600px', transform: 'translateX(calc(var(--mx, 0) * -30px))' }}
          />
          <span aria-hidden="true" className="absolute inset-x-0 top-[44%] h-[12%] bg-white/80 blur-[2px]" />
        </>
      }
    >
      <Panel>
        <div className="flex items-center justify-between gap-2 text-[12px] text-white/50">
          <span className="min-w-0 truncate">workspace thread</span>
          <Badge>
            <Lock size={10} /> ws_acme_489
          </Badge>
        </div>

        <div className="mt-3 space-y-1.5">
          <Bubble user>What is our refund policy?</Bubble>
          <div className="flex items-center gap-2">
            <Bubble active={matching}>Standard orders are refundable within 30 days of delivery.</Bubble>
            <span className="font-mono text-[10.5px] transition-opacity duration-300" style={{ color: OK, opacity: matching ? 1 : 0 }}>
              match
            </span>
          </div>
        </div>

        {/* follow-up slot: chips until one is picked, then the bubble with its pronoun traced */}
        <div className="mt-1.5 min-h-[62px]">
          {pick === null ? (
            <div role="radiogroup" aria-label="Ask a follow-up" className="flex flex-wrap justify-end gap-1.5">
              {FOLLOW_UPS.map((f, k) => (
                <Pill
                  key={f.pron}
                  on={false}
                  onClick={() => {
                    setPick(k);
                    setRun((r) => r + 1);
                  }}
                >
                  {original(f).map((p) => p.s).join('')}
                </Pill>
              ))}
            </div>
          ) : (
            <Bubble user>
              {original(view).map((p, i) =>
                p.k === 'drop' ? (
                  <span
                    key={i}
                    className="transition-colors duration-300"
                    style={{
                      textDecoration: stage >= 2 ? 'line-through' : stage >= 1 ? 'underline' : 'none',
                      textUnderlineOffset: 3,
                      color: stage >= 2 ? 'rgba(255,255,255,0.4)' : stage >= 1 ? OK : undefined,
                    }}
                  >
                    {p.s}
                  </span>
                ) : (
                  <span key={i}>{p.s}</span>
                ),
              )}
            </Bubble>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" style={reveal(stage >= 1)} aria-hidden={stage < 1}>
          <TraceChip lit={false}>“{view.pron}”</TraceChip>
          <span className="text-[11px] text-white/35">→</span>
          <TraceChip lit={matching}>turn-1-assistant</TraceChip>
          <span className="text-[11px] text-white/35">→</span>
          <TraceChip lit={stage >= 2}>{view.ref}</TraceChip>
        </div>

        <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: OK_LINE, background: OK_BG, ...reveal(stage >= 2) }} aria-hidden={stage < 2}>
          <div className="flex items-center justify-between font-mono text-[10.5px] text-white/50">
            <span>rewritten query</span>
            <span style={{ color: OK }}>standalone ✓</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-[24px]">
            {view.parts.map((p, i) =>
              p.k === 'add' ? (
                <span key={i} className="mx-0.5 rounded border px-1" style={{ borderColor: OK_LINE, color: OK }}>
                  {p.s}
                </span>
              ) : p.k === 'drop' ? (
                <span key={i} className="text-white/35 line-through">
                  {p.s}
                </span>
              ) : (
                <span key={i}>{p.s}</span>
              ),
            )}
          </p>
        </div>

        <div className="mt-2 min-h-[52px]" style={reveal(stage >= 3)} aria-hidden={stage < 3}>
          <Bubble>
            {answer}
            {stage >= 3 && answer.length < view.answer.length && <Caret />}
          </Bubble>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] text-white/45">
            <span className="flex gap-1" aria-label={`${turns} of 4 memory slots used`}>
              {MEM_SLOTS.map((name, k) => (
                <span
                  key={name}
                  title={name}
                  className="size-2.5 rounded-[3px] border transition-colors duration-300"
                  style={{
                    background: k < turns ? OK_BG : 'transparent',
                    borderColor: matching && k === 1 ? '#fff' : k < turns ? 'rgba(47,224,176,0.5)' : LINE,
                  }}
                />
              ))}
            </span>
            <span>
              est_tokens <span className="tabular-nums text-white/85">{MEM_TOKENS[turns]}</span>
            </span>
            {stage >= 4 && <span style={{ color: OK }}>resolved ✓</span>}
          </span>
          {pick !== null && <IconBtn label="Reset" onClick={() => setPick(null)} />}
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Streaming: wire + SSE frames + per-token timeline, cut + resume  */
/* ------------------------------------------------------------------ */

const WORDS =
  'Eligible orders can be returned within 30 days of delivery. Damaged items skip the return step: send a photo within 48 hours and the refund posts in 3 to 5 business days.'.split(
    ' ',
  );

const STREAM_SOURCES: [name: string, loc: string][] = [
  ['refund_policy.pdf', 'p.4'],
  ['returns_sop.md', 'l.84–112'],
];

type FrameTone = 'mute' | 'text' | 'warn' | 'ok';
type FrameDef = [text: string, tone: FrameTone];
interface Frame {
  key: number;
  text: string;
  tone: FrameTone;
}
interface StreamState {
  phase: 'idle' | 'streaming' | 'lost' | 'done';
  n: number;
  resumes: number;
  dropAt: number | null;
  seq: number;
  log: Frame[];
}
type StreamAction = 'start' | 'tick' | 'cut' | 'resume';

const STREAM_INITIAL: StreamState = { phase: 'idle', n: 0, resumes: 0, dropAt: null, seq: 0, log: [] };

const FRAME_COLOR: Record<FrameTone, string> = {
  mute: 'rgba(255,255,255,0.4)',
  text: 'rgba(255,255,255,0.85)',
  warn: WARN,
  ok: OK,
};

/** Append frames to the log (keeps the last 3). */
const logged = (s: StreamState, frames: FrameDef[]): Pick<StreamState, 'seq' | 'log'> => ({
  seq: s.seq + frames.length,
  log: [...s.log, ...frames.map(([text, tone], k): Frame => ({ key: s.seq + k, text, tone }))].slice(-3),
});

function streamReducer(s: StreamState, a: StreamAction): StreamState {
  switch (a) {
    case 'start':
      return { ...STREAM_INITIAL, phase: 'streaming', ...logged(STREAM_INITIAL, [['GET /stream', 'mute'], ['connection_open', 'mute']]) };
    case 'tick': {
      if (s.phase !== 'streaming') return s;
      const n = s.n + 1;
      const done = n >= WORDS.length;
      const frames: FrameDef[] = [[`id: ${n} · ${n === 1 ? 'first_token' : 'answer_delta'}`, 'text']];
      if (done) frames.push(['complete · 200', 'ok']);
      return { ...s, n, phase: done ? 'done' : 'streaming', ...logged(s, frames) };
    }
    case 'cut':
      if (s.phase !== 'streaming' || s.n === 0) return s;
      return { ...s, phase: 'lost', dropAt: s.n, ...logged(s, [[`reset · last id ${s.n}`, 'warn']]) };
    case 'resume':
      if (s.phase !== 'lost') return s;
      return {
        ...s,
        phase: 'streaming',
        resumes: s.resumes + 1,
        ...logged(s, [[`Last-Event-ID: ${s.n}`, 'ok'], [`open · resume_from ${s.n + 1}`, 'ok']]),
      };
  }
}

function StreamingCard() {
  const [s, dispatch] = useReducer(streamReducer, STREAM_INITIAL);
  const { phase, n, dropAt, resumes } = s;

  useEffect(() => {
    if (phase !== 'streaming') return;
    const id = setInterval(() => dispatch('tick'), 90);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'lost') return;
    const id = setTimeout(() => dispatch('resume'), 1400);
    return () => clearTimeout(id);
  }, [phase]);

  const status = { idle: 'ready', lost: 'connection lost', done: 'complete', streaming: 'streaming' }[phase];

  return (
    <Stage
      bg="#D3D9E2"
      backdrop={
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 select-none overflow-hidden whitespace-pre font-mono text-[11px] leading-[14px] tracking-[0.35em] text-black/60"
            style={{ WebkitMaskImage: 'linear-gradient(160deg, transparent 35%, #000 100%)', maskImage: 'linear-gradient(160deg, transparent 35%, #000 100%)' }}
          >
            {Array.from({ length: 36 }, (_, i) => (i % 3 === 0 ? '0 1 0 0 1 0 0 0 1 0 0 0 0 1 0 0 0 0' : '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0')).join('\n')}
          </span>
          <span aria-hidden="true" className="absolute inset-0" style={dots('#0B0B0C', 7, 'linear-gradient(80deg, #000 0%, transparent 45%)', 34)} />
          <Block className="left-[8%] top-[-4%] h-[20%] w-[24%] bg-[#FFB02B]" k={-20} />
          <Block className="bottom-[-3%] left-[-4%] h-[30%] w-[24%] bg-[#FFB02B]" k={20} />
          <Block className="right-[0%] top-[32%] h-[18%] w-[9%] bg-[#FFB02B]" k={-12} />
        </>
      }
    >
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <Title>Live answer</Title>
          <Badge tone={phase === 'lost' ? 'bad' : phase === 'idle' ? 'mute' : 'ok'}>
            {phase === 'streaming' && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
            {status}
          </Badge>
        </div>

        <p className="mt-3 min-h-[64px] text-[13px] leading-[21px] text-white/85">
          {phase === 'idle' ? (
            <span className="text-white/35">Press Stream answer to start.</span>
          ) : (
            WORDS.slice(0, n).map((w, i) => (
              <span key={i} style={{ color: dropAt !== null && i >= dropAt ? '#9CF2D8' : undefined }}>
                {w}{' '}
              </span>
            ))
          )}
          {phase === 'streaming' && <Caret />}
          {phase === 'lost' && (
            <span className="ml-1 rounded border px-1.5 font-mono text-[11px]" style={{ borderColor: 'rgba(255,122,122,0.4)', color: BAD }}>
              reconnecting…
            </span>
          )}
        </p>

        {/* the wire: a dot per token, cut when the connection drops */}
        <div className="mt-2 flex h-6 items-center gap-2 font-mono text-[10px] text-white/45">
          <span>server</span>
          <div className="relative h-0 flex-1 border-t border-dashed border-white/20">
            {phase === 'streaming' && (
              <span
                key={n}
                className="qp-travel absolute top-1/2 size-[5px] -translate-y-1/2 rounded-full"
                style={{ background: dropAt !== null ? OK : '#fff' }}
              />
            )}
            {phase === 'lost' && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5" style={{ background: INK, color: BAD }}>
                ✕ cut
              </span>
            )}
          </div>
          <span>client</span>
        </div>

        <div className="mt-1 h-[54px] overflow-hidden font-mono text-[10.5px] leading-[18px]" aria-hidden="true">
          {s.log.map((f) => (
            <div key={f.key} className="truncate" style={{ color: FRAME_COLOR[f.tone] }}>
              {f.text}
            </div>
          ))}
        </div>

        {/* arrival timeline: one bar per token, a gap where the connection dropped */}
        <div className="mt-2 flex h-[28px] items-end gap-[2px]" aria-hidden="true">
          {WORDS.map((_, i) => {
            const on = i < n;
            return (
              <Fragment key={i}>
                {dropAt !== null && i === dropAt && (
                  <span
                    className="mx-0.5 flex h-full w-7 shrink-0 items-center justify-center rounded-[3px] border border-dashed font-mono text-[9px] min-[400px]:w-9"
                    style={{ borderColor: 'rgba(255,184,77,0.5)', color: WARN }}
                  >
                    drop
                  </span>
                )}
                <span
                  className="min-w-0 flex-1 rounded-[2px] transition-colors duration-150"
                  style={{
                    height: on ? `${35 + ((i * 37) % 65)}%` : 2,
                    background: !on
                      ? 'rgba(255,255,255,0.12)'
                      : phase === 'done'
                        ? OK
                        : dropAt !== null && i >= dropAt
                          ? 'rgba(47,224,176,0.7)'
                          : i === n - 1
                            ? '#fff'
                            : 'rgba(255,255,255,0.55)',
                  }}
                />
              </Fragment>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 font-mono text-[11px] text-white/45" style={{ borderColor: LINE }}>
          <span>
            tokens <span className="text-white/85">{n}</span>
          </span>
          <span>
            resumes <span className="text-white/85">{resumes}</span>
          </span>
          <span>
            Last-Event-ID <span className="text-white/85">{n || '—'}</span>
          </span>
        </div>

        <div className="mt-2 flex min-h-[26px] flex-wrap gap-1.5">
          {STREAM_SOURCES.map(([name, loc], k) => (
            <span
              key={name}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10.5px] text-white/75"
              style={{ borderColor: OK_LINE, background: OK_BG, ...reveal(phase === 'done', k * 150) }}
            >
              <Check size={10} strokeWidth={3} className="shrink-0" style={{ color: OK }} />
              <span className="min-w-0 truncate">{name}</span>
              <span className="shrink-0 text-white/45">· {loc}</span>
            </span>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <Btn onClick={() => dispatch('start')} disabled={phase === 'streaming' || phase === 'lost'}>
            {phase === 'done' ? (
              <>
                <RotateCcw size={13} /> Stream again
              </>
            ) : (
              <>
                <Play size={12} fill="currentColor" /> Stream answer
              </>
            )}
          </Btn>
          <Btn ghost onClick={() => dispatch('cut')} disabled={phase !== 'streaming' || n === 0}>
            <Scissors size={13} /> Cut connection
          </Btn>
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Spreadsheets: phrases <-> numbered SQL, guard checks, DELETE     */
/* ------------------------------------------------------------------ */

type SheetRow = [id: string, status: string, reason: string, amount: number];

const ROWS: SheetRow[] = [
  ['ORD-9412', 'refunded', 'damaged', 240],
  ['ORD-9413', 'delivered', '—', 1120],
  ['ORD-9414', 'refunded', 'damaged', 89.5],
  ['ORD-9415', 'pending', '—', 64],
  ['ORD-9416', 'refunded', 'late', 312],
];
const MAX_REFUND = Math.max(...ROWS.filter((r) => r[1] === 'refunded').map((r) => r[3]));
const sumOf = (rows: SheetRow[]) => rows.reduce((a, r) => a + r[3], 0);
const countAndTotal = (h: SheetRow[]): [string, string][] => [['rows', String(h.length)], ['total', money(sumOf(h))]];

interface SheetQuery {
  label: string;
  segs: Seg[];
  sql: { text: string; ref?: number }[];
  hit: (r: SheetRow) => boolean;
  metrics: (hits: SheetRow[]) => [label: string, value: string][];
}

const AGG = { text: 'SELECT COUNT(*), SUM(amount)', ref: 1 };

const QUERIES: SheetQuery[] = [
  {
    label: 'Refunded orders',
    segs: [['How many', 1], [' orders were ', null], ['refunded', 2], ['?', null]],
    sql: [AGG, { text: 'FROM orders' }, { text: "WHERE status = 'refunded';", ref: 2 }],
    hit: (r) => r[1] === 'refunded',
    metrics: countAndTotal,
  },
  {
    label: 'Damaged items',
    segs: [['Total value', 1], [' of ', null], ['damaged', 2], [' items?', null]],
    sql: [AGG, { text: 'FROM orders' }, { text: "WHERE reason = 'damaged';", ref: 2 }],
    hit: (r) => r[2] === 'damaged',
    metrics: countAndTotal,
  },
  {
    label: 'Biggest refund',
    segs: [['Biggest', 1], [' ', null], ['refund', 2], ['?', null]],
    sql: [{ text: 'SELECT order_id, MAX(amount)', ref: 1 }, { text: 'FROM orders' }, { text: "WHERE status = 'refunded';", ref: 2 }],
    hit: (r) => r[1] === 'refunded' && r[3] === MAX_REFUND,
    metrics: (h) => [['order', h[0]?.[0] ?? '—'], ['amount', money(h[0]?.[3] ?? 0)]],
  },
];

const GUARDS = ['1 statement', 'SELECT only', 'orders allowlisted', 'query_only ON'];
// fixed-ratio columns with a small gap, so nothing collides on narrow phones
const SHEET_GRID =
  'grid h-[22px] grid-cols-[minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-x-1.5 px-2 text-[10px] sm:px-2.5 sm:text-[11px] [&>span]:min-w-0 [&>span]:truncate';

function SheetCard() {
  const [qi, setQi] = useState(0);
  const [run, setRun] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const q = QUERIES[qi];
  const stage = useStages(3, 700, `${qi}:${run}`);

  const replay = () => {
    setBlocked(false);
    setRun((r) => r + 1);
  };

  return (
    <Stage
      bg="linear-gradient(180deg, #2A1712 0%, #6B3426 38%, #C28A4A 80%, #E3B466 100%)"
      backdrop={
        <>
          <Block className="right-[-14%] top-[8%] size-[56%] rounded-full bg-[#FF8A3D]/30 blur-3xl" k={-26} />
          <span aria-hidden="true" className="absolute inset-0 opacity-25" style={dots('#000', 6, 'linear-gradient(200deg, #000 0%, transparent 55%)', 26)} />
        </>
      }
    >
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Question" className="flex flex-wrap gap-1.5">
            {QUERIES.map((x, k) => (
              <Pill
                key={x.label}
                on={k === qi}
                onClick={() => {
                  setBlocked(false);
                  setHover(null);
                  if (k === qi) setRun((r) => r + 1);
                  else setQi(k);
                }}
              >
                {x.label}
              </Pill>
            ))}
          </div>
          <Badge tone="mute">
            <Lock size={10} /> read-only
          </Badge>
        </div>

        <div className="mt-2 rounded-md border" style={{ borderColor: LINE, background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-2 border-b px-3 py-2.5 text-[13px] leading-[28px] sm:py-1.5 sm:leading-[24px]" style={{ borderColor: LINE }}>
            <Search size={13} className="shrink-0 text-white/45" />
            <span className="min-w-0">{renderSegs(q.segs, stage >= 1, hover, setHover)}</span>
          </div>
          <div className="overflow-x-auto py-2 font-mono text-[10.5px] leading-[18px] text-white/75 [scrollbar-width:none] sm:text-[11px] [&::-webkit-scrollbar]:hidden">
            {q.sql.map((l, i) => (
              <div
                key={l.text}
                className="flex items-center"
                style={reveal(stage >= 1, i * 110)}
                onMouseEnter={() => l.ref && setHover(l.ref)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="flex w-7 shrink-0 justify-center">{l.ref && <NumBadge n={l.ref} hot={hover === l.ref} />}</span>
                <span className="whitespace-pre pr-2">
                  <Sql text={l.text} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {GUARDS.map((g, k) => {
            const isBlock = blocked && g === 'SELECT only';
            return (
              <span
                key={g}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-1 font-mono text-[10.5px] text-white/80"
                style={{
                  borderColor: isBlock ? 'rgba(255,122,122,0.5)' : OK_LINE,
                  background: isBlock ? 'rgba(255,122,122,0.12)' : OK_BG,
                  ...reveal(stage >= 2, k * 160),
                }}
              >
                {isBlock ? <Lock size={10} style={{ color: BAD }} /> : <Check size={10} strokeWidth={3} style={{ color: OK }} />}
                {g}
              </span>
            );
          })}
        </div>

        <div className="mt-2 overflow-hidden rounded-md border font-mono" style={{ borderColor: LINE }}>
          <div className={`${SHEET_GRID} text-white/40`} style={{ borderBottom: `1px solid ${LINE}` }}>
            <span>order_id</span>
            <span>status</span>
            <span>reason</span>
            <span className="text-right">amount</span>
          </div>
          {ROWS.map((r, k) => {
            const hit = stage >= 3 && q.hit(r);
            return (
              <div
                key={r[0]}
                className={`${SHEET_GRID} transition-colors duration-300`}
                style={{
                  background: hit ? OK_BG : 'transparent',
                  color: hit ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: hit ? `inset 2px 0 0 ${OK}` : 'none',
                  borderTop: k ? `1px solid ${LINE}` : 'none',
                  transitionDelay: `${hit ? k * 90 : 0}ms`,
                }}
              >
                <span>{r[0]}</span>
                <span>{r[1]}</span>
                <span>{r[2]}</span>
                <span className="text-right">{money(r[3])}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex min-h-[32px] flex-wrap items-center justify-between gap-2">
          {blocked ? (
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: OK }}>
              <Lock size={12} /> Rejected before execution
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]" style={reveal(stage >= 3, 200)}>
              {q.metrics(ROWS.filter(q.hit)).map(([label, value]) => (
                <span key={label} className="text-white/55">
                  {label} <span className="tabular-nums text-white">{value}</span>
                </span>
              ))}
            </span>
          )}
          <span className="flex shrink-0 items-center gap-1.5">
            <IconBtn label="Replay query" onClick={replay} />
            <Btn ghost small onClick={() => setBlocked(true)} disabled={blocked || stage < 3}>
              Try a DELETE
            </Btn>
          </span>
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Isolation: a packet crosses four gates and stops at the first no */
/* ------------------------------------------------------------------ */

const LAYERS = ['token', 'vfs', 'vector', 'sqlite'];
const GATE_PCT = [17, 37, 57, 77];
const END_PCT = 94;

interface Probe {
  label: string;
  req: string;
  stop: number | null; // index of the layer that rejects it, or null if allowed
  reason: string;
}

const PROBES: Probe[] = [
  { label: 'Query own partition', req: 'search("refund rules")', stop: null, reason: '3 sources · own data' },
  { label: 'Forged tenant claim', req: 'x-tenant: ws_retail_902', stop: 0, reason: 'claim ≠ token sub' },
  { label: 'Path traversal', req: 'read("../ws_retail_902/…")', stop: 1, reason: 'escapes mount root' },
  { label: 'Cross-namespace search', req: 'namespace = "ws_retail_902"', stop: 2, reason: 'not in token scopes' },
  { label: 'ATTACH other database', req: "ATTACH 'ws_retail_902/…'", stop: 3, reason: 'ATTACH denied' },
];

type RunState = 'idle' | 'running' | 'done';
type Mark = 'idle' | 'passed' | 'blocked' | 'skipped';
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_56px] items-center gap-x-3 gap-y-1 sm:grid-cols-[128px_minmax(0,1fr)_56px]';

function IsolationCard() {
  const reduce = useMediaQuery(REDUCED);
  const [status, setStatus] = useState<RunState[]>(() => PROBES.map(() => 'idle'));
  const runAll = useRef(false);

  const start = useCallback((i: number) => {
    setStatus((s) => (s[i] === 'idle' ? s.map((v, k) => (k === i ? 'running' : v)) : s));
  }, []);

  const finish = useCallback((i: number) => {
    setStatus((prev) => {
      const nextStatus = prev.map((v, k): RunState => (k === i ? 'done' : v));
      const j = runAll.current ? nextStatus.indexOf('idle') : -1;
      if (j >= 0) nextStatus[j] = 'running';
      return nextStatus;
    });
  }, []);

  const startAll = () => {
    runAll.current = true;
    setStatus((prev) => {
      const j = prev.indexOf('idle');
      return prev.includes('running') || j < 0 ? prev : prev.map((v, k): RunState => (k === j ? 'running' : v));
    });
  };

  const reset = () => {
    runAll.current = false;
    setStatus(PROBES.map(() => 'idle'));
  };

  const done = status.map((s) => s === 'done');
  const finished = done.filter(Boolean).length;
  const blockedCount = PROBES.filter((p, i) => done[i] && p.stop !== null).length;
  const allDone = finished === PROBES.length;

  const ledger = LAYERS.map((_, g) => {
    const seen = PROBES.filter((_, i) => done[i]);
    return { pass: seen.filter((p) => p.stop === null || p.stop > g).length, deny: seen.filter((p) => p.stop === g).length };
  });

  return (
    <Stage
      bg="#D9DBE8"
      backdrop={
        <>
          <span aria-hidden="true" className="absolute inset-0" style={dots('#0B0B0C', 7, 'linear-gradient(120deg, #000 0%, transparent 52%)', 34)} />
          <span aria-hidden="true" className="absolute inset-0" style={dots('#0B0B0C', 7, 'linear-gradient(300deg, #000 0%, transparent 48%)', 34)} />
          <Block className="left-[6%] top-[-4%] h-[26%] w-[15%] bg-[#5865D4]" k={-20} />
          <Block className="bottom-[-4%] right-[12%] h-[20%] w-[17%] bg-[#5865D4]" k={18} />
          <Block className="right-[-3%] top-[40%] h-[14%] w-[7%] bg-[#5865D4]" k={-14} />
        </>
      }
    >
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <Title>Workspace boundary</Title>
          <Badge>
            <Lock size={10} /> ws_acme_489
          </Badge>
        </div>

        {/* layer names, aligned with the tracks below */}
        <div className={`${ROW_GRID} mt-3 px-[11px]`} aria-hidden="true">
          <span className="hidden sm:block" />
          <span className="relative col-span-2 block h-4 font-mono text-[9.5px] text-white/40 sm:col-span-1">
            {[...LAYERS, 'data'].map((name, g) => (
              <span key={name} className="absolute top-0 -translate-x-1/2" style={{ left: `${g < 4 ? GATE_PCT[g] : END_PCT}%` }}>
                {name}
              </span>
            ))}
          </span>
          <span className="hidden sm:block" />
        </div>

        <ul className="mt-1 space-y-1.5">
          {PROBES.map((p, i) => {
            const st = status[i];
            const isDone = st === 'done';
            const denied = p.stop !== null;
            const stopPct = denied ? GATE_PCT[p.stop as number] : END_PCT;

            return (
              <li
                key={p.label}
                className={`${ROW_GRID} rounded-lg border px-2.5 py-1.5 transition-colors duration-300`}
                style={{ borderColor: isDone ? OK_LINE : LINE, background: isDone ? OK_BG : 'transparent' }}
              >
                <span className="col-start-1 row-start-1 min-w-0">
                  <span className="block truncate text-[12px]">{p.label}</span>
                  <span className="block truncate font-mono text-[10px]" style={{ color: isDone ? OK : 'rgba(255,255,255,0.4)' }}>
                    {isDone ? p.reason : p.req}
                  </span>
                </span>

                <span className="relative col-span-2 col-start-1 row-start-2 block h-6 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
                  {isDone && (
                    <span
                      className="absolute left-0 top-1/2 h-px -translate-y-1/2"
                      style={{ width: `${stopPct}%`, background: denied ? 'rgba(255,255,255,0.45)' : OK }}
                    />
                  )}

                  {[...GATE_PCT, END_PCT].map((pct, g) => {
                    let mark: Mark = 'idle';
                    if (isDone) {
                      if (g === 4) mark = denied ? 'skipped' : 'passed';
                      else if (p.stop === null || g < p.stop) mark = 'passed';
                      else mark = g === p.stop ? 'blocked' : 'skipped';
                    }
                    const lit = mark === 'passed' || mark === 'blocked';
                    return (
                      <Fragment key={g}>
                        {mark === 'blocked' && (
                          <span
                            aria-hidden="true"
                            className="qp-ripple pointer-events-none absolute size-[14px] rounded-full border"
                            style={{ left: `${pct}%`, top: '50%', borderColor: OK }}
                          />
                        )}
                        <span
                          className="absolute top-1/2 flex size-[14px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-colors duration-300"
                          style={{
                            left: `${pct}%`,
                            background: lit ? OK_BG : INK,
                            borderColor: lit ? 'rgba(47,224,176,0.5)' : 'rgba(255,255,255,0.25)',
                            borderStyle: mark === 'skipped' ? 'dashed' : 'solid',
                            opacity: mark === 'skipped' ? 0.5 : 1,
                          }}
                        >
                          {mark === 'passed' && <Check size={9} strokeWidth={3} style={{ color: OK }} />}
                          {mark === 'blocked' && <Lock size={9} style={{ color: OK }} />}
                        </span>
                      </Fragment>
                    );
                  })}

                  {st === 'running' && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                      initial={{ left: '0%' }}
                      animate={{ left: `${stopPct}%` }}
                      transition={{ duration: reduce ? 0 : (stopPct / 100) * 1.5, ease: 'linear' }}
                      onAnimationComplete={() => finish(i)}
                    />
                  )}
                </span>

                <span className="col-start-2 row-start-1 flex justify-end sm:col-start-3">
                  {st === 'idle' && (
                    <Btn ghost small onClick={() => start(i)}>
                      Run
                    </Btn>
                  )}
                  {st === 'running' && <Badge tone="mute">Running</Badge>}
                  {isDone && <Badge>{denied ? 'Blocked' : 'Allowed'}</Badge>}
                </span>
              </li>
            );
          })}
        </ul>

        {/* what each layer has allowed / denied so far */}
        <div className={`${ROW_GRID} mt-1.5 px-[11px]`} aria-hidden="true">
          <span className="hidden font-mono text-[9.5px] text-white/40 sm:block">ledger</span>
          <span className="relative col-span-2 block h-4 font-mono text-[9.5px] sm:col-span-1">
            {LAYERS.map((name, g) => (
              <span key={name} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${GATE_PCT[g]}%` }}>
                <span className="text-white/75">✓{ledger[g].pass}</span>{' '}
                <span style={{ color: ledger[g].deny ? OK : 'rgba(255,255,255,0.35)' }}>✕{ledger[g].deny}</span>
              </span>
            ))}
          </span>
          <span className="hidden sm:block" />
        </div>

        <div className="mt-2.5 flex min-h-[32px] flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Btn onClick={startAll} disabled={allDone || status.includes('running')}>
              Run all
            </Btn>
            <IconBtn label="Reset probes" onClick={reset} />
          </span>
          {allDone ? (
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: OK }}>
              <ShieldCheck size={13} /> Boundary held · audit logged
            </span>
          ) : (
            <span className="font-mono text-[11px] text-white/45">
              {finished}/{PROBES.length} probes · {blockedCount} blocked · leaked <span style={{ color: OK }}>0</span>
            </span>
          )}
        </div>
      </Panel>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* Feature list                                                        */
/* ------------------------------------------------------------------ */

interface Feature {
  tab: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  label: string;
  Card: ComponentType;
}

const FEATURES: Feature[] = [
  {
    tab: 'Planner',
    title: 'The Planner',
    description:
      'Reads the question, works out what it actually refers to, and decides where the answer has to come from: a document, a table, memory, or a mix. Nothing gets searched until the plan is built.',
    points: ['Routes to documents, tables, or both', 'Turns “last month” into real date bounds', 'Every answer ships with its sources'],
    cta: 'See how planning works',
    label: 'Interactive card: pick a question and see how it is planned across documents, tables and metadata.',
    Card: PlannerCard,
  },
  {
    tab: 'Ingestion',
    title: 'Background Ingestion',
    description:
      'Uploads don’t block anything. Files are parsed, chunked, embedded and indexed on workers in the background, so you keep working while they become searchable.',
    points: ['HTTP 202 the moment the file lands', 'Parse, chunk and embed fan out across workers', 'Searchable the second indexing finishes'],
    cta: 'See the ingestion pipeline',
    label: 'Interactive card: upload a file and watch it index while the UI stays responsive.',
    Card: IngestionCard,
  },
  {
    tab: 'Memory',
    title: 'Memory Across Turns',
    description:
      'Every workspace remembers its own conversation. Ask a follow-up and say ‘it’ or ‘that one’, and QueryPilot still knows what you mean, so there’s no repeating yourself.',
    points: ['Resolves “it”, “that one” and “he”', 'Rewrites follow-ups into standalone questions', 'Memory is scoped to the workspace'],
    cta: 'See memory in action',
    label: 'Interactive card: a follow-up question is resolved against an earlier answer and rewritten.',
    Card: MemoryCard,
  },
  {
    tab: 'Streaming',
    title: 'Live Streaming Answers',
    description:
      'Answers stream in token by token over SSE as they’re generated, then finalize with sources and execution state attached. No spinners, and no waiting for the whole response.',
    points: ['First token while retrieval is still wrapping up', 'A dropped connection resumes from the last event', 'Sources attached when the answer completes'],
    cta: 'See streaming in action',
    label: 'Interactive card: stream an answer, cut the connection, and watch it resume.',
    Card: StreamingCard,
  },
  {
    tab: 'Spreadsheets',
    title: 'Ask Your Spreadsheets',
    description:
      'XLSX and CSV files become real SQLite tables with inferred schemas. Your question is turned into safe, read-only SQL, so nobody has to write queries or know table names.',
    points: ['XLSX and CSV become real SQLite tables', 'Read-only SQL, checked before it runs', 'Writes are rejected, never executed'],
    cta: 'See structured queries run',
    label: 'Interactive card: pick a question to see its read-only SQL, then try a write that gets rejected.',
    Card: SheetCard,
  },
  {
    tab: 'Isolation',
    title: 'Hard Workspace Boundaries',
    description:
      'Documents, tables, retrieval and memory are all scoped per workspace. One tenant’s data physically can’t show up in another’s answer: it’s enforced, not assumed.',
    points: ['Four independent checks on every request', 'A probe stops at the first layer that says no', 'Every decision is audit logged'],
    cta: 'See isolation enforced',
    label: 'Interactive card: run five probes against four enforcement layers; nothing leaks.',
    Card: IsolationCard,
  },
];

const COUNT = FEATURES.length;

/* ------------------------------------------------------------------ */
/* Stage wrapper: pauses the tour while you play with the card         */
/* ------------------------------------------------------------------ */

function StagePanel({
  index,
  reduce,
  onHover,
  onTouch,
}: {
  index: number;
  reduce: boolean;
  onHover: (h: boolean) => void;
  onTouch: () => void;
}) {
  const { Card, label } = FEATURES[index];
  return (
    <div
      className="relative w-full min-w-0 self-center"
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onPointerDown={onTouch}
    >
      <motion.div
        role="group"
        aria-label={label}
        initial={reduce ? false : { opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Active tab silhouette                                               */
/* ------------------------------------------------------------------ */

function TabEar({ r, side }: { r: number; side: 'left' | 'right' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const s = r + 1;
  const arc = `M 0.5 ${r + 0.5} A ${r} ${r} 0 0 0 ${r + 0.5} 0.5`;
  const fill = `${arc} L ${s} 0.5 L ${s} ${s} L 0.5 ${s} Z`;
  const pos: CSSProperties = side === 'left' ? { right: 'calc(100% - 1px)' } : { left: 'calc(100% - 1px)', transform: 'scaleX(-1)' };

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute bottom-0"
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ ...pos, overflow: 'visible' }}
    >
      <defs>
        <pattern id={`qp-grain-${uid}`} width="160" height="160" patternUnits="userSpaceOnUse">
          <image href={GRAIN_URI} width="160" height="160" />
        </pattern>
      </defs>
      <path d={fill} fill={PANEL_BG} />
      <path d={fill} fill={`url(#qp-grain-${uid})`} opacity="0.12" />
      <path d={arc} fill="none" stroke={PANEL_LINE_SOLID} strokeWidth="1" />
    </svg>
  );
}

function ActiveTabShape({ r, left, right, animate }: { r: number; left: boolean; right: boolean; animate: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      initial={animate ? { clipPath: 'inset(100% -48px 0px -48px)' } : false}
      animate={{ clipPath: 'inset(0% -48px 0px -48px)' }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <span
        className="absolute inset-0 overflow-hidden"
        style={{
          background: PANEL_BG,
          borderStyle: 'solid',
          borderColor: PANEL_LINE_SOLID,
          borderWidth: '1px 1px 0 1px',
          borderRadius: `${r}px ${r}px 0 0`,
        }}
      >
        <span className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
      </span>
      {left && <TabEar r={r} side="left" />}
      {right && <TabEar r={r} side="right" />}
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* Copy (bullets light up with the tour)                               */
/* ------------------------------------------------------------------ */

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const rise: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } } };

function CopyBlock({ feature, lit, live, reduce }: { feature: Feature; lit: number; live: boolean; reduce: boolean }) {
  const last = feature.points.length - 1;

  return (
    <motion.div
      variants={stagger}
      initial={live && !reduce ? 'hidden' : false}
      animate="show"
      aria-hidden={live ? undefined : true}
      className={`col-start-1 row-start-1 min-w-0 ${live ? '' : 'invisible'}`}
    >
      <motion.h3 variants={rise} className="text-[18px] font-medium leading-[1.3] tracking-[-0.015em] text-white">
        {feature.title}
      </motion.h3>

      <motion.p variants={rise} className="mt-3 max-w-[520px] text-[16px] leading-[1.6] text-white/70 min-[1100px]:max-w-none">
        {feature.description}
      </motion.p>

      <motion.ul variants={rise} className="mt-5 space-y-2.5">
        {feature.points.map((text, i) => {
          const on = i < lit;
          return (
            <li
              key={text}
              className={`relative flex items-start gap-2.5 text-[15px] leading-[23px] transition-colors duration-300 ${on ? 'text-white/90' : 'text-white/50'}`}
            >
              {i < last && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[6.5px] top-[21px] -bottom-[14px] w-px transition-colors duration-500 ${i + 1 < lit ? 'bg-[#8FBF98]/50' : 'bg-white/10'}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative mt-[4px] flex size-[14px] shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${on ? 'border-[#8FBF98]/60 bg-[#8FBF98]/15' : 'border-white/20'}`}
              >
                <Check size={9} strokeWidth={3} className={`text-[#8FBF98] transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-0'}`} />
              </span>
              <span className="min-w-0">{text}</span>
            </li>
          );
        })}
      </motion.ul>

      <motion.div variants={rise}>
        <Link
          href={ENGINEERING_HREF}
          tabIndex={live ? undefined : -1}
          className="qp-cta group mt-6 inline-flex w-fit items-center gap-2 text-[14px] font-medium text-white"
        >
          <span>{feature.cta}</span>
          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [lit, setLit] = useState(0);
  const [tour, setTour] = useState(true); // on until the round ends or someone takes over
  const [hovering, setHovering] = useState(false);
  const [focusedIn, setFocusedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null); // tall scroll track (the component root)
  const shellRef = useRef<HTMLDivElement>(null); // the window; sticky while pinned
  const tabsRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const progRef = useRef(0);
  const withinRef = useRef(0); // 0..1 progress through the active feature (scroll mode)
  const pinnedRef = useRef(false);

  const inView = useInView(shellRef, 0.2);
  const reduceMotion = useMediaQuery(REDUCED);
  const wide = useMediaQuery(PIN_QUERY);
  const tabR = useTabRadius();
  const roomy = useMediaQuery('(min-width: 640px)');

  const pinned = wide && !reduceMotion; // scroll-driven mode
  pinnedRef.current = pinned;

  const auto = tour && !reduceMotion && !pinned; // timed tour (fallback)
  const running = auto && inView && !hovering && !focusedIn;
  const shown = auto || pinned ? lit : FEATURES[active].points.length; // every bullet is lit once the tour is off

  useEffect(() => setHydrated(true), []);

  const select = useCallback((i: number) => {
    const track = trackRef.current;
    const shell = shellRef.current;
    if (pinnedRef.current && track && shell) {
      // scroll mode: jump the page to the middle of that feature's slice
      const range = track.offsetHeight - shell.offsetHeight;
      const top = parseFloat(shell.style.top) || 0;
      const y = window.scrollY + track.getBoundingClientRect().top - top + ((i + 0.5) / COUNT) * range;
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      return;
    }
    setTour(false); // going anywhere by hand ends the tour for good
    setActive(i);
  }, []);

  const paint = useCallback((p: number) => {
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(RING_C * (1 - p));
  }, []);

  /* New tab, or tour over: restart the clock and empty the ring. (Not in scroll mode: scroll owns it.) */
  useEffect(() => {
    if (pinned) return;
    progRef.current = 0;
    setLit(0);
    paint(0);
  }, [active, tour, paint, pinned]);

  /* Scroll mode: size the track, pin the window, and turn scroll position into (feature, progress). */
  useEffect(() => {
    const track = trackRef.current;
    const shell = shellRef.current;
    if (!track || !shell) return;
    if (!pinned) {
      track.style.height = '';
      shell.style.top = '';
      return;
    }

    let raf = 0;
    const measure = () => {
      raf = 0;
      const vh = window.innerHeight;
      const h = shell.offsetHeight;
      const range = COUNT * Math.round(vh * STEP_VH);

      // centred when it fits; if a card makes the window taller than the screen, line up its bottom edge instead
      const top = Math.min(Math.max(PIN_TOP, (vh - h) / 2), vh - h - 8);
      shell.style.top = `${Math.round(top)}px`;
      track.style.height = `${h + range}px`;

      const p = clamp01((top - track.getBoundingClientRect().top) / range);
      const seg = p * COUNT;
      const idx = Math.min(COUNT - 1, Math.floor(seg));
      const within = p >= 1 ? 1 : seg - idx;

      withinRef.current = within;
      paint(within);
      setLit(BULLET_AT.filter((x) => within >= x).length);
      setActive((prev) => (prev === idx ? prev : idx));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule); // a card growing (e.g. more uploads) changes the window height
    ro.observe(shell);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [pinned, paint]);

  /* The ring is remounted with each active tab: repaint it at the current scroll progress. */
  useEffect(() => {
    if (pinned) paint(withinRef.current);
  }, [active, pinned, paint]);

  /* One clock: fills the ring, lights the bullets, then moves on. After the last tab it returns to Planner and stops. */
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max(now - last, 0), 100); // clamped: a hidden browser tab never makes it jump
      last = now;
      const p = (progRef.current = Math.min(1, progRef.current + dt / DWELL_MS));
      paint(p);
      setLit(BULLET_AT.filter((x) => p >= x).length);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (active === COUNT - 1) setTour(false);
      setActive((active + 1) % COUNT);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, active, paint]);

  /* Keep the active tab in view in the scrollable strip (small screens). */
  useEffect(() => {
    const strip = tabsRef.current;
    const btn = strip?.children[active] as HTMLElement | undefined;
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.clientWidth) / 2, behavior: 'smooth' });
  }, [active]);

  const onTabKeys = (e: ReactKeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: (active + 1) % COUNT, ArrowLeft: (active + COUNT - 1) % COUNT, Home: 0, End: COUNT - 1 };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next);
    (tabsRef.current?.children[next] as HTMLElement | undefined)?.focus();
  };

  // 1-6 jump straight to a feature (ignored while typing in a card's input).
  const onShellKeys = (e: ReactKeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= COUNT) select(n - 1);
  };

  const onFocusCapture = (e: ReactFocusEvent) => {
    try {
      if ((e.target as HTMLElement).matches(':focus-visible')) setFocusedIn(true);
    } catch {
      /* :focus-visible unsupported */
    }
  };
  const onBlurCapture = (e: ReactFocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusedIn(false);
  };

  return (
    <div ref={trackRef} className="qp-features-root relative isolate" style={{ overflowAnchor: 'none' }}>
      <style>{QP_CSS}</style>

      <div
        ref={shellRef}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
        onKeyDown={onShellKeys}
        className={`${pinned ? 'sticky' : ''} overflow-hidden rounded-[12px] border border-black bg-[#0A0A0A] shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_30px_90px_rgba(0,0,0,0.6)]`}
      >
        {/* HEADER BAR (GNOME style). minmax(0,1fr) lets the side columns shrink so the title never collides with the button. */}
        <div className="grid h-[46px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-black bg-[#1A1A1B] px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/querypilot-logo.svg" alt="" aria-hidden="true" className="ml-1 size-[18px] shrink-0 object-contain" />
          </div>

          <div className="min-w-0 text-center leading-tight">
            <div className="truncate text-[14px] font-medium text-white/90">QueryPilot</div>
            <div className="text-[12px] text-white/40">Features</div>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-3">
            <PixelDissolveButton
              label={roomy ? 'Try QueryPilot' : 'Try it'}
              href={TRY_HREF}
              color="#ffffff"
              textColor="#0A0A0A"
              dissolveColor="#F0F0F0"
              cellSize={4}
              className="!h-8 !min-h-0 !rounded-md !px-3 !text-[13px] !font-medium !normal-case !tracking-normal max-[399px]:!gap-1.5 max-[399px]:!px-2.5"
            />
          </div>
        </div>

        {/* TABS + PANEL: the active tab melts into the panel below */}
        <div className="bg-[#0A0A0A] px-1 pb-1 min-[400px]:px-2 min-[400px]:pb-2 sm:px-4 sm:pb-4">
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="QueryPilot features"
            onKeyDown={onTabKeys}
            className="relative z-10 -mb-px flex items-end gap-2 overflow-x-auto overscroll-x-contain pb-px pt-3 [scrollbar-width:none] sm:pt-4 min-[1600px]:gap-3 min-[1600px]:pt-5 [&::-webkit-scrollbar]:hidden"
          >
            {FEATURES.map((f, i) => {
              const isActive = i === active;
              const Icon = TAB_ICONS[i];
              return (
                <button
                  key={f.tab}
                  type="button"
                  role="tab"
                  id={`feature-tab-${i}`}
                  aria-selected={isActive}
                  aria-controls="feature-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => select(i)}
                  className={[
                    // content-sized and never shrunk below its text on phones (the strip scrolls); equal widths once there is room
                    'qp-tab relative isolate flex min-w-[104px] flex-[1_0_auto] items-center justify-center whitespace-nowrap px-3 text-[14px] font-medium sm:min-w-[136px] min-[1280px]:flex-1',
                    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/40',
                    isActive
                      ? 'qp-tab-active -mb-px h-[56px] text-white sm:h-[58px] min-[1600px]:h-[64px]'
                      : 'qp-tab-idle mb-2 h-11 rounded-[14px] border border-white/10 bg-[#0F0F10] text-white/50 min-[1600px]:mb-3 min-[1600px]:h-[50px]',
                  ].join(' ')}
                >
                  {isActive && <ActiveTabShape r={tabR} left={i > 0} right={i < COUNT - 1} animate={hydrated && !reduceMotion} />}

                  <span className="relative z-10 flex min-w-0 items-center gap-2 sm:gap-2.5">
                    <Icon size={15} strokeWidth={1.75} className="qp-tab-icon shrink-0" />
                    <span className="qp-label">{f.tab}</span>
                    {isActive && (
                      // the ring only exists while the tour runs; it keeps its space so nothing shifts when it ends
                      <svg width="16" height="16" viewBox="0 0 16 16" className={`shrink-0 -rotate-90${auto || pinned ? '' : ' invisible'}`} aria-hidden="true">
                        <circle cx="8" cy="8" r={RING_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
                        <circle
                          ref={ringRef}
                          cx="8"
                          cy="8"
                          r={RING_R}
                          fill="none"
                          stroke="#E4E6EA"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeDasharray={RING_C}
                          strokeDashoffset={RING_C}
                        />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* PANEL */}
          <div
            role="tabpanel"
            id="feature-panel"
            aria-labelledby={`feature-tab-${active}`}
            className="relative overflow-hidden border"
            style={{
              background: PANEL_BG,
              borderColor: PANEL_LINE,
              borderRadius: `${active === 0 ? 0 : PANEL_R}px ${active === COUNT - 1 ? 0 : PANEL_R}px ${PANEL_R}px ${PANEL_R}px`,
            }}
          >
            <div className="relative grid grid-cols-1 min-[1100px]:grid-cols-[clamp(320px,25vw,480px)_minmax(0,1fr)]">
              {/* on phones the card comes first, the copy underneath */}
              <div className="order-2 flex min-w-0 flex-col justify-center p-4 min-[400px]:p-5 sm:p-6 min-[1100px]:order-1 min-[1600px]:p-8">
                <div className="grid min-w-0">
                  {FEATURES.map((f, i) => (
                    <CopyBlock
                      key={i === active ? `live-${i}` : `ghost-${i}`}
                      feature={f}
                      lit={i === active ? shown : 0}
                      live={i === active}
                      reduce={reduceMotion}
                    />
                  ))}
                </div>
              </div>

              <div className="order-1 flex min-w-0 p-1 min-[400px]:p-1.5 sm:p-4 min-[1100px]:order-2 min-[1100px]:p-5 min-[1600px]:p-6">
                <StagePanel key={active} index={active} reduce={reduceMotion} onHover={setHovering} onTouch={() => setTour(false)} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function FeaturesSection() {
  return (
    <section id="features" aria-label="QueryPilot features" className="relative w-full bg-[#0A0A0A] text-white">
      <div className="border-t border-white/10" />

      <div className={`mx-auto max-w-full ${FRAME_CLASS}`}>
        <div className="border-x border-white/10">
          <div className="px-4 pb-8 pt-12 sm:px-8 sm:pb-12 sm:pt-14 min-[1280px]:px-12 min-[1280px]:pt-16">
            <h2 className="mt-4 max-w-[640px] text-[clamp(26px,2.4vw,36px)] font-medium leading-[1.2] tracking-[-0.025em] text-white min-[1600px]:max-w-[820px]">
              Plan first. Retrieve second. Answer with evidence.
            </h2>

            <p className="mt-4 max-w-[520px] text-pretty text-[16px] leading-[1.6] text-white/70 min-[1600px]:max-w-[640px]">
              Every question is planned before anything is searched, and every answer ships with the sources behind it.
            </p>
          </div>

          <div className="px-1 pb-10 min-[400px]:px-2 sm:px-8 sm:pb-16 min-[1280px]:px-12 min-[1280px]:pb-20">
            <FeatureShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}