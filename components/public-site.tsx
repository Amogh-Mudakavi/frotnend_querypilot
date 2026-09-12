"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ComponentType, CSSProperties } from "react";
import { ArrowRight, Sparkles, UserSearch } from "lucide-react";
import gsap from "gsap";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";
import { QueryPilotApp } from "@/components/hero/query-pilot-app"
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
} from "@/components/hero/cards"
import type { ProcessCardStateProps } from "@/components/hero/cards"

// Prevent the browser from painting a previous scroll position during a hard reload.
// This runs as soon as the client module evaluates, before the first React layout pass.
if (typeof window !== "undefined") {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navigation?.type === "reload") {
    try {
      history.scrollRestoration = "manual";
    } catch {
      // Ignore browsers that do not expose scrollRestoration.
    }

    window.scrollTo(0, 0);
  }
}



/* ---------------------------------------------------------------------------
 * Local hero process-card implementation.
 *
 * This intentionally lives in public-site.tsx instead of importing the
 * process timeline from cards-2.tsx. The hero is the only consumer of this
 * choreography, so keeping the small orchestration layer here removes a
 * module-boundary failure mode where an outdated/stale cards-2 module could
 * make QueryPilotProcessCards resolve to undefined at runtime.
 * --------------------------------------------------------------------------- */

function HeroEmployeeEvidenceCard({
  visible = true,
  active = false,
  completed = false,
  className,
  index,
}: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.employeeEvidence;
  // BUGFIX: useStepSequence must be called unconditionally on every render of
  // this component instance. It was previously called only in the `!completed`
  // branch of a ternary — since every card in this sequence transitions from
  // active -> completed while mounted (same instance, same key), that
  // conditionally skipped the hook call and violated React's Rules of Hooks
  // ("Rendered fewer hooks than expected"). The hook is now always called; the
  // ternary only picks which *value* to show.
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

      <div className="mt-2.5 space-y-2.5">
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

function HeroAnswerGenerationCard({
  visible = true,
  active = false,
  completed = false,
  className,
  index,
}: ProcessCardStateProps) {
  const accent = STAGE_ACCENTS.answerGeneration;
  const values = [
    ["Monthly Salary", "₹60,000"],
    ["Leave Taken", "12 days"],
    ["Unpaid Leave", "0 days"],
    ["Salary Deduction", "₹0"],
  ];

  // BUGFIX: see HeroEmployeeEvidenceCard above — hook now called unconditionally.
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

      <div className="mt-2.5 space-y-2">
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
                `text-[10.5px] font-semibold ${
                  label === "Salary Deduction" ? "text-[#3FB984]" : "text-[#3B404B]"
                }`
              }
            >
              {value}
            </span>
          </div>
        ))}

        <CheckRow show={completed} label="Grounded answer ready" />
      </div>
    </ProcessCard>
  );
}

const HERO_STAGE_START_MS = 9000;
const HERO_STAGE_END_MS = 23000;

const HERO_CARD_SEQUENCE: ComponentType<ProcessCardStateProps>[] = [
  QueryUnderstandingCard,
  HeroEmployeeEvidenceCard,
  ExecutionPlanningCard,
  DocumentRetrievalCard,
  SQLGenerationCard,
  HeroAnswerGenerationCard,
];

const HERO_CARD_ACCENTS: string[] = [
  STAGE_ACCENTS.queryUnderstanding,
  STAGE_ACCENTS.employeeEvidence,
  STAGE_ACCENTS.executionPlanning,
  STAGE_ACCENTS.documentSearch,
  STAGE_ACCENTS.sqlGeneration,
  STAGE_ACCENTS.answerGeneration,
];

const HERO_CARD_OUT_PX = 18;
const HERO_CARD_LABEL_WIDTH = "clamp(190px, 16vw, 250px)";
const HERO_CARD_COLUMN_TOP = "-72px";
const HERO_CARD_GAP = 28;

function HeroProcessColumn({
  side,
  cards,
}: {
  side: "left" | "right";
  cards: {
    Card: ComponentType<ProcessCardStateProps>;
    index: number;
    active: boolean;
    accent: string;
  }[];
}) {
  const isRight = side === "right";
  const orderedCards = isRight ? [...cards].reverse() : cards;

  return (
    <div
      className="pointer-events-none absolute grid"
      style={{
        [isRight ? "left" : "right"]: `calc(100% + ${HERO_CARD_OUT_PX}px)`,
        top: HERO_CARD_COLUMN_TOP,
        width: HERO_CARD_LABEL_WIDTH,
        height: "calc(100% + 144px)",
        gridTemplateRows: "repeat(3, minmax(0, 1fr))",
        gap: HERO_CARD_GAP,
      }}
    >
      {orderedCards.map(({ Card, index, active, accent }, slot) => {
        const dotColor = active ? accent : "#3FB984";
        return (
          <div
            key={index}
            className="relative flex min-h-0 w-full items-center"
            style={{ gridRow: slot + 1 }}
          >
            <span
              aria-hidden="true"
              className="absolute h-[1.5px] transition-[background] duration-300"
              style={{
                [isRight ? "left" : "right"]: "100%",
                top: "50%",
                transform: "translateY(-50%)",
                width: `${HERO_CARD_OUT_PX}px`,
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
                  [isRight ? "left" : "right"]: -4,
                  top: "50%",
                  transform: `translate(${isRight ? "-50%" : "50%"}, -50%)`,
                  background: dotColor,
                  animation: active
                    ? "querypilot-dot-pulse 1.4s ease-in-out infinite"
                    : "none",
                  ["--qp-dot-halo" as any]: `${accent}29`,
                  ["--qp-dot-halo-soft" as any]: `${accent}0f`,
                } as CSSProperties
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
        );
      })}
    </div>
  );
}

function QueryPilotProcessCards({
  elapsed = 0,
  show = true,
}: {
  elapsed?: number;
  show?: boolean;
}) {
  if (!show || elapsed < HERO_STAGE_START_MS) return null;

  const stageIndex = Math.min(
    HERO_CARD_SEQUENCE.length - 1,
    Math.floor((elapsed - HERO_STAGE_START_MS) / ((HERO_STAGE_END_MS - HERO_STAGE_START_MS) / HERO_CARD_SEQUENCE.length)),
  );
  const isDemoFinished = elapsed >= HERO_STAGE_END_MS;

  const leftCards: {
    Card: ComponentType<ProcessCardStateProps>;
    index: number;
    active: boolean;
    accent: string;
  }[] = [];
  const rightCards: {
    Card: ComponentType<ProcessCardStateProps>;
    index: number;
    active: boolean;
    accent: string;
  }[] = [];

  HERO_CARD_SEQUENCE.slice(0, stageIndex + 1).forEach((Card, i) => {
    const active = !isDemoFinished && i === stageIndex;
    const entry = { Card, index: i, active, accent: HERO_CARD_ACCENTS[i] };
    if (i < 3) leftCards.push(entry);
    else rightCards.push(entry);
  });

  return (
    <>
      <QueryPilotProcessCardStyles />
      <div className="pointer-events-none absolute inset-0 z-[75] hidden overflow-visible min-[901px]:block">
        <HeroProcessColumn side="left" cards={leftCards} />
        <HeroProcessColumn side="right" cards={rightCards} />
      </div>
    </>
  );
}

const BUILDER_EMAIL = "amoghmudakavi@gmail.com";
const GITHUB_URL = "https://github.com/Amogh-Mudakavi/query-pilot";


const FEATURE_TUNING = {
  // LEFT BLACK COLUMN
  whyCopyFontSize: "15px",
  whyCopyLineHeight: "1.5",
  whyCopyMaxWidth: "390px",
  whyCopyMarginTop: "32px",
  whyCopyColor: "#ffffff",

  // RIGHT FEATURE PANELS
  featureTitleSize:
    "clamp(36px, 4.4vw, 62px)",

  featureDescriptionSize:
    "clamp(15px, 1.25vw, 18px)",

  featureDescriptionLineHeight:
    "1.55",

  featurePanelHeight:
    "clamp(560px, 70vh, 820px)",

  featureImageHeight:
    "clamp(265px, 38vh, 460px)",
};

export function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  const primaryLinks = [
    {
      href: "/engineering",
      label: "Engineering",
    },
    {
      href: "/technical-challenges",
      label: "Technical Challenges",
    },
    {
      href: "/how-it-works",
      label: "How It Works",
    },
  ];

  const closeMenu = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    const detectTheme = () => {
      const nav = document.querySelector(
        "[data-querypilot-nav]"
      ) as HTMLElement | null;

      if (!nav) {
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const sampleX =
        navRect.left + navRect.width / 2;
      const sampleY =
        navRect.bottom + 8;

      const element = document.elementFromPoint(
        sampleX,
        sampleY,
      ) as HTMLElement | null;

      if (window.scrollY < window.innerHeight * 0.92) {
        setDarkTheme(false);
        return;
      }

      if (!element) {
        return;
      }

      let current: HTMLElement | null =
        element;

      while (current) {
        const background =
          window.getComputedStyle(
            current,
          ).backgroundColor;

        if (
          background ===
            "rgb(0, 0, 0)" ||
          background ===
            "rgb(10, 10, 10)" ||
          background ===
            "rgb(17, 17, 17)"
        ) {
          setDarkTheme(true);
          return;
        }

        if (
          background ===
            "rgb(255, 255, 255)" ||
          background ===
            "rgb(250, 250, 250)" ||
          background ===
            "rgb(247, 247, 247)"
        ) {
          setDarkTheme(false);
          return;
        }

        current = current.parentElement;
      }

      setDarkTheme(false);
    };

    detectTheme();

    window.addEventListener(
      "scroll",
      detectTheme,
      { passive: true },
    );

    window.addEventListener(
      "resize",
      detectTheme,
    );

    return () => {
      window.removeEventListener(
        "scroll",
        detectTheme,
      );

      window.removeEventListener(
        "resize",
        detectTheme,
      );
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const textClass = darkTheme
    ? "text-white"
    : "text-black";

  const mutedTextClass = darkTheme
    ? "text-white/70 hover:text-white"
    : "text-black/55 hover:text-black";

  const mobileBorderClass = darkTheme
    ? "border-white/10"
    : "border-black/10";

  const mobileBackgroundClass = darkTheme
    ? "bg-[#0a0a0a]/96"
    : "bg-white/[0.96]";

  return (
    <header
      data-querypilot-nav
      className={`
        fixed
        inset-x-0
        top-3
        z-[60]
        w-full
        px-3
        sm:px-5
        transition-all
        duration-400
        ease-out
      `}
    >
      <nav
        aria-label="Main navigation"
        className={`
          mx-auto
          flex
          h-[76px]
          w-[calc(100%-12px)]
          max-w-[1600px]
          items-center
          justify-between
          rounded-[18px]
          border
          px-5
          backdrop-blur-xl
          transition-[background,border-color,box-shadow,color]
          duration-300
          sm:px-7
          ${
            darkTheme
              ? "border-white/10 bg-[#0a0a0a]/55 shadow-[0_10px_40px_rgba(0,0,0,0.18)]"
              : "border-white/60 bg-white/[0.46] shadow-[0_10px_40px_rgba(59,91,145,0.10)]"
          }
        `}
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="QueryPilot home"
          onClick={closeMenu}
          className={`
            inline-flex
            flex-none
            items-center
            gap-2.5
            whitespace-nowrap
            text-lg
            font-normal
            leading-none
            tracking-[-0.03em]
            ${textClass}
          `}
        >
          <img
            src="/querypilot-logo.svg"
            alt=""
            aria-hidden="true"
            className="h-6 w-6 flex-none object-contain"
          />

          <span>QueryPilot</span>
        </Link>

        {/* Main navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`
                text-sm
                font-normal
                leading-none
                tracking-[-0.01em]
                transition-colors
                duration-150
                ${mutedTextClass}
              `}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex h-full flex-none items-center gap-5">
          <Link
            href="/login"
            className={`
              hidden
              text-sm
              font-normal
              leading-none
              tracking-[-0.01em]
              transition-colors
              duration-150
              min-[901px]:inline-flex
              ${mutedTextClass}
            `}
          >
            Login
          </Link>

          <div className="hidden h-full items-center min-[901px]:flex">
            <PixelDissolveButton
              href="/signup"
              label="GET STARTED"
              color={darkTheme ? "#ffffff" : "#000000"}
              dissolveColor={
                darkTheme
                  ? "#b8b8b8"
                  : "#333333"
              }
              className={`
                !min-w-0
                !min-h-[40px]
                !rounded-[11px]
                !border-0
                !px-5
                !py-0
                !text-xs
                !font-medium
                !tracking-[0.01em]
                hover:!translate-y-0
                ${
                  darkTheme
                    ? "!bg-white !text-black"
                    : "!bg-black !text-white"
                }
              `}
            />
          </div>

          {/* Mobile login */}
          <Link
            href="/login"
            className={`
              text-xs
              font-medium
              transition-colors
              min-[901px]:hidden
              ${mutedTextClass}
            `}
          >
            Login
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() =>
              setMenuOpen((prev) => !prev)
            }
            aria-label={
              menuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            className="
              relative
              flex
              h-9
              w-9
              flex-none
              flex-col
              items-center
              justify-center
              gap-[5px]
              border-0
              bg-transparent
              p-0
              min-[901px]:hidden
            "
          >
            <span
              className={`
                h-0.5
                w-[20px]
                origin-center
                transition-transform
                duration-200
                ${
                  darkTheme
                    ? "bg-white"
                    : "bg-black"
                }
                ${
                  menuOpen
                    ? "translate-y-[6px] rotate-45"
                    : ""
                }
              `}
            />

            <span
              className={`
                h-0.5
                transition-all
                duration-200
                ${
                  darkTheme
                    ? "bg-white"
                    : "bg-black"
                }
                ${
                  menuOpen
                    ? "w-0 opacity-0"
                    : "w-[20px] opacity-100"
                }
              `}
            />

            <span
              className={`
                h-0.5
                w-[20px]
                origin-center
                transition-transform
                duration-200
                ${
                  darkTheme
                    ? "bg-white"
                    : "bg-black"
                }
                ${
                  menuOpen
                    ? "-translate-y-[6px] -rotate-45"
                    : ""
                }
              `}
            />
          </button>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div
        id="mobile-navigation"
        className={`
          mx-auto
          mt-2
          w-[calc(100%-12px)]
          max-w-[1600px]
          overflow-hidden
          rounded-[18px]
          border
          backdrop-blur-xl
          transition-all
          duration-300
          min-[901px]:hidden
          ${mobileBorderClass}
          ${mobileBackgroundClass}
          ${
            menuOpen
              ? "max-h-[500px] opacity-100"
              : "pointer-events-none max-h-0 opacity-0"
          }
        `}
      >
        <div className="px-5 py-2 pb-5">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className={`
                flex
                min-h-14
                items-center
                justify-between
                border-b
                px-1
                text-base
                tracking-[-0.02em]
                transition-colors
                ${mobileBorderClass}
                ${textClass}
              `}
            >
              <span>{link.label}</span>
              <span>→</span>
            </Link>
          ))}

          <PixelDissolveButton
            href="/signup"
            label="GET STARTED"
            color={darkTheme ? "#ffffff" : "#000000"}
            dissolveColor={
              darkTheme
                ? "#b8b8b8"
                : "#333333"
            }
            className={`
              !mt-4
              !min-h-[40px]
              !w-full
              !rounded-[11px]
              !border-0
              ${
                darkTheme
                  ? "!bg-white !text-black"
                  : "!bg-black !text-white"
              }
            `}
          />
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   ProductPreview / Hero
   ============================================================ */

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

const MAIN_WINDOW_ASPECT = 16 / 10;

const RESTING_MAX_WIDTH = 1600;
const RESTING_SIDE_GUTTER = 24;
const DEMO_WIDTH_VW = 74;
const DEMO_MIN_WIDTH = 900;
const DEMO_MAX_WIDTH = 1320;

const DEMO_DURATION_MS = 30000;

const DEMO_OPEN_START = 0.02;
const DEMO_RETURN_COMPLETE = 0.02;
const DEMO_RETURN_START = 0.74;
const CARD_DISMISS_START = 0.68;
const CARD_DISMISS_END = 0.82;

function StaticHeroHeading() {
  return (
    <h1
      className="mx-auto w-max max-w-[980px] text-balance text-[clamp(3.1rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.065em] text-[#111318]"
    >
      Welcome to agentic revenue.
    </h1>
  );
}

function ProductPreview() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const mainWindowRef = useRef<HTMLDivElement | null>(null);
  const processCardsRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    pointerX: 0,
    pointerY: 0,
    x: 0,
    y: 0,
  });

  const rafRef = useRef<number | null>(null);
  const smoothProgressRef = useRef(0);

  const demoPhaseRef = useRef<"resting" | "running" | "complete" | "returning">("resting");
  const demoPlayedRef = useRef(false);
  const visualProgressRef = useRef(0);
  const openTweenRef = useRef<gsap.core.Tween | null>(null);

  const userScrollIntentRef = useRef(false);

  const [demoStarted, setDemoStarted] = useState(false);
  const [demoElapsed, setDemoElapsed] = useState(0);

  useEffect(() => {
    if (!demoStarted) return;

    const started = performance.now();
    let raf = 0;

    const tick = () => {
      if (demoPhaseRef.current !== "running") return;

      const elapsed = Math.min(performance.now() - started, DEMO_DURATION_MS);
      setDemoElapsed(elapsed);

      if (elapsed >= DEMO_DURATION_MS) {
        demoPhaseRef.current = "complete";
        window.dispatchEvent(new Event("querypilot-demo-complete"));
        return;
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [demoStarted]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const heroCopy = heroCopyRef.current;
    const scene = sceneRef.current;
    const mainWindow = mainWindowRef.current;
    const processCards = processCardsRef.current;

    if (!section || !heroCopy || !scene || !mainWindow || !processCards) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const setDrag = () => {
      const { x, y } = dragStateRef.current;
      gsap.set(scene, { x, y });
    };

    const resetDrag = () => {
      dragStateRef.current.active = false;
      dragStateRef.current.pointerX = 0;
      dragStateRef.current.pointerY = 0;
      dragStateRef.current.x = 0;
      dragStateRef.current.y = 0;
      setDrag();
    };

    const getProgress = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(section.offsetHeight - window.innerHeight, 1);
      return clamp01(-rect.top / distance);
    };

    const getGeometry = () => {
      const restWidth = Math.min(
        Math.max(window.innerWidth - RESTING_SIDE_GUTTER * 2, 0),
        RESTING_MAX_WIDTH,
      );

      const demoWidth = Math.min(
        Math.max(window.innerWidth * (DEMO_WIDTH_VW / 100), DEMO_MIN_WIDTH),
        DEMO_MAX_WIDTH,
      );

      const finalHeightFromWidth = demoWidth / MAIN_WINDOW_ASPECT;
      const finalDemoHeight = Math.min(
        finalHeightFromWidth,
        window.innerHeight * 0.78,
      );

      const finalWidth = finalDemoHeight * MAIN_WINDOW_ASPECT < demoWidth
        ? finalDemoHeight * MAIN_WINDOW_ASPECT
        : demoWidth;

      return {
        restWidth,
        finalWidth,
        restTop: Math.max(290, window.innerHeight * 0.42),
        finalTop: Math.max(
          108,
          (window.innerHeight - finalDemoHeight) / 2,
        ),
      };
    };

    const render = (progress = smoothProgressRef.current) => {
      const p = clamp01(progress);
      const {
        restWidth,
        finalWidth,
        restTop,
        finalTop,
      } = getGeometry();
      const phase = demoPhaseRef.current;

      const visual =
        phase === "returning" ||
        phase === "complete" ||
        phase === "running"
          ? visualProgressRef.current
          : 0;

      const widthVisual = lerp(restWidth, finalWidth, visual);
      const heightVisual = widthVisual / MAIN_WINDOW_ASPECT;
      const topVisual = lerp(restTop, finalTop, visual);

      gsap.set(mainWindow, {
        left: "50%",
        top: topVisual,
        xPercent: -50,
        yPercent: 0,
        width: widthVisual,
        height: heightVisual,
        scale: 1,
        transformOrigin: "50% 50%",
        visibility: "visible",
        force3D: true,
      });

      const copyReveal =
        phase === "resting"
          ? 1
          : phase === "returning"
            ? smoothstep(
                clamp01(
                  (DEMO_RETURN_START * 0.5 - p) /
                    (DEMO_RETURN_START * 0.5 - DEMO_RETURN_COMPLETE),
                ),
              )
            : 0;

      gsap.set(heroCopy, {
        opacity: copyReveal,
        y: -28 * (1 - copyReveal),
        scale: lerp(0.985, 1, copyReveal),
        filter: `blur(${lerp(2.5, 0, copyReveal)}px)`,
        force3D: true,
      });

      const cardsInDemoPhase =
        demoPhaseRef.current === "running" ||
        demoPhaseRef.current === "complete" ||
        demoPhaseRef.current === "returning";

      const cardVisibility = !demoPlayedRef.current || !cardsInDemoPhase
        ? 0
        : p <= CARD_DISMISS_START
          ? 1
          : p >= CARD_DISMISS_END
            ? 0
            : 1 -
              smoothstep(
                clamp01(
                  (p - CARD_DISMISS_START) /
                    (CARD_DISMISS_END - CARD_DISMISS_START),
                ),
              );

      // BUGFIX: opacity alone is what the spec calls "merely low opacity while
      // still visible." Toggling visibility as well guarantees the cards are
      // truly inert (no residual paint, no hit-testing ambiguity) at the two
      // ends of the fade rather than only reaching opacity: 0 asymptotically.
      gsap.set(processCards, {
        opacity: cardVisibility,
        visibility: cardVisibility > 0.001 ? "visible" : "hidden",
        scale: lerp(0.985, 1, cardVisibility),
        y: lerp(-8, 0, cardVisibility),
        filter: `blur(${lerp(1.5, 0, cardVisibility)}px)`,
        transformOrigin: "50% 50%",
        force3D: true,
      });

      if (p <= DEMO_RETURN_COMPLETE && demoPlayedRef.current) {
        if (demoPhaseRef.current !== "resting") {
          demoPhaseRef.current = "resting";
          visualProgressRef.current = 0;
          setDemoStarted(false);
          window.dispatchEvent(new Event("querypilot-demo-reset"));
        }
      }

      if (!dragStateRef.current.active) {
        setDrag();
      }
    };

    const tweenVisual = (
      to: number,
      duration: number,
      onComplete?: () => void,
    ) => {
      const proxy = { value: visualProgressRef.current };

      gsap.killTweensOf(proxy);
      return gsap.to(proxy, {
        value: to,
        duration,
        ease: to > visualProgressRef.current
          ? "power3.out"
          : "power3.inOut",
        overwrite: true,
        onUpdate: () => {
          visualProgressRef.current = proxy.value;
          render();
        },
        onComplete: () => {
          visualProgressRef.current = to;
          render();
          onComplete?.();
        },
      });
    };

    const beginDemo = () => {
      if (demoPhaseRef.current !== "resting") return;

      const firstRun = !demoPlayedRef.current;
      demoPlayedRef.current = true;
      demoPhaseRef.current = firstRun ? "running" : "complete";
      visualProgressRef.current = 0;

      if (firstRun) {
        setDemoStarted(true);
        setDemoElapsed(0);
      } else {
        setDemoStarted(false);
        setDemoElapsed(DEMO_DURATION_MS);
      }

      window.dispatchEvent(new Event("querypilot-demo-start"));

      if (reduceMotion) {
        visualProgressRef.current = 1;
        render();
        return;
      }

      openTweenRef.current?.kill();
      openTweenRef.current = tweenVisual(1, 1.05);
    };

    const beginReturnToRest = () => {
      if (!demoPlayedRef.current) return;
      if (demoPhaseRef.current === "resting") return;

      openTweenRef.current?.kill();
      demoPhaseRef.current = "returning";
      setDemoStarted(false);
    };

    const onScroll = () => {
      const p = getProgress();
      const previous = smoothProgressRef.current;
      const delta = p - previous;
      const isMovingUp = delta < -0.0015;
      const isMovingDown = delta > 0.0015;

      if (
        isMovingDown &&
        p >= DEMO_OPEN_START &&
        demoPhaseRef.current === "resting" &&
        userScrollIntentRef.current
      ) {
        beginDemo();
      }

      if (
        isMovingDown &&
        demoPlayedRef.current &&
        demoPhaseRef.current === "returning" &&
        p > DEMO_RETURN_COMPLETE
      ) {
        demoPhaseRef.current = "complete";
        tweenVisual(1, 0.7);
      }

      if (
        isMovingUp &&
        demoPlayedRef.current &&
        p < DEMO_RETURN_START
      ) {
        beginReturnToRest();
        const reverseProgress = smoothstep(
          clamp01(
            (p - DEMO_RETURN_COMPLETE) /
              (DEMO_RETURN_START - DEMO_RETURN_COMPLETE),
          ),
        );
        visualProgressRef.current = reverseProgress;
      }

      smoothProgressRef.current = p;

      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        render(smoothProgressRef.current);
      });
    };

    const armUserScrollIntent = () => {
      userScrollIntentRef.current = true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === " " ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        armUserScrollIntent();
      }
    };

    const onResize = () => {
      resetDrag();
      render(getProgress());
    };

    visualProgressRef.current = 0;
    smoothProgressRef.current = getProgress();
    render(smoothProgressRef.current);

    window.addEventListener("wheel", armUserScrollIntent, { passive: true });
    window.addEventListener("touchstart", armUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", armUserScrollIntent, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("wheel", armUserScrollIntent);
      window.removeEventListener("touchstart", armUserScrollIntent);
      window.removeEventListener("touchmove", armUserScrollIntent);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      openTweenRef.current?.kill();
      gsap.killTweensOf([
        heroCopy,
        mainWindow,
        scene,
        processCards,
      ]);
    };
  }, []);

  const canDrag = () => {
    const section = sectionRef.current;
    if (!section) return false;
    const distance = Math.max(section.offsetHeight - window.innerHeight, 1);
    return clamp01(-section.getBoundingClientRect().top / distance) >= 0.90;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canDrag()) return;

    const drag = dragStateRef.current;
    drag.active = true;
    drag.pointerX = event.clientX;
    drag.pointerY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active) return;

    const maxX = Math.min(window.innerWidth * 0.11, 170);
    const maxY = Math.min(window.innerHeight * 0.075, 72);

    drag.x = Math.max(
      -maxX,
      Math.min(maxX, event.clientX - drag.pointerX),
    );
    drag.y = Math.max(
      -maxY,
      Math.min(maxY, event.clientY - drag.pointerY),
    );

    if (sceneRef.current) {
      gsap.set(sceneRef.current, { x: drag.x, y: drag.y });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative hidden h-[220vh] w-full bg-white min-[901px]:block"
      aria-label="QueryPilot hero"
    >
      <div className="sticky top-0 h-screen overflow-visible">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url("/cloud.png")' }}
        />
        <div className="relative mx-auto h-full w-full max-w-[1600px] px-5 sm:px-8 lg:px-10">
          <div
            ref={heroCopyRef}
            className="hero-copy absolute inset-x-0 top-[calc(3.5vh+96px)] z-[80] flex w-full justify-center px-5 text-center sm:px-8 will-change-[transform,opacity]"
          >
            <div className="w-full max-w-[980px]">
              <a
                href="#learn"
                className="inline-flex items-center gap-2 rounded-full border border-[#d9dce3] px-3.5 py-2 text-[13px] font-medium text-[#20242b] shadow-sm transition-colors hover:bg-[#f5f6f8]"
              >
                GTM lessons from Elena Verna and more
                <ArrowRight size={13} />
              </a>

              <div className="mx-auto mt-6 flex justify-center overflow-visible">
                <StaticHeroHeading />
              </div>

              <p className="mx-auto mt-5 max-w-[440px] text-pretty text-[17px] leading-6 text-[#687184]">
                QueryPilot is the AI retrieval system that builds grounded answers from your connected data.
              </p>

              <div className="mt-5 flex items-center justify-center gap-2.5">
                <a
                  href="#sales"
                  className="rounded-xl border border-[#d9dce3] px-4 py-2.5 text-sm font-medium text-[#20242b] hover:bg-[#f5f6f8]"
                >
                  Talk to sales
                </a>
                <PixelDissolveButton
                  label="Start for free"
                  href="/signup"
                  color="#20242b"
                  dissolveColor="#a8b4ff"
                  cellSize={5}
                  className="min-h-10 rounded-xl px-4 text-sm normal-case tracking-normal"
                />
              </div>
            </div>
          </div>

          <div
            ref={sceneRef}
            className="absolute inset-0 z-10 overflow-visible will-change-transform"
          >
            <div
              ref={mainWindowRef}
              className="invisible absolute left-1/2 top-[42vh] z-[50] aspect-[16/10] w-[min(calc(100% - 48px),1600px)] -translate-x-1/2 will-change-[width,height,top,opacity]"
            >
              <div className="querypilot-resting-entry h-full w-full">
                <div className="relative h-full w-full overflow-visible rounded-[18px] border border-[#23262c] bg-[#0D0F12] shadow-[0_30px_100px_rgba(0,0,0,0.24)]">
                  <QueryPilotApp elapsed={demoElapsed} />
                </div>

                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 z-[70] h-10 cursor-grab touch-none active:cursor-grabbing"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />

                <div
                  ref={processCardsRef}
                  className="absolute inset-0 z-[60] pointer-events-none will-change-[transform,opacity]"
                >
                  <QueryPilotProcessCards
                    elapsed={demoElapsed}
                    show
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .querypilot-resting-entry {
          opacity: 1;
          transform: none;
          transform-origin: 50% 50%;
          will-change: auto;
        }
      `}</style>
    </section>
  );
}


function HeroMobile() {
  const [demoStarted, setDemoStarted] = useState(false);
  const [demoElapsed, setDemoElapsed] = useState(0);

  useEffect(() => {
    if (demoStarted) return;

    const onFirstScroll = () => setDemoStarted(true);
    window.addEventListener("scroll", onFirstScroll, {
      once: true,
      passive: true,
    });

    return () =>
      window.removeEventListener("scroll", onFirstScroll);
  }, [demoStarted]);

  useEffect(() => {
    if (!demoStarted) return;

    const started = performance.now();
    const duration = 30000;

    const timer = window.setInterval(() => {
      const elapsed = Math.min(
        performance.now() - started,
        duration,
      );
      setDemoElapsed(elapsed);

      if (elapsed >= duration) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [demoStarted]);

  return (
    <section className="relative w-full overflow-hidden bg-white px-5 pb-16 pt-24 min-[901px]:hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/cloud.png")' }}
      />
      <div className="relative z-10 mx-auto max-w-[680px] text-center">
        <h1
          className="mx-auto max-w-[660px] text-[clamp(38px,10vw,62px)] font-medium leading-[0.93] tracking-[-0.055em] text-[#111318]"
          style={{
            fontFamily: '"ALTMistral", sans-serif',
            fontWeight: 500,
            fontKerning: "none",
          }}
        >
          Don&apos;t just search your data.
          <span className="block">Understand it.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-[440px] text-[16px] leading-6 text-[#687184]">
          QueryPilot is the AI retrieval system built to understand, query, and ground knowledge across your data.
        </p>

        <div className="relative mt-10 aspect-[4/3] w-full overflow-hidden rounded-[16px] border border-[#dfe2e8] bg-[#f3f4f6] shadow-[0_24px_70px_rgba(84,92,140,0.12)] sm:aspect-video">
          <QueryPilotApp elapsed={demoElapsed} />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   TECHNICAL FEATURES
   ============================================================ */

type TechnicalFeature = {
  title: string;
  description: string;
  image: string;
};

const technicalFeatures: TechnicalFeature[] =
  [
    {
      title:
        "Adaptive Query Planning",

      description:
        "QueryPilot interprets a question and dynamically decides whether to search documents, query structured data, use conversation context, or combine multiple paths before producing an answer.",

      image:
        "/adaptive.png",
    },

    {
      title:
        "Persistent Conversation Infrastructure",

      description:
        "QueryPilot persists conversations and messages at the workspace level, maintaining bounded context so follow-up questions can reliably build on earlier interactions.",

      image:
        "/conversation.png",
    },

    {
      title:
        "Secure Structured Querying",

      description:
        "Natural-language questions are converted into SQL while execution remains read-only, workspace-scoped, parameterized, and protected by table restrictions, timeouts, and row limits.",

      image:
        "/sql_generation.png",
    },

    {
      title:
        "Real-Time Answer Streaming",

      description:
        "Responses stream progressively as QueryPilot works, exposing useful answer content immediately instead of making you wait for the entire generation to finish.",

      image:
        "/streaming.png",
    },

    {
      title:
        "Asynchronous Document Processing",

      description:
        "Uploaded Document moves through background processing, extraction, indexing, and preparation so long-running work stays separate from the user-facing request path.",

      image:
        "/document_processing.png",
    },

    {
      title:
        "Workspace-Isolated Data Architecture",

      description:
        "Documents, conversations, retrieval, structured tables, and query execution remain isolated to their workspace, preventing data from crossing workspace boundaries.",

      image:
        "/workspace_isolation.png",
    },
  ];

/* ============================================================
   TechnicalFeaturePanel
   ============================================================ */

function TechnicalFeaturePanel({
  feature,
}: {
  feature: TechnicalFeature;
}) {
  const sectionRef =
    useRef<HTMLElement | null>(
      null,
    );

  const backgroundRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const gridRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const greenGlowRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const titleRef =
    useRef<HTMLHeadingElement | null>(
      null,
    );

  const descriptionRef =
    useRef<HTMLParagraphElement | null>(
      null,
    );

  const imageShellRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const imageRef =
    useRef<HTMLImageElement | null>(
      null,
    );

  const hasAnimated =
    useRef(false);

  useEffect(() => {
    const section =
      sectionRef.current;

    if (!section) {
      return;
    }

    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    if (reduceMotion) {
      gsap.set(
        titleRef.current,
        {
          clearProps: "all",
        },
      );

      gsap.set(
        descriptionRef.current,
        {
          clearProps: "all",
        },
      );

      gsap.set(
        imageShellRef.current,
        {
          clearProps: "all",
        },
      );

      gsap.set(
        imageRef.current,
        {
          clearProps: "all",
        },
      );

      gsap.set(
        backgroundRef.current,
        {
          clearProps: "all",
        },
      );

      gsap.set(
        gridRef.current,
        {
          clearProps: "all",
        },
      );

      gsap.set(
        greenGlowRef.current,
        {
          clearProps: "all",
        },
      );

      return;
    }

    const ctx = gsap.context(
      () => {
        gsap.set(
          titleRef.current,
          {
            opacity: 0,
            y: 36,
            filter: "blur(9px)",
          },
        );

        gsap.set(
          descriptionRef.current,
          {
            opacity: 0,
            y: 30,
            filter: "blur(8px)",
          },
        );

        gsap.set(
          imageShellRef.current,
          {
            opacity: 0,
            y: 60,
            scale: 0.95,
            filter: "blur(9px)",
          },
        );

        gsap.set(
          imageRef.current,
          {
            scale: 1.04,
          },
        );

        gsap.set(
          backgroundRef.current,
          {
            scale: 1.05,
          },
        );

        gsap.set(
          gridRef.current,
          {
            opacity: 0,
          },
        );

        gsap.set(
          greenGlowRef.current,
          {
            opacity: 0,
            scale: 0.82,
            x: 24,
            y: 16,
          },
        );
      },
      section,
    );

    const observer =
      new IntersectionObserver(
        (entries) => {
          const entry =
            entries[0];

          if (
            !entry?.isIntersecting ||
            hasAnimated.current
          ) {
            return;
          }

          hasAnimated.current =
            true;

          const timeline =
            gsap.timeline();

          timeline.to(
            backgroundRef.current,
            {
              scale: 1,
              opacity: 1,
              duration: 1.45,
              ease: "power2.out",
            },
            0,
          );

          timeline.to(
            gridRef.current,
            {
              opacity: 1,
              duration: 1.0,
              ease: "power2.out",
            },
            0,
          );

          timeline.to(
            greenGlowRef.current,
            {
              opacity: 0.95,
              scale: 1,
              x: 0,
              y: 0,
              duration: 1.25,
              ease: "power3.out",
            },
            0.02,
          );

          timeline.to(
            titleRef.current,
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.95,
              ease: "power4.out",
            },
            0.10,
          );

          timeline.to(
            descriptionRef.current,
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
            },
            0.24,
          );

          timeline.to(
            imageShellRef.current,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 1.05,
              ease: "power4.out",
            },
            0.36,
          );

          timeline.to(
            imageRef.current,
            {
              scale: 1,
              duration: 1.2,
              ease: "power3.out",
            },
            0.36,
          );

          observer.disconnect();
        },
        {
          threshold: 0.12,
          rootMargin:
            "0px 0px -5% 0px",
        },
      );

    observer.observe(
      section,
    );

    return () => {
      observer.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <article
      ref={sectionRef}
      className="technical-feature-panel relative isolate flex flex-col overflow-hidden border-b border-black/10 last:border-b-0"
      style={{
        minHeight:
          FEATURE_TUNING.featurePanelHeight,
      }}
    >
      <div
        ref={backgroundRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30 bg-cover bg-center"
        style={{
          backgroundImage:
            'url("/hh.avif")',
          opacity: 0.82,
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-white/54"
      />

      <div
        ref={gridRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            linear-gradient(
              to right,
              rgba(0,0,0,0.034) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(0,0,0,0.034) 1px,
              transparent 1px
            ),
            radial-gradient(
              circle at 74% 62%,
              rgba(0,125,81,0.17),
              transparent 27%
            ),
            radial-gradient(
              circle at 30% 18%,
              rgba(255,255,255,0.82),
              transparent 31%
            )
          `,
          backgroundSize:
            "44px 44px, 44px 44px, auto, auto",
          mixBlendMode:
            "multiply",
        }}
      />

      <div
        ref={greenGlowRef}
        aria-hidden="true"
        className="technical-green-glow pointer-events-none absolute -z-10"
      />

      <div
        aria-hidden="true"
        className="technical-green-orbit pointer-events-none absolute -z-10"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.16)_42%,rgba(255,255,255,0.06)_70%,rgba(255,255,255,0.58)_100%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-6 pb-5 pt-9 min-[901px]:px-12 min-[901px]:pb-6 min-[901px]:pt-10">
        <div className="shrink-0 max-w-[850px]">
          <h3
            ref={titleRef}
            className="max-w-[780px] font-light tracking-[-0.058em] text-black"
            style={{
              fontSize:
                FEATURE_TUNING.featureTitleSize,
              lineHeight: 0.94,
            }}
          >
            {feature.title}
          </h3>

          <p
            ref={descriptionRef}
            className="mt-4 max-w-[650px] text-black/62 min-[901px]:mt-5"
            style={{
              fontSize:
                FEATURE_TUNING.featureDescriptionSize,
              lineHeight:
                FEATURE_TUNING.featureDescriptionLineHeight,
            }}
          >
            {feature.description}
          </p>
        </div>

        <div className="relative mt-6 flex flex-1 items-start justify-center min-[901px]:mt-7">
          <div
            ref={imageShellRef}
            className="technical-feature-image relative flex w-full max-w-[900px] items-center justify-center overflow-hidden rounded-[24px] border border-black/[0.07] bg-white/[0.12] shadow-[0_24px_65px_rgba(0,0,0,0.07)] backdrop-blur-[2px]"
            style={{
              height:
                FEATURE_TUNING.featureImageHeight,
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#007D51]/[0.075] blur-[70px]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-5 right-5 top-4 h-px bg-black/[0.08]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[-20px] left-1/2 h-28 w-[72%] -translate-x-1/2 rounded-full bg-[#007D51]/[0.035] blur-3xl"
            />

            <img
              ref={imageRef}
              src={feature.image}
              alt={feature.title}
              loading={
                feature.image ===
                "/adaptive.png"
                  ? "eager"
                  : "lazy"
              }
              decoding="async"
              draggable={false}
              className="relative z-10 block h-auto w-[94%] max-w-[860px] object-contain object-center mix-blend-multiply"
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .technical-feature-image {
          transition:
            border-color 400ms ease,
            box-shadow 500ms ease,
            background 500ms ease;
        }

        .technical-feature-panel:hover
          .technical-feature-image {
          border-color: rgba(
            0,
            125,
            81,
            0.14
          );

          box-shadow:
            0 30px 78px rgba(
              0,
              0,
              0,
              0.09
            ),
            0 0 0 1px rgba(
              0,
              125,
              81,
              0.04
            );
        }

        .technical-green-glow {
          left: 58%;
          top: 34%;
          width: 420px;
          height: 420px;

          border-radius: 999px;

          background:
            radial-gradient(
              circle,
              rgba(
                0,
                125,
                81,
                0.20
              )
              0%,
              rgba(
                0,
                125,
                81,
                0.11
              )
              26%,
              rgba(
                0,
                125,
                81,
                0.04
              )
              48%,
              transparent
              72%
            );

          filter: blur(32px);

          transform: translate3d(
            -50%,
            -50%,
            0
          );

          animation:
            technical-green-breathe
            6s
            ease-in-out
            infinite;
        }

        .technical-green-orbit {
          left: 18%;
          bottom: 4%;
          width: 300px;
          height: 180px;

          border-radius: 999px;

          background:
            radial-gradient(
              ellipse,
              rgba(
                0,
                125,
                81,
                0.085
              )
              0%,
              rgba(
                0,
                125,
                81,
                0.035
              )
              44%,
              transparent
              74%
            );

          filter: blur(42px);

          animation:
            technical-green-drift
            9s
            ease-in-out
            infinite;
        }

        @keyframes technical-green-breathe {
          0%,
          100% {
            opacity: 0.55;
            transform:
              translate3d(
                -50%,
                -50%,
                0
              )
              scale(0.92);
          }

          50% {
            opacity: 1;
            transform:
              translate3d(
                -46%,
                -52%,
                0
              )
              scale(1.08);
          }
        }

        @keyframes technical-green-drift {
          0%,
          100% {
            opacity: 0.45;
            transform:
              translate3d(
                0,
                0,
                0
              )
              scale(0.94);
          }

          50% {
            opacity: 0.82;
            transform:
              translate3d(
                38px,
                -18px,
                0
              )
              scale(1.08);
          }
        }

        @media (max-width: 900px) {
          .technical-feature-panel {
            min-height: auto !important;
          }

          .technical-feature-image {
            height: 280px !important;
          }

          .technical-green-glow {
            left: 54%;
            top: 44%;
            width: 280px;
            height: 280px;
          }

          .technical-green-orbit {
            left: 5%;
            bottom: 2%;
            width: 210px;
            height: 140px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .technical-green-glow,
          .technical-green-orbit {
            animation: none;
          }

          .technical-feature-image {
            transition: none;
          }
        }
      `}</style>
    </article>
  );
}

/* ============================================================
   TechnicalSplitSection
   ============================================================ */

function TechnicalSplitSection() {
  return (
    <section id="technical-features" className="w-full bg-black">
      <div className="mx-auto grid w-[calc(100%-40px)] max-w-[1600px] max-[768px]:w-[calc(100%-28px)] min-[901px]:grid-cols-[42%_58%]">
        <aside className="bg-black min-[901px]:sticky min-[901px]:top-0 min-[901px]:h-screen">
          <div className="flex h-full flex-col justify-center px-6 py-16 min-[901px]:py-0 min-[901px]:pl-2 min-[901px]:pr-12">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#007D51]">
              Why QueryPilot
            </span>

            <h2 className="mt-6 text-[clamp(32px,4.2vw,58px)] font-light leading-[0.96] tracking-[-0.05em] text-white">
              Not
              <br />
              another
              <br />
              document
              <br />
              chatbot.
            </h2>

            <p
              className="text-white"
              style={{
                marginTop:
                  FEATURE_TUNING.whyCopyMarginTop,
                maxWidth:
                  FEATURE_TUNING.whyCopyMaxWidth,
                fontSize:
                  FEATURE_TUNING.whyCopyFontSize,
                lineHeight:
                  FEATURE_TUNING.whyCopyLineHeight,
                color:
                  FEATURE_TUNING.whyCopyColor,
              }}
            >
              QueryPilot is built to work across
              structured and unstructured data,
              resolve entities the way a database
              would, and keep every answer tied
              to the evidence behind it.
            </p>
          </div>
        </aside>

        <div className="overflow-hidden bg-white">
          {technicalFeatures.map(
            (feature) => (
              <TechnicalFeaturePanel
                key={feature.title}
                feature={feature}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   BuilderClosingSection
   ============================================================ */

function BuilderClosingSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const statementCopyRef = useRef<HTMLDivElement | null>(null);
  const statementSideRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  const cards = [
    {
      label: "HOW IT'S BUILT",
      title: "From architecture to deployment.",
      copy:
        "Read how QueryPilot is put together — backend services, retrieval, grounding, structured querying, streaming, and deployment.",
      href: "/engineering",
      button: "VIEW ENGINEERING",
    },
    {
      label: "TECHNICAL CHALLENGES",
      title: "The hard problems behind it.",
      copy:
        "Read through the constraints, trade-offs, failures, and engineering decisions that shaped the system.",
      href: "/technical-challenges",
      button: "READ THE CHALLENGES",
    },
    {
      label: "GITHUB",
      title: "The code is open.",
      copy:
        "Explore the implementation, architecture, issues, and source behind QueryPilot.",
      href: GITHUB_URL,
      button: "VIEW ON GITHUB",
    },
    {
      label: "CONTACT",
      title: "Talk directly with the builder.",
      copy:
        "Have a question about the system, an implementation detail, or an engineering decision? Reach out directly.",
      href: `mailto:${BUILDER_EMAIL}`,
      button: "CONTACT THE BUILDER",
    },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    const statementCopy = statementCopyRef.current;
    const statementSide = statementSideRef.current;
    const cardsEl = cardsRef.current;

    if (!section || !statementCopy || !statementSide || !cardsEl) {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 900px)").matches;

    if (isMobile) {
      gsap.set(
        [statementCopy, statementSide, cardsEl.children],
        {
          clearProps: "all",
        },
      );
      return;
    }

    const cards = Array.from(cardsEl.children);

    gsap.set(statementCopy, {
      opacity: 0,
      y: 46,
      filter: "blur(10px)",
    });

    gsap.set(statementSide, {
      opacity: 0,
      y: 34,
      filter: "blur(9px)",
    });

    gsap.set(cards, {
      opacity: 0,
      y: 52,
      scale: 0.985,
      filter: "blur(8px)",
    });

    let statementPlayed = false;
    let cardsPlayed = false;

    const statementObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting || statementPlayed) {
          return;
        }

        statementPlayed = true;

        const timeline = gsap.timeline();

        timeline.to(
          statementCopy,
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 1.0,
            ease: "power4.out",
          },
          0.05,
        );

        timeline.to(
          statementSide,
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power3.out",
          },
          0.25,
        );

        statementObserver.disconnect();
      },
      {
        threshold: 0.34,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    const cardsObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting || cardsPlayed) {
          return;
        }

        cardsPlayed = true;

        gsap.to(cards, {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.76,
          ease: "power3.out",
          stagger: 0.18,
        });

        cardsObserver.disconnect();
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    statementObserver.observe(section);
    cardsObserver.observe(cardsEl);

    return () => {
      statementObserver.disconnect();
      cardsObserver.disconnect();
      gsap.killTweensOf([
        statementCopy,
        statementSide,
        cards,
      ]);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="builder-closing-section w-full overflow-hidden bg-black text-white"
    >
      <div className="builder-closing-inner mx-auto w-[calc(100%-12px)] max-w-[1600px]">
        <div className="builder-statement relative min-h-[610px] overflow-hidden border-x border-b border-white/10">
          <img
            src="/querypilot-builder-field.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-[67%] max-w-none object-cover object-right"
          />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#000_0%,#000_38%,rgba(0,0,0,0.94)_52%,rgba(0,0,0,0.16)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(0,125,81,0.06),transparent_34%)]" />

          <div className="relative z-10 grid min-h-[610px] grid-cols-[58%_42%] items-center">
            <div
              ref={statementCopyRef}
              className="px-[clamp(24px,3.2vw,54px)] py-24"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#007D51]">
                Built in the open
              </span>

              <h2 className="mt-6 max-w-[760px] text-[clamp(32px,4.2vw,58px)] font-light leading-[0.96] tracking-[-0.05em] text-white">
                For builders.
                <br />
                For senior engineers.
                <br />
                For people who want to know
                <br />
                how it works.
              </h2>
            </div>

            <div
              ref={statementSideRef}
              className="relative z-10 flex h-full items-center px-[clamp(24px,3.5vw,56px)] py-24"
            >
              <div className="max-w-[410px]">
                <p className="text-[clamp(20px,1.7vw,28px)] font-light leading-[1.25] tracking-[-0.03em] text-white/92">
                  QueryPilot is built in the open, with the architecture,
                  engineering decisions, and trade-offs available to inspect.
                </p>

                <div className="mt-7 h-px w-9 bg-[#007D51]" />

                <p className="mt-7 max-w-[330px] text-[11px] font-medium uppercase leading-[1.9] tracking-[0.19em] text-white/55">
                  Read the engineering notes from first decision to final
                  implementation.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={cardsRef}
          className="builder-card-grid grid border-x border-b border-black/10 bg-white min-[901px]:grid-cols-4"
        >
          {cards.map((card) => (
            <article
              key={card.label}
              className="builder-card group relative flex min-h-[390px] flex-col justify-between border-black/10 bg-white p-[clamp(24px,2.5vw,40px)] transition-colors duration-300 hover:bg-[#fbfffd]"
            >
              <div>
                <span className="text-[10px] font-medium uppercase tracking-[0.19em] text-[#007D51]">
                  {card.label}
                </span>

                <h3 className="mt-10 max-w-[330px] text-[clamp(24px,2vw,32px)] font-light leading-[1.04] tracking-[-0.04em] text-black">
                  {card.title}
                </h3>

                <p className="mt-5 max-w-[330px] text-sm leading-6 text-neutral-500 transition-colors duration-300 group-hover:text-neutral-700">
                  {card.copy}
                </p>
              </div>

              <div className="mt-10 bg-black p-px">
                <PixelDissolveButton
                  href={card.href}
                  label={card.button}
                  color="#ffffff"
                  dissolveColor="#b8f8b8"
                  className="builder-pixel-button !min-h-[54px] !w-full !min-w-0 !rounded-none !border-0 !bg-white !py-0 !pl-5 !pr-4 !text-left !text-[11px] !font-medium !tracking-[0.015em] !text-black hover:!translate-y-0"
                />
              </div>
            </article>
          ))}
        </div>

      </div>

      <style jsx>{`
        .builder-card + .builder-card {
          border-left: 1px solid rgba(0, 0, 0, 0.1);
        }

        .builder-pixel-button {
          box-shadow: none !important;
          transition:
            background-color 220ms ease,
            box-shadow 220ms ease,
            color 220ms ease,
            border-color 220ms ease;
        }

        .builder-card:hover .builder-pixel-button {
          background: #effff6 !important;
          border-color: #0c3f2c !important;
          box-shadow:
            0 0 0 1px rgba(0, 125, 81, 0.08),
            0 8px 24px rgba(0, 125, 81, 0.06);
          color: #063c29 !important;
        }

        @media (max-width: 900px) {
          .builder-closing-inner {
            width: calc(100% - 28px);
          }

          .builder-statement {
            min-height: 700px;
          }

          .builder-statement > img {
            width: 100%;
            height: 56%;
            top: auto;
            bottom: 0;
            object-position: right bottom;
            opacity: 0.72;
          }

          .builder-statement > .relative.z-10 {
            display: block;
            min-height: 700px;
          }

          .builder-statement > .relative.z-10 > div:first-child {
            padding-bottom: 0;
          }

          .builder-statement > .relative.z-10 > div:last-child {
            min-height: 0;
            padding-top: 0;
            padding-bottom: 64px;
          }

          .builder-card-grid {
            grid-template-columns: 1fr;
          }

          .builder-card + .builder-card {
            border-left: 0;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
          }

          .builder-card:first-child {
            border-top: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .builder-pixel-button {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   LandingPage
   ============================================================ */

export function LandingPage() {
  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const isReload = navigation?.type === "reload";

    if (!isReload) return;

    const previousScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const forceTop = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    };

    forceTop();
    const frame = window.requestAnimationFrame(() => {
      forceTop();
      window.requestAnimationFrame(forceTop);
    });
    const delayed = window.setTimeout(() => {
      forceTop();
    }, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
      history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        html,
        body {
          background-color: #ffffff;
          overscroll-behavior-y: none;
          height: 100%;
        }
      `}</style>

      <PublicNav />

      <main>
        <ProductPreview />
        <HeroMobile />
        <TechnicalSplitSection />
        <BuilderClosingSection />
      </main>
    </div>
  );
}

/* ============================================================
   Engineering Page
   ============================================================ */

function Logo({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 ${
        dark ? "text-white" : ""
      }`}
    >
      <img
        src="/querypilot-logo.svg"
        alt=""
        aria-hidden="true"
        className="size-8 flex-none object-contain"
      />

      <span className="text-[15px] font-semibold tracking-[-0.03em]">
        QueryPilot
      </span>
    </Link>
  );
}

export function EngineeringPage() {
  const nodes = [
    {
      title: "Workspace scope",
      copy: "Tenant, permissions, active sources",
    },
    {
      title: "Question parser",
      copy: "Intent, entities, time range",
    },
    {
      title: "Retrieval layer",
      copy: "Hybrid semantic and lexical search",
    },
    {
      title: "Reasoning context",
      copy: "Ranked passages and relationships",
    },
    {
      title: "Evidence renderer",
      copy: "Citations, snippets, confidence",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Logo dark />

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-white/60 hover:text-white"
            >
              Product
            </Link>

            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-br from-[#007D51] to-[#007D51] px-3.5 py-2.5 text-xs font-medium text-white"
            >
              Open QueryPilot
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#007D51]">
            Engineering / System architecture
          </p>

          <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-[-0.07em] sm:text-7xl">
            A question is a path
            <br />
            through your workspace.
          </h1>

          <p className="mt-8 max-w-xl text-base leading-7 text-white/60">
            QueryPilot is designed around a
            simple contract: understand the
            scope, retrieve the right context,
            reason over evidence, and show the
            work.
          </p>
        </div>

        <div className="mt-24 border border-white/15">
          <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#007D51]">
              Request lifecycle
            </span>

            <span className="font-mono text-[10px] text-white/40">
              QP / PIPELINE / 01
            </span>
          </div>

          <div className="grid md:grid-cols-5">
            {nodes.map(
              (
                node,
                i,
              ) => (
                <div
                  key={node.title}
                  className="relative border-b border-white/15 p-5 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <span className="font-mono text-[10px] text-[#007D51]">
                    0{i + 1}
                  </span>

                  <h2 className="mt-10 text-sm font-medium">
                    {node.title}
                  </h2>

                  <p className="mt-2 text-xs leading-5 text-white/50">
                    {node.copy}
                  </p>

                  {i < 4 && (
                    <ArrowRight
                      className="absolute right-3 top-1/2 hidden text-[#007D51]/70 md:block"
                      size={15}
                    />
                  )}
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mt-24 grid gap-12 border-t border-white/15 pt-12 lg:grid-cols-3">
          <div>
            <p className="font-mono text-xs text-[#007D51]">
              01 / SCOPE
            </p>

            <h2 className="mt-4 text-xl font-medium">
              Workspace context is the boundary.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Every question inherits an active
              workspace, making permissions and
              source selection explicit before
              retrieval begins.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs text-[#007D51]">
              02 / GROUNDING
            </p>

            <h2 className="mt-4 text-xl font-medium">
              Evidence is a first-class output.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Answers are streamed with source
              references, page anchors, and the
              snippets that support each
              conclusion.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs text-[#007D51]">
              03 / STREAMING
            </p>

            <h2 className="mt-4 text-xl font-medium">
              Useful before complete.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              The interface exposes progress
              through retrieval and reasoning so
              users can follow a response as it
              forms.
            </p>
          </div>
        </div>

        <div className="mt-24 flex flex-col gap-8 border-t border-white/15 pt-10 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl text-2xl font-medium tracking-[-0.04em]">
            The architecture stays invisible when
            it works. The evidence never should.
          </p>

          <Link
            href="/signup"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-gradient-to-br from-[#007D51] to-[#007D51] px-4 py-3 text-sm font-medium text-white"
          >
            Try the product
            <ArrowRight size={15} />
          </Link>
        </div>
      </main>
    </div>
  );
}