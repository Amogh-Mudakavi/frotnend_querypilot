"use client";

import Link from "next/link";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { PointerEvent } from "react";

import { ArrowRight } from "lucide-react";

import gsap from "gsap";

import { PixelDissolveButton } from "@/components/pixel-dissolve-button";

import { QueryPilotApp } from "@/components/hero/query-pilot-app";

import { DemoWindowChrome } from "@/components/hero/demo-window-chrome";

import { QueryPilotProcessCards } from "@/components/hero/process-cards";

import { SkyBlueBackground } from "@/components/hero/SkyBlueBackground";

import {
  PlannerAgentDemo,
  AsyncIngestionDemo,
  ConversationMemoryDemo,
  SSEStreamingDemo,
  StructuredDataDemo,
  WorkspaceIsolationDemo,
} from "@/components/demos";

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

 * Shared palette

 * ---------------------------------------------------------------------------

 * Single source of truth for the warm beige used across the public site

 * (hero, mobile hero, page background, builder-section card grid, and now

 * the features section). Kept as a plain constant rather than a Tailwind

 * theme token so it can be dropped straight into arbitrary-value classes

 * and inline gradients without a config change.

 * --------------------------------------------------------------------------- */

const PAGE_BEIGE = "#F4EFE4";

/* ------------------------------------------------------------------------

 * Navbar theme detection

 * ------------------------------------------------------------------------ */

const NAV_SAMPLE_EPSILON_PX = 32;

function parseRgbColor(color: string): [number, number, number, number] | null {
  const match = color.match(
    /rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );

  if (!match) return null;

  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] !== undefined ? Number(match[4]) : 1,
  ];
}

function relativeLuminance(r: number, g: number, b: number) {
  const channel = (value: number) => {
    const c = value / 255;

    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function PublicNav() {
  const [darkTheme, setDarkTheme] = useState(false);

  useLayoutEffect(() => {
    let ticking = false;
    let lastSampleY = Number.NEGATIVE_INFINITY;

    const detectTheme = (force = false) => {
      ticking = false;

      const scrollY = window.scrollY;

      if (scrollY < window.innerHeight * 0.92) {
        lastSampleY = scrollY;
        setDarkTheme(false);
        return;
      }

      if (
        !force &&
        Math.abs(scrollY - lastSampleY) < NAV_SAMPLE_EPSILON_PX
      ) {
        return;
      }

      lastSampleY = scrollY;

      const nav = document.querySelector(
        "[data-querypilot-nav]",
      ) as HTMLElement | null;

      if (!nav) return;

      const navRect = nav.getBoundingClientRect();

      const sampleX = navRect.left + navRect.width / 2;
      const sampleY = navRect.bottom + 8;

      const element = document.elementFromPoint(
        sampleX,
        sampleY,
      ) as HTMLElement | null;

      if (!element) return;

      let current: HTMLElement | null = element;

      while (current) {
        const background = window.getComputedStyle(current).backgroundColor;
        const parsed = parseRgbColor(background);

        if (parsed) {
          const [r, g, b, a] = parsed;

          if (a > 0.35) {
            const luminance = relativeLuminance(r, g, b);

            setDarkTheme(luminance < 0.5);
            return;
          }
        }

        current = current.parentElement;
      }

      setDarkTheme(false);
    };

    const onScroll = () => {
      if (ticking) return;

      ticking = true;

      window.requestAnimationFrame(() => {
        detectTheme();
      });
    };

    const onResize = () => {
      lastSampleY = Number.NEGATIVE_INFINITY;

      if (ticking) return;

      ticking = true;

      window.requestAnimationFrame(() => {
        detectTheme(true);
      });
    };

    detectTheme(true);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const textClass = darkTheme ? "text-white" : "text-black";

  const mutedTextClass = darkTheme
    ? "text-white/70 hover:text-white"
    : "text-black/60 hover:text-black";

  const backgroundClass = darkTheme
    ? "bg-[#080808]/72"
    : "bg-white/72";

  const signupClass = darkTheme
    ? "bg-white text-black hover:bg-white/90"
    : "bg-black text-white hover:bg-black/90";

  return (
    <header
      data-querypilot-nav
      className="
        fixed
        top-3
        left-[4vw]
        right-[4vw]
        z-[60]
        min-[901px]:left-[15vw]
        min-[901px]:right-[15vw]
      "
    >
      <nav
        aria-label="Main navigation"
        className={`
          grid
          h-[58px]
          w-full
          grid-cols-[1fr_auto_1fr]
          items-center
          ${backgroundClass}
          px-1
          sm:px-2
          backdrop-blur-md
          transition-colors
          duration-300
        `}
      >
        {/* LEFT ------------------------------------------------------ */}
        <div className="flex min-w-0 items-center justify-self-start">
          <Link
            href="/"
            aria-label="QueryPilot home"
            className={`
              inline-flex
              items-center
              gap-2.5
              whitespace-nowrap
              text-[18px]
              sm:text-[19px]
              font-normal
              leading-none
              tracking-[-0.035em]
              transition-colors
              duration-200
              ${textClass}
            `}
          >
            <img
              src="/querypilot-logo.svg"
              alt=""
              aria-hidden="true"
              className="h-[23px] w-[23px] shrink-0 object-contain"
            />

            <span>QueryPilot</span>
          </Link>

          <span
            aria-hidden="true"
            className={`
              mx-4
              h-5
              w-px
              ${darkTheme ? "bg-white/10" : "bg-black/10"}
            `}
          />

          <a
            href="https://github.com/Amogh-Mudakavi/QueryPilot_backend"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="QueryPilot GitHub"
            className={`
              inline-flex
              items-center
              justify-center
              ${mutedTextClass}
              transition-colors
              duration-200
            `}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-[19px] w-[19px]"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.455-1.157-1.11-1.466-1.11-1.466-.908-.62.069-.607.069-.607 1.004.07 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-1.087.635-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.269.098-2.647 0 0 .839-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.746-1.025 2.746-1.025.546 1.378.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.843-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
            </svg>
          </a>
        </div>

        {/* CENTER ---------------------------------------------------- */}
        <div
          className="
            hidden
            items-center
            gap-7
            min-[901px]:flex
            justify-self-center
          "
        >
          <a
            href="#use-cases"
            className={`
              text-[15px]
              sm:text-[16px]
              font-normal
              leading-none
              tracking-[-0.015em]
              transition-colors
              duration-200
              ${mutedTextClass}
            `}
          >
            Engineering
          </a>

          <Link
            href="/technical-challenges"
            className={`
              text-[15px]
              sm:text-[16px]
              font-normal
              leading-none
              tracking-[-0.015em]
              transition-colors
              duration-200
              ${mutedTextClass}
            `}
          >
            Technical challenges
          </Link>
        </div>

        {/* RIGHT ----------------------------------------------------- */}
        <div
          className="
            flex
            items-center
            gap-3
            sm:gap-4
            justify-self-end
          "
        >
          <Link
            href="/login"
            className={`
              text-[14px]
              sm:text-[15px]
              font-normal
              leading-none
              tracking-[-0.015em]
              ${mutedTextClass}
              transition-colors
              duration-200
            `}
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className={`
              inline-flex
              h-9
              items-center
              justify-center
              rounded-[10px]
              px-3.5
              text-[14px]
              font-medium
              leading-none
              tracking-[-0.02em]
              shadow-[0_3px_14px_rgba(0,0,0,0.08)]
              transition-all
              duration-200
              ${signupClass}
            `}
          >
            Sign up
          </Link>
        </div>
      </nav>
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

const MAIN_WINDOW_ASPECT = 16 / 8;

const PAGE_FRAME_WIDTH_VW = 70;

const RESTING_DEMO_WIDTH_VW = 92;

const RESTING_DEMO_MIN_WIDTH = 780;

const RESTING_DEMO_MAX_WIDTH = 1500;

const DEMO_WIDTH_VW = 54;

const DEMO_MIN_WIDTH = 700;

const DEMO_MAX_WIDTH = 960;

const DEMO_DURATION_MS = 30000;

// Cap how often the demo timer pushes a React state update. The visible
// content (typing text, process cards) reads fine at 15 updates/sec -
// there is no reason to re-render React at a full 60fps for 30 seconds
// straight. This alone cuts re-render volume by ~4x during the demo.
const DEMO_STATE_UPDATE_INTERVAL_MS = 66;

const DEMO_OPEN_START = 0.02;

// Height of the blue pinstripe band as a share of the screen, measured from
// the bottom edge upward: 25% while the hero is resting, 40% once the demo
// is open. The band is always laid out at the taller (demo) size and squashed
// with scaleY at rest, so nothing is resized or repainted while scrolling.
const STROKES_REST_HEIGHT = 0.75;

const STROKES_DEMO_HEIGHT = 0.65;

const DEMO_RETURN_COMPLETE = 0.02;

const DEMO_RETURN_START = 0.74;

const DEMO_OPEN_DURATION_S = 0.82;

const EXPANDED_WINDOW_ASPECT = 27 / 20;

function StaticHeroHeading() {
  return (
    <h1 className="w-full text-[clamp(2.05rem,2.35vw,2.65rem)] font-normal leading-[1.04] tracking-[-0.045em] text-black">
      <span data-hero-title-line className="block whitespace-nowrap">
        Don't Search Your Data.
      </span>

      <span data-hero-title-line className="block">
        Understand It.
      </span>
    </h1>
  );
}

function ProductPreview() {
  const sectionRef = useRef<HTMLElement | null>(null);

  const heroCopyRef = useRef<HTMLDivElement | null>(null);

  const sceneRef = useRef<HTMLDivElement | null>(null);

  const mainWindowRef = useRef<HTMLDivElement | null>(null);

  const centerWindowRef = useRef<HTMLDivElement | null>(null);

  const processCardsRef = useRef<HTMLDivElement | null>(null);

  const restingBackgroundRef = useRef<HTMLDivElement | null>(null);

  const restingEntryRef = useRef<HTMLDivElement | null>(null);

  const heroParagraphRef = useRef<HTMLParagraphElement | null>(null);

  const heroActionsRef = useRef<HTMLDivElement | null>(null);

  const strokesRef = useRef<HTMLDivElement | null>(null);

  const strokesCenterCoverRef = useRef<HTMLDivElement | null>(null);

  const restingIntroCompleteRef = useRef(false);

  const dragStateRef = useRef({
    active: false,

    pointerX: 0,

    pointerY: 0,

    x: 0,

    y: 0,
  });

  const rafRef = useRef<number | null>(null);

  const smoothProgressRef = useRef(0);

  const demoPhaseRef = useRef<"resting" | "running" | "complete" | "returning">(
    "resting",
  );

  const demoPlayedRef = useRef(false);

  const visualProgressRef = useRef(0);

  const openTweenRef = useRef<gsap.core.Tween | null>(null);

  const lastScrollYRef = useRef(0);

  const userScrollIntentRef = useRef(false);

  // A wheel/trackpad gesture is a burst of wheel events, not one intent per

  // event. These refs let the hero consume one whole burst when a running

  // demo is skipped, preventing the same momentum from entering Features.

  const wheelBurstActiveRef = useRef(false);

  const wheelBurstTimerRef = useRef<number | null>(null);

  const consumeWheelBurstRef = useRef(false);

  const returnStartElapsedRef = useRef(0);

  const keyboardIntentConsumedRef = useRef(false);

  const heroOnScreenRef = useRef(true);

  const [heroOnScreen, setHeroOnScreen] = useState(true);

  const elapsedRef = useRef(DEMO_DURATION_MS);

  const [demoActive, setDemoActive] = useState(false);

  // Keep the resting hero on the finished answer state so the first frame
  // communicates product value. The existing scroll interaction still calls
  // beginDemo(), which resets the timeline to 0 and plays the demo normally.
  const [demoElapsed, setDemoElapsed] = useState(DEMO_DURATION_MS);

  const [showRestingBackgroundImage, setShowRestingBackgroundImage] =
    useState(true);

  const restingBackgroundReadyRef = useRef(true);

  useEffect(() => {
    if (!demoActive || !heroOnScreen) return;

    let raf = 0;

    let last = performance.now();

    let lastStateFlush = 0;

    const tick = (now: number) => {
      const delta = Math.min(now - last, 100);

      last = now;

      if (demoPhaseRef.current === "running") {
        const next = Math.min(
          elapsedRef.current + delta,

          DEMO_DURATION_MS,
        );

        elapsedRef.current = next;

        const isDone = next >= DEMO_DURATION_MS;

        // Throttle the React state flush instead of pushing a re-render on
        // every animation frame. The ref above always holds the true value
        // for the imperative/GSAP side; the state below only needs to be
        // "fresh enough" for what's actually rendered on screen.
        if (isDone || now - lastStateFlush >= DEMO_STATE_UPDATE_INTERVAL_MS) {
          lastStateFlush = now;

          setDemoElapsed(next);
        }

        if (isDone) {
          demoPhaseRef.current = "complete";

          window.dispatchEvent(new Event("querypilot-demo-complete"));

          setDemoElapsed(DEMO_DURATION_MS);

          setDemoActive(false);

          return;
        }
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [demoActive, heroOnScreen]);

  useLayoutEffect(() => {
    const section = sectionRef.current;

    const heroCopy = heroCopyRef.current;

    const scene = sceneRef.current;

    const mainWindow = mainWindowRef.current;

    const processCards = processCardsRef.current;

    const restingBackground = restingBackgroundRef.current;

    const restingEntry = restingEntryRef.current;

    const heroParagraph = heroParagraphRef.current;

    const heroActions = heroActionsRef.current;

    const strokes = strokesRef.current;

    const strokesCenterCover = strokesCenterCoverRef.current;

    if (
      !section ||
      !heroCopy ||
      !scene ||
      !mainWindow ||
      !processCards ||
      !restingBackground ||
      !restingEntry ||
      !heroParagraph ||
      !heroActions
    ) {
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

      const distance = Math.max(
        section.offsetHeight - window.innerHeight,

        1,
      );

      return clamp01(-rect.top / distance);
    };

    const getGeometry = () => {
      const viewportHeight = window.innerHeight;

      const frameWidth = window.innerWidth * (PAGE_FRAME_WIDTH_VW / 100);

      const desiredRestWidth = Math.min(
        frameWidth * (RESTING_DEMO_WIDTH_VW / 100),

        RESTING_DEMO_MAX_WIDTH,
      );

      const restWidth = Math.max(
        Math.min(desiredRestWidth, frameWidth),

        Math.min(RESTING_DEMO_MIN_WIDTH, frameWidth),
      );

      const restLeft = Math.max(
        (frameWidth - restWidth) / 2,

        0,
      );

      const demoWidth = Math.min(
        Math.max(
          window.innerWidth * (DEMO_WIDTH_VW / 100),

          DEMO_MIN_WIDTH,
        ),

        DEMO_MAX_WIDTH,
      );

      const finalHeightFromWidth = demoWidth / EXPANDED_WINDOW_ASPECT;

      const finalDemoHeight = Math.min(
        finalHeightFromWidth,

        viewportHeight * 0.78,
      );

      const finalWidth = demoWidth;

      const finalLeft = (frameWidth - finalWidth) / 2;

      const restHeight = restWidth / MAIN_WINDOW_ASPECT;

      const restTop = viewportHeight - restHeight;

      return {
        restWidth,

        restLeft,

        finalWidth,

        finalLeft,

        restTop,

        finalDemoHeight,

        finalTop: Math.max(
          108,

          (viewportHeight - finalDemoHeight) / 2,
        ),
      };
    };

    const render = (progress = smoothProgressRef.current) => {
      const p = clamp01(progress);

      const {
        restWidth,

        restLeft,

        finalWidth,

        finalLeft,

        restTop,

        finalTop,

        finalDemoHeight,
      } = getGeometry();

      const phase = demoPhaseRef.current;

      const visual =
        phase === "returning" || phase === "complete" || phase === "running"
          ? visualProgressRef.current
          : 0;

      const widthVisual = lerp(
        restWidth,

        finalWidth,

        visual,
      );

      const heightVisual = lerp(
        restWidth / MAIN_WINDOW_ASPECT,

        finalDemoHeight,

        visual,
      );

      const topVisual = lerp(
        restTop,

        finalTop,

        visual,
      );

      const leftVisual = lerp(
        restLeft,

        finalLeft,

        visual,
      );

      const backgroundVisibility =
        phase === "resting"
          ? restingIntroCompleteRef.current
            ? 1
            : 0
          : phase === "returning"
            ? smoothstep(1 - visual)
            : 1 - smoothstep(clamp01((visual - 0.05) / 0.5));

      if (
        restingBackgroundReadyRef.current &&
        (restingIntroCompleteRef.current || phase !== "resting")
      ) {
        gsap.set(restingBackground, {
          opacity: backgroundVisibility,

          visibility: backgroundVisibility > 0.001 ? "visible" : "hidden",

          force3D: true,
        });
      } else if (!restingBackgroundReadyRef.current) {
        gsap.set(restingBackground, {
          opacity: 0,

          visibility: "hidden",

          force3D: true,
        });
      }

      gsap.set(mainWindow, {
        left: leftVisual,

        top: topVisual,

        xPercent: 0,

        yPercent: 0,

        width: widthVisual,

        height: heightVisual,

        scale: 1,

        transformOrigin: "50% 50%",

        visibility: "visible",

        force3D: true,
      });

      // Blue pinstripe band: grows from 25% to 40% of the screen height as
      // the demo opens (and shrinks back on the way out). The centre cover
      // fades away at the same time so the strokes run edge to edge instead
      // of leaving a white gap around/below the demo window.
      if (strokes) {
        gsap.set(strokes, {
          scaleY: lerp(
            STROKES_REST_HEIGHT / STROKES_DEMO_HEIGHT,

            1,

            clamp01(visual),
          ),

          transformOrigin: "50% 100%",

          force3D: true,
        });
      }

      if (strokesCenterCover) {
        gsap.set(strokesCenterCover, {
          opacity: 1 - smoothstep(clamp01(visual)),
        });
      }

      const copyReveal =
        phase === "resting"
          ? 1
          : phase === "returning"
            ? smoothstep(1 - visual)
            : 1 - smoothstep(visual);

      // NOTE: no `filter: blur()` here anymore. Blur can't be composited on
      // the GPU, so animating it every scroll frame forced a full repaint of
      // this block on every tick - that was the single biggest cause of
      // scroll jank. Opacity + scale give a near-identical "focus" feel and
      // are compositor-only (cheap).
      gsap.set(heroCopy, {
        opacity: copyReveal,

        y: 0,

        scale: lerp(
          1,

          0.985,

          1 - copyReveal,
        ),

        force3D: true,
      });

      // The process-card component already receives the exact demo timeline

      // through `elapsed`. Keep this parent wrapper as a simple lifecycle gate

      // instead of applying a second, unrelated scroll-position animation on

      // top of it. That lets the same cards play forward and reverse naturally.

      const cardsInDemoPhase =
        demoPhaseRef.current === "running" ||
        demoPhaseRef.current === "complete" ||
        demoPhaseRef.current === "returning";

      const cardVisibility =
        !demoPlayedRef.current || !cardsInDemoPhase || elapsedRef.current <= 0.5
          ? 0
          : 1;

      // Same fix here: dropped the animated `filter: blur()` in favor of
      // opacity/scale/translate, which the compositor can handle without
      // repainting the cards every frame.
      gsap.set(processCards, {
        opacity: cardVisibility,

        visibility: cardVisibility > 0.001 ? "visible" : "hidden",

        scale: lerp(
          0.985,

          1,

          cardVisibility,
        ),

        y: lerp(
          -8,

          0,

          cardVisibility,
        ),

        transformOrigin: "50% 50%",

        force3D: true,
      });

      if (!dragStateRef.current.active) {
        setDrag();
      }
    };

    const tweenVisual = (
      to: number,

      duration: number,

      onComplete?: () => void,
    ) => {
      const proxy = {
        value: visualProgressRef.current,
      };

      gsap.killTweensOf(proxy);

      return gsap.to(proxy, {
        value: to,

        duration,

        ease: to > visualProgressRef.current ? "power3.out" : "power3.inOut",

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
      if (demoPhaseRef.current !== "resting") {
        return;
      }

      demoPlayedRef.current = true;

      demoPhaseRef.current = "running";

      visualProgressRef.current = 0;

      elapsedRef.current = 0;

      setDemoElapsed(0);

      setDemoActive(true);

      window.dispatchEvent(new Event("querypilot-demo-start"));

      if (reduceMotion) {
        visualProgressRef.current = 1;

        render();

        return;
      }

      openTweenRef.current?.kill();

      openTweenRef.current = tweenVisual(
        1,

        DEMO_OPEN_DURATION_S,
      );
    };

    const resetDemoToRest = () => {
      openTweenRef.current?.kill();

      openTweenRef.current = null;

      demoPhaseRef.current = "resting";

      visualProgressRef.current = 0;

      elapsedRef.current = 0;

      setDemoActive(false);

      setDemoElapsed(0);

      window.dispatchEvent(new Event("querypilot-demo-reset"));

      render(0);
    };

    const syncReturnTimeline = (progress: number) => {
      const returnProgress = smoothstep(
        clamp01(
          (progress - DEMO_RETURN_COMPLETE) /
            (DEMO_RETURN_START - DEMO_RETURN_COMPLETE),
        ),
      );

      visualProgressRef.current = returnProgress;

      const nextElapsed = Math.max(
        0,

        Math.min(
          returnStartElapsedRef.current * returnProgress,

          DEMO_DURATION_MS,
        ),
      );

      elapsedRef.current = nextElapsed;

      setDemoElapsed(nextElapsed);
    };

    const beginReturnToRest = (progress: number) => {
      if (!demoPlayedRef.current) {
        return;
      }

      if (progress <= DEMO_RETURN_COMPLETE) {
        resetDemoToRest();

        return;
      }

      openTweenRef.current?.kill();

      openTweenRef.current = null;

      demoPhaseRef.current = "returning";

      returnStartElapsedRef.current =
        clamp01(elapsedRef.current / DEMO_DURATION_MS) * DEMO_DURATION_MS;

      syncReturnTimeline(progress);

      setDemoActive(false);
    };

    // Deterministic hard resolve to the exact completion state already used

    // by the normal timed demo. This is also the state reached by an explicit

    // user skip, so the hero never lands in a half-open visual state.

    const snapToFinalState = () => {
      openTweenRef.current?.kill();

      openTweenRef.current = null;

      visualProgressRef.current = 1;

      elapsedRef.current = DEMO_DURATION_MS;

      setDemoElapsed(DEMO_DURATION_MS);

      setDemoActive(false);

      demoPlayedRef.current = true;

      demoPhaseRef.current = "complete";

      window.dispatchEvent(new Event("querypilot-demo-complete"));

      render(1);
    };

    const onScroll = () => {
      if (rafRef.current !== null) {
        return;
      }

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;

        if (!heroOnScreenRef.current) {
          lastScrollYRef.current = window.scrollY;

          return;
        }

        const p = getProgress();

        const scrollY = window.scrollY;

        const deltaY = scrollY - lastScrollYRef.current;

        lastScrollYRef.current = scrollY;

        const isMovingUp = deltaY < -0.5;

        const isMovingDown = deltaY > 0.5;

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
          if (elapsedRef.current >= DEMO_DURATION_MS) {
            demoPhaseRef.current = "complete";
          } else {
            demoPhaseRef.current = "running";

            setDemoActive(true);
          }

          tweenVisual(1, 0.52);
        }

        // Fast-scroll safety net.

        if (isMovingDown && p >= 0.995 && demoPhaseRef.current !== "complete") {
          snapToFinalState();
        }

        if (isMovingUp && demoPlayedRef.current) {
          if (p <= DEMO_RETURN_COMPLETE) {
            resetDemoToRest();
          } else if (
            p < DEMO_RETURN_START &&
            demoPhaseRef.current !== "resting"
          ) {
            beginReturnToRest(p);
          }
        }

        if (demoPhaseRef.current === "returning" && p > DEMO_RETURN_COMPLETE) {
          syncReturnTimeline(p);
        }

        smoothProgressRef.current = p;

        render(p);
      });
    };

    const armUserScrollIntent = () => {
      userScrollIntentRef.current = true;
    };

    const finishWheelBurst = () => {
      wheelBurstActiveRef.current = false;

      consumeWheelBurstRef.current = false;

      wheelBurstTimerRef.current = null;
    };

    const onWheel = (event: WheelEvent) => {
      const deltaY = event.deltaY;

      if (Math.abs(deltaY) < 4) {
        return;
      }

      armUserScrollIntent();

      const wasAlreadyInBurst = wheelBurstActiveRef.current;

      wheelBurstActiveRef.current = true;

      if (wheelBurstTimerRef.current !== null) {
        window.clearTimeout(wheelBurstTimerRef.current);
      }

      wheelBurstTimerRef.current = window.setTimeout(
        finishWheelBurst,

        260,
      );

      const isDown = deltaY > 0;

      if (!isDown || !heroOnScreenRef.current) {
        return;
      }

      if (consumeWheelBurstRef.current) {
        event.preventDefault();

        return;
      }

      const phase = demoPhaseRef.current;

      const progress = getProgress();

      if (
        !wasAlreadyInBurst &&
        phase === "resting" &&
        progress >= DEMO_OPEN_START
      ) {
        beginDemo();

        return;
      }

      if (
        !wasAlreadyInBurst &&
        (phase === "running" || phase === "returning")
      ) {
        snapToFinalState();

        consumeWheelBurstRef.current = true;

        event.preventDefault();
      }
    };

    const isEditableTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;

      if (!element) {
        return false;
      }

      return (
        element.isContentEditable ||
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT"
      );
    };

    const isDownNavigationKey = (key: string) =>
      key === "ArrowDown" || key === "PageDown" || key === " " || key === "End";

    const isUpNavigationKey = (key: string) =>
      key === "ArrowUp" || key === "PageUp" || key === "Home";

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (!isDownNavigationKey(event.key) && !isUpNavigationKey(event.key)) {
        return;
      }

      armUserScrollIntent();

      if (!heroOnScreenRef.current) {
        return;
      }

      if (isUpNavigationKey(event.key)) {
        keyboardIntentConsumedRef.current = false;

        return;
      }

      if (keyboardIntentConsumedRef.current) {
        event.preventDefault();

        return;
      }

      const progress = getProgress();

      const phase = demoPhaseRef.current;

      if (phase === "running" || phase === "returning") {
        snapToFinalState();

        keyboardIntentConsumedRef.current = true;

        event.preventDefault();

        return;
      }

      if (phase === "resting" && progress >= DEMO_OPEN_START) {
        beginDemo();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isDownNavigationKey(event.key)) {
        keyboardIntentConsumedRef.current = false;
      }
    };

    const onResize = () => {
      resetDrag();

      if (!heroOnScreenRef.current) {
        return;
      }

      render(getProgress());
    };

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        const onScreen = entry ? entry.isIntersecting : true;

        if (heroOnScreenRef.current === onScreen) {
          return;
        }

        heroOnScreenRef.current = onScreen;

        setHeroOnScreen(onScreen);

        if (onScreen) {
          lastScrollYRef.current = window.scrollY;

          smoothProgressRef.current = getProgress();

          render(smoothProgressRef.current);
        } else {
          const p = getProgress();

          if (p >= 0.99 && demoPhaseRef.current !== "complete") {
            snapToFinalState();
          }
        }
      },

      {
        rootMargin: "160px 0px 160px 0px",
      },
    );

    visibilityObserver.observe(section);

    const heroTitleLines = heroCopy.querySelectorAll<HTMLElement>(
      "[data-hero-title-line]",
    );

    // The hero opens in its finished resting state. This removes the
    // intermediate hidden/blank frame that could briefly expose the demo
    // internals before the client animation system takes over.
    restingIntroCompleteRef.current = true;
    restingBackgroundReadyRef.current = true;
    setShowRestingBackgroundImage(true);

    gsap.set(restingBackground, {
      opacity: 1,
      visibility: "visible",
      clearProps: "transform",
    });

    gsap.set(restingEntry, {
      opacity: 1,
      y: 0,
      scale: 1,
      visibility: "visible",
      clearProps: "filter",
    });

    gsap.set(heroTitleLines, {
      opacity: 1,
      y: 0,
      filter: "none",
      visibility: "visible",
    });

    gsap.set(heroParagraph, {
      opacity: 1,
      y: 0,
      visibility: "visible",
    });

    gsap.set(heroActions, {
      opacity: 1,
      y: 0,
      visibility: "visible",
    });

    visualProgressRef.current = 0;

    smoothProgressRef.current = getProgress();

    lastScrollYRef.current = window.scrollY;

    render(smoothProgressRef.current);

    // No load-time intro animation: the first painted frame is already the final resting hero.

    window.addEventListener(
      "wheel",

      onWheel,

      { passive: false },
    );

    window.addEventListener(
      "touchstart",

      armUserScrollIntent,

      { passive: true },
    );

    window.addEventListener(
      "touchmove",

      armUserScrollIntent,

      { passive: true },
    );

    window.addEventListener(
      "keydown",

      onKeyDown,
    );

    window.addEventListener(
      "keyup",

      onKeyUp,
    );

    window.addEventListener(
      "scroll",

      onScroll,

      { passive: true },
    );

    window.addEventListener(
      "resize",

      onResize,
    );

    return () => {
      visibilityObserver.disconnect();

      window.removeEventListener(
        "wheel",

        onWheel,
      );

      window.removeEventListener(
        "touchstart",

        armUserScrollIntent,
      );

      window.removeEventListener(
        "touchmove",

        armUserScrollIntent,
      );

      window.removeEventListener(
        "keydown",

        onKeyDown,
      );

      window.removeEventListener(
        "keyup",

        onKeyUp,
      );

      if (wheelBurstTimerRef.current !== null) {
        window.clearTimeout(wheelBurstTimerRef.current);
      }

      window.removeEventListener(
        "scroll",

        onScroll,
      );

      window.removeEventListener(
        "resize",

        onResize,
      );

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      openTweenRef.current?.kill();

      gsap.killTweensOf([
        heroCopy,

        mainWindow,

        scene,

        processCards,

        restingBackground,

        restingEntry,

        heroParagraph,

        heroActions,
      ]);

      gsap.killTweensOf(heroTitleLines);
    };
  }, []);

  useLayoutEffect(() => {
    if (!showRestingBackgroundImage) {
      return;
    }

    const background = restingBackgroundRef.current;

    if (!background) {
      return;
    }

    const image = background.querySelector("img");

    if (!image) {
      return;
    }

    let cancelled = false;

    const reveal = () => {
      if (cancelled) {
        return;
      }

      restingBackgroundReadyRef.current = true;

      gsap.killTweensOf(background);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(
          background,

          {
            opacity: 1,

            visibility: "visible",
          },
        );

        restingIntroCompleteRef.current = true;

        return;
      }

      gsap.fromTo(
        background,

        {
          opacity: 0,

          visibility: "visible",
        },

        {
          opacity: 1,

          duration: 0.55,

          ease: "power2.out",

          overwrite: true,

          onComplete: () => {
            if (!cancelled) {
              restingIntroCompleteRef.current = true;
            }
          },
        },
      );
    };

    if (image.complete) {
      reveal();

      return () => {
        cancelled = true;

        gsap.killTweensOf(background);
      };
    }

    image.addEventListener(
      "load",

      reveal,

      { once: true },
    );

    image.addEventListener(
      "error",

      reveal,

      { once: true },
    );

    return () => {
      cancelled = true;

      image.removeEventListener(
        "load",

        reveal,
      );

      image.removeEventListener(
        "error",

        reveal,
      );

      gsap.killTweensOf(background);
    };
  }, [showRestingBackgroundImage]);

  const canDrag = () => {
    const section = sectionRef.current;

    if (!section) {
      return false;
    }

    const distance = Math.max(
      section.offsetHeight - window.innerHeight,

      1,
    );

    return clamp01(-section.getBoundingClientRect().top / distance) >= 0.9;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canDrag()) {
      return;
    }

    const drag = dragStateRef.current;

    drag.active = true;

    drag.pointerX = event.clientX;

    drag.pointerY = event.clientY;

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;

    if (!drag.active) {
      return;
    }

    const maxX = Math.min(
      window.innerWidth * 0.11,

      170,
    );

    const maxY = Math.min(
      window.innerHeight * 0.075,

      72,
    );

    drag.x = Math.max(
      -maxX,

      Math.min(
        maxX,

        event.clientX - drag.pointerX,
      ),
    );

    drag.y = Math.max(
      -maxY,

      Math.min(
        maxY,

        event.clientY - drag.pointerY,
      ),
    );

    if (sceneRef.current) {
      gsap.set(
        sceneRef.current,

        {
          x: drag.x,

          y: drag.y,
        },
      );
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
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
      style={{
        isolation: "isolate",
      }}
    >
      <div className="sticky top-0 h-screen overflow-visible">
        {/*
          Blue pinstripe band anchored to the bottom of the screen. Height is
          a share of the screen measured bottom -> up: 25% at rest, 40% while
          the demo is open (driven from render() above). The box is laid out
          at the 40% size and squashed with scaleY at rest, so the canvas
          never resizes/repaints on scroll. Vertical lines keep their width
          under a scaleY, so the pattern looks identical, just shorter.

          At rest the centre is covered, so only the left/right edges show
          (the scenic image sits in the middle anyway). When the demo opens
          the cover fades out and the strokes fill the full width instead of
          leaving a white gap around/below the demo window.
        */}

        <div
          ref={strokesRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden"
          style={{
            height: `${STROKES_DEMO_HEIGHT * 100}%`,

            opacity: 0.68,

            transformOrigin: "50% 100%",

            transform: `scaleY(${STROKES_REST_HEIGHT / STROKES_DEMO_HEIGHT})`,

            WebkitMaskImage:
              "linear-gradient(to top, #000 0%, #000 62%, transparent 100%)",

            maskImage:
              "linear-gradient(to top, #000 0%, #000 62%, transparent 100%)",
          }}
        >
          <SkyBlueBackground
            fullScreen={false}
            mode="vertical"
            doubleLines={true}
            strokeSpacing={6}
            skyBlueDepth={0.54}
            colorIntensity={0.88}
            fadeToWhite={true}
            opacity={0.72}
            theme="cerulean"
            className="h-full w-full"
          />

          <div
            ref={strokesCenterCoverRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[30]"
            style={{
              background:
                "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 10%, #fff 24%, #fff 76%, rgba(255,255,255,0) 90%, rgba(255,255,255,0) 100%)",
            }}
          />
        </div>

        <div
          className="relative mx-auto h-full w-[70vw] overflow-visible"
          style={{
            marginLeft: "15vw",

            marginRight: "15vw",
          }}
        >
          <div
            ref={restingBackgroundRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-[34vh] z-[1] h-[71vh] w-full overflow-hidden rounded-[30px] border border-black/10 bg-white opacity-100"
          >
            {showRestingBackgroundImage ? (
              <img
                src="/bg-img.png"
                alt=""
                aria-hidden="true"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-white/10 to-white/25" />
          </div>

          <div
            className="absolute right-0 top-[13vh] z-[75] hidden w-[min(30%,300px)] min-[1101px]:block"
            aria-hidden="true"
          ></div>

          <div
            ref={heroCopyRef}
            className="hero-copy absolute left-0 top-[12vh] z-[80] flex w-[min(47%,540px)] max-w-[540px] flex-col items-start px-0 text-left will-change-[transform,opacity]"
          >
            <div className="w-full max-w-[500px]">
              <div className="flex justify-start overflow-visible">
                <StaticHeroHeading />
              </div>

              <p
                ref={heroParagraphRef}
                className="mt-4 max-w-[470px] text-pretty text-[16px] leading-6 text-black/70 opacity-100"
              >
                QueryPilot connects documents and structured data, then finds
                the right sources and returns a grounded answer.
              </p>

              <div
                ref={heroActionsRef}
                className="mt-5 flex items-center justify-start gap-2.5 opacity-100"
              >
                <PixelDissolveButton
                  label="Try QueryPilot"
                  href="/login"
                  color="#0A0A0A"
                  dissolveColor="#3A3A3A"
                  cellSize={5}
                  className="!min-h-10 !rounded-[11px] !px-[18px] !text-sm !font-medium !normal-case !tracking-normal hover:!bg-[#1A1A1A]"
                />

                <PixelDissolveButton
                  label="Read engineering docs"
                  href="/engineering"
                  color="#E7E8E5"
                  dissolveColor="#8FBF98"
                  cellSize={5}
                  className="!min-h-10 !rounded-[11px] !border !border-black/12 !px-4 !text-sm !font-medium !normal-case !tracking-normal !bg-[#E7E8E5] !text-black hover:!bg-[#EEF0EC]"
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
              className="visible absolute left-1/2 top-0 z-[50] aspect-auto w-full -translate-x-1/2 will-change-[width,height,top,opacity]"
            >
              <div
                ref={restingEntryRef}
                className="querypilot-resting-entry relative z-10 h-full w-full opacity-100"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 rounded-[48px] bg-[radial-gradient(closest-side,rgba(255,255,255,0.16),rgba(255,255,255,0.07)_45%,rgba(255,255,255,0)_75%)] blur-2xl"
                />

                <div
                  ref={centerWindowRef}
                  className="absolute inset-[1.5%] z-10 overflow-hidden rounded-[22px]"
                >
                  <DemoWindowChrome label="QueryPilot, live demo" radius={18}>
                    <QueryPilotApp elapsed={demoElapsed} />
                  </DemoWindowChrome>
                </div>

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-7 left-1/2 h-14 w-[72%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),rgba(255,255,255,0)_72%)] blur-xl"
                />

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
                  className="absolute inset-0 z-[60] pointer-events-none opacity-0 invisible will-change-[transform,opacity]"
                >
                  <QueryPilotProcessCards
                    elapsed={demoElapsed}
                    show
                    containerRef={processCardsRef}
                    mainWindowRef={centerWindowRef}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .querypilot-resting-entry {
          transform: none;

          transform-origin: 50% 50%;

          will-change: auto;
        }

        /* The resting hero is painted in its final state. The demo process cards
           stay hidden until the scroll-driven demo actually begins. */
      `}</style>
    </section>
  );
}

function HeroMobile() {
  const [demoStarted, setDemoStarted] = useState(false);

  // Match desktop: show the finished answer in the resting frame, then let
  // the existing first-scroll interaction replay the demo from the start.
  const [demoElapsed, setDemoElapsed] = useState(DEMO_DURATION_MS);

  useEffect(() => {
    if (demoStarted) return;

    const onFirstScroll = () => setDemoStarted(true);

    window.addEventListener(
      "scroll",

      onFirstScroll,

      {
        once: true,

        passive: true,
      },
    );

    return () =>
      window.removeEventListener(
        "scroll",

        onFirstScroll,
      );
  }, [demoStarted]);

  useEffect(() => {
    if (!demoStarted) return;

    const started = performance.now();

    const duration = 30000;

    let raf = 0;

    let lastStateFlush = 0;

    const tick = () => {
      const now = performance.now();

      const elapsed = Math.min(
        now - started,

        duration,
      );

      // Same throttle as the desktop hero - the mobile demo doesn't need a
      // React re-render on every single animation frame either.
      if (
        elapsed >= duration ||
        now - lastStateFlush >= DEMO_STATE_UPDATE_INTERVAL_MS
      ) {
        lastStateFlush = now;

        setDemoElapsed(elapsed);
      }

      if (elapsed < duration) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [demoStarted]);

  return (
    <section className="relative w-full overflow-hidden bg-white px-5 pb-[15vh] pt-[15vh] text-black min-[901px]:hidden">
      <div className="relative z-10 mx-auto w-full max-w-[720px] text-center">
        <h1 className="mx-auto max-w-[660px] text-[clamp(36px,9vw,58px)] font-normal leading-[1.02] tracking-[-0.045em] text-black">
          Ask your business data.
          <span className="block">Get the answer.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[560px] text-[17px] leading-7 text-black/68">
          Ask across documents and structured data without knowing which source
          contains the answer.
        </p>

        <div className="relative mt-9 overflow-hidden rounded-[22px] border border-black/10 bg-white p-[2.6%] shadow-[0_24px_70px_rgba(0,0,0,0.10)]">
          <img
            src="/bg-img.png"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          />

          <div className="pointer-events-none absolute inset-0 bg-transparent" />

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] border border-black/10 bg-white sm:aspect-video">
            <QueryPilotApp elapsed={demoElapsed} />
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <PixelDissolveButton
            label="Try QueryPilot"
            href="/login"
            color="#0A0A0A"
            dissolveColor="#3A3A3A"
            cellSize={5}
            className="!min-h-10 !rounded-[11px] !px-[18px] !text-sm !font-medium !normal-case !tracking-normal hover:!bg-[#1A1A1A]"
          />

          <PixelDissolveButton
            label="Read engineering docs"
            href="/engineering"
            color="#E7E8E5"
            dissolveColor="#8FBF98"
            cellSize={5}
            className="!min-h-10 !rounded-[11px] !border !border-black/12 !px-4 !text-sm !font-medium !normal-case !tracking-normal !bg-[#E7E8E5] !text-black hover:!bg-[#EEF0EC]"
          />
        </div>
      </div>
    </section>
  );
}

/* ============================================================

   Features

   ============================================================ */

const FEATURE_ITEMS = [
  {
    number: "01",

    title: "Planner Agent",

    description:
      "An agent which interprets the user's request, resolves referenced resources and entities, and constructs the execution plan required to answer it. It can coordinate document search, structured queries, metadata lookup, memory, and multi-source execution before evidence is validated.",

    cta: "Learn about planner agents",

    Demo: PlannerAgentDemo,
  },

  {
    number: "02",

    title: "Async Ingestion Pipeline",

    description:
      "Handles document ingestion asynchronously through background workers so parsing and indexing do not block the request lifecycle. Uploaded files are validated, parsed, chunked, embedded, indexed, and persisted before their ingestion status is updated and the content becomes searchable.",

    cta: "Learn about document processing",

    Demo: AsyncIngestionDemo,
  },

  {
    number: "03",

    title: "Conversation Memory",

    description:
      "Maintains workspace-scoped conversation context so previous questions, answers, and referenced entities remain available across turns. This enables follow-up queries, pronoun resolution, and contextual references without requiring users to repeat earlier information.",

    cta: "Learn about conversation memory",

    Demo: ConversationMemoryDemo,
  },

  {
    number: "04",

    title: "Real-Time SSE Streaming",

    description:
      "Streams assistant responses from the Django backend to the frontend over Server-Sent Events as execution progresses. Incremental answer_delta events update a single response in real time, followed by a complete event containing the final answer, sources, and execution state.",

    cta: "Learn about real-time streaming",

    Demo: SSEStreamingDemo,
  },

  {
    number: "05",

    title: "Structured Data Pipeline",

    description:
      "Processes XLSX and CSV sources into workspace-scoped SQLite tables with inferred schemas and registered metadata. Natural-language requests are translated into safe, read-only SQL to return structured rows, aggregates, and evidence for the final answer.",

    cta: "Learn about structured data",

    Demo: StructuredDataDemo,
  },

  {
    number: "06",

    title: "Workspace Isolation",

    description:
      "Enforces workspace boundaries across documents, tables, retrieval, conversations, and execution so data cannot leak across workspaces. Authorization and workspace-scoped resource access ensure every query operates only against resources the current user is permitted to access.",

    cta: "Learn about workspace isolation",

    Demo: WorkspaceIsolationDemo,
  },
] as const;

function FeatureRow({
  feature,

  index,
}: {
  feature: (typeof FEATURE_ITEMS)[number];

  index: number;
}) {
  const Demo = feature.Demo;

  const reversed = index % 2 === 1;

  return (
    <article
      className={[
        "grid grid-cols-1 gap-10 py-16 sm:py-20",

        "min-[901px]:grid-cols-12 min-[901px]:items-center min-[901px]:gap-x-10 min-[901px]:gap-y-14 min-[901px]:py-24",

        index > 0 ? "border-t border-white/10" : "",
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-col justify-center",

          "min-[901px]:col-span-5",

          reversed
            ? "min-[901px]:order-2 min-[901px]:col-start-8 min-[901px]:justify-self-end"
            : "min-[901px]:order-1 min-[901px]:col-start-1",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          <span>{feature.number}</span>

          <span aria-hidden="true" className="h-px w-8 bg-white/15" />
        </div>

        <h2 className="mt-5 max-w-[480px] text-[clamp(1.65rem,2.6vw,2.65rem)] font-normal leading-[1.05] tracking-[-0.04em] text-white">
          {feature.title}
        </h2>

        <p className="mt-5 max-w-[440px] text-[15px] leading-[1.625rem] text-white/68 sm:text-[16px] sm:leading-7">
          {feature.description}
        </p>

        <Link
          href="/engineering"
          className="group mt-6 inline-flex w-fit items-center gap-2 text-sm font-medium text-[#D9822B] transition-colors duration-200 hover:text-[#E39135]"
        >
          <span>{feature.cta}</span>

          <ArrowRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <div
        className={[
          "w-full min-w-0",

          "min-[901px]:col-span-7",

          reversed
            ? "min-[901px]:order-1 min-[901px]:col-start-1"
            : "min-[901px]:order-2 min-[901px]:col-start-6",
        ].join(" ")}
      >
        {/*

          Every feature receives the exact same 7-column desktop slot. The

          demo component remains the owner of its own DemoWindow, chrome,

          internal padding, animation, and calibrated height. This layer only

          standardizes placement and available width, so all six demos line up

          without a second border, forced 620px viewport, or internal scaling.

        */}

        <div className="flex w-full min-w-0 items-stretch">
          <Demo className="w-full" />
        </div>
      </div>
    </article>
  );
}

function FeaturesSection() {
  return (
    <section
      id="features"
      aria-label="QueryPilot features"
      className="relative w-full bg-[#0A0A0A] text-white"
    >
      <div className="border-t border-white/10" />

      <div className="mx-auto w-full px-5 sm:px-8 min-[901px]:ml-[15vw] min-[901px]:mr-[15vw] min-[901px]:w-[70vw] min-[901px]:px-0">
        <div className="min-[901px]:border-x min-[901px]:border-white/10">
          <div className="pb-2 pt-14 min-[901px]:px-12 min-[901px]:pt-16">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              Features
            </span>
          </div>

          <div className="min-[901px]:px-12">
            {FEATURE_ITEMS.map((feature, index) => (
              <FeatureRow key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================

   LANDING PAGE

   ============================================================ */

export function LandingPage() {
  useEffect(() => {
    const isReload =
      performance.getEntriesByType("navigation")[0] &&
      (
        performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming
      ).type === "reload";

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

    const delayed = window.setTimeout(
      forceTop,

      120,
    );

    return () => {
      window.cancelAnimationFrame(frame);

      window.clearTimeout(delayed);

      history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return (
    <div className="querypilot-public-site min-h-screen bg-white text-black">
      <style jsx global>{`
        html,
        body {
          background-color: #ffffff;

          overscroll-behavior-y: none;

          height: 100%;
        }

        .querypilot-public-site,
        .querypilot-public-site * {
          font-family:
            var(--font-sans),
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .querypilot-public-site .font-mono,
        .querypilot-public-site [class*="font-mono"] {
          font-family:
            var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, "Liberation Mono", monospace;
        }
      `}</style>

      <PublicNav />

      <main>
        <ProductPreview />

        <HeroMobile />
        <FeaturesSection />
      </main>
    </div>
  );
}

/* ============================================================

   Engineering Page

   ============================================================ */

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 ${dark ? "text-white" : ""}`}
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
            <Link href="/" className="text-xs text-white/60 hover:text-white">
              Product
            </Link>

            <Link
              href="/login"
              className="rounded-lg bg-white px-3.5 py-2.5 text-xs font-medium text-black transition-colors duration-200 hover:bg-white/85"
            >
              Open QueryPilot
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Engineering, system architecture
          </p>

          <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            A question becomes a path
            <br />
            through your workspace.
          </h1>

          <p className="mt-8 max-w-xl text-base leading-7 text-white/60">
            QueryPilot follows a simple flow. Understand the request, find the
            right data, check the evidence, then answer.
          </p>
        </div>

        <div className="mt-24 border border-white/15">
          <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Request lifecycle
            </span>

            <span className="font-mono text-[10px] text-white/40">
              QP / PIPELINE / 01
            </span>
          </div>

          <div className="grid md:grid-cols-5">
            {nodes.map((node, i) => (
              <div
                key={node.title}
                className="relative border-b border-white/15 p-5 md:border-b-0 md:border-r md:last:border-r-0"
              >
                <span className="font-mono text-[10px] text-white/45">
                  0{i + 1}
                </span>

                <h2 className="mt-10 text-sm font-medium">{node.title}</h2>

                <p className="mt-2 text-xs leading-5 text-white/50">
                  {node.copy}
                </p>

                {i < 4 && (
                  <ArrowRight
                    className="absolute right-3 top-1/2 hidden text-white/20 md:block"
                    size={15}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 grid gap-12 border-t border-white/15 pt-12 lg:grid-cols-3">
          <div>
            <p className="font-mono text-xs text-white/45">01 / SCOPE</p>

            <h2 className="mt-4 text-xl font-medium">
              Workspace context is the boundary.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Every question inherits an active workspace, making permissions
              and source selection explicit before retrieval begins.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs text-white/45">02 / GROUNDING</p>

            <h2 className="mt-4 text-xl font-medium">
              Evidence is a first-class output.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Answers are streamed with source references, page anchors, and the
              snippets that support each conclusion.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs text-white/45">03 / STREAMING</p>

            <h2 className="mt-4 text-xl font-medium">
              Useful before complete.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              The interface exposes progress through retrieval and reasoning so
              users can follow a response as it forms.
            </p>
          </div>
        </div>

        <div className="mt-24 flex flex-col gap-8 border-t border-white/15 pt-10 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl text-2xl font-medium tracking-[-0.04em]">
            The architecture stays invisible when it works. The evidence never
            should.
          </p>

          <Link
            href="/signup"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors duration-200 hover:bg-white/85"
          >
            Try the product
            <ArrowRight size={15} />
          </Link>
        </div>
      </main>
    </div>
  );
}