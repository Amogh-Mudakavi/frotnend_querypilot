"use client";

import * as React from "react";
import { Bot, Braces, ChevronDown, GitBranch, KeyRound, Maximize2, Send, Wrench } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Shared contract. `querypilot-demo.tsx` imports these from this file.      */
/* -------------------------------------------------------------------------- */

export type StageId =
  | "question"
  | "context"
  | "chitchat"
  | "followup"
  | "understand"
  | "error"
  | "resolve"
  | "guard"
  | "plan"
  | "dispatch"
  | "clarify"
  | "product"
  | "metadata"
  | "sql"
  | "retrieve"
  | "memory"
  | "recovery"
  | "supplement"
  | "coverage"
  | "cross_document"
  | "reconcile"
  | "evidence"
  | "finish"
  | "fallback"
  | "answer"
  | "stream"
  | "response";

/**
 * pending  on the chosen route, not started yet
 * active   running now
 * done     finished successfully
 * skipped  not part of this route
 * failed   ran and could not produce a result
 * blocked  stopped by the guard
 */
export type StageStatus = "pending" | "active" | "done" | "skipped" | "failed" | "blocked";

export interface StageState {
  status: StageStatus;
  /** Short result text, e.g. "5 passages, 2 documents". */
  detail?: string;
  /** Time the stage took, in milliseconds. Shown once the stage has finished. */
  ms?: number;
}

export type RunStatus = "running" | "completed" | "failed" | "blocked";

export interface TraceRun {
  /** Unique per execution. Replaying the same question gets a new id. */
  id: string;
  question: string;
  status: RunStatus;
  stages: Partial<Record<StageId, StageState>>;
  /** Where the run ends. `null` until the planner has decided. */
  destination: StageId | null;
  /** Short name of the route, e.g. "Table only". */
  label?: string;
  /** One sentence on why that route was chosen. */
  reason?: string;
  /** Sum of all stage times, set once the run has finished. */
  totalMs?: number;
}

export interface AgentTraceProps {
  /** `null` renders the standard route, empty and waiting. */
  run: TraceRun | null;
  className?: string;
  /** Show the header and the position / destination footer. */
  showChrome?: boolean;
  /** Pixels of the canvas covered by other UI. Kept for compatibility; the split view no longer needs it. */
  insets?: { left?: number; right?: number };
}

export const STAGE_ORDER: readonly StageId[] = [
  "question",
  "context",
  "chitchat",
  "followup",
  "understand",
  "error",
  "resolve",
  "plan",
  "guard",
  "dispatch",
  "clarify",
  "product",
  "metadata",
  "sql",
  "retrieve",
  "memory",
  "recovery",
  "supplement",
  "coverage",
  "cross_document",
  "reconcile",
  "evidence",
  "finish",
  "fallback",
  "answer",
  "stream",
  "response",
];

/** Node labels. Visual execution steps, not backend node names. */
export const STAGE_LABEL: Record<StageId, string> = {
  question: "Question",
  context: "Follow-up context",
  chitchat: "Small talk",
  followup: "Follow-up",
  understand: "Planner",
  error: "Plan error",
  resolve: "Resolve sources",
  guard: "Access scope",
  plan: "Execution plan",
  dispatch: "Dispatch",
  clarify: "Clarification",
  product: "Product",
  metadata: "Metadata",
  sql: "Table query",
  retrieve: "Documents",
  memory: "Memory",
  recovery: "SQL repair",
  supplement: "Rule lookup",
  coverage: "Doc coverage",
  cross_document: "Source join",
  reconcile: "Assemble evidence",
  evidence: "Evidence gate",
  finish: "Finish checks",
  fallback: "Fallback",
  answer: "Answer generation",
  stream: "Stream chunks",
  response: "Response",
};

/** Full labels for assistive technology. */
export const STAGE_TITLE: Record<StageId, string> = {
  question: "Receive the user message",
  context: "Resolve replay and conversational follow-up context",
  chitchat: "Return a fixed greeting or thanks response",
  followup: "Resolve a conversational follow-up using recent context",
  understand: "Planner understands the request",
  error: "Planning failed or could not be parsed",
  resolve: "Resolve authorized documents, tables and entities",
  guard: "Apply workspace and source access scope",
  plan: "Build the execution plan",
  dispatch: "Dispatch planned capabilities",
  clarify: "Ask the user to disambiguate a source",
  product: "Retrieve product knowledge",
  metadata: "Retrieve source metadata",
  sql: "Query structured table data",
  retrieve: "Retrieve document evidence",
  memory: "Retrieve relevant conversation memory",
  recovery: "Attempt one bounded SQL recovery",
  supplement: "Discover supporting policy or rule evidence",
  coverage: "Build broader document coverage when required",
  cross_document: "Relate table rows to document rules",
  reconcile: "Deduplicate, reconcile and assemble evidence",
  evidence: "Assess evidence sufficiency and answerability",
  finish: "Check deadline, tool outcome and answerability",
  fallback: "Return an error or cautious insufficient-evidence response",
  answer: "Generate the answer from assembled evidence",
  stream: "Stream answer fragments to the caller",
  response: "Return the final response",
};

/* -------------------------------------------------------------------------- */
/*  Design tokens                                                             */
/*  Dark only. Greys for structure, one indigo for "live", one tint per       */
/*  evidence lane, red for anything stopped.                                  */
/* -------------------------------------------------------------------------- */

export const QP = {
  bg: "#131314",
  panel: "#0d0d0e",
  ink: "#e6e6e6",
  accent: "#3a44a8",
  /** The "live" colour: running node, travelling wire, slowest step. */
  hi: "#8a94ff",
  /** Structured data lane. */
  table: "#7f8cf0",
  /** Document lane. */
  docs: "#a9afbb",
  /** Joined sources and memory. */
  join: "#c4b5fd",
  /** Bounded SQL repair. */
  repair: "#e5a95b",
  ok: "#86d4ab",
  bad: "#fca5a5",
  slate: "#9aa0a8",
} as const;

/** 620 -> "620ms", 1840 -> "1.8s". */
export const formatMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

/** Converts a palette hex colour into rgba(). */
export const alpha = (hex: string, a: number | string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Number(a)})`;
};

/** The colour a stage carries once finished. Source stages are coloured, everything else is neutral (QP.ink). */
export function stageInk(id: StageId): string {
  switch (id) {
    case "sql":
      return QP.table;
    case "retrieve":
    case "supplement":
    case "coverage":
    case "metadata":
    case "product":
      return QP.docs;
    case "cross_document":
    case "memory":
      return QP.join;
    case "recovery":
      return QP.repair;
    default:
      return QP.ink;
  }
}

export const SANS = "var(--font-geist), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO = "var(--font-geist-mono), ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

const FAIL = QP.bad;
const w = (a: number | string) => alpha(QP.ink, a);
const WIRE = "#d9d9de";
const CARD = "#0f0f11";

/* -------------------------------------------------------------------------- */
/*  The route is a node graph.                                                */
/*                                                                            */
/*  While the agent works the graph runs left to right: a wire draws to the   */
/*  next stage and the node appears at its end, and the camera follows the    */
/*  running node. When the run finishes the nodes glide into a top-down       */
/*  layout, the wires redraw, and the camera frames the top so the whole      */
/*  route can be inspected.                                                   */
/*                                                                            */
/*  Looking around: mouse wheel / trackpad scrolls the graph, drag pans,      */
/*  Ctrl/Cmd + wheel (or the +/- buttons) zooms, "Fit" shows the whole route, */
/*  arrow keys walk from step to step. At the end of the graph the wheel      */
/*  hands scrolling back to the page, so the page never gets trapped.         */
/* -------------------------------------------------------------------------- */

const INTAKE = new Set<StageId>(["question", "context", "chitchat", "followup"]);
const PLANNER = new Set<StageId>(["understand", "error", "resolve", "plan", "guard", "dispatch", "clarify"]);
const EXEC = new Set<StageId>(["product", "metadata", "sql", "retrieve", "memory", "recovery", "supplement", "coverage", "cross_document"]);
const VERIFY = new Set<StageId>(["reconcile", "evidence", "finish"]);
const RESPOND = new Set<StageId>(["fallback", "answer", "stream", "response"]);

/** Phases in route order, one step each on the indigo ramp. Used for the time breakdown. */
const PHASES: ReadonlyArray<{ id: string; label: string; set: ReadonlySet<StageId>; ink: string }> = [
  { id: "intake", label: "Intake", set: INTAKE, ink: "#5f6678" },
  { id: "plan", label: "Plan", set: PLANNER, ink: "#6f7bdc" },
  { id: "execute", label: "Execute", set: EXEC, ink: "#8b95f5" },
  { id: "verify", label: "Verify", set: VERIFY, ink: "#a8a4f7" },
  { id: "respond", label: "Respond", set: RESPOND, ink: "#c4b5fd" },
];

const PLAN_LABEL: Partial<Record<StageId, string>> = {
  understand: "Understand the query",
  resolve: "Resolve evidence",
  plan: "Plan execution",
  guard: "Check access scope",
  dispatch: "Dispatch executors",
  clarify: "Ask to clarify",
  error: "Planning failed",
};

type Kind = "start" | "agent" | "function" | "tool" | "condition" | "output";

const KIND_LABEL: Record<Kind, string> = { start: "Start", agent: "Agent", function: "Function", tool: "Tool", condition: "Condition", output: "Output" };
const KIND_ICON: Record<Kind, typeof Bot> = { start: KeyRound, agent: Bot, function: Braces, tool: Wrench, condition: GitBranch, output: Send };

const STAGE_KIND: Record<StageId, Kind> = {
  question: "start",
  context: "function",
  chitchat: "agent",
  followup: "agent",
  understand: "agent",
  error: "condition",
  resolve: "function",
  guard: "condition",
  plan: "function",
  dispatch: "function",
  clarify: "condition",
  product: "tool",
  metadata: "tool",
  sql: "tool",
  retrieve: "tool",
  memory: "tool",
  recovery: "tool",
  supplement: "tool",
  coverage: "tool",
  cross_document: "function",
  reconcile: "function",
  evidence: "condition",
  finish: "condition",
  fallback: "agent",
  answer: "agent",
  stream: "function",
  response: "output",
};

/** The word in front of a node's result. */
const STAGE_ROW: Record<StageId, string> = {
  question: "Message",
  context: "Context",
  chitchat: "Intent",
  followup: "Context",
  understand: "Intent",
  error: "Error",
  resolve: "Sources",
  guard: "Scope",
  plan: "Plan",
  dispatch: "Run",
  clarify: "Missing",
  product: "Result",
  metadata: "Result",
  sql: "Query",
  retrieve: "Search",
  memory: "Recall",
  recovery: "Repair",
  supplement: "Clause",
  coverage: "Coverage",
  cross_document: "Join",
  reconcile: "Evidence",
  evidence: "Check",
  finish: "Check",
  fallback: "Reply",
  answer: "Answer",
  stream: "Stream",
  response: "Reply",
};

/* --------------------------------- layout --------------------------------- */

const NODE_W = 248;
const NODE_H = 108;
const GAP_X = 84;
const GAP_Y = 24;
/** Vertical layout: space between rows, and between executors that share a row. */
const ROW_GAP = 56;
const COL_GAP_V = 32;
const HANDLE = 5;
const CORNER = 14;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.1;
/** Space kept above the first node when the finished graph rests at the top. */
const TOP_PAD = 28;
/** A new run starts this much closer than its resting zoom, then the camera pulls back. */
const INTRO_ZOOM = 1.32;

/* Pacing. The chat stretches every step, so the graph's own animation is slowed to match:
   a wire takes about as long to draw as the step before the node takes to run. */
/** How long a node waits for its wire to arrive, in seconds. */
const WIRE_LEAD = 0.55;
/** Stagger between stages that appear in the same moment (a replay, or parallel executors). */
const STAGGER = 0.16;
/** Light travel speed along a wire, px per second. */
const TRAIN_SPEED = 160;
/** Seconds the nodes take to glide into the top-down layout, and the wait before the wires redraw. */
const GLIDE = 1.2;
const REDRAW_DELAY = 1.1;
/** Seconds the camera takes to move to a new focus while following the run. */
const CAMERA = 1.3;
/** Camera ease while the person is looking around by hand. Short, so the wheel feels direct. */
const LOOK_EASE = ".2s cubic-bezier(.2,.7,.2,1)";

type Stages = TraceRun["stages"];
type Pt = readonly [number, number];

interface GNode {
  id: StageId;
  label: string;
  x: number;
  y: number;
}
interface GEdge {
  key: string;
  from: StageId;
  to: StageId;
  d: string;
  len: number;
}
interface Geo {
  nodes: GNode[];
  edges: GEdge[];
  visible: StageId[];
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A polyline with rounded bends. */
function roundedPath(pts: Pt[], r: number): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const p = pts[i];
    const b = pts[i + 1];
    const da = dist(a, p);
    const db = dist(p, b);
    const cut = Math.min(r, da / 2, db / 2);
    const s: Pt = [p[0] + ((a[0] - p[0]) / da) * cut, p[1] + ((a[1] - p[1]) / da) * cut];
    const e: Pt = [p[0] + ((b[0] - p[0]) / db) * cut, p[1] + ((b[1] - p[1]) / db) * cut];
    d += `L${s[0].toFixed(1)} ${s[1].toFixed(1)}Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

/**
 * Lays the route out. Horizontal (while running): intake and planner in a row, the executors the planner
 * fans out to stacked in one column, then the source join (when there is one), verification and the response.
 * Vertical (finished): the same route turned top-down, with the executors side by side in one row.
 */
function build(stages: Stages, vertical: boolean): Geo | null {
  const visible = STAGE_ORDER.filter((id) => stages[id] && stages[id]!.status !== "skipped");
  if (!visible.length) return null;
  const pre = visible.filter((id) => INTAKE.has(id) || PLANNER.has(id));
  const exec = visible.filter((id) => EXEC.has(id) && id !== "cross_document");
  const post = visible.filter((id) => id === "cross_document" || VERIFY.has(id) || RESPOND.has(id));
  const labelOf = (id: StageId) => (PLANNER.has(id) ? (PLAN_LABEL[id] ?? STAGE_LABEL[id]) : STAGE_LABEL[id]);

  const nodes: GNode[] = [];
  const at = new Map<StageId, GNode>();
  const put = (id: StageId, slot: number, k = 0, count = 1) => {
    const off = k - (count - 1) / 2;
    const n: GNode = vertical
      ? { id, label: labelOf(id), x: off * (NODE_W + COL_GAP_V) - NODE_W / 2, y: slot * (NODE_H + ROW_GAP) }
      : { id, label: labelOf(id), x: slot * (NODE_W + GAP_X), y: off * (NODE_H + GAP_Y) - NODE_H / 2 };
    nodes.push(n);
    at.set(id, n);
  };
  let slot = 0;
  pre.forEach((id) => put(id, slot++));
  if (exec.length) {
    const c = slot++;
    exec.forEach((id, k) => put(id, c, k, exec.length));
  }
  post.forEach((id) => put(id, slot++));

  const edges: GEdge[] = [];
  const link = (a: StageId, b: StageId) => {
    const A = at.get(a);
    const B = at.get(b);
    if (!A || !B) return;
    let pts: Pt[];
    if (vertical) {
      const x1 = A.x + NODE_W / 2;
      const y1 = A.y + NODE_H + HANDLE;
      const x2 = B.x + NODE_W / 2;
      const y2 = B.y - HANDLE;
      const mid = (y1 + y2) / 2;
      pts = Math.abs(x1 - x2) < 1 ? [[x1, y1], [x2, y2]] : [[x1, y1], [x1, mid], [x2, mid], [x2, y2]];
    } else {
      const x1 = A.x + NODE_W + HANDLE;
      const y1 = A.y + NODE_H / 2;
      const x2 = B.x - HANDLE;
      const y2 = B.y + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      pts = Math.abs(y1 - y2) < 1 ? [[x1, y1], [x2, y2]] : [[x1, y1], [mid, y1], [mid, y2], [x2, y2]];
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
    // The key changes with orientation, so wires redraw after the nodes have glided into place.
    edges.push({ key: `${a}>${b}${vertical ? "|v" : ""}`, from: a, to: b, d: roundedPath(pts, CORNER), len });
  };
  const chain = (ids: StageId[]) => {
    for (let i = 0; i < ids.length - 1; i++) link(ids[i], ids[i + 1]);
  };

  chain(pre);
  chain(post);
  const lastPre = pre[pre.length - 1];
  const firstPost = post[0];
  if (exec.length) {
    if (lastPre) exec.forEach((e) => link(lastPre, e));
    if (firstPost) exec.forEach((e) => link(e, firstPost));
  } else if (lastPre && firstPost) {
    link(lastPre, firstPost);
  }

  return { nodes, edges, visible };
}

type EdgeState = "queued" | "lit" | "travelling";

function edgeState(a?: StageStatus, b?: StageStatus): EdgeState {
  if (a === "done" && b === "active") return "travelling";
  if (a === "done" && (b === "done" || b === "failed" || b === "blocked")) return "lit";
  return "queued";
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
const clamp = (n: number): React.CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden" });
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

function useBox() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const bw = Math.round(r.width);
      const bh = Math.round(r.height);
      setBox((p) => (p.w === bw && p.h === bh ? p : { w: bw, h: bh }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, box };
}

const STATUS_TEXT: Record<StageStatus, string> = {
  pending: "queued",
  active: "running",
  done: "done",
  skipped: "skipped",
  failed: "failed",
  blocked: "blocked by guard",
};

/** What a node shows in its result row: the result, or the state while it matters. Nothing while queued. */
const detailOf = (s: StageState | undefined, st: StageStatus): string | null => {
  if (st === "pending") return null;
  if (s?.detail) return s.detail;
  return st === "active" || st === "failed" || st === "blocked" ? STATUS_TEXT[st] : null;
};

const CSS = `
@keyframes qpt-run { 0% { stroke-dashoffset: var(--s) } 78% { stroke-dashoffset: var(--e) } 100% { stroke-dashoffset: var(--e) } }
@keyframes qpt-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes qpt-draw { from { stroke-dashoffset: var(--len) } to { stroke-dashoffset: 0 } }
@keyframes qpg-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.qpt-run { animation: qpt-run var(--dur) cubic-bezier(.5,0,.3,1) infinite; }
.qpt-pulse { animation: qpt-pulse 1.3s ease-in-out infinite; }
.qpt-draw { stroke-dasharray: var(--len); animation: qpt-draw var(--draw, .8s) cubic-bezier(.4,0,.2,1) var(--delay, 0s) both; }
.qpt-seg { transition: flex-grow .6s ease; }
.qpt-follow:focus-visible, .qpt-stage:focus-visible, .qpg-zb:focus-visible, .qpt-sum:focus-visible { outline: 2px solid ${alpha(QP.hi, 0.9)}; outline-offset: 2px; }

/* summary bar: sits in the page flow above the graph, so it can never cover a node */
.qpt-bar { flex: none; background: ${QP.panel}; border-bottom: 1px solid ${w(0.1)}; }
.qpt-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; padding: 6px 10px 6px 14px; }
.qpt-sum { display: flex; flex: 1 1 200px; min-width: 0; align-items: center; gap: 10px; height: 32px; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.qpt-tools { display: flex; flex: none; align-items: center; gap: 6px; }
.qpt-det { padding: 4px 14px 14px; max-height: min(300px, 42vh); overflow-y: auto; scrollbar-width: thin; scrollbar-color: ${w(0.2)} transparent; }
.qpt-chev { flex: none; color: ${w(0.45)}; transition: transform .18s ease; }
.qpt-chev[data-open="1"] { transform: rotate(180deg); }

.qpg-n { position: absolute; display: flex; flex-direction: column; gap: 7px; width: ${NODE_W}px; height: ${NODE_H}px; padding: 9px 10px 8px; border-radius: 10px; border: 1px solid ${w(0.22)}; background: ${CARD}; color: ${QP.ink}; font-family: ${SANS}; transition: border-color .4s ease, left ${GLIDE}s cubic-bezier(.22,.8,.2,1), top ${GLIDE}s cubic-bezier(.22,.8,.2,1); }
.qpg-n[data-s="active"] { border-color: ${QP.hi}; }
.qpg-n[data-s="failed"] { border-color: ${FAIL}; }
.qpg-n[data-s="blocked"] { border-color: ${FAIL}; border-style: dashed; }
.qpg-n[data-s="pending"] { border-color: ${w(0.12)}; }
.qpg-in { animation: qpg-in .55s ease var(--delay, 0s) both; }
.qpg-h { position: absolute; top: 50%; width: ${HANDLE}px; height: 14px; margin-top: -7px; background: ${w(0.7)}; }
.qpg-hl { left: -${HANDLE}px; border-radius: 2px 0 0 2px; }
.qpg-hr { right: -${HANDLE}px; border-radius: 0 2px 2px 0; }
.qpg-h.qpg-ht { top: -${HANDLE}px; left: 50%; width: 14px; height: ${HANDLE}px; margin: 0 0 0 -7px; border-radius: 2px 2px 0 0; }
.qpg-h.qpg-hb { top: auto; bottom: -${HANDLE}px; left: 50%; width: 14px; height: ${HANDLE}px; margin: 0 0 0 -7px; border-radius: 0 0 2px 2px; }
.qpg-hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 22px; }
.qpg-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 520; letter-spacing: -.012em; }
.qpg-n[data-s="failed"] .qpg-t, .qpg-n[data-s="blocked"] .qpg-t { color: ${FAIL}; }
.qpg-bd { display: inline-flex; flex: none; align-items: center; gap: 4px; font-size: 11.5px; color: ${w(0.55)}; }
.qpg-row { display: flex; align-items: center; gap: 8px; min-height: 20px; min-width: 0; font-size: 12px; color: ${w(0.5)}; }
.qpg-k { flex: none; }
.qpg-v { min-width: 0; padding: 1px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 5px; border: 1px solid ${w(0.14)}; font-family: ${MONO}; font-size: 11.5px; color: ${QP.ink}; }
.qpg-n[data-s="pending"] .qpg-v { color: ${w(0.5)}; }
.qpg-q { min-width: 0; font-size: 12.5px; line-height: 1.35; color: ${w(0.92)}; }
.qpg-ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 22px; margin-top: auto; padding: 0 8px; border-radius: 6px; background: ${w(0.06)}; font-size: 11.5px; color: ${w(0.55)}; }
.qpg-n[data-s="failed"] .qpg-ft, .qpg-n[data-s="blocked"] .qpg-ft { color: ${FAIL}; }
.qpg-n[data-s="active"] .qpg-ft { color: ${w(0.9)}; }
.qpg-fl { display: inline-flex; align-items: center; gap: 7px; }
.qpg-dot { width: 6px; height: 6px; border-radius: 99px; background: ${w(0.3)}; }
.qpg-n[data-s="done"] .qpg-dot { background: ${QP.ok}; }
.qpg-n[data-s="active"] .qpg-dot { background: ${QP.hi}; animation: qpt-pulse 1.1s ease-in-out infinite; }
.qpg-n[data-s="failed"] .qpg-dot, .qpg-n[data-s="blocked"] .qpg-dot { background: ${FAIL}; }
.qpg-ms { font-family: ${MONO}; font-variant-numeric: tabular-nums; color: ${w(0.6)}; }
.qpg-ms[data-hot="1"] { color: ${QP.hi}; }

/* zoom controls: live in the summary bar, never over the graph */
.qpg-zoom { display: flex; align-items: center; height: 30px; border-radius: 8px; border: 1px solid ${w(0.18)}; background: ${QP.bg}; color: ${QP.ink}; font-family: ${SANS}; }
.qpg-zb { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; font-size: 17px; line-height: 1; color: ${w(0.8)}; cursor: pointer; background: none; border: 0; padding: 0; transition: background .15s, color .15s; }
.qpg-zb:hover:not(:disabled) { background: ${w(0.08)}; color: ${QP.ink}; }
.qpg-zb:disabled { color: ${w(0.25)}; cursor: default; }
.qpg-zv { min-width: 42px; text-align: center; font-family: ${MONO}; font-size: 12px; font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  .qpt-run { display: none; }
  .qpt-pulse, .qpt-draw, .qpg-in, .qpg-n[data-s="active"] .qpg-dot { animation: none; }
  .qpt-seg, .qpg-n, .qpt-chev { transition: none; }
}
`;

const SR_ONLY: React.CSSProperties = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

const delayVar = (s: number): React.CSSProperties => ({ "--delay": `${s.toFixed(2)}s` }) as React.CSSProperties;

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function statusMeta(run: TraceRun | null): { label: string; dot: string; pulse: boolean } {
  if (!run) return { label: "Idle", dot: w(0.35), pulse: false };
  switch (run.status) {
    case "running":
      return { label: "Running", dot: QP.hi, pulse: true };
    case "completed":
      return { label: "Completed", dot: QP.ok, pulse: false };
    case "blocked":
      return { label: "Blocked by guard", dot: FAIL, pulse: false };
    case "failed":
      return { label: "Failed", dot: FAIL, pulse: false };
  }
}

interface PhaseTime {
  id: string;
  label: string;
  ms: number;
  ink: string;
}

/** Stages the planner chose not to run: whole phases when a phase is out, named executors when only some are. */
function skippedChips(stages: Stages): string[] {
  const out: string[] = [];
  for (const p of PHASES) {
    const ids = STAGE_ORDER.filter((id) => p.set.has(id) && id !== "question");
    if (!ids.length) continue;
    const gone = ids.filter((id) => stages[id]?.status === "skipped");
    if (gone.length === ids.length) out.push(p.label);
    else if (p.id === "execute") {
      const names = gone.map((id) => STAGE_LABEL[id]);
      out.push(...names.slice(0, 3));
      if (names.length > 3) out.push(`+${names.length - 3} more`);
    }
  }
  return out;
}

/** Why this route, where the time went, what was skipped. Opens under the summary bar and scrolls if tall. */
function RouteDetails({
  run,
  stops,
  skippedNames,
  phases,
  slowest,
}: {
  run: TraceRun;
  stops: number;
  skippedNames: string[];
  phases: PhaseTime[];
  slowest: { label: string; ms: number } | null;
}) {
  const lit = phases.filter((p) => p.ms > 0);
  return (
    <div className="qpt-det">
      <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, color: w(0.7) }}>{run.reason ?? "QueryPilot is choosing a route."}</p>
      {lit.length > 0 ? (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
          {lit.map((p) => (
            <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: w(0.66) }}>
              <i aria-hidden style={{ width: 6, height: 6, borderRadius: 2, background: p.ink }} />
              {p.label}
              <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: w(0.5) }}>{formatMs(p.ms)}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "4px 12px", fontSize: 12, color: w(0.56) }}>
        <span>
          {stops} {stops === 1 ? "step" : "steps"} run
        </span>
        {slowest ? (
          <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: w(0.5) }}>
            slowest: {slowest.label.toLowerCase()} {formatMs(slowest.ms)}
          </span>
        ) : null}
      </div>
      {skippedNames.length > 0 ? (
        <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: w(0.42) }}>Skipped</span>
          {skippedNames.map((name) => (
            <span key={name} style={{ height: 20, display: "inline-flex", alignItems: "center", padding: "0 7px", borderRadius: 5, border: `1px dashed ${w(0.2)}`, fontSize: 11.5, color: w(0.5), textDecoration: "line-through", textDecorationColor: w(0.3) }}>
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** What the canvas shows before the first question: the standard route, laid out and waiting. */
const IDLE_IDS: StageId[] = ["question", "understand", "resolve", "plan", "guard", "dispatch", "sql", "retrieve", "supplement", "cross_document", "reconcile", "evidence", "answer", "stream", "response"];
const IDLE_RUN: TraceRun = {
  id: "idle",
  question: "Ask a question",
  status: "completed",
  destination: null,
  label: "Waiting for a question",
  reason: "Ask a question to see the route it takes: what the planner chose, what it skipped and where the time went.",
  stages: Object.fromEntries(IDLE_IDS.map((id) => [id, { status: "pending" as StageStatus }])) as TraceRun["stages"],
};

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
interface Cam {
  focus: { x: number; y: number };
  zoom: number;
  baseZoom: number;
  idle: boolean;
  bounds: (z: number) => Bounds;
}

/* -------------------------------------------------------------------------- */
/*  AgentTrace                                                                */
/* -------------------------------------------------------------------------- */

export function AgentTrace({ run: runProp, className, showChrome = false, insets }: AgentTraceProps) {
  const idle = runProp === null;
  const run: TraceRun = runProp ?? IDLE_RUN;
  /** Horizontal while the agent works, top-down once the run has finished. */
  const vertical = !idle && run.status !== "running";
  const left = insets?.left ?? 0;
  const right = insets?.right ?? 0;
  const { ref, box } = useBox();
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);

  const availW = Math.max(0, box.w - left - right);
  const H = box.h;

  // The intake node always shows the exact text of this run's question.
  const stages: Stages = React.useMemo(
    () => ({ ...run.stages, question: { ...run.stages.question, status: run.stages.question?.status ?? "done", detail: run.question } }),
    [run],
  );

  const geo = React.useMemo(() => build(stages, vertical), [stages, vertical]);
  const stat = React.useCallback(
    (id: StageId): StageStatus => (idle ? "pending" : id === "question" ? "done" : (stages[id]?.status ?? "pending")),
    [idle, stages],
  );

  /**
   * The order in which stages first appeared for this run. Stages that appear in the same render (a replay,
   * or parallel executors) are staggered by it. A stage that appears alone later gets 0, so a live run
   * never waits on a delay.
   */
  const arrival = React.useRef<{ id: string; order: Map<StageId, number> }>({ id: "", order: new Map() });
  if (arrival.current.id !== run.id) arrival.current = { id: run.id, order: new Map() };

  const maxMs = React.useMemo(() => {
    let v = 0;
    for (const id of STAGE_ORDER) if (id !== "question" && typeof stages[id]?.ms === "number") v = Math.max(v, stages[id]!.ms!);
    return v;
  }, [stages]);

  /** Time per phase, plus the single slowest stage. Only finished stages carry a time. */
  const timing = React.useMemo(() => {
    const phases: PhaseTime[] = PHASES.map((p) => ({ id: p.id, label: p.label, ink: p.ink, ms: 0 }));
    let slowest: { label: string; ms: number } | null = null;
    for (const id of STAGE_ORDER) {
      const s = stages[id];
      if (id === "question" || !s || s.status === "skipped" || typeof s.ms !== "number") continue;
      const idx = PHASES.findIndex((p) => p.set.has(id));
      if (idx >= 0) phases[idx].ms += s.ms;
      if (!slowest || s.ms > slowest.ms) slowest = { label: STAGE_LABEL[id], ms: s.ms };
    }
    return { phases, slowest };
  }, [stages]);

  const skippedNames = React.useMemo(() => (idle ? [] : skippedChips(stages)), [idle, stages]);

  /* Where the camera can look: the centre of every node, and the columns and rows they sit in. */
  const nav = React.useMemo(() => {
    if (!geo) return null;
    const list = geo.nodes.map((n) => ({ id: n.id, x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 }));
    const uniq = (v: number[]) => {
      const out: number[] = [];
      for (const a of [...v].sort((p, q) => p - q)) if (!out.length || Math.abs(out[out.length - 1] - a) > 1) out.push(a);
      return out;
    };
    const stops = uniq(list.map((a) => a.x));
    const stopsY = uniq(list.map((a) => a.y));
    return { list, stops, stopsY, fLeft: stops[0], fRight: stops[stops.length - 1], fTop: stopsY[0], fBottom: stopsY[stopsY.length - 1] };
  }, [geo]);

  /* Camera input: follow the running node, or a manual look. */
  const [manual, setManual] = React.useState<{ x: number; y: number } | null>(null);
  const [zoomUser, setZoomUser] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  // A new run, or the switch to the top-down layout, hands the camera back.
  React.useEffect(() => {
    setManual(null);
  }, [run.id, vertical]);
  // A new run also resets a hand-set zoom.
  React.useEffect(() => {
    setZoomUser(null);
  }, [run.id]);

  let follow = { x: nav ? nav.fLeft + (NODE_W + GAP_X) * 1.5 : 0, y: 0 };
  if (nav && !idle) {
    follow = { x: nav.fLeft, y: 0 };
    const act = nav.list.filter((a) => stat(a.id) === "active");
    if (act.length) {
      follow = { x: act.reduce((s, a) => s + a.x, 0) / act.length, y: act.reduce((s, a) => s + a.y, 0) / act.length };
    } else {
      const reached = nav.list.filter((a) => {
        const s = stat(a.id);
        return s === "done" || s === "failed" || s === "blocked";
      });
      if (reached.length) {
        const far = reached.reduce((best, a) => (a.x >= best.x ? a : best), reached[0]);
        follow = { x: far.x, y: far.y };
      }
    }
  }

  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const h = () => setReduce(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  /**
   * Intro zoom-out. A new run mounts close to the question node; two frames later the camera is released
   * and eases back to the resting zoom. Tracking the settled run id (not a boolean) means a new run never
   * flashes at the old run's settled zoom.
   */
  const [settledId, setSettledId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (reduce) {
      setSettledId(run.id);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettledId(run.id));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [run.id, reduce]);

  const stops = geo?.visible.length ?? 0;
  const meta = statusMeta(idle ? null : run);

  const active = STAGE_ORDER.filter((id) => stages[id]?.status === "active");
  const position =
    active.length > 0 ? active.map((id) => STAGE_LABEL[id]).join(" + ") : run.status !== "running" && run.destination ? STAGE_LABEL[run.destination] : "none";
  const destination = run.destination ? STAGE_LABEL[run.destination] : idle ? "none" : "deciding";

  /* ---------------------------------------------------------------------- */
  /*  Zoom and the area the camera may look at                              */
  /* ---------------------------------------------------------------------- */
  const graphW = nav ? nav.fRight - nav.fLeft + NODE_W : NODE_W;
  const graphH = nav ? nav.fBottom - nav.fTop + NODE_H : NODE_H;
  // The finished graph opens fitted to the panel width, so the text stays as large as the panel allows.
  const autoZoom = vertical ? clampN((availW - 56) / graphW, 0.6, availW >= 900 ? 1.15 : 1) : availW >= 700 ? 0.85 : 0.7;
  const baseZoom = clampN(zoomUser ?? autoZoom, ZOOM_MIN, ZOOM_MAX);
  const ready = !!geo && !!nav && availW > 0 && H > 0;
  const zoom = idle || reduce || settledId === run.id ? baseZoom : baseZoom * INTRO_ZOOM;

  const bounds = (z: number): Bounds => {
    if (!nav) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    if (!vertical) return { minX: nav.fLeft - 240, maxX: nav.fRight + 240, minY: -520, maxY: 520 };
    const cxw = (nav.fLeft + nav.fRight) / 2;
    const overflow = Math.max(0, graphW * z - (availW - 32)) / (2 * z);
    const slackX = overflow > 0 ? 40 / z : 0;
    const restY = (H * 0.5 - TOP_PAD) / z;
    const bottom = nav.fBottom + NODE_H / 2;
    return {
      minX: cxw - overflow - slackX,
      maxX: cxw + overflow + slackX,
      minY: restY - 24 / z,
      maxY: Math.max(restY, bottom - (H * 0.5 - TOP_PAD) / z) + 24 / z,
    };
  };

  const dragRef = React.useRef<{ x: number; y: number; fx: number; fy: number; z: number } | null>(null);
  const lookAt = (x: number, y: number) => {
    if (!nav) return;
    const b = bounds(zoom);
    setManual({ x: clampN(x, b.minX, b.maxX), y: clampN(y, b.minY, b.maxY) });
  };

  /* ---------------------------------------------------------------------- */
  /*  Camera and scene                                                      */
  /* ---------------------------------------------------------------------- */
  let scene: React.ReactNode = null;
  let focusNow = { x: 0, y: 0 };
  let gridStyle: React.CSSProperties = {};
  const moveEase = dragging || reduce ? "none" : manual ? LOOK_EASE : `${CAMERA}s cubic-bezier(.22,.8,.2,1)`;

  if (ready && geo && nav) {
    // With a run, a stage exists on the graph once it has started.
    const shown = (id: StageId) => idle || stat(id) !== "pending";
    let batch = 0;
    for (const id of STAGE_ORDER) {
      if (geo.visible.includes(id) && shown(id) && !arrival.current.order.has(id)) arrival.current.order.set(id, batch++);
    }
    const delayOf = (id: StageId) => (arrival.current.order.get(id) ?? 0) * STAGGER;

    // Top-down: the camera rests at the top of the route, centred on the column.
    const rest = vertical ? { x: (nav.fLeft + nav.fRight) / 2, y: (H * 0.5 - TOP_PAD) / zoom } : follow;
    focusNow = manual ?? rest;
    const tx = availW / 2 - focusNow.x * zoom;
    const ty = H * (vertical ? 0.5 : 0.6) - focusNow.y * zoom;

    // A fine dot grid that travels with the camera, so movement is legible.
    const cell = 26 * zoom;
    gridStyle = {
      backgroundImage: `radial-gradient(${w(0.09)} 1px, transparent 1.3px)`,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${(tx % cell).toFixed(1)}px ${(ty % cell).toFixed(1)}px`,
      transition: moveEase === "none" ? "none" : `background-position ${moveEase}, background-size ${moveEase}`,
    };

    /* Wires and the light that travels along them. */
    const base: React.ReactNode[] = [];
    const trains: React.ReactNode[] = [];
    for (const e of geo.edges) {
      const state = edgeState(stat(e.from), stat(e.to));
      const queued = state === "queued";
      // With a run, a wire that leads somewhere not started yet is not drawn.
      if (!idle && queued) continue;
      const toSt = stat(e.to);
      const bad = toSt === "failed" || toSt === "blocked";
      const wireStyle: React.CSSProperties = idle
        ? {}
        : ({
            "--len": `${e.len}`,
            "--draw": `${clampN(e.len / 340, 0.6, 1.1).toFixed(2)}s`,
            // After the switch to top-down the wires wait for the nodes to land, then draw in.
            "--delay": vertical ? `${REDRAW_DELAY.toFixed(2)}s` : `${delayOf(e.to).toFixed(2)}s`,
          } as React.CSSProperties);
      base.push(
        <path
          key={e.key}
          className={idle ? undefined : "qpt-draw"}
          d={e.d}
          fill="none"
          stroke={bad ? FAIL : WIRE}
          strokeOpacity={queued ? 0.28 : state === "travelling" ? 0.4 : 0.6}
          strokeWidth={queued ? 1.5 : 1.75}
          strokeLinecap="round"
          strokeDasharray={queued ? "1.5 7" : undefined}
          pathLength={idle ? undefined : e.len}
          style={wireStyle}
        />,
      );
      if (!idle && state === "travelling" && !reduce) {
        const dur = Math.max(1.1, e.len / TRAIN_SPEED / 0.78).toFixed(2);
        trains.push(
          <path
            key={`${e.key}-t`}
            className="qpt-run"
            d={e.d}
            fill="none"
            stroke={QP.hi}
            strokeWidth={3}
            strokeLinecap="round"
            pathLength={e.len}
            strokeDasharray={`18 ${e.len * 2 + 36}`}
            style={{ "--s": "18", "--e": `${-e.len}`, "--dur": `${dur}s` } as React.CSSProperties}
          />,
        );
      }
    }

    /* Node cards. */
    const hasIn = new Set(geo.edges.map((e) => e.to));
    const hasOut = new Set(geo.edges.map((e) => e.from));
    const cards: React.ReactNode[] = [];
    for (const n of geo.nodes) {
      const st = stat(n.id);
      if (!shown(n.id)) continue;
      const s = stages[n.id];
      const kind = STAGE_KIND[n.id];
      const Icon = KIND_ICON[kind];
      const origin = n.id === "question";
      const ms = typeof s?.ms === "number" && !origin ? s.ms : undefined;
      const hot = ms !== undefined && maxMs > 0 && ms === maxMs;
      const detail = origin ? (idle ? "Ask a question" : (s?.detail ?? run.question)) : (detailOf(s, st) ?? STATUS_TEXT[st]);
      const delay = delayOf(n.id) + (origin ? 0 : WIRE_LEAD);
      cards.push(
        <div
          key={n.id}
          className={cx("qpg-n", !idle && "qpg-in")}
          data-s={st}
          style={{ left: n.x, top: n.y, ...delayVar(delay), ...(idle ? { opacity: 0.6 } : null) }}
        >
          {hasIn.has(n.id) ? <span aria-hidden className={cx("qpg-h", vertical ? "qpg-ht" : "qpg-hl")} /> : null}
          {hasOut.has(n.id) ? <span aria-hidden className={cx("qpg-h", vertical ? "qpg-hb" : "qpg-hr")} /> : null}
          <div className="qpg-hd">
            <span className="qpg-t">{n.label}</span>
            <span className="qpg-bd">
              <Icon size={12} strokeWidth={2} aria-hidden />
              {KIND_LABEL[kind]}
            </span>
          </div>
          <div className="qpg-row">
            <span className="qpg-k">{STAGE_ROW[n.id]}</span>
            {origin ? (
              <span className="qpg-q" style={clamp(2)}>
                {detail}
              </span>
            ) : (
              <span className="qpg-v" title={detail}>
                {detail}
              </span>
            )}
          </div>
          <div className="qpg-ft">
            <span className="qpg-fl">
              <i aria-hidden className="qpg-dot" />
              {STATUS_TEXT[st]}
            </span>
            {ms !== undefined ? (
              <span className="qpg-ms" data-hot={hot ? "1" : "0"}>
                {formatMs(ms)}
              </span>
            ) : null}
          </div>
        </div>,
      );
    }

    scene = (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          transformOrigin: "0 0",
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom.toFixed(4)})`,
          transition: moveEase === "none" ? "none" : `transform ${moveEase}`,
          willChange: "transform",
        }}
      >
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} fill="none" focusable="false">
          <g>{base}</g>
          <g>{trains}</g>
        </svg>
        {cards}
      </div>
    );
  }

  /* The latest camera, for the wheel handler (which is attached once per stage, outside React's render). */
  const camRef = React.useRef<Cam | null>(null);
  camRef.current = { focus: focusNow, zoom, baseZoom, idle, bounds };

  /**
   * Wheel / trackpad: scrolls the graph. Ctrl or Cmd + wheel (and pinch) zooms. When the graph is already at
   * its edge the event is left alone, so the page itself keeps scrolling.
   */
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const c = camRef.current;
      if (!c || c.idle) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        setZoomUser((z) => clampN(Math.round((z ?? c.baseZoom) * f * 100) / 100, ZOOM_MIN, ZOOM_MAX));
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : 1;
      let dx = e.deltaX * unit;
      let dy = e.deltaY * unit;
      if (e.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
      }
      const b = c.bounds(c.zoom);
      const nx = clampN(c.focus.x + dx / c.zoom, b.minX, b.maxX);
      const ny = clampN(c.focus.y + dy / c.zoom, b.minY, b.maxY);
      if (Math.abs(nx - c.focus.x) < 0.5 && Math.abs(ny - c.focus.y) < 0.5) return;
      e.preventDefault();
      setManual({ x: nx, y: ny });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [run.id, ready, idle]);

  /** Arrow keys walk the camera from stop to stop: left/right while running, up/down once top-down. */
  const onKey = (e: React.KeyboardEvent) => {
    if (!nav || idle) return;
    const fwd = vertical ? "ArrowDown" : "ArrowRight";
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const list = vertical ? nav.stopsY : nav.stops;
    const cur = vertical ? focusNow.y : focusNow.x;
    const go = (v: number) => (vertical ? lookAt(focusNow.x, v) : lookAt(v, focusNow.y));
    if (e.key === fwd || e.key === back) {
      e.preventDefault();
      const next = e.key === fwd ? list.find((v) => v > cur + 2) : [...list].reverse().find((v) => v < cur - 2);
      if (next !== undefined) go(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(list[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      go(list[list.length - 1]);
    } else if (e.key === "Escape") {
      setManual(null);
    }
  };

  const setZoom = (z: number) => setZoomUser(clampN(Math.round(z * 100) / 100, ZOOM_MIN, ZOOM_MAX));
  /** Fit: the whole route in view at once, however long it is. */
  const fitAll = () => {
    if (!ready) return;
    setManual(null);
    setZoomUser(clampN(Math.round(Math.min((availW - 56) / graphW, (H - 2 * TOP_PAD) / graphH) * 100) / 100, ZOOM_MIN, 1.2));
  };

  const settled = run.status !== "running";
  const total = timing.phases.reduce((s, p) => s + p.ms, 0);
  const lit = timing.phases.filter((p) => p.ms > 0);
  const timeText = typeof run.totalMs === "number" && settled && !idle ? formatMs(run.totalMs) : meta.label;

  return (
    <section
      aria-label="Agent execution trace"
      className={className}
      style={{ position: "relative", isolation: "isolate", display: "flex", width: "100%", minHeight: 0, flexDirection: "column", overflow: "hidden", color: QP.ink, colorScheme: "dark", fontFamily: SANS, background: QP.bg }}
    >
      <style>{CSS}</style>

      {showChrome && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${w(0.1)}`, padding: "14px 20px" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 580, letterSpacing: "-0.01em", color: w(0.92) }}>Execution trace</h2>
            <p style={{ margin: "4px 0 0", fontSize: 11.5, color: w(0.55) }}>Planner, route, response</p>
          </div>
          <span style={{ display: "inline-flex", flexShrink: 0, alignItems: "center", gap: 8, borderRadius: 999, border: `1px solid ${w(0.14)}`, padding: "6px 12px", fontSize: 11.5, color: w(0.76) }}>
            <span aria-hidden className={meta.pulse ? "qpt-pulse" : undefined} style={{ width: 6, height: 6, borderRadius: 999, background: meta.dot }} />
            {meta.label}
          </span>
        </header>
      )}

      {/* Summary bar. In the flow above the graph: it never covers a node, and it holds the view controls. */}
      <div className="qpt-bar">
        <div className="qpt-row">
          <button type="button" className="qpt-sum" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={idle}>
            <span aria-hidden className={meta.pulse ? "qpt-pulse" : undefined} style={{ width: 7, height: 7, flexShrink: 0, borderRadius: 999, background: meta.dot }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 580, letterSpacing: "-0.012em" }}>{run.label ?? "Planning"}</span>
            <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 12, fontVariantNumeric: "tabular-nums", color: settled && typeof run.totalMs === "number" && !idle ? QP.hi : w(0.62) }}>{timeText}</span>
            {!idle ? <ChevronDown size={15} strokeWidth={2} className="qpt-chev" data-open={open ? "1" : "0"} aria-hidden /> : null}
          </button>

          {!idle ? (
            <div className="qpt-tools">
              {manual !== null ? (
                <button
                  type="button"
                  className="qpt-follow"
                  onClick={() => setManual(null)}
                  style={{ height: 30, cursor: "pointer", borderRadius: 8, border: `1px solid ${alpha(QP.hi, 0.5)}`, background: QP.bg, padding: "0 10px", color: QP.hi, font: "inherit", fontSize: 12 }}
                >
                  {vertical ? "Back to top" : "Follow live"}
                </button>
              ) : null}
              <div className="qpg-zoom" role="group" aria-label="View controls">
                <button type="button" className="qpg-zb" onClick={() => setZoom(baseZoom - ZOOM_STEP)} disabled={baseZoom <= ZOOM_MIN + 0.001} aria-label="Zoom out">
                  {"\u2212"}
                </button>
                <span className="qpg-zv" aria-live="polite">
                  {Math.round(baseZoom * 100)}%
                </span>
                <button type="button" className="qpg-zb" onClick={() => setZoom(baseZoom + ZOOM_STEP)} disabled={baseZoom >= ZOOM_MAX - 0.001} aria-label="Zoom in">
                  +
                </button>
                <button type="button" className="qpg-zb" onClick={fitAll} aria-label="Fit the whole route in view" title="Fit the whole route">
                  <Maximize2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {!idle && total > 0 ? (
          <div role="img" aria-label="Time by phase" style={{ display: "flex", gap: 2, height: 3, margin: "0 14px 8px" }}>
            {lit.map((p) => (
              <span key={p.id} className="qpt-seg" style={{ flexGrow: p.ms, flexBasis: 0, minWidth: 3, borderRadius: 2, background: p.ink }} />
            ))}
          </div>
        ) : null}

        {open && !idle ? <RouteDetails run={run} stops={stops} skippedNames={skippedNames} phases={timing.phases} slowest={timing.slowest} /> : null}
        {idle ? <p style={{ margin: 0, padding: "0 14px 10px", fontSize: 12.5, lineHeight: 1.5, color: w(0.55) }}>{run.reason}</p> : null}
      </div>

      <div ref={ref} style={{ position: "relative", flex: "1 1 0%", minHeight: 320, paddingLeft: left, paddingRight: right }}>
        {!geo ? <p style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", margin: 0, fontSize: 12.5, color: w(0.5) }}>Ask a question to see its route</p> : null}

        {ready && geo ? (
          <div
            key={run.id}
            ref={stageRef}
            className="qpt-stage"
            role={idle ? undefined : "group"}
            aria-label={idle ? undefined : "Execution graph. Scroll or drag to look around, arrow keys move along the route, Escape follows the live step."}
            tabIndex={idle ? undefined : 0}
            onKeyDown={onKey}
            style={{ position: "absolute", top: 0, bottom: 0, left, right, overflow: "hidden", outline: "none" }}
          >
            {/* The world the camera moves through. Drag it to look around. */}
            <div
              aria-hidden
              style={{ position: "absolute", inset: 0, cursor: idle ? "default" : dragging ? "grabbing" : "grab", touchAction: idle ? "auto" : "none", ...gridStyle }}
              onPointerDown={(e) => {
                if (e.button !== 0 || idle) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { x: e.clientX, y: e.clientY, fx: focusNow.x, fy: focusNow.y, z: zoom };
                setDragging(true);
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d || !nav) return;
                lookAt(d.fx - (e.clientX - d.x) / Math.max(0.2, d.z), d.fy - (e.clientY - d.y) / Math.max(0.2, d.z));
              }}
              onPointerUp={(e) => {
                dragRef.current = null;
                setDragging(false);
                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                dragRef.current = null;
                setDragging(false);
              }}
            >
              {scene}
            </div>
          </div>
        ) : null}
      </div>

      {showChrome && (
        <footer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, borderTop: `1px solid ${w(0.1)}`, padding: "14px 20px", fontSize: 11.5 }}>
          <p style={{ margin: 0 }}>
            <span style={{ color: w(0.5) }}>Position </span>
            <span style={{ color: w(0.92) }}>{position}</span>
          </p>
          <p style={{ margin: 0, textAlign: "right" }}>
            <span style={{ color: w(0.5) }}>Destination </span>
            <span style={{ color: w(0.92) }}>{destination}</span>
          </p>
        </footer>
      )}

      {/* Screen-reader equivalent of the graph. Also announces the run status. */}
      <ol style={{ ...SR_ONLY, margin: 0, listStyle: "none" }} aria-label={`Execution stages, ${meta.label.toLowerCase()}`}>
        {run.label ? (
          <li>
            Route: {run.label}. {run.reason}
          </li>
        ) : null}
        {STAGE_ORDER.map((id) => {
          const s = stages[id];
          return (
            <li key={id}>
              {STAGE_TITLE[id]}: {s ? STATUS_TEXT[s.status] : idle ? "idle" : "undecided"}
              {s?.detail ? `, ${s.detail}` : ""}
              {typeof s?.ms === "number" && id !== "question" ? `, ${formatMs(s.ms)}` : ""}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default AgentTrace;