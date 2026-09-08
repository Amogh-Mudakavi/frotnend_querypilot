"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type PixelDissolveButtonProps = {
  label: string;
  color?: string;
  baseColor?: string;
  gradient?: string;
  href?: string;
  onClick?: () => void;
  cellSize?: number;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  disableAnimation?: boolean;
  icon?: string;
};

type PixelCell = {
  phase: number;
  speed: number;
  jitter: number;
};

// Resolves any CSS color string down to 0–1 relative luminance, so the
// overlay can adapt itself to whatever `color` gets passed in (dark green
// today, white tomorrow) instead of assuming a dark background.
// Handles #hex and rgb()/rgba() directly; anything else (named colors like
// "white", or a `gradient` string we can't safely parse) is resolved with a
// throwaway 1x1 canvas rather than a hardcoded name→hex table.
function getLuminance(input: string | undefined): number | null {
  if (!input || typeof document === "undefined") return null;

  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d");
  if (!ctx) return null;

  // If `input` is invalid CSS, the browser silently ignores the assignment
  // and fillStyle keeps its prior value (default "#000"), so this degrades
  // to "treat as dark" rather than throwing.
  ctx.fillStyle = input;
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

  // Standard relative luminance — a rough light/dark bucket is all this
  // needs, not color-managed precision.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Deterministic pseudo-random hash — same seed every time, so each cell's
// personality (phase/speed/jitter) is stable across mounts.
function hash01(x: number, y: number, salt = 0): number {
  const value =
    Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) *
    43758.5453123;

  return value - Math.floor(value);
}

function buildCells(cols: number, rows: number): PixelCell[] {
  const cells: PixelCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols; column += 1) {
      cells.push({
        phase: hash01(column, row, 3.17) * Math.PI * 2,
        speed: 0.6 + hash01(column, row, 8.9) * 0.8,
        jitter: hash01(column, row, 13.4) - 0.5,
      });
    }
  }

  return cells;
}

export function PixelDissolveButton({
  label,
  color = "#2C5F34",
  // Kept in the public API for compatibility with existing call sites.
  // The animation itself does NOT use either color prop.
  baseColor: _baseColor,
  gradient,
  href,
  onClick,
  cellSize = 8,
  type = "button",
  disabled = false,
  className = "",
  disableAnimation = false,
  icon,
}: PixelDissolveButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const cellsRef = useRef<PixelCell[]>([]);
  const sizeRef = useRef({
    width: 0,
    height: 0,
    cols: 0,
    rows: 0,
    dpr: 1,
  });
  const hoverRef = useRef(false);
  const [hovered, setHovered] = useState(false);

  // Recomputed only when the visible color changes — not every frame.
  // `gradient`, when present, wins over `color` since it's what's actually
  // painted; falling back to `color`'s luminance keeps things sane if the
  // gradient string is something getLuminance can't parse (canvas just
  // leaves fillStyle at its previous value, so we still get a number).
  const luminanceRef = useRef(0);
  useEffect(() => {
    const measured = getLuminance(gradient ?? color);
    luminanceRef.current = measured ?? 0.35; // unmeasurable -> assume dark
  }, [color, gradient]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disableAnimation) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    context.imageSmoothingEnabled = false;

    let lastCols = 0;
    let lastRows = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(
        1,
        Math.min(2, window.devicePixelRatio || 1),
      );

      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const cols = Math.max(1, Math.ceil(width / cellSize));
      const rows = Math.max(1, Math.ceil(height / cellSize));

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      sizeRef.current = {
        width,
        height,
        cols,
        rows,
        dpr,
      };

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (cols !== lastCols || rows !== lastRows) {
        cellsRef.current = buildCells(cols, rows);
        lastCols = cols;
        lastRows = rows;
      }

      context.clearRect(0, 0, width, height);
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(parent);

    const draw = (now: number) => {
      if (!hoverRef.current) {
        frameRef.current = null;
        return;
      }

      frameRef.current = window.requestAnimationFrame(draw);

      const { width, height, cols, rows } = sizeRef.current;
      if (!width || !height || !cols || !rows) return;

      const time = now * 0.001;

      context.clearRect(0, 0, width, height);

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellSize;

        for (let column = 0; column < cols; column += 1) {
          const index = row * cols + column;
          const cell = cellsRef.current[index];
          if (!cell) continue;

          const x = column * cellSize;

          const wave =
            0.5 +
            0.5 *
              Math.sin(
                time * cell.speed * 2.4 + cell.phase,
              );

          const intensity = Math.min(
            1,
            Math.max(
              0,
              wave + cell.jitter * 0.15,
            ),
          );

          const centered = (intensity - 0.5) * 2;

          /*
           * `mix-blend-mode: overlay` only reads as a shimmer when the
           * layer beneath it isn't too close to pure white or pure black —
           * overlaying white-on-white (or black-on-black) barely changes
           * anything, which is why a hardcoded 50/50 white/black split
           * looked fine on the original dark green but goes flat on a
           * light background.
           *
           * `lum` (0 = black, 1 = white) lets each cell rebalance which
           * side of the flicker actually carries the visible contrast,
           * without touching the wave/phase/jitter motion above:
           *  - dark backgrounds: mostly white highlights (original look)
           *  - light backgrounds: mostly black shadows
           *  - the peak strength of the "loud" side is also boosted as we
           *    approach either extreme, since overlay's effect shrinks the
           *    closer the base color is to 0 or 1.
           */
          const lum = luminanceRef.current;
          const whiteBias = 1 - lum; // 1 on black, 0 on white
          const extremity = Math.abs(lum - 0.5) * 2; // 0 mid-tone -> 1 at either end
          const boost = 1 + extremity * 0.5;

          if (centered >= 0) {
            const alpha =
              centered * (0.1 + whiteBias * 0.28) * boost;
            context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          } else {
            const alpha =
              -centered * (0.1 + (1 - whiteBias) * 0.36) * boost;
            context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
          }

          context.fillRect(
            x,
            y,
            cellSize,
            cellSize,
          );
        }
      }
    };

    const stop = () => {
      hoverRef.current = false;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      const { width, height } = sizeRef.current;
      context.clearRect(0, 0, width, height);
    };

    if (hovered) {
      hoverRef.current = true;
      frameRef.current =
        window.requestAnimationFrame(draw);
    } else {
      stop();
    }

    return () => {
      stop();
      observer.disconnect();
    };
  }, [
    hovered,
    disableAnimation,
    cellSize,
  ]);

  const handleEnter = () => {
    if (disabled || disableAnimation) return;
    hoverRef.current = true;
    setHovered(true);
  };

  const handleLeave = () => {
    hoverRef.current = false;
    setHovered(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  const handlePointerEnter = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.pointerType === "touch") return;
    handleEnter();
  };

  const style: CSSProperties = {
    backgroundImage:
      gradient ??
      `linear-gradient(135deg, ${color} 0%, ${color} 100%)`,
  };

  const baseClassName = [
    "group relative isolate inline-flex items-center justify-between gap-3",
    "overflow-hidden px-7 py-0 min-h-12",
    "text-[15px] font-semibold uppercase tracking-[-0.01em] text-white",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007D51]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const arrowStyle: CSSProperties = {
    transition:
      "transform 200ms ease-out",
    transform: hovered
      ? "rotate(-45deg)"
      : "rotate(0deg)",
  };

  const canvasStyle: CSSProperties = {
    opacity: disableAnimation
      ? 0
      : hovered
        ? 1
        : 0,
    transition:
      "opacity 120ms ease-out",
    pointerEvents: "none",
    imageRendering: "pixelated",
    mixBlendMode: "overlay",
  };

  const content = (
    <>
      <span className="relative z-10 whitespace-nowrap">
        {label}
      </span>

      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10 h-4 w-4 shrink-0"
        style={arrowStyle}
      >
        <line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
        />
        <polyline points="12 5 19 12 12 19" />
      </svg>

      {icon ? (
        <span
          aria-hidden="true"
          className="relative z-10 text-[1.1rem] leading-none"
        >
          {icon}
        </span>
      ) : null}

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        style={canvasStyle}
      />
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={baseClassName}
        style={style}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handleLeave}
        aria-disabled={disabled || undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={baseClassName}
      style={style}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handleLeave}
    >
      {content}
    </button>
  );
}

export default PixelDissolveButton;