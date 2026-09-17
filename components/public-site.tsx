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

 *

 * Single source of truth for the warm beige used across the public site

 * (hero, mobile hero, page background, builder-section card grid, and now

 * the features section). Kept as a plain constant rather than a Tailwind

 * theme token so it can be dropped straight into arbitrary-value classes

 * and inline gradients without a config change.

 * --------------------------------------------------------------------------- */

const PAGE_BEIGE = "#F4EFE4";

/* ------------------------------------------------------------------------

 * Navbar theme detection

 *

 * The nav needs to flip between a light look (glass background, dark text)

 * and a dark look (near-black background, white text) depending on whatever

 * section is currently sitting underneath it. Rather than matching a

 * hardcoded whitelist of background colors (which silently breaks the

 * moment a section's background shade changes, e.g. #070707 vs #000000),

 * this reads the actual computed background color of whatever is under the

 * nav and classifies it as light/dark using relative luminance. The

 * classification logic is unchanged.

 *

 * PERF: elementFromPoint() and getComputedStyle() each force the browser to

 * flush pending style/layout work. Running that pair on every scroll frame —

 * which is what happened for every scroll position past ~0.92 viewports, i.e.

 * the entire Features section — steals frame budget from the pinned feature

 * scene. A frame that misses its budget gets presented with a stale pinned

 * scene, which is exactly what reads as "the section behind flashed through".

 * The sample is now taken on a scroll-distance interval. The theme only

 * changes at two section boundaries, so a 32px window is visually identical

 * and costs roughly a tenth as much.

 * ------------------------------------------------------------------------ */

const NAV_SAMPLE_EPSILON_PX = 32;

function parseRgbColor(color: string): [number, number, number, number] | null {
  const match = color.match(
    /rgba?\s*\(?\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)?/,
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
  const [darkTheme, setDarkTheme] = useState(true);

  useEffect(() => {
    let ticking = false;

    let lastSampleY = Number.NEGATIVE_INFINITY;

    const detectTheme = (force = false) => {
      ticking = false;

      const scrollY = window.scrollY;

      if (scrollY < window.innerHeight * 0.92) {
        lastSampleY = scrollY;

        setDarkTheme(true);

        return;
      }

      if (!force && Math.abs(scrollY - lastSampleY) < NAV_SAMPLE_EPSILON_PX) {
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

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);

      window.removeEventListener("resize", onResize);
    };
  }, []);

  const textClass = darkTheme ? "text-white" : "text-black";

  const mutedTextClass = darkTheme
    ? "text-white/75 hover:text-white"
    : "text-black/60 hover:text-black";

  const borderClass = darkTheme ? "border-white/[0.10]" : "border-black/[0.10]";

  const backgroundClass = darkTheme ? "bg-[#080808]/90" : "bg-white/90";

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

          flex

          h-[58px]

          w-full

          items-center

          justify-between

          rounded-none

          border

          ${borderClass}

          ${backgroundClass}

          px-5

          sm:px-6

          backdrop-blur-xl

          transition-colors

          duration-300

        `}
      >
        {/* LEFT */}

        <div className="flex items-center">
          {/* QueryPilot */}

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

          {/* Divider */}

          <span
            aria-hidden="true"
            className={`

              mx-4

              h-5

              w-px

              ${darkTheme ? "bg-white/10" : "bg-black/10"}

            `}
          />

          {/* GitHub */}

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

        {/* RIGHT */}

        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/engineering"
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
          </Link>

          <Link
            href="/login"
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
            Login
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

// Desktop hero frame: 15vw empty on the left and right.

// The shared 70vw frame is used by the navbar, hero copy, background image,

// and the resting product window.

const PAGE_FRAME_WIDTH_VW = 70;

// Resting product fills the horizontal frame.

const RESTING_DEMO_WIDTH_VW = 92;

const RESTING_DEMO_MIN_WIDTH = 780;

const RESTING_DEMO_MAX_WIDTH = 1500;

// Expanded center window: substantially larger than the old 43vw/560-760px

// frame so the product dominates the composition, per the architecture-diagram

// redesign. This is the single source of truth for expanded-demo geometry —

// process-cards.tsx never hardcodes a competing size, it just reads the real

// rendered window via mainWindowRef.

const DEMO_WIDTH_VW = 54;

const DEMO_MIN_WIDTH = 700;

const DEMO_MAX_WIDTH = 960;

const DEMO_DURATION_MS = 30000;

const DEMO_OPEN_START = 0.02;

const DEMO_RETURN_COMPLETE = 0.02;

const DEMO_RETURN_START = 0.74;

const CARD_DISMISS_START = 0.68;

const CARD_DISMISS_END = 0.82;

const DEMO_OPEN_DURATION_S = 0.82;

const EXPANDED_WINDOW_ASPECT = 27 / 20;

function StaticHeroHeading() {
  return (
    <h1 className="w-full text-[clamp(2.05rem,2.35vw,2.65rem)] font-normal leading-[1.04] tracking-[-0.045em] text-white">
      <span
        data-hero-title-line
        className="qp-hero-title-blur-hidden block whitespace-nowrap"
      >
        Don&apos;t just search your data.
      </span>

      <span data-hero-title-line className="qp-hero-title-blur-hidden block">
        Understand it.
      </span>
    </h1>
  );
}

function ProductPreview() {
  const sectionRef = useRef<HTMLElement | null>(null);

  const heroCopyRef = useRef<HTMLDivElement | null>(null);

  const sceneRef = useRef<HTMLDivElement | null>(null);

  const mainWindowRef = useRef<HTMLDivElement | null>(null);

  // The actual visible QueryPilot window box (the DemoWindowChrome

  // border), as opposed to mainWindowRef's outer positioning wrapper.

  // The six process-card connectors read their source point off this

  // element's real, responsive edge.

  const centerWindowRef = useRef<HTMLDivElement | null>(null);

  const processCardsRef = useRef<HTMLDivElement | null>(null);

  const restingBackgroundRef = useRef<HTMLDivElement | null>(null);

  const restingEntryRef = useRef<HTMLDivElement | null>(null);

  // Entrance-only refs. These control the first-load/reload reveal timeline

  // (title -> paragraph -> buttons -> card -> background) and are not

  // touched anywhere else — the existing scroll/demo render() logic never

  // reads or writes these two elements.

  const heroParagraphRef = useRef<HTMLParagraphElement | null>(null);

  const heroActionsRef = useRef<HTMLDivElement | null>(null);

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

  /*

   * PERF / FLICKER: the hero's scroll handler used to run for every scroll

   * position on the page, including the whole Features section. Each frame it

   * wrote width / height / top onto the demo window (layout-invalidating

   * properties, not composited ones) plus a changing blur() onto the process

   * cards, immediately after reading getBoundingClientRect(). That is a forced

   * layout and a full repaint of an off-screen ~1300px scene on every frame

   * the user spends scrolling the pinned feature scene.

   *

   * The demo clock had the same problem from the React side: setDemoElapsed()

   * at 60fps for 30 seconds, re-rendering the demo UI and six process cards,

   * even with the hero nowhere near the viewport.

   *

   * Both are now gated on hero visibility. A frame that overruns its budget is

   * presented with a stale pinned scene — that is what "the section behind

   * flashed through" actually is — so removing this work is the fix, not a

   * nice-to-have.

   */

  const heroOnScreenRef = useRef(true);

  const [heroOnScreen, setHeroOnScreen] = useState(true);

  /*

   * Demo clock.

   *

   * elapsed lives in a ref, not in the timer closure. The previous version

   * derived it as (performance.now() - started) inside an effect that bailed

   * out whenever the phase left "running", which produced two visible bugs:

   *

   *   1. Scrolling up mid-demo killed the loop for good. Scrolling back down

   *      set the phase to "complete" rather than "running", so the clock

   *      never restarted and the card sequence sat frozen.

   *   2. beginDemo() had a firstRun branch that slammed elapsed to

   *      DEMO_DURATION_MS on any re-entry. That made QueryPilotProcessCards

   *      resolve straight to the final stage, so all six process cards

   *      appeared at once with no staging and no active-dot pulse.

   *

   * With an accumulator the loop can idle through non-running phases and

   * resume exactly where it paused, and beginDemo can always replay the

   * sequence from zero.

   */

  const elapsedRef = useRef(0);

  const [demoActive, setDemoActive] = useState(false);

  const [demoElapsed, setDemoElapsed] = useState(0);

  // The large resting backdrop is not mounted until the product card has
  // completely entered. This prevents early image paint/load and keeps the
  // entrance sequence deterministic.
  const [showRestingBackgroundImage, setShowRestingBackgroundImage] =
    useState(false);

  const restingBackgroundReadyRef = useRef(false);

  useEffect(() => {
    if (!demoActive || !heroOnScreen) return;

    let raf = 0;

    let last = performance.now();

    const tick = (now: number) => {
      // Clamp the delta so a backgrounded tab / long frame can't fast-forward

      // the whole sequence in one step when the page becomes visible again.

      const delta = Math.min(now - last, 100);

      last = now;

      if (demoPhaseRef.current === "running") {
        const next = Math.min(elapsedRef.current + delta, DEMO_DURATION_MS);

        elapsedRef.current = next;

        setDemoElapsed(next);

        if (next >= DEMO_DURATION_MS) {
          demoPhaseRef.current = "complete";

          window.dispatchEvent(new Event("querypilot-demo-complete"));

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

      const distance = Math.max(section.offsetHeight - window.innerHeight, 1);

      return clamp01(-rect.top / distance);
    };

    const getGeometry = () => {
      const viewportHeight = window.innerHeight;

      // Shared 70vw content frame. The remaining 15vw on each side is empty.

      const frameWidth = window.innerWidth * (PAGE_FRAME_WIDTH_VW / 100);

      const desiredRestWidth = Math.min(
        frameWidth * (RESTING_DEMO_WIDTH_VW / 100),

        RESTING_DEMO_MAX_WIDTH,
      );

      const restWidth = Math.max(
        Math.min(desiredRestWidth, frameWidth),

        Math.min(RESTING_DEMO_MIN_WIDTH, frameWidth),
      );

      const restLeft = Math.max((frameWidth - restWidth) / 2, 0);

      const demoWidth = Math.min(
        Math.max(window.innerWidth * (DEMO_WIDTH_VW / 100), DEMO_MIN_WIDTH),

        DEMO_MAX_WIDTH,
      );

      const finalHeightFromWidth = demoWidth / EXPANDED_WINDOW_ASPECT;

      const finalDemoHeight = Math.min(
        finalHeightFromWidth,

        viewportHeight * 0.78,
      );

      // Expanded mode uses a taller architecture frame rather than the resting 2:1 ratio.

      const finalWidth = demoWidth;

      const finalLeft = (frameWidth - finalWidth) / 2;

      // The product card touches the bottom edge of the viewport.

      const restHeight = restWidth / MAIN_WINDOW_ASPECT;

      const restTop = viewportHeight - restHeight;

      return {
        restWidth,

        restLeft,

        finalWidth,

        finalLeft,

        restTop,

        finalDemoHeight,

        finalTop: Math.max(108, (viewportHeight - finalDemoHeight) / 2),
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

      const widthVisual = lerp(restWidth, finalWidth, visual);

      const heightVisual = lerp(
        restWidth / MAIN_WINDOW_ASPECT,

        finalDemoHeight,

        visual,
      );

      const topVisual = lerp(restTop, finalTop, visual);

      const leftVisual = lerp(restLeft, finalLeft, visual);

      const backgroundVisibility =
        phase === "resting"
          ? restingIntroCompleteRef.current
            ? 1
            : 0
          : phase === "returning"
            ? smoothstep(1 - visual)
            : 1 - smoothstep(clamp01((visual - 0.05) / 0.5));

      // During the resting entrance, the intro timeline owns the background.

      // Do not let scroll/resize renders stomp its opacity back to 0/1.

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

      // Copy and product expansion intentionally overlap. The text stays fixed

      // on the LEFT; it only fades/softens while the product window expands.

      const copyReveal =
        phase === "resting"
          ? 1
          : phase === "returning"
            ? smoothstep(1 - visual)
            : 1 - smoothstep(visual);

      gsap.set(heroCopy, {
        opacity: copyReveal,

        y: 0,

        scale: lerp(1, 0.985, 1 - copyReveal),

        filter: `blur(${lerp(2.25, 0, copyReveal)}px)`,

        force3D: true,
      });

      const cardsInDemoPhase =
        demoPhaseRef.current === "running" ||
        demoPhaseRef.current === "complete" ||
        demoPhaseRef.current === "returning";

      const cardVisibility =
        !demoPlayedRef.current || !cardsInDemoPhase || p <= DEMO_RETURN_COMPLETE
          ? 0
          : demoPhaseRef.current === "returning"
            ? p <= CARD_DISMISS_START
              ? 1
              : 1 -
                smoothstep(
                  clamp01(
                    (p - CARD_DISMISS_START) /
                      (CARD_DISMISS_END - CARD_DISMISS_START),
                  ),
                )
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
      if (demoPhaseRef.current !== "resting") return;

      // Always replay the sequence from the top. The old firstRun branch

      // jumped elapsed to DEMO_DURATION_MS on every re-entry, which is what

      // made the six process cards appear all at once with no staging.

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

      openTweenRef.current = tweenVisual(1, DEMO_OPEN_DURATION_S);
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

    const beginReturnToRest = (progress: number) => {
      if (!demoPlayedRef.current) return;

      if (progress <= DEMO_RETURN_COMPLETE) {
        resetDemoToRest();

        return;
      }

      openTweenRef.current?.kill();

      openTweenRef.current = null;

      demoPhaseRef.current = "returning";

      // The rAF loop stays alive here on purpose. The phase check inside it

      // pauses the clock; keeping the loop mounted is what lets the sequence

      // resume from its exact position if the user scrolls back down.

      // Reverse is owned directly by scroll position. This prevents a large

      // upward wheel/touch jump from skipping the cinematic return entirely.

      visualProgressRef.current = smoothstep(
        clamp01(
          (progress - DEMO_RETURN_COMPLETE) /
            (DEMO_RETURN_START - DEMO_RETURN_COMPLETE),
        ),
      );
    };

    /*

     * Scroll orchestration is intentionally stateful:

     * resting -> running/complete -> returning -> resting

     *

     * The previous implementation only called beginReturnToRest() on the

     * first frame that crossed the threshold. A high-velocity scroll could

     * cross both the "return" and "rest" thresholds in one browser frame,

     * leaving the cards painted while the window had already returned.

     *

     * Here every frame reconciles the phase against the current scroll

     * position. The page can therefore skip any number of intermediate

     * scroll positions without getting visually stuck.

     */

    const onScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;

        // Hero off-screen: no layout reads, no GSAP writes, nothing at all.

        // This is the frame budget the pinned feature scene needs.

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
          // Resume an unfinished sequence instead of forcing "complete",

          // which used to strand the clock wherever it paused.

          if (elapsedRef.current >= DEMO_DURATION_MS) {
            demoPhaseRef.current = "complete";
          } else {
            demoPhaseRef.current = "running";

            setDemoActive(true);
          }

          tweenVisual(1, 0.52);
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

        // While returning, continuously bind the visual state to the current

        // scroll progress so rapid upward movement still reveals the cards and

        // closes the main window in a deterministic way.

        if (demoPhaseRef.current === "returning" && p > DEMO_RETURN_COMPLETE) {
          visualProgressRef.current = smoothstep(
            clamp01(
              (p - DEMO_RETURN_COMPLETE) /
                (DEMO_RETURN_START - DEMO_RETURN_COMPLETE),
            ),
          );
        }

        smoothProgressRef.current = p;

        render(p);
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

      if (!heroOnScreenRef.current) return;

      render(getProgress());
    };

    // Visibility gate. The margin re-arms the hero slightly before it is

    // actually on screen, so its first visible frame is already correct.

    const visibilityObserver = new IntersectionObserver(

      (entries) => {
        const entry = entries[0];

        const onScreen = entry ? entry.isIntersecting : true;

        if (heroOnScreenRef.current === onScreen) return;

        heroOnScreenRef.current = onScreen;

        setHeroOnScreen(onScreen);

        if (onScreen) {
          lastScrollYRef.current = window.scrollY;

          smoothProgressRef.current = getProgress();

          render(smoothProgressRef.current);
        }
      },

      { rootMargin: "160px 0px 160px 0px" },

    );

    visibilityObserver.observe(section);

    const heroTitleLines = heroCopy.querySelectorAll<HTMLElement>(
      "[data-hero-title-line]",
    );

    // Establish the true entrance state before the initial render.

    // The browser must never paint the completed hero and then hide it.

    restingIntroCompleteRef.current =
      reduceMotion || heroTitleLines.length === 0;

    if (!restingIntroCompleteRef.current) {
      gsap.set(restingBackground, {
        opacity: 0,

        visibility: "hidden",
      });

      gsap.set(restingEntry, {
        opacity: 0,

        y: 16,

        scale: 0.985,
      });

      gsap.set(heroTitleLines, {
        opacity: 0,

        y: 14,

        filter: "blur(14px)",
      });

      gsap.set(heroParagraph, {
        opacity: 0,

        y: 10,
      });

      gsap.set(heroActions, {
        opacity: 0,

        y: 8,
      });
    } else {
      setShowRestingBackgroundImage(true);

      restingBackgroundReadyRef.current = true;

      restingIntroCompleteRef.current = true;

      gsap.set(restingBackground, {
        opacity: 1,

        visibility: "visible",
      });

      gsap.set(restingEntry, {
        opacity: 1,

        y: 0,

        scale: 1,
      });

      gsap.set(heroTitleLines, {
        opacity: 1,

        y: 0,

        filter: "blur(0px)",
      });

      gsap.set(heroParagraph, {
        opacity: 1,

        y: 0,
      });

      gsap.set(heroActions, {
        opacity: 1,

        y: 0,
      });
    }

    visualProgressRef.current = 0;

    smoothProgressRef.current = getProgress();

    lastScrollYRef.current = window.scrollY;

    render(smoothProgressRef.current);

    if (!reduceMotion && heroTitleLines.length > 0) {
      // First-load/reload entrance only. Isolated from the scroll/demo timeline.
      // It owns the text/card choreography and signals the deferred background
      // mount only after the product card has completely settled.

      const restingIntro = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      // Exact first-load sequence:
      // title (blur -> focus) -> description -> buttons -> product card -> background mount.
      // The background image is intentionally the LAST thing to enter —
      // it doesn't even mount into the DOM until this call() fires below,
      // and it then waits for its own load event before fading in.
      restingIntro.to(heroTitleLines, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.9,
        stagger: 0.1,
        ease: "power2.out",
      });

      restingIntro.to(heroParagraph, {
        opacity: 1,
        y: 0,
        duration: 0.38,
      });

      restingIntro.to(heroActions, {
        opacity: 1,
        y: 0,
        duration: 0.34,
      });

      restingIntro.to(restingEntry, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
      });

      // Only now does the background image enter the DOM. It is the final
      // step in the sequence and fades in on its own once loaded (see the
      // showRestingBackgroundImage effect below) — never before the card.
      restingIntro.call(() => {
        setShowRestingBackgroundImage(true);
      });
    }

    window.addEventListener("wheel", armUserScrollIntent, { passive: true });

    window.addEventListener("touchstart", armUserScrollIntent, {
      passive: true,
    });

    window.addEventListener("touchmove", armUserScrollIntent, {
      passive: true,
    });

    window.addEventListener("keydown", onKeyDown);

    window.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("resize", onResize);

    return () => {
      visibilityObserver.disconnect();

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

        restingBackground,

        restingEntry,

        heroParagraph,

        heroActions,

      ]);

      gsap.killTweensOf(heroTitleLines);
    };
  }, []);

  // Deferred backdrop reveal. The image is mounted only after the card
  // entrance. Wait for load/cache completion before fading it in so the user
  // never sees an unloaded or half-painted background.
  useLayoutEffect(() => {
    if (!showRestingBackgroundImage) return;

    const background = restingBackgroundRef.current;
    if (!background) return;

    const image = background.querySelector("img");
    if (!image) return;

    let cancelled = false;

    const reveal = () => {
      if (cancelled) return;

      restingBackgroundReadyRef.current = true;
      gsap.killTweensOf(background);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(background, {
          opacity: 1,
          visibility: "visible",
        });
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

    image.addEventListener("load", reveal, { once: true });
    image.addEventListener("error", reveal, { once: true });

    return () => {
      cancelled = true;
      image.removeEventListener("load", reveal);
      image.removeEventListener("error", reveal);
      gsap.killTweensOf(background);
    };
  }, [showRestingBackgroundImage]);

  const canDrag = () => {
    const section = sectionRef.current;

    if (!section) return false;

    const distance = Math.max(section.offsetHeight - window.innerHeight, 1);

    return clamp01(-section.getBoundingClientRect().top / distance) >= 0.9;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canDrag()) return;

    const drag = dragStateRef.current;

    drag.active = true;

    drag.pointerX = event.clientX;

    drag.pointerY = event.clientY;

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
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

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative hidden h-[220vh] w-full bg-[#0A0A0A] min-[901px]:block"
      aria-label="QueryPilot hero"
      /*

       * The hero scene uses z-50 / z-60 / z-75 / z-80 on overflow-visible

       * containers. Without a stacking context on the section itself, those

       * indices escape into the root. isolation:isolate confines the hero

       * scene to its own stacking context while the fixed navbar still wins.

       */

      style={{ isolation: "isolate" }}
    >
      <div className="sticky top-0 h-screen overflow-visible">
        <div
          className="relative mx-auto h-full w-[70vw] overflow-visible"
          style={{ marginLeft: "15vw", marginRight: "15vw" }}
        >
          <div
            ref={restingBackgroundRef}
            aria-hidden="true"
            className="qp-hero-entrance-hidden pointer-events-none absolute left-0 top-[34vh] z-0 h-[71vh] w-full overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0a0a]"
          >
            {showRestingBackgroundImage ? (
              <img
                src="/bg-img.png"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover object-center"
              />
            ) : null}

            <div className="absolute inset-0 bg-black/20" />
          </div>

          <div
            ref={heroCopyRef}
            className="hero-copy absolute left-0 top-[12vh] z-[80] flex w-[min(44%,520px)] max-w-[520px] flex-col items-start px-0 text-left will-change-[transform,opacity]"
          >
            <div className="w-full max-w-[500px]">
              <div className="flex justify-start overflow-visible">
                <StaticHeroHeading />
              </div>

              <p
                ref={heroParagraphRef}
                className="qp-hero-entrance-hidden mt-3 max-w-[410px] text-pretty text-[14px] leading-5.5 text-white/55"
              >
                QueryPilot works across documents and structured data. Ask your
                question and it finds the right source for you.
              </p>

              <div
                ref={heroActionsRef}
                className="qp-hero-entrance-hidden mt-4 flex items-center justify-start gap-2.5"
              >
                <PixelDissolveButton
                  label="Read engineering docs"
                  href="/engineering"
                  color="#ffffff"
                  dissolveColor="#808080"
                  cellSize={5}
                  className="!min-h-10 !rounded-[11px] !px-4 !text-sm !font-medium !normal-case !tracking-normal !bg-white !text-black"
                />

                <a
                  href="/login"
                  className="rounded-[11px] border border-white/20 px-4 py-2.5 text-sm font-normal text-white transition-colors hover:bg-white/10"
                >
                  Try QueryPilot
                </a>
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
                className="querypilot-resting-entry qp-hero-entrance-hidden relative z-10 h-full w-full"
              >
                {/*

                  Subtle neutral halo behind the window so the white product

                  surface separates cleanly from the black hero background.

                */}

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

                {/*

                  Soft neutral reflection so the window feels grounded against

                  the black surface rather than pasted on top of it.

                */}

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
                  className="absolute inset-0 z-[60] pointer-events-none will-change-[transform,opacity]"
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

      {/*

        This block is intentionally `jsx global`, not scoped `jsx`.

        `.qp-hero-entrance-hidden` is also used on the title-line spans,

        which live inside StaticHeroHeading — a separate component — so a

        scoped style tag (which only stamps elements returned by *this*

        component) would silently fail to hide them. Global CSS is also

        what makes this safe against the reload flash in the first place:

        it ships inside the server-rendered HTML and is parsed by the

        browser before first paint, unlike anything driven by

        useLayoutEffect/GSAP, which only runs after hydration. GSAP writes

        opacity as an inline style once it takes over, and inline style

        always wins over this class, so there's no fight between the two.

        `.qp-hero-title-blur-hidden` is the same idea but scoped to just the

        headline lines, which additionally start out-of-focus (blur) rather

        than only invisible, to match the reference blur-to-focus reveal.

      */}

      <style jsx global>{`
        .querypilot-resting-entry {
          transform: none;

          transform-origin: 50% 50%;

          will-change: auto;
        }

        .qp-hero-entrance-hidden {
          opacity: 0;
        }

        .qp-hero-title-blur-hidden {
          opacity: 0;

          filter: blur(14px);

          will-change: opacity, filter, transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .qp-hero-entrance-hidden {
            opacity: 1;
          }

          .qp-hero-title-blur-hidden {
            opacity: 1;

            filter: none;
          }
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

    return () => window.removeEventListener("scroll", onFirstScroll);
  }, [demoStarted]);

  useEffect(() => {
    if (!demoStarted) return;

    const started = performance.now();

    const duration = 30000;

    let raf = 0;

    // BUGFIX (perf): setInterval fires on its own clock regardless of

    // whether the browser is ready to paint, which can pile up work on

    // slower devices. requestAnimationFrame ties the update to the

    // browser's own paint cadence instead, so it never over-schedules.

    const tick = () => {
      const elapsed = Math.min(performance.now() - started, duration);

      setDemoElapsed(elapsed);

      if (elapsed < duration) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [demoStarted]);

  return (
    <section className="relative w-full overflow-hidden bg-[#0A0A0A] px-5 pb-[15vh] pt-[15vh] text-white min-[901px]:hidden">
      <div className="relative z-10 mx-auto w-full max-w-[720px] text-center">
        <h1 className="mx-auto max-w-[660px] text-[clamp(36px,9vw,58px)] font-normal leading-[1.02] tracking-[-0.045em] text-white">
          Don&apos;t just search your data.
          <span className="block">Understand it.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[520px] text-[16px] leading-6 text-white/55">
          Ask about your documents or business data without knowing which source
          has the answer.
        </p>

        <div className="relative mt-9 overflow-hidden rounded-[22px] border border-white/15 bg-[#090909] p-[2.6%] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <img
            src="/bg-img.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          />

          <div className="pointer-events-none absolute inset-0 bg-black/25" />

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] border border-white/15 bg-white sm:aspect-video">
            <QueryPilotApp elapsed={demoElapsed} />
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <PixelDissolveButton
            label="Read engineering docs"
            href="/engineering"
            color="#ffffff"
            dissolveColor="#808080"
            cellSize={5}
            className="!min-h-10 !rounded-[11px] !px-4 !text-sm !font-medium !normal-case !tracking-normal !bg-white !text-black"
          />

          <a
            href="/login"
            className="rounded-[11px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white"
          >
            Login
          </a>
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

    const delayed = window.setTimeout(forceTop, 120);

    return () => {
      window.cancelAnimationFrame(frame);

      window.clearTimeout(delayed);

      history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return (
    <div className="querypilot-public-site min-h-screen bg-[#0A0A0A] text-white">
      <style jsx global>{`
        html,
        body {
          background-color: #0a0a0a;

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
              className="rounded-lg bg-gradient-to-br from-[#007D51] to-[#007D51] px-3.5 py-2.5 text-xs font-medium text-white"
            >
              Open QueryPilot
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#007D51]">
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#007D51]">
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

                  <h2 className="mt-10 text-sm font-medium">{node.title}</h2>

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
            <p className="font-mono text-xs text-[#007D51]">01 / SCOPE</p>

            <h2 className="mt-4 text-xl font-medium">
              Workspace context is the boundary.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Every question inherits an active workspace, making permissions
              and source selection explicit before retrieval begins.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs text-[#007D51]">02 / GROUNDING</p>

            <h2 className="mt-4 text-xl font-medium">
              Evidence is a first-class output.
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Answers are streamed with source references, page anchors, and the
              snippets that support each conclusion.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs text-[#007D51]">03 / STREAMING</p>

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