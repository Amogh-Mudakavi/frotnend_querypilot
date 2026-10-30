"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { authApi } from "@/lib/django-api";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";

// Font: Geist is loaded in layout.tsx and mapped in globals.css
// (--font-sans: var(--font-geist)), so `font-sans` below is Geist.

const ERROR_RED = "#fca5a5";
const AUTH_BLUE = "#3a44a8";
const AUTH_DISSOLVE_BLUE = "#2a3282";

// Where the user lands once sign-in is complete.
const WORKSPACE_PATH = "/workspaces";

// Total time the intermediate screen stays up before the success sequence
// starts, so it never just flashes.
const MIN_VISIBLE_MS = 1800;
// How long the success check is shown before the card starts expanding.
const SUCCESS_HOLD_MS = 900;
// Card growing to fill the screen.
const EXPAND_MS = 750;
// Text fading out once the card has filled the screen.
const TEXT_FADE_MS = 400;

type CallbackStatus = "loading" | "success" | "error";

const primaryButtonClasses =
  "!h-[44px] !w-full !min-h-0 !rounded-full !border !border-[#3a44a8] !bg-[#3a44a8] !px-5 !text-[13px] !font-medium " +
  "!normal-case !tracking-normal !text-white hover:!bg-[#4651bd] disabled:!opacity-70 " +
  "min-[1920px]:!h-[56px] min-[1920px]:!text-[16px] min-[2560px]:!h-[68px] min-[2560px]:!text-[19px]";

const secondaryButtonClasses =
  "flex h-[44px] w-full items-center justify-center rounded-full bg-[#1c1c1e] px-5 text-[14px] font-medium text-[#e6e6e6] " +
  "transition-colors hover:bg-[#242427] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4651bd] " +
  "min-[1920px]:h-[56px] min-[1920px]:text-[17px] min-[2560px]:h-[68px] min-[2560px]:text-[20px]";

function getOAuthErrorMessage(oauthError: string) {
  switch (oauthError) {
    case "google_account_not_linked":
      return "This Google account is not linked to a QueryPilot account. Create an account first or use your existing login method.";
    case "google_account_not_found":
      return "No QueryPilot account was found for this Google identity. Please sign up first.";
    case "account_already_exists":
      return "An account with this email already exists. Sign in using your existing method.";
    case "account_unavailable":
      return "This account is currently unavailable. Please contact support.";
    default:
      return "Google sign-in could not be completed. Please try again.";
  }
}

/**
 * Error badge: a tinted ring with a thin X that draws in once. It fills the
 * same 64px slot as the loading orb, so nothing shifts when the status changes.
 * Pure SVG and CSS, no icon library.
 */
function ErrorBadge() {
  return (
    <span
      aria-hidden="true"
      className="qp-badge-in flex h-full w-full items-center justify-center rounded-full border"
      style={{
        color: ERROR_RED,
        backgroundColor: "rgba(252,165,165,0.08)",
        borderColor: "rgba(252,165,165,0.28)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[42%] w-[42%]"
      >
        <path className="qp-stroke" pathLength={1} d="M7 7l10 10" />
        <path className="qp-stroke qp-stroke-2" pathLength={1} d="M17 7L7 17" />
      </svg>
    </span>
  );
}

/**
 * Soft pixel-block background. Small squares slowly fade in and out,
 * strongest around the card and fading toward the edges.
 */
function PixelField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const MAX_ALPHA = 0.007;

    let cell = 56;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let alpha = new Float32Array(0);
    let target = new Float32Array(0);

    const pickTarget = () =>
      Math.random() < 0.4 ? Math.random() * MAX_ALPHA : 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const a = alpha[r * cols + c];

          if (a < 0.002) {
            continue;
          }

          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      // Smaller blocks on phones, bigger on TVs, so the texture feels the same.
      cell = width < 640 ? 40 : width >= 1920 ? 84 : 56;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);

      alpha = new Float32Array(cols * rows);
      target = new Float32Array(cols * rows);

      for (let i = 0; i < alpha.length; i += 1) {
        target[i] = pickTarget();
        alpha[i] = target[i];
      }

      render();
    };

    const tick = () => {
      const changes = Math.max(1, Math.floor(alpha.length * 0.004));

      for (let k = 0; k < changes; k += 1) {
        target[Math.floor(Math.random() * alpha.length)] = pickTarget();
      }

      for (let i = 0; i < alpha.length; i += 1) {
        alpha[i] += (target[i] - alpha[i]) * 0.04;
      }

      render();

      raf = requestAnimationFrame(tick);
    };

    resize();

    if (!reduceMotion) {
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 60% at 50% 50%, #000 0%, rgba(0,0,0,0.5) 55%, transparent 100%)",
        maskImage:
          "radial-gradient(ellipse 70% 60% at 50% 50%, #000 0%, rgba(0,0,0,0.5) 55%, transparent 100%)",
      }}
    />
  );
}

// Distances (px) from each viewport edge to the card, plus its corner radius.
type CardRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  radius: number;
};

export default function GoogleOAuthCallbackPage() {
  const startedRef = useRef(false);
  const cardRef = useRef<HTMLElement>(null);

  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // Success sequence: the card is pinned at its current spot (rect), grows to
  // the full viewport (expanded), then its text fades (textHidden).
  const [rect, setRect] = useState<CardRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [textHidden, setTextHidden] = useState(false);

  /**
   * Card expands to fill the screen with the text staying exactly where it is,
   * then the text disappears, and only then do we move on.
   */
  const runSuccessSequence = (onDone: () => void) => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.setTimeout(
      () => {
        if (reduceMotion) {
          setTextHidden(true);
          window.setTimeout(onDone, 200);
          return;
        }

        const el = cardRef.current;

        if (!el) {
          onDone();
          return;
        }

        const box = el.getBoundingClientRect();
        const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;

        // Step 1: remember exactly where the card sits in the viewport.
        setRect({
          top: box.top,
          left: box.left,
          right: window.innerWidth - box.right,
          bottom: window.innerHeight - box.bottom,
          radius,
        });

        // Step 2: next frame, reveal the dark surface outward from the card to the whole viewport.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setExpanded(true));
        });

        // Step 3: once it fills the screen, fade the text away.
        window.setTimeout(() => {
          setTextHidden(true);

          // Step 4: when the text is gone, open the workspace.
          window.setTimeout(onDone, TEXT_FADE_MS);
        }, EXPAND_MS + 150);
      },
      reduceMotion ? 400 : SUCCESS_HOLD_MS,
    );
  };

  useEffect(() => {
    // Avoid exchanging the same OAuth code twice in development (React strict mode).
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const startedAt = Date.now();

    const currentUrl = new URL(window.location.href);

    const code = currentUrl.searchParams.get("code");
    const oauthError = currentUrl.searchParams.get("error");

    // Remove temporary OAuth parameters from the visible URL.
    currentUrl.searchParams.delete("code");
    currentUrl.searchParams.delete("mode");
    currentUrl.searchParams.delete("error");
    currentUrl.searchParams.delete("error_description");
    currentUrl.searchParams.delete("state");

    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );

    // Handle cancelled or rejected Google authorization.
    if (oauthError) {
      setStatus("error");
      setErrorMessage(getOAuthErrorMessage(oauthError));
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage(
        "The Google sign-in response did not contain an authorization code. Please try again.",
      );
      return;
    }

    const completeOAuthLogin = async () => {
      try {
        // Exchange the temporary code for QueryPilot JWTs.
        const tokens = await authApi.exchangeOAuthCode(code);

        // Reuse the existing authentication token storage.
        authApi.saveTokens(tokens);

        // Keep the loading screen up long enough to feel intentional.
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

        window.setTimeout(() => {
          setStatus("success");

          // Full navigation so the workspace boots with the freshly saved tokens.
          runSuccessSequence(() => {
            window.location.replace(WORKSPACE_PATH);
          });
        }, remaining);
      } catch (error) {
        setStatus("error");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to complete Google sign-in. Please try again.",
        );
      }
    };

    void completeOAuthLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinned = rect !== null;

  // Full-screen surface in the card's own colour. It starts clipped to exactly
  // the card's box and opens up evenly on all four sides, so the growth is
  // centred. The card's text sits above it and never moves.
  const overlayStyle: React.CSSProperties | undefined = rect
    ? {
        clipPath: expanded
          ? "inset(0px 0px 0px 0px round 0px)"
          : `inset(${rect.top}px ${rect.right}px ${rect.bottom}px ${rect.left}px round ${rect.radius}px)`,
        transition: `clip-path ${EXPAND_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
      }
    : undefined;

  return (
    <div className="min-h-[100dvh] bg-[var(--qp-background)]">
      <style>{`
        @keyframes qp-rise {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: none; }
        }
        @keyframes qp-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes qp-badge-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: none; }
        }
        @keyframes qp-stroke {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        .qp-rise { animation: qp-rise 600ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards; }
        .qp-fade { animation: qp-fade 350ms ease-out backwards; }
        .qp-badge-in { animation: qp-badge-in 320ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards; }
        .qp-stroke {
          stroke-dasharray: 1;
          animation: qp-stroke 380ms cubic-bezier(0.65, 0, 0.35, 1) 160ms backwards;
        }
        .qp-stroke-2 { animation-delay: 280ms; }

        /* Handoff to the workspace: the browser holds this page's last frame
           until the workspace has painted, then crossfades. Ignored where
           unsupported; the workspace opts in with the same rule. */
        @view-transition { navigation: auto; }
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation-duration: 280ms;
          animation-timing-function: ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .qp-rise, .qp-fade, .qp-badge-in, .qp-stroke { animation: none; }
          ::view-transition-group(root),
          ::view-transition-old(root),
          ::view-transition-new(root) { animation: none; }
        }
      `}</style>

      <main
        className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-10 font-sans text-[var(--qp-text-primary)] antialiased sm:px-6 sm:py-16"
        style={{
          // Keep the card clear of notches / rounded corners on phones.
          paddingTop: "max(2.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Background: pixel blocks and a soft center glow */}

        <PixelField />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 52% at 50% 50%, rgba(44,95,52,0.16) 0%, rgba(44,95,52,0.06) 45%, rgba(44,95,52,0) 78%)",
          }}
        />

        {/* Full-screen surface used by the success expand animation */}

        {pinned && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[5] bg-[var(--qp-background)]"
            style={overlayStyle}
          />
        )}

        {/* Card: 700px on laptops, full width on phones, wider on TVs */}

        <div className="relative z-10 w-full max-w-[700px] min-[1920px]:max-w-[900px] min-[2560px]:max-w-[1150px]">
          <section
            ref={cardRef}
            className={`qp-rise relative flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-[28px] border border-[var(--qp-border)] bg-[var(--qp-surface)] shadow-[0_24px_64px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,box-shadow,background-color] duration-300 sm:min-h-[400px] sm:rounded-[40px] min-[1920px]:min-h-[520px] min-[1920px]:rounded-[56px] min-[2560px]:min-h-[680px] min-[2560px]:rounded-[72px] ${
              pinned
                ? "!border-transparent !bg-transparent !shadow-none"
                : "border-white/[0.08]"
            }`}
          >
            <div
              key={status}
              className={`qp-fade w-full max-w-[460px] px-6 py-12 text-center transition-opacity ease-out sm:px-12 sm:py-14 min-[1920px]:max-w-[600px] min-[2560px]:max-w-[780px] ${
                textHidden ? "opacity-0" : "opacity-100"
              }`}
              style={{ transitionDuration: `${TEXT_FADE_MS}ms` }}
            >
              {/* Loading and success share the same layout so nothing jumps */}

              {status !== "error" && (
                <>
                  <div
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center sm:mb-8 min-[1920px]:mb-10 min-[1920px]:h-20 min-[1920px]:w-20"
                    aria-hidden="true"
                  >
                    <ThinkingOrb
                      state="solving"
                      size={64}
                      theme="dark"
                      aria-hidden="true"
                    />
                  </div>

                  <div role="status" aria-live="polite">
                    <h1 className="mx-auto max-w-[420px] text-[22px] font-medium leading-[1.2] tracking-[-0.02em] text-[#e6e6e6] [text-wrap:balance] min-[400px]:text-[26px] sm:text-[32px] min-[1920px]:max-w-[560px] min-[1920px]:text-[44px] min-[2560px]:max-w-[720px] min-[2560px]:text-[58px]">
                      {status === "success"
                        ? "You’re in. Opening your workspace…"
                        : "You’re seconds away from your workspace…"}
                    </h1>

                    <p className="mx-auto mt-3 max-w-[380px] text-[14px] leading-6 text-[#9aa0a8] sm:text-[16px] sm:leading-7 min-[1920px]:mt-4 min-[1920px]:max-w-[520px] min-[1920px]:text-[21px] min-[1920px]:leading-8 min-[2560px]:max-w-[660px] min-[2560px]:text-[27px] min-[2560px]:leading-10">
                      {status === "success"
                        ? "Sign-in complete."
                        : "Verifying your Google sign-in."}
                    </p>
                  </div>

                  {/* Product line, shown during loading and success */}

                  <p className="mx-auto mt-6 max-w-[400px] border-t border-white/10 pt-5 text-[14px] leading-6 text-[#9aa0a8] [text-wrap:balance] sm:mt-8 sm:pt-6 sm:text-[16px] sm:leading-7 min-[1920px]:max-w-[540px] min-[1920px]:text-[21px] min-[1920px]:leading-8 min-[2560px]:max-w-[700px] min-[2560px]:text-[27px] min-[2560px]:leading-10">
                    Your answer is usually spread across a few documents.{" "}
                    <span className="text-[#e6e6e6]/90">
                      QueryPilot reads them together and shows you where it
                      came from.
                    </span>
                  </p>

                  <div className="mt-6 inline-flex items-center gap-2.5 text-[14px] font-medium leading-none text-[#e6e6e6]/80 sm:mt-7 min-[1920px]:mt-9 min-[1920px]:gap-3 min-[1920px]:text-[18px] min-[2560px]:text-[23px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/querypilot-logo.svg"
                      alt=""
                      aria-hidden="true"
                      width={20}
                      height={20}
                      draggable={false}
                      className="h-5 w-5 select-none object-contain min-[1920px]:h-7 min-[1920px]:w-7 min-[2560px]:h-9 min-[2560px]:w-9"
                    />

                    <span>QueryPilot</span>
                  </div>
                </>
              )}

              {/* Error state */}

              {status === "error" && (
                <>
                  <div
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center sm:mb-8 min-[1920px]:mb-10 min-[1920px]:h-20 min-[1920px]:w-20"
                    aria-hidden="true"
                  >
                    <ErrorBadge />
                  </div>

                  <h1 className="text-[22px] font-medium leading-[1.25] tracking-[-0.02em] text-[#e6e6e6] sm:text-[24px] min-[1920px]:text-[34px] min-[2560px]:text-[44px]">
                    Sign-in unsuccessful
                  </h1>

                  <p
                    role="alert"
                    className="mx-auto mt-3 max-w-[340px] text-[13px] leading-6 text-red-300/90 sm:text-[14px] min-[1920px]:mt-4 min-[1920px]:max-w-[460px] min-[1920px]:text-[18px] min-[1920px]:leading-8 min-[2560px]:max-w-[600px] min-[2560px]:text-[23px] min-[2560px]:leading-10"
                  >
                    {errorMessage}
                  </p>

                  <div className="mt-8 flex flex-col gap-3 min-[1920px]:mt-10 min-[1920px]:gap-4">
                    <PixelDissolveButton
                      label="Try signing in again"
                      href="/login"
                      color={AUTH_BLUE}
                      dissolveColor={AUTH_DISSOLVE_BLUE}
                      cellSize={5}
                      className={primaryButtonClasses}
                    />

                    <Link href="/signup" className={secondaryButtonClasses}>
                      Create an account
                    </Link>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}