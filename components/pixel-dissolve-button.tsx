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

  /**
   * Base button color.
   *
   * Any valid CSS color.
   */
  color?: string;

  /**
   * Optional CSS gradient.
   */
  gradient?: string;

  /**
   * Optional dissolve effect color.
   *
   * This is completely independent from the button color.
   *
   * Example:
   *   color="#ffffff"
   *   dissolveColor="#ccffcc"
   */
  dissolveColor?: string;

  /**
   * Kept for backwards compatibility.
   */
  baseColor?: string;

  href?: string;

  onClick?: () => void;

  /**
   * Size of each dissolve pixel.
   */
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

/* ============================================================
   COLOR PARSING
   ============================================================ */

/**
 * Converts any browser-supported CSS color into
 * relative luminance.
 *
 * This is ONLY used as a fallback when the caller hasn't
 * provided an explicit dissolveColor.
 */
function getLuminance(input: string | undefined): number | null {
  if (!input || typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");

  canvas.width = 1;
  canvas.height = 1;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, 1, 1);

  context.fillStyle = input;

  context.fillRect(0, 0, 1, 1);

  const pixel = context.getImageData(0, 0, 1, 1).data;

  const r = pixel[0];
  const g = pixel[1];
  const b = pixel[2];

  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* ============================================================
   DETERMINISTIC HASH
   ============================================================ */

function hash01(x: number, y: number, salt = 0): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;

  return value - Math.floor(value);
}

/* ============================================================
   BUILD PIXELS
   ============================================================ */

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

/* ============================================================
   COMPONENT
   ============================================================ */

export function PixelDissolveButton({
  label,

  color = "#2C5F34",

  gradient,

  dissolveColor,

  baseColor: _baseColor,

  href,

  onClick,

  cellSize = 8,

  type = "button",

  disabled = false,

  className = "",

  disableAnimation = false,

  icon,
}: PixelDissolveButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  /*
   * Used only when dissolveColor isn't provided.
   */
  const luminanceRef = useRef(0.35);

  /* ==========================================================
     DETERMINE FALLBACK EFFECT COLOR
     ========================================================== */

  useEffect(() => {
    const measured = getLuminance(color);

    luminanceRef.current = measured ?? 0.35;
  }, [color]);

  /* ==========================================================
     CANVAS ENGINE
     ========================================================== */

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || disableAnimation) {
      return;
    }

    const parent = canvas.parentElement;

    if (!parent) {
      return;
    }

    const context = canvas.getContext("2d", {
      alpha: true,
    });

    if (!context) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * We explicitly use source-over.
     *
     * This means the dissolve pixels remain visible
     * on white backgrounds.
     */
    context.globalCompositeOperation = "source-over";

    context.imageSmoothingEnabled = false;

    let lastCols = 0;
    let lastRows = 0;

    /* ========================================================
       RESIZE
       ======================================================== */

    const resize = () => {
      const rect = parent.getBoundingClientRect();

      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

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

    /* ========================================================
       DRAW
       ======================================================== */

    const draw = (now: number) => {
      if (!hoverRef.current) {
        frameRef.current = null;

        return;
      }

      frameRef.current = window.requestAnimationFrame(draw);

      const { width, height, cols, rows } = sizeRef.current;

      if (!width || !height || !cols || !rows) {
        return;
      }

      const time = now * 0.001;

      context.clearRect(0, 0, width, height);

      /*
       * If dissolveColor is supplied, use it directly.
       *
       * Otherwise, choose a sensible light/dark
       * contrast color from the button color.
       */
      let effectColor = dissolveColor;

      if (!effectColor) {
        const luminance = luminanceRef.current;

        /*
         * Use a fixed, high-contrast palette based on
         * the button's existing color.
         *
         * Light buttons (especially white) get the user's
         * dark green dissolve.
         *
         * Dark buttons get white dissolve pixels.
         */
        effectColor = luminance > 0.58 ? "#008000" : "#ffffff";
      }

      /*
       * Let the browser parse the requested color so
       * rgb(), rgba(), hex, hsl(), named colors, etc.
       * all work.
       */
      context.fillStyle = effectColor;

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellSize;

        for (let column = 0; column < cols; column += 1) {
          const index = row * cols + column;

          const cell = cellsRef.current[index];

          if (!cell) {
            continue;
          }

          const x = column * cellSize;

          /* --------------------------------------------------
             ORIGINAL DISSOLVE FIELD
             -------------------------------------------------- */

          const wave =
            0.5 + 0.5 * Math.sin(time * cell.speed * 2.4 + cell.phase);

          const intensity = Math.min(1, Math.max(0, wave + cell.jitter * 0.15));

          const centered = (intensity - 0.5) * 2;

          const strength = Math.abs(centered);

          /*
           * Keep the quiet middle mostly empty.
           *
           * The result is a collection of distinct
           * moving pixel clusters instead of a flat
           * texture covering the whole button.
           */
          if (strength < 0.08) {
            continue;
          }

          const alpha = Math.min(0.82, 0.08 + strength * 0.72);

          /*
           * IMPORTANT:
           *
           * Alpha is assigned per cell, while the actual
           * effect color comes directly from dissolveColor.
           */
          context.globalAlpha = alpha;

          context.fillRect(x, y, cellSize, cellSize);
        }
      }

      context.globalAlpha = 1;
    };

    /* ========================================================
       STOP
       ======================================================== */

    const stop = () => {
      hoverRef.current = false;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);

        frameRef.current = null;
      }

      const { width, height } = sizeRef.current;

      context.clearRect(0, 0, width, height);

      context.globalAlpha = 1;
    };

    /* ========================================================
       START
       ======================================================== */

    if (hovered) {
      hoverRef.current = true;

      frameRef.current = window.requestAnimationFrame(draw);
    } else {
      stop();
    }

    return () => {
      stop();
      observer.disconnect();
    };
  }, [hovered, disableAnimation, cellSize, color, dissolveColor]);

  /* ==========================================================
     HOVER
     ========================================================== */

  const handleEnter = () => {
    if (disabled || disableAnimation) {
      return;
    }

    hoverRef.current = true;

    setHovered(true);
  };

  const handleLeave = () => {
    hoverRef.current = false;

    setHovered(false);

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 1;
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLElement>) => {
    /*
     * Don't activate hover animation
     * on touch devices.
     */
    if (event.pointerType === "touch") {
      return;
    }

    handleEnter();
  };

  /* ==========================================================
     BASE BUTTON STYLE
     ========================================================== */

  const style: CSSProperties = {
    background: gradient ?? color,
  };

  /* ==========================================================
     BUTTON CLASSES
     ========================================================== */

  const baseClassName = [
    "group",
    "relative",
    "isolate",
    "inline-flex",
    "items-center",
    "justify-between",
    "gap-3",
    "overflow-hidden",
    "px-7",
    "py-0",
    "min-h-12",

    "text-[15px]",
    "font-semibold",
    "uppercase",
    "tracking-[-0.01em]",

    "text-white",

    "focus-visible:outline",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-white",

    "disabled:cursor-not-allowed",
    "disabled:opacity-50",

    className,
  ]
    .filter(Boolean)
    .join(" ");

  /* ==========================================================
     ARROW
     ========================================================== */

  const arrowStyle: CSSProperties = {
    transition: "transform 200ms ease-out",

    transform: hovered ? "rotate(-45deg)" : "rotate(0deg)",
  };

  /* ==========================================================
     CANVAS
     ========================================================== */

  const canvasStyle: CSSProperties = {
    opacity: disableAnimation ? 0 : hovered ? 1 : 0,

    transition: "opacity 100ms ease-out",

    pointerEvents: "none",

    imageRendering: "pixelated",

    /*
     * DO NOT use overlay here.
     *
     * source-over makes the explicit
     * dissolveColor visible regardless
     * of the base button color.
     */
    mixBlendMode: "normal",
  };

  /* ==========================================================
     CONTENT
     ========================================================== */

  const content = (
    <>
      {/* Label */}

      <span className="relative z-10 whitespace-nowrap">{label}</span>

      {/* Arrow */}

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
        <line x1="5" y1="12" x2="19" y2="12" />

        <polyline points="12 5 19 12 12 19" />
      </svg>

      {/* Optional icon */}

      {icon ? (
        <span
          aria-hidden="true"
          className="relative z-10 text-[1.1rem] leading-none"
        >
          {icon}
        </span>
      ) : null}

      {/* Pixel dissolve canvas */}

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        style={canvasStyle}
      />
    </>
  );

  /* ==========================================================
     LINK
     ========================================================== */

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
        aria-disabled={disabled ? true : undefined}
      >
        {content}
      </a>
    );
  }

  /* ==========================================================
     BUTTON
     ========================================================== */

  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
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
