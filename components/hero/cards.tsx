"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Check,
  Database,
  FileSearch,
  Sparkles,
  UserSearch,
  Workflow,
} from "lucide-react";

export interface ProcessCardStateProps {
  visible?: boolean;
  active?: boolean;
  completed?: boolean;
  className?: string;
  /** 1-based position in the process sequence, shown as a small label number. */
  index?: number;
}

export type CardStatus = "idle" | "processing" | "complete";

export function resolveStatus(active = false, completed = false): CardStatus {
  if (completed) return "complete";
  if (active) return "processing";
  return "idle";
}

/* ============================================================
   STAGE ACCENTS
   One hue per pipeline stage, in sequence order, so the six cards
   read as steps in a single flow rather than six identical white
   panels. Used for the icon chip, the spinner ring, the top
   hairline, the corner glow, and the connector dot/line drawn
   toward the main demo window in process-cards.tsx.
   ============================================================ */

export const STAGE_ACCENTS = {
  queryUnderstanding: "#6366F1", // indigo
  employeeEvidence: "#F59E0B", // amber
  executionPlanning: "#EC4899", // pink
  documentSearch: "#14B8A6", // teal
  sqlGeneration: "#7D64FF", // violet
  answerGeneration: "#3FB984", // green — also the "success" color
} as const;

export const STAGE_ACCENT_SEQUENCE = [
  STAGE_ACCENTS.queryUnderstanding,
  STAGE_ACCENTS.employeeEvidence,
  STAGE_ACCENTS.executionPlanning,
  STAGE_ACCENTS.documentSearch,
  STAGE_ACCENTS.sqlGeneration,
  STAGE_ACCENTS.answerGeneration,
];

export function useStepSequence(
  active: boolean,
  stepCount: number,
  delay = 350,
  initialDelay = 180,
) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }

    setStep(0);
    let current = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = setTimeout(() => {
      interval = setInterval(() => {
        current += 1;
        setStep(current);

        if (current >= stepCount && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, delay);
    }, initialDelay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [active, stepCount, delay, initialDelay]);

  return step;
}

export function useTypewriter(
  active: boolean,
  text: string,
  delay = 18,
  initialDelay = 150,
) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }

    let current = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    setCount(0);

    const start = setTimeout(() => {
      interval = setInterval(() => {
        current += 1;
        setCount(current);

        if (current >= text.length && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, delay);
    }, initialDelay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [active, text, delay, initialDelay]);

  return text.slice(0, count);
}

export function RevealRow({
  show,
  children,
  className = "",
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`transition-[opacity,transform] duration-300 ease-out ${className}`}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translate3d(0,0,0)" : "translate3d(0,6px,0)",
      }}
    >
      {children}
    </div>
  );
}

export function CheckRow({
  show,
  label,
  className = "",
}: {
  show: boolean;
  label: string;
  className?: string;
}) {
  return (
    <RevealRow show={show} className={`flex items-center gap-1.5 ${className}`}>
      <Check className="h-3 w-3 shrink-0 text-[#3FB984]" strokeWidth={2.75} />
      <span className="text-[11.5px] text-[#3B404B]">{label}</span>
    </RevealRow>
  );
}

export function ScanLine({
  active,
  accent = "#7D64FF",
}: {
  active: boolean;
  accent?: string;
}) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg" aria-hidden="true">
      <div
        className="absolute left-0 right-0 h-8"
        style={{
          background: `linear-gradient(to bottom, transparent, ${accent}17, transparent)`,
          animation: "querypilot-scan-line 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export function ProgressIndicator({
  active,
  done,
  accent = "#7D64FF",
}: {
  active: boolean;
  done?: boolean;
  accent?: string;
}) {
  return (
    <div className="relative h-[3px] overflow-hidden rounded-full bg-[#EEF0F3]">
      {done ? (
        <div className="absolute inset-0 rounded-full bg-[#3FB984]" />
      ) : active ? (
        <div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full"
          style={{
            backgroundColor: `${accent}99`,
            animation: "querypilot-progress 1.2s ease-in-out infinite",
          }}
        />
      ) : null}
    </div>
  );
}

export function SourceChip({ show, label }: { show: boolean; label: string }) {
  return (
    <span
      className="inline-flex rounded-md border border-[#DCE4F4] bg-[#F4F6FF] px-2 py-1 text-[10.5px] font-medium text-[#687184] transition-all duration-300"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(5px)",
      }}
    >
      {label}
    </span>
  );
}

/* ============================================================
   ProcessCard shell
   ============================================================ */

export function ProcessCard({
  children,
  visible = true,
  className = "",
  accent = "#7D64FF",
}: {
  children: ReactNode;
  visible?: boolean;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`relative w-full max-w-[330px] overflow-hidden rounded-[20px] border border-[#DDE3F1] bg-[linear-gradient(145deg,#FFFFFF_0%,#FAFBFF_50%,#F1EEFF_100%)] p-3.5 shadow-[0_20px_54px_rgba(63,66,110,0.16)] will-change-[transform,opacity] ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0) scale(1)" : "translate3d(0,18px,0) scale(.94)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full transition-[background] duration-500"
        style={{ background: `radial-gradient(circle, ${accent}33 0%, ${accent}00 72%)` }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -left-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(63,185,132,0.14)_0%,rgba(63,185,132,0)_72%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-[background] duration-500"
        style={{ background: `linear-gradient(90deg, ${accent}00, ${accent}99, ${accent}00)` }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ============================================================
   CardHeader
   ============================================================ */

export function CardHeader({
  icon,
  title,
  kicker,
  status,
  index,
  accent = "#7D64FF",
}: {
  icon: ReactNode;
  title: string;
  kicker: string;
  status: CardStatus;
  index?: number;
  accent?: string;
}) {
  const iconChipClass =
    status === "complete"
      ? "bg-[#3FB984]/12 text-[#3FB984]"
      : status === "processing"
        ? ""
        : "bg-[#F4F5F7] text-[#9AA1AF]";

  const iconChipStyle =
    status === "processing" ? { backgroundColor: `${accent}1F`, color: accent } : undefined;

  return (
    <div className="flex items-start gap-3">
      <div className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full">
        {status === "complete" ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#3FB984]/15 ring-1 ring-[#3FB984]/40">
            <Check className="h-3.5 w-3.5 text-[#3FB984]" strokeWidth={2.75} />
          </span>
        ) : status === "processing" ? (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-[#EEF0F3]" />
            <span
              className="absolute inset-0 rounded-full border-2 border-transparent"
              style={{ borderTopColor: accent, animation: "querypilot-spinner .8s linear infinite" }}
            />
            <span className="text-[9.5px] font-semibold" style={{ color: accent }}>
              {index ?? ""}
            </span>
          </>
        ) : (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#E5E7EB] text-[9.5px] font-semibold text-[#9AA1AF]">
            {index ?? ""}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-0.5 shrink-0 rounded-md p-1 transition-colors duration-300 ${iconChipClass}`} style={iconChipStyle}>
          {icon}
        </span>

        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold tracking-[0.06em] text-[#111318]">{title}</p>
          <p className="text-[9.5px] font-medium tracking-[0.05em] text-[#9AA1AF]">{kicker}</p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   QUERY UNDERSTANDING
   ============================================================ */

export function QueryUnderstandingCard({ visible = true, active = false, completed = false, className, index }: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.queryUnderstanding;
  const entities = ["Rahul Sharma", "Salary", "Leave"];
  const sources = ["Employee data", "Salary rules"];
  const stepCount = 1 + entities.length + sources.length;

  // Hook is always called (Rules of Hooks) — the ternary only decides which
  // value is *displayed*, never whether the hook itself runs.
  const sequenceStep = useStepSequence(active, stepCount, 310);
  const step = completed ? stepCount : sequenceStep;

  return (
    <ProcessCard visible={visible} className={className} accent={accent}>
      <CardHeader
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="QUERY UNDERSTANDING"
        kicker="LLM"
        status={resolveStatus(active, completed)}
        index={index}
        accent={accent}
      />

      <div className="mt-2 space-y-2">
        <p className="text-[11px] text-[#687184]">Analyzing question...</p>

        <ProgressIndicator active={active && !completed} done={completed} accent={accent} />

        <RevealRow show={step >= 1}>
          <p className="text-[9.5px] font-medium tracking-[0.05em] text-[#9AA1AF]">INTENT</p>
          <p className="mt-1 text-[11.5px] text-[#111318]">Calculate salary deduction</p>
        </RevealRow>

        <div>
          <p className="text-[9.5px] font-medium tracking-[0.05em] text-[#9AA1AF]">ENTITIES</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {entities.map((entity, i) => (
              <RevealRow key={entity} show={step >= 2 + i} className="inline-block">
                <span className="inline-flex rounded-md border border-[#DCE4F4] bg-[#F4F6FF] px-2 py-1 text-[10px] text-[#3B404B]">
                  {entity}
                </span>
              </RevealRow>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9.5px] font-medium tracking-[0.05em] text-[#9AA1AF]">SOURCES</p>
          <div className="mt-1 space-y-1">
            {sources.map((source, i) => (
              <RevealRow key={source} show={step >= 2 + entities.length + i}>
                <p className="text-[11px] text-[#3B404B]">{source}</p>
              </RevealRow>
            ))}
          </div>
        </div>

        <CheckRow show={completed} label="Understanding complete" />
      </div>
    </ProcessCard>
  );
}

/* ============================================================
   EXECUTION PLANNING
   ============================================================ */

export function ExecutionPlanningCard({ visible = true, active = false, completed = false, className, index }: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.executionPlanning;
  const sequence = ["Resolve employee", "Query employee data", "Search salary policy", "Calculate deduction", "Validate answer"];

  const sequenceStep = useStepSequence(active, sequence.length, 300);
  const step = completed ? sequence.length : sequenceStep;

  return (
    <ProcessCard visible={visible} className={className} accent={accent}>
      <CardHeader
        icon={<Workflow className="h-3.5 w-3.5" />}
        title="EXECUTION PLANNING"
        kicker="DETERMINISTIC"
        status={resolveStatus(active, completed)}
        index={index}
        accent={accent}
      />

      <div className="mt-2 space-y-2">
        <p className="text-[11px] text-[#687184]">Mixed query detected</p>

        <div className="grid grid-cols-2 gap-1.5">
          <RevealRow show={step >= 1}>
            <div className="rounded-md border border-[#E1E6F0] bg-[#F8FAFD] px-2 py-1.5">
              <p className="text-[8.5px] font-semibold tracking-[0.06em] text-[#9AA1AF]">TABLE QUERY</p>
              <p className="mt-1 text-[10px] text-[#3B404B]">Employee salary</p>
              <p className="text-[10px] text-[#3B404B]">Leave taken</p>
            </div>
          </RevealRow>

          <RevealRow show={step >= 2}>
            <div className="rounded-md border border-[#E1E6F0] bg-[#F8FAFD] px-2 py-1.5">
              <p className="text-[8.5px] font-semibold tracking-[0.06em] text-[#9AA1AF]">DOCUMENT SEARCH</p>
              <p className="mt-1 text-[10px] text-[#3B404B]">Salary rules</p>
            </div>
          </RevealRow>
        </div>

        <div>
          <p className="mb-1.5 text-[9.5px] font-medium tracking-[0.05em] text-[#9AA1AF]">PLAN</p>
          <div className="space-y-1.5">
            {sequence.map((item, i) => (
              <RevealRow key={item} show={step >= i + 1}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8.5px] text-[#C4C9D2]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[10.5px] text-[#3B404B]">{item}</span>
                </div>
              </RevealRow>
            ))}
          </div>
        </div>

        <CheckRow show={completed} label="Plan ready" />
      </div>
    </ProcessCard>
  );
}

/* ============================================================
   SQL GENERATION
   ============================================================ */

export function SQLGenerationCard({ visible = true, active = false, completed = false, className, index }: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.sqlGeneration;

  const sql = `SELECT employee_name,
       monthly_salary,
       paid_leave_entitlement,
       leave_taken
FROM employees
WHERE employee_name = 'Rahul Sharma'
LIMIT 1;`;

  const typed = useTypewriter(active && !completed, sql, 14);
  const displayed = completed ? sql : typed;

  return (
    <ProcessCard visible={visible} className={className} accent={accent}>
      <CardHeader
        icon={<Database className="h-3.5 w-3.5" />}
        title="SQL GENERATION"
        kicker="LLM"
        status={resolveStatus(active, completed)}
        index={index}
        accent={accent}
      />

      <div className="mt-2">
        <p className="mb-1.5 text-[10px] text-[#9AA1AF]">Actual SQL:</p>

        <div className="rounded-lg border border-[#23262c] bg-[#0D0F12] p-2.5">
          <pre className="whitespace-pre-wrap font-mono text-[9.5px] leading-[1.55] text-white/75">{displayed}</pre>
        </div>

        {!completed && active && displayed.length < sql.length ? (
          <span
            className="mt-1 inline-block h-3 w-[5px] bg-[#0D0F12]/70"
            style={{ animation: "querypilot-caret .9s step-end infinite" }}
          />
        ) : null}

        <div className="mt-2">
          <CheckRow show={completed} label="Query ready" />
        </div>
      </div>
    </ProcessCard>
  );
}

/* ============================================================
   DOCUMENT RETRIEVAL
   ============================================================ */

export function DocumentRetrievalCard({ visible = true, active = false, completed = false, className, index }: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.documentSearch;

  const sequenceStep = useStepSequence(active, 3, 360);
  const step = completed ? 3 : sequenceStep;

  return (
    <ProcessCard visible={visible} className={className} accent={accent}>
      <CardHeader
        icon={<FileSearch className="h-3.5 w-3.5" />}
        title="DOCUMENT SEARCH"
        kicker="HYBRID RETRIEVAL"
        status={resolveStatus(active, completed)}
        index={index}
        accent={accent}
      />

      <div className="mt-2 space-y-2">
        <p className="text-[11px] text-[#687184]">Searching salary rules...</p>

        <div className="relative overflow-hidden rounded-lg border border-[#E1E6F0] bg-[#F8FAFD] p-2.5">
          <ScanLine active={active && !completed} accent={accent} />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-[#3B404B]">Dense Search</span>
              <Check className={`h-3 w-3 ${step >= 1 ? "text-[#3FB984]" : "text-[#D8DBE1]"}`} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-[#3B404B]">BM25 Search</span>
              <Check className={`h-3 w-3 ${step >= 2 ? "text-[#3FB984]" : "text-[#D8DBE1]"}`} />
            </div>
          </div>
        </div>

        <RevealRow show={step >= 3}>
          <div className="rounded-lg border border-[#E1E6F0] bg-[#F8FAFD] px-2.5 py-2.5">
            <p className="text-[11px] font-medium text-[#111318]">salary.pdf</p>
            <p className="mt-1 text-[10px] text-[#9AA1AF]">Relevant rule found</p>
            <p className="mt-1 text-[10px] text-[#3B404B]">Leave within entitlement = no deduction</p>
          </div>
        </RevealRow>

        <CheckRow show={completed} label="Document evidence found" />
      </div>
    </ProcessCard>
  );
}

/* ============================================================
   GLOBAL CARD ANIMATIONS
   ============================================================ */

export function QueryPilotProcessCardStyles() {
  return (
    <style jsx global>{`
      @keyframes querypilot-scan-line {
        0% {
          transform: translateY(-36px);
          opacity: 0;
        }
        25% {
          opacity: 1;
        }
        100% {
          transform: translateY(120px);
          opacity: 0;
        }
      }

      @keyframes querypilot-progress {
        0% {
          transform: translateX(-130%);
        }
        100% {
          transform: translateX(420%);
        }
      }

      @keyframes querypilot-spinner {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes querypilot-caret {
        0%,
        49% {
          opacity: 1;
        }
        50%,
        100% {
          opacity: 0;
        }
      }

      @keyframes querypilot-card-settle {
        0% {
          opacity: 0;
          filter: blur(8px);
          transform: scale(0.94) translateY(10px);
        }
        100% {
          opacity: 1;
          filter: blur(0);
          transform: scale(1) translateY(0);
        }
      }

      .querypilot-card-settle {
        animation: querypilot-card-settle 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      @keyframes querypilot-dot-pulse {
        0%,
        100% {
          box-shadow: 0 0 0 6px var(--qp-dot-halo, rgba(125, 100, 255, 0.16));
        }
        50% {
          box-shadow: 0 0 0 10px var(--qp-dot-halo-soft, rgba(125, 100, 255, 0.06));
        }
      }
    `}</style>
  );
}