"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/django-api";
import { PixelDissolveButton } from "@/components/pixel-dissolve-button";
import {
  Archive,
  ArrowLeft,
  Braces,
  Check,
  Database,
  Eye,
  EyeOff,
  FileCode,
  FileSpreadsheet,
  FileText,
  Mail,
  Table,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CHECK_GREEN = "#d8d8d8";
const AUTH_BLUE = "#3a44a8";
const AUTH_DISSOLVE_BLUE = "#2a3282";

const NOISE_BG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n' x='0' y='0' width='100%25' height='100%25'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.1 -0.45'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

const copy = {
  login: {
    leftTitle: "Same questions. Deeper answers.",
    leftDescription:
      "Log back in to pick up where you left off. Your documents, tables, and threads are exactly as you left them.",
    formTitle: "Welcome back",
    formDescription: "Log in to continue to your workspace.",
  },

  signup: {
    leftTitle: "Ask questions of your data.",
    leftDescription:
      "Bring your team’s documents and tables into one workspace. Get answers you can trace back to the source.",
    formTitle: "Create your account",
    formDescription: "Start with your data. It takes about a minute.",
  },

  "verify-otp": {
    leftTitle: "Confirm it’s you.",
    leftDescription: "Enter the six-digit code we sent to your inbox.",
    formTitle: "Verify your email",
    formDescription: "Enter the verification code to continue.",
  },

  "forgot-password": {
    leftTitle: "Reset your password.",
    leftDescription:
      "We’ll send a code if the account exists. The response is the same either way.",
    formTitle: "Reset your password",
    formDescription: "Enter your email to receive a password reset code.",
  },

  "reset-password": {
    leftTitle: "Choose a new password.",
    leftDescription: "Use at least 8 characters to secure your account.",
    formTitle: "Set a new password",
    formDescription: "Choose a new password for your account.",
  },
} as const;

type Mode = keyof typeof copy;

const SIGNUP_STEPS = [
  "Create your account",
  "Verify your email",
  "Create your workspace",
] as const;

function getCurrentStep(mode: Mode) {
  if (mode === "signup") return 1;
  if (mode === "verify-otp") return 2;
  return 0;
}

function getValue(values: FormData, key: string) {
  const value = values.get(key);

  return typeof value === "string" ? value.trim() : "";
}

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

function getErrorTarget(message: string, mode: Mode): string | null {
  const text = message.toLowerCase();

  if (!text) return null;
  if (text.includes("email or password")) return null;
  if (text.includes("email and password")) return null;
  if (text.includes("username")) return "username";
  if (text.includes("do not match")) return "confirm_password";
  if (text.includes("six-digit")) return "otp";

  if (text.includes("password must")) {
    return mode === "reset-password" ? "new_password" : "password";
  }

  if (text.includes("email")) return "email";

  return null;
}

// Polish: placeholder, muted text and icon greys are a bit lighter for better
// contrast. Same grey family, no new colors.
const inputClasses =
  "w-full h-[44px] min-[1920px]:h-[48px] rounded-full border border-[var(--qp-border)] bg-[var(--qp-input)] px-5 " +
  "text-base sm:text-[14px] min-[1920px]:text-[15px] text-[var(--qp-text-primary)] outline-none transition-colors " +
  "placeholder:text-[var(--qp-text-muted)] hover:bg-[var(--qp-surface-hover)] " +
  "focus:border-[var(--qp-focus-ring)] focus:bg-[var(--qp-input)] " +
  "aria-[invalid=true]:border-red-400/60";

const labelClasses =
  "text-[13px] font-medium leading-none text-[var(--qp-text-primary)] min-[1920px]:text-[14px]";

const mutedClasses = "text-[13px] text-[var(--qp-text-secondary)] min-[1920px]:text-[14px]";

const errorTextClasses =
  "mt-2 px-2 text-[13px] leading-5 text-red-300/90 min-[1920px]:text-[14px]";

const secondaryButtonClasses =
  "flex h-[44px] w-full items-center justify-center gap-3 rounded-full bg-[var(--qp-surface)] px-5 text-[14px] font-medium text-[var(--qp-text-primary)] " +
  "transition-colors hover:bg-[var(--qp-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qp-focus-ring)] " +
  "disabled:cursor-not-allowed disabled:opacity-50 min-[1920px]:h-[48px] min-[1920px]:text-[15px]";

const primaryButtonClasses =
  "!h-[44px] !w-full !min-h-0 !rounded-full !border !border-[#3a44a8] !bg-[#3a44a8] !px-5 !text-[13px] !font-medium " +
  "!normal-case !tracking-normal !text-white hover:!bg-[#4651bd] disabled:!opacity-70 " +
  "min-[1920px]:!h-[48px] min-[1920px]:!text-[14px]";

function AuthLogo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 whitespace-nowrap text-[16px] font-medium leading-none tracking-[-0.01em] text-[#e6e6e6] min-[1920px]:text-[18px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/querypilot-logo.svg"
        alt=""
        width={24}
        height={24}
        draggable={false}
        className="h-6 w-6 flex-none select-none min-[1920px]:h-7 min-[1920px]:w-7"
      />

      <span>QueryPilot</span>
    </Link>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={`mb-2 block px-2 ${labelClasses}`}>
        {label}
      </label>

      {children}

      {error && (
        <p id={`${htmlFor}-error`} className={errorTextClasses}>
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({
  id,
  name,
  show,
  onToggle,
  autoComplete,
  placeholder = "Enter your password",
  onChange,
  invalid,
}: {
  id: string;
  name: string;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        required
        id={id}
        name={name}
        type={show ? "text" : "password"}
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={`${inputClasses} pr-12`}
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#868b93] transition-colors hover:text-[#e6e6e6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4651bd]"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-white/[0.1]" />

      <span className={`whitespace-nowrap ${mutedClasses}`}>{label}</span>

      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-white/[0.1]" />
    </div>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="mt-6 w-full max-w-[400px] min-[1920px]:mt-8 min-[1920px]:max-w-[440px]">
      {SIGNUP_STEPS.map((label, index) => {
        const number = index + 1;
        const isActive = number === current;
        const isDone = number < current;
        const isLast = index === SIGNUP_STEPS.length - 1;

        return (
          <li
            key={label}
            aria-current={isActive ? "step" : undefined}
            className={`relative flex h-10 items-center gap-3 rounded-full px-4 text-[14px] font-medium min-[1920px]:h-11 min-[1920px]:text-[15px] ${
              index > 0 ? "mt-2" : ""
            } ${
              isActive
                ? "bg-[var(--qp-surface)] text-[var(--qp-text-primary)]"
                : isDone
                  ? "text-[var(--qp-text-secondary)]"
                  : "text-[var(--qp-text-muted)]"
            }`}
          >
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[28px] top-[32px] h-[24px] border-l border-dotted border-white/25 min-[1920px]:top-[34px] min-[1920px]:h-[28px]"
              />
            )}

            <span
              className={`relative z-10 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-medium ${
                isActive
                  ? "bg-[#3a44a8] text-white"
                  : "border border-[var(--qp-border)] bg-[var(--qp-background)] text-[var(--qp-text-secondary)]"
              }`}
            >
              {isDone ? (
                <Check size={13} strokeWidth={3} color={CHECK_GREEN} />
              ) : (
                String(number).padStart(2, "0")
              )}
            </span>

            {label}
          </li>
        );
      })}
    </ol>
  );
}

type TagDef = {
  label: string;
  Icon: LucideIcon;
  bright: boolean;
  nx: number;
  ny: number;
};

const TAGS: TagDef[] = [
  { label: "contracts.pdf", Icon: FileText, bright: false, nx: -0.8, ny: -0.72 },
  { label: "handbook.docx", Icon: FileText, bright: true, nx: 0.0, ny: -0.88 },
  { label: "notes.md", Icon: FileCode, bright: false, nx: 0.8, ny: -0.72 },
  { label: "sales.csv", Icon: Table, bright: true, nx: -0.38, ny: -0.38 },
  { label: "metrics.json", Icon: Braces, bright: true, nx: 0.4, ny: -0.3 },
  { label: "forecast.xlsx", Icon: FileSpreadsheet, bright: false, nx: -0.9, ny: 0.0 },
  { label: "tickets.zip", Icon: Archive, bright: false, nx: 0.92, ny: 0.05 },
  { label: "warehouse.sql", Icon: Database, bright: true, nx: -0.42, ny: 0.42 },
  { label: "reports.pdf", Icon: FileText, bright: true, nx: 0.42, ny: 0.45 },
  { label: "inbox.eml", Icon: Mail, bright: false, nx: -0.82, ny: 0.75 },
  { label: "wiki.html", Icon: FileCode, bright: false, nx: 0.0, ny: 0.88 },
  { label: "specs.docx", Icon: FileText, bright: false, nx: 0.82, ny: 0.75 },
];

const MAX_PULL = 170;
const STIFFNESS = 0.055;
const DAMPING = 0.9;

type TagState = {
  def: TagDef;
  w: number;
  h: number;
  hx: number;
  hy: number;
  restLen: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  phase: number;
  amp: number;
  delay: number;
  started: boolean;
  dragging: boolean;
};

function StringsField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const logo = logoRef.current;

    if (!wrap || !canvas || !logo) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let laidOut = false;
    let logoX = 0;
    let logoY = 0;
    let logoR = 38;

    const tags: TagState[] = TAGS.map((def, i) => ({
      def,
      w: 120,
      h: 36,
      hx: 0,
      hy: 0,
      restLen: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      phase: i * 1.7,
      amp: reduceMotion ? 0 : 3 + (i % 3) * 1.5,
      delay: reduceMotion ? 0 : 0.05 + i * 0.06,
      started: reduceMotion,
      dragging: false,
    }));

    const layout = () => {
      const rect = wrap.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      if (width < 10 || height < 10) {
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cx = width / 2;
      cy = height / 2;

      logoR = logo.offsetWidth / 2 + 6;

      tags.forEach((tag, i) => {
        const el = tagRefs.current[i];

        tag.w = el?.offsetWidth || 120;
        tag.h = el?.offsetHeight || 36;

        tag.hx = cx + tag.def.nx * (width / 2 - tag.w / 2 - 16);
        tag.hy = cy + tag.def.ny * (height / 2 - tag.h / 2 - 10);
        tag.restLen = Math.hypot(tag.hx - cx, tag.hy - cy);

        if (!laidOut) {
          tag.x = reduceMotion ? tag.hx : cx;
          tag.y = reduceMotion ? tag.hy : cy;
        }

        if (tag.started && el) {
          el.style.opacity = "1";
        }
      });

      laidOut = true;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const ox = cx + logoX;
      const oy = cy + logoY;

      tags.forEach((tag, i) => {
        const el = tagRefs.current[i];

        if (el) {
          el.style.transform = `translate3d(${tag.x - tag.w / 2}px, ${
            tag.y - tag.h / 2
          }px, 0)`;
        }
      });

      tags.forEach((tag) => {
        if (!tag.started) {
          return;
        }

        const dx = tag.x - ox;
        const dy = tag.y - oy;
        const dist = Math.hypot(dx, dy) || 1;

        const stretch = Math.max(0, dist - tag.restLen);
        const tension = clamp(stretch / 110, 0, 1);

        const px = -dy / dist;
        const py = dx / dist;
        const sideSpeed = tag.vx * px + tag.vy * py;
        const bow = clamp(sideSpeed * 2.4, -28, 28) * (1 - tension * 0.6);

        const mx = ox + dx / 2 + px * bow;
        const my = oy + dy / 2 + py * bow;

        if (dist <= logoR + 2) {
          return;
        }

        ctx.beginPath();
        ctx.moveTo(ox + (dx / dist) * logoR, oy + (dy / dist) * logoR);
        ctx.quadraticCurveTo(mx, my, tag.x, tag.y);
        // Polish: lines were too faint, base alpha raised from 0.14 to 0.2
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + tension * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);

      last = now;
      time += dt;

      const k = dt * 60;
      const damp = Math.pow(DAMPING, k);

      let pullX = 0;
      let pullY = 0;

      tags.forEach((tag, i) => {
        if (time < tag.delay) {
          tag.x = cx;
          tag.y = cy;

          return;
        }

        if (!tag.started) {
          tag.started = true;

          const el = tagRefs.current[i];

          if (el) {
            el.style.opacity = "1";
          }
        }

        if (tag.dragging) {
          const rx = tag.tx - tag.hx;
          const ry = tag.ty - tag.hy;
          const d = Math.hypot(rx, ry) || 1;
          const eased = MAX_PULL * Math.tanh(d / MAX_PULL);

          const targetX = tag.hx + (rx / d) * eased;
          const targetY = tag.hy + (ry / d) * eased;

          tag.vx = clamp((targetX - tag.x) * 0.35, -40, 40);
          tag.vy = clamp((targetY - tag.y) * 0.35, -40, 40);
        } else {
          const homeX = tag.hx + Math.sin(time * 0.5 + tag.phase) * tag.amp;
          const homeY =
            tag.hy + Math.cos(time * 0.6 + tag.phase * 1.3) * tag.amp * 0.5;

          tag.vx += (homeX - tag.x) * STIFFNESS * k;
          tag.vy += (homeY - tag.y) * STIFFNESS * k;

          tag.vx *= damp;
          tag.vy *= damp;
        }

        tag.x += tag.vx * k;
        tag.y += tag.vy * k;

        pullX += tag.x - tag.hx;
        pullY += tag.y - tag.hy;
      });

      const lean = 0.18 / tags.length;

      logoX += (clamp(pullX * lean * 4, -10, 10) - logoX) * 0.2 * k;
      logoY += (clamp(pullY * lean * 4, -10, 10) - logoY) * 0.2 * k;

      logo.style.transform = `translate3d(${logoX}px, ${logoY}px, 0)`;

      draw();

      raf = requestAnimationFrame(step);
    };

    const cleanups: (() => void)[] = [];

    tags.forEach((tag, i) => {
      const el = tagRefs.current[i];

      if (!el) {
        return;
      }

      let grabX = 0;
      let grabY = 0;

      const local = (event: PointerEvent) => {
        const rect = wrap.getBoundingClientRect();

        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };

      const onDown = (event: PointerEvent) => {
        if (!tag.started) {
          return;
        }

        event.preventDefault();

        const p = local(event);

        grabX = tag.x - p.x;
        grabY = tag.y - p.y;

        tag.dragging = true;
        tag.tx = tag.x;
        tag.ty = tag.y;

        el.setPointerCapture(event.pointerId);
        el.style.cursor = "grabbing";
        el.style.zIndex = "5";
      };

      const onMove = (event: PointerEvent) => {
        if (!tag.dragging) {
          return;
        }

        const p = local(event);

        tag.tx = p.x + grabX;
        tag.ty = p.y + grabY;
      };

      const onUp = (event: PointerEvent) => {
        if (!tag.dragging) {
          return;
        }

        tag.dragging = false;
        el.style.cursor = "grab";
        el.style.zIndex = "";

        if (el.hasPointerCapture(event.pointerId)) {
          el.releasePointerCapture(event.pointerId);
        }
      };

      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);

      cleanups.push(() => {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      });
    });

    layout();
    draw();

    raf = requestAnimationFrame(step);

    const observer = new ResizeObserver(() => {
      layout();
    });

    observer.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-y-0 -left-16 -right-16">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div ref={logoRef} className="relative will-change-transform">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-12 rounded-full"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 68%)",
            }}
          />

          <Link
            href="/"
            aria-label="QueryPilot home"
            className="group pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full outline-none transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qp-focus-ring)] min-[1920px]:h-20 min-[1920px]:w-20"
          >
            <span
              aria-hidden="true"
              className="block h-full w-full select-none bg-white transition-colors duration-200 group-hover:bg-[#3a44a8] group-focus-visible:bg-[#3a44a8]"
              style={{
                WebkitMaskImage: "url(/querypilot-logo.svg)",
                maskImage: "url(/querypilot-logo.svg)",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />
          </Link>
        </div>
      </div>

      {TAGS.map((tag, index) => (
        <div
          key={tag.label}
          ref={(el) => {
            tagRefs.current[index] = el;
          }}
          className="absolute left-0 top-0 cursor-grab touch-none select-none opacity-0 transition-opacity duration-700 will-change-transform"
        >
          <div
            className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--qp-border)] bg-[var(--qp-surface)] px-4 text-[13px] font-medium transition-colors hover:bg-[var(--qp-surface-hover)] hover:text-[var(--qp-text-primary)] min-[1920px]:h-10 min-[1920px]:px-5 min-[1920px]:text-[14px] ${
              tag.bright ? "text-[var(--qp-text-primary)]" : "text-[var(--qp-text-secondary)]"
            }`}
          >
            <tag.Icon
              size={14}
              className={tag.bright ? "text-[var(--qp-text-primary)]/90" : "text-[var(--qp-text-muted)]"}
            />

            {tag.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthPage({ mode }: { mode: Mode }) {
  const router = useRouter();

  const [tab, setTab] = useState<"login" | "signup">(
    mode === "signup" ? "signup" : "login",
  );

  const isTabbed = mode === "login" || mode === "signup";

  const activeMode: Mode = isTabbed ? tab : mode;

  const [showPassword, setShowPassword] = useState(false);

  // Only used by the reset-password form now. Signup has a single password field.
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState("");

  const [pending, setPending] = useState(false);

  const [passwordLength, setPasswordLength] = useState(0);

  const [savedEmail, setSavedEmail] = useState("");

  const lastSubmitAtRef = useRef(0);

  const currentCopy = copy[activeMode];

  const currentStep = getCurrentStep(activeMode);

  const errorTarget = error ? getErrorTarget(error, activeMode) : null;

  const fieldError = (name: string) =>
    errorTarget === name ? error : undefined;

  const invalidProps = (name: string) =>
    errorTarget === name
      ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` }
      : {};

  const switchTab = (next: "login" | "signup") => {
    if (next === tab) {
      return;
    }

    setTab(next);
    setError("");
    setPasswordLength(0);
    setShowPassword(false);
    setShowConfirmPassword(false);

    window.history.replaceState(
      null,
      "",
      `/${next}${window.location.search}`,
    );
  };

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
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [mode, router]);

  useEffect(() => {
    if (mode === "verify-otp") {
      setSavedEmail(sessionStorage.getItem("querypilot_pending_email") ?? "");
    }

    if (mode === "reset-password") {
      setSavedEmail(sessionStorage.getItem("querypilot_reset_email") ?? "");
    }
  }, [mode]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const now = Date.now();

    if (pending || now - lastSubmitAtRef.current < 750) {
      return;
    }

    lastSubmitAtRef.current = now;

    setError("");
    setPending(true);

    const values = new FormData(event.currentTarget);

    try {
      if (activeMode === "login") {
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

      if (activeMode === "signup") {
        const username = getValue(values, "username");

        const email = getValue(values, "email");

        const password = getValue(values, "password");

        if (!username) {
          throw new Error("Enter a username.");
        }

        if (!email) {
          throw new Error("Enter your email address.");
        }

        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
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

      if (activeMode === "verify-otp") {
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

      if (activeMode === "forgot-password") {
        const email = getValue(values, "email");

        if (!email) {
          throw new Error("Enter your email address.");
        }

        await authApi.forgotPassword({
          email,
        });

        sessionStorage.setItem("querypilot_reset_email", email);

        setSubmitted(true);

        return;
      }

      if (activeMode === "reset-password") {
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

        sessionStorage.removeItem("querypilot_reset_email");

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

  const submitLabel = pending
    ? "Please wait"
    : activeMode === "login"
      ? "Log in"
      : activeMode === "signup"
        ? "Create account"
        : activeMode === "verify-otp"
          ? "Verify email"
          : activeMode === "forgot-password"
            ? "Send reset code"
            : "Reset password";

  // Live password rule state for signup: idle (nothing typed), short, ok
  const passwordRule: "idle" | "short" | "ok" =
    passwordLength === 0 ? "idle" : passwordLength >= 8 ? "ok" : "short";

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#181818] font-sans text-[#e6e6e6] antialiased">
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,56fr)_minmax(0,44fr)]">
        <div className="hidden lg:flex lg:p-10 lg:pr-0">
          <section className="relative flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0b0b0c]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse 90% 65% at 0% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 74%), linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.8) 100%)",
              }}
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "80px 80px",
                WebkitMaskImage:
                  "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.6) 50%, transparent 90%)",
                maskImage:
                  "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.6) 50%, transparent 90%)",
              }}
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.2]"
              style={{ backgroundImage: NOISE_BG, backgroundSize: "240px 240px" }}
            />

            <div className="relative z-10 flex flex-1 flex-col px-14 pb-8 pt-8 min-[1920px]:px-16 min-[1920px]:pb-10 min-[1920px]:pt-10">
              <div className="relative mb-4 min-h-[280px] flex-1 [@media(max-height:800px)]:min-h-[240px]">
                <StringsField />
              </div>

              <div className="relative z-20 text-left">
                <h1
                  className="max-w-[560px] font-medium leading-[1.06] tracking-[-0.035em] text-[#e6e6e6] [text-wrap:balance]"
                  style={{ fontSize: "clamp(30px, min(3.1vw, 5vh), 47px)" }}
                >
                  {currentCopy.leftTitle}
                </h1>

                <p className="mt-4 max-w-[500px] text-[15px] leading-[1.6] text-[#9aa0a8] [text-wrap:balance] min-[1920px]:max-w-[540px] min-[1920px]:text-[16px]">
                  {currentCopy.leftDescription}
                </p>

                {currentStep > 0 && <Steps current={currentStep} />}
              </div>
            </div>
          </section>
        </div>

        <section className="relative flex min-h-[100dvh] items-center justify-center px-4 py-24 sm:px-8 lg:px-10 lg:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)",
            }}
          />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-6 sm:px-8 lg:px-10 lg:pt-8">
            <div className="lg:hidden">
              <AuthLogo />
            </div>

            <Link
              href="/"
              className={`ml-auto inline-flex items-center gap-2 transition-colors hover:text-[#e6e6e6] ${mutedClasses}`}
            >
              <ArrowLeft size={14} />
              Back to home
            </Link>
          </div>

          {/* Polish: card is slightly bigger so it does not look lost in the empty space */}
          <div className="relative w-full min-w-0 max-w-[480px] rounded-[24px] border border-white/10 bg-[#0b0b0c] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-9 min-[1920px]:max-w-[520px] min-[1920px]:p-11">
            {isTabbed ? (
              <div
                role="tablist"
                aria-label="Account"
                className="mx-auto mb-7 flex w-full items-center rounded-full bg-[#1c1c1e] p-1"
              >
                {(
                  [
                    ["signup", "Sign up"],
                    ["login", "Log in"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => switchTab(key)}
                    className={`h-9 flex-1 rounded-full text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4651bd] min-[1920px]:h-10 min-[1920px]:text-[14px] ${
                      tab === key
                        ? "bg-[#303034] text-white shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                        : "text-[#9aa0a8] hover:text-[#e6e6e6]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-7 text-center">
                <h2 className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-[#e6e6e6] min-[1920px]:text-[23px]">
                  {currentCopy.formTitle}
                </h2>

                <p className={`mt-2 ${mutedClasses}`}>
                  {currentCopy.formDescription}
                </p>
              </div>
            )}

            {submitted ? (
              <div role="status">
                <div className="flex items-center justify-center gap-2.5 text-[15px] font-medium text-[#e6e6e6]">
                  <Check size={18} strokeWidth={3} color={CHECK_GREEN} />
                  Check your inbox
                </div>

                <p
                  className={`mx-auto mt-3 max-w-[340px] text-center leading-6 ${mutedClasses}`}
                >
                  If an account exists for that email, you’ll receive a reset
                  code shortly.
                </p>

                <PixelDissolveButton
                  label="Enter reset code"
                  href="/reset-password"
                  color={AUTH_BLUE}
                  dissolveColor={AUTH_DISSOLVE_BLUE}
                  cellSize={5}
                  className={`mt-8 ${primaryButtonClasses}`}
                />

                <Link href="/login" className={`mt-3 ${secondaryButtonClasses}`}>
                  Return to login
                </Link>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4 [@media(max-height:800px)]:gap-3.5"
                onSubmit={submitAuth}
                noValidate
              >
                {isTabbed && (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        authApi.startGoogleOAuth(
                          tab === "signup" ? "signup" : "signin",
                        )
                      }
                      className={secondaryButtonClasses}
                    >
                      <svg
                        aria-hidden="true"
                        className="h-[17px] w-[17px] flex-none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.04 13.22l7.98 6.19C11.91 13.72 17.46 9.5 24 9.5Z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.64 5.93c4.46-4.13 7.14-10.22 7.14-17.58Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.02 28.59A14.4 14.4 0 0 1 9.25 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.86.92 7.5 2.54 10.78l7.48-6.19Z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.91-5.87l-7.64-5.93c-2.12 1.42-4.84 2.27-8.27 2.27-6.54 0-12.09-4.22-14.08-10.09l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                        />
                      </svg>

                      <span>Continue with Google</span>
                    </button>

                    <Divider label="or continue with email" />
                  </>
                )}

                {activeMode === "signup" && (
                  <Field
                    label="Username"
                    htmlFor="username"
                    error={fieldError("username")}
                  >
                    <input
                      required
                      id="username"
                      name="username"
                      autoComplete="username"
                      minLength={1}
                      className={inputClasses}
                      placeholder="e.g. amogh"
                      {...invalidProps("username")}
                    />
                  </Field>
                )}

                {activeMode === "verify-otp" ||
                activeMode === "reset-password" ? (
                  <Field
                    label="Email address"
                    htmlFor="email"
                    error={fieldError("email")}
                  >
                    <input
                      key={savedEmail}
                      required={activeMode === "reset-password"}
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      defaultValue={savedEmail}
                      className={inputClasses}
                      placeholder="you@company.com"
                      {...invalidProps("email")}
                    />
                  </Field>
                ) : (
                  <Field
                    label="Email address"
                    htmlFor="email"
                    error={fieldError("email")}
                  >
                    <input
                      required
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className={inputClasses}
                      placeholder="amogh@gmail.com"
                      {...invalidProps("email")}
                    />
                  </Field>
                )}

                {(activeMode === "verify-otp" ||
                  activeMode === "reset-password") && (
                  <Field
                    label="Verification code"
                    htmlFor="otp"
                    error={fieldError("otp")}
                  >
                    <input
                      required
                      id="otp"
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      className={`${inputClasses} tracking-[0.34em]`}
                      placeholder="000000"
                      {...invalidProps("otp")}
                    />
                  </Field>
                )}

                {activeMode === "login" && (
                  <Field
                    label="Password"
                    htmlFor="password"
                    error={fieldError("password")}
                  >
                    <PasswordInput
                      id="password"
                      name="password"
                      show={showPassword}
                      onToggle={() => setShowPassword((value) => !value)}
                      autoComplete="current-password"
                      invalid={errorTarget === "password"}
                    />
                  </Field>
                )}

                {activeMode === "signup" && (
                  <>
                    <Field
                      label="Password"
                      htmlFor="password"
                      error={fieldError("password")}
                    >
                      <PasswordInput
                        id="password"
                        name="password"
                        show={showPassword}
                        onToggle={() => setShowPassword((value) => !value)}
                        autoComplete="new-password"
                        onChange={(value) => setPasswordLength(value.length)}
                        invalid={errorTarget === "password"}
                      />
                    </Field>

                    {/* Live password rule: grey while empty, soft red while too short, green when ok */}
                    <p
                      aria-live="polite"
                      className={`-mt-1 flex items-center gap-2 px-2 transition-colors ${mutedClasses} ${
                        passwordRule === "ok"
                          ? "!text-[#e6e6e6]/80"
                          : passwordRule === "short"
                            ? "!text-red-300/90"
                            : ""
                      }`}
                    >
                      <Check
                        size={14}
                        strokeWidth={3}
                        color={
                          passwordRule === "ok"
                            ? CHECK_GREEN
                            : passwordRule === "short"
                              ? "rgba(252,165,165,0.9)"
                              : "rgba(255,255,255,0.35)"
                        }
                      />
                      Must be at least 8 characters
                    </p>
                  </>
                )}

                {activeMode === "reset-password" && (
                  <>
                    <Field
                      label="New password"
                      htmlFor="new_password"
                      error={fieldError("new_password")}
                    >
                      <PasswordInput
                        id="new_password"
                        name="new_password"
                        show={showPassword}
                        onToggle={() => setShowPassword((value) => !value)}
                        autoComplete="new-password"
                        placeholder="New password"
                        invalid={errorTarget === "new_password"}
                      />
                    </Field>

                    <Field
                      label="Confirm password"
                      htmlFor="confirm_password"
                      error={fieldError("confirm_password")}
                    >
                      <PasswordInput
                        id="confirm_password"
                        name="confirm_password"
                        show={showConfirmPassword}
                        onToggle={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        autoComplete="new-password"
                        placeholder="Repeat your password"
                        invalid={errorTarget === "confirm_password"}
                      />
                    </Field>
                  </>
                )}

                {error && !errorTarget && (
                  <div
                    role="alert"
                    className="rounded-[14px] border border-red-400/25 bg-red-500/[0.07] px-4 py-3 text-[13px] leading-5 text-red-300"
                  >
                    {error}
                  </div>
                )}

                <PixelDissolveButton
                  type="submit"
                  disabled={pending}
                  label={submitLabel}
                  color={AUTH_BLUE}
                  dissolveColor={AUTH_DISSOLVE_BLUE}
                  cellSize={5}
                  className={`mt-1 ${primaryButtonClasses}`}
                />
              </form>
            )}


            {activeMode === "login" && !submitted && (
              <p className="mt-5 text-center">
                <Link
                  href="/forgot-password"
                  className={`transition-colors hover:text-[#e6e6e6] ${mutedClasses}`}
                >
                  Forgot password?
                </Link>
              </p>
            )}

            {activeMode === "verify-otp" && (
              <p className={`mt-6 text-center ${mutedClasses}`}>
                After verification, you’ll go to login.
              </p>
            )}

            {(activeMode === "forgot-password" ||
              activeMode === "reset-password") &&
              !submitted && (
                <p className={`mt-6 text-center ${mutedClasses}`}>
                  Remembered your password?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-[#e6e6e6] transition-colors hover:text-white"
                  >
                    Return to login
                  </Link>
                </p>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}