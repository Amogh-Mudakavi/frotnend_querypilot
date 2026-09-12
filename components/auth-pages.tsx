"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/django-api";
import { IBM_Plex_Sans } from "next/font/google";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";

/* ============================================================
   TYPE
   One font throughout the entire auth experience.
   ============================================================ */

const sansFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

/* ============================================================
   COPY
   No labels / eyebrows / "AI SaaS" micro-headlines.
   ============================================================ */

const copy = {
  login: {
    leftTitle: "Same questions. Deeper answers.",
    leftDescription:
      "Sign back in to pick up where you left off — your documents, tables, and threads are exactly as you left them.",
    formTitle: "Welcome back.",
    formDescription: "Sign in to continue to your QueryPilot workspace.",
  },

  signup: {
    leftTitle: "Open a file on your data.",
    leftDescription:
      "Bring your team’s documents and tables into one workspace, and get answers you can trace back to the source.",
    formTitle: "Start with your data.",
    formDescription:
      "Create your QueryPilot workspace and bring your knowledge together.",
  },

  "verify-otp": {
    leftTitle: "Confirm it’s you.",
    leftDescription: "Enter the six-digit code we sent to your inbox.",
    formTitle: "Verify your account.",
    formDescription: "Enter the verification code to continue.",
  },

  "forgot-password": {
    leftTitle: "Reset your password.",
    leftDescription:
      "We’ll send a code if the account exists — the response is the same either way.",
    formTitle: "Reset your password.",
    formDescription: "Enter your email to receive a password reset code.",
  },

  "reset-password": {
    leftTitle: "Choose a new password.",
    leftDescription: "Use at least 8 characters to secure your account.",
    formTitle: "Set a new password.",
    formDescription: "Choose a new password for your QueryPilot account.",
  },
} as const;

type Mode = keyof typeof copy;

/* ============================================================
   BRAND
   ============================================================ */

function AuthLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 whitespace-nowrap text-[19px] font-normal leading-none tracking-[-0.035em] ${
        dark ? "text-white" : "text-[#111518]"
      }`}
    >
      <img
        src="/querypilot-logo.svg"
        alt=""
        aria-hidden="true"
        className="h-6 w-6 flex-none object-contain"
      />

      <span>QueryPilot</span>
    </Link>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

function getValue(values: FormData, key: string) {
  const value = values.get(key);

  return typeof value === "string" ? value.trim() : "";
}

/* Only allow local relative redirects.
   Prevents open-redirect style abuse from ?next=. */

function getSafeNext() {
  const requestedNext = new URLSearchParams(window.location.search).get("next");

  if (!requestedNext) {
    return "/workspaces";
  }

  if (requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
    return requestedNext;
  }

  return "/workspaces";
}

/* ============================================================
   AUTH PAGE
   ============================================================ */

export function AuthPage({ mode }: { mode: Mode }) {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState("");

  const [pending, setPending] = useState(false);

  /* Small client-side guard against accidental
     repeated submissions while the request is pending. */

  const lastSubmitAtRef = useRef(0);

  const currentCopy = copy[mode];

  /* ==========================================================
     SESSION CHECK
     ========================================================== */

  useEffect(() => {
    if (mode !== "login" && mode !== "signup") {
      return;
    }

    if (!authApi.hasAccess()) {
      return;
    }

    let cancelled = false;

    void authApi
      .me()
      .then(() => {
        if (!cancelled) {
          router.replace("/workspaces");
        }
      })
      .catch(() => {
        // Invalid or expired session.
      });

    return () => {
      cancelled = true;
    };
  }, [mode, router]);

  /* ==========================================================
     SUBMIT
     ========================================================== */

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const now = Date.now();

    /* Prevent rapid repeated clicks in the UI.
       This is NOT a security boundary. */

    if (pending || now - lastSubmitAtRef.current < 750) {
      return;
    }

    lastSubmitAtRef.current = now;

    setError("");
    setPending(true);

    const values = new FormData(event.currentTarget);

    try {
      /* ------------------------------------------------------
         LOGIN
         ------------------------------------------------------ */

      if (mode === "login") {
        const email = getValue(values, "email");

        const password = getValue(values, "password");

        if (!email || !password) {
          throw new Error("Enter your email and password.");
        }

        const tokens = await authApi.login({
          email,
          password,
        });

        authApi.saveTokens(tokens);

        router.replace(getSafeNext());

        return;
      }

      /* ------------------------------------------------------
         SIGNUP
         ------------------------------------------------------ */

      if (mode === "signup") {
        const username = getValue(values, "username");

        const email = getValue(values, "email");

        const password = getValue(values, "password");

        const confirmPassword = getValue(values, "confirm_password");

        if (!username) {
          throw new Error("Enter a username.");
        }

        if (!email) {
          throw new Error("Enter your email address.");
        }

        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        await authApi.register({
          username,
          email,
          password,
        });

        sessionStorage.setItem("querypilot_pending_email", email);

        router.replace("/verify-otp");

        return;
      }

      /* ------------------------------------------------------
         VERIFY OTP
         ------------------------------------------------------ */

      if (mode === "verify-otp") {
        const email =
          getValue(values, "email") ||
          sessionStorage.getItem("querypilot_pending_email") ||
          "";

        const otp = getValue(values, "otp");

        if (!email) {
          throw new Error("Enter the email address used for registration.");
        }

        if (!/^\d{6}$/.test(otp)) {
          throw new Error("Enter the six-digit verification code.");
        }

        await authApi.verifyOtp({
          email,
          otp,
        });

        sessionStorage.removeItem("querypilot_pending_email");

        router.replace("/login");

        return;
      }

      /* ------------------------------------------------------
         FORGOT PASSWORD
         ------------------------------------------------------ */

      if (mode === "forgot-password") {
        const email = getValue(values, "email");

        if (!email) {
          throw new Error("Enter your email address.");
        }

        /*
         * Keep the UI response generic.
         * Do not reveal whether an account exists.
         */

        await authApi.forgotPassword({
          email,
        });

        setSubmitted(true);

        return;
      }

      /* ------------------------------------------------------
         RESET PASSWORD
         ------------------------------------------------------ */

      if (mode === "reset-password") {
        const email = getValue(values, "email");

        const otp = getValue(values, "otp");

        const newPassword = getValue(values, "new_password");

        const confirmPassword = getValue(values, "confirm_password");

        if (!email) {
          throw new Error("Enter your email address.");
        }

        if (!/^\d{6}$/.test(otp)) {
          throw new Error("Enter the six-digit verification code.");
        }

        if (newPassword.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        await authApi.resetPassword({
          email,
          otp,
          new_password: newPassword,
        });

        router.replace("/login");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to complete this request.",
      );
    } finally {
      setPending(false);
    }
  };

  /* ==========================================================
     INPUT
     ========================================================== */

  const inputClasses = `
    w-full
    min-h-[58px]
    rounded-[4px]
    border
    border-white/[0.14]
    bg-white/[0.035]
    px-4
    text-[15px]
    font-normal
    tracking-[-0.01em]
    text-white
    outline-none
    backdrop-blur-[8px]
    transition-all
    placeholder:text-white/25
    hover:border-white/[0.23]
    hover:bg-white/[0.045]
    focus:border-[#36C69B]/70
    focus:bg-white/[0.055]
    focus:ring-1
    focus:ring-[#36C69B]/10
  `;

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <main
      className={`${sansFont.className} min-h-screen overflow-hidden bg-black`}
    >
      <div className="grid min-h-screen lg:grid-cols-[0.88fr_1.12fr]">
        {/* =====================================================
            LEFT — WHITE IMAGE
        ====================================================== */}

        <section className="relative hidden min-h-screen overflow-hidden bg-[#f7f7f5] lg:flex lg:flex-col">
          {/* Actual supplied image */}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cover bg-bottom bg-no-repeat"
            style={{
              backgroundImage: "url('/hh.avif')",
            }}
          />

          {/* White wash */}

          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(247,247,245,0.96) 0%, rgba(247,247,245,0.83) 34%, rgba(247,247,245,0.35) 69%, rgba(247,247,245,0.02) 100%)",
            }}
          />

          {/* Fine grid */}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: `
                linear-gradient(
                  rgba(16,22,25,0.09) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  rgba(16,22,25,0.09) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "64px 64px",
            }}
          />

          {/* Brand */}

          <div className="relative z-10 px-12 py-9">
            <AuthLogo />
          </div>

          {/* Main copy */}

          <div className="relative z-10 flex flex-1 items-center px-12 pb-24">
            <div className="max-w-[560px]">
              <h1 className="max-w-[540px] text-[clamp(48px,4.7vw,72px)] font-light leading-[0.97] tracking-[-0.06em] text-[#101417]">
                {currentCopy.leftTitle}
              </h1>

              <p className="mt-8 max-w-[460px] text-[15px] font-normal leading-7 tracking-[-0.005em] text-black/55">
                {currentCopy.leftDescription}
              </p>
            </div>
          </div>

          {/* Bottom statement */}

          <div className="relative z-10 px-12 pb-9">
            <div className="mb-6 h-px w-11 bg-black/40" />

            <p className="text-[9px] font-medium uppercase leading-[1.7] tracking-[0.28em] text-black/45">
              BUILT OPENLY
              <br />
              FOR A MORE CAPABLE TOMORROW.
            </p>
          </div>
        </section>

        {/* =====================================================
            RIGHT — GLOBE ENVIRONMENT
        ====================================================== */}

        <section className="relative min-h-screen overflow-hidden bg-[#020504]">
          {/* Globe artwork */}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <div
              className="absolute inset-0 bg-right-center bg-no-repeat"
              style={{
                backgroundImage: "url('/querypilot-builder-field.png')",
                backgroundSize: "cover",
                backgroundPosition: "center right",
              }}
            />

            {/* Keep the left side dark enough for the card */}

            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(2,5,4,0.97) 0%, rgba(2,5,4,0.82) 29%, rgba(2,5,4,0.36) 68%, rgba(2,5,4,0.06) 100%)",
              }}
            />

            {/* Vertical depth */}

            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.40) 100%)",
              }}
            />

            {/* Ambient glow */}

            <div
              className="absolute right-[14%] top-[12%] h-[380px] w-[380px] rounded-full opacity-[0.16] blur-[135px]"
              style={{
                background:
                  "radial-gradient(circle, rgba(54,198,155,0.55) 0%, rgba(54,198,155,0) 70%)",
              }}
            />
          </div>

          {/* Mobile logo */}

          <div className="relative z-30 px-6 pt-7 lg:hidden">
            <AuthLogo dark />
          </div>

          {/* ===================================================
              AUTH AREA
          ==================================================== */}

          <div className="relative z-20 flex min-h-screen items-center justify-center px-5 py-16 sm:px-8 lg:px-12 xl:px-20">
            {/* =================================================
                PREMIUM GLASS AUTH SURFACE
            ================================================== */}

            <div
              className="
                relative
                w-full
                max-w-[550px]
                overflow-hidden
                rounded-[8px]
                border
                border-white/[0.13]
                bg-[rgba(7,12,10,0.60)]
                shadow-[0_45px_120px_rgba(0,0,0,0.48)]
                backdrop-blur-[26px]
              "
            >
              {/* Very thin green glass edge */}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(110,242,201,0.58) 48%, transparent 100%)",
                }}
              />

              {/* Glass reflection */}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-40 -top-40 h-[330px] w-[330px] rounded-full opacity-50 blur-[110px]"
                style={{
                  background:
                    "radial-gradient(circle, rgba(54,198,155,0.16) 0%, rgba(54,198,155,0) 68%)",
                }}
              />

              {/* =================================================
                  CONTENT
              ================================================== */}

              <div className="relative z-10 p-8 sm:p-10 lg:p-11">
                {/* Back */}

                <Link
                  href="/"
                  className="mb-12 inline-flex items-center gap-2.5 text-[10px] font-medium tracking-[0.01em] text-white/32 transition-colors hover:text-white/80"
                >
                  <ArrowLeft size={14} />
                  Back to QueryPilot
                </Link>

                {/* Heading — no eyebrow */}

                <div className="mb-10">
                  <h2 className="max-w-[450px] text-[42px] font-light leading-[1.03] tracking-[-0.055em] text-white sm:text-[48px]">
                    {currentCopy.formTitle}
                  </h2>

                  <p className="mt-4 max-w-[450px] text-[14px] font-normal leading-6 tracking-[-0.005em] text-white/42">
                    {currentCopy.formDescription}
                  </p>
                </div>

                {/* =================================================
                    SUCCESS
                ================================================== */}

                {submitted ? (
                  <div className="border-t border-white/[0.10] pt-7">
                    <div className="flex items-center gap-3 text-[14px] font-medium text-[#36C69B]">
                      <Check size={17} />
                      Check your inbox.
                    </div>

                    <p className="mt-3 max-w-[420px] text-[12px] leading-6 text-white/40">
                      If an account exists for that email, you’ll receive the
                      next step shortly.
                    </p>

                    <Link
                      href="/login"
                      className="
                        mt-8
                        flex
                        min-h-[62px]
                        w-full
                        items-center
                        justify-center
                        border
                        border-white/[0.16]
                        bg-white/[0.035]
                        px-6
                        text-[11px]
                        font-medium
                        tracking-[0.035em]
                        text-white/85
                        backdrop-blur-md
                        transition-all
                        hover:border-white/[0.30]
                        hover:bg-white/[0.07]
                        hover:text-white
                      "
                    >
                      Return to login
                    </Link>
                  </div>
                ) : (
                  <form className="space-y-6" onSubmit={submitAuth} noValidate>
                    {/* =================================================
                        USERNAME
                    ================================================== */}

                    {mode === "signup" && (
                      <label className="block">
                        <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                          Username
                        </span>

                        <input
                          required
                          name="username"
                          autoComplete="username"
                          minLength={1}
                          className={inputClasses}
                          placeholder="amogh"
                        />
                      </label>
                    )}

                    {/* =================================================
                        EMAIL
                    ================================================== */}

                    {mode !== "verify-otp" && (
                      <label className="block">
                        <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                          Email address
                        </span>

                        <input
                          required
                          name="email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          className={inputClasses}
                          placeholder="you@company.com"
                        />
                      </label>
                    )}

                    {/* =================================================
                        VERIFY EMAIL
                    ================================================== */}

                    {mode === "verify-otp" && (
                      <>
                        <label className="block">
                          <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                            Email address
                          </span>

                          <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="you@company.com"
                            className={inputClasses}
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                            Verification code
                          </span>

                          <input
                            required
                            name="otp"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            autoComplete="one-time-code"
                            className={`${inputClasses} tracking-[0.34em]`}
                            placeholder="000000"
                          />
                        </label>
                      </>
                    )}

                    {/* =================================================
                        PASSWORD
                    ================================================== */}

                    {(mode === "login" || mode === "signup") && (
                      <label className="block">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="text-[10px] font-medium tracking-[0.01em] text-white/34">
                            Password
                          </span>

                          {mode === "login" && (
                            <Link
                              href="/forgot-password"
                              className="text-[10px] font-normal text-white/35 transition-colors hover:text-[#36C69B]"
                            >
                              Forgot password?
                            </Link>
                          )}
                        </div>

                        <span className="relative block">
                          <input
                            required
                            name="password"
                            type={showPassword ? "text" : "password"}
                            minLength={8}
                            autoComplete={
                              mode === "login"
                                ? "current-password"
                                : "new-password"
                            }
                            className={`${inputClasses} pr-12`}
                            placeholder="••••••••"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 transition-colors hover:text-white/70"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff size={17} />
                            ) : (
                              <Eye size={17} />
                            )}
                          </button>
                        </span>
                      </label>
                    )}

                    {/* =================================================
                        RESET PASSWORD
                    ================================================== */}

                    {mode === "reset-password" && (
                      <>
                        <label className="block">
                          <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                            Email address
                          </span>

                          <input
                            required
                            name="email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            className={inputClasses}
                            placeholder="you@company.com"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                            Verification code
                          </span>

                          <input
                            required
                            name="otp"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            autoComplete="one-time-code"
                            className={`${inputClasses} tracking-[0.34em]`}
                            placeholder="000000"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                            New password
                          </span>

                          <span className="relative block">
                            <input
                              required
                              name="new_password"
                              type={showPassword ? "text" : "password"}
                              minLength={8}
                              autoComplete="new-password"
                              className={`${inputClasses} pr-12`}
                              placeholder="••••••••"
                            />

                            <button
                              type="button"
                              onClick={() => setShowPassword((value) => !value)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 transition-colors hover:text-white/70"
                              aria-label={
                                showPassword ? "Hide password" : "Show password"
                              }
                            >
                              {showPassword ? (
                                <EyeOff size={17} />
                              ) : (
                                <Eye size={17} />
                              )}
                            </button>
                          </span>
                        </label>

                        <label className="block">
                          <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                            Confirm password
                          </span>

                          <span className="relative block">
                            <input
                              required
                              name="confirm_password"
                              type={showConfirmPassword ? "text" : "password"}
                              minLength={8}
                              autoComplete="new-password"
                              className={`${inputClasses} pr-12`}
                              placeholder="••••••••"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword((value) => !value)
                              }
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 transition-colors hover:text-white/70"
                              aria-label={
                                showConfirmPassword
                                  ? "Hide confirmation password"
                                  : "Show confirmation password"
                              }
                            >
                              {showConfirmPassword ? (
                                <EyeOff size={17} />
                              ) : (
                                <Eye size={17} />
                              )}
                            </button>
                          </span>
                        </label>
                      </>
                    )}

                    {/* =================================================
                        SIGNUP CONFIRM
                    ================================================== */}

                    {mode === "signup" && (
                      <label className="block">
                        <span className="mb-2.5 block text-[10px] font-medium tracking-[0.01em] text-white/34">
                          Confirm password
                        </span>

                        <span className="relative block">
                          <input
                            required
                            name="confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            minLength={8}
                            autoComplete="new-password"
                            className={`${inputClasses} pr-12`}
                            placeholder="••••••••"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword((value) => !value)
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 transition-colors hover:text-white/70"
                            aria-label={
                              showConfirmPassword
                                ? "Hide confirmation password"
                                : "Show confirmation password"
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={17} />
                            ) : (
                              <Eye size={17} />
                            )}
                          </button>
                        </span>
                      </label>
                    )}

                    {/* =================================================
                        ERROR
                    ================================================== */}

                    {error && (
                      <div
                        role="alert"
                        className="border border-red-400/20 bg-red-500/[0.06] px-4 py-3.5 text-xs leading-5 text-red-300"
                      >
                        {error}
                      </div>
                    )}

                    {/* =================================================
                        WHITE PRIMARY BUTTON
                    ================================================== */}

                    <div className="pt-4">
                      <PixelDissolveButton
                        type="submit"
                        disabled={pending}
                        label={
                          pending
                            ? "PLEASE WAIT"
                            : mode === "login"
                              ? "LOG IN"
                              : mode === "signup"
                                ? "CREATE ACCOUNT"
                                : mode === "verify-otp"
                                  ? "VERIFY EMAIL"
                                  : mode === "forgot-password"
                                    ? "SEND RESET CODE"
                                    : "RESET PASSWORD"
                        }
                        color="#ffffff"
                        dissolveColor="#ccffcc"
                        className="
    !min-h-[64px]
    !w-full
    !min-w-0
    !rounded-[3px]
    !border
    !border-white
    !bg-white
    !px-7
    !py-0
    !text-[12px]
    !font-medium
    !tracking-[0.035em]
    !text-black
  "
                      />
                    </div>
                  </form>
                )}

                {/* =================================================
                    FOOTER
                ================================================== */}

                {mode === "login" && (
                  <div className="mt-8 flex items-center justify-between border-t border-white/[0.09] pt-5 text-[11px] text-white/30">
                    <span>New to QueryPilot?</span>

                    <Link
                      href="/signup"
                      className="font-medium text-white/70 transition-colors hover:text-[#36C69B]"
                    >
                      Get started
                    </Link>
                  </div>
                )}

                {mode === "signup" && (
                  <p className="mt-8 border-t border-white/[0.09] pt-5 text-[11px] text-white/30">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-white/70 transition-colors hover:text-[#36C69B]"
                    >
                      Log in
                    </Link>
                  </p>
                )}

                {mode === "verify-otp" && (
                  <p className="mt-8 border-t border-white/[0.09] pt-5 text-[11px] leading-5 text-white/30">
                    After verification, return to login.
                  </p>
                )}

                {mode === "forgot-password" && (
                  <p className="mt-8 border-t border-white/[0.09] pt-5 text-[11px] text-white/30">
                    Remembered your password?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-white/70 transition-colors hover:text-[#36C69B]"
                    >
                      Return to login
                    </Link>
                  </p>
                )}
              </div>

              {/* Bottom glass reflection */}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-12 bottom-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.13), transparent)",
                }}
              />
            </div>
          </div>

          {/* =================================================
              RIGHT METADATA
          ================================================== */}

          <div className="pointer-events-none absolute bottom-9 right-9 z-20 hidden lg:block">
            <p className="text-right text-[8px] font-medium uppercase leading-[2.15] tracking-[0.34em] text-white/24">
              DOCUMENTS
              <br />
              DATA
              <br />
              ANSWERS
            </p>
          </div>

          {/* Top registration line */}

          <div className="pointer-events-none absolute right-9 top-10 z-20 hidden lg:block">
            <div className="h-10 w-px bg-white/15" />
          </div>
        </section>
      </div>
    </main>
  );
}
