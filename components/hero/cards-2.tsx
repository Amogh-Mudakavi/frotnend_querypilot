"use client"

import type { ComponentType } from "react"

import {
  Sparkles,
  UserSearch,
} from "lucide-react"

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
} from "./cards"

import type {
  ProcessCardStateProps,
} from "./cards"

/* ============================================================
   EMPLOYEE & EVIDENCE
   ============================================================ */

export function EmployeeEvidenceCard({
  visible = true,
  active = false,
  completed = false,
  className,
  index,
}: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.employeeEvidence

  // Hook is always called (rules of hooks) — the ternary only decides
  // which value is *displayed*, never whether the hook itself runs.
  const sequenceStep = useStepSequence(
    active,
    4,
    420,
  )
  const step = completed ? 4 : sequenceStep

  return (
    <ProcessCard
      visible={visible}
      className={className}
      accent={accent}
    >
      <CardHeader
        icon={
          <UserSearch className="h-3.5 w-3.5" />
        }
        title="EMPLOYEE & EVIDENCE"
        kicker="DETERMINISTIC"
        status={resolveStatus(
          active,
          completed,
        )}
        index={index}
        accent={accent}
      />

      <div className="mt-2.5 space-y-2.5">
        <p className="text-[11px] text-[#687184]">
          Resolving employee, gathering evidence...
        </p>

        <RevealRow show={step >= 1}>
          <div className="flex items-center justify-between rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2">
            <div>
              <p className="text-[11.5px] text-[#111318]">
                Rahul Sharma
              </p>

              <p className="mt-0.5 font-mono text-[9.5px] text-[#9AA1AF]">
                Employee ID: E001
              </p>
            </div>

            <span className="text-[9.5px] text-[#9AA1AF]">
              employee.xlsx
            </span>
          </div>
        </RevealRow>

        <RevealRow show={step >= 2}>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-2.5 py-2">
              <p className="text-[8.5px] text-[#9AA1AF]">
                Salary
              </p>
              <p className="mt-1 text-[10.5px] font-medium text-[#3B404B]">
                ₹60,000
              </p>
            </div>

            <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-2.5 py-2">
              <p className="text-[8.5px] text-[#9AA1AF]">
                Entitlement
              </p>
              <p className="mt-1 text-[10.5px] font-medium text-[#3B404B]">
                20 days
              </p>
            </div>

            <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-2.5 py-2">
              <p className="text-[8.5px] text-[#9AA1AF]">
                Taken
              </p>
              <p className="mt-1 text-[10.5px] font-medium text-[#3B404B]">
                12 days
              </p>
            </div>
          </div>
        </RevealRow>

        <RevealRow show={step >= 3}>
          <div className="rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2.5">
            <p className="text-[10.5px] text-[#3B404B]">
              Leave within entitlement → no deduction
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <SourceChip
                show
                label="employee.xlsx"
              />

              <SourceChip
                show
                label="salary.pdf"
              />
            </div>
          </div>
        </RevealRow>

        <CheckRow
          show={step >= 4}
          label="Evidence assembled"
        />
      </div>
    </ProcessCard>
  )
}

/* ============================================================
   ANSWER GENERATION
   ============================================================ */

export function AnswerGenerationCard({
  visible = true,
  active = false,
  completed = false,
  className,
  index,
}: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.answerGeneration

  const values = [
    ["Monthly Salary", "₹60,000"],
    ["Leave Taken", "12 days"],
    ["Unpaid Leave", "0 days"],
    ["Salary Deduction", "₹0"],
  ]

  const sequenceStep = useStepSequence(
    active,
    values.length,
    360,
  )
  const step = completed ? values.length : sequenceStep

  return (
    <ProcessCard
      visible={visible}
      className={className}
      accent={accent}
    >
      <CardHeader
        icon={
          <Sparkles className="h-3.5 w-3.5" />
        }
        title="ANSWER GENERATION"
        kicker="LLM"
        status={resolveStatus(
          active,
          completed,
        )}
        index={index}
        accent={accent}
      />

      <div className="mt-2.5 space-y-2">
        <p className="text-[11px] text-[#687184]">
          Reasoning over verified evidence...
        </p>

        {values.map(
          ([label, value], i) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg border border-[#EEF0F3] bg-[#FBFBFC] px-3 py-2 transition-all duration-300"
              style={{
                opacity:
                  step >= i + 1
                    ? 1
                    : 0,

                transform:
                  step >= i + 1
                    ? "translateY(0)"
                    : "translateY(6px)",
              }}
            >
              <span className="text-[10px] text-[#9AA1AF]">
                {label}
              </span>

              <span
                className={`text-[10.5px] font-semibold ${
                  label ===
                  "Salary Deduction"
                    ? "text-[#3FB984]"
                    : "text-[#3B404B]"
                }`}
              >
                {value}
              </span>
            </div>
          ),
        )}

        <CheckRow
          show={completed}
          label="Grounded answer ready"
        />
      </div>
    </ProcessCard>
  )
}

/* ============================================================
   PROCESS TIMELINE — labels around the big card
   ============================================================ */

const CARD_SEQUENCE: ComponentType<ProcessCardStateProps>[] = [
  QueryUnderstandingCard,
  EmployeeEvidenceCard,
  ExecutionPlanningCard,
  DocumentRetrievalCard,
  SQLGenerationCard,
  AnswerGenerationCard,
]

const CARD_ACCENTS: string[] = [
  STAGE_ACCENTS.queryUnderstanding,
  STAGE_ACCENTS.employeeEvidence,
  STAGE_ACCENTS.executionPlanning,
  STAGE_ACCENTS.documentSearch,
  STAGE_ACCENTS.sqlGeneration,
  STAGE_ACCENTS.answerGeneration,
]

const OUT_PX = 18
const LABEL_WIDTH = "clamp(190px, 16vw, 250px)"
const COLUMN_TOP = "-72px"
const CARD_GAP = 28

function ProcessColumn({
  side,
  cards,
}: {
  side: "left" | "right"
  cards: {
    Card: ComponentType<ProcessCardStateProps>
    index: number
    active: boolean
    accent: string
  }[]
}) {
  const isRight = side === "right"
  const orderedCards = isRight
    ? [...cards].reverse()
    : cards

  return (
    <div
      className="pointer-events-none absolute grid"
      style={{
        [isRight ? "left" : "right"]: `calc(100% + ${OUT_PX}px)`,
        top: COLUMN_TOP,
        width: LABEL_WIDTH,
        height: "calc(100% + 144px)",
        gridTemplateRows: "repeat(3, minmax(0, 1fr))",
        gap: CARD_GAP,
      }}
    >
      {orderedCards.map(
        ({ Card, index, active, accent }, slot) => {
          const dotColor = active
            ? accent
            : "#3FB984"

          return (
            <div
              key={index}
              className="relative flex min-h-0 w-full items-center"
              style={{
                gridRow: slot + 1,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute h-[1.5px] transition-[background] duration-300"
                style={{
                  [isRight ? "left" : "right"]:
                    "100%",
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  width: `${OUT_PX}px`,
                  background: isRight
                    ? `linear-gradient(to left, ${dotColor}66, transparent)`
                    : `linear-gradient(to right, ${dotColor}66, transparent)`,
                }}
              />

              <span
                aria-hidden="true"
                className="absolute h-[8px] w-[8px] rounded-full ring-2 ring-white transition-colors duration-300"
                style={
                  {
                    [isRight ? "left" : "right"]:
                      -4,
                    top: "50%",
                    transform: `translate(${isRight ? "-50%" : "50%"}, -50%)`,
                    background: dotColor,
                    animation: active
                      ? "querypilot-dot-pulse 1.4s ease-in-out infinite"
                      : "none",
                    ["--qp-dot-halo" as any]:
                      `${accent}29`,
                    ["--qp-dot-halo-soft" as any]:
                      `${accent}0f`,
                  } as React.CSSProperties
                }
              />

              <Card
                visible
                active={active}
                completed={!active}
                index={index + 1}
                className="querypilot-card-settle w-full"
              />
            </div>
          )
        },
      )}
    </div>
  )
}

export const STAGE_START_MS = 9000
export const STAGE_END_MS = 23000
const STAGE_DURATION_MS =
  (STAGE_END_MS - STAGE_START_MS) / CARD_SEQUENCE.length

export function QueryPilotProcessCards({
  elapsed = 0,
  show = true,
}: {
  /** Shared QueryPilotApp elapsed clock. */
  elapsed?: number
  /** Parent-controlled presentation visibility. */
  show?: boolean
}) {
  if (!show || elapsed < STAGE_START_MS) {
    return null
  }

  const stageIndex = Math.min(
    CARD_SEQUENCE.length - 1,
    Math.floor((elapsed - STAGE_START_MS) / STAGE_DURATION_MS),
  )

  const isDemoFinished = elapsed >= STAGE_END_MS

  const leftCards: {
    Card: ComponentType<ProcessCardStateProps>
    index: number
    active: boolean
    accent: string
  }[] = []
  const rightCards: {
    Card: ComponentType<ProcessCardStateProps>
    index: number
    active: boolean
    accent: string
  }[] = []

  CARD_SEQUENCE.slice(0, stageIndex + 1).forEach((Card, i) => {
    const active = !isDemoFinished && i === stageIndex

    const entry = {
      Card,
      index: i,
      active,
      accent: CARD_ACCENTS[i],
    }

    if (i < 3) {
      leftCards.push(entry)
    } else {
      rightCards.push(entry)
    }
  })

  return (
    <>
      <QueryPilotProcessCardStyles />

      <div className="pointer-events-none absolute inset-0 z-[75] hidden overflow-visible min-[901px]:block">
        <ProcessColumn side="left" cards={leftCards} />
        <ProcessColumn side="right" cards={rightCards} />
      </div>
    </>
  )
}