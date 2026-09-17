import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export type AnchorPosition = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface PipelineConnectorProps {
  /** Source element ref (or pass startX / startY directly) */
  sourceRef?: React.RefObject<HTMLElement | null>;
  /** Target element ref (or pass endX / endY directly) */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Shared positioning parent container ref */
  containerRef?: React.RefObject<HTMLElement | null>;

  /** Explicit start coordinate X (used when not passing sourceRef) */
  startX?: number;
  /** Explicit start coordinate Y (used when not passing sourceRef) */
  startY?: number;
  /** Explicit end coordinate X (used when not passing targetRef) */
  endX?: number;
  /** Explicit end coordinate Y (used when not passing targetRef) */
  endY?: number;

  /** Edge of the source element to anchor to ('left' | 'right' | 'top' | 'bottom' | 'center') */
  sourceAnchor?: AnchorPosition;
  /** Edge of the target element to anchor to ('left' | 'right' | 'top' | 'bottom' | 'center') */
  targetAnchor?: AnchorPosition;

  /**
   * Lifecycle status:
   * - 'idle': Invisible, waiting
   * - 'originating': Actively draws/travels from source to target
   * - 'completed': Fully connected line in place
   */
  status?: 'idle' | 'originating' | 'completed';

  /** Milliseconds for the line to originate and reach destination (default: 1200) */
  drawDuration?: number;

  /** Callback fired immediately when the beam reaches the target */
  onArrival?: () => void;

  /** Glow & outer filament color (default: warm amber #F2C6A0) */
  color?: string;
  /** Core stroke color (default: warm ivory #FFFDF7) */
  coreColor?: string;
  /** Width of the core stroke in px (default: 1.5) */
  strokeWidth?: number;
  /** Bezier curve tension factor (default: 0.5) */
  curvature?: number;

  /** Whether to show endpoint node rings (default: true) */
  showEndpoints?: boolean;
  /** Radius of endpoint circles (default: 4) */
  endpointRadius?: number;

  /** Continuous glowing packet pulse after completion (default: true) */
  continuousPulse?: boolean;
  /** Loop duration for the continuous pulse in seconds (default: 2.5) */
  pulseDuration?: number;

  /** Custom class name on the SVG container */
  className?: string;
  /** Custom ID prefix */
  id?: string;
}

function getAnchorPoint(rect: DOMRect, anchor: AnchorPosition, containerRect: DOMRect) {
  const relLeft = rect.left - containerRect.left;
  const relTop = rect.top - containerRect.top;
  const centerX = relLeft + rect.width / 2;
  const centerY = relTop + rect.height / 2;

  switch (anchor) {
    case 'left': return { x: relLeft, y: centerY };
    case 'right': return { x: relLeft + rect.width, y: centerY };
    case 'top': return { x: centerX, y: relTop };
    case 'bottom': return { x: centerX, y: relTop + rect.height };
    case 'center':
    default: return { x: centerX, y: centerY };
  }
}

export const PipelineConnector: React.FC<PipelineConnectorProps> = ({
  sourceRef,
  targetRef,
  containerRef,
  startX: propStartX,
  startY: propStartY,
  endX: propEndX,
  endY: propEndY,
  sourceAnchor,
  targetAnchor,
  status = 'originating',
  drawDuration = 1200,
  onArrival,
  color = '#F2C6A0',
  coreColor = '#FFFDF7',
  strokeWidth = 1.5,
  curvature = 0.5,
  showEndpoints = true,
  endpointRadius = 4,
  continuousPulse = true,
  pulseDuration = 2.5,
  className = '',
  id: customId,
}) => {
  const uniqueId = useId();
  const safeId = (customId || `conn-${uniqueId}`).replace(/:/g, '-');
  const pathRef = useRef<SVGPathElement | null>(null);

  const [coords, setCoords] = useState({
    startX: propStartX ?? 0,
    startY: propStartY ?? 0,
    endX: propEndX ?? 100,
    endY: propEndY ?? 100,
  });

  const [pathLength, setPathLength] = useState<number>(300);
  const [progress, setProgress] = useState<number>(status === 'completed' ? 1 : 0);
  const [headPos, setHeadPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [arrivalRippling, setArrivalRippling] = useState(false);

  // Recalculate coordinates from DOM refs or fall back to raw numbers
  useEffect(() => {
    if (!sourceRef?.current || !targetRef?.current) {
      if (
        propStartX !== undefined &&
        propStartY !== undefined &&
        propEndX !== undefined &&
        propEndY !== undefined
      ) {
        setCoords({ startX: propStartX, startY: propStartY, endX: propEndX, endY: propEndY });
      }
      return;
    }

    const updatePoints = () => {
      const srcEl = sourceRef.current;
      const tgtEl = targetRef.current;
      if (!srcEl || !tgtEl) return;

      const container = containerRef?.current || document.body;
      const containerRect = container.getBoundingClientRect();
      const srcRect = srcEl.getBoundingClientRect();
      const tgtRect = tgtEl.getBoundingClientRect();

      // Automatic directional anchor resolution
      const isTargetRight = tgtRect.left + tgtRect.width / 2 >= srcRect.left + srcRect.width / 2;
      const resolvedSrcAnchor = sourceAnchor || (isTargetRight ? 'right' : 'left');
      const resolvedTgtAnchor = targetAnchor || (isTargetRight ? 'left' : 'right');

      const start = getAnchorPoint(srcRect, resolvedSrcAnchor, containerRect);
      const end = getAnchorPoint(tgtRect, resolvedTgtAnchor, containerRect);

      setCoords({
        startX: Math.round(start.x),
        startY: Math.round(start.y),
        endX: Math.round(end.x),
        endY: Math.round(end.y),
      });
    };

    updatePoints();
    const observer = new ResizeObserver(updatePoints);
    if (sourceRef.current) observer.observe(sourceRef.current);
    if (targetRef.current) observer.observe(targetRef.current);
    if (containerRef?.current) observer.observe(containerRef.current);

    window.addEventListener('resize', updatePoints);
    window.addEventListener('scroll', updatePoints, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePoints);
      window.removeEventListener('scroll', updatePoints, true);
    };
  }, [sourceRef, targetRef, containerRef, sourceAnchor, targetAnchor, propStartX, propStartY, propEndX, propEndY]);

  const { startX, startY, endX, endY } = coords;

  // Cubic Bezier curve path calculation
  const pathD = useMemo(() => {
    const dx = endX - startX;
    const dy = endY - startY;
    const curveOffset = Math.max(Math.abs(dx) * curvature, 24);
    const sign = dx >= 0 ? 1 : -1;

    const cp1x = startX + curveOffset * sign;
    const cp1y = startY;
    const cp2x = endX - curveOffset * sign;
    const cp2y = endY;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  }, [startX, startY, endX, endY, curvature]);

  // Track real geometric length
  useEffect(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength();
        if (len > 0) setPathLength(len);
      } catch {}
    }
  }, [pathD]);

  // Originating draw animation
  useEffect(() => {
    if (status === 'idle') {
      setProgress(0);
      setArrivalRippling(false);
      setHeadPos({ x: startX, y: startY });
      return;
    }

    if (status === 'completed') {
      setProgress(1);
      setHeadPos({ x: endX, y: endY });
      return;
    }

    if (status === 'originating') {
      let startTime: number | null = null;
      let animId: number;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const rawProgress = Math.min(elapsed / drawDuration, 1);
        const eased = 1 - Math.pow(1 - rawProgress, 3); // Cubic ease-out
        setProgress(eased);

        if (pathRef.current && pathLength > 0) {
          try {
            const pt = pathRef.current.getPointAtLength(eased * pathLength);
            setHeadPos({ x: pt.x, y: pt.y });
          } catch {}
        }

        if (rawProgress < 1) {
          animId = requestAnimationFrame(animate);
        } else {
          // Reached destination
          setProgress(1);
          setHeadPos({ x: endX, y: endY });
          setArrivalRippling(true);
          setTimeout(() => setArrivalRippling(false), 800);
          if (onArrival) onArrival();
        }
      };

      animId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animId);
    }
  }, [status, drawDuration, pathLength, startX, startY, endX, endY, onArrival]);

  if (status === 'idle') return null;

  const dashOffset = pathLength * (1 - progress);
  const glowFilterId = `${safeId}-glow`;
  const sparkFilterId = `${safeId}-spark`;
  const completedPathId = `${safeId}-completed-path`;

  return (
    <svg
      className={`pointer-events-none absolute inset-0 overflow-visible select-none ${className}`}
      style={{ width: '100%', height: '100%', zIndex: 10 }}
    >
      <defs>
        {/* Soft optical Gaussian glow filter */}
        <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur2" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Focused spark filter for leading packet head */}
        <filter id={sparkFilterId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="spark" />
          <feMerge>
            <feMergeNode in="spark" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hidden reference path for geometry measuring */}
      <path ref={pathRef} d={pathD} fill="none" stroke="transparent" />

      {/* Layer 1: Diffuse glow stroke */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 4.2}
        strokeOpacity={0.28}
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        filter={`url(#${glowFilterId})`}
      />

      {/* Layer 2: Medium concentrated glow tube */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 2.2}
        strokeOpacity={0.6}
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />

      {/* Layer 3: Ultra-sharp core filament */}
      <path
        d={pathD}
        fill="none"
        stroke={coreColor}
        strokeWidth={strokeWidth}
        strokeOpacity={0.95}
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />

      {/* Origin Node at Source */}
      {showEndpoints && (
        <g>
          <circle
            cx={startX}
            cy={startY}
            r={endpointRadius * 1.8}
            fill={color}
            fillOpacity={0.25}
            filter={`url(#${glowFilterId})`}
          />
          <circle
            cx={startX}
            cy={startY}
            r={endpointRadius}
            fill="#111217"
            stroke={color}
            strokeWidth={1.5}
          />
          <circle cx={startX} cy={startY} r={endpointRadius * 0.5} fill={coreColor} />
        </g>
      )}

      {/* Traveling Head Beam (Visible while originating from source) */}
      {status === 'originating' && progress > 0.02 && progress < 0.99 && (
        <g>
          <circle
            cx={headPos.x}
            cy={headPos.y}
            r={endpointRadius * 2}
            fill={color}
            opacity={0.6}
            filter={`url(#${sparkFilterId})`}
          />
          <circle
            cx={headPos.x}
            cy={headPos.y}
            r={endpointRadius * 0.9}
            fill="#FFFFFF"
            filter={`url(#${sparkFilterId})`}
          />
        </g>
      )}

      {/* Destination Node & Arrival Burst */}
      {showEndpoints && progress >= 0.98 && (
        <g>
          <circle
            cx={endX}
            cy={endY}
            r={endpointRadius * 1.8}
            fill={color}
            fillOpacity={0.3}
            filter={`url(#${glowFilterId})`}
          />
          <circle
            cx={endX}
            cy={endY}
            r={endpointRadius}
            fill="#111217"
            stroke={color}
            strokeWidth={1.5}
          />
          <circle cx={endX} cy={endY} r={endpointRadius * 0.5} fill={coreColor} />

          {arrivalRippling && (
            <circle
              cx={endX}
              cy={endY}
              r={endpointRadius * 4}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={0.8}
              className="animate-ping"
            />
          )}
        </g>
      )}

      {/* Optional continuous signal pulse once completed */}
      {status === 'completed' && continuousPulse && (
        <g>
          <path id={completedPathId} d={pathD} fill="none" stroke="transparent" />
          <circle r={endpointRadius * 0.7} fill="#FFFFFF" filter={`url(#${sparkFilterId})`}>
            <animateMotion dur={`${pulseDuration}s`} repeatCount="indefinite" calcMode="linear">
              <mpath href={`#${completedPathId}`} />
            </animateMotion>
          </circle>
        </g>
      )}
    </svg>
  );
};

export default PipelineConnector;