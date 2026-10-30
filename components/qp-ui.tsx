'use client'

import { memo, useEffect, useRef, type ReactNode } from 'react'

import { PixelDissolveButton } from '@/components/pixel-dissolve-button'

/* ------------------------------------------------------------------
   QueryPilot shared UI: one palette, one font, one button, one modal.
   Used by NotebookHome, WorkspaceShell and the product tour so the
   whole workspace area looks like a single product.

   page #191919 · sidebar #202020 · modal #202020 · menu #252525
   border white @ 8-10% · text #e6e6e6 / #9b9b9b / #787878
   accent #2383e2 · primary button #3a44a8 · destructive #e5665a (Notion red)

   Sizing: every button is a 32px pill with 13px medium text.
------------------------------------------------------------------- */

// Geist (loaded in layout.tsx) → Inter Display → Inter → system
export const FONT_SANS =
  "var(--font-geist-sans), 'Geist', 'Inter Display', Inter, ui-sans-serif, system-ui, sans-serif"

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2383e2]'

export const inputCls =
  'h-9 w-full rounded-md border border-white/[0.1] bg-[#191919] px-3 text-[13px] text-[#e6e6e6] outline-none transition-colors ' +
  'placeholder:text-[#6f6f6f] hover:border-white/[0.16] focus:border-[#2383e2] disabled:opacity-60'

// Quiet icon button: no box until you hover it.
export const iconBtn =
  'grid size-7 place-items-center rounded-md text-[#8a8a8a] transition-colors hover:bg-white/[0.07] hover:text-[#e6e6e6] ' +
  focusRing

// Shared menu look (row menus, account menu, popovers)
export const MENU_PANEL =
  'rounded-lg border border-white/[0.09] bg-[#252525] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
export const MENU_ITEM =
  'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-[#e0e0e0] outline-none transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08]'

/* ---------------- Buttons: 32px pills ---------------- */
export type Variant = 'primary' | 'ghost' | 'danger' | 'light'

const VARIANT: Record<Variant, { color: string; dissolve: string; text: string }> = {
  primary: { color: '#3a44a8', dissolve: '#2a3282', text: '!text-white' },
  ghost: { color: '#2f2f2f', dissolve: '#1c1c1c', text: '!text-[#e6e6e6]' },
  danger: { color: '#e5665a', dissolve: '#b8483e', text: '!text-white' },
  light: { color: '#ececec', dissolve: '#8b9295', text: '!text-[#111111]' },
}

// Labels are written in normal sentence case ("New chat"), not shouting caps.
export function Btn({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
}: {
  label: string
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  className?: string
}) {
  const v = VARIANT[variant]
  return (
    <PixelDissolveButton
      type="button"
      label={label}
      color={v.color}
      dissolveColor={v.dissolve}
      cellSize={4}
      disabled={disabled}
      onClick={onClick}
      className={`!h-8 !min-h-0 !min-w-0 !w-auto !rounded-full !px-4 !py-0 !text-[13px] !font-medium !normal-case !tracking-normal whitespace-nowrap ${v.text} disabled:!opacity-40 ${className}`}
    />
  )
}

/* ---------------- Document status ---------------- */
export type DocState = 'ready' | 'indexing' | 'queued' | 'failed'

export function docState(raw: unknown): DocState {
  const s = String(raw ?? '')
  if (/fail|error/i.test(s)) return 'failed'
  if (/pend|queue/i.test(s)) return 'queued'
  if (/process|index/i.test(s)) return 'indexing'
  return 'ready'
}

export const PILL_LABEL: Record<DocState, string> = {
  ready: 'Ready',
  indexing: 'Indexing',
  queued: 'Queued',
  failed: 'Failed',
}
export const PILL_CLS: Record<DocState, string> = {
  ready: 'bg-[#2e5a43] text-[#bfe6cf]',
  indexing: 'bg-[#2c5183] text-[#c6dcf7]',
  queued: 'bg-[#444444] text-[#d2d2d2]',
  failed: 'bg-[#6a2e2e] text-[#f3c4c4]',
}

export function Pill({ state, className = '' }: { state: DocState; className?: string }) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium ${PILL_CLS[state]} ${className}`}
    >
      <span className="size-1 rounded-full bg-current opacity-80" />
      {PILL_LABEL[state]}
    </span>
  )
}

/* ---------------- Modal (stackable, focus-trapped) ---------------- */
let scrollLocks = 0
let savedOverflow = ''
const modalStack: symbol[] = []

export function Modal({
  open,
  onClose,
  locked = false,
  // `tone` is kept so existing callers still compile. Destructive dialogs now
  // look like every other dialog; the red lives on the confirm button only.
  tone: _tone = 'default',
  labelledBy,
  width = 'max-w-[400px]',
  panelClass = '',
  surface = 'bg-[#202020]',
  borderCls = 'border-white/[0.09]',
  children,
}: {
  open: boolean
  onClose: () => void
  locked?: boolean
  tone?: 'default' | 'danger'
  labelledBy: string
  width?: string
  panelClass?: string
  surface?: string
  borderCls?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const lockedRef = useRef(locked)
  closeRef.current = onClose
  lockedRef.current = locked

  useEffect(() => {
    if (!open) return
    const token = Symbol('modal')
    modalStack.push(token)
    const prev = document.activeElement as HTMLElement | null
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    const key = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!lockedRef.current) closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>(sel))
      if (!f.length) {
        // Nothing focusable inside: keep focus on the dialog itself instead of letting it escape.
        e.preventDefault()
        ref.current.focus()
        return
      }
      const first = f[0]
      const last = f[f.length - 1]
      const a = document.activeElement
      if (e.shiftKey && (a === first || a === ref.current || !ref.current.contains(a))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (a === last || !ref.current.contains(a))) {
        e.preventDefault()
        first.focus()
      }
    }
    if (scrollLocks++ === 0) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    document.addEventListener('keydown', key, true)
    const node = ref.current

    // Move focus into the dialog on open, so keyboard users are not left behind it.
    const raf = requestAnimationFrame(() => {
      const el = ref.current
      if (!el || el.contains(document.activeElement)) return
      const target = el.querySelector<HTMLElement>('[data-autofocus]')
      ;(target ?? el).focus({ preventScroll: true })
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', key, true)
      const i = modalStack.indexOf(token)
      if (i >= 0) modalStack.splice(i, 1)
      if (--scrollLocks === 0) document.body.style.overflow = savedOverflow
      const a = document.activeElement
      if (!a || a === document.body || (node && node.contains(a))) prev?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-3 sm:p-4"
      style={{ fontFamily: FONT_SANS }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        // qp-zoom scales the dialog up on TV-sized screens; max height is divided back down so it never overflows.
        style={{ maxHeight: 'calc((100dvh - 1.5rem) / var(--qp-z, 1))' }}
        className={`qp-zoom qp-dialog-in flex w-full ${width} flex-col overflow-hidden rounded-xl border outline-none ${surface} ${borderCls} text-[#e6e6e6] shadow-[0_24px_64px_rgba(0,0,0,0.6)] ${panelClass}`}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------------- Global styles: TV scaling + tour animations ---------------- */
/*
 * Why this is a plain <style> and not <style jsx global>:
 * styled-jsx in the app router only reaches the server-rendered HTML when a
 * StyleRegistry wraps the tree. Without one, rules like .qp-h are injected
 * after hydration, so a full page load (the OAuth callback does one) paints
 * the shell with no height first and then snaps to full size. A plain style
 * tag is part of the HTML the server sends, so the first paint is already
 * laid out. dangerouslySetInnerHTML keeps React from escaping the CSS.
 */
const QP_CSS = `
/* Next.js dev indicator suppressor (for screenshots) */
nextjs-portal,
[data-nextjs-dev-indicator],
[data-nextjs-toast],
#next-logo {
  display: none !important;
}

/* Laptop = 1x. Large monitors / TVs scale the whole UI up. */
:root {
  --qp-z: 1;
}
@media (min-width: 1920px) {
  :root {
    --qp-z: 1.25;
  }
}
@media (min-width: 2560px) {
  :root {
    --qp-z: 1.6;
  }
}
.qp-zoom {
  zoom: var(--qp-z);
}
.qp-h {
  height: 100vh;
  height: calc(100dvh / var(--qp-z));
}
.qp-minh {
  min-height: 100vh;
  min-height: calc(100dvh / var(--qp-z));
}

/* Sign-in handoff: the browser keeps the old page's last frame on screen until
   this page has painted, then crossfades. Ignored where unsupported. */
@view-transition {
  navigation: auto;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 280ms;
  animation-timing-function: ease-out;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(root),
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}

/* Older animations, kept in case other pages still use them */
@keyframes qp-pill {
  0% {
    opacity: 0;
  }
  3%,
  30% {
    opacity: 1;
  }
  33.4%,
  100% {
    opacity: 0;
  }
}
@keyframes qp-grow {
  0%,
  8% {
    transform: scaleX(0);
    opacity: 1;
  }
  40%,
  88% {
    transform: scaleX(1);
    opacity: 1;
  }
  100% {
    transform: scaleX(1);
    opacity: 0;
  }
}
@keyframes qp-pop {
  0%,
  42% {
    opacity: 0;
    transform: translateY(5px);
  }
  52%,
  90% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}
@keyframes qp-drift {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

/* Dialog entrance */
@keyframes qp-dialog-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.975);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.qp-dialog-in {
  animation: qp-dialog-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

/* Tour: small pieces. Only opacity / transform are animated, so nothing repaints a big area. */
@keyframes qp-dots {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }
  40% {
    opacity: 1;
  }
}
.qp-dot {
  animation: qp-dots 1.2s infinite ease-in-out;
}
.qp-dot:nth-child(2) {
  animation-delay: 0.15s;
}
.qp-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes qp-caret {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}
.qp-caret {
  animation: qp-caret 1s steps(1) infinite;
}

@keyframes qp-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.35);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
  }
}
.qp-ring {
  animation: qp-ring 1.8s ease-out 0.6s 3;
}

@keyframes qp-rise {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.qp-rise {
  animation: qp-rise 0.3s ease-out both;
}

/* Tour: blue beam that travels around a card's border (one card only) */
@property --qp-a {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes qp-spin {
  to {
    --qp-a: 360deg;
  }
}
.qp-beam::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1.5px;
  pointer-events: none;
  background: conic-gradient(from var(--qp-a), transparent 0deg, transparent 292deg, #2f6be2 338deg, transparent 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  animation: qp-spin 4.5s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .qp-dialog-in,
  .qp-beam::after,
  .qp-dot,
  .qp-caret,
  .qp-ring,
  .qp-rise {
    animation: none;
  }
  .qp-anim {
    animation: none !important;
  }
  .qp-pill-last {
    opacity: 1 !important;
  }
}
`

export const QpGlobalStyles = memo(function QpGlobalStyles() {
  return <style dangerouslySetInnerHTML={{ __html: QP_CSS }} />
})