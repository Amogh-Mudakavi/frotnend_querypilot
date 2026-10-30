/**
 * ASCII scenes for the landing-page engineering preview.
 *
 * Pure module: no DOM, no React. A scene writes glyphs into a Grid for a given
 * time `t` (ms), so it is deterministic and easy to test or dump to text.
 * The canvas renderer lives in engineering-preview.tsx.
 */

/** Cell height divided by cell width. The renderer and every scene share it. */
export const ASPECT = 11 / 6;

/** Ink tones: white, the card's topic colour, and failure red. */
export const INK = 0;
export const ACCENT = 1;
export const ALERT = 2;
export type Tone = 0 | 1 | 2;

/** Cursor over the card. x/y are 0..1 across the canvas; `active` eases 0..1 on hover. */
export interface Pointer {
  x: number;
  y: number;
  active: number;
}

export type Scene = (g: Grid, t: number, p: Pointer) => void;

export interface SceneSpec {
  cols: number;
  rows: number;
  draw: Scene;
  /** Time (ms) of the settled frame used for prefers-reduced-motion. */
  still: number;
}

/* ------------------------------------------------------------------ grid -- */

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly glyph: string[];
  readonly alpha: number[];
  readonly tone: Tone[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.glyph = new Array<string>(n).fill(" ");
    this.alpha = new Array<number>(n).fill(0);
    this.tone = new Array<Tone>(n).fill(INK);
  }

  clear() {
    this.glyph.fill(" ");
  }

  /** Write one glyph. Spaces and out-of-bounds writes are ignored, so overlays are safe. */
  put(x: number, y: number, ch: string, a = 1, tone: Tone = INK) {
    x = Math.round(x);
    y = Math.round(y);
    if (ch === " " || x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.glyph[i] = ch;
    this.alpha[i] = a;
    this.tone[i] = tone;
  }

  text(x: number, y: number, s: string, a = 1, tone: Tone = INK) {
    for (let i = 0; i < s.length; i++) this.put(x + i, y, s[i], a, tone);
  }

  /** The glyph currently at a cell, or " ". */
  at(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return " ";
    return this.glyph[y * this.cols + x];
  }
}

/* --------------------------------------------------------------- helpers -- */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Stable 0..1 noise for a cell. Same inputs, same output, so nothing flickers by accident. */
const hash = (x: number, y: number) => {
  let h = Math.imul(x + 11, 374761393) ^ Math.imul(y + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
};

const EIGHTHS = " ▏▎▍▌▋▊▉";

/** Horizontal bar with eighth-block resolution, so progress moves smoothly. */
function bar(g: Grid, x: number, y: number, width: number, frac: number, tone: Tone, a = 0.95) {
  const filled = clamp01(frac) * width;
  const whole = Math.floor(filled);
  const part = Math.floor((filled - whole) * 8);
  for (let i = 0; i < width; i++) {
    if (i < whole) g.put(x + i, y, "█", a, tone);
    else if (i === whole && part > 0) g.put(x + i, y, EIGHTHS[part], a, tone);
    else g.put(x + i, y, "░", 0.2, INK);
  }
}

/* ------------------------------------------------------------ deployment -- */

const DELIVERY = "git ─ ci ─ registry ─ worker";
const REQUEST = "user ─ dns ─ proxy ─ api";
const STORE_NAMES = ["mysql", "redis", "chroma"] as const;
/** Route and baseline latency for a request that ends at each store. */
const STORE_ROUTES: ReadonlyArray<readonly [string, number]> = [
  ["GET  /api/docs", 38],
  ["GET  /api/session", 4],
  ["POST /api/search", 61],
];

const LANE_Y = 2;
const REQ_Y = 5;
const TREE_X = 22; // middle of "api"
const PROXY_X = 13;
const BUILD_MS = 9000;
const REQ_MS = 3000;
const COMMAND = "$ git push origin main";

/** Cells a request walks through, in order, from "user" to the store's label. */
function requestPath(target: number): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  for (let x = 0; x <= TREE_X; x++) path.push([x, REQ_Y]);
  for (let y = REQ_Y + 1; y <= REQ_Y + 1 + target; y++) path.push([TREE_X, y]);
  const y = REQ_Y + 1 + target;
  for (let x = TREE_X + 1; x <= TREE_X + 2 + STORE_NAMES[target].length; x++) path.push([x, y]);
  return path;
}
const PATHS = STORE_NAMES.map((_, i) => requestPath(i));

/** Every fifth request is rate limited at the proxy. */
const isLimited = (n: number) => n % 5 === 3;

function drawLog(g: Grid, y: number, n: number, a: number) {
  if (isLimited(n)) {
    g.text(0, y, "POST /api/chat", a);
    g.text(18, y, "429", a, ALERT);
    g.text(23, y, "limited", a);
    return;
  }
  const [route, base] = STORE_ROUTES[n % 3];
  g.text(0, y, route, a);
  g.text(18, y, "200", a, ACCENT);
  g.text(23, y, `${base + ((n * 7) % 9)}ms`, a);
}

const deploy: Scene = (g, t) => {
  /* delivery: type the push, then light the pipeline left to right */
  const build = Math.floor(t / BUILD_MS);
  const bp = (t % BUILD_MS) / BUILD_MS;
  const typed = clamp01(bp / 0.1);
  const prog = clamp01((bp - 0.1) / 0.45);
  const bfade = bp > 0.9 ? 1 - (bp - 0.9) / 0.1 : 1;

  const shown = Math.floor(typed * COMMAND.length);
  g.text(0, 0, COMMAND.slice(0, shown), 0.7 * bfade);
  if (shown > 0) g.put(0, 0, "$", bfade, ACCENT);
  if (bp < 0.6 && Math.floor(t / 450) % 2 === 0) g.put(shown, 0, "▌", 0.7 * bfade);

  const headX = prog * DELIVERY.length;
  for (let x = 0; x < DELIVERY.length; x++) {
    const c = DELIVERY[x];
    const on = x < headX;
    const near = prog > 0 && prog < 1 && Math.abs(x - headX) < 1.5;
    const a = lerp(0.28, on ? 0.95 : 0.28, bfade);
    g.put(x, LANE_Y, c, near ? 1 : a, near || (on && c === "─") ? ACCENT : INK);
  }
  if (prog > 0 && prog < 1) {
    const stage = headX < 6 ? "pushing to origin" : headX < 11 ? "ci: lint, test, build" : headX < 22 ? "registry: image pushed" : "worker: rolling out";
    g.text(0, 3, stage, 0.5);
  } else if (prog >= 1) {
    g.text(0, 3, `v${142 + build} is live`, 0.9 * bfade, ACCENT);
  }

  /* runtime: a request walks the route and stays lit behind the packet */
  const n = Math.floor(t / REQ_MS);
  const rp = (t % REQ_MS) / REQ_MS;
  const target = n % 3;
  const limited = isLimited(n);
  const path = PATHS[target];

  g.text(0, REQ_Y, REQUEST, 0.3);
  STORE_NAMES.forEach((name, i) => {
    const y = REQ_Y + 1 + i;
    g.put(TREE_X, y, i === STORE_NAMES.length - 1 ? "└" : "├", 0.3);
    g.put(TREE_X + 1, y, "─", 0.3);
    g.text(TREE_X + 3, y, name, 0.3);
  });

  const last = limited ? PROXY_X : path.length - 1;
  const head = Math.min(last, Math.floor(clamp01(rp / 0.55) * (path.length - 1)));
  const rfade = rp > 0.88 ? 1 - (rp - 0.88) / 0.12 : 1;
  for (let i = 0; i <= head; i++) {
    const [x, y] = path[i];
    const ch = g.at(x, y);
    const recent = clamp01(1 - (head - i) / 9);
    const alert = limited && x >= PROXY_X && x < PROXY_X + 5;
    const atStore = y > REQ_Y && x >= TREE_X + 3;
    g.put(x, y, ch, lerp(0.3, 0.5 + 0.5 * recent, rfade), alert ? ALERT : atStore ? ACCENT : INK);
  }
  const arrived = head === path.length - 1 && !limited;
  if (!arrived) {
    const [hx, hy] = path[head];
    g.put(hx, hy, limited && head === PROXY_X ? "×" : "●", rfade, limited && head === PROXY_X ? ALERT : ACCENT);
  }
  if (limited && head >= PROXY_X) g.text(PROXY_X, REQ_Y - 1, "429", rfade, ALERT);

  /* access log: the previous request dims, the current one lands when the packet does */
  if (n > 0) drawLog(g, 10, n - 1, 0.3);
  if (rp > 0.55) drawLog(g, 11, n, 0.9);
};

/* ------------------------------------------------------------- ingestion -- */

const DOC =
  "The renewal clause lets either party terminate with ninety days written notice. Payment terms are net thirty. Invoices more than sixty days overdue accrue interest at one and a half percent per month. ";
const DIGITS = "0123456789.-";
const STAGES: ReadonlyArray<readonly [string, number]> = [
  ["parse", 0],
  ["validate", 6],
  ["chunk", 15],
  ["embed", 21],
  ["index", 27],
];
const INGEST_MS = 10000;
const CHUNK_W = 8;
const FIELD_Y = 2;
const FIELD_H = 8;
const FAIL_FROM = 16; // the third chunk
const FAIL_TO = 24;
const RECOVER_AT = 30;

const ingest: Scene = (g, t, p) => {
  const { cols } = g;
  const n = Math.floor(t / INGEST_MS);
  const ph = (t % INGEST_MS) / INGEST_MS;
  const span = cols + 2;

  /* convert left to right, hold, then wipe back to raw text; the cursor can scrub it */
  const auto = (ph < 0.62 ? ph / 0.62 : 1) * span;
  const cx = lerp(auto, p.x * span, p.active);
  const rx = (ph >= 0.84 ? (ph - 0.84) / 0.16 : 0) * span * (1 - p.active);
  const done = cx >= span - 0.5;
  const fails = n % 2 === 1;
  const failing = fails && cx > FAIL_FROM && cx < RECOVER_AT;

  STAGES.forEach(([name, x0], i) => {
    const next = i + 1 < STAGES.length ? STAGES[i + 1][1] : span;
    const current = !done && cx >= x0 && cx < next;
    const passed = done || cx >= next;
    g.text(x0, 0, name, current ? 1 : passed ? 0.8 : 0.28, current ? ACCENT : INK);
  });

  for (let x = 0; x < cols; x++) g.put(x, 1, "─", 0.16);
  if (cx > 0.5 && !done) g.put(Math.floor(cx), 1, "▼", 1, ACCENT);

  for (let r = 0; r < FIELD_H; r++) {
    const y = FIELD_Y + r;
    for (let x = 0; x < cols; x++) {
      if (!(x < cx && x >= rx)) {
        g.put(x, y, DOC[(r * cols + x) % DOC.length], 0.3);
      } else if (fails && x >= FAIL_FROM && x < FAIL_TO && cx < RECOVER_AT) {
        g.put(x, y, hash(x, y + Math.floor(t / 120)) > 0.5 ? "×" : "·", 0.9, ALERT);
      } else if (x % CHUNK_W === CHUNK_W - 1) {
        g.put(x, y, "│", 0.28);
      } else {
        const hot = !done && cx - x < 3;
        const seed = hot ? y + Math.floor(t / 70) : y;
        g.put(x, y, DIGITS[Math.floor(hash(x, seed) * DIGITS.length)], hot ? 1 : 0.85, ACCENT);
      }
    }
  }

  for (let x = 0; x < cols; x++) g.put(x, FIELD_Y + FIELD_H, "─", 0.16);

  const chunk = Math.min(4, Math.max(1, Math.floor(Math.min(cx, cols - 1) / CHUNK_W) + 1));
  const stage = [...STAGES].reverse().find(([, x0]) => cx >= x0)?.[0] ?? "parse";
  const tokens = 380 + Math.floor(hash(chunk, n) * 120);
  const y = FIELD_Y + FIELD_H + 1;
  if (done) g.text(0, y, "4 chunks · 4 vectors · indexed", 0.9, ACCENT);
  else if (failing) g.text(0, y, "chunk 3 failed · retry 1/3", 0.95, ALERT);
  else if (fails && cx >= RECOVER_AT) g.text(0, y, "chunk 3 recovered on retry", 0.9, ACCENT);
  else if (cx < 1) g.text(0, y, "ready · 1 file · 4 chunks", 0.5);
  else g.text(0, y, `chunk ${chunk}/4 · ${tokens} tok · ${stage}`, 0.6);
};

/* ------------------------------------------------------------------ jobs -- */

const SPARK = "▁▂▃▄▅▆▇█";

const jobs: Scene = (g, t) => {
  const s = t / 1000;

  g.text(0, 0, "queue", 0.5);
  const queued = 3 + (Math.floor(s * 0.9) % 4);
  for (let i = 0; i < queued; i++) g.put(7 + i * 2, 0, "▪", 0.85, ACCENT);
  g.put(7 + queued * 2, 0, "▸", 0.6);

  for (let i = 0; i < 3; i++) {
    const y = 2 + i;
    const k = s * 0.42 + i * 0.37;
    const n = Math.floor(k);
    const p = k - n;
    const id = 140 + n * 3 + i;
    const failed = id % 5 === 2 && p > 0.55;

    g.text(0, y, `worker-${i + 1}`, 0.8);
    g.put(9, y, "[", 0.35);
    bar(g, 10, y, 8, failed ? 0.86 : p, failed ? ALERT : ACCENT);
    g.put(18, y, "]", 0.35);
    g.text(20, y, `job_${id}`, failed ? 0.55 : 0.85);
    if (failed) g.text(28, y, `✕ ${Math.ceil(((1 - p) / 0.45) * 2)}s`, 0.95, ALERT);
  }

  g.text(0, 6, "dead-letter 0", 0.4);
  const flash = s % 4 < 0.35;
  g.text(0, 7, "duplicates skipped", 0.4);
  g.text(19, 7, String((14 + Math.floor(s / 4)) % 1000), flash ? 1 : 0.75, flash ? ACCENT : INK);

  g.text(0, 8, "throughput", 0.4);
  for (let i = 0; i < 16; i++) {
    const v = 0.5 + 0.28 * Math.sin(s * 1.4 + i * 0.55) + 0.18 * Math.sin(s * 0.9 - i * 1.3);
    g.put(11 + i, 8, SPARK[Math.floor(clamp01(v) * 7.99)], 0.7, ACCENT);
  }
};

/* ------------------------------------------------------------ data layer -- */

const BOX_X = [0, 11, 22] as const;
const BOX_W = 10;
const LEVELS = 8;
const STORE_LABELS = ["mysql", "chromadb", "redis"] as const;
const STORE_STEP_MS = 500;
const STORE_CYCLE = 16;

const stores: Scene = (g, t) => {
  const step = Math.floor(t / STORE_STEP_MS) % STORE_CYCLE;
  const cycle = Math.floor(t / (STORE_STEP_MS * STORE_CYCLE));
  const bad = cycle % 3 === 2; // every third cycle the vector write fails and is rolled back

  const drain = (s: number) => Math.max(0, LEVELS - (s - 11) * 2);
  const chunks = step < 4 ? step * 2 : step < 12 ? LEVELS : drain(step);
  const vectors = bad
    ? step < 3 ? 0 : step < 5 ? (step - 2) * 2 : step < 10 ? 4 : 0
    : step < 3 ? 0 : step < 8 ? Math.min(LEVELS, (step - 2) * 2) : step < 12 ? LEVELS : drain(step);
  const cache = !bad && step >= 9 && step < 12 ? LEVELS : 0;
  const levels = [chunks, vectors, cache];
  const failing = bad && step >= 5 && step < 10;

  for (let st = 0; st < 3; st++) {
    const x0 = BOX_X[st];
    const hot = st === 1 && failing;
    const edge = hot ? ALERT : INK;
    const edgeA = hot ? 0.85 : 0.25;
    const label = STORE_LABELS[st];

    g.text(x0 + Math.floor((BOX_W - label.length) / 2), 0, label, hot ? 0.95 : 0.55, hot ? ALERT : INK);
    g.put(x0, 1, "┌", edgeA, edge);
    g.put(x0 + BOX_W - 1, 1, "┐", edgeA, edge);
    g.put(x0, 10, "└", edgeA, edge);
    g.put(x0 + BOX_W - 1, 10, "┘", edgeA, edge);
    for (let i = 1; i < BOX_W - 1; i++) {
      g.put(x0 + i, 1, "─", edgeA, edge);
      g.put(x0 + i, 10, "─", edgeA, edge);
    }

    for (let r = 0; r < LEVELS; r++) {
      const y = 9 - r;
      g.put(x0, y, "│", edgeA, edge);
      g.put(x0 + BOX_W - 1, y, "│", edgeA, edge);
      for (let i = 0; i < LEVELS; i++) {
        const x = x0 + 1 + i;
        if (r >= levels[st]) g.put(x, y, "·", 0.15);
        else if (st === 0) g.put(x, y, "█", r % 2 === 0 ? 0.92 : 0.7);
        else if (st === 1) g.put(x, y, hash(x, y) > 0.18 ? "▓" : "▒", 0.95, hot ? ALERT : ACCENT);
        else g.put(x, y, hash(x, y) > 0.5 ? "▒" : "░", 0.85 - r * 0.04, ACCENT);
      }
    }
  }

  if (failing) g.text(0, 12, "upsert failed · rolling back", 0.95, ALERT);
  else if (bad && step >= 10) g.text(0, 12, "cleaned · retry from chunks", 0.6);
  else g.text(0, 12, `chunks ${chunks} · vectors ${vectors} · ${chunks === vectors ? "in sync" : "syncing"}`, 0.55);
};

/* ------------------------------------------------------------------ auth -- */

const KEY_ROWS = 34;
const AUTH_MS = 12000;
const ACCESS_TTL_S = 900;

const auth: Scene = (g, t, p) => {
  const { cols } = g;
  const ph = (t % AUTH_MS) / AUTH_MS;

  /* the access token drains, expires (401), is refreshed (200), and fills again */
  let access = 1;
  let state: "ok" | "expired" | "refresh" = "ok";
  if (ph < 0.6) access = 1 - ph / 0.6;
  else if (ph < 0.72) {
    access = 0;
    state = "expired";
  } else if (ph < 0.84) {
    access = (ph - 0.72) / 0.12;
    state = "refresh";
  }

  /* a key turning on its long axis; the cursor adds spin */
  const angle = t / 1100 + p.active * (p.x - 0.5) * Math.PI * 2;
  const c = Math.cos(angle);
  const k = Math.abs(c) < 0.07 ? (c < 0 ? -0.07 : 0.07) : c;
  const halfW = (KEY_ROWS * ASPECT) / 2;
  const edgeTone: Tone = state === "expired" ? ALERT : ACCENT;
  const bodyTone: Tone = state === "refresh" ? ACCENT : INK;

  for (let y = 0; y < KEY_ROWS; y++) {
    for (let x = 0; x < cols; x++) {
      const u = (x + 0.5 - cols / 2) / halfW;
      const v = (y + 0.5 - KEY_ROWS / 2) / (KEY_ROWS / 2);
      const a = u / k;
      const r = Math.hypot(a, v + 0.52);
      const ring = r > 0.13 && r < 0.26;
      const shaft = Math.abs(a) < 0.045 && v > -0.28 && v < 0.78;
      const teeth = a > 0.045 && ((a < 0.2 && v > 0.5 && v < 0.58) || (a < 0.15 && v > 0.64 && v < 0.72));
      if (ring || shaft || teeth) {
        const edge = ring && (Math.abs(r - 0.13) < 0.02 || Math.abs(r - 0.26) < 0.02);
        g.put(x, y, edge ? ":" : hash(x, y + Math.floor(t / 130)) > 0.9 ? "." : "1", 0.95, edge ? edgeTone : bodyTone);
      } else {
        g.put(x, y, hash(x, y + Math.floor(t / 420)) > 0.97 ? "1" : "0", 0.2);
      }
    }
  }

  const y0 = KEY_ROWS;
  for (let x = 0; x < cols; x++) g.put(x, y0, "─", 0.16);
  const secs = Math.round(access * ACCESS_TTL_S);
  const expired = state === "expired";
  g.text(0, y0 + 1, "access", 0.7);
  bar(g, 9, y0 + 1, 8, access, expired ? ALERT : ACCENT);
  g.text(18, y0 + 1, `${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`, expired ? 0.95 : 0.6, expired ? ALERT : INK);
  g.text(0, y0 + 2, "refresh", 0.7);
  bar(g, 9, y0 + 2, 8, 1, INK, 0.55);
  g.text(18, y0 + 2, "7d", 0.6);

  if (state === "expired") {
    g.text(0, y0 + 3, "401", 0.95, ALERT);
    g.text(5, y0 + 3, "access token expired", 0.8);
  } else if (state === "refresh") {
    g.text(0, y0 + 3, "200", 0.95, ACCENT);
    g.text(5, y0 + 3, "POST /auth/refresh", 0.8);
  } else {
    g.text(0, y0 + 3, "200", 0.95, ACCENT);
    g.text(5, y0 + 3, "GET /api/me", 0.6);
  }
};

/* -------------------------------------------------------------- registry -- */

export const SCENES = {
  deploy: { cols: 34, rows: 12, draw: deploy, still: 6600 },
  ingest: { cols: 32, rows: 12, draw: ingest, still: 7000 },
  jobs: { cols: 32, rows: 9, draw: jobs, still: 5400 },
  stores: { cols: 32, rows: 13, draw: stores, still: 4800 },
  auth: { cols: 30, rows: KEY_ROWS + 4, draw: auth, still: 2600 },
} satisfies Record<string, SceneSpec>;
