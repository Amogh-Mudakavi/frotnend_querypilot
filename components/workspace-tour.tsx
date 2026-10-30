'use client'

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  Compass,
  FileSpreadsheet,
  FileText,
  GitCompare,
  History,
  Loader2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  Table2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { documentApi } from '@/lib/django-api'
import { PixelDissolveButton } from '@/components/pixel-dissolve-button'
import { Modal, focusRing } from '@/components/qp-ui'
import { Button, IconButton, fileKind } from '@/components/chat-ui'


/* ===================== Inlined design tokens ===================== */
/**
 * Look of the tour. Values mirror globals.css / qp-ui.tsx.
 *
 * Two shapes of the same palette on purpose:
 *  - `color` is for SVG attributes and inline styles.
 *  - `tw` is for Tailwind. Tailwind only sees complete class names in source,
 *    so the hex values have to be written out here as literals.
 *    (Make sure your Tailwind `content` globs include this file.)
 */
export const color = {
  canvas: '#181818',
  panel: '#202020',
  card: '#222222',
  border: '#2f2f2f',
  text: '#f2f2f2',
  text2: '#a6a6a6',
  muted: '#7b7b7b',
  track: '#3a3a3a',
  brand: '#3a44a8',
  focus: '#2383e2',
} as const

export const rgba = {
  brandEdge: 'rgba(58,68,168,0.85)',
  focusWash: 'rgba(35,131,226,0.2)',
  focusTint: 'rgba(35,131,226,0.12)',
  ring: 'rgba(255,255,255,0.06)',
  ringOuter: 'rgba(255,255,255,0.045)',
} as const

export const tw = {
  text: 'text-[#f2f2f2]',
  text2: 'text-[#a6a6a6]',
  muted: 'text-[#7b7b7b]',
  border: 'border-[#2f2f2f]',
  card: 'bg-[#222222]',
  canvas: 'bg-[#181818]',
  panel: 'bg-[#202020]',
  hoverBorder: 'hover:!border-[#7b7b7b]',
  focusBorder: 'focus-visible:!border-[#2383e2]',
} as const

/** Tints for the file-type icons. */
export const fileTint = {
  pdf: '#e5675f',
  docx: '#5b9bff',
  xlsx: '#45b887',
  csv: '#e0a54a',
} as const

export const ease = {
  camera: 'cubic-bezier(.65,0,.35,1)',
} as const

/** Milliseconds. */
export const duration = {
  camera: 750,
  fade: 600,
  quick: 400,
  reducedFade: 250,
} as const


/* ===================== Inlined tour story and timeline ===================== */
/**
 * Everything the tour says and where it puts it. No React, no DOM, so every
 * function here can be unit tested in plain Node (see story.test.ts).
 *
 * The example: "Will the warranty cover my laptop's dead battery?"
 * No single file has the answer. Each file holds a clue that points to the next:
 *
 *   service_report.pdf    fault = battery, reported 18 Oct 2026
 *        | needs the cover rules
 *   warranty_policy.docx  battery cover = 12 months, counted from purchase
 *        | needs the purchase date
 *   orders_2025.csv       purchased 14 Mar 2025
 *        |
 *   the maths: 14 Mar 2025 + 12 months = 14 Mar 2026, before 18 Oct 2026
 *
 * Time model: ONE clock yields (step, ms into that step). Every visual state is
 * a pure function of those two numbers (see `selectScene`). That is what makes
 * pause, jump and replay impossible to get wrong: there is no hidden state.
 */

/* ------------------------------------------------------------------ types */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>
export type Cam = Readonly<{ cx: number; cy: number; w: number; h: number }>
export type Size = Readonly<{ w: number; h: number }>
/** Opacity of a piece at steps 1..5 (0 = hidden). */
export type Vis = readonly [number, number, number, number, number]
export type FileKind = 'pdf' | 'docx' | 'xlsx' | 'csv'

/* ------------------------------------------------------------------- cues */

/** A moment on the timeline: `at` ms into `step`. */
export type Cue = Readonly<{ step: number; at: number }>
export const cue = (step: number, at = 0): Cue => ({ step, at })
export const later = (c: Cue, ms: number): Cue => ({ step: c.step, at: c.at + ms })
export const hasPlayed = (c: Cue, step: number, ms: number) => step > c.step || (step === c.step && ms >= c.at)

export const TICK_MS = 40 // how often React is told the time (the clock itself runs every frame)
export const MAX_FRAME_MS = 100 // a background tab must not make the tour jump ahead
export const TYPE_SPEED_MS = 30
export const HIGHLIGHT_DELAY_MS = 600

export const CUES = {
  typeQuestion: cue(1, 300),
  readFiles: cue(2, 300),
  reportFound: cue(2, 2300),
  reportClue: cue(2, 2500),
  policyClue: cue(3, 300),
  policyFound: cue(3, 800),
  handoffToPolicy: cue(3, 1000),
  purchaseClue: cue(4, 200),
  ordersFound: cue(4, 700),
  handoffToOrders: cue(4, 900),
  mathsLanded: cue(4, 1900),
  answerWritten: cue(5, 300),
  typeFollowUp: cue(5, 1800),
} as const

/* ------------------------------------------------------------------ copy */

export const STEPS = [
  { title: 'Ask what no single file can answer.', sub: 'Will my warranty cover this? The answer is hiding in three different files.', ms: 3600 },
  { title: 'It reads every file, then spots a clue.', sub: 'The service report says the fault is the battery. That’s where the trail starts.', ms: 4000 },
  { title: 'Each clue points to the next file.', sub: 'Battery cover lives in the warranty policy, and it counts from the purchase date.', ms: 4200 },
  { title: 'It follows the trail until it’s complete.', sub: 'The orders file has the purchase date. Now it can do the maths across all three.', ms: 5000 },
  { title: 'One answer. Every claim has a receipt.', sub: 'Cross-document reasoning, fully cited. Click any part of the map to revisit it.', ms: 5200 },
] as const

export const LAST = STEPS.length

export const QUESTION = 'Will the warranty cover my laptop’s dead battery?'
export const FOLLOWUP = 'Is the screen still covered?'

export const STATUS = [
  '',
  'Reading all 5 files as one',
  'Following the trail, file to file',
  'Joining the dots across 3 files',
  'Answer ready, zero guesses, every claim cited',
] as const

export const BADGE_LABEL = ['', '', 'Following the trail', 'Joining the dots', 'Cross-document reasoning'] as const

export const CORE_LINES = [
  { text: 'read 5 files as one · 212 chunks', cue: CUES.readFiles },
  { text: 'clue: fault = battery', cue: CUES.reportClue },
  { text: 'follow → warranty policy §4.2', cue: CUES.policyClue },
  { text: 'follow → the purchase date', cue: CUES.purchaseClue },
  { text: 'calc: Mar 2025 + 12 mo → Mar 2026', cue: CUES.mathsLanded },
  { text: 'reason 1 → 2 → 3, cite [1][2][3]', cue: CUES.answerWritten },
] as const // must stay in chronological order: `terminalLines` counts them

/* -------------------------------------------------------------- geometry */
/* World units. The workspace card sits at the origin. */

export const RECT = {
  question: { x: -530, y: -62, w: 230, h: 124 },
  workspace: { x: -160, y: -115, w: 320, h: 230 },
  badge: { x: 300, y: -236, w: 230, h: 26 },
  handoffA: { x: 570, y: -95, w: 168, h: 22 },
  handoffB: { x: 570, y: 41, w: 168, h: 22 },
  maths: { x: 568, y: 72, w: 190, h: 96 },
  answer: { x: -140, y: 190, w: 330, h: 150 },
  followUps: { x: -500, y: 205, w: 190, h: 60 },
} as const satisfies Record<string, Rect>

export type Chip = Readonly<{ label: string; kind: FileKind; w: number; cx: number; cy: number; tx: number }>
export const CHIPS: readonly Chip[] = [
  { label: 'PDF', kind: 'pdf', w: 78, cx: -195, cy: -230, tx: -90 },
  { label: 'DOCX', kind: 'docx', w: 86, cx: -65, cy: -230, tx: -30 },
  { label: 'XLSX', kind: 'xlsx', w: 86, cx: 65, cy: -230, tx: 30 },
  { label: 'CSV', kind: 'csv', w: 78, cx: 195, cy: -230, tx: 90 },
]
export const chipRect = (c: Chip): Rect => ({ x: c.cx - c.w / 2, y: c.cy - 17, w: c.w, h: 34 })

export type Evidence = Readonly<{
  id: 'report' | 'policy' | 'orders'
  kind: FileKind
  file: string
  loc: string
  rows: readonly { k: string; v: string }[]
  /** The hop number. The answer cites the same number. */
  n: number
  cue: Cue
  rect: Rect
  /** Curve from the card into the workspace (the proof flows in). */
  flow: string
}>

const EV = { x: 300, w: 230, h: 96 }

/** In the order the trail finds them. */
export const EVIDENCE: readonly Evidence[] = [
  {
    id: 'report',
    kind: 'pdf',
    file: 'service_report.pdf',
    loc: 'p.2',
    rows: [
      { k: 'Fault', v: 'Battery' },
      { k: 'Reported', v: '18 Oct 2026' },
    ],
    n: 1,
    cue: CUES.reportFound,
    rect: { ...EV, y: -200 },
    flow: 'M300,-152 C235,-152 225,-70 160,-70',
  },
  {
    id: 'policy',
    kind: 'docx',
    file: 'warranty_policy.docx',
    loc: '§4.2',
    rows: [
      { k: 'Battery cover', v: '12 months' },
      { k: 'Counted from', v: 'Purchase date' },
    ],
    n: 2,
    cue: CUES.policyFound,
    rect: { ...EV, y: -64 },
    flow: 'M300,-16 C235,-16 225,0 160,0',
  },
  {
    id: 'orders',
    kind: 'csv',
    file: 'orders_2025.csv',
    loc: 'row 41',
    rows: [{ k: 'Purchased', v: '14 Mar 2025' }],
    n: 3,
    cue: CUES.ordersFound,
    rect: { ...EV, y: 72 },
    flow: 'M300,120 C235,120 225,70 160,70',
  },
]

/** Hand-offs: the dashed trail that says WHY the search moved on to the next file. */
export const HANDOFFS = [
  { id: 'to-policy', d: 'M530,-152 C566,-152 566,-16 530,-16', rect: RECT.handoffA, label: 'Needs the cover rules', cue: CUES.handoffToPolicy, to: 3 },
  { id: 'to-orders', d: 'M530,-16 C566,-16 566,120 530,120', rect: RECT.handoffB, label: 'Needs the purchase date', cue: CUES.handoffToOrders, to: 4 },
] as const

export const MATHS_EDGE = 'M530,120 L568,120'

export const VIS = {
  question: [1, 1, 1, 1, 1],
  chips: [0, 1, 0.25, 0.25, 1],
  core: [0, 1, 1, 1, 1],
  badge: [0, 0, 1, 1, 1],
  answer: [0, 0, 0, 0, 1],
  followUps: [0, 0, 0, 0, 1],
} as const satisfies Record<string, Vis>
export const visAt = (v: Vis, step: number) => v[step - 1]

/** Fixed links. A link shares the visibility of its ends, so a line never shows without both. */
export const LINKS: readonly { id: string; d: string; vis: Vis }[] = [
  { id: 'question-core', d: 'M-300,0 C-250,0 -210,0 -160,0', vis: [0, 1, 1, 1, 1] },
  ...CHIPS.map((c) => ({
    id: `chip-${c.label}`,
    d: `M${c.cx},${c.cy + 17} C${c.cx},-175 ${c.tx},-160 ${c.tx},-115`,
    vis: VIS.chips as Vis,
  })),
  { id: 'core-answer', d: 'M0,115 C0,150 25,155 25,190', vis: [0, 0, 0, 0, 1] },
  { id: 'answer-follow', d: 'M-140,260 C-210,262 -250,250 -310,238', vis: [0, 0, 0, 0, 1] },
  { id: 'follow-question', d: 'M-405,205 C-405,140 -415,130 -415,62', vis: [0, 0, 0, 0, 1] },
]

/* ---------------------------------------------------------------- camera */

export const CAMS: readonly Cam[] = [
  { cx: -415, cy: 0, w: 390, h: 225 }, // 1: the question, big
  { cx: -15, cy: -70, w: 1100, h: 520 }, // 2: question, files, workspace and the first clue
  { cx: 350, cy: -80, w: 780, h: 410 }, // 3: the first clue hands off to the policy
  { cx: 500, cy: 45, w: 720, h: 360 }, // 4: the policy, the orders file and the maths
  { cx: 105, cy: 45, w: 1330, h: 660 }, // 5: the whole loop
]
/** Square-ish framing for phones and tall boxes. */
export const CAMS_NARROW: readonly Cam[] = [
  { cx: -415, cy: 0, w: 330, h: 330 },
  { cx: -15, cy: -70, w: 1100, h: 1100 },
  { cx: 350, cy: -80, w: 800, h: 800 },
  { cx: 500, cy: 45, w: 740, h: 740 },
  { cx: 105, cy: 45, w: 1340, h: 1340 },
]

export const isNarrow = (box: Size) => box.w < 640 || box.w / box.h < 1.2
export const camFor = (step: number, box: Size): Cam => (isNarrow(box) ? CAMS_NARROW : CAMS)[step - 1]

export type Frame = Readonly<{ scale: number; tx: number; ty: number; view: Rect }>

/** Fit `cam` into `box`. `view` is the part of the world actually visible (for the minimap). */
export function frameCamera(cam: Cam, box: Size): Frame {
  const scale = Math.min(box.w / cam.w, box.h / cam.h)
  const w = box.w / scale
  const h = box.h / scale
  return {
    scale,
    tx: box.w / 2 - cam.cx * scale,
    ty: box.h / 2 - cam.cy * scale,
    view: { x: cam.cx - w / 2, y: cam.cy - h / 2, w, h },
  }
}

/* --------------------------------------------------------------- minimap */

export const WORLD: Rect = { x: -570, y: -300, w: 1340, h: 660 }
export const MINI = { w: 112, h: Math.round((112 * WORLD.h) / WORLD.w) } as const

/** Every card, drawn tiny. `from` is the step it first appears in. */
export const MAP_BITS: readonly (Rect & { from: number })[] = [
  { ...RECT.question, from: 1 },
  { ...RECT.workspace, from: 2 },
  ...CHIPS.map((c) => ({ ...chipRect(c), from: 2 })),
  ...EVIDENCE.map((e) => ({ ...e.rect, from: e.cue.step })),
  { ...RECT.maths, from: 4 },
  { ...RECT.answer, from: 5 },
  { ...RECT.followUps, from: 5 },
]

/* ----------------------------------------------------------------- scene */

export function typedText(text: string, ms: number, start: number, reduced: boolean) {
  if (ms < start) return ''
  if (reduced) return text
  return text.slice(0, Math.floor((ms - start) / TYPE_SPEED_MS))
}

export type Scene = Readonly<{
  /** Question card text, and whether the caret is still typing. */
  question: string
  typing: boolean
  /** Same order as EVIDENCE. */
  evidence: readonly { shown: boolean; highlighted: boolean }[]
  /** Same order as HANDOFFS. */
  handoffs: readonly boolean[]
  /** How many files the trail has found so far (0..3). */
  found: number
  mathsLanded: boolean
  /** How many terminal lines are visible. They appear in order. */
  terminalLines: number
  working: boolean
  status: string
}>

/** The whole visual state of the tour, as a pure function of the clock. */
export function selectScene(step: number, ms: number, reduced: boolean): Scene {
  let question = QUESTION
  let typing = false
  if (step === 1) {
    question = typedText(QUESTION, ms, CUES.typeQuestion.at, reduced)
    typing = question.length < QUESTION.length
  } else if (step === LAST && hasPlayed(CUES.typeFollowUp, step, ms)) {
    question = typedText(FOLLOWUP, ms, CUES.typeFollowUp.at, reduced)
    typing = question.length < FOLLOWUP.length
  }

  const evidence = EVIDENCE.map((e) => ({
    shown: hasPlayed(e.cue, step, ms),
    highlighted: hasPlayed(later(e.cue, HIGHLIGHT_DELAY_MS), step, ms),
  }))

  return {
    question,
    typing,
    evidence,
    handoffs: HANDOFFS.map((h) => hasPlayed(h.cue, step, ms)),
    found: evidence.filter((e) => e.shown).length,
    mathsLanded: hasPlayed(CUES.mathsLanded, step, ms),
    terminalLines: CORE_LINES.filter((l) => hasPlayed(l.cue, step, ms)).length,
    working: step >= 2 && step <= 4,
    status: STATUS[step - 1],
  }
}


/* ===================== Inlined reusable primitives ===================== */
/* ---------------------------------------------------------- contexts */
/* Two things nearly every piece needs. Context beats threading props through 12 components. */

export const MotionContext = createContext(false) // true = reduced motion
export const useReducedMotionFlag = () => useContext(MotionContext)

export type TourNav = Readonly<{ step: number; go: (n: number) => void }>
export const TourNavContext = createContext<TourNav>({ step: 1, go: () => {} })

/* -------------------------------------------------------------- Swap */

/** Crossfade between stacked children (used for the title and subtitle). */
export function Swap({ index, items, className = '' }: { index: number; items: ReactNode[]; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {items.map((c, i) => (
        <div
          key={i}
          aria-hidden={i !== index}
          className="absolute inset-0 transition-[opacity,transform] duration-[450ms] ease-out motion-reduce:transition-none"
          style={{ opacity: i === index ? 1 : 0, transform: i === index ? 'none' : 'translateY(4px)' }}
        >
          {c}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- Edge */

/**
 * A thin curved line between two pieces, with one small dot travelling along it.
 * A `trail` edge is the dashed blue hand-off from one file to the next, dashes marching.
 * Dots and dashes only exist while the line is fully visible, so hidden lines cost nothing.
 */
export const Edge = memo(function Edge({
  d,
  v,
  dot = true,
  trail = false,
}: {
  d: string
  v: number
  dot?: boolean
  trail?: boolean
}) {
  const reduced = useReducedMotionFlag()
  const live = v === 1 && !reduced
  return (
    <g style={{ opacity: v, transition: `opacity ${duration.fade}ms ease` }}>
      <path
        d={d}
        fill="none"
        stroke={trail ? color.focus : color.muted}
        strokeOpacity={trail ? 0.95 : 0.55}
        strokeWidth={trail ? 1.5 : 1}
        strokeDasharray={trail ? '5 4' : undefined}
        vectorEffect="non-scaling-stroke"
      >
        {trail && live && <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.9s" repeatCount="indefinite" />}
      </path>
      {dot && live && (
        <circle r={2.4} fill={color.focus}>
          <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  )
})

/* -------------------------------------------------------------- Cite */

/** The numbered badge. The same number shows on the proof card and in the answer. */
export const Cite = memo(function Cite({ n }: { n: number }) {
  return (
    <span
      className="mx-0.5 inline-grid size-[16px] flex-none place-items-center rounded-full align-middle text-[10px] font-semibold text-white"
      style={{ background: color.brand }}
    >
      {n}
    </span>
  )
})

/* ----------------------------------------------------------- MapNode */

const RADIUS = { card: 'rounded-[14px]', chip: 'rounded-[10px]', pill: 'rounded-full' } as const

/**
 * A card on the map. Named MapNode (not Node) so it never shadows the DOM's global `Node` type.
 *
 * `o` is its opacity. It is clickable only on the last step, when the whole map is
 * on screen and every card is a shortcut back to the step that explains it.
 * Under reduced motion it fades only: no arrival slide.
 */
export function MapNode({
  rect,
  o,
  to,
  label,
  radius = 'card',
  accent = false,
  children,
}: {
  rect: Rect
  o: number
  to?: number
  label: string
  radius?: keyof typeof RADIUS
  accent?: boolean
  children: ReactNode
}) {
  const { step, go } = useContext(TourNavContext)
  const reduced = useReducedMotionFlag()
  const clickable = step === LAST && to !== undefined && o >= 0.5
  const activate = () => go(to as number)

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-label={clickable ? `Go to: ${label}` : undefined}
      aria-hidden={o < 0.5 ? true : undefined}
      onClick={clickable ? activate : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                activate()
              }
            }
          : undefined
      }
      className={`absolute border outline-none ${tw.card} ${tw.text} ${RADIUS[radius]} ${
        clickable ? `cursor-pointer ${tw.hoverBorder} ${tw.focusBorder}` : ''
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        opacity: o,
        borderColor: accent ? rgba.brandEdge : color.border,
        // Cards settle into place: a short rise and scale. Reduced motion gets the fade only.
        transform: o === 0 && !reduced ? 'translateY(6px) scale(0.97)' : 'none',
        transition: reduced
          ? `opacity ${duration.reducedFade}ms ease`
          : `opacity ${duration.fade}ms ease, transform ${duration.fade}ms ease, border-color ${duration.quick}ms ease`,
        pointerEvents: clickable ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  )
}


/* ===================== Inlined animation, measurement and clock hooks ===================== */
/* ---------------------------------------------------- reduced motion */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReduced(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/**
 * Live `prefers-reduced-motion`. useSyncExternalStore reads the real value on the
 * first client render (no flash of animation) and follows OS changes while open.
 *
 * "Reduce" does not mean "no motion at all": fades are fine, large movement is not.
 * So the tour keeps opacity fades but drops the camera flight, travelling dots,
 * marching dashes, typing and the arrival slide.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  )
}

/* ---------------------------------------------------------- measuring */

/** Size of an element, kept fresh with a ResizeObserver. `null` until measured. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const next = { w: el.clientWidth, h: el.clientHeight }
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, size] as const
}

/** False for the first frame. Lets the camera start in place instead of flying in from nowhere. */
export function useAfterFirstFrame() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return ready
}

/* -------------------------------------------------------------- clock */

/**
 * The tour clock: one requestAnimationFrame loop that knows the step and the
 * milliseconds into it. Nothing else keeps time.
 *
 * - Time lives in refs; React state only carries `step` and a 40 ms-quantised `ms`,
 *   so the tree re-renders 25x a second at most, not 60x.
 * - The progress bars are painted straight onto the DOM (no render per frame).
 * - Paused by: the pause button, press-and-hold on the map, a hidden tab.
 * - `byUser` says whether the last step change was a person's doing. Screen readers
 *   are only told about those; announcing every auto-advance would talk over them.
 */
export function useTourClock(open: boolean) {
  const [step, setStep] = useState(1)
  const [ms, setMs] = useState(0)
  const [paused, setPaused] = useState(false)
  const [byUser, setByUser] = useState(false)

  const stepRef = useRef(1)
  const elapsedRef = useRef(0)
  const quantRef = useRef(0)
  const pausedRef = useRef(false)
  const holdRef = useRef(false)
  const fills = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const paint = useCallback(() => {
    fills.current.forEach((el, i) => {
      if (!el) return
      const cur = stepRef.current - 1
      const p = i < cur ? 1 : i === cur ? Math.min(1, elapsedRef.current / STEPS[i].ms) : 0
      el.style.transform = `scaleX(${p})`
    })
  }, [])

  const reset = useCallback(
    (n: number) => {
      const next = Math.min(LAST, Math.max(1, n))
      stepRef.current = next
      elapsedRef.current = 0
      quantRef.current = 0
      setStep(next)
      setMs(0)
      paint()
    },
    [paint]
  )

  const goTo = useCallback(
    (n: number) => {
      setByUser(true)
      reset(n)
    },
    [reset]
  )

  const advance = useCallback(
    (dt: number) => {
      const dur = STEPS[stepRef.current - 1].ms
      elapsedRef.current = Math.min(dur, elapsedRef.current + dt)

      if (elapsedRef.current >= dur && stepRef.current < LAST) {
        stepRef.current += 1
        elapsedRef.current = 0
        quantRef.current = 0
        setStep(stepRef.current)
        setMs(0)
        setByUser(false)
      } else {
        const q = Math.floor(elapsedRef.current / TICK_MS)
        if (q !== quantRef.current) {
          quantRef.current = q
          setMs(q * TICK_MS)
        }
      }
      paint()
    },
    [paint]
  )

  // Start from the top every time the tour opens
  useEffect(() => {
    if (!open) return
    holdRef.current = false
    pausedRef.current = false
    setPaused(false)
    setByUser(false)
    reset(1)
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS)
      last = now
      if (!pausedRef.current && !holdRef.current && !document.hidden) advance(dt)
      raf = requestAnimationFrame(frame)
    }
    // Coming back to the tab must not count the time we were away
    const onVisibility = () => {
      last = performance.now()
    }

    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(raf)
    }
  }, [open, advance])

  const togglePause = useCallback(() => setPaused((p) => !p), [])

  // Press and hold on the map to pause, let go to carry on
  const holdProps = useMemo(() => {
    const hold = () => {
      holdRef.current = true
    }
    const release = () => {
      holdRef.current = false
    }
    return { onPointerDown: hold, onPointerUp: release, onPointerLeave: release, onPointerCancel: release }
  }, [])

  return { step, ms, paused, byUser, togglePause, goTo, fills, holdProps }
}


/* ===================== Inlined visual scene ===================== */
const FILE_ICON: Record<FileKind, LucideIcon> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  csv: Table2,
}

const pill = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${tw.border} ${tw.text2}`

/* ---------------------------------------------------------- backdrop */

/** Never changes, so it never re-renders: a faint dot grid and the range rings. */
const Backdrop = memo(function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: -1400,
          top: -900,
          width: 2800,
          height: 1800,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.2px)',
          backgroundSize: '28px 28px',
        }}
      />
      <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible" aria-hidden>
        <circle r={300} fill="none" stroke={rgba.ring} strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
        <circle r={470} fill="none" stroke={rgba.ringOuter} strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  )
})

/* ------------------------------------------------------------- cards */

function FileChip({ chip, o }: { chip: Chip; o: number }) {
  const Icon = FILE_ICON[chip.kind]
  return (
    <MapNode rect={chipRect(chip)} o={o} to={2} label={chip.label} radius="chip">
      <span className="flex h-full items-center justify-center gap-2 text-[13px] font-medium">
        <Icon size={15} style={{ color: fileTint[chip.kind] }} />
        {chip.label}
      </span>
    </MapNode>
  )
}

function QuestionCard({ text, typing, o }: { text: string; typing: boolean; o: number }) {
  return (
    <MapNode rect={RECT.question} o={o} to={1} label="Your question">
      <div className="px-4 pt-[14px]">
        <p className={`flex items-center gap-2 text-[14px] font-medium ${tw.text}`}>
          <MessageSquare size={15} /> Your question
        </p>
        <p className={`mt-2 h-[62px] text-[12.5px] leading-[20px] ${tw.text2}`}>
          “{text}
          {typing ? <span className="qp-caret ml-px inline-block h-[13px] w-px bg-white/70 align-middle" /> : '”'}
        </p>
      </div>
    </MapNode>
  )
}

/** The workspace: a sharp card with a little terminal inside. */
const WorkspaceCard = memo(function WorkspaceCard({
  o,
  lines,
  status,
  working,
  done,
}: {
  o: number
  lines: number
  status: string
  working: boolean
  done: boolean
}) {
  return (
    <MapNode rect={RECT.workspace} o={o} to={2} label="QueryPilot’s workspace" accent>
      <div className="flex h-full flex-col p-3.5">
        <div className="flex items-center justify-between">
          <p className={`flex items-center gap-2 text-[13.5px] font-medium ${tw.text}`}>
            <BookOpen size={15} /> QueryPilot’s workspace
          </p>
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${tw.border} ${tw.text2}`}>
            <Lock size={10} /> Private
          </span>
        </div>

        <div
          className={`mt-3 flex-1 space-y-[3px] rounded-lg border bg-[#181818] px-3 py-2.5 font-mono text-[11.5px] leading-[17px] ${tw.border} ${tw.text2}`}
        >
          {CORE_LINES.map((l, i) => (
            <p key={l.text} className="truncate" style={{ opacity: i < lines ? 1 : 0, transition: 'opacity .3s ease' }}>
              <span style={{ color: color.focus }}>$</span> {l.text}
            </p>
          ))}
        </div>

        <p className={`mt-2.5 flex h-4 items-center gap-2 text-[11.5px] ${tw.text2}`}>
          <span
            className={`size-[6px] flex-none rounded-full ${working ? 'animate-pulse motion-reduce:animate-none' : ''}`}
            style={{ background: working ? color.focus : done ? color.text : color.muted }}
          />
          <span className="truncate">{status}</span>
        </p>
      </div>
    </MapNode>
  )
})

/** One proof card. Found because of the one before it, numbered with its hop. */
const EvidenceCard = memo(function EvidenceCard({
  item,
  shown,
  highlighted,
}: {
  item: Evidence
  shown: boolean
  highlighted: boolean
}) {
  const reduced = useReducedMotionFlag()
  const Icon = FILE_ICON[item.kind]
  return (
    <MapNode rect={item.rect} o={shown ? 1 : 0} to={item.cue.step} label={`${item.file}, ${item.loc}`}>
      <div className="px-3.5 pt-3">
        <p className={`flex items-center justify-between gap-2 text-[12px] font-medium ${tw.text}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon size={13} className="flex-none" style={{ color: fileTint[item.kind] }} />
            <span className="truncate">{item.file}</span>
          </span>
          <span className={`flex flex-none items-center gap-1 text-[11px] font-normal ${tw.muted}`}>
            {item.loc}
            <Cite n={item.n} />
          </span>
        </p>
        <div className="mt-2 space-y-1">
          {item.rows.map((r) => (
            <p key={r.k} className="flex items-center justify-between text-[12px]">
              <span className={tw.text2}>{r.k}</span>
              <span
                className="rounded px-1.5 py-0.5 font-medium"
                style={{
                  background: highlighted ? rgba.focusWash : 'transparent',
                  transition: reduced ? 'none' : 'background-color .5s ease',
                }}
              >
                {r.v}
              </span>
            </p>
          ))}
        </div>
      </div>
    </MapNode>
  )
})

/** Says WHY the search moved on to the next file. */
const HandoffPill = memo(function HandoffPill({ rect, label, to, shown }: { rect: Rect; label: string; to: number; shown: boolean }) {
  return (
    <MapNode rect={rect} o={shown ? 1 : 0} to={to} label={label} radius="pill">
      <span className="flex h-full items-center justify-center gap-1.5 text-[10.5px] font-medium">
        <ArrowRight size={11} style={{ color: color.focus }} />
        {label}
      </span>
    </MapNode>
  )
})

/** The moat badge: first it follows the trail, then it reasons across what it found. */
const Badge = memo(function Badge({ step }: { step: number }) {
  return (
    <MapNode rect={RECT.badge} o={visAt(VIS.badge, step)} to={3} label="Cross-document reasoning" radius="pill" accent={step >= LAST}>
      <span className="flex h-full items-center justify-center gap-1.5 text-[11.5px] font-medium">
        {step >= LAST ? <GitCompare size={12} /> : <Compass size={12} />}
        {BADGE_LABEL[step - 1]}
      </span>
    </MapNode>
  )
})

/** The maths: only possible once all three files are on the trail. */
const MathsCard = memo(function MathsCard({ landed }: { landed: boolean }) {
  return (
    <MapNode rect={RECT.maths} o={landed ? 1 : 0} to={4} label="The maths" accent={landed}>
      <div className="px-3.5 pt-3">
        <p className={`flex items-center justify-between gap-2 text-[12px] font-medium ${tw.text}`}>
          <span className="flex items-center gap-1.5">
            <Calculator size={13} className={`flex-none ${tw.text2}`} />
            The maths
          </span>
          <span className="flex flex-none items-center">
            <Cite n={2} />
            <Cite n={3} />
          </span>
        </p>
        <div className="mt-2 space-y-1">
          <p className="flex items-center justify-between text-[12px]">
            <span className={tw.text2}>Cover ended</span>
            <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: rgba.focusWash }}>
              14 Mar 2026
            </span>
          </p>
          <p className="flex items-center justify-between text-[12px]">
            <span className={tw.text2}>Fault reported</span>
            <span className="rounded px-1.5 py-0.5 font-medium">18 Oct 2026</span>
          </p>
        </div>
      </div>
      <span
        className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
        style={{ background: color.brand }}
      >
        7 months late
      </span>
    </MapNode>
  )
})

/** Every claim carries the same number as the proof card it came from, even the sum. */
const AnswerCard = memo(function AnswerCard({ o }: { o: number }) {
  return (
    <MapNode rect={RECT.answer} o={o} to={4} label="The answer">
      <div className="px-3.5 pt-3">
        <p className={`text-[13.5px] font-medium leading-[19px] ${tw.text}`}>
          Not the battery. Its 12-month cover
          <Cite n={2} />
          ended 14 Mar 2026
          <Cite n={3} />.
        </p>
        <p className={`mt-1 text-[11.5px] leading-[16px] ${tw.text2}`}>
          The fault was reported 18 Oct 2026
          <Cite n={1} />, seven months too late for a free repair.
        </p>
        <div className="mt-2.5 flex gap-1.5">
          <span className={pill}>
            <FileText size={10} className={tw.muted} />3 files cited
          </span>
          <span className={pill}>
            <GitCompare size={10} className={tw.muted} />2 hops
          </span>
          <span className={pill}>
            <Check size={10} className={tw.muted} />0 guesses
          </span>
        </div>
      </div>
    </MapNode>
  )
})

const FollowUpsCard = memo(function FollowUpsCard({ o }: { o: number }) {
  return (
    <MapNode rect={RECT.followUps} o={o} to={1} label="Follow-ups">
      <div className="px-3.5 pt-[11px]">
        <p className={`flex items-center gap-2 text-[13.5px] font-medium ${tw.text}`}>
          <History size={14} /> Follow-ups
        </p>
        <p className={`mt-0.5 text-[11.5px] ${tw.text2}`}>Remembers the whole thread</p>
      </div>
    </MapNode>
  )
})

/* ---------------------------------------------------- map furniture */

/** Top left: fills as the trail finds each file. */
const TrailCounter = memo(function TrailCounter({ found, visible }: { found: number; visible: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${tw.border} ${tw.panel} ${tw.text2}`}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity .5s ease' }}
    >
      <span className="flex items-center gap-1">
        {EVIDENCE.map((e, i) => (
          <span
            key={e.id}
            className="size-[6px] rounded-full"
            style={{ background: i < found ? color.focus : color.track, transition: 'background-color .4s ease' }}
          />
        ))}
      </span>
      The trail: {found} of {EVIDENCE.length} files
    </div>
  )
})

/**
 * Bottom right: where the camera is looking. The blue box is a unit rect moved
 * and scaled with `transform`, so it animates on the compositor like everything
 * else (animating left/top/width/height would trigger layout every frame).
 * non-scaling-stroke keeps its outline 1px however far it is stretched.
 */
const Minimap = memo(function Minimap({ step, view, visible, animate }: { step: number; view: Rect; visible: boolean; animate: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute bottom-3 right-3 overflow-hidden rounded-lg border ${tw.border} ${tw.panel}`}
      style={{ width: MINI.w, height: MINI.h, opacity: visible ? 1 : 0, transition: 'opacity .5s ease' }}
    >
      <svg viewBox={`${WORLD.x} ${WORLD.y} ${WORLD.w} ${WORLD.h}`} className="block h-full w-full" preserveAspectRatio="xMidYMid meet">
        {MAP_BITS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={8}
            fill={color.muted}
            opacity={step >= b.from ? 0.85 : 0.18}
            style={{ transition: 'opacity .5s ease' }}
          />
        ))}
        <rect
          width={1}
          height={1}
          fill={rgba.focusTint}
          stroke={color.focus}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.w}, ${view.h})`,
            transformOrigin: '0 0',
            transition: animate ? `transform ${duration.camera}ms ${ease.camera}` : 'none',
          }}
        />
      </svg>
    </div>
  )
})

/* -------------------------------------------------------------- scene */

export function TourScene({ step, ms, go, reduced }: { step: number; ms: number; go: (n: number) => void; reduced: boolean }) {
  const [boxRef, size] = useElementSize<HTMLDivElement>()
  const ready = useAfterFirstFrame()

  const frame = useMemo(() => (size ? frameCamera(camFor(step, size), size) : null), [step, size])
  const nav = useMemo(() => ({ step, go }), [step, go])
  const scene = selectScene(step, ms, reduced)

  // The extras need room, so phones go without them
  const chrome = !!size && size.w >= 480 && step >= 2
  const animateCamera = ready && !reduced

  return (
    <MotionContext.Provider value={reduced}>
      <TourNavContext.Provider value={nav}>
        <div ref={boxRef} className={`relative min-h-0 flex-1 overflow-hidden rounded-[14px] border ${tw.border} ${tw.canvas}`}>
          {/* The camera. No will-change here: it would rasterise the layer once and blur the text when zoomed. */}
          <div
            className="absolute left-0 top-0"
            style={{
              transform: frame ? `translate(${frame.tx}px, ${frame.ty}px) scale(${frame.scale})` : 'none',
              transformOrigin: '0 0',
              transition: animateCamera ? `transform ${duration.camera}ms ${ease.camera}` : 'none',
              visibility: frame ? 'visible' : 'hidden',
            }}
          >
            <Backdrop />

            {/* Lines. A line only shows when both of its ends are on screen. */}
            <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible" aria-hidden>
              {LINKS.map((l) => (
                <Edge key={l.id} d={l.d} v={visAt(l.vis, step)} />
              ))}
              {EVIDENCE.map((e, i) => (
                <Edge key={e.id} d={e.flow} v={scene.evidence[i].shown ? 1 : 0} />
              ))}
              {HANDOFFS.map((h, i) => (
                <Edge key={h.id} d={h.d} v={scene.handoffs[i] ? 1 : 0} dot={false} trail />
              ))}
              <Edge d={MATHS_EDGE} v={scene.mathsLanded ? 1 : 0} dot={false} />
            </svg>

            {CHIPS.map((c) => (
              <FileChip key={c.label} chip={c} o={visAt(VIS.chips, step)} />
            ))}
            <QuestionCard text={scene.question} typing={scene.typing} o={visAt(VIS.question, step)} />
            <WorkspaceCard
              o={visAt(VIS.core, step)}
              lines={scene.terminalLines}
              status={scene.status}
              working={scene.working}
              done={step === LAST}
            />
            <Badge step={step} />
            {EVIDENCE.map((e, i) => (
              <EvidenceCard key={e.id} item={e} shown={scene.evidence[i].shown} highlighted={scene.evidence[i].highlighted} />
            ))}
            {HANDOFFS.map((h, i) => (
              <HandoffPill key={h.id} rect={h.rect} label={h.label} to={h.to} shown={scene.handoffs[i]} />
            ))}
            <MathsCard landed={scene.mathsLanded} />
            <AnswerCard o={visAt(VIS.answer, step)} />
            <FollowUpsCard o={visAt(VIS.followUps, step)} />
          </div>

          <TrailCounter found={scene.found} visible={chrome} />
          {frame && <Minimap step={step} view={frame.view} visible={chrome} animate={animateCamera} />}
        </div>
      </TourNavContext.Provider>
    </MotionContext.Provider>
  )
}


/* ===================== Inlined source upload components ===================== */
const MAX_BYTES = 50 * 1024 * 1024
const MAX_FILES = 20
const CONCURRENCY = 3
const ALLOWED_EXT = ['.pdf', '.docx', '.xlsx', '.csv']

type UploadStatus = 'queued' | 'uploading' | 'done' | 'duplicate' | 'failed'
type UploadItem = { id: number; file: File; status: UploadStatus; error: string }

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
const hasAllowedExt = (f: File) => ALLOWED_EXT.some((ext) => f.name.toLowerCase().endsWith(ext))
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ---- Modal type scale: matches the chat/sidebar look. Tune here only. ---- */
const T = {
  title: 'text-[14px] min-[1920px]:text-[17px]',
  body: 'text-[13px] min-[1920px]:text-[16px]',
  small: 'text-[12px] min-[1920px]:text-[14px]',
} as const

/* ------------------------------------------------------------------
   One row per selected file. Same look as the sidebar's SourceRow.
------------------------------------------------------------------- */
function UploadRow({ item, locked, onRemove }: { item: UploadItem; locked: boolean; onRemove: (id: number) => void }) {
  const kind = fileKind(item.file.name)
  const { status } = item

  const sub =
    status === 'uploading'
      ? 'Uploading…'
      : status === 'done'
        ? 'Uploaded · indexing started'
        : status === 'duplicate'
          ? 'Already in this workspace'
          : status === 'failed'
            ? item.error || 'Upload failed'
            : `${kind.label} · ${formatSize(item.file.size)}`

  return (
    <li className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-white/[0.04] motion-reduce:transition-none sm:gap-3 sm:px-2 sm:py-2">
      <span className={`grid size-8 flex-none place-items-center rounded-lg min-[1920px]:size-10 ${kind.badge}`}>
        <kind.Icon size={16} strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1" title={item.file.name}>
        <span className={`block truncate leading-5 text-zinc-100 ${T.body}`}>{item.file.name}</span>
        <span className={`mt-0.5 block truncate leading-4 ${T.small} ${status === 'failed' ? 'text-red-300' : 'text-zinc-500'}`}>
          {sub}
        </span>
      </span>

      {status === 'uploading' && <Loader2 size={15} className="flex-none animate-spin text-zinc-400 motion-reduce:animate-none" />}
      {(status === 'done' || status === 'duplicate') && <Check size={15} strokeWidth={1.75} className="flex-none text-zinc-300" />}
      {status === 'failed' && <AlertCircle size={15} strokeWidth={1.75} className="flex-none text-red-300" />}
      {!locked && (status === 'queued' || status === 'failed') && (
        <IconButton label={`Remove ${item.file.name}`} icon={X} size={15} className="!size-8" onClick={() => onRemove(item.id)} />
      )}
    </li>
  )
}

/* ------------------------------------------------------------------
   SourceDropzone: pick or drop several files, upload them one request
   per file with a small concurrency pool. Used in AddSourceDialog.
------------------------------------------------------------------- */
export function SourceDropzone({
  workspaceId,
  onUploaded,
  onSuccess,
}: {
  workspaceId: number
  onUploaded: () => Promise<void>
  onSuccess?: () => void
}) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [notice, setNotice] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(1)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const patch = useCallback((id: number, change: Partial<UploadItem>) => {
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...change } : i)))
  }, [])

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || busy) return
    const incoming = Array.from(list)
    if (incoming.length === 0) return

    let badType = 0
    let tooBig = 0
    let overLimit = 0
    const seen = new Set(items.map((i) => fileKey(i.file)))
    const accepted: UploadItem[] = []

    for (const f of incoming) {
      if (!hasAllowedExt(f)) {
        badType += 1
        continue
      }
      if (f.size > MAX_BYTES) {
        tooBig += 1
        continue
      }
      if (seen.has(fileKey(f))) continue
      if (items.length + accepted.length >= MAX_FILES) {
        overLimit += 1
        continue
      }
      seen.add(fileKey(f))
      accepted.push({ id: nextId.current++, file: f, status: 'queued', error: '' })
    }

    const problems: string[] = []
    if (badType) problems.push(`${badType} unsupported (use PDF, DOCX, XLSX or CSV)`)
    if (tooBig) problems.push(`${tooBig} over 50 MB`)
    if (overLimit) problems.push(`${overLimit} over the ${MAX_FILES} file limit`)
    setNotice(problems.length ? `Skipped: ${problems.join(', ')}.` : '')

    if (accepted.length) setItems((cur) => [...cur, ...accepted])
  }

  const remove = (id: number) => setItems((cur) => cur.filter((i) => i.id !== id))

  const pending = items.filter((i) => i.status === 'queued' || i.status === 'failed')

  const upload = async () => {
    if (busy || pending.length === 0) return
    const queue = pending
    setBusy(true)
    setNotice('')

    let cursor = 0
    let added = 0
    let failures = 0

    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++]
        patch(item.id, { status: 'uploading', error: '' })
        try {
          const res = await documentApi.upload(workspaceId, item.file)
          if (res.duplicate) {
            patch(item.id, { status: 'duplicate' })
          } else {
            added += 1
            patch(item.id, { status: 'done' })
          }
        } catch (e) {
          failures += 1
          patch(item.id, { status: 'failed', error: errText(e) })
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    try {
      await onUploaded() // once for the whole batch
    } catch {
      /* the list will refresh on the next poll */
    }
    setBusy(false)
    if (failures === 0 && added > 0 && onSuccess) timer.current = setTimeout(onSuccess, 700)
  }

  const hasFailed = items.some((i) => i.status === 'failed')
  const label = busy
    ? 'Uploading…'
    : pending.length === 0
      ? 'Add sources'
      : hasFailed && pending.every((i) => i.status === 'failed')
        ? 'Retry'
        : `Add ${pending.length} ${pending.length === 1 ? 'source' : 'sources'}`

  const doneCount = items.filter((i) => i.status === 'done' || i.status === 'duplicate').length

  return (
    <div className="font-sans">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        accept=".pdf,.docx,.xlsx,.csv"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = '' // lets the same file be picked again
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setDrag(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`flex w-full flex-col items-center rounded-xl border border-dashed text-center transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
          items.length ? 'px-3 py-4' : 'px-3 py-6 sm:py-7 min-[1920px]:py-10'
        } ${drag ? 'border-white/40 bg-white/[0.06]' : 'border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04]'} ${focusRing}`}
      >
        <span className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-zinc-300 min-[1920px]:size-10">
          <Upload size={16} strokeWidth={1.75} />
        </span>
        <span className={`mt-2.5 text-zinc-100 ${T.body}`}>
          <span className="[@media(pointer:coarse)]:hidden">Drop files here or browse</span>
          <span className="hidden [@media(pointer:coarse)]:inline">Tap to choose files</span>
        </span>
        <span className={`mt-1 text-zinc-500 ${T.small}`}>PDF, DOCX, XLSX or CSV, up to 50 MB each.</span>
      </button>

      {notice && (
        <p role="status" className={`mt-3 leading-5 text-zinc-400 ${T.small}`}>
          {notice}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 max-h-[min(240px,32dvh)] space-y-0.5 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.1)_transparent] [scrollbar-width:thin] min-[1920px]:max-h-[320px]">
          {items.map((item) => (
            <UploadRow key={item.id} item={item} locked={busy} onRemove={remove} />
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className={`min-w-0 truncate text-zinc-500 ${T.small}`} aria-live="polite">
          {items.length === 0
            ? ''
            : busy || doneCount > 0
              ? `${doneCount} of ${items.length} done`
              : `${items.length} ${items.length === 1 ? 'file' : 'files'} selected`}
        </span>
        <Button
          variant="primary"
          className={`!h-9 w-full !px-4 sm:w-auto min-[1920px]:!h-11 ${T.body}`}
          disabled={busy || pending.length === 0}
          onClick={() => void upload()}
        >
          {label}
        </Button>
      </div>
    </div>
  )
}

/* ---------------- Add source dialog (shell header button) ---------------- */
export function AddSourceDialog({
  workspaceId,
  open,
  onClose,
  onUploaded,
}: {
  workspaceId: number
  open: boolean
  onClose: () => void
  onUploaded: () => Promise<void>
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="add-source-title"
      width="max-w-[440px] min-[1920px]:max-w-[520px]"
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id="add-source-title" className={`font-medium text-zinc-50 ${T.title}`}>
            Add sources
          </h2>
          <p className={`mt-0.5 text-zinc-500 ${T.small}`}>Every chat in this workspace can use them.</p>
        </div>
        <IconButton label="Close" icon={X} size={15} className="!size-8 flex-none" onClick={onClose} />
      </div>
      <div className="min-h-0 overflow-y-auto p-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 sm:pt-4">
        <SourceDropzone workspaceId={workspaceId} onUploaded={onUploaded} onSuccess={onClose} />
      </div>
    </Modal>
  )
}


/* ----------------------------- Product tour shell ----------------------------- */
export function WorkspaceTour({
  open,
  onClose,
  onFinish,
}: {
  open: boolean
  onClose: () => void
  onFinish: () => void
}) {
  const reduced = useReducedMotion()
  const { step, ms, paused, byUser, togglePause, goTo, fills, holdProps } = useTourClock(open)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(step + 1)
      else if (e.key === 'ArrowLeft') goTo(step - 1)
      else if (e.key === ' ') {
        // Space on a button should activate that button, not pause the tour.
        const target = e.target
        if (target instanceof HTMLElement && target.closest('button,input,textarea,a')) return
        e.preventDefault()
        togglePause()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, step, goTo, togglePause])

  const last = step === LAST
  const ctaCls =
    'qp-ring !min-w-0 !min-h-9 !rounded-xl !px-3.5 !py-0 !text-[13px] !font-medium !normal-case !tracking-normal !text-[#111111]'

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="tour-title"
      width="max-w-[940px]"
      surface="bg-[#202020]"
      borderCls="border-[#2f2f2f]"
      panelClass="qp-dialog-in h-[min(660px,calc((100dvh-1.5rem)/var(--qp-z,1)))]"
    >
      <div className="flex h-14 flex-none items-center justify-between bg-[#181818] px-5 sm:px-6">
        <h2 id="tour-title" className="text-[16px] font-medium text-[#f2f2f2]">
          Meet QueryPilot
        </h2>
        <button
          type="button"
          aria-label="Close tour"
          onClick={onClose}
          className={`grid size-8 place-items-center rounded-md text-[#a6a6a6] transition-colors hover:bg-white/[0.08] hover:text-white ${focusRing}`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
        <Swap
          index={step - 1}
          className="mb-4 h-[46px] flex-none text-center"
          items={STEPS.map((s) => (
            <div key={s.title}>
              <p className="text-[15px] font-semibold text-[#f2f2f2] sm:text-[17px]">{s.title}</p>
              <p className="mt-1 text-[11.5px] text-[#a6a6a6] sm:text-[12.5px]">{s.sub}</p>
            </div>
          ))}
        />
        <p className="sr-only" aria-live={byUser ? 'polite' : 'off'}>
          {STEPS[step - 1].title} {STEPS[step - 1].sub}
        </p>

        <div {...holdProps} className="flex min-h-0 flex-1 select-none flex-col">
          <TourScene step={step} ms={ms} go={goTo} reduced={reduced} />
        </div>
      </div>

      <div className="grid h-[68px] flex-none grid-cols-[1fr_auto_1fr] items-center bg-[#181818] px-4 sm:px-6">
        <div>
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? 'Play tour' : 'Pause tour'}
            title={paused ? 'Play (Space)' : 'Pause (Space)'}
            className={`grid size-8 place-items-center rounded-md text-[#a6a6a6] transition-colors hover:bg-white/[0.08] hover:text-white ${focusRing}`}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>

        {/* One thin bar per step. It fills while that step plays. Click one to jump there. */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Tour steps">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i + 1 === step}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => goTo(i + 1)}
              className={`flex h-8 w-10 items-center rounded-sm sm:w-14 ${focusRing}`}
            >
              <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/[0.14]">
                <span
                  ref={(el) => {
                    fills.current[i] = el
                  }}
                  className="block h-full w-full origin-left rounded-full bg-[#f2f2f2]"
                  style={{ transform: 'scaleX(0)' }}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          {last && (
            <div className="qp-rise">
              <PixelDissolveButton
                label="Add your first source"
                color="#eaeaea"
                dissolveColor="#ffffff"
                onClick={onFinish}
                className={ctaCls}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}