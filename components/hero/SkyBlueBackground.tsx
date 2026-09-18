import React, { useEffect, useRef, forwardRef, memo } from "react";

export type SkyBlueStrokeMode = "vertical" | "brush" | "waves" | "diagonal" | "freehand";

export type SkyBlueThemePreset =
  | "vivid"
  | "cerulean"
  | "azure"
  | "horizon"
  | "cyan"
  | "royal";

export interface SkyBlueShadeConfig {
  name: string;
  primary: string; // Vibrant sky blue
  secondary: string; // Deep saturated sky azure
  midTone: string; // Radiant light sky blue
  tint: string; // Luminous soft sky tint
  glow?: string;
}

export const SKY_BLUE_THEMES: Record<SkyBlueThemePreset, SkyBlueShadeConfig> = {
  vivid: {
    name: "Vivid Sky Blue",
    primary: "#0284C7", // Sky 600 - rich authentic sky blue
    secondary: "#0369A1", // Sky 700 - deep sky azure
    midTone: "#38BDF8", // Sky 400 - intense radiant sky
    tint: "#BAE6FD", // Sky 200 - luminous clear sky
    glow: "rgba(2, 132, 199, 0.75)",
  },
  cerulean: {
    name: "Pure Cerulean Sky",
    primary: "#0EA5E9", // Sky 500 - true cerulean
    secondary: "#0284C7", // Sky 600
    midTone: "#7DD3FC", // Sky 300
    tint: "#E0F2FE", // Sky 100
    glow: "rgba(14, 165, 233, 0.7)",
  },
  azure: {
    name: "High-Intensity Azure",
    primary: "#0091FF", // Electric saturated sky blue
    secondary: "#0066CC", // Rich intense cobalt sky
    midTone: "#4DB2FF", // High chroma sky
    tint: "#CCE8FF", // Vibrant sky wash
    glow: "rgba(0, 145, 255, 0.8)",
  },
  horizon: {
    name: "Sunlit Horizon Sky",
    primary: "#0284C7",
    secondary: "#0C4A6E", // Deep ocean-sky horizon
    midTone: "#38BDF8",
    tint: "#C7EAFF",
    glow: "rgba(56, 189, 248, 0.75)",
  },
  cyan: {
    name: "Tropical Cyan Sky",
    primary: "#06B6D4", // Cyan 500
    secondary: "#0891B2", // Cyan 600
    midTone: "#22D3EE", // Cyan 400
    tint: "#CFFAFE", // Cyan 100
    glow: "rgba(6, 182, 212, 0.7)",
  },
  royal: {
    name: "Deep Royal Sky",
    primary: "#2563EB", // Blue 600
    secondary: "#1D4ED8", // Blue 700
    midTone: "#60A5FA", // Blue 400
    tint: "#DBEAFE", // Blue 100
    glow: "rgba(37, 99, 235, 0.75)",
  },
};

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface UserStroke {
  points: StrokePoint[];
  color: string;
  width: number;
}

export interface SkyBlueBackgroundProps {
  /** Optional content rendered on top of the background */
  children?: React.ReactNode;
  /** Additional container CSS classes */
  className?: string;
  /** Whether the container fills full screen height (default: true) */
  fullScreen?: boolean;
  /** Pattern style of the strokes (default: "vertical") */
  mode?: SkyBlueStrokeMode;
  /** Stroke width in pixels (default: 1.5) */
  strokeWidth?: number;
  /** Spacing / pitch between lines in pixels (default: 6) */
  strokeSpacing?: number;
  /** Enable doubled twin lines for rich density (default: true) */
  doubleLines?: boolean;
  /** Pre-configured sky blue theme preset (default: "vivid") */
  theme?: SkyBlueThemePreset;
  /** Custom sky blue shade configuration (overrides preset) */
  customShade?: SkyBlueShadeConfig;
  /** Line opacity from 0 to 1 (default: 0.92) */
  opacity?: number;
  /** Whether lines smoothly dissolve into white at the top (default: true) */
  fadeToWhite?: boolean;
  /** Intensity of the fade dissolve (default: 0.85) */
  fadeIntensity?: number;
  /** How far up the sky blue gradient reaches (0.1 to 1.0, default: 0.75) */
  skyBlueDepth?: number;
  /** Intensity / vibrancy multiplier of the sky blue (default: 1.35) */
  colorIntensity?: number;
  /** Subtle continuous wave animation (default: false) */
  animated?: boolean;
  /** Allow interactive click & drag freehand drawing (default: false) */
  interactive?: boolean;
  /** External user strokes array for controlled usage */
  userStrokes?: UserStroke[];
  /** Callback when user draws a stroke in interactive mode */
  onAddUserStroke?: (stroke: UserStroke) => void;
}

// PERF FIX #1 (the main one): the old default was `userStrokes = []`, which
// creates a brand-new array on EVERY render. `userStrokes` is in the draw
// effect's dependency list, so the effect thought its inputs had changed on
// every parent render and repainted the whole canvas (3 gradients + ~1300
// line segments, full viewport x devicePixelRatio). The hero re-renders ~15x
// per second while the demo plays, so the background was being fully
// repainted ~15x/sec for 30 seconds - that is the "stuck" feeling.
// A module-level constant keeps the same identity forever.
const NO_STROKES: UserStroke[] = [];

// PERF FIX #4: on 3x / 4K screens the canvas would be 9-16 megapixels for a
// static pinstripe pattern. 2x is visually identical for 1.5px lines.
const MAX_DPR = 2;

/**
 * SkyBlueBackground - A modern, reusable React component providing
 * a rich, intense sky-blue-to-white gradient background with crisp,
 * doubled white pinstripes and linework.
 *
 * PERF FIX #2: wrapped in React.memo. All props on the landing page are
 * primitives, so when the hero re-renders for the demo timer this component
 * is skipped entirely instead of re-running.
 */
export const SkyBlueBackground = memo(forwardRef<HTMLDivElement, SkyBlueBackgroundProps>(
  function SkyBlueBackground(
    {
      children,
      className = "",
      fullScreen = true,
      mode = "vertical",
      strokeWidth = 1.5,
      strokeSpacing = 6,
      doubleLines = true,
      theme = "vivid",
      customShade,
      opacity = 0.92,
      fadeToWhite = true,
      fadeIntensity = 0.85,
      skyBlueDepth = 0.75,
      colorIntensity = 1.35,
      animated = false,
      interactive = false,
      userStrokes = NO_STROKES,
      onAddUserStroke,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const localContainerRef = useRef<HTMLDivElement | null>(null);
    const isDrawingRef = useRef(false);
    const currentPointsRef = useRef<StrokePoint[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const timeRef = useRef(0);
    // Always points at the latest "paint one frame" function so the resize
    // handler can repaint without re-subscribing anything.
    const drawRef = useRef<() => void>(() => {});
    const sizeRef = useRef<{ width: number; height: number; dpr: number } | null>(
      null
    );

    const shade = customShade || SKY_BLUE_THEMES[theme] || SKY_BLUE_THEMES.vivid;
    // PERF FIX #3: depend on the four colour STRINGS, not the `shade` object.
    // If a parent ever passes `customShade={{...}}` inline, that object is new
    // every render and would repaint the canvas every render too.
    const { primary, secondary, midTone, tint } = shade;

    // Handle high-DPI canvas resizing
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = localContainerRef.current;
      if (!canvas || !container) return;

      // Returns true only if the canvas bitmap was actually resized.
      // Assigning canvas.width/height ALWAYS wipes the canvas (even to the
      // same value), and ResizeObserver fires once right after observe() -
      // so without this guard the freshly painted background got erased a
      // moment after mount. It only "worked" before because the every-render
      // repaint bug (see NO_STROKES) kept redrawing it.
      const applySize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const width = container.clientWidth;
        const height = container.clientHeight;

        const last = sizeRef.current;
        if (
          last &&
          last.width === width &&
          last.height === height &&
          last.dpr === dpr
        ) {
          return false;
        }
        sizeRef.current = { width, height, dpr };

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Resizing reset the transform, so this is the same as the old
          // ctx.scale(dpr, dpr) on a fresh context.
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        return true;
      };

      const handleResize = () => {
        // Resizing clears the bitmap, so repaint right away.
        if (applySize()) drawRef.current();
      };

      // Initial sizing only. The draw effect below paints the first frame
      // (effects run in order), so no double paint on mount.
      applySize();

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    // Main Canvas Render Loop
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = localContainerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let isRunning = true;

      const render = () => {
        if (!isRunning) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const time = animated ? timeRef.current : 0;

        // 1. SKY BLUE AND WHITE GRADIENT BACKGROUND
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        const effectiveDepth = Math.max(
          0.2,
          Math.min(0.95, skyBlueDepth * (colorIntensity > 1 ? 1.05 : 1))
        );
        const startTransition = Math.max(0.05, 1 - effectiveDepth);
        const midStop = startTransition + (1 - startTransition) * 0.45;
        const deepStop = startTransition + (1 - startTransition) * 0.82;

        bgGrad.addColorStop(0.0, "#FFFFFF");
        bgGrad.addColorStop(Math.max(0, startTransition * 0.5), "#FFFFFF");
        bgGrad.addColorStop(startTransition, tint);
        bgGrad.addColorStop(midStop, midTone);
        bgGrad.addColorStop(deepStop, primary);
        bgGrad.addColorStop(1.0, secondary);

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Radiant sky blue glow diffusion
        const radialSkyGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.92,
          20,
          width * 0.5,
          height * 0.8,
          width * 0.75
        );
        radialSkyGrad.addColorStop(0, "rgba(56, 189, 248, 0.4)");
        radialSkyGrad.addColorStop(0.5, "rgba(2, 132, 199, 0.2)");
        radialSkyGrad.addColorStop(1, "rgba(2, 132, 199, 0)");
        ctx.fillStyle = radialSkyGrad;
        ctx.fillRect(0, 0, width, height);

        // Subtle atmospheric white diffusion from top
        const topRadialGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.1,
          10,
          width * 0.5,
          height * 0.4,
          width * 0.85
        );
        topRadialGrad.addColorStop(0, "rgba(255, 255, 255, 0.5)");
        topRadialGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.1)");
        topRadialGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = topRadialGrad;
        ctx.fillRect(0, 0, width, height);

        // 2. CRISP WHITE STROKES / PINSTRIPES
        ctx.save();
        ctx.globalAlpha = opacity;

        // 2A. Vertical Pinstripes
        //
        // PERF FIX: the old version called ctx.beginPath()/stroke() once per
        // line (with doubleLines, that's 2 draw calls per line - at a 6px
        // pitch on a 1920px-wide screen that was ~640 separate stroke()
        // calls, every time this rendered). Each stroke() call is a real GPU
        // draw call. Below, every line segment for this mode is pushed into
        // ONE path and stroked once. Same pixels on screen, ~640x fewer
        // draw calls.
        if (mode === "vertical") {
          const pitch = Math.max(3, strokeSpacing);
          const count = Math.ceil(width / pitch) + 2;

          ctx.lineWidth = strokeWidth;
          ctx.lineCap = "round";

          const lineGrad = ctx.createLinearGradient(0, height, 0, 0);
          lineGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.98)");
          lineGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.92)");
          lineGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.6)");
          lineGrad.addColorStop(0.85, "rgba(255, 255, 255, 0.18)");
          lineGrad.addColorStop(1.0, "rgba(255, 255, 255, 0)");

          ctx.strokeStyle = lineGrad;

          ctx.beginPath();

          for (let i = 0; i < count; i++) {
            const x = i * pitch;
            const waveOffset = animated ? Math.sin(time * 0.002 + i * 0.12) * 3 : 0;

            if (doubleLines) {
              const gap = Math.max(1.5, strokeWidth * 1.5);
              ctx.moveTo(x - gap / 2 + waveOffset, height);
              ctx.lineTo(x - gap / 2 + waveOffset, 0);

              ctx.moveTo(x + gap / 2 + waveOffset, height);
              ctx.lineTo(x + gap / 2 + waveOffset, 0);
            } else {
              ctx.moveTo(x + waveOffset, height);
              ctx.lineTo(x + waveOffset, 0);
            }
          }

          ctx.stroke();
        }

        // 2B. Artistic Brush Strokes
        else if (mode === "brush") {
          const rows = Math.max(3, Math.floor(height / (strokeSpacing * 3)));
          const strokeLen = width * 0.88;

          for (let r = 0; r < rows; r++) {
            const yBase = (height / (rows + 1)) * (r + 1);
            const verticalRatio = Math.max(0, Math.min(1, yBase / height));
            const fadeMult = fadeToWhite ? Math.pow(verticalRatio, 1.2) : 1;

            if (fadeMult < 0.03) continue;

            const startX = (width - strokeLen) / 2 + Math.sin(r + time * 0.001) * 20;
            const bristleCount = Math.max(6, Math.floor(strokeWidth * 3.5));

            for (let b = 0; b < bristleCount; b++) {
              const offsetY = (b - bristleCount / 2) * (strokeWidth * 0.35);
              const bristleAlpha =
                (0.4 + 0.6 * Math.sin((b / bristleCount) * Math.PI)) * fadeMult;

              ctx.save();
              ctx.globalAlpha = opacity * bristleAlpha;

              const grad = ctx.createLinearGradient(
                startX,
                yBase,
                startX + strokeLen,
                yBase
              );
              grad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
              grad.addColorStop(0.5, "rgba(255, 255, 255, 0.98)");
              grad.addColorStop(1, "rgba(255, 255, 255, 0.45)");

              ctx.strokeStyle = grad;
              ctx.lineWidth = Math.max(1, strokeWidth * 0.4);
              ctx.lineCap = "round";

              ctx.beginPath();
              ctx.moveTo(startX, yBase + offsetY);

              const cp1x = startX + strokeLen * 0.32;
              const cp1y = yBase + offsetY + Math.sin(r * 2 + b + time * 0.0015) * 28;
              const cp2x = startX + strokeLen * 0.68;
              const cp2y = yBase + offsetY - Math.cos(r * 2 + b + time * 0.0015) * 28;
              const endX = startX + strokeLen;
              const endY = yBase + offsetY;

              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
              ctx.stroke();

              if (doubleLines) {
                ctx.beginPath();
                ctx.moveTo(startX, yBase + offsetY + 2.5);
                ctx.bezierCurveTo(cp1x, cp1y + 2.5, cp2x, cp2y + 2.5, endX, endY + 2.5);
                ctx.stroke();
              }

              ctx.restore();
            }
          }
        }

        // 2C. Waves
        else if (mode === "waves") {
          const lineCount = Math.max(4, Math.floor(height / strokeSpacing));
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = "round";

          for (let i = 0; i < lineCount; i++) {
            const y = i * strokeSpacing + strokeSpacing / 2;
            const verticalRatio = Math.max(0, Math.min(1, y / height));
            const fadeMult = fadeToWhite ? Math.pow(verticalRatio, 1.2) : 1;

            if (fadeMult < 0.02) continue;

            ctx.save();
            ctx.globalAlpha = opacity * fadeMult;

            const waveGrad = ctx.createLinearGradient(0, y, width, y);
            waveGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
            waveGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.98)");
            waveGrad.addColorStop(1, "rgba(255, 255, 255, 0.45)");

            ctx.strokeStyle = waveGrad;

            const renderWaveAt = (offsetY: number) => {
              ctx.beginPath();
              for (let x = 0; x <= width; x += 15) {
                const waveY =
                  y +
                  offsetY +
                  Math.sin(x * 0.008 + i * 0.3 + (animated ? time * 0.002 : 0)) * 22 +
                  Math.cos(x * 0.015 - i * 0.2) * 8;
                if (x === 0) {
                  ctx.moveTo(x, waveY);
                } else {
                  ctx.lineTo(x, waveY);
                }
              }
              ctx.stroke();
            };

            renderWaveAt(0);
            if (doubleLines) {
              renderWaveAt(3);
            }

            ctx.restore();
          }
        }

        // 2D. Diagonal
        else if (mode === "diagonal") {
          const pitch = Math.max(4, strokeSpacing);
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = "round";

          const maxDist = width + height * 1.5;
          for (let d = -height; d < maxDist; d += pitch) {
            const shift = animated ? (time * 0.02) % pitch : 0;
            const startX = d + shift;
            const endX = d + shift + height;

            const diagGrad = ctx.createLinearGradient(startX, height, endX, 0);
            diagGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
            diagGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.8)");
            diagGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.22)");
            diagGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

            ctx.strokeStyle = diagGrad;

            ctx.beginPath();
            ctx.moveTo(startX, height);
            ctx.lineTo(endX, 0);
            ctx.stroke();

            if (doubleLines) {
              ctx.beginPath();
              ctx.moveTo(startX + 2.5, height);
              ctx.lineTo(endX + 2.5, 0);
              ctx.stroke();
            }
          }
        }

        // 2E. User Drawn Strokes
        userStrokes.forEach((stroke) => {
          if (stroke.points.length < 2) return;
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          for (let i = 1; i < stroke.points.length; i++) {
            const p1 = stroke.points[i - 1];
            const p2 = stroke.points[i];
            const avgY = (p1.y + p2.y) / 2;
            const verticalRatio = Math.max(0, Math.min(1, avgY / height));
            const pointAlpha = fadeToWhite ? Math.pow(verticalRatio, 1.1) : 1;

            ctx.globalAlpha = opacity * Math.max(0.2, pointAlpha);
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width * (p2.pressure || 1);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          ctx.restore();
        });

        // Active drawing in progress
        if (isDrawingRef.current && currentPointsRef.current.length > 1) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          const points = currentPointsRef.current;
          for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const avgY = (p1.y + p2.y) / 2;
            const verticalRatio = Math.max(0, Math.min(1, avgY / height));
            const pointAlpha = fadeToWhite ? Math.pow(verticalRatio, 1.1) : 1;

            ctx.globalAlpha = opacity * Math.max(0.25, pointAlpha);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = strokeWidth * 1.6 * (p2.pressure || 1);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.restore();

        if (animated) {
          timeRef.current += 16;
          animFrameRef.current = requestAnimationFrame(render);
        }
      };

      // Let the resize handler repaint on demand. Static mode: paint once.
      // Animated mode already repaints every frame, so calling render()
      // again there would start a second, duplicate rAF loop - skip it.
      drawRef.current = () => {
        if (!animated) render();
      };

      render();

      return () => {
        isRunning = false;
        drawRef.current = () => {};
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }, [
      mode,
      strokeWidth,
      strokeSpacing,
      doubleLines,
      primary,
      secondary,
      midTone,
      tint,
      opacity,
      fadeToWhite,
      fadeIntensity,
      skyBlueDepth,
      colorIntensity,
      animated,
      userStrokes,
    ]);

    // Interactive pointer handlers (only enabled if interactive === true)
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.8;

      isDrawingRef.current = true;
      currentPointsRef.current = [{ x, y, pressure }];
      e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive || !isDrawingRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.8;

      currentPointsRef.current.push({ x, y, pressure });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!interactive || !isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (currentPointsRef.current.length > 1 && onAddUserStroke) {
        onAddUserStroke({
          points: [...currentPointsRef.current],
          color: "#FFFFFF",
          width: strokeWidth * 1.5,
        });
      }
      currentPointsRef.current = [];
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    };

    return (
      <div
        ref={(el) => {
          localContainerRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className={`relative overflow-hidden ${
          fullScreen ? "w-full h-full min-h-screen" : "w-full h-full"
        } ${interactive ? "cursor-crosshair select-none" : ""} ${className}`}
      >
        {/* Background Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full block ${
            interactive ? "pointer-events-auto" : "pointer-events-none"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Optical Soft Light Fade Overlay at Top */}
        {fadeToWhite && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "linear-gradient(to top, transparent 0%, transparent 42%, rgba(255,255,255,0.18) 65%, rgba(255,255,255,0.8) 88%, #FFFFFF 100%)",
            }}
          />
        )}

        {/* Render Children On Top */}
        {children && <div className="relative z-20 w-full h-full">{children}</div>}
      </div>
    );
  }
));

export default SkyBlueBackground;