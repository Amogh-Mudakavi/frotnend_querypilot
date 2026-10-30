"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { ASPECT, Grid, SCENES } from "../hero/engineering-scenes";
import type { Pointer, SceneSpec } from "../hero/engineering-scenes";

/* ============================================================================
 * Engineering preview: five live ASCII scenes, one per deep dive.
 *
 * - Scenes are pure functions of time (see engineering-scenes.ts); this file
 *   only owns layout, canvas rendering and the card chrome.
 * - Glyph size follows the card width, so text stays readable from phone to TV.
 * - Canvases only draw while on screen, at 30fps, and respect reduced motion.
 * - Moving the mouse over a card steers its scene (scrubs ingestion, spins the key).
 * ========================================================================== */

/** Same frame as the rest of the landing page. Keep in sync with FRAME in the page file. */
const FRAME = "w-[var(--qp-frame,min(92vw,1120px))]";

/** Caps glyph size on very wide screens (11px cell width is roughly an 18px glyph). */
const MAX_CELL_W = 11;
const FRAME_MS = 1000 / 30;
const ALERT_RGB = "229,72,77";

/**
 * One accent for the whole section. Scenes use it for "the thing that matters"
 * and ALERT_RGB for failures; everything else is white at different opacities.
 * Space separated channels so Tailwind can use it as rgb(var(--ep)).
 */
const ACCENT = "99 161 255";

const COUNT_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/* --------------------------------- canvas --------------------------------- */

interface AsciiCanvasProps {
  scene: SceneSpec;
  /** Topic colour as space separated channels, e.g. "99 161 255". */
  accent: string;
  label: string;
  /** Fit the parent's height as well as its width (used by the tall key). */
  fill?: boolean;
}

function AsciiCanvas({ scene, accent, label, fill = false }: AsciiCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!host || !canvas || !ctx) return;

    const { cols, rows, draw, still } = scene;
    const grid = new Grid(cols, rows);
    const ink = ["255,255,255", accent.trim().replace(/\s+/g, ","), ALERT_RGB];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer: Pointer = { x: 0.5, y: 0.5, active: 0 };
    const aim: Pointer = { x: 0.5, y: 0.5, active: 0 };

    let cell = 0;
    let dpr = 1;
    let family = "";
    let raf = 0;
    let last = 0;
    let visible = false;
    let disposed = false;

    const layout = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || (fill && !h)) return;
      cell = Math.min(MAX_CELL_W, w / cols);
      if (fill) cell = Math.min(cell, h / (rows * ASPECT));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = cols * cell;
      const cssH = rows * cell * ASPECT;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      family = getComputedStyle(host).fontFamily;
    };

    const paint = (t: number) => {
      if (!cell) return;
      const cellH = cell * ASPECT;
      grid.clear();
      draw(grid, t, pointer);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * cell, rows * cellH);
      ctx.font = `${cell / 0.6}px ${family}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < grid.glyph.length; i++) {
        const glyph = grid.glyph[i];
        if (glyph === " ") continue;
        ctx.fillStyle = `rgba(${ink[grid.tone[i]]},${grid.alpha[i].toFixed(2)})`;
        ctx.fillText(glyph, ((i % cols) + 0.5) * cell, (Math.floor(i / cols) + 0.5) * cellH);
      }
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < FRAME_MS) return;
      last = ts;
      pointer.active += (aim.active - pointer.active) * 0.12;
      pointer.x += (aim.x - pointer.x) * 0.2;
      pointer.y += (aim.y - pointer.y) * 0.2;
      paint(ts);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) return stop();
        if (reduced) paint(still);
        else start();
      },
      { rootMargin: "80px" },
    );

    const ro = new ResizeObserver(() => {
      layout();
      if (reduced && visible) paint(still);
    });

    const card = host.closest("a") ?? host;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      aim.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      aim.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      aim.active = 1;
    };
    const onLeave = () => {
      aim.active = 0;
    };

    layout();
    ro.observe(host);
    io.observe(host);
    if (!reduced) {
      card.addEventListener("pointermove", onMove as EventListener);
      card.addEventListener("pointerleave", onLeave);
    }
    // The canvas may paint before the webfont is ready; repaint once it is.
    document.fonts?.ready.then(() => {
      if (disposed) return;
      layout();
      if (reduced && visible) paint(still);
    });

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      card.removeEventListener("pointermove", onMove as EventListener);
      card.removeEventListener("pointerleave", onLeave);
    };
  }, [scene, accent, fill]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      className={`font-mono ${fill ? "absolute inset-0 flex items-center justify-center" : "relative mx-auto w-full"}`}
      style={fill ? undefined : { aspectRatio: `${scene.cols} / ${scene.rows * ASPECT}`, maxWidth: scene.cols * MAX_CELL_W }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className={fill ? "block" : "absolute inset-0 m-auto block max-h-full max-w-full"} />
    </div>
  );
}

/* ---------------------------------- data ---------------------------------- */

interface Topic {
  /** Must match the slug used by the /engineering page sections. */
  slug: string;
  title: string;
  tagline: string;
  desc: string;
  accent: string;
  tags: string[];
  /** Grid placement at lg. The key spans both rows in the middle column. */
  place: string;
  scene: SceneSpec;
  label: string;
  tall?: boolean;
}

const TOPICS: Topic[] = [
  {
    slug: "deployment-stories",
    title: "Deployment Stories",
    tagline: "From local development to production.",
    desc: "Containers, DNS and HTTPS, a reverse proxy with rate limiting, and CI/CD, from a local repository to a running cloud app.",
    accent: ACCENT,
    tags: ["Docker", "CI/CD", "HTTPS"],
    place: "lg:col-start-1 lg:row-start-1",
    scene: SCENES.deploy,
    label: "A git push moving through CI to production, and a request travelling through the proxy to the API and its stores",
  },
  {
    slug: "document-ingestion-pipeline",
    title: "Document Ingestion Pipeline",
    tagline: "From raw files to searchable knowledge.",
    desc: "Parsing, extraction validation, structure-aware chunking, token checks, embedding and indexing, with retries when a stage fails.",
    accent: ACCENT,
    tags: ["Chunking", "Embeddings", "Recovery"],
    place: "lg:col-start-1 lg:row-start-2",
    scene: SCENES.ingest,
    label: "Document text turning into vectors chunk by chunk, with one chunk failing and retrying",
  },
  {
    slug: "background-jobs-concurrency",
    title: "Background Jobs & Concurrency",
    tagline: "Process expensive tasks without blocking the API.",
    desc: "Slow work runs outside the request cycle on a pool of workers, with retries, backoff, a dead-letter queue and idempotency keys.",
    accent: ACCENT,
    tags: ["Workers", "Retries", "Idempotency"],
    place: "lg:col-start-3 lg:row-start-1",
    scene: SCENES.jobs,
    label: "Three workers taking jobs from a queue, one failing and backing off",
  },
  {
    slug: "database-architecture-consistency",
    title: "Database Architecture & Consistency",
    tagline: "Keep the data layer reliable.",
    desc: "MySQL holds the truth, ChromaDB holds vectors, Redis holds temporary state. Nothing is left orphaned.",
    accent: ACCENT,
    tags: ["MySQL", "Redis", "ChromaDB"],
    place: "lg:col-start-3 lg:row-start-2",
    scene: SCENES.stores,
    label: "MySQL, ChromaDB and Redis filling together, with a failed vector write rolled back",
  },
  {
    slug: "authentication-token-lifecycle",
    title: "Authentication & Token Lifecycle",
    tagline: "From login to an authenticated request.",
    desc: "JWT access and refresh tokens, expiry, refresh and logout, Google OAuth and the auth middleware.",
    accent: ACCENT,
    tags: ["JWT", "Refresh", "Google OAuth"],
    place: "md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-span-2",
    scene: SCENES.auth,
    label: "A key made of 0s and 1s turning, above an access token that expires and is refreshed",
    tall: true,
  },
];

/** "five", derived from the data so the heading can never disagree with the grid. */
const COUNT = COUNT_WORD[TOPICS.length] ?? String(TOPICS.length);

/* --------------------------------- section -------------------------------- */

export default function EngineeringPreview() {
  return (
    <section id="engineering" aria-labelledby="engineering-heading" className="border-t border-white/10 bg-[#0A0A0A] text-white">
      <div className={`mx-auto py-[clamp(4rem,10vh,7rem)] ${FRAME}`}>
        <h2 id="engineering-heading" className="max-w-[40rem] text-[clamp(26px,2.4vw,36px)] font-medium leading-[1.2] tracking-[-0.025em]">
          How QueryPilot is built.
          <span className="block text-white/45">Open any of the {COUNT} to study it in detail.</span>
        </h2>

        <ul className="mt-10 grid border-l border-t border-white/[0.12] md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          {TOPICS.map((t) => (
            <li key={t.slug} style={{ "--ep": t.accent } as CSSProperties} className={`border-b border-r border-white/[0.12] ${t.place}`}>
              <Link
                href={`/engineering?from=${t.slug}#${t.slug}`}
                aria-label={`${t.title}. ${t.tagline} Open the full write-up.`}
                className="group relative flex h-full min-h-[520px] flex-col p-6 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60 sm:p-7"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-[rgb(var(--ep))] transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                />

                <p className="max-w-[46ch] text-[16px] leading-[1.5] text-white/65">
                  <span className="font-medium text-white">{t.tagline}</span> {t.desc}
                </p>

                <div className={`my-7 flex-1 ${t.tall ? "relative min-h-[620px] lg:min-h-0" : "flex items-center"}`}>
                  <AsciiCanvas scene={t.scene} accent={t.accent} label={t.label} fill={t.tall} />
                </div>

                <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                  <div className="min-w-0">
                    <p className="text-[16px] font-medium leading-tight text-white">{t.title}</p>
                    <p className="mt-1.5 font-mono text-[13px] text-white/55">{t.tags.join(" / ")}</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex shrink-0 items-center gap-1.5 font-mono text-[13px] leading-none text-white/55 transition-colors group-hover:text-[rgb(var(--ep))] group-focus-visible:text-[rgb(var(--ep))]"
                  >
                    Open
                    <span className="transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5">→</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}