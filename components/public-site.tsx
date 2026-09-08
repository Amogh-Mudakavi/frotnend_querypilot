"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import gsap from "gsap";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";

const BUILDER_EMAIL = "YOUR_EMAIL_HERE";
const GITHUB_URL = "https://github.com/YOUR_GITHUB_REPOSITORY";

/* ============================================================
   LANDING PAGE FEATURE TUNING
   ============================================================ */

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

  /*
   * Main desktop feature height.
   *
   * Previously:
   *   min-h-screen
   *
   * Now:
   *   approximately 70% viewport height.
   *
   * This removes the large empty region below
   * each generated visual while still leaving
   * enough breathing room.
   */
  featurePanelHeight:
    "clamp(560px, 70vh, 820px)",

  /*
   * The visual frame remains consistent
   * across all six technical features.
   */
  featureImageHeight:
    "clamp(265px, 38vh, 460px)",
};

/* ============================================================
   PublicNav
   ============================================================ */

export function PublicNav() {
  const [scrolled, setScrolled] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(
        window.scrollY > 10,
      );
    };

    handleScroll();

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      },
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [menuOpen]);

  const closeMenu = () =>
    setMenuOpen(false);

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

  return (
    <header
      className={`sticky top-0 z-[60] w-full border-b transition-[background,border-color,box-shadow] duration-200 ${
        scrolled
          ? "border-white/10 bg-[#0a0a0a]/97 shadow-[0_10px_34px_rgba(0,0,0,0.4)] backdrop-blur-[8px]"
          : "border-white/10 bg-[#0a0a0a]"
      }`}
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 w-[calc(100%-40px)] max-w-[1600px] items-center justify-between max-[768px]:h-14 max-[768px]:w-[calc(100%-28px)]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-8 max-[1100px]:gap-6 max-[900px]:gap-0">
          <Link
            href="/"
            aria-label="QueryPilot home"
            onClick={closeMenu}
            className="inline-flex flex-none items-center gap-2.5 whitespace-nowrap text-lg font-normal leading-none tracking-[-0.03em] text-white"
          >
            <img
              src="/querypilot-logo.svg"
              alt=""
              aria-hidden="true"
              className="h-6 w-6 flex-none object-contain"
            />

            <span className="block">
              QueryPilot
            </span>
          </Link>

          <div className="flex items-center gap-6 whitespace-nowrap max-[1100px]:gap-4 max-[900px]:hidden">
            {primaryLinks.map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-normal leading-none tracking-[-0.01em] text-white/75 transition-colors duration-150 hover:text-white"
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>

        <div className="flex h-full flex-none items-center gap-5 whitespace-nowrap max-[1100px]:gap-4">
          <Link
            href="/login"
            className="hidden text-sm font-normal leading-none tracking-[-0.01em] text-white/75 transition-colors duration-150 hover:text-white min-[901px]:inline-flex"
          >
            Login
          </Link>

          <div className="hidden h-full items-center min-[901px]:flex">
            <PixelDissolveButton
              href="/signup"
              label="GET STARTED"
              className="!min-w-0 !min-h-[38px] !rounded-none !py-0 !pl-5 !pr-6 !text-xs !font-medium !tracking-[0.01em] hover:!translate-y-0"
            />
          </div>

          <Link
            href="/login"
            className="text-xs font-medium text-white/80 transition-colors hover:text-white min-[901px]:hidden"
          >
            Login
          </Link>

          <div className="min-[901px]:hidden">
            <PixelDissolveButton
              href="/signup"
              label="Start"
              className="!min-w-0 !min-h-[34px] !rounded-none !py-0 !pl-3.5 !pr-4 !text-[11px] !font-medium !tracking-[0.01em] hover:!translate-y-0"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setMenuOpen(
                (prev) => !prev,
              )
            }
            aria-label={
              menuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            className="relative flex h-9 w-9 flex-none flex-col items-center justify-center gap-[5px] border-0 bg-transparent p-0 min-[901px]:hidden"
          >
            <span
              className={`h-0.5 w-[20px] origin-center bg-white transition-transform duration-200 max-[900px]:transition-none ${
                menuOpen
                  ? "translate-y-[6px] rotate-45"
                  : ""
              }`}
            />

            <span
              className={`h-0.5 bg-white transition-all duration-200 max-[900px]:transition-none ${
                menuOpen
                  ? "w-0 opacity-0"
                  : "w-[20px] opacity-100"
              }`}
            />

            <span
              className={`h-0.5 w-[20px] origin-center bg-white transition-transform duration-200 max-[900px]:transition-none ${
                menuOpen
                  ? "-translate-y-[6px] -rotate-45"
                  : ""
              }`}
            />
          </button>
        </div>
      </nav>

      <div
        id="mobile-navigation"
        className={`nav-mobile-panel fixed left-0 right-0 top-14 z-[55] overflow-hidden border-b border-white/10 bg-[#0a0a0a]/98 min-[901px]:hidden ${
          menuOpen
            ? "nav-mobile-panel--open"
            : ""
        }`}
      >
        <div className="mx-auto w-[calc(100%-28px)] max-w-[600px] py-2 pb-6">
          {primaryLinks.map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="flex min-h-14 items-center justify-between border-b border-white/10 px-1 text-base tracking-[-0.02em] text-white transition-[color,padding] hover:pl-2 hover:text-[#007D51] [&:hover_span:last-child]:text-[#007D51] max-[900px]:transition-none max-[900px]:hover:pl-1"
              >
                <span>
                  {link.label}
                </span>

                <span>→</span>
              </Link>
            ),
          )}
        </div>
      </div>

      <style jsx>{`
        .nav-mobile-panel {
          max-height: 0;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);

          transition:
            max-height 300ms ease,
            opacity 220ms ease,
            transform 220ms ease,
            visibility 220ms ease;
        }

        .nav-mobile-panel--open {
          max-height: calc(100vh - 56px);
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          overflow-y: auto;
        }

        @media (max-width: 900px) {
          .nav-mobile-panel {
            transition: none;
            transform: none;
          }

          .nav-mobile-panel--open {
            transform: none;
          }
        }
      `}</style>
    </header>
  );
}

/* ============================================================
   HeroVideo
   ============================================================ */

function HeroVideo({
  className = "",
  disableAnimation = false,
}: {
  className?: string;
  disableAnimation?: boolean;
}) {
  const videoRef =
    useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] =
    useState(false);

  const [currentTime, setCurrentTime] =
    useState(0);

  const [duration, setDuration] =
    useState(0);

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    const syncTime = () => {
      setCurrentTime(
        video.currentTime,
      );
    };

    const syncDuration = () => {
      setDuration(
        Number.isFinite(
          video.duration,
        )
          ? video.duration
          : 0,
      );
    };

    const syncPlaying = () => {
      setPlaying(
        !video.paused,
      );
    };

    video.addEventListener(
      "timeupdate",
      syncTime,
    );

    video.addEventListener(
      "loadedmetadata",
      syncDuration,
    );

    video.addEventListener(
      "durationchange",
      syncDuration,
    );

    video.addEventListener(
      "play",
      syncPlaying,
    );

    video.addEventListener(
      "pause",
      syncPlaying,
    );

    void video
      .play()
      .catch(() => {
        setPlaying(false);
      });

    return () => {
      video.removeEventListener(
        "timeupdate",
        syncTime,
      );

      video.removeEventListener(
        "loadedmetadata",
        syncDuration,
      );

      video.removeEventListener(
        "durationchange",
        syncDuration,
      );

      video.removeEventListener(
        "play",
        syncPlaying,
      );

      video.removeEventListener(
        "pause",
        syncPlaying,
      );
    };
  }, []);

  const togglePlay =
    async () => {
      const video =
        videoRef.current;

      if (!video) {
        return;
      }

      if (video.paused) {
        await video
          .play()
          .catch(
            () => undefined,
          );
      } else {
        video.pause();
      }
    };

  const seek = (
    value: number,
  ) => {
    const video =
      videoRef.current;

    if (
      !video ||
      !Number.isFinite(
        video.duration,
      )
    ) {
      return;
    }

    video.currentTime =
      value;

    setCurrentTime(value);
  };

  const formatTime = (
    value: number,
  ) => {
    if (
      !Number.isFinite(value)
    ) {
      return "0:00";
    }

    const minutes =
      Math.floor(value / 60);

    const seconds =
      Math.floor(value % 60);

    return `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        playing
          ? "Pause video"
          : "Play video"
      }
      onClick={togglePlay}
      onKeyDown={(
        event,
      ) => {
        if (
          event.key ===
            "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          void togglePlay();
        }
      }}
      className={`absolute inset-0 cursor-pointer overflow-hidden bg-black ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source
          src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
          type="video/mp4"
        />
      </video>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-20 grid place-items-center ${
          disableAnimation
            ? ""
            : "transition-opacity duration-200"
        } ${
          playing
            ? "opacity-0"
            : "opacity-100"
        }`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Play
            size={22}
            strokeWidth={1.8}
            fill="currentColor"
          />
        </span>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-30 px-5 pb-4"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(
              event,
            ) => {
              event.stopPropagation();
              void togglePlay();
            }}
            aria-label={
              playing
                ? "Pause video"
                : "Play video"
            }
            className="group grid h-7 w-7 flex-none place-items-center border-0 bg-transparent p-0 text-white/80 transition-colors hover:text-white focus-visible:outline-none"
          >
            {playing ? (
              <Pause
                size={13}
                strokeWidth={1.8}
                fill="currentColor"
              />
            ) : (
              <Play
                size={13}
                strokeWidth={1.8}
                fill="currentColor"
              />
            )}
          </button>

          <span className="w-8 flex-none text-[9px] font-mono tabular-nums tracking-tight text-white/60">
            {formatTime(
              currentTime,
            )}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(
              currentTime,
              duration || 0,
            )}
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onChange={(
              event,
            ) =>
              seek(
                Number(
                  event.target
                    .value,
                ),
              )
            }
            aria-label="Seek video"
            className="video-seek min-w-0 flex-1 cursor-pointer"
          />

          <span className="w-8 flex-none text-right text-[9px] font-mono tabular-nums tracking-tight text-white/40">
            {formatTime(
              duration,
            )}
          </span>
        </div>
      </div>

      <style jsx>{`
        .video-seek {
          appearance: none;
          -webkit-appearance: none;
          height: 2px;
          width: 100%;
          background: rgba(255, 255, 255, 0.22);
          outline: none;
          border: 0;
        }

        .video-seek::-webkit-slider-runnable-track {
          height: 2px;
          background: rgba(255, 255, 255, 0.22);
          border: 0;
        }

        .video-seek::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;
          width: 7px;
          height: 7px;
          margin-top: -2.5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          border: 0;
          opacity: 0.85;
          transition: none;
        }

        .video-seek:hover::-webkit-slider-thumb {
          transform: scale(1.25);
          opacity: 1;
        }

        .video-seek::-moz-range-track {
          height: 2px;
          background: rgba(255, 255, 255, 0.22);
          border: 0;
        }

        .video-seek::-moz-range-thumb {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          border: 0;
          opacity: 0.85;
        }

        .video-seek:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   useHeroScrollProgress
   ============================================================ */

function useHeroScrollProgress() {
  const [progress, setProgress] =
    useState(0);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      const stage =
        document.getElementById(
          "landing-hero-stage",
        );

      if (!stage) {
        return;
      }

      const rect =
        stage.getBoundingClientRect();

      const range = Math.max(
        1,
        stage.offsetHeight -
          window.innerHeight,
      );

      const travelled =
        Math.min(
          range,
          Math.max(
            0,
            -rect.top,
          ),
        );

      setProgress(
        travelled / range,
      );
    };

    const onScroll = () => {
      if (raf) {
        return;
      }

      raf =
        window.requestAnimationFrame(
          () => {
            raf = 0;
            update();
          },
        );
    };

    update();

    window.addEventListener(
      "scroll",
      onScroll,
      {
        passive: true,
      },
    );

    window.addEventListener(
      "resize",
      onScroll,
    );

    return () => {
      if (raf) {
        window.cancelAnimationFrame(
          raf,
        );
      }

      window.removeEventListener(
        "scroll",
        onScroll,
      );

      window.removeEventListener(
        "resize",
        onScroll,
      );
    };
  }, []);

  return progress;
}

const smoothStep = (
  value: number,
) => {
  const x = Math.min(
    1,
    Math.max(0, value),
  );

  return (
    x *
    x *
    (3 - 2 * x)
  );
};

/* ============================================================
   HeroTitleLines
   ============================================================ */

type CharEntry = {
  el: HTMLSpanElement;
  duplicated: boolean;
};

function buildSplitStructure(
  h1: HTMLHeadingElement,
  lines: string[],
): {
  lineEls: HTMLSpanElement[];
  charsByLine: CharEntry[][];
} {
  h1.innerHTML = "";

  const lineEls: HTMLSpanElement[] =
    [];

  const charsByLine: CharEntry[][] =
    [];

  lines.forEach(
    (lineText) => {
      const lineEl =
        document.createElement(
          "span",
        );

      lineEl.className =
        "hero-line";

      const wordEl =
        document.createElement(
          "span",
        );

      wordEl.className =
        "hero-word";

      const chars: CharEntry[] =
        [];

      const words =
        lineText.split(" ");

      words.forEach(
        (
          word,
          wordIndex,
        ) => {
          const chunk =
            Array.from(word);

          chunk.forEach(
            (character) => {
              const charIndex =
                chars.length;

              const lower =
                character.toLowerCase();

              const duplicated =
                ![
                  "y",
                  "p",
                  "q",
                ].includes(
                  lower,
                ) &&
                (charIndex % 5 ===
                  0 ||
                  charIndex % 8 ===
                    0);

              const charEl =
                document.createElement(
                  "span",
                );

              charEl.className =
                duplicated
                  ? "hero-char hero-char--duplicated"
                  : "hero-char";

              if (duplicated) {
                charEl.innerHTML =
                  `${character}<br />${character}`;
              } else {
                charEl.textContent =
                  character;
              }

              wordEl.appendChild(
                charEl,
              );

              chars.push({
                el: charEl,
                duplicated,
              });
            },
          );

          if (
            wordIndex <
            words.length - 1
          ) {
            const spaceEl =
              document.createElement(
                "span",
              );

            spaceEl.className =
              "hero-char";

            spaceEl.innerHTML =
              "&nbsp;";

            wordEl.appendChild(
              spaceEl,
            );

            chars.push({
              el: spaceEl,
              duplicated:
                false,
            });
          }
        },
      );

      lineEl.appendChild(
        wordEl,
      );

      h1.appendChild(
        lineEl,
      );

      lineEls.push(lineEl);
      charsByLine.push(
        chars,
      );
    },
  );

  return {
    lineEls,
    charsByLine,
  };
}

function HeroTitleLines({
  visible,
  h1ClassName,
}: {
  visible: boolean;
  h1ClassName: string;
}) {
  const h1Ref =
    useRef<HTMLHeadingElement>(
      null,
    );

  const lines = [
    "Don\u2019t just search your data.",
    "Understand it.",
  ];

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    const h1 = h1Ref.current;

    if (!h1) {
      return;
    }

    const ctx = gsap.context(
      () => {
        const {
          lineEls,
          charsByLine,
        } =
          buildSplitStructure(
            h1,
            lines,
          );

        const naturalHeights =
          lineEls.map(
            (lineEl) =>
              lineEl.offsetHeight,
          );

        const totalHeight =
          naturalHeights.reduce(
            (
              sum,
              value,
            ) => sum + value,
            0,
          );

        gsap.set(h1, {
          display: "flex",
          flexDirection:
            "column",
          justifyContent:
            "flex-end",
          height:
            totalHeight,
          overflow:
            "hidden",
          opacity: 1,
        });

        lineEls.forEach(
          (
            lineEl,
            lineIndex,
          ) => {
            lineEl.style.display =
              "block";

            lineEl.style.overflow =
              "hidden";

            lineEl.style.whiteSpace =
              "nowrap";

            lineEl.style.height =
              lineIndex === 0
                ? `${naturalHeights[0]}px`
                : "0px";

            lineEl.style.flex =
              "0 0 auto";

            lineEl.style.transform =
              "translate3d(0, 0, 0)";
          },
        );

        const randomInt = (
          min: number,
          max: number,
        ) =>
          Math.floor(
            Math.random() *
              (max - min + 1),
          ) + min;

        const timeline =
          gsap.timeline({
            paused: false,

            onComplete:
              () => {
                h1.setAttribute(
                  "aria-label",
                  lines.join(" "),
                );

                lineEls.forEach(
                  (
                    lineEl,
                  ) => {
                    lineEl.setAttribute(
                      "aria-hidden",
                      "true",
                    );
                  },
                );
              },
          });

        const firstLineChars =
          charsByLine[0].map(
            (entry) =>
              entry.el,
          );

        timeline.fromTo(
          firstLineChars,
          {
            y: "100%",
          },
          {
            y: (
              index: number,
            ) =>
              charsByLine[0][
                index
              ].duplicated
                ? "-50%"
                : "0%",

            duration: 1,

            ease: "power4.inOut",

            stagger: (
              index: number,
            ) =>
              index *
              randomInt(
                1,
                5,
              ) *
              0.005,
          },
          0,
        );

        const secondLineChars =
          charsByLine[1].map(
            (entry) =>
              entry.el,
          );

        const secondLineStart =
          1.15;

        timeline.fromTo(
          lineEls[1],
          {
            height: 0,
          },
          {
            height:
              naturalHeights[1],
            duration: 1.05,
            ease: "power4.inOut",
          },
          secondLineStart,
        );

        timeline.fromTo(
          secondLineChars,
          {
            y: "100%",
          },
          {
            y: (
              index: number,
            ) =>
              charsByLine[1][
                index
              ].duplicated
                ? "-50%"
                : "0%",

            duration: 1,

            ease: "power4.inOut",

            stagger: (
              index: number,
            ) =>
              index *
              randomInt(
                1,
                5,
              ) *
              0.005,
          },
          secondLineStart,
        );
      },
      h1Ref,
    );

    return () => {
      ctx.revert();

      if (h1Ref.current) {
        h1Ref.current.innerHTML =
          "";

        h1Ref.current.removeAttribute(
          "aria-label",
        );
      }
    };
  }, [visible]);

  return (
    <>
      <h1
        ref={h1Ref}
        className={
          h1ClassName
        }
        style={{
          opacity:
            visible
              ? undefined
              : 0,

          fontFamily:
            '"ALTMistral", sans-serif',

          fontWeight: 500,

          fontKerning:
            "none",
        }}
      />

      <style jsx global>{`
        .hero-line {
          display: block;
          width: max-content;
          max-width: none;
          overflow: hidden;
          white-space: nowrap;
          line-height: inherit;
        }

        .hero-line + .hero-line {
          margin-top: -0.58em;
        }

        .hero-word {
          display: inline-flex;
          width: max-content;
          max-width: none;
          white-space: nowrap;
          line-height: inherit;
        }

        .hero-char,
        .hero-char--duplicated {
          display: inline-block;
          color: #ffffff;
          line-height: inherit;
        }
      `}</style>
    </>
  );
}

/* ============================================================
   Box3CosmicField
   ============================================================ */

function Box3CosmicField({
  activeProgress,
}: {
  activeProgress: number;
}) {
  const hostRef =
    useRef<HTMLDivElement | null>(null);
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const sunRef =
    useRef<HTMLDivElement | null>(null);
  const haloRef =
    useRef<HTMLDivElement | null>(null);
  const raysRef =
    useRef<HTMLDivElement | null>(null);

  const progressRef =
    useRef(activeProgress);
  const mouseRef = useRef({
    x: 0,
    y: 0,
  });
  const smoothRef = useRef({
    x: 0,
    y: 0,
  });
  const haloSmoothRef =
    useRef({
      x: 0,
      y: 0,
    });
  const rafRef = useRef(0);

  useEffect(() => {
    progressRef.current = activeProgress;
  }, [activeProgress]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;

    if (!host || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let width = 1;
    let height = 1;
    let dpr = 1;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      alpha: number;
      phase: number;
    }> = [];

    const resize = () => {
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
      );

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0,
      );

      particles = Array.from(
        { length: 520 },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          size:
            0.45 +
            Math.random() * 1.45,
          alpha:
            0.10 +
            Math.random() * 0.42,
          phase: Math.random() *
            Math.PI * 2,
        }),
      );

      smoothRef.current.x =
        width * 0.5;
      smoothRef.current.y =
        height * 0.58;
      haloSmoothRef.current.x =
        width * 0.5;
      haloSmoothRef.current.y =
        height * 0.58;
    };

    resize();

    const resizeObserver =
      new ResizeObserver(resize);
    resizeObserver.observe(host);

    const onMouseMove = (
      event: MouseEvent,
    ) => {
      const rect =
        host.getBoundingClientRect();

      mouseRef.current.x =
        event.clientX - rect.left;
      mouseRef.current.y =
        event.clientY - rect.top;
    };

    window.addEventListener(
      'mousemove',
      onMouseMove,
      { passive: true },
    );

    const animate = (time: number) => {
      const progress =
        progressRef.current;
      const visibility =
        Math.max(
          0,
          Math.min(
            1,
            (progress - 0.10) /
              0.46,
          ),
        );

      ctx.clearRect(
        0,
        0,
        width,
        height,
      );

      if (visibility > 0) {
        smoothRef.current.x +=
          (mouseRef.current.x -
            smoothRef.current.x) *
          0.16;
        smoothRef.current.y +=
          (mouseRef.current.y -
            smoothRef.current.y) *
          0.16;

        haloSmoothRef.current.x +=
          (mouseRef.current.x -
            haloSmoothRef.current.x) *
          0.05;
        haloSmoothRef.current.y +=
          (mouseRef.current.y -
            haloSmoothRef.current.y) *
          0.05;

        const sx =
          smoothRef.current.x;
        const sy =
          smoothRef.current.y;

        const influence =
          230 +
          80 * visibility;

        for (const particle of particles) {
          const dx =
            particle.x - sx;
          const dy =
            particle.y - sy;
          const dist =
            Math.hypot(dx, dy);
          const field = Math.max(
            0,
            1 - dist / influence,
          );

          let x = particle.x;
          let y = particle.y;

          if (field > 0) {
            const nx =
              (sx - particle.x) /
              (dist || 1);
            const ny =
              (sy - particle.y) /
              (dist || 1);
            const tx = -ny;
            const ty = nx;

            const radial =
              (8 +
                54 * field * field) *
              field;
            const swirl =
              (5 + 38 * field) *
              field;

            x +=
              nx * radial *
              visibility;
            y +=
              ny * radial *
              visibility;
            x +=
              tx * swirl *
              visibility;
            y +=
              ty * swirl *
              visibility;
          }

          const twinkle =
            0.72 +
            0.28 *
              Math.sin(
                time * 0.0012 +
                  particle.phase,
              );

          ctx.beginPath();
          ctx.arc(
            x,
            y,
            particle.size *
              (1 + field * 0.85),
            0,
            Math.PI * 2,
          );
          ctx.fillStyle =
            `rgba(128, 255, 222, ${Math.min(
              0.88,
              (particle.alpha +
                field * 0.66) *
                twinkle *
                visibility,
            )})`;
          ctx.fill();

          if (field > 0.08) {
            ctx.beginPath();
            ctx.moveTo(
              particle.x,
              particle.y,
            );
            ctx.lineTo(x, y);
            ctx.strokeStyle =
              `rgba(83, 255, 216, ${
                field *
                0.16 *
                visibility
              })`;
            ctx.lineWidth =
              0.35 + field * 0.55;
            ctx.stroke();
          }
        }
      }

      const alpha = visibility;

      if (sunRef.current) {
        sunRef.current.style.left =
          `${smoothRef.current.x}px`;
        sunRef.current.style.top =
          `${smoothRef.current.y}px`;
        sunRef.current.style.opacity =
          `${alpha}`;
      }

      if (haloRef.current) {
        haloRef.current.style.left =
          `${haloSmoothRef.current.x}px`;
        haloRef.current.style.top =
          `${haloSmoothRef.current.y}px`;
        haloRef.current.style.opacity =
          `${alpha}`;
      }

      if (raysRef.current) {
        raysRef.current.style.left =
          `${haloSmoothRef.current.x}px`;
        raysRef.current.style.top =
          `${haloSmoothRef.current.y}px`;
        raysRef.current.style.opacity =
          `${alpha}`;
      }

      rafRef.current =
        window.requestAnimationFrame(
          animate,
        );
    };

    rafRef.current =
      window.requestAnimationFrame(
        animate,
      );

    return () => {
      window.cancelAnimationFrame(
        rafRef.current,
      );
      resizeObserver.disconnect();
      window.removeEventListener(
        'mousemove',
        onMouseMove,
      );
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      style={{
        opacity:
          activeProgress > 0.08
            ? 1
            : 0,
        transition:
          'opacity 500ms ease',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />

      <div
        ref={raysRef}
        className="box3-sun-rays absolute left-0 top-0 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />

      <div
        ref={haloRef}
        className="box3-sun-halo absolute left-0 top-0 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />

      <div
        ref={sunRef}
        className="box3-sun absolute left-0 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
    </div>
  );
}

/* ============================================================
   HeroTransition
   ============================================================ */

function HeroTransition() {
  const progress =
    useHeroScrollProgress();

  const p =
    smoothStep(progress);

  const [
    titleVisible,
    setTitleVisible,
  ] = useState(false);

  const [
    videoVisible,
    setVideoVisible,
  ] = useState(false);

  useEffect(() => {
    const titleFrame =
      window.requestAnimationFrame(
        () => {
          setTitleVisible(true);
        },
      );

    const videoTimer =
      window.setTimeout(() => {
        setVideoVisible(true);
      }, 280);

    return () => {
      window.cancelAnimationFrame(
        titleFrame,
      );
      window.clearTimeout(
        videoTimer,
      );
    };
  }, []);

  const frameLeft = 0;

  const frameWidth = 100;

  const splitX =
    frameWidth *
    0.64 *
    (1 - p);

  const splitY =
    50 + 50 * p;

  const heroLeft =
    frameLeft;

  const heroTop = 0;

  const heroWidth =
    splitX;

  const heroHeight =
    splitY;

  const videoLeft =
    frameLeft;

  const videoTop =
    50 - 45 * p;

  const videoWidth =
    splitX;

  const videoHeight =
    Math.max(
      0,
      50 * (1 - p),
    );

  const box3Left =
    frameLeft + splitX;

  const box3Top = 0;

  const box3Width =
    frameWidth - splitX;

  const rightSplitY =
    58 + 42 * p;

  const box3Height =
    rightSplitY;

  const box4Left =
    frameLeft + splitX;

  const box4Top =
    rightSplitY;

  const box4Width =
    frameWidth - splitX;

  const box4Height =
    100 - rightSplitY;

  const restInsetPx = 40;

  const textLeft =
    `calc(${restInsetPx}px + (50% - ${restInsetPx}px) * ${p})`;

  const textTop =
    `${80 - 30 * p}%`;

  const textTranslateX =
    `-${50 * p}%`;

  const globeProgress =
    smoothStep(
      Math.max(
        0,
        Math.min(
          1,
          (p - 0.10) /
            0.72,
        ),
      ),
    );

  const mouseFieldProgress =
    Math.max(
      0,
      Math.min(
        1,
        (p - 0.08) /
          0.58,
      ),
    );

  return (
    <section
      id="landing-hero-stage"
      className="relative hidden h-[190vh] w-full bg-black min-[901px]:block"
    >
      <div className="sticky top-16 h-[calc(100vh-64px)] w-full overflow-hidden">
        <div className="relative mx-auto h-full w-[calc(100%-12px)] max-w-[1600px]">
          {/* BOX 1 — TITLE */}

          <div
            className="absolute"
            style={{
              left: `${heroLeft}%`,
              top: `${heroTop}%`,
              width: `${heroWidth}%`,
              height: `${heroHeight}%`,
              opacity: 1 - p,
              willChange:
                'width, height, opacity',
            }}
          >
            <div className="flex h-full w-full items-end overflow-hidden p-[clamp(20px,3vw,40px)] pb-0">
              <div
                className="hero-title-motion"
                style={{
                  transform: `
                    translate3d(0, -${p * 135}vh, 0)
                    scale(${1 - p * 0.08})
                  `,
                  opacity:
                    Math.max(
                      0,
                      1 -
                        Math.min(
                          1,
                          p / 0.34,
                        ),
                    ),
                  transformOrigin:
                    'left bottom',
                }}
              >
                <HeroTitleLines
                  visible={
                    titleVisible
                  }
                  h1ClassName="w-max max-w-none text-[clamp(28px,4.2vw,74px)] font-medium leading-[0.88] tracking-[-0.06em] text-white"
                />
              </div>
            </div>
          </div>

          {/* BOX 2 — VIDEO */}

          <div
            className="absolute overflow-hidden"
            style={{
              left: `${videoLeft}%`,
              top: `${videoTop}%`,
              width: `${videoWidth}%`,
              height: `${videoHeight}%`,
              opacity: 1 - p,
              willChange:
                'width, height, opacity',
            }}
          >
            <div
              className="hero-video-reveal h-full w-full"
              style={{
                opacity:
                  videoVisible
                    ? 1
                    : 0,
                transform:
                  videoVisible
                    ? 'translate3d(0, 0, 0)'
                    : 'translate3d(0, 100%, 0)',
                transition:
                  'opacity 850ms cubic-bezier(0.16,1,0.3,1), transform 850ms cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div
                className="relative h-full w-full"
                style={{
                  transformOrigin:
                    'left top',
                }}
              >
                <HeroVideo />
              </div>
            </div>
          </div>

          {/* BOX 3 — STATEMENT */}

          <div
            className="absolute z-20 overflow-hidden bg-[#111111]"
            style={{
              left: `${box3Left}%`,
              top: `${box3Top}%`,
              width: `${box3Width}%`,
              height: `${box3Height}%`,
              willChange:
                'left, width, height',
            }}
          >
            {/* Expanding-world atmosphere — hidden in the resting state. */}
            <div
              aria-hidden="true"
              className="box3-atmosphere absolute inset-0 z-0"
              style={{
                opacity:
                  globeProgress,
              }}
            />

            {/* Globe appears slowly from the bottom only as Box 3 expands. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 overflow-hidden"
              style={{
                opacity:
                  globeProgress *
                  0.94,
                transform: `translate3d(0, ${
                  14 -
                  globeProgress *
                    14
                }%, 0) scale(${(
                  1.035 -
                  globeProgress *
                    0.035
                ).toFixed(3)})`,
                transformOrigin:
                  '50% 100%',
                transition:
                  'opacity 160ms linear, transform 160ms linear',
              }}
            >
              <img
                src="/querypilot-globe.png"
                alt=""
                draggable={false}
                className="block h-auto w-[126%] max-w-none -translate-x-[10.2%] object-contain object-bottom mix-blend-screen"
                style={{
                  filter:
                    'contrast(1.04) saturate(1.08) brightness(0.9)',
                }}
              />
              <div
                aria-hidden="true"
                className="box3-globe-fade absolute inset-x-0 bottom-0 h-[42%]"
              />
            </div>

            {/* Interactive mouse light + swirl field. */}
            <Box3CosmicField
              activeProgress={
                mouseFieldProgress
              }
            />

            {/* Fine green rim light behind the globe. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[-16%] left-1/2 z-[15] h-[36%] w-[80%] -translate-x-1/2 rounded-[50%]"
              style={{
                opacity:
                  globeProgress *
                  0.72,
              }}
            />

            <div className="relative z-30 h-full w-full overflow-hidden p-[clamp(20px,3vw,56px)]">
              <p
                className="absolute overflow-hidden break-words text-white"
                style={{
                  width: `min(${
                    p > 0.42
                      ? '720px'
                      : '420px'
                  }, calc(100% - ${
                    restInsetPx * 2
                  }px))`,
                  maxWidth:
                    'calc(100% - 40px)',
                  left: textLeft,
                  top: textTop,
                  transform:
                    `translate(${textTranslateX}, -50%)`,
                  /*
                   * Resting state stays essentially
                   * identical; only the expanded phase
                   * gets the tighter, calmer type scale.
                   */
                  fontSize: `clamp(20px, ${
                    1.3 +
                    0.45 * p
                  }vw, ${
                    28 +
                    6 * p
                  }px)`,
                  lineHeight:
                    p > 0.5
                      ? 1.08
                      : 1.16,
                  letterSpacing:
                    p > 0.5
                      ? '-0.034em'
                      : '-0.026em',
                  textAlign:
                    p >= 0.55
                      ? 'center'
                      : 'left',
                  margin: '0',
                  overflowWrap:
                    'anywhere',
                  fontWeight: 500,
                  transition:
                    'left 100ms ease-out, top 100ms ease-out, transform 100ms ease-out',
                }}
              >
                QueryPilot is an AI retrieval
                system built to understand,
                query, and ground knowledge
                across your data.
              </p>
            </div>
          </div>

          {/* BOX 4 — FEATURE CARD */}

          <div
            className="absolute"
            style={{
              left: `${box4Left}%`,
              top: `${box4Top}%`,
              width: `${box4Width}%`,
              height: `${box4Height}%`,
              opacity: 1 - p,
              willChange:
                'left, top, width, height, opacity',
            }}
          >
            <Link
              href="/engineering"
              className="group flex h-full w-full flex-col justify-end p-[clamp(16px,2vw,32px)] pb-[clamp(22px,2.4vw,32px)]"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#007D51]">
                Featured / Engineering
              </span>

              <div className="mt-3 flex items-center justify-between gap-6 pt-4">
                <p className="max-w-[430px] text-sm leading-6 text-neutral-400 transition-colors group-hover:text-white">
                  How retrieval, grounding, and
                  citations actually work under
                  the hood.
                </p>

                <ArrowRight
                  size={17}
                  className="flex-none text-neutral-500 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-[#007D51] max-[900px]:transition-none max-[900px]:group-hover:translate-x-0"
                />
              </div>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-title-motion,
        .hero-video-reveal {
          will-change: transform, opacity;
        }

        .box3-atmosphere {
          background:
            radial-gradient(
              circle at 50% 73%,
              rgba(0, 255, 175, 0.11),
              transparent 28%
            ),
            radial-gradient(
              circle at 54% 56%,
              rgba(0, 125, 81, 0.10),
              transparent 46%
            ),
            linear-gradient(
              to bottom,
              rgba(1, 7, 6, 0),
              rgba(0, 20, 16, 0.48) 55%,
              rgba(0, 5, 5, 0.84) 100%
            );
          transition: opacity 180ms linear;
        }

        .box3-globe-fade {
          background:
            linear-gradient(
              to bottom,
              transparent 0%,
              rgba(17, 17, 17, 0.01) 34%,
              rgba(17, 17, 17, 0.24) 76%,
              rgba(17, 17, 17, 0.82) 100%
            );
        }

        .box3-sun-rays {
          background:
            repeating-conic-gradient(
              from 0deg,
              rgba(125, 255, 220, 0) 0deg,
              rgba(125, 255, 220, 0) 8deg,
              rgba(125, 255, 220, 0.08) 9deg,
              rgba(125, 255, 220, 0) 11deg
            );
          mask-image:
            radial-gradient(
              circle,
              transparent 18%,
              black 20%,
              transparent 58%
            );
          mix-blend-mode: screen;
          animation:
            box3-sun-spin 9s linear infinite;
        }

        .box3-sun-halo {
          background:
            radial-gradient(
              circle,
              rgba(0, 255, 170, 0.16) 0%,
              rgba(0, 255, 170, 0.07) 26%,
              rgba(0, 255, 170, 0) 70%
            );
          filter: blur(3px);
          mix-blend-mode: screen;
        }

        .box3-sun {
          background: #dcfff1;
          box-shadow:
            0 0 13px rgba(0, 255, 170, 1),
            0 0 33px rgba(0, 255, 170, 0.52),
            0 0 65px rgba(0, 255, 170, 0.18);
          mix-blend-mode: screen;
        }

        @keyframes box3-sun-spin {
          to {
            transform:
              translate(-50%, -50%)
              rotate(360deg);
          }
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   HeroMobile
   ============================================================ */

function HeroMobile() {
  return (
    <section className="w-full bg-black px-6 pb-14 pt-10 min-[901px]:hidden">
      <h1
        className="w-full max-w-[340px] text-[clamp(31px,8.6vw,43px)] font-medium leading-[0.94] tracking-[-0.045em] text-white"
        style={{
          fontFamily:
            '"ALTMistral", sans-serif',
          fontWeight: 500,
          fontKerning: "none",
        }}
      >
        <span className="block whitespace-nowrap">
          Don’t just search your
        </span>

        <span className="block whitespace-nowrap">
          data.
        </span>

        <span className="mt-2 block whitespace-nowrap">
          Understand it.
        </span>
      </h1>

      <p className="mt-8 max-w-[420px] text-lg font-light leading-[1.35] tracking-[-0.01em] text-white/70">
        Every answer traces back to a row, a
        paragraph, or a page. Never a guess.
      </p>

      <div className="relative mt-9 aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-video">
        <HeroVideo
          disableAnimation
        />
      </div>

      <Link
        href="/engineering"
        className="group mt-10 flex items-center justify-between gap-6 border-t border-white/10 pt-6"
      >
        <div className="min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#007D51]">
            Featured / Engineering
          </span>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            How retrieval, grounding, and
            citations actually work under the
            hood.
          </p>
        </div>

        <ArrowRight
          size={17}
          className="flex-none text-neutral-500 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-[#007D51] max-[900px]:transition-none max-[900px]:group-hover:translate-x-0"
        />
      </Link>
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

    /* ========================================================
       Reduced motion
       ======================================================== */

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

    /* ========================================================
       INITIAL STATES
       ======================================================== */

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

        /*
         * Green atmosphere starts slightly offset
         * so it drifts into position with the reveal.
         */
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

    /* ========================================================
       ONE-TIME INTERSECTION ANIMATION
       ======================================================== */

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

          /*
           * Background
           */
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

          /*
           * Grid
           */
          timeline.to(
            gridRef.current,
            {
              opacity: 1,
              duration: 1.0,
              ease: "power2.out",
            },
            0,
          );

          /*
           * GREEN ATMOSPHERE
           *
           * More visible than before.
           */
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

          /*
           * Title
           */
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

          /*
           * Description
           */
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

          /*
           * Image frame
           */
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

          /*
           * Image itself
           */
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
      {/* ======================================================
          HH.AVIF BACKGROUND
          ====================================================== */}

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

      {/* ======================================================
          WHITE WASH
          ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-white/54"
      />

      {/* ======================================================
          TECHNICAL GRID
          ====================================================== */}

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

      {/* ======================================================
          STRONGER GREEN AMBIENT LIGHT
          ====================================================== */}

      <div
        ref={greenGlowRef}
        aria-hidden="true"
        className="technical-green-glow pointer-events-none absolute -z-10"
      />

      {/* ======================================================
          SECOND GREEN LIGHT
          ====================================================== */}

      <div
        aria-hidden="true"
        className="technical-green-orbit pointer-events-none absolute -z-10"
      />

      {/* ======================================================
          VIGNETTE
          ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.16)_42%,rgba(255,255,255,0.06)_70%,rgba(255,255,255,0.58)_100%)]"
      />

      {/* ======================================================
          CONTENT
          ====================================================== */}

      <div className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-6 pb-5 pt-9 min-[901px]:px-12 min-[901px]:pb-6 min-[901px]:pt-10">
        {/* ====================================================
            TITLE
            ==================================================== */}

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

        {/* ====================================================
            IMAGE AREA

            Tightened significantly.

            No mt-auto.
            No unnecessary bottom room.
            ==================================================== */}

        <div className="relative mt-6 flex flex-1 items-start justify-center min-[901px]:mt-7">
          <div
            ref={imageShellRef}
            className="technical-feature-image relative flex w-full max-w-[900px] items-center justify-center overflow-hidden rounded-[24px] border border-black/[0.07] bg-white/[0.12] shadow-[0_24px_65px_rgba(0,0,0,0.07)] backdrop-blur-[2px]"
            style={{
              height:
                FEATURE_TUNING.featureImageHeight,
            }}
          >
            {/* =================================================
                CENTER GREEN LIGHT
                ================================================= */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#007D51]/[0.075] blur-[70px]"
            />

            {/* =================================================
                TOP FRAME LINE
                ================================================= */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-5 right-5 top-4 h-px bg-black/[0.08]"
            />

            {/* =================================================
                BOTTOM LIGHT
                ================================================= */}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[-20px] left-1/2 h-28 w-[72%] -translate-x-1/2 rounded-full bg-[#007D51]/[0.035] blur-3xl"
            />

            {/* =================================================
                FEATURE IMAGE
                ================================================= */}

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
        /*
         * ------------------------------------------------------
         * Image interaction
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * Main green atmospheric animation
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * Secondary green orbit
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * Green breathing animation
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * Green secondary drift
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * Mobile
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * Reduced motion
         * ------------------------------------------------------
         */

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
    <section className="w-full bg-black">
      <div className="mx-auto grid w-[calc(100%-40px)] max-w-[1600px] max-[768px]:w-[calc(100%-28px)] min-[901px]:grid-cols-[42%_58%]">
        {/* ====================================================
            LEFT — FIXED INTRO
            ==================================================== */}

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

        {/* ====================================================
            RIGHT — FEATURE PANELS
            ==================================================== */}

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
        {/* ======================================================
            BUILDER STATEMENT
            Desktop starts as image-only black field.
            Copy reveals on scroll.
            ====================================================== */}
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

        {/* ======================================================
            RESOURCES / CONTACT
            Cards animate in one by one on desktop.
            Mobile is static by design.
            ====================================================== */}
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
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <style jsx global>{`
        html,
        body {
          background-color: #0a0a0a;
        }
      `}</style>

      <PublicNav />

      <main>
        <HeroTransition />
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