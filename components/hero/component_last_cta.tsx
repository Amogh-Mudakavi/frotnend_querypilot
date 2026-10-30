"use client";

/**

 * QueryPilot final CTA. Full-bleed canvas film, then stillness.

 * White on near-black. Sky blue appears on the curve, and on hover and focus.

 *


 *   1. Draw:    the dot field wakes from the chart's origin. A pen runs along the baseline, then draws

 *               the QueryPilot curve while standard RAG flattens out and misses. The dots under the

 *               curve light up in the curve's own colours. Six steps of the planner pipeline lift it in turn.

 *   2. Handoff: the chart dissolves completely. The pen leaves the tip of the curve,

 *               arcs across the page and lands on top of where the button will be.

 *   3. Form:    the whole dot field leans toward that spot. The pen traces the button's outline once,

 *               the fill blooms outward from its centre to meet the outline, and the field releases

 *               in one wave that imprints a few quiet contour rings across the page. Stillness.

 *

 * The chart is illustrative (no numbers) and labelled as such.

 *

 * Structure: copy and timeline -> math -> layout -> dot field -> painters -> React shell.

 * Every on-canvas size derives from `L.u`, so one film holds on a 360px phone, a laptop and a 4K TV.

 * DOM sizes use `em` off a clamp()'d root.

 */

import { useEffect, useRef, useState } from "react";

import { BookOpen, RotateCcw } from "lucide-react";



/* ───────────────────────────── Copy ───────────────────────────── */



const TITLE = "Better.";

const FINAL_LINE_1 = "Stop searching.";

const FINAL_LINE_2 = "Start asking.";



const L_Y = "Answer quality";

const L_NOTE = "Illustrative";

const L_START = "Single source";

const L_START_S = "Single";

const L_X = "Question complexity";

const L_QP_SUB = "Cites its sources";

const L_QP = "QueryPilot";

const L_RAG = "Standard RAG";

const L_GAP = "Gap";



/**

 * The planner pipeline, as markers the pen passes on its way up the curve. `u` is the position along the curve.

 * They are spaced wider at the flat start and tighter near the top, so every label has room even though the

 * curve is exponential.

 * "Gap-filling retrieval" is conditional in the architecture notes: check it against the repo, or delete the entry.

 */

const MILESTONES = [

  { u: 0.2, label: "Hybrid retrieval", short: "Hybrid", sub: "Vector + BM25 keyword" },

  { u: 0.4, label: "Reranking", short: "Rerank", sub: "Cross-encoder reorder" },

  { u: 0.58, label: "Query planning", short: "Plan", sub: "Splits into subquestions" },

  { u: 0.72, label: "Evidence analysis", short: "Evidence", sub: "Tracks what is still missing" },

  { u: 0.84, label: "Gap-filling retrieval", short: "Gaps", sub: "Targeted follow-up search" },

  { u: 0.95, label: "Grounded answer", short: "Answer", sub: "Cites sources, flags gaps" },

] as const;



/** Question types along the x axis. `u` is the position along the curve. */

const X_TICKS = [

  { u: 0, label: "Multi-source question", short: "Multi-source" },

  { u: 0.5, label: "Multi-step", short: "Multi-step" },

  { u: 0.88, label: "Conflicting evidence", short: "Conflicts" },

] as const;



/** What the system can do at a given height: read off the curve at that step. */

const LEVELS = [

  { step: 1, label: "Finds the right chunks" },

  { step: 3, label: "Reasons across sources" },

] as const;



/* ─────────────────────────── Timeline (seconds) ─────────────────────────── */



const RUN = 0.3; // the pen starts along the baseline

const DIV = 1.5; // the baseline splits: QueryPilot climbs, standard RAG flattens

const QP_DUR = 3.6; // how long the QueryPilot curve takes to draw

const HAND = DIV + QP_DUR + 0.9; // the chart dissolves

const LEAVE = HAND + 0.1; // the pen leaves the tip of the curve

const ARRIVE = HAND + 1.2; // it lands on top of the button

const TRACE = 0.9; // one lap around the button's outline

const MORPH_START = ARRIVE + TRACE * 0.55; // the fill starts to bloom

const MORPH_END = ARRIVE + TRACE + 0.5; // button fully formed

const WAVE = MORPH_END - 0.3; // the field releases in one wave

const REST = MORPH_END + 2.2; // long enough for the wave to finish before the loop stops

const STOPS = [HAND + 0.4, MORPH_END] as const; // stage 0 chart, 1 headline in, 2 actions live

const SKIP_SPEED = 4;



/* ──────────────────────────────── Math ──────────────────────────────── */



const TAU = Math.PI * 2;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const white = (a: number) => `rgba(255,255,255,${clamp(a).toFixed(3)})`;

const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);



function rng(seed: number) {

  return () => {

    seed |= 0;

    seed = (seed + 0x6d2b79f5) | 0;

    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  };

}



type Pt = { x: number; y: number };

type Box = { x: number; y: number; w: number; h: number };



function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {

  ctx.beginPath();

  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);

  else ctx.rect(x, y, w, h);

}



function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, align: CanvasTextAlign, color: string) {

  ctx.textAlign = align;

  ctx.fillStyle = color;

  ctx.fillText(s, x, y);

}



/** A point `d` pixels along a stadium (pill) outline, clockwise from the top centre. */

function stadium(d: number, cx: number, cy: number, w: number, h: number, o: Pt) {

  const r = h / 2;

  const s = Math.max(0, w - h);

  const a = s / 2;

  const c = Math.PI * r;

  if (d < a) {

    o.x = cx + d;

    o.y = cy - r;

    return;

  }

  d -= a;

  if (d < c) {

    const th = -Math.PI / 2 + d / r;

    o.x = cx + a + Math.cos(th) * r;

    o.y = cy + Math.sin(th) * r;

    return;

  }

  d -= c;

  if (d < s) {

    o.x = cx + a - d;

    o.y = cy + r;

    return;

  }

  d -= s;

  if (d < c) {

    const th = Math.PI / 2 + d / r;

    o.x = cx - a + Math.cos(th) * r;

    o.y = cy + Math.sin(th) * r;

    return;

  }

  d -= c;

  o.x = cx - a + d;

  o.y = cy - r;

}

const stadiumLen = (w: number, h: number) => 2 * Math.max(0, w - h) + Math.PI * h;



/* ───────────────────────── Layout (responsive) ───────────────────────── */



type Layout = {

  u: number; // one scale factor: ~1 on a laptop, ~2.3 on a 4K TV, ~0.8 on a small phone

  fs: number;

  narrow: boolean;

  xs: number; // baseline start

  xe: number; // curve end

  xd: number; // divergence

  yb: number; // baseline

  yt: number; // top of the QueryPilot curve

};



function layout(W: number, H: number): Layout {

  const narrow = W < 640;

  const u = clamp(Math.sqrt(W * H) / 900, 0.8, 2.4);

  const fs = clamp(Math.sqrt(W * H) / 80, 12, 22);

  const xs = narrow ? W * 0.08 : Math.max(56, W * 0.07);

  const xe = W - (narrow ? W * 0.17 : Math.max(112, W * 0.1));

  return {

    u,

    fs,

    narrow,

    xs,

    xe,

    xd: xs + (xe - xs) * 0.46,

    yb: H * (narrow ? 0.66 : 0.72),

    yt: H * (narrow ? 0.27 : 0.25),

  };

}



/* Curves: QueryPilot is exponential, standard RAG rises briefly and plateaus low. */

const K = 3.4;

const RAG_TOP = 0.2;

const qpPt = (L: Layout, u: number, o: Pt) => {

  o.x = L.xd + (L.xe - L.xd) * u;

  o.y = L.yb - (L.yb - L.yt) * ((Math.exp(K * u) - 1) / (Math.exp(K) - 1));

};

const ragPt = (L: Layout, u: number, o: Pt) => {

  o.x = L.xd + (L.xe - L.xd) * u;

  o.y = L.yb - (L.yb - L.yt) * RAG_TOP * (1 - Math.pow(1 - u, 2.4));

};



function curve(

  ctx: CanvasRenderingContext2D,

  L: Layout,

  f: (L: Layout, u: number, o: Pt) => void,

  a: number,

  b: number,

) {

  const n = Math.max(2, Math.ceil(72 * (b - a)));

  const p: Pt = { x: 0, y: 0 };

  ctx.beginPath();

  for (let i = 0; i <= n; i++) {

    f(L, a + ((b - a) * i) / n, p);

    if (i === 0) ctx.moveTo(p.x, p.y);

    else ctx.lineTo(p.x, p.y);

  }

}



/* ───────────────────────────── Dot field ───────────────────────────── */



/** A quiet lattice that fills the page. It becomes the chart's fill, then leans toward the button. */

type Lattice = {

  cols: number;

  rows: number;

  gap: number;

  ox: number;

  oy: number;

  qy: Float32Array; // QueryPilot curve height at each column

  ry: Float32Array; // standard RAG curve height at each column

  tint: string[]; // the curve's colour at each column, for the dots in the gap

  seed: Float32Array;

  vig: Float32Array; // edge falloff

};



const SKY = [112, 184, 255];

const LAV = [176, 160, 255];

const PALE = [232, 240, 255];

const mix = (a: number[], b: number[], x: number) => a.map((v, i) => Math.round(lerp(v, b[i], x)));



function makeLattice(W: number, H: number, L: Layout): Lattice {

  const gap = clamp(22 * L.u, 18, 52);

  const cols = Math.floor(W / gap) + 1;

  const rows = Math.floor(H / gap) + 1;

  const ox = (W - (cols - 1) * gap) / 2;

  const oy = (H - (rows - 1) * gap) / 2;

  const qy = new Float32Array(cols);

  const ry = new Float32Array(cols);

  const tint: string[] = [];

  const o: Pt = { x: 0, y: 0 };

  for (let c = 0; c < cols; c++) {

    const uu = clamp((ox + c * gap - L.xd) / Math.max(L.xe - L.xd, 1));

    qpPt(L, uu, o);

    qy[c] = o.y;

    ragPt(L, uu, o);

    ry[c] = o.y;

    const col = uu < 0.6 ? mix(SKY, LAV, uu / 0.6) : mix(LAV, PALE, (uu - 0.6) / 0.4);

    tint.push(`rgb(${col[0]},${col[1]},${col[2]})`);

  }

  const r = rng(3);

  const seed = new Float32Array(cols * rows);

  const vig = new Float32Array(cols * rows);

  for (let i = 0; i < seed.length; i++) {

    const x = ox + (i % cols) * gap;

    const y = oy + Math.floor(i / cols) * gap;

    seed[i] = r();

    const dx = (x - W / 2) / (W / 2);

    const dy = (y - H / 2) / (H / 2);

    vig[i] = 1 - 0.5 * clamp((dx * dx + dy * dy - 0.45) / 1.2);

  }

  return { cols, rows, gap, ox, oy, qy, ry, tint, seed, vig };

}



type FieldParams = {

  intro: number; // 0..1 sweep that reveals the field from the chart's origin

  rip: number; // release wave strength

  ringR: number; // release wave radius

  qpx: number; // right edge of the drawn QueryPilot curve

  ragx: number; // right edge of the drawn RAG curve

  fill: number; // chart fill strength

  scan: number; // 1 while the pen is drawing: a bright edge rides the leading column

  hole: number; // clears the field behind the headline

  mag: number; // how far the field leans toward the button (dips below 0 on release)

  halo: number; // a soft glow that stays around the button

};



type Pointer = { x: number; y: number; on: boolean };



type Clock = {

  fade: number; // the whole chart, curve included

  run: number; // pen runs along the baseline

  qp: number; // QueryPilot curve progress

  ra: number; // standard RAG curve progress

};



type Env = {

  ctx: CanvasRenderingContext2D;

  W: number;

  H: number;

  t: number;

  L: Layout;

  lat: Lattice;

  lp: FieldParams;

  fam: string;

  ptr: Pointer;

  tgt: Pt; // centre of the primary button

  btn: { w: number; h: number };

  head: Box; // the headline, so the field can clear behind it

  k: Clock;

  pen: Pt;

};



function clock(t: number): Clock {

  return {

    fade: 1 - ease(seg(t, HAND, HAND + 0.8)),

    run: ease(seg(t, RUN, DIV)),

    qp: ease(seg(t, DIV, DIV + QP_DUR)),

    ra: outCubic(seg(t, DIV, DIV + QP_DUR - 0.7)),

  };

}



/** Where the pen is at time `t`: along the baseline, up the curve, across the page, around the button. */

function penAt(e: Env, t: number, o: Pt) {

  const { L, tgt, btn, H } = e;

  if (t < DIV) {

    o.x = lerp(L.xs, L.xd, ease(seg(t, RUN, DIV)));

    o.y = L.yb;

    return;

  }

  if (t < LEAVE) {

    qpPt(L, ease(seg(t, DIV, DIV + QP_DUR)), o);

    return;

  }

  const topY = tgt.y - btn.h / 2;

  if (t < ARRIVE) {

    const f = ease(seg(t, LEAVE, ARRIVE));

    const m = 1 - f;

    const cx = lerp(L.xe, tgt.x, 0.3);

    const cy = Math.min(L.yt, topY) - H * 0.14;

    o.x = m * m * L.xe + 2 * m * f * cx + f * f * tgt.x;

    o.y = m * m * L.yt + 2 * m * f * cy + f * f * topY;

    return;

  }

  const p = ease(seg(t, ARRIVE, ARRIVE + TRACE));

  stadium(p * stadiumLen(btn.w, btn.h), tgt.x, tgt.y, btn.w, btn.h, o);

}



function setWeather(e: Env) {

  const { t, W, H, L, k, lp } = e;

  const rp = seg(t, WAVE, WAVE + 1.9);

  lp.intro = seg(t, 0, 1.1);

  lp.rip = rp > 0 && rp < 1 ? 1 - rp : 0;

  lp.ringR = outCubic(rp) * Math.max(W, H) * 0.62;

  lp.qpx = lerp(L.xd, L.xe, k.qp);

  lp.ragx = lerp(L.xd, L.xe, k.ra);

  lp.fill = seg(t, DIV, DIV + 0.6) * (1 - seg(t, HAND, HAND + 0.9)); // the glow leaves with the chart

  lp.scan = 1 - seg(t, DIV + QP_DUR - 0.5, DIV + QP_DUR);

  lp.hole = ease(seg(t, HAND, HAND + 1.2));

  lp.mag =

    ease(seg(t, ARRIVE - 0.3, ARRIVE + TRACE)) -

    1.25 * ease(seg(t, MORPH_END - 0.2, MORPH_END + 0.35)) +

    0.25 * ease(seg(t, MORPH_END + 0.35, MORPH_END + 1.2));

  lp.halo = seg(t, WAVE, WAVE + 1.4);

}



/* ───────────────────────────── Painters ───────────────────────────── */



/** The dot field. Its brightness is the weather of the whole film. */

function lattice(e: Env) {

  const { ctx, W, H, t, lat, L, ptr, tgt, head, lp } = e;

  const { cols, rows, gap, ox, oy, qy, ry, tint, seed, vig } = lat;

  const u = L.u;

  const sz = clamp(1.3 * u, 1.1, 3);

  const reach = Math.hypot(W, H) * 0.6;

  const introOn = lp.intro < 0.999;

  const ripOn = lp.rip > 0.001;

  const fillOn = lp.fill > 0.001;

  const holeOn = lp.hole > 0.001;

  const magOn = Math.abs(lp.mag) > 0.001;

  const haloOn = lp.halo > 0.001;

  const ringW = 60 * u;

  const MR = Math.min(W, H) * 0.45;

  const HR = Math.min(W, H) * 0.5;

  const PR = 150 * u;

  const PR2 = PR * PR;

  const hrx = head.w * 0.62 + 30 * u;

  const hry = head.h * 0.9 + 16 * u;

  const fadeW = 40 * u;

  let cur = "";

  for (let r = 0; r < rows; r++) {

    const y = oy + r * gap;

    for (let c = 0; c < cols; c++) {

      const i = r * cols + c;

      const x = ox + c * gap;

      let a = 0.07 * (0.6 + 0.8 * seed[i]);

      let lit = 0;

      let tinted = false;

      if (introOn) a *= clamp((lp.intro * 2.2 - Math.hypot(x - L.xs, y - L.yb) / reach) / 0.35);

      if (ripOn) {

        const d = (Math.hypot(x - tgt.x, y - tgt.y) - lp.ringR) / ringW;

        lit += 0.4 * lp.rip * Math.exp(-d * d);

      }

      if (fillOn && x >= L.xd - 1 && x <= lp.qpx) {

        const q = qy[c];

        if (y >= q - 1 && y <= L.yb + 1) {

          const rev = clamp((lp.qpx - x) / fadeW) * lp.fill;

          const h = (L.yb - y) / Math.max(L.yb - q, 6); // 0 on the baseline, 1 on the curve

          if (y >= ry[c] - 1 && x <= lp.ragx) {

            lit += (0.05 + 0.1 * h) * rev; // what both systems reach

          } else {

            // the gap: it shimmers in the curve's colours, and a bright edge rides the column the pen is on

            const spark = 0.88 + 0.12 * Math.sin(t * 1.6 + seed[i] * 40);

            const eg = (lp.qpx - x) / (fadeW * 0.7);

            lit += 0.42 * h * h * spark * rev + 0.22 * Math.exp(-eg * eg) * h * lp.scan * lp.fill;

            tinted = true;

          }

        }

      }

      if (haloOn) {

        const d = Math.hypot(x - tgt.x, y - tgt.y) / HR;

        lit += 0.1 * lp.halo * Math.exp(-d * d);

      }

      let px = x;

      let py = y;

      if (magOn) {

        const dx = tgt.x - x;

        const dy = tgt.y - y;

        const d = Math.hypot(dx, dy);

        if (d < MR) {

          const f = 1 - d / MR;

          const pull = lp.mag * f * f * 0.55;

          px = x + dx * pull;

          py = y + dy * pull;

          lit += 0.22 * Math.max(0, lp.mag) * f * f;

        }

      }

      if (ptr.on) {

        const dx = x - ptr.x;

        const dy = y - ptr.y;

        const d2 = dx * dx + dy * dy;

        if (d2 < PR2) {

          const f = 1 - Math.sqrt(d2) / PR;

          lit += 0.3 * f * f;

        }

      }

      let total = (a + lit) * vig[i];

      if (holeOn) {

        const ex = (x - head.x) / hrx;

        const ey = (y - head.y) / hry;

        const e2 = ex * ex + ey * ey;

        if (e2 < 1) total *= 1 - 0.92 * lp.hole * (1 - e2);

      }

      if (total < 0.01) continue;

      const col = tinted ? tint[c] : "#fff";

      if (col !== cur) {

        ctx.fillStyle = col;

        cur = col;

      }

      const s = sz * (1 + 1.1 * Math.min(lit, 0.5));

      ctx.globalAlpha = Math.min(total, 0.85);

      ctx.fillRect(px - s / 2, py - s / 2, s, s);

    }

  }

  ctx.globalAlpha = 1;

}



/** A capability icon, centred on the origin: overlapping circles, sorted bars, a branching plan. */

function miniIcon(ctx: CanvasRenderingContext2D, i: number, r: number) {

  ctx.lineWidth = 1;

  ctx.strokeStyle = "#fff";

  ctx.fillStyle = "#fff";

  if (i === 0) {

    ctx.beginPath();

    ctx.arc(-r * 0.32, 0, r * 0.58, 0, TAU);

    ctx.moveTo(r * 0.32 + r * 0.58, 0);

    ctx.arc(r * 0.32, 0, r * 0.58, 0, TAU);

    ctx.stroke();

  } else if (i === 1) {

    const bw = r * 0.34;

    const hs = [1.0, 0.72, 0.44];

    for (let j = 0; j < 3; j++) {

      const h = r * hs[j];

      ctx.fillRect(-r * 0.68 + j * (bw + r * 0.17), r * 0.5 - h, bw, h);

    }

  } else if (i === 2) {

    const ty = -r * 0.55;

    const by = r * 0.55;

    const xs = [-r * 0.7, 0, r * 0.7];

    ctx.beginPath();

    for (const x of xs) {

      ctx.moveTo(0, ty);

      ctx.lineTo(x, by);

    }

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(0, ty, r * 0.2, 0, TAU);

    for (const x of xs) {

      ctx.moveTo(x + r * 0.2, by);

      ctx.arc(x, by, r * 0.2, 0, TAU);

    }

    ctx.fill();

  } else if (i === 3) {

    // evidence: one part answered, one still missing

    ctx.beginPath();

    ctx.moveTo(-r * 0.7, -r * 0.35);

    ctx.lineTo(-r * 0.45, -r * 0.1);

    ctx.lineTo(-r * 0.05, -r * 0.6);

    ctx.moveTo(r * 0.12, -r * 0.35);

    ctx.lineTo(r * 0.75, -r * 0.35);

    ctx.moveTo(r * 0.12, r * 0.5);

    ctx.lineTo(r * 0.75, r * 0.5);

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(-r * 0.4, r * 0.5, r * 0.25, 0, TAU);

    ctx.stroke();

  } else if (i === 4) {

    // gap-filling retrieval: a loop that goes around again

    const th = Math.PI * 1.45;

    const rr = r * 0.62;

    ctx.beginPath();

    ctx.arc(0, 0, rr, -Math.PI * 0.15, th);

    ctx.stroke();

    const ex = rr * Math.cos(th);

    const ey = rr * Math.sin(th);

    const dx = -Math.sin(th);

    const dy = Math.cos(th);

    ctx.beginPath();

    for (const sg of [-1, 1]) {

      const c = Math.cos(0.6 * sg);

      const n = Math.sin(0.6 * sg);

      ctx.moveTo(ex, ey);

      ctx.lineTo(ex - (dx * c - dy * n) * r * 0.34, ey - (dx * n + dy * c) * r * 0.34);

    }

    ctx.stroke();

  } else {

    // grounded answer: a check inside a circle

    ctx.beginPath();

    ctx.arc(0, 0, r * 0.7, 0, TAU);

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(-r * 0.32, 0);

    ctx.lineTo(-r * 0.07, r * 0.27);

    ctx.lineTo(r * 0.36, -r * 0.25);

    ctx.stroke();

  }

}



/** The chart: axes, the standard RAG curve, the QueryPilot curve and its three milestones. */

function drawChart(e: Env) {

  const { ctx, t, L, lat, fam, k, lp } = e;

  const lu = L.u;

  const { fade, run, qp, ra } = k;

  const gIn = seg(t, 0.1, 0.8) * fade;

  const pe: Pt = { x: 0, y: 0 };

  const pm: Pt = { x: 0, y: 0 };



  /* axes, grid, ticks and labels */

  if (gIn > 0.001) {

    const ax = lerp(L.xs, L.xd, run);

    const ya = seg(t, 0.2, 1.0) * fade;

    ctx.lineWidth = 1;



    // faint rules across the whole chart, so the page reads as a plot and not as floating lines

    const gr0 = ease(seg(t, 0.3, 1.6));

    ctx.globalAlpha = gIn;

    ctx.strokeStyle = white(0.05);

    ctx.beginPath();

    for (let i = 1; i <= 4; i++) {

      const y = lerp(L.yb, L.yt, i / 4);

      ctx.moveTo(L.xs, y);

      ctx.lineTo(lerp(L.xs, L.xe + 6, gr0), y);

    }

    ctx.stroke();



    // y axis, fading as it climbs

    if (ya > 0.001) {

      const gy = ctx.createLinearGradient(0, L.yb, 0, L.yt);

      gy.addColorStop(0, "rgba(255,255,255,0.4)");

      gy.addColorStop(1, "rgba(255,255,255,0)");

      ctx.globalAlpha = ya;

      ctx.strokeStyle = gy;

      ctx.beginPath();

      ctx.moveTo(L.xs, L.yb);

      ctx.lineTo(L.xs, L.yt - 6 * lu);

      ctx.stroke();

      ctx.strokeStyle = white(0.22);

      ctx.beginPath();

      for (let i = 1; i <= 4; i++) {

        const y = lerp(L.yb, L.yt, i / 4);

        ctx.moveTo(L.xs, y);

        ctx.lineTo(L.xs + 5 * lu, y);

      }

      ctx.stroke();

    }



    // baseline: grows from nothing as the pen runs along it

    const gb = ctx.createLinearGradient(L.xs, 0, Math.max(L.xd, L.xs + 1), 0);

    gb.addColorStop(0, "rgba(255,255,255,0)");

    gb.addColorStop(1, "rgba(255,255,255,0.6)");

    ctx.globalAlpha = gIn;

    ctx.strokeStyle = gb;

    ctx.beginPath();

    ctx.moveTo(L.xs, L.yb);

    ctx.lineTo(ax, L.yb);

    ctx.stroke();



    // the floor continues to the right: what a flat system would do

    const fl = ease(seg(t, DIV, DIV + QP_DUR - 0.2));

    if (fl > 0.001) {

      ctx.strokeStyle = white(0.14);

      ctx.beginPath();

      ctx.moveTo(L.xd, L.yb);

      ctx.lineTo(lerp(L.xd, L.xe, fl), L.yb);

      ctx.stroke();

    }



    // a dashed line rises from the point where the question turns multi-source

    const va = seg(t, DIV - 0.2, DIV + 0.8);

    if (va > 0.001) {

      ctx.setLineDash([2 * lu, 6 * lu]);

      ctx.strokeStyle = white(0.1);

      ctx.beginPath();

      ctx.moveTo(L.xd, L.yb);

      ctx.lineTo(L.xd, lerp(L.yb, L.yt - 10 * lu, outCubic(va)));

      ctx.stroke();

      ctx.setLineDash([]);

    }



    // x ticks on the lattice columns, revealed as the line passes

    const reachX = t < DIV ? ax : lp.qpx;

    const { cols, ox, gap } = lat;

    ctx.strokeStyle = white(0.2);

    ctx.beginPath();

    for (let c = 0; c < cols; c += 4) {

      const x = ox + c * gap;

      if (x < L.xs || x > Math.min(reachX, L.xe)) continue;

      ctx.moveTo(x, L.yb);

      ctx.lineTo(x, L.yb + 3 * lu);

    }

    ctx.stroke();

    ctx.globalAlpha = 1;



    // labels

    ctx.textBaseline = "middle";

    ctx.font = `${L.fs}px ${fam}`;

    text(ctx, L_Y, L.xs + 10 * lu, L.yt - 6 * lu, "left", white(0.78 * ya));

    ctx.font = `${L.fs * 0.85}px ${fam}`;

    text(ctx, L_NOTE, L.xs + 10 * lu, L.yt + 12 * lu, "left", white(0.38 * ya));

    ctx.font = `${L.fs}px ${fam}`;

    text(ctx, L.narrow ? L_START_S : L_START, L.xs, L.yb + 28 * lu, "left", white(0.5 * ya));

    const tIn = seg(t, DIV - 0.2, DIV + 0.6) * fade;

    for (const tk of X_TICKS) {

      const ta = tIn * seg(qp, tk.u - 0.12, tk.u + 0.02);

      if (ta <= 0.001) continue;

      const x = L.xd + (L.xe - L.xd) * tk.u;

      ctx.strokeStyle = white(0.4 * ta);

      ctx.beginPath();

      ctx.moveTo(x, L.yb + 4);

      ctx.lineTo(x, L.yb + 12 * lu);

      ctx.stroke();

      text(ctx, L.narrow ? tk.short : tk.label, x, L.yb + 28 * lu, "center", white(0.75 * ta));

    }

    ctx.font = `${L.fs * 0.85}px ${fam}`;

    text(ctx, L_X, L.xe + 6, L.yb + 28 * lu + L.fs * 1.7, "right", white(0.38 * seg(t, DIV + 1, DIV + 2) * fade));



    // what the system can do at each height, read off the curve as the pen passes each step

    if (!L.narrow) {

      for (const lv of LEVELS) {

        const m = MILESTONES[lv.step];

        const la = seg(qp, m.u, m.u + 0.06) * fade;

        if (la <= 0.001) continue;

        qpPt(L, m.u, pm);

        ctx.strokeStyle = white(0.14 * la);

        ctx.setLineDash([2 * lu, 5 * lu]);

        ctx.beginPath();

        ctx.moveTo(L.xs, pm.y);

        ctx.lineTo(pm.x, pm.y);

        ctx.stroke();

        ctx.setLineDash([]);

        ctx.font = `${L.fs * 0.85}px ${fam}`;

        text(ctx, lv.label, L.xs + 12 * lu, pm.y - 9 * lu, "left", white(0.55 * la));

      }

    }

  }



  /* standard RAG: rises briefly, then flattens out. Small crosses mark the questions it misses. */

  let ragEnd = 0;

  if (ra > 0.001 && fade > 0.001) {

    ctx.globalAlpha = fade;

    ctx.strokeStyle = white(0.42);

    ctx.lineWidth = 1;

    curve(ctx, L, ragPt, 0, ra);

    ctx.stroke();



    const cx = 2.6 * Math.min(lu, 1.6);

    ctx.strokeStyle = white(0.4);

    ctx.beginPath();

    for (let j = 0; j < 6; j++) {

      const uu = 0.5 + j * 0.1;

      if (uu > ra) break;

      ragPt(L, uu, pm);

      ctx.moveTo(pm.x - cx, pm.y - cx);

      ctx.lineTo(pm.x + cx, pm.y + cx);

      ctx.moveTo(pm.x + cx, pm.y - cx);

      ctx.lineTo(pm.x - cx, pm.y + cx);

    }

    ctx.stroke();



    ragPt(L, ra, pe);

    ctx.fillStyle = white(0.65);

    ctx.beginPath();

    ctx.arc(pe.x, pe.y, 2.4 * lu, 0, TAU);

    ctx.fill();

    ctx.globalAlpha = 1;

    ragEnd = pe.y;

  }



  /* QueryPilot: a smooth line, sky blue for the most part, with a soft band of colour drifting along it.

     It leaves with the rest of the chart. */

  if (qp > 0.001 && fade > 0.001) {

    const lw = Math.min(lu, 1.6);

    const b = 0.5 + 0.2 * Math.sin(t * 0.45);

    const gq = ctx.createLinearGradient(L.xd, L.yb, L.xe, L.yt);

    gq.addColorStop(0, "rgba(99,161,255,0.3)");

    gq.addColorStop(clamp(b - 0.22), "rgba(112,184,255,0.9)");

    gq.addColorStop(clamp(b - 0.11), "rgba(176,160,255,0.95)");

    gq.addColorStop(clamp(b - 0.04), "rgba(255,160,205,0.95)");

    gq.addColorStop(clamp(b + 0.03), "rgba(255,206,140,0.95)");

    gq.addColorStop(clamp(b + 0.12), "rgba(130,200,255,0.95)");

    gq.addColorStop(clamp(b + 0.24), "rgba(112,184,255,0.95)");

    gq.addColorStop(1, "rgba(228,240,255,1)");

    ctx.strokeStyle = gq;

    if (fade > 0.001) {

      ctx.globalAlpha = 0.1 * fade;

      ctx.lineWidth = 16 * lw;

      curve(ctx, L, qpPt, 0, qp);

      ctx.stroke();

      ctx.globalAlpha = 0.18 * fade;

      ctx.lineWidth = 6.5 * lw;

      curve(ctx, L, qpPt, 0, qp);

      ctx.stroke();

    }

    ctx.globalAlpha = fade;

    ctx.lineWidth = 2;

    curve(ctx, L, qpPt, 0, qp);

    ctx.stroke();

    ctx.globalAlpha = 1;

    ctx.lineWidth = 1;

  }



  drawMilestones(e);



  /* end labels and the bracketed gap */

  const la = seg(t, DIV + QP_DUR - 0.8, DIV + QP_DUR - 0.1) * fade;

  if (la > 0.001) {

    ctx.textBaseline = "middle";

    ctx.font = `500 ${L.fs}px ${fam}`;

    text(ctx, L_QP, L.xe + 6, L.yt - 26 * lu, "right", white(0.95 * la));

    if (!L.narrow) {

      ctx.font = `${L.fs * 0.78}px ${fam}`;

      text(ctx, L_QP_SUB, L.xe + 6, L.yt - 26 * lu + L.fs * 1.05, "right", white(0.42 * la));

    }

    ctx.font = `${L.fs}px ${fam}`;

    text(ctx, L_RAG, L.xe + 6, ragEnd + 20 * lu, "right", white(0.55 * la));

    const ba = ease(seg(t, DIV + QP_DUR - 0.6, DIV + QP_DUR + 0.2)) * fade;

    if (ba > 0.001) {

      const bx = L.xe + (L.narrow ? 16 : 32) * lu;

      const y1 = lerp(ragEnd, L.yt, ba);

      ctx.strokeStyle = white(0.34 * ba);

      ctx.lineWidth = 1;

      ctx.beginPath();

      ctx.moveTo(bx - 5, ragEnd);

      ctx.lineTo(bx, ragEnd);

      ctx.lineTo(bx, y1);

      ctx.lineTo(bx - 5, y1);

      ctx.stroke();

      ctx.font = `${L.fs * 0.88}px ${fam}`;

      text(ctx, L_GAP, bx + 9, (ragEnd + L.yt) / 2, "left", white(0.55 * ba * seg(ba, 0.6, 1)));

    }

  }

}



/** Nodes on the QueryPilot curve. Each pops when the pen passes it, shows its own icon and names the capability. */

function drawMilestones(e: Env) {

  const { ctx, L, fam, k } = e;

  const lu = L.u;

  const p: Pt = { x: 0, y: 0 };

  const rb = 8.2 * lu;

  ctx.textBaseline = "middle";

  for (let i = 0; i < MILESTONES.length; i++) {

    const m = MILESTONES[i];

    const pop = seg(k.qp, m.u, m.u + 0.05) * k.fade;

    if (pop <= 0.001) continue;

    qpPt(L, m.u, p);



    // a dotted drop line to the baseline, with a tick where it lands

    ctx.lineWidth = 1;

    ctx.strokeStyle = white(0.22 * pop);

    ctx.setLineDash([2 * lu, 5 * lu]);

    ctx.beginPath();

    ctx.moveTo(p.x, p.y + rb + 2 * lu);

    ctx.lineTo(p.x, L.yb);

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.strokeStyle = white(0.5 * pop);

    ctx.beginPath();

    ctx.moveTo(p.x, L.yb - 3 * lu);

    ctx.lineTo(p.x, L.yb + 3 * lu);

    ctx.stroke();



    // one ring as the pen arrives

    const burst = seg(k.qp, m.u, m.u + 0.12);

    if (burst < 1) {

      ctx.strokeStyle = white(0.5 * (1 - burst) * k.fade);

      ctx.beginPath();

      ctx.arc(p.x, p.y, rb + 14 * outCubic(burst), 0, TAU);

      ctx.stroke();

    }



    // the badge: a dark disc with the capability's icon

    ctx.globalAlpha = pop;

    ctx.fillStyle = "#080A09";

    ctx.strokeStyle = white(0.95);

    ctx.beginPath();

    ctx.arc(p.x, p.y, rb * (0.7 + 0.3 * outCubic(pop)), 0, TAU);

    ctx.fill();

    ctx.stroke();

    ctx.save();

    ctx.translate(p.x, p.y);

    miniIcon(ctx, i, rb * 0.62);

    ctx.restore();

    ctx.globalAlpha = 1;



    // the label sits up and to the left, over the empty side of the curve

    const la = seg(k.qp, m.u + 0.02, m.u + 0.12) * k.fade;

    if (la > 0.001) {

      const lx = p.x - (rb + 4 * lu);

      const ly = p.y - 22 * lu;

      ctx.font = `${L.fs * 0.92}px ${fam}`;

      text(ctx, L.narrow ? m.short : m.label, lx, ly, "right", white(0.86 * la));

      if (!L.narrow) {

        ctx.font = `${L.fs * 0.78}px ${fam}`;

        text(ctx, m.sub, lx, ly + L.fs * 1.05, "right", white(0.42 * la));

      }

    }

  }

}



/** Quiet contour rings around the button. The release wave imprints them one by one and they stay. */

function drawContours(e: Env) {

  const { ctx, W, H, t, tgt, L } = e;

  const rp = seg(t, WAVE, WAVE + 1.9);

  if (rp <= 0) return;

  const R = outCubic(rp) * Math.max(W, H) * 0.62;

  const base = Math.min(W, H) * 0.17;

  ctx.lineWidth = 1;

  ctx.strokeStyle = "#fff";

  for (let i = 0; i < 6; i++) {

    const r = base * (1 + i * 0.62);

    const a = 0.08 * (1 - i * 0.13) * seg(R, r - 30 * L.u, r);

    if (a <= 0.002) continue;

    ctx.globalAlpha = a;

    ctx.beginPath();

    ctx.arc(tgt.x, tgt.y, r, 0, TAU);

    ctx.stroke();

  }

  ctx.globalAlpha = 1;

}



const TRAIL = 14;

const trA: Pt = { x: 0, y: 0 };

const trB: Pt = { x: 0, y: 0 };



/** The pen: a comet with a tapering tail. It draws the baseline and the curve, crosses the page and traces the button. */

function drawPen(e: Env) {

  const { ctx, t, L, pen } = e;

  const vis = seg(t, 0.1, 0.5) * (1 - seg(t, MORPH_START + 0.15, MORPH_END));

  if (vis <= 0.001) return;

  const lu = Math.min(L.u, 1.6);

  ctx.strokeStyle = "#fff";

  penAt(e, t, trA);

  for (let i = 1; i <= TRAIL; i++) {

    penAt(e, t - i * 0.03, trB);

    const f = 1 - i / (TRAIL + 1);

    ctx.globalAlpha = 0.6 * f * vis;

    ctx.lineWidth = (0.6 + 3.2 * f) * lu;

    ctx.beginPath();

    ctx.moveTo(trA.x, trA.y);

    ctx.lineTo(trB.x, trB.y);

    ctx.stroke();

    trA.x = trB.x;

    trA.y = trB.y;

  }

  const gr = ctx.createRadialGradient(pen.x, pen.y, 0, pen.x, pen.y, 30 * lu);

  gr.addColorStop(0, "rgba(140,196,255,0.4)");

  gr.addColorStop(1, "rgba(140,196,255,0)");

  ctx.globalAlpha = vis;

  ctx.fillStyle = gr;

  ctx.fillRect(pen.x - 30 * lu, pen.y - 30 * lu, 60 * lu, 60 * lu);

  ctx.fillStyle = "#fff";

  ctx.beginPath();

  ctx.arc(pen.x, pen.y, (3.6 + 2 * seg(t, DIV, DIV + QP_DUR)) * lu, 0, TAU);

  ctx.fill();

  ctx.globalAlpha = 1;

}



/** The button's outline, drawn by the pen in one lap, then one echo ring when the fill meets it. */

function drawOutline(e: Env) {

  const { ctx, t, tgt, btn, L } = e;

  const p = ease(seg(t, ARRIVE, ARRIVE + TRACE));

  if (p <= 0.001) return;

  const out = 1 - seg(t, MORPH_END - 0.1, MORPH_END + 0.5);

  if (out > 0.001) {

    const total = stadiumLen(btn.w, btn.h);

    const n = Math.ceil(90 * p) + 2;

    const o: Pt = { x: 0, y: 0 };

    ctx.strokeStyle = "#fff";

    ctx.lineWidth = 1.4;

    ctx.globalAlpha = 0.85 * out;

    ctx.beginPath();

    for (let i = 0; i <= n; i++) {

      stadium((total * p * i) / n, tgt.x, tgt.y, btn.w, btn.h, o);

      if (i === 0) ctx.moveTo(o.x, o.y);

      else ctx.lineTo(o.x, o.y);

    }

    ctx.stroke();

  }

  const q = seg(t, MORPH_END - 0.2, MORPH_END + 1.2);

  if (q > 0 && q < 1) {

    const g = outCubic(q) * 22 * L.u;

    ctx.strokeStyle = "#fff";

    ctx.lineWidth = 1;

    ctx.globalAlpha = 0.3 * (1 - q);

    rrect(ctx, tgt.x - btn.w / 2 - g, tgt.y - btn.h / 2 - g, btn.w + g * 2, btn.h + g * 2, (btn.h + g * 2) / 2);

    ctx.stroke();

  }

  ctx.globalAlpha = 1;

}



/** The whole film for one instant. Painters run back to front. */

function draw(e: Env) {

  const { ctx, W, H, t } = e;

  e.k = clock(t);

  penAt(e, t, e.pen);

  setWeather(e);

  ctx.clearRect(0, 0, W, H);

  ctx.lineCap = "round";

  ctx.textBaseline = "middle";

  lattice(e);

  drawContours(e);

  drawChart(e);

  drawOutline(e);

  drawPen(e);

}



/* ─────────────────────────────── Section ─────────────────────────────── */



export default function FinalCTASection({

  ctaHref = "/signup",

  docsHref = "/engineering",

}: {

  ctaHref?: string;

  docsHref?: string;

}) {

  const wrap = useRef<HTMLElement>(null);

  const cv = useRef<HTMLCanvasElement>(null);

  const headRef = useRef<HTMLHeadingElement>(null);

  const primary = useRef<HTMLAnchorElement>(null);

  const disc = useRef<HTMLSpanElement>(null);

  const label = useRef<HTMLSpanElement>(null);

  const secondary = useRef<HTMLAnchorElement>(null);

  const skipBtn = useRef<HTMLButtonElement>(null);

  const replayBtn = useRef<HTMLButtonElement>(null);

  const replayRef = useRef<(() => void) | null>(null);

  const skipRef = useRef<(() => void) | null>(null);

  // 0 chart, 1 headline in, 2 actions live

  const [stage, setStage] = useState(0);

  const [reduced, setReduced] = useState(false);



  useEffect(() => {

    const el = wrap.current;

    const c = cv.current;

    if (!el || !c) return;

    const ctx = c.getContext("2d");

    const k = { t: 0, last: 0, raf: 0, poke: 0, started: false, stage: 0, boost: false };

    const tgt: Pt = { x: 0, y: 0 };

    const ptr: Pointer = { x: 0, y: 0, on: false };

    const size = { w: 12, h: 12 };

    const head: Box = { x: 0, y: 0, w: 0, h: 0 };

    const fam = getComputedStyle(el).fontFamily || "ui-sans-serif, system-ui, sans-serif";

    let env: Env | null = null;



    const measure = () => {

      const a = primary.current;

      const h = headRef.current;

      if (!a) return;

      const r = el.getBoundingClientRect();

      const b = a.getBoundingClientRect();

      tgt.x = b.left - r.left + b.width / 2;

      tgt.y = b.top - r.top + b.height / 2;

      size.w = b.width;

      size.h = b.height;

      if (h) {

        const hb = h.getBoundingClientRect();

        head.x = hb.left - r.left + hb.width / 2;

        head.y = hb.top - r.top + hb.height / 2;

        head.w = hb.width;

        head.h = hb.height;

      }

    };



    // the button's fill blooms outward from its centre and the label and docs link follow the clock

    const applyDom = () => {

      const d = disc.current;

      const l = label.current;

      const s = secondary.current;

      if (!d || !l || !s) return;

      const e = ease(seg(k.t, MORPH_START, MORPH_END));

      d.style.opacity = e > 0 ? "1" : "0";

      d.style.clipPath = `circle(${lerp(0, Math.hypot(size.w, size.h) / 2 + 2, e)}px at 50% 50%)`;

      l.style.opacity = String(seg(e, 0.55, 1));

      s.style.opacity = String(seg(k.t, MORPH_END + 0.1, MORPH_END + 0.9));

    };



    if (!ctx) {

      // no canvas: show the end state and skip the film

      measure();

      k.t = REST;

      setReduced(true);

      setStage(STOPS.length);

      applyDom();

      return;

    }



    const lp: FieldParams = {

      intro: 0,

      rip: 0,

      ringR: 0,

      qpx: 0,

      ragx: 0,

      fill: 0,

      scan: 1,

      hole: 0,

      mag: 0,

      halo: 0,

    };



    // size the canvas to the section and rebuild everything that depends on its shape

    const fit = () => {

      const r = el.getBoundingClientRect();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const W = r.width;

      const H = r.height;

      c.width = Math.round(W * dpr);

      c.height = Math.round(H * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const L = layout(W, H);

      measure();

      env = {

        ctx,

        W,

        H,

        t: k.t,

        L,

        lat: makeLattice(W, H, L),

        lp,

        fam,

        ptr,

        tgt,

        btn: size,

        head,

        k: clock(k.t),

        pen: { x: L.xs, y: L.yb },

      };

    };

    const render = () => {

      const e = env;

      if (!e) return;

      if (k.t > HAND - 0.5 && k.t < MORPH_END + 0.5) measure();

      e.t = k.t;

      draw(e);

      applyDom();

    };

    const tick = (now: number) => {

      let dt = Math.min((now - k.last) / 1000, 0.1);

      k.last = now;

      if (k.boost) {

        dt *= SKIP_SPEED;

        if (k.t + dt >= MORPH_END) k.boost = false;

      }

      k.t += dt;

      let s = 0;

      for (const x of STOPS) if (k.t >= x) s++;

      if (s !== k.stage) {

        k.stage = s;

        setStage(s);

      }

      render();

      // the end state is still: stop the loop once it has settled

      if (k.t >= REST) {

        k.raf = 0;

        return;

      }

      k.raf = requestAnimationFrame(tick);

    };

    const play = () => {

      if (k.raf) return;

      k.last = performance.now();

      k.raf = requestAnimationFrame(tick);

    };

    const pause = () => {

      cancelAnimationFrame(k.raf);

      k.raf = 0;

    };

    // after the film has settled the loop is off: redraw once per pointer move so the dot field still reacts

    const poke = () => {

      if (k.raf || k.poke || k.t < REST) return;

      k.poke = requestAnimationFrame(() => {

        k.poke = 0;

        render();

      });

    };

    const onMove = (ev: PointerEvent) => {

      const r = el.getBoundingClientRect();

      ptr.x = ev.clientX - r.left;

      ptr.y = ev.clientY - r.top;

      ptr.on = ev.pointerType !== "touch";

      poke();

    };

    const onLeave = () => {

      ptr.on = false;

      poke();

    };



    fit();

    const ro = new ResizeObserver(() => {

      fit();

      render();

    });

    ro.observe(el);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let io: IntersectionObserver | null = null;

    if (reduce) {

      setReduced(true);

      k.t = REST;

      k.stage = STOPS.length;

      setStage(STOPS.length);

      render();

    } else {

      render();

      el.addEventListener("pointermove", onMove);

      el.addEventListener("pointerleave", onLeave);

      io = new IntersectionObserver(

        ([entry]) => {

          if (entry.isIntersecting) {

            k.started = true;

            play();

          } else if (k.started) {

            pause();

          }

        },

        { threshold: 0.4 },

      );

      io.observe(el);

      replayRef.current = () => {

        k.t = 0;

        k.stage = 0;

        k.boost = false;

        setStage(0);

        play();

      };

      skipRef.current = () => {

        if (k.t < MORPH_END) k.boost = true;

      };

    }

    return () => {

      pause();

      cancelAnimationFrame(k.poke);

      ro.disconnect();

      io?.disconnect();

      el.removeEventListener("pointermove", onMove);

      el.removeEventListener("pointerleave", onLeave);

    };

  }, []);



  // Focus follows the control that disappears: Skip hands over to the CTA, Replay back to Skip.

  useEffect(() => {

    const a = document.activeElement;

    if (stage === STOPS.length && a === skipBtn.current) primary.current?.focus();

    if (stage === 0 && a === replayBtn.current) skipBtn.current?.focus();

  }, [stage]);



  const handoff = stage >= 1;

  const ready = stage >= 2;

  const externalDocs = /^https?:\/\//i.test(docsHref);

  const reveal =

    "transition-[opacity,transform,filter] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";



  return (

    <section

      ref={wrap}

      id="querypilot-final-cta"

      aria-label="Try QueryPilot"

      className="relative isolate h-[100svh] max-h-[1100px] min-h-[680px] w-full overflow-hidden bg-[#080A09] text-white min-[1920px]:max-h-[1400px] min-[2560px]:max-h-[1900px]"

      style={{

        fontFamily: "var(--font-geist-sans), 'Geist', Inter, ui-sans-serif, system-ui, sans-serif",

      }}

    >

      <canvas ref={cv} aria-hidden className="absolute inset-0 h-full w-full" />

      <p className="sr-only">

        On questions that span several sources, QueryPilot keeps answer quality climbing as hybrid retrieval, reranking

        and the planner agent each add to it, while standard retrieval flattens out. The chart is illustrative.

      </p>



      {/* chart title while the film plays */}

      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[8%]">

        <div

          className="px-6 text-center font-medium leading-none tracking-[-0.035em] transition-all duration-[900ms] ease-out motion-reduce:transition-none"

          style={{

            fontSize: "clamp(1.75rem, 0.9rem + 1.8vw, 4.5rem)",

            opacity: handoff ? 0 : 1,

            filter: handoff ? "blur(10px)" : "blur(0px)",

            transform: handoff ? "translateY(-10px)" : "none",

          }}

        >

          {TITLE}

        </div>

      </div>



      {/* end state: a short headline and two small actions. The pen traces the primary button, then it fills. */}

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 pb-[6svh]">

        <div className="flex w-full flex-col items-center text-center">

          <h2

            ref={headRef}

            className={`font-normal leading-[1.08] tracking-[-0.045em] ${reveal}`}

            style={{

              fontSize: "clamp(1.9rem, 0.9rem + 2.3vw, 5.5rem)",

              opacity: handoff ? 1 : 0,

              transform: handoff ? "none" : "translateY(8px)",

              filter: handoff ? "blur(0px)" : "blur(8px)",

              transitionDelay: handoff ? "200ms" : "0ms",

            }}

          >

            <span className="block text-white/45 sm:inline">{FINAL_LINE_1}</span>{" "}

            <span className="block sm:inline">{FINAL_LINE_2}</span>

          </h2>

          {/* actions are sized in em off one clamp()'d root, so phone, laptop and TV keep the same proportions */}

          <div

            className="mt-[1.9em] flex w-full max-w-[17em] flex-col items-stretch gap-[0.7em] sm:w-auto sm:max-w-none sm:flex-row sm:items-center"

            style={{ fontSize: "clamp(0.875rem, 0.62rem + 0.34vw, 1.5rem)" }}

          >

            <a

              ref={primary}

              href={ctaHref}

              tabIndex={ready ? 0 : -1}

              className={`group relative inline-flex h-[2.85em] items-center justify-center rounded-full px-[1.45em] text-[1em] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${

                ready ? "pointer-events-auto" : "pointer-events-none"

              }`}

            >

              {/* the fill: a circle clip grows from the centre until it meets the outline the pen drew */}

              <span

                ref={disc}

                aria-hidden

                className="absolute inset-0 rounded-full bg-white transition-colors duration-200 group-hover:bg-[#63A1FF]"

                style={{ opacity: 0, clipPath: "circle(0px at 50% 50%)" }}

              />

              <span ref={label} className="relative text-black" style={{ opacity: 0 }}>

                Try QueryPilot

              </span>

            </a>

            <a

              ref={secondary}

              href={docsHref}

              tabIndex={ready ? 0 : -1}

              {...(externalDocs ? { target: "_blank", rel: "noopener noreferrer" } : {})}

              className={`group inline-flex h-[2.85em] items-center justify-center gap-[0.55em] rounded-full border border-white/12 bg-[#0d100f] px-[1.2em] text-[1em] text-white/85 transition-colors duration-200 hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${

                ready ? "pointer-events-auto" : "pointer-events-none"

              }`}

              style={{ opacity: 0 }}

            >

              <BookOpen

                aria-hidden

                size="1.05em"

                className="shrink-0 text-white/50 transition-colors duration-200 group-hover:text-[#63A1FF]"

              />

              Read engineering docs

            </a>

          </div>

        </div>

      </div>



      {/* Skip while the film plays, Replay once it has ended. Same quiet spot. */}

      {!reduced && (

        <div

          className="absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex justify-center"

          style={{ fontSize: "clamp(0.75rem, 0.55rem + 0.25vw, 1.1rem)" }}

        >

          <button

            ref={skipBtn}

            type="button"

            tabIndex={ready ? -1 : 0}

            aria-hidden={ready}

            onClick={() => skipRef.current?.()}

            className={`rounded-full px-[0.85em] py-[0.45em] text-[1em] text-white/40 transition-all duration-500 hover:text-[#63A1FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none ${

              ready ? "pointer-events-none opacity-0" : "opacity-100"

            }`}

          >

            Skip

          </button>

          <button

            ref={replayBtn}

            type="button"

            tabIndex={ready ? 0 : -1}

            aria-hidden={!ready}

            onClick={() => replayRef.current?.()}

            className={`absolute bottom-0 inline-flex items-center gap-[0.4em] rounded-full px-[0.85em] py-[0.45em] text-[1em] text-white/40 transition-all duration-500 hover:text-[#63A1FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none ${

              ready ? "opacity-100" : "pointer-events-none opacity-0"

            }`}

          >

            <RotateCcw aria-hidden size="0.9em" />

            Replay

          </button>

        </div>

      )}

    </section>

  );

}