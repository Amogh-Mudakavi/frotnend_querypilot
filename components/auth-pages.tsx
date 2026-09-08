'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/django-api'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, Check, Eye, EyeOff, FileCheck2 } from 'lucide-react'
import { PixelDissolveButton } from '@/components/pixel-dissolve-button'

/* ============================================================
   Type system — Fraunces for editorial display moments,
   Plex Sans for UI/body, Plex Mono for data-style labels
   (citation refs, eyebrows, hints). Referenced via CSS vars
   so we can mix all three without extra wrapper components.
   ============================================================ */

const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})
const sansFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
})
const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

/* ============================================================
   Copy per mode — same shape/keys as before ([eyebrow, title,
   description]); wording tightened to match the ledger tone.
   ============================================================ */

const copy = {
  login: [
    'ACCESS',
    'Welcome back.',
    'Sign in to pick up your workspace exactly where you left it.',
  ],
  signup: [
    'NEW WORKSPACE',
    'Open a file on your data.',
    'Bring your team’s documents and tables into one evidence-backed workspace.',
  ],
  'verify-otp': [
    'VERIFICATION',
    'Confirm it’s you.',
    'Enter the six-digit code we sent to your inbox.',
  ],
  'forgot-password': [
    'RECOVERY',
    'Reset your password.',
    'We’ll send a code if the account exists — the response is the same either way.',
  ],
  'reset-password': [
    'NEW CREDENTIALS',
    'Choose a new password.',
    'Use at least 8 characters.',
  ],
} as const

type Mode = keyof typeof copy

/* ============================================================
   Brand mark — unchanged glyph, restyled wordmark
   ============================================================ */

function AuthLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 whitespace-nowrap text-lg font-normal leading-none tracking-[-0.03em] ${
        dark ? 'text-[#EEEBDF]' : 'text-[#14201A]'
      }`}
    >
      <img
        src="/querypilot-logo.svg"
        alt=""
        aria-hidden="true"
        className="h-6 w-6 flex-none object-contain"
      />
      <span className="block">QueryPilot</span>
    </Link>
  )
}




/* ============================================================
   Shared pixel button
   ============================================================ */

/* ============================================================
   StatStrip — small credibility numbers under the dossier copy
   ============================================================ */

function StatStrip({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-7">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="font-[family-name:var(--font-display)] text-2xl font-light tracking-[-0.02em] text-[#EEEBDF]">
            {stat.value}
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[#EEEBDF]/40">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   EvidenceCard — small mocked query/citation card, grounding
   the auth page in the product's actual value prop (answers
   tied to a specific source) rather than abstract decoration.
   ============================================================ */

function EvidenceCard() {
  return (
    <div className="relative w-full max-w-sm rotate-[-1.4deg] border border-black/10 bg-[#EEEBDF] p-5 text-[#14201A] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-black/45">
        <span>query — 004</span>
        <FileCheck2 size={13} className="text-[#0a6e46]" />
      </div>
      <p className="mt-3 text-[13px] italic leading-5 text-black/70">
        “What changed in the Q3 vendor agreement?”
      </p>
      <div className="mt-3 h-px w-full bg-black/10" />
      <p className="mt-3 text-[13px] leading-5">
        Payment terms revised to net-45 under clause 4.2.{' '}
        <mark className="bg-[#F2B705]/55 px-0.5 text-[#14201A]">
          Q3_addendum.pdf, p.4
        </mark>
      </p>
    </div>
  )
}

function getValue(values: FormData, key: string) {
  const value = values.get(key)
  return typeof value === 'string' ? value : ''
}

export function AuthPage({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const [eyebrow, title, description] = copy[mode]

  useEffect(() => {
    if (mode !== 'login' && mode !== 'signup') {
      return
    }
    if (!authApi.hasAccess()) {
      return
    }

    let cancelled = false

    void authApi
      .me()
      .then(() => {
        if (!cancelled) {
          router.replace('/workspaces')
        }
      })
      .catch(() => {
        // Session wasn't actually valid; apiFetch already clears tokens
        // on a terminal 401. Stay on the auth page.
      })

    return () => {
      cancelled = true
    }
  }, [mode, router])

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setPending(true)

    const values = new FormData(event.currentTarget)

    try {
      if (mode === 'login') {
        const email = getValue(values, 'email')
        const password = getValue(values, 'password')

        const tokens = await authApi.login({ email, password })
        authApi.saveTokens(tokens)

        const requestedNext =
          new URLSearchParams(window.location.search).get('next') || '/workspaces'

        const next =
          requestedNext.startsWith('/') && !requestedNext.startsWith('//')
            ? requestedNext
            : '/workspaces'

        router.replace(next)
        return
      }

      if (mode === 'signup') {
        const username = getValue(values, 'username')
        const email = getValue(values, 'email')
        const password = getValue(values, 'password')
        const confirmPassword = getValue(values, 'confirm_password')

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }

        await authApi.register({ username, email, password })
        sessionStorage.setItem('querypilot_pending_email', email)
        router.replace('/verify-otp')
        return
      }

      if (mode === 'verify-otp') {
        const email =
          getValue(values, 'email') ||
          sessionStorage.getItem('querypilot_pending_email') ||
          ''
        const otp = getValue(values, 'otp')

        await authApi.verifyOtp({ email, otp })
        router.replace('/login')
        return
      }

      if (mode === 'forgot-password') {
        await authApi.forgotPassword({ email: getValue(values, 'email') })
        setSubmitted(true)
        return
      }

      if (mode === 'reset-password') {
        const newPassword = getValue(values, 'new_password')
        const confirmPassword = getValue(values, 'confirm_password')

        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }

        await authApi.resetPassword({
          email: getValue(values, 'email'),
          otp: getValue(values, 'otp'),
          new_password: newPassword,
        })

        router.replace('/login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete this request.')
    } finally {
      setPending(false)
    }
  }

  const inputClasses =
    'w-full rounded-none border border-black/15 bg-white/70 px-3.5 py-3 text-[15px] text-[#14201A] outline-none transition placeholder:text-black/30 focus:border-[#0a6e46] focus:bg-white'

  return (
    <main
      className={`${sansFont.className} ${displayFont.variable} ${monoFont.variable} grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]`}
    >
      {/* ============ DOSSIER PANEL ============ */}
      <section className="relative hidden overflow-hidden bg-[#0B1210] p-10 text-[#EEEBDF] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#0a6e46]/16 blur-[120px]"
        />

        <AuthLogo dark />

        <div className="relative z-[1] flex flex-col items-start">
          <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#34a477]">
            Workspace intelligence
          </span>

          <h2 className="mt-7 max-w-lg font-[family-name:var(--font-display)] text-[clamp(32px,3.2vw,44px)] font-light leading-[1.08] tracking-[-0.01em]">
            Every document read.
            <br />
            Every table queried.
            <br />
            Every answer{' '}
            <span className="italic text-[#EEEBDF]/50">sourced.</span>
          </h2>

          <div className="mt-9">
            <EvidenceCard />
          </div>

          <StatStrip
            stats={[
              { value: '10K+', label: 'Docs indexed' },
              { value: '<300ms', label: 'Median retrieval' },
              { value: '99.9%', label: 'Uptime' },
            ]}
          />
        </div>

        <p className="relative z-[1] font-[family-name:var(--font-mono)] text-[11px] text-[#EEEBDF]/30">
          © 2026 QueryPilot
        </p>
      </section>

      {/* ============ FORM PANEL ============ */}
      <section className="flex min-h-screen flex-col bg-[#F7F5EC] px-5 py-7 sm:px-10 lg:px-20">
        <div className="lg:hidden">
          <AuthLogo />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <Link
            href="/"
            className="mb-10 inline-flex w-fit items-center gap-2 font-[family-name:var(--font-mono)] text-xs text-black/45 transition-colors hover:text-[#14201A]"
          >
            <ArrowLeft size={14} />
            Back to QueryPilot
          </Link>

          <p className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.2em] text-[#0a6e46]">
            {eyebrow}
          </p>

          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-normal tracking-[-0.01em] text-[#14201A]">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-6 text-black/55">{description}</p>

          {submitted ? (
            <div className="mt-10 border border-[#0a6e46]/25 bg-[#0a6e46]/[0.06] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#0a6e46]">
                <Check size={16} />
                Request received.
              </div>
              <p className="mt-2 text-xs leading-5 text-black/55">
                Check your email for the next step.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex bg-[#14201A] px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-medium uppercase tracking-[0.06em] text-[#F7F5EC]"
              >
                Return to login
              </Link>
            </div>
          ) : (
            <form className="mt-9 space-y-4" onSubmit={submitAuth}>
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-black/60">
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

              {mode !== 'verify-otp' && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-black/60">
                    Email
                  </span>
                  <input
                    required
                    name="email"
                    type="email"
                    autoComplete="email"
                    className={inputClasses}
                    placeholder="you@company.com"
                  />
                </label>
              )}

              {mode === 'verify-otp' && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-black/60">
                      Email
                    </span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      className={inputClasses}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-black/60">
                      Verification code
                    </span>
                    <input
                      required
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className={`${inputClasses} font-[family-name:var(--font-mono)] tracking-[0.35em]`}
                      placeholder="000000"
                    />
                  </label>
                </>
              )}

              {(mode === 'login' || mode === 'signup') && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-black/60">
                    Password
                  </span>
                  <span className="relative block">
                    <input
                      required
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className={`${inputClasses} pr-10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-[#14201A]"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
              )}

              {mode === 'reset-password' && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-black/60">
                      Email
                    </span>
                    <input
                      required
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={inputClasses}
                      placeholder="you@company.com"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-black/60">
                      Verification code
                    </span>
                    <input
                      required
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className={`${inputClasses} font-[family-name:var(--font-mono)] tracking-[0.35em]`}
                      placeholder="000000"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-black/60">
                      New password
                    </span>
                    <span className="relative block">
                      <input
                        required
                        name="new_password"
                        type={showPassword ? 'text' : 'password'}
                        minLength={8}
                        autoComplete="new-password"
                        className={`${inputClasses} pr-10`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-[#14201A]"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-black/60">
                      Confirm password
                    </span>
                    <span className="relative block">
                      <input
                        required
                        name="confirm_password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        minLength={8}
                        autoComplete="new-password"
                        className={`${inputClasses} pr-10`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-[#14201A]"
                        aria-label="Toggle confirmation password visibility"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </span>
                  </label>
                </>
              )}

              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-black/60">
                    Confirm password
                  </span>
                  <span className="relative block">
                    <input
                      required
                      name="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      minLength={8}
                      autoComplete="new-password"
                      className={`${inputClasses} pr-10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-[#14201A]"
                      aria-label="Toggle confirmation password visibility"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
              )}

              {mode === 'forgot-password' && (
                <p className="border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-xs leading-5 text-black/55">
                  For security, the same response is shown whether or not the email
                  belongs to an account.
                </p>
              )}

              {error && (
                <div
                  role="alert"
                  className="border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs leading-5 text-red-700"
                >
                  {error}
                </div>
              )}

              <PixelDissolveButton
                type="submit"
                disabled={pending}
                label={
                  pending
                    ? 'PLEASE WAIT'
                    : mode === 'login'
                      ? 'LOG IN'
                      : mode === 'signup'
                        ? 'CREATE ACCOUNT'
                        : mode === 'verify-otp'
                          ? 'VERIFY EMAIL'
                          : mode === 'forgot-password'
                            ? 'SEND RESET CODE'
                            : 'RESET PASSWORD'
                }
              />
            </form>
          )}

          {mode === 'login' && (
            <div className="mt-5 flex justify-between text-xs text-black/50">
              <Link href="/forgot-password" className="hover:text-[#14201A]">
                Forgot password?
              </Link>
              <Link href="/signup" className="hover:text-[#14201A]">
                Create account
              </Link>
            </div>
          )}

          {mode === 'signup' && (
            <p className="mt-5 text-center text-xs text-black/50">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-[#14201A]">
                Log in
              </Link>
            </p>
          )}

          {mode === 'verify-otp' && (
            <p className="mt-5 text-center text-xs text-black/50">
              After verification, return to login to receive your JWT session.
            </p>
          )}

          {mode === 'forgot-password' && (
            <p className="mt-5 text-center text-xs text-black/50">
              Remembered it?{' '}
              <Link href="/login" className="font-medium text-[#14201A]">
                Return to login
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}