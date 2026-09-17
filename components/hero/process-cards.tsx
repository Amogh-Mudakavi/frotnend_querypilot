"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, RefObject } from "react";
import { Sparkles, UserSearch } from "lucide-react";

import { PipelineConnector } from "./PipelineConnector";
import {
  ProcessCard,
  CardHeader,
  RevealRow,
  CheckRow,
  SourceChip,
  useStepSequence,
  resolveStatus,
  STAGE_ACCENTS,
  QueryUnderstandingCard,
  ExecutionPlanningCard,
  SQLGenerationCard,
  DocumentRetrievalCard,
  QueryPilotProcessCardStyles,
} from "./cards";
import type { ProcessCardStateProps } from "./cards";

/* --------------------------------------------------------------------------
 * Hero process-card geometry
 *
 * This is the single source of truth for the hero cards' physical height.
 * public-site.tsx owns scroll/scene orchestration; this file owns the visual
 * pipeline and card geometry.
 * -------------------------------------------------------------------------- */
export const HERO_PROCESS_CARD_GAP_PX = 12;
export const HERO_PROCESS_CARD_OUT = "clamp(54px, 5.5vw, 84px)";
export const HERO_PROCESS_CARD_WIDTH = "clamp(214px, 18.2vw, 280px)";

/* Connector-first choreography: beam reaches the card before the card reveals. */
const HERO_CONNECTOR_DRAW_MS = 700;
const HERO_CONNECTOR_REVEAL_DELAY_MS = HERO_CONNECTOR_DRAW_MS + 60;

/* --------------------------------------------------------------------------
 * Hero-only cards
 * -------------------------------------------------------------------------- */

export function HeroEmployeeEvidenceCard({
  visible = true,
  active = false,
  completed = false,
  className,
  index,
}: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.employeeEvidence;
  const sequenceStep = useStepSequence(active, 4, 420);
  const step = completed ? 4 : sequenceStep;

  return (
    <ProcessCard visible={visible} className={className} accent={accent}>
      <CardHeader
        icon={<UserSearch className="h-3.5 w-3.5" />}
        title="EMPLOYEE & EVIDENCE"
        kicker="DETERMINISTIC"
        status={resolveStatus(active, completed)}
        index={index}
        accent={accent}
      />

      <div className="mt-2 space-y-2">
        <p className="text-[11px] text-[#687184]">
          Resolving employee, gathering evidence...
        </p>

        <RevealRow show={step >= 1}>
          <div className="flex items-center justify-between rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2">
            <div>
              <p className="text-[11.5px] text-[#111318]">Rahul Sharma</p>
              <p className="mt-0.5 font-mono text-[9.5px] text-[#9AA1AF]">
                Employee ID: E001
              </p>
            </div>
            <span className="text-[9.5px] text-[#9AA1AF]">employee.xlsx</span>
          </div>
        </RevealRow>

        <RevealRow show={step >= 2}>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-2.5 py-2">
              <p className="text-[8.5px] text-[#9AA1AF]">Salary</p>
              <p className="mt-1 text-[10.5px] font-medium text-[#3B404B]">₹60,000</p>
            </div>
            <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-2.5 py-2">
              <p className="text-[8.5px] text-[#9AA1AF]">Entitlement</p>
              <p className="mt-1 text-[10.5px] font-medium text-[#3B404B]">20 days</p>
            </div>
            <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-2.5 py-2">
              <p className="text-[8.5px] text-[#9AA1AF]">Taken</p>
              <p className="mt-1 text-[10.5px] font-medium text-[#3B404B]">12 days</p>
            </div>
          </div>
        </RevealRow>

        <RevealRow show={step >= 3}>
          <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2.5">
            <p className="text-[10.5px] text-[#3B404B]">
              Leave within entitlement → no deduction
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SourceChip show label="employee.xlsx" />
              <SourceChip show label="salary.pdf" />
            </div>
          </div>
        </RevealRow>

        <CheckRow show={step >= 4} label="Evidence assembled" />
      </div>
    </ProcessCard>
  );
}

export function HeroAnswerGenerationCard({
  visible = true,
  active = false,
  completed = false,
  className,
  index,
}: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.answerGeneration;
  const values: [string, string][] = [
    ["Monthly Salary", "₹60,000"],
    ["Leave Taken", "12 days"],
    ["Unpaid Leave", "0 days"],
    ["Salary Deduction", "₹0"],
  ];

  const sequenceStep = useStepSequence(active, values.length, 360);
  const step = completed ? values.length : sequenceStep;

  return (
    <ProcessCard visible={visible} className={className} accent={accent}>
      <CardHeader
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="ANSWER GENERATION"
        kicker="LLM"
        status={resolveStatus(active, completed)}
        index={index}
        accent={accent}
      />

      <div className="mt-2 space-y-2">
        <p className="text-[11px] text-[#687184]">
          Reasoning over verified evidence...
        </p>

        {values.map(([label, value], i) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2 transition-all duration-300"
            style={{
              opacity: step >= i + 1 ? 1 : 0,
              transform: step >= i + 1 ? "translateY(0)" : "translateY(6px)",
            }}
          >
            <span className="text-[10px] text-[#9AA1AF]">{label}</span>
            <span
              className={
                label === "Salary Deduction"
                  ? "text-[10.5px] font-semibold text-[#3FB984]"
                  : "text-[10.5px] font-semibold text-[#3B404B]"
              }
            >
              {value}
            </span>
          </div>
        ))}

        <CheckRow show={completed} label="Answer ready" />
      </div>
    </ProcessCard>
  );
}

/* --------------------------------------------------------------------------
 * Pipeline sequence
 * -------------------------------------------------------------------------- */

const HERO_CARD_SEQUENCE: ComponentType<ProcessCardStateProps>[] = [
  QueryUnderstandingCard,
  HeroEmployeeEvidenceCard,
  ExecutionPlanningCard,
  DocumentRetrievalCard,
  SQLGenerationCard,
  HeroAnswerGenerationCard,
];

const HERO_CARD_ACCENTS = [
  STAGE_ACCENTS.queryUnderstanding,
  STAGE_ACCENTS.employeeEvidence,
  STAGE_ACCENTS.executionPlanning,
  STAGE_ACCENTS.documentSearch,
  STAGE_ACCENTS.sqlGeneration,
  STAGE_ACCENTS.answerGeneration,
];

export const HERO_STAGE_START_MS = 9000;
export const HERO_STAGE_END_MS = 23000;
const HERO_STAGE_DURATION_MS =
  (HERO_STAGE_END_MS - HERO_STAGE_START_MS) / HERO_CARD_SEQUENCE.length;

export type HeroProcessCardEntry = {
  Card: ComponentType<ProcessCardStateProps>;
  index: number;
  active: boolean;
  visible: boolean;
  accent: string;
  cardRef: RefObject<HTMLDivElement | null>;
};

/*
 * CONNECTOR GEOMETRY
 *
 * Every connector's endpoints are derived from real, live DOM rects — never
 * a hardcoded coordinate, a 25/50/75% approximation, or a per-card offset.
 * `PipelineConnector` itself is unmodified: its own ref-based anchor math
 * always resolves an edge's Y to that *same* element's own vertical center,
 * which can't express "source Y = the target card's midpoint." So this
 * hook does that one calculation here, using the real elements, and hands
 * `PipelineConnector` plain numbers through its existing explicit
 * start/end-coordinate props.
 *
 * For each card:
 *   - target edge  = the card's real edge facing the window (its right
 *     edge for left-side cards, left edge for right-side cards)
 *   - target Y     = that card's own actual vertical midpoint
 *   - source edge  = the window's real left/right border
 *   - source Y     = the target's midpoint, clamped to the window's own
 *     actual vertical extent so the beam always leaves from a point that
 *     is genuinely on the visible border, never above/below it
 *
 * `ready` stays false — and the connector stays idle — until both the
 * source and the target have a real, measured (non-zero) rect, so a
 * connector never calculates or renders from a hidden/unmounted target.
 */
type ConnectorPoint = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  ready: boolean;
};

const IDLE_CONNECTOR_POINT: ConnectorPoint = {
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  ready: false,
};

function useConnectorGeometry(
  mainWindowRef: RefObject<HTMLElement | null>,
  cardRefs: RefObject<HTMLDivElement | null>[],
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): ConnectorPoint[] {
  const [points, setPoints] = useState<ConnectorPoint[]>(() =>
    cardRefs.map(() => IDLE_CONNECTOR_POINT),
  );

  useLayoutEffect(() => {
    if (!enabled) {
      setPoints(cardRefs.map(() => IDLE_CONNECTOR_POINT));
      return;
    }

    const container = containerRef.current;
    const source = mainWindowRef.current;
    if (!container || !source) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const sourceRect = source.getBoundingClientRect();

      setPoints(
        cardRefs.map((ref, i) => {
          const target = ref.current;
          if (!target) return IDLE_CONNECTOR_POINT;

          const targetRect = target.getBoundingClientRect();
          const ready =
            sourceRect.width > 0 &&
            sourceRect.height > 0 &&
            targetRect.width > 0 &&
            targetRect.height > 0;

          if (!ready) return IDLE_CONNECTOR_POINT;

          const isRightSide = i >= 3;
          const targetMidY = targetRect.top + targetRect.height / 2;

          // Derived from the target's own midpoint, but never allowed to
          // leave the window's actual visible border.
          const sourceY = Math.min(
            Math.max(targetMidY, sourceRect.top),
            sourceRect.bottom,
          );

          return {
            startX:
              (isRightSide ? sourceRect.right : sourceRect.left) -
              containerRect.left,
            startY: sourceY - containerRect.top,
            endX:
              (isRightSide ? targetRect.left : targetRect.right) -
              containerRect.left,
            endY: targetMidY - containerRect.top,
            ready: true,
          };
        }),
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(source);
    cardRefs.forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainWindowRef, containerRef, cardRefs.length, enabled]);

  return points;
}

/*
 * Each card is purely content-sized: no forced min-height, no shared row
 * height. `gridAutoRows: max-content` means every row is exactly as tall as
 * that card's own content, so Execution Planning (more plan rows) and SQL
 * Generation (a short code block) can differ in height without clipping or
 * padding either one out.
 *
 * VERTICAL SAFETY CLAMP:
 * The column is positioned relative to the demo window's own box (its
 * parent), centered on the window's vertical middle. That's fine as long as
 * the column is shorter than the window — but a tall column (e.g. three
 * content-heavy cards stacked with gaps) is routinely *taller* than the
 * window itself. Clamping against the window's own box in that case is a
 * no-op: the clamp always bottoms out at the same offset near the window's
 * top edge, and the column's trailing card spills straight through the
 * window's own bottom edge and off the bottom of the viewport — that's the
 * root cause of the last card in each stack landing outside the screen.
 *
 * The safe region a column actually needs to respect is the viewport
 * itself — clear of the fixed navbar above, clear of the viewport's own
 * bottom edge below — not the (possibly much shorter) window box it's
 * anchored to. This reads the navbar's real rendered edge via the same
 * `[data-querypilot-nav]` hook the theme-detector elsewhere in this file
 * already uses, and the live viewport height, then clamps the column's
 * position — converted into the column's own parent-relative coordinate
 * space — inside that band.
 */
const CLAMP_MARGIN_PX = 20;

function HeroProcessColumn({
  side,
  cards,
}: {
  side: "left" | "right";
  cards: HeroProcessCardEntry[];
}) {
  const isRight = side === "right";
  const columnRef = useRef<HTMLDivElement | null>(null);
  const [centerOffsetPx, setCenterOffsetPx] = useState(0);

  useLayoutEffect(() => {
    const column = columnRef.current;
    const parent = column?.parentElement;
    if (!column || !parent) return;

    const reposition = () => {
      const parentRect = parent.getBoundingClientRect();
      const columnHeight = column.getBoundingClientRect().height;

      const nav = document.querySelector(
        "[data-querypilot-nav]",
      ) as HTMLElement | null;
      const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
      const viewportHeight = window.innerHeight;

      // Where the column would sit if perfectly centered on the window.
      const idealTop = (parentRect.height - columnHeight) / 2;

      // The safe band, expressed in the column's own parent-relative
      // coordinate space: clear of the navbar above, clear of the
      // viewport's bottom edge below.
      const minTop = navBottom + CLAMP_MARGIN_PX - parentRect.top;
      const maxTop =
        viewportHeight - CLAMP_MARGIN_PX - parentRect.top - columnHeight;
      const lo = Math.min(minTop, maxTop);
      const hi = Math.max(minTop, maxTop);
      const clampedTop = Math.min(Math.max(idealTop, lo), hi);

      setCenterOffsetPx(clampedTop - idealTop);
    };

    reposition();

    const observer = new ResizeObserver(reposition);
    observer.observe(column);
    observer.observe(parent);
    window.addEventListener("resize", reposition);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
    };
  }, [cards.length]);

  return (
    <div
      ref={columnRef}
      className="pointer-events-none absolute z-20 grid"
      style={{
        [isRight ? "left" : "right"]: `calc(100% + ${HERO_PROCESS_CARD_OUT})`,
        top: "50%",
        transform: `translateY(calc(-50% + ${centerOffsetPx}px))`,
        width: HERO_PROCESS_CARD_WIDTH,
        gridAutoRows: "max-content",
        alignContent: "center",
        gap: HERO_PROCESS_CARD_GAP_PX,
      }}
    >
      {cards.map(({ Card, index, active, visible, cardRef }) => (
        <div
          key={index}
          ref={cardRef}
          className="relative w-full"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 360ms ease, transform 360ms ease",
          }}
        >
          <Card
            visible={visible}
            active={active}
            completed={!active && visible}
            index={index + 1}
            className="querypilot-card-settle w-full"
          />
        </div>
      ))}
    </div>
  );
}

export function QueryPilotProcessCards({
  elapsed = 0,
  show = true,
  containerRef,
  mainWindowRef,
}: {
  elapsed?: number;
  show?: boolean;
  /** Shared positioning ancestor for connector geometry (see PipelineConnector). */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * The actual rendered QueryPilot demo window (the DemoWindowChrome box),
   * not a fake stand-in point. Every connector originates from this
   * element's own border, so the beam always tracks the real, responsive
   * edge of the center window rather than a hardcoded coordinate.
   */
  mainWindowRef: RefObject<HTMLElement | null>;
}) {
  const cardRefs = useRef<RefObject<HTMLDivElement | null>[]>(
    Array.from({ length: HERO_CARD_SEQUENCE.length }, () => ({ current: null })),
  );

  // IMPORTANT: this hook must run on every render. Keeping it above the
  // conditional return prevents React's Rules-of-Hooks violation when the
  // process-card layer transitions between hidden and visible states.
  const pipelineEnabled = show && elapsed >= HERO_STAGE_START_MS;

  const connectorPoints = useConnectorGeometry(
    mainWindowRef,
    cardRefs.current,
    containerRef,
    pipelineEnabled,
  );

  if (!show || elapsed < HERO_STAGE_START_MS) return null;

  const stageIndex = Math.min(
    HERO_CARD_SEQUENCE.length - 1,
    Math.floor((elapsed - HERO_STAGE_START_MS) / HERO_STAGE_DURATION_MS),
  );

  const isDemoFinished = elapsed >= HERO_STAGE_END_MS;
  const stageElapsed = isDemoFinished
    ? HERO_STAGE_DURATION_MS
    : (elapsed - HERO_STAGE_START_MS) % HERO_STAGE_DURATION_MS;

  /*
   * Stage lifecycle:
   *   0ms           connector starts from center-window border
   *   700ms         connector reaches card
   *   760ms         card reveals
   *   next stage    next connector originates
   *
   * Completed connectors remain in place, so the whole architecture builds
   * progressively rather than flashing all six cards into existence.
   */
  const activeStageVisible =
    isDemoFinished || stageElapsed >= HERO_CONNECTOR_REVEAL_DELAY_MS;

  const entries: HeroProcessCardEntry[] = HERO_CARD_SEQUENCE.map((Card, i) => ({
    Card,
    index: i,
    active: !isDemoFinished && activeStageVisible && i === stageIndex,
    visible:
      isDemoFinished ||
      i < stageIndex ||
      (i === stageIndex && activeStageVisible),
    accent: HERO_CARD_ACCENTS[i],
    cardRef: cardRefs.current[i],
  }));

  return (
    <>
      <QueryPilotProcessCardStyles />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[75] hidden overflow-visible min-[901px]:block"
      >
        <HeroProcessColumn side="left" cards={entries.slice(0, 3)} />
        <HeroProcessColumn side="right" cards={entries.slice(3, 6)} />

        {entries.map(({ index }) => {
          /*
           * The current stage's connector is only mid-travel for its own
           * draw duration. Once the beam has actually arrived, it settles
           * to "completed" for the rest of the stage — well before the
           * card's own content (e.g. SQL Generation's typed code block)
           * keeps changing height — so a later geometry update just snaps
           * the already-completed line to the new position instead of
           * re-triggering PipelineConnector's multi-hundred-ms travel
           * animation over and over.
           */
          const status =
            isDemoFinished || index < stageIndex
              ? "completed"
              : index === stageIndex
                ? stageElapsed >= HERO_CONNECTOR_DRAW_MS
                  ? "completed"
                  : "originating"
                : "idle";

          const point = connectorPoints[index] ?? IDLE_CONNECTOR_POINT;

          // A connector must never calculate or render from stale/hidden
          // geometry: hold it at idle until the target card's real DOM
          // rect has actually been measured.
          const effectiveStatus = point.ready ? status : "idle";

          return (
            <PipelineConnector
              key={`hero-connector-${index + 1}`}
              startX={point.startX}
              startY={point.startY}
              endX={point.endX}
              endY={point.endY}
              status={effectiveStatus}
              drawDuration={HERO_CONNECTOR_DRAW_MS}
              color="#F2C6A0"
              coreColor="#FFFDF7"
              strokeWidth={1.25}
              curvature={0.46}
              showEndpoints={false}
              continuousPulse={false}
              className="z-10"
              id={`hero-process-connector-${index + 1}`}
            />
          );
        })}
      </div>
    </>
  );
}