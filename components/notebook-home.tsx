'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as RKeyboardEvent,
  type ReactNode,
} from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Calculator,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  GitMerge,
  Landmark,
  Package,
  Percent,
  ShieldCheck,
  Wallet,
  ChevronRight,
  ChevronsUpDown,
  Code2,
  Folder,
  FolderOpen,
  Headphones,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  MoreHorizontal,
  Plus,
  Receipt,
  Scale,
  Search,
  Settings,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { PixelDissolveButton } from '@/components/pixel-dissolve-button'

import {
  authApi,
  chatApi,
  documentApi,
  workspaceApi,
  type User,
  type Workspace,
} from '../lib/django-api'
import { FONT_SANS, QpGlobalStyles, focusRing } from './qp-ui'

const ACTIVE_WORKSPACE_KEY = 'querypilot_active_workspace_id'
const NAME_MAX = 120
const STATS_LIMIT = 100
const STATS_CONCURRENCY = 6
const STATS_FLUSH_MS = 120

/* ---------------- Design tokens (one place, used everywhere) ---------------- */
const AUTH_BLUE = '#3a44a8'
const AUTH_DISSOLVE_BLUE = '#2a3282'
const DANGER = '#e5665a' // Notion's destructive red

// Primary pill: 32px tall, 13px medium, same everywhere.
// Disabled uses explicit darker/desaturated colors (not opacity) so the label stays legible but clearly inactive.
const PRIMARY_BUTTON_CLASSES =
  '!h-8 !min-h-0 !w-auto !rounded-full !border !border-[#3a44a8] !bg-[#3a44a8] !px-4 !text-[13px] !font-medium ' +
  '!normal-case !tracking-normal !text-white hover:!bg-[#4651bd] active:!bg-[#313a99] disabled:!cursor-not-allowed disabled:!border-[#2a2f6b] disabled:!bg-[#2a2f6b] disabled:!text-white/70 whitespace-nowrap ' +
  focusRing

// Shared look for the secondary (ghost) pill buttons. Height and side padding are added where each one is used.
const PILL_BASE =
  '!min-h-0 !w-auto !rounded-full !text-[13px] !font-medium !normal-case !tracking-normal whitespace-nowrap shrink-0 ' +
  focusRing

// Inputs: 1px border, accent focus. FIELD_SM (32px) pairs with pill buttons on one row.
const FIELD_BASE =
  'w-full rounded-md border border-white/[0.1] bg-[#191919] text-[13px] text-[#ececec] outline-none transition-colors placeholder:text-zinc-500 hover:border-white/[0.16] focus:border-[#6b76e0] disabled:opacity-60'
const FIELD = `h-9 px-3 ${FIELD_BASE}`
const FIELD_SM = `h-8 px-3 ${FIELD_BASE}`
const MENU_ITEM =
  'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-[#e0e0e0] outline-none transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.09]'
const MENU_PANEL =
  'rounded-lg border border-white/[0.09] bg-[#252525] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
const NAV_ITEM =
  'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-[#a8a8a8] transition-colors hover:bg-white/[0.04] hover:text-[#ececec]'

/* ---------------- Templates: each one shows the kind of question it answers ---------------- */
type Category = 'Finance' | 'People & pay' | 'Legal' | 'Operations' | 'Technical'
const CATEGORIES: Category[] = ['Finance', 'People & pay', 'Legal', 'Operations', 'Technical']

type Preset = {
  name: string
  ask: string
  Icon: LucideIcon
  tint: string
  answer: string
  source: string
  cat: Category
}
const PRESETS: Preset[] = [
  // Cross-document templates: every question needs facts from two files (rules in a PDF, data in a sheet, or two PDFs compared).
  { name: 'Payroll & Tax Slab Joins', cat: 'People & pay', ask: 'How much tax does Priya owe this year?', Icon: Calculator, tint: '#e0a54a', answer: 'Her ₹12,00,000 taxable income (payroll.xlsx) spans three slabs in the PDF: ₹80,000 a year, about ₹6,667 a month.', source: 'tax-slabs.pdf + payroll.xlsx' },
  { name: 'Contract Conflict Check', cat: 'Legal', ask: 'Do the NDA and MSA disagree on termination notice?', Icon: GitMerge, tint: '#dc6b66', answer: "Yes. The NDA allows 30 days' notice, while the MSA requires 60.", source: 'nda.pdf + vendor-msa.pdf' },
  { name: 'Vendor Spend vs Contract Caps', cat: 'Finance', ask: 'Which vendors billed above their contract cap?', Icon: Landmark, tint: '#529cca', answer: 'Acme billed ₹14.2L against a ₹12L cap, and Zenith ₹6.8L against ₹6L.', source: 'vendor-msa.pdf + invoices.xlsx' },
  { name: 'Loan Rates & Applicants', cat: 'Finance', ask: "What is applicant A-102's monthly EMI?", Icon: Percent, tint: '#9a6dd7', answer: 'A credit score of 760 sits in the 8.5% band, so the EMI on ₹10L over 20 years is about ₹8,678.', source: 'rate-sheet.pdf + applicants.xlsx' },
  { name: 'Insurance Claims & Policies', cat: 'Finance', ask: 'Is claim 4821 covered, and for how much?', Icon: ShieldCheck, tint: '#4dab9a', answer: 'A ₹3,00,000 claim is within the ₹5L limit; after the ₹25,000 deductible the payout is ₹2,75,000.', source: 'policy.pdf + claims.xlsx' },
  { name: 'Sales Commission Plans', cat: 'People & pay', ask: 'What commission does Rahul earn for Q3?', Icon: Wallet, tint: '#7c8cf0', answer: '₹82,000: 5% on his first ₹10L of sales and 8% on the remaining ₹4L.', source: 'commission-plan.pdf + q3-sales.xlsx' },
  { name: 'Research Paper Comparison', cat: 'Technical', ask: 'Which paper reports the best F1 on SQuAD?', Icon: FlaskConical, tint: '#9a6dd7', answer: 'Paper B reports 0.91 F1, ahead of Paper A at 0.88, both on the same test split.', source: 'paper-a.pdf + paper-b.pdf' },
  { name: 'Inventory & Supplier Terms', cat: 'Operations', ask: 'Which SKUs need reordering, and from whom?', Icon: Package, tint: '#4dab9a', answer: 'SKU-114 and SKU-207 are below reorder level; order from Nova Parts and Kite Supply.', source: 'reorder-rules.pdf + stock.xlsx' },
  { name: 'HR & Onboarding', cat: 'People & pay', ask: 'How many leave days carry over?', Icon: Users, tint: '#4dab9a', answer: 'Up to 10 unused days carry over into the next year.', source: 'leave-policy.pdf' },
  { name: 'Customer Support Runbooks', cat: 'Operations', ask: 'How do I refund a duplicate charge?', Icon: Headphones, tint: '#529cca', answer: 'Open the charge in Billing, choose Refund duplicate, then confirm.', source: 'refund-runbook.md' },
  { name: 'Salary & Tax Policies', cat: 'People & pay', ask: 'Which deductions apply to my CTC?', Icon: Receipt, tint: '#e0a54a', answer: 'HRA and the standard deduction apply to your CTC breakdown.', source: 'tax-policy.pdf' },
  { name: 'Financial 10-K Reports', cat: 'Finance', ask: 'What drove operating margin last year?', Icon: BarChart3, tint: '#9a6dd7', answer: 'Margin rose as cost of revenue grew slower than sales.', source: 'form-10k.pdf' },
  { name: 'Legal & Vendor Contracts', cat: 'Legal', ask: 'When does the vendor contract renew?', Icon: Scale, tint: '#dc6b66', answer: 'It renews each year unless cancelled 60 days before the term ends.', source: 'vendor-msa.pdf' },
  { name: 'Engineering Specs', cat: 'Technical', ask: 'Which endpoints need the admin scope?', Icon: Code2, tint: '#7c8cf0', answer: 'Every /admin route requires the admin scope.', source: 'api-spec.yaml' },
]

const sourceFiles = (source: string) =>
  source
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
const isSheet = (file: string) => /\.(xlsx|xls|csv)$/i.test(file)

/* ---------------- Status ---------------- */
type StatusKey = 'synced' | 'indexing' | 'idle'
const STATUS_DOT: Record<StatusKey, string> = {
  synced: 'bg-zinc-300',
  indexing: 'bg-zinc-500',
  idle: 'bg-zinc-700',
}

function statusOf(m: { loaded: boolean; documents: number | null; indexing: number }): StatusKey {
  if (!m.loaded) return 'idle'
  if (m.indexing > 0) return 'indexing'
  return (m.documents ?? 0) > 0 ? 'synced' : 'idle'
}

function StatusDot({ s }: { s: StatusKey }) {
  return (
    <span className="relative flex size-2 flex-none items-center justify-center">
      {s === 'indexing' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-500 opacity-60 motion-reduce:animate-none" />
      )}
      <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${STATUS_DOT[s]}`} />
    </span>
  )
}

/* ---------------- Helpers ---------------- */
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.'

const selectWorkspace = (id: number) => {
  try {
    window.sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, String(id))
  } catch {
    /* ignore */
  }
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const byRecent = (a: Workspace, b: Workspace) =>
  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

function initialsForUser(user: User | null) {
  const src = user?.username?.trim() || user?.email?.trim() || ''
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return src.slice(0, 2).toUpperCase() || '—'
}

function formatRelative(value: string) {
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ''
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function validateName(raw: string): string | null {
  const t = raw.trim()
  if (!t) return 'Give your workspace a name.'
  if (t.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(t)) return "That name contains characters that aren't allowed."
  return null
}

function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])
  return ref
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, aborted: () => boolean) {
  let next = 0
  const worker = async () => {
    while (!aborted()) {
      const i = next++
      if (i >= items.length) return
      await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/* ---------------- Per-workspace stats ---------------- */
type Stat = { documents: number | null; conversations: number | null; indexing: number }
const StatsContext = createContext<Record<number, Stat>>({})

function useMeta(id: number) {
  const s = useContext(StatsContext)[id]
  return {
    loaded: Boolean(s),
    documents: s?.documents ?? null,
    conversations: s?.conversations ?? null,
    indexing: s?.indexing ?? 0,
  }
}

/* ---------------- Shared UI: pill buttons + dialog shell ---------------- */
/*
 * One secondary button for every dialog: 32px, 13px medium, fully rounded.
 * It is a PixelDissolveButton, so it gets the same hover as every other button on the site.
 * The label is plain text (the dissolve button takes a string, not children elements).
 */
function Pill({
  variant = 'ghost',
  className = '',
  children,
  onClick,
  disabled,
}: {
  variant?: 'ghost' | 'danger'
  className?: string
  children: string
  onClick?: () => void
  disabled?: boolean
}) {
  const danger = variant === 'danger'
  return (
    <PixelDissolveButton
      type="button"
      label={children}
      onClick={onClick}
      disabled={disabled}
      color={danger ? DANGER : 'rgba(255,255,255,0.07)'}
      textColor={danger ? '#ffffff' : '#e6e6e6'}
      dissolveColor={danger ? '#7a1f1a' : 'rgba(255,255,255,0.28)'}
      cellSize={4}
      className={`${PILL_BASE} !h-8 !px-4 ${className}`}
    />
  )
}

function Dialog({
  open,
  onClose,
  locked = false,
  labelledBy,
  width = 'max-w-[400px]',
  height = '',
  padded = true,
  children,
}: {
  open: boolean
  onClose: () => void
  locked?: boolean
  labelledBy: string
  width?: string
  height?: string
  padded?: boolean
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const lockedRef = useRef(locked)
  closeRef.current = onClose
  lockedRef.current = locked

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!lockedRef.current) closeRef.current()
        return
      }
      const el = panelRef.current
      if (e.key !== 'Tab' || !el) return
      const f = Array.from(el.querySelectorAll<HTMLElement>(sel))
      if (!f.length) return
      const a = document.activeElement
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && (a === first || !el.contains(a))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (a === last || !el.contains(a))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      prev?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`qp-dialog-in flex max-h-[calc(100dvh-2rem)] w-full ${width} ${height} flex-col overflow-hidden rounded-xl border border-[var(--qp-border)] bg-[var(--qp-sidebar)] shadow-[0_20px_50px_rgba(0,0,0,0.45)] ${padded ? 'p-5' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------------- Shell pieces ---------------- */
function Logo() {
  return (
    <Link
      href="/"
      aria-label="QueryPilot home"
      className={`inline-flex items-center gap-2.5 rounded-md text-[14px] font-medium tracking-tight text-[#e6e6e6] ${focusRing}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/querypilot-logo.svg" alt="" width={20} height={20} draggable={false} />
      <span>QueryPilot</span>
    </Link>
  )
}

function AccountMenu({
  user,
  onLogout,
  variant,
  settingsHref,
}: {
  user: User | null
  onLogout: () => void
  variant: 'sidebar' | 'avatar'
  settingsHref: string | null
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)
  const avatar = (
    <span className="grid size-6 flex-none place-items-center rounded-md bg-[#3a3a3a] text-[10.5px] font-semibold text-[#e6e6e6]">
      {initialsForUser(user)}
    </span>
  )
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === 'sidebar'
            ? `flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-white/[0.05] ${open ? 'bg-white/[0.05]' : ''} ${focusRing}`
            : `grid size-9 place-items-center rounded-md transition-colors hover:bg-white/[0.06] ${focusRing}`
        }
      >
        {avatar}
        {variant === 'sidebar' && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#d0d0d0]">
              {user?.username ?? 'Account'}
            </span>
            <ChevronsUpDown size={14} className="flex-none text-[#8a8a8a]" />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 w-[232px] ${MENU_PANEL} ${
            variant === 'sidebar' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'
          }`}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-[13px] font-medium text-[#e6e6e6]">{user?.username ?? 'Account'}</p>
            <p className="truncate text-[12px] text-[#9a9a9a]">{user?.email ?? ''}</p>
          </div>
          <div className="my-1 h-px bg-white/[0.08]" />
          {settingsHref && (
            <Link href={settingsHref} role="menuitem" onClick={close} className={MENU_ITEM}>
              <Settings size={14} className="text-[#9b9b9b]" /> Settings
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className={`${MENU_ITEM} text-[var(--qp-text-secondary)] hover:bg-[var(--qp-surface-hover)] hover:text-[var(--qp-text-primary)]`}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/* Sidebar is navigation + a library summary. It never re-lists the workspaces. */
function SidebarStat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="flex h-7 items-center justify-between px-2.5 text-[13px]">
      <span className="flex items-center gap-2 text-[#8c8c8c]">
        {dot && <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${dot}`} />}
        {label}
      </span>
      <span className="tabular-nums text-[#c4c4c4]">{value}</span>
    </div>
  )
}

/* ---------------- Workspace list ---------------- */
// Header and rows share these columns and the same horizontal padding, so every column lines up.
const ROW_COLS = 'grid-cols-[minmax(0,1fr)_auto_28px] md:grid-cols-[minmax(0,1fr)_88px_64px_88px_28px]'
const ROW_PAD = 'pl-4 pr-2'

function ListHead() {
  return (
    <div
      className={`hidden h-9 items-center gap-4 border-b border-white/[0.08] ${ROW_PAD} text-[12px] text-[#8c8c8c] md:grid ${ROW_COLS}`}
    >
      <span>Name</span>
      <span className="text-right">Documents</span>
      <span className="text-right">Chats</span>
      <span className="text-right">Updated</span>
      <span aria-hidden="true" />
    </div>
  )
}

/*
 * Row actions. The parent row lifts itself above its siblings while the menu is open
 * (z-30), so the panel is never painted underneath the next row's button or text.
 * Near the bottom of the viewport the panel opens upward.
 */
function RowMenu({
  w,
  open,
  setOpen,
  onOpen,
  onDelete,
}: {
  w: Workspace
  open: boolean
  setOpen: (v: boolean) => void
  onOpen: (w: Workspace) => void
  onDelete: (w: Workspace) => void
}) {
  const [up, setUp] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [setOpen])
  const ref = useDismiss<HTMLDivElement>(open, close)

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setUp(window.innerHeight - r.bottom < 150)
    }
    setOpen(!open)
  }

  return (
    <div ref={ref} className="absolute right-2 top-1/2 -translate-y-1/2">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${w.title}`}
        onClick={toggle}
        className={`grid size-7 place-items-center rounded-md text-[#8a8a8a] transition-colors hover:bg-white/[0.07] hover:text-[#e6e6e6] ${
          open ? 'bg-white/[0.07] text-[#e6e6e6]' : ''
        } ${focusRing}`}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-40 w-[168px] ${MENU_PANEL} ${up ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          <button type="button" role="menuitem" onClick={() => { close(); onOpen(w) }} className={MENU_ITEM}>
            <FolderOpen size={14} className="text-[#9b9b9b]" /> Open
          </button>
          <Link
            href={`/workspaces/${w.id}/settings`}
            role="menuitem"
            onClick={() => { close(); selectWorkspace(w.id) }}
            className={MENU_ITEM}
          >
            <Settings size={14} className="text-[#9b9b9b]" /> Settings
          </Link>
          <div className="my-1 h-px bg-white/[0.08]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { close(); onDelete(w) }}
            className={`${MENU_ITEM} text-[#f08a84] hover:bg-[#3a2323] hover:text-[#ffb0aa]`}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

function WorkspaceRow({ w, onOpen, onDelete }: { w: Workspace; onOpen: (w: Workspace) => void; onDelete: (w: Workspace) => void }) {
  const meta = useMeta(w.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const st = statusOf(meta)
  const docs = meta.loaded ? meta.documents ?? 0 : null
  const chats = meta.loaded ? meta.conversations ?? 0 : null

  return (
    <li
      className={`relative border-b border-white/[0.06] last:border-b-0 [&:last-child>button]:rounded-b-lg ${menuOpen ? 'z-30' : ''}`}
    >
      <button
        type="button"
        onClick={() => onOpen(w)}
        className={`grid h-11 w-full items-center gap-4 ${ROW_PAD} text-left transition-colors hover:bg-white/[0.04] ${ROW_COLS} ${focusRing}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative flex-none">
            <Folder size={16} strokeWidth={1.6} className="text-zinc-400" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-[#191919] p-px">
              <StatusDot s={st} />
            </span>
          </span>
          <span className="truncate text-[14px] font-medium text-[#ececec]">{w.title}</span>
        </span>
        <span className="hidden text-right text-[13px] tabular-nums md:block">
          {meta.indexing > 0 ? (
            <span className="rounded-full bg-[var(--qp-surface-hover)] px-2 py-0.5 text-[12px] text-[var(--qp-text-secondary)]">Indexing {meta.indexing}</span>
          ) : docs === null ? null : (
            <span className={docs === 0 ? 'text-[#6f6f6f]' : 'text-[#b4b4b4]'}>{docs}</span>
          )}
        </span>
        <span className={`hidden text-right text-[13px] tabular-nums md:block ${chats ? 'text-[#b4b4b4]' : 'text-[#6f6f6f]'}`}>{chats ?? ''}</span>
        <span className="text-right text-[13px] tabular-nums text-[#9a9a9a]">{formatRelative(w.updated_at)}</span>
        <span aria-hidden="true" />
      </button>
      <RowMenu w={w} open={menuOpen} setOpen={setMenuOpen} onOpen={onOpen} onDelete={onDelete} />
    </li>
  )
}

/* ---------------- Templates ---------------- */
function TemplateIcon({ p }: { p: Preset }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 flex-none place-items-center rounded-md border border-[var(--qp-border)] bg-[var(--qp-input)] text-[var(--qp-text-secondary)]"
    >
      <p.Icon size={14} strokeWidth={1.6} />
    </span>
  )
}

function TemplateCard({ p, busy, disabled, onPick }: { p: Preset; busy: boolean; disabled: boolean; onPick: (p: Preset) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(p)}
      disabled={disabled}
      className={`flex w-full flex-col rounded-lg border border-white/[0.1] px-4 py-3.5 text-left transition-colors enabled:hover:border-white/[0.18] enabled:hover:bg-white/[0.04] focus-visible:border-white/[0.18] focus-visible:bg-white/[0.04] active:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
    >
      <span className="flex items-center gap-2.5">
        <TemplateIcon p={p} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-5 text-[#ececec]">{p.name}</span>
        {busy && <span className="flex-none text-[12px] text-[#9a9a9a]">Creating…</span>}
      </span>
      <span className="mt-1.5 block text-[13px] leading-5 text-[#8c8c8c] [text-wrap:pretty]">“{p.ask}”</span>
    </button>
  )
}

// Intro copy and onboarding form share one measure: 560px, or exactly two grid columns when the grid has three.
const COL_W = 'min-w-0 max-w-[560px] xl:max-w-[calc((200%_-_12px)/3)]'
const GRID = 'grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3'

function SectionHead({ children, hint, action }: { children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[14px] font-medium leading-7 text-[#ececec]">{children}</h2>
        {action}
      </div>
      {hint && <p className="max-w-[640px] text-[13px] leading-5 text-[#8c8c8c] [text-wrap:pretty]">{hint}</p>}
    </div>
  )
}

/* ---------------- Template gallery (opened from the sidebar or "Browse all") ---------------- */
/*
 * Cards are neutral surfaces. The template's tint appears in exactly three places: the icon tile,
 * the file glyphs, and the border on hover. No colour washes on the card itself.
 * The answer panel sits fully inside the card and is pinned to the bottom, so every row lines up
 * even when the questions wrap to a different number of lines.
 */
function FileChip({ file }: { file: string }) {
  const Glyph = isSheet(file) ? FileSpreadsheet : FileText
  return (
    <span className="inline-flex h-5 max-w-full items-center gap-1 rounded bg-[var(--qp-input)] px-1.5 text-[11px] text-[var(--qp-text-secondary)]">
      <Glyph size={11} strokeWidth={1.6} className="flex-none text-[var(--qp-text-muted)]" aria-hidden="true" />
      <span className="truncate">{file}</span>
    </span>
  )
}

function GalleryCard({ p, exists, busy, disabled, onPick }: { p: Preset; exists: boolean; busy: boolean; disabled: boolean; onPick: (p: Preset) => void }) {
  const files = sourceFiles(p.source)
  return (
    <button
      type="button"
      onClick={() => onPick(p)}
      disabled={disabled}
      className={`group flex h-full w-full flex-col rounded-lg border border-[var(--qp-border)] bg-[var(--qp-surface)] p-4 text-left transition-colors enabled:hover:bg-[var(--qp-surface-hover)] focus-visible:bg-[var(--qp-surface-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
    >
      <span className="flex items-center gap-2.5">
        <TemplateIcon p={p} />
        <span className="min-w-0 flex-1 break-words text-[14px] font-medium leading-5 text-[var(--qp-text-primary)]">{p.name}</span>
        {busy ? (
          <span className="flex-none text-[12px] text-[var(--qp-text-secondary)]">Creating…</span>
        ) : exists ? (
          <span className="inline-flex flex-none items-center gap-1 text-[12px] text-[var(--qp-text-secondary)]">
            Open <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
          </span>
        ) : (
          <ArrowUpRight
            size={14}
            strokeWidth={1.8}
            aria-hidden="true"
            className="flex-none text-[var(--qp-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        )}
      </span>

      <span className="mt-2 block text-[13px] leading-5 text-[var(--qp-text-secondary)] [text-wrap:pretty]">“{p.ask}”</span>

      <span className="mt-auto block pt-4">
        <span className="block rounded-md border border-[var(--qp-border-subtle)] bg-[var(--qp-background)] px-3 pb-3 pt-2.5">
          <span className="block text-[11px] leading-4 text-[var(--qp-text-muted)]">Sample answer</span>
          <span className="mt-1 block text-[13px] leading-[18px] text-[var(--qp-text-primary)] [text-wrap:pretty]">{p.answer}</span>
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {files.map((f) => (
              <FileChip key={f} file={f} />
            ))}
          </span>
        </span>
      </span>
    </button>
  )
}

function TemplateGallery({
  open,
  onClose,
  presets,
  existing,
  pending,
  creating,
  onPick,
}: {
  open: boolean
  onClose: () => void
  presets: Preset[]
  existing: Set<string>
  pending: string | null
  creating: boolean
  onPick: (p: Preset) => void
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'All'>('All')
  useEffect(() => {
    if (open) {
      setQ('')
      setCat('All')
    }
  }, [open])

  const needle = q.trim().toLowerCase()
  const matched = useMemo(
    () => (needle ? presets.filter((p) => `${p.name} ${p.ask} ${p.source}`.toLowerCase().includes(needle)) : presets),
    [presets, needle]
  )
  // Category counts follow the search, so the rail always tells you where the matches are.
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: matched.length }
    for (const p of matched) c[p.cat] = (c[p.cat] ?? 0) + 1
    return c
  }, [matched])
  const shown = cat === 'All' ? matched : matched.filter((p) => p.cat === cat)
  const created = presets.filter((p) => existing.has(p.name.toLowerCase())).length
  const tabs: (Category | 'All')[] = ['All', ...CATEGORIES]

  return (
    // Fixed height so the dialog does not jump while you filter; only the card area scrolls.
    <Dialog open={open} onClose={onClose} labelledBy="tpl-title" width="max-w-[1080px]" height="h-[min(780px,calc(100dvh-2rem))]" padded={false}>
      <div className="flex h-14 flex-none items-center gap-3 border-b border-white/[0.08] px-5">
        <h2 id="tpl-title" className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-white">
          Templates
          <span className="text-[13px] font-normal tabular-nums text-[#7e7e7e]">{presets.length}</span>
        </h2>
        <div className="relative ml-auto min-w-0 flex-1 sm:max-w-[260px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            spellCheck={false}
            className={`${FIELD_SM} !pl-8`}
          />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={`-mr-2 grid size-8 flex-none place-items-center rounded-md text-[#8a8a8a] transition-colors hover:bg-white/[0.07] hover:text-[#e6e6e6] ${focusRing}`}
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Template categories"
          className="hidden w-[188px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-white/[0.08] p-2.5 sm:flex"
        >
          {tabs.map((t) => {
            const active = cat === t
            const n = counts[t] ?? 0
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setCat(t)}
                className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors ${
                  active ? 'bg-white/[0.06] text-[#ececec]' : 'text-[#a8a8a8] hover:bg-white/[0.04] hover:text-[#ececec]'
                } ${focusRing}`}
              >
                <span className="truncate">{t}</span>
                <span className={`flex-none text-[12px] tabular-nums ${active ? 'text-[#a8a8a8]' : n === 0 ? 'text-[#4f4f4f]' : 'text-[#6f6f6f]'}`}>{n}</span>
              </button>
            )
          })}
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5 [scrollbar-color:#3a3a3a_transparent] [scrollbar-width:thin]">
          <div className="-mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] sm:hidden" role="group" aria-label="Template categories">
            {tabs.map((t) => {
              const active = cat === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCat(t)}
                  className={`h-7 flex-none whitespace-nowrap rounded-full border px-3 text-[12px] transition-colors ${
                    active
                      ? 'border-white/[0.2] bg-white/[0.08] text-[#ececec]'
                      : 'border-white/[0.1] text-[#a8a8a8] hover:text-[#ececec]'
                  } ${focusRing}`}
                >
                  {t}
                </button>
              )
            })}
          </div>

          <p className="mb-4 max-w-[60ch] text-[13px] leading-5 text-[#8c8c8c]">
            Each template starts an empty workspace with this name. Add your own documents, then ask questions like these.
          </p>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <p className="text-[13px] text-zinc-500">{q.trim() ? <>No templates match “{q.trim()}”</> : 'No templates in this category'}</p>
              <Pill
                onClick={() => {
                  setQ('')
                  setCat('All')
                }}
              >
                Clear filters
              </Pill>
            </div>
          ) : (
            <div className="grid grid-cols-1 auto-rows-fr gap-3 lg:grid-cols-2">
              {shown.map((p) => (
                <GalleryCard
                  key={p.name}
                  p={p}
                  exists={existing.has(p.name.toLowerCase())}
                  busy={pending === p.name}
                  disabled={creating}
                  onPick={onPick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-11 flex-none items-center gap-4 border-t border-white/[0.08] px-5 text-[12px] text-[#8c8c8c]">
        <span className="tabular-nums" aria-live="polite">
          {shown.length === presets.length ? `${presets.length} templates` : `${shown.length} of ${presets.length} templates`}
        </span>
        {created > 0 && <span className="tabular-nums">{created} already in your workspaces</span>}
        <span className="ml-auto hidden items-center gap-1.5 sm:flex">
          <kbd className="rounded border border-white/[0.12] px-1.5 py-px text-[10px] text-[#8a8a8a]">Esc</kbd>
          to close
        </span>
      </div>
    </Dialog>
  )
}

/* ---------------- Create form (used inline and in the dialog) ---------------- */
function CreateForm({
  creating,
  autoFocus = false,
  onCreate,
  onCancel,
}: {
  creating: boolean
  autoFocus?: boolean
  onCreate: (name: string) => Promise<void>
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    if (creating) return
    const v = validateName(name)
    if (v) return setErr(v)
    setErr('')
    try {
      await onCreate(name)
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  const inline = !onCancel // onboarding: single row. Dialog keeps Cancel + primary below.

  const errorEl = err ? (
    <p id="ws-name-err" role="alert" className="mt-2 text-[13px] text-[#f08a84]">
      {err}
    </p>
  ) : null

  const primary = (
    <PixelDissolveButton
      type="button"
      label={creating ? 'Creating…' : 'Create workspace'}
      disabled={!name.trim() || creating}
      onClick={() => void submit()}
      color={AUTH_BLUE}
      dissolveColor={AUTH_DISSOLVE_BLUE}
      cellSize={4}
      className={PRIMARY_BUTTON_CLASSES}
    />
  )

  const input = (
    <input
      id="ws-name"
      autoFocus={autoFocus}
      value={name}
      maxLength={NAME_MAX}
      disabled={creating}
      onChange={(e) => {
        setName(e.target.value)
        if (err) setErr('')
      }}
      onKeyDown={(e: RKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void submit()
        }
      }}
      placeholder="e.g. Return policy and warranty"
      aria-invalid={Boolean(err)}
      aria-describedby={err ? 'ws-name-err' : undefined}
      className={inline ? `${FIELD_SM} sm:w-[320px] sm:flex-none` : FIELD}
    />
  )

  return (
    <div>
      <label htmlFor="ws-name" className="mb-2 block text-[13px] font-medium text-[#c4c4c4]">
        Workspace name
      </label>
      {inline ? (
        <>
          {/* Both controls are 32px; 8px gap. Stacks (left-aligned) below sm. */}
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            {input}
            {primary}
          </div>
          {errorEl}
        </>
      ) : (
        <>
          {input}
          {errorEl}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Pill disabled={creating} onClick={onCancel}>
              Cancel
            </Pill>
            {primary}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Delete confirmation (one click to confirm) ---------------- */
function DeleteDialog({
  workspace,
  onClose,
  onConfirm,
}: {
  workspace: Workspace | null
  onClose: () => void
  onConfirm: (w: Workspace) => Promise<void>
}) {
  const meta = useMeta(workspace?.id ?? -1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const cancelWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setBusy(false)
    setErr('')
  }, [workspace?.id])

  // Cancel (the safe choice) gets focus when the dialog opens. The dissolve button has no autoFocus prop,
  // so we focus the button inside its wrapper.
  useEffect(() => {
    if (!workspace) return
    const t = window.setTimeout(() => cancelWrap.current?.querySelector('button')?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [workspace])

  const submit = async () => {
    if (!workspace || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(workspace)
    } catch (x) {
      setErr(errorMessage(x))
      setBusy(false)
    }
  }

  return (
    <Dialog open={workspace !== null} onClose={onClose} locked={busy} labelledBy="del-title">
      {workspace && (
        <>
          <h2 id="del-title" className="text-[15px] font-semibold tracking-tight text-white">
            Delete “{workspace.title}”?
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-[#a8a8a8]">
            This permanently deletes the workspace, including{' '}
            {meta.documents !== null ? plural(meta.documents, 'document') : 'its documents'} and{' '}
            {meta.conversations !== null ? plural(meta.conversations, 'chat') : 'its chats'}. This cannot be undone.
          </p>
          {err && (
            <p role="alert" className="mt-3 text-[13px] text-[#f08a84]">
              {err}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <div ref={cancelWrap}>
              <Pill disabled={busy} onClick={onClose}>
                Cancel
              </Pill>
            </div>
            <PixelDissolveButton
              type="button"
              label={busy ? 'Deleting…' : 'Confirm'}
              disabled={busy}
              onClick={() => void submit()}
              color="#d45a4d"
              dissolveColor="#7a1f1a"
              cellSize={4}
              className="!h-8 !min-h-0 !w-auto !rounded-full !border !border-[#d45a4d] !bg-[#d45a4d] !px-4 !text-[13px] !font-medium !normal-case !tracking-normal !text-white hover:!bg-[#df6a5d] active:!bg-[#ad4139] disabled:!cursor-not-allowed disabled:!border-[#7d342f] disabled:!bg-[#7d342f] disabled:!text-white/70 whitespace-nowrap"
            />
          </div>
        </>
      )}
    </Dialog>
  )
}

/* ---------------- Command palette (Cmd/Ctrl+K) ---------------- */
type PaletteItem = { id: string; group: string; label: string; hint: string; Icon: LucideIcon; run: () => void }

function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])
  const needle = query.trim().toLowerCase()
  const shown = useMemo(() => (needle ? items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(needle)) : items), [items, needle])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, shown])
  if (!open) return null

  const run = (i?: PaletteItem) => {
    if (!i) return
    onClose()
    i.run()
  }
  const onKey = (e: RKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(shown[active])
    } else if (e.key === 'Escape') onClose()
  }
  let lastGroup = ''
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-white/[0.09] bg-[#202020] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search size={15} className="flex-none text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder="Search workspaces, templates and actions"
            aria-label="Search workspaces, templates and actions"
            spellCheck={false}
            className="h-12 w-full bg-transparent text-[14px] text-[#ececec] outline-none placeholder:text-zinc-500"
          />
          <kbd className="flex-none rounded border border-white/[0.12] px-1.5 py-px text-[10px] text-zinc-500">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1.5">
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-zinc-500">No results for “{query}”</p>
          ) : (
            shown.map((it, i) => {
              const head = it.group !== lastGroup
              lastGroup = it.group
              return (
                <div key={it.id}>
                  {head && <p className="px-2.5 pb-1 pt-2 text-[12px] text-zinc-500">{it.group}</p>}
                  <button
                    type="button"
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(it)}
                    className={`flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-[13px] text-[#e0e0e0] ${i === active ? 'bg-white/[0.07]' : ''}`}
                  >
                    <it.Icon size={15} strokeWidth={1.6} className="flex-none text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    <span className="flex-none text-[12px] text-zinc-500">{it.hint}</span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Page root ---------------- */
export function NotebookHome() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [stats, setStats] = useState<Record<number, Stat>>({})
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pendingPreset, setPendingPreset] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const mounted = useRef(true)
  const loadSeq = useRef(0)
  const canCreateRef = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Cmd/Ctrl+K toggles the palette; N opens "New workspace" when nothing else is focused
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'n' || !canCreateRef.current) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      setCreateOpen(true)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    const live = () => mounted.current && seq === loadSeq.current
    setLoading(true)
    setError('')
    try {
      const [items, me] = await Promise.all([workspaceApi.list(), authApi.me()])
      if (!live()) return
      setWorkspaces(Array.isArray(items) ? items : [])
      setUser(me)
      setLoaded(true)
    } catch (err) {
      if (!live()) return
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        authApi.clearTokens()
        router.replace('/login')
        return
      }
      setError(errorMessage(err))
    } finally {
      if (live()) setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  /* Doc + chat counts for each workspace */
  const idsKey = workspaces.slice(0, STATS_LIMIT).map((w) => w.id).join(',')
  const statsSeen = useRef(new Set<number>())

  useEffect(() => {
    if (!idsKey) return
    const ids = idsKey
      .split(',')
      .map(Number)
      .filter((id) => !statsSeen.current.has(id))
    if (!ids.length) return
    ids.forEach((id) => statsSeen.current.add(id))
    let buffer: Record<number, Stat> = {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      timer = undefined
      if (!mounted.current) return
      const batch = buffer
      buffer = {}
      if (Object.keys(batch).length) setStats((prev) => ({ ...prev, ...batch }))
    }
    void pool(
      ids,
      STATS_CONCURRENCY,
      async (id) => {
        const [docs, convs] = await Promise.allSettled([documentApi.list(id), chatApi.conversations(id)])
        const list = docs.status === 'fulfilled' && Array.isArray(docs.value) ? docs.value : null
        buffer[id] = {
          documents: list ? list.length : null,
          conversations: convs.status === 'fulfilled' && Array.isArray(convs.value) ? convs.value.length : null,
          indexing: list
            ? list.filter((d) => /pend|process|index|queue/i.test(String((d as { status?: string }).status ?? ''))).length
            : 0,
        }
        if (timer === undefined) timer = setTimeout(flush, STATS_FLUSH_MS)
      },
      () => !mounted.current
    ).then(() => {
      if (timer !== undefined) clearTimeout(timer)
      flush()
    })
  }, [idsKey])

  const recent = useMemo(() => [...workspaces].sort(byRecent), [workspaces])

  // Templates you already turned into a workspace are not offered again.
  const presets = useMemo(() => {
    const taken = new Set(workspaces.map((w) => w.title.trim().toLowerCase()))
    return PRESETS.filter((p) => !taken.has(p.name.toLowerCase()))
  }, [workspaces])

  const totals = useMemo(() => {
    let documents = 0
    let conversations = 0
    let indexing = 0
    for (const w of workspaces) {
      const s = stats[w.id]
      if (!s) continue
      documents += s.documents ?? 0
      conversations += s.conversations ?? 0
      indexing += s.indexing
    }
    return { documents, conversations, indexing }
  }, [workspaces, stats])

  const openWorkspace = useCallback(
    (w: Workspace) => {
      selectWorkspace(w.id)
      router.push(`/workspaces/${w.id}`)
    },
    [router]
  )

  // ?new=1 makes the workspace shell start the product tour
  const makeWorkspace = useCallback(
    async (name: string) => {
      const w = await workspaceApi.create(name.trim())
      selectWorkspace(w.id)
      router.push(`/workspaces/${w.id}?new=1`)
    },
    [router]
  )

  /* Throws on failure so the form can show the message inline. */
  const createWorkspace = async (name: string) => {
    setCreating(true)
    try {
      await makeWorkspace(name)
    } catch (err) {
      setCreating(false)
      throw err
    }
  }

  const startPreset = async (p: Preset) => {
    if (creating) return
    const existing = workspaces.find((w) => w.title.trim().toLowerCase() === p.name.toLowerCase())
    if (existing) return openWorkspace(existing)
    setCreating(true)
    setPendingPreset(p.name)
    setError('')
    try {
      await makeWorkspace(p.name)
    } catch (err) {
      setError(errorMessage(err))
      setCreating(false)
      setPendingPreset(null)
    }
  }

  const removeWorkspace = async (w: Workspace) => {
    await workspaceApi.remove(w.id)
    setWorkspaces((cur) => cur.filter((x) => x.id !== w.id))
    try {
      if (window.sessionStorage.getItem(ACTIVE_WORKSPACE_KEY) === String(w.id)) window.sessionStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    } catch {
      /* ignore */
    }
    setDeleteTarget(null)
  }

  const logout = useCallback(async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    } finally {
      router.replace('/login')
    }
  }, [loggingOut, router])

  const paletteItems: PaletteItem[] = paletteOpen
    ? [
        { id: 'new', group: 'Actions', label: 'New workspace', hint: 'Create', Icon: Plus, run: () => setCreateOpen(true) },
        { id: 'browse', group: 'Actions', label: 'Browse templates', hint: 'Open', Icon: LayoutTemplate, run: () => setGalleryOpen(true) },
        ...recent.map((w) => ({ id: `w${w.id}`, group: 'Workspaces', label: w.title, hint: 'Open', Icon: Folder, run: () => openWorkspace(w) })),
        ...presets.map((p) => ({ id: `t${p.name}`, group: 'Templates', label: p.name, hint: 'Template', Icon: p.Icon, run: () => void startPreset(p) })),
      ]
    : []

  // Settings from the account menu opens the active (or most recent) workspace's settings.
  const settingsTarget = (() => {
    let activeId: string | null = null
    try {
      activeId = window.sessionStorage.getItem(ACTIVE_WORKSPACE_KEY)
    } catch {
      /* ignore */
    }
    return recent.find((w) => String(w.id) === activeId) ?? recent[0] ?? null
  })()
  const settingsHref = settingsTarget ? `/workspaces/${settingsTarget.id}/settings` : null

  if (loggingOut) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#191919] text-sm text-[#8a8a8a]" style={{ fontFamily: FONT_SANS }}>
        Signing out…
      </div>
    )
  }

  const firstRun = loaded && workspaces.length === 0
  canCreateRef.current = loaded && workspaces.length > 0

  return (
    <StatsContext.Provider value={stats}>
      <main className="qp-zoom qp-h flex overflow-hidden bg-[var(--qp-background)] text-[var(--qp-text-primary)] antialiased" style={{ fontFamily: FONT_SANS }}>
        <QpGlobalStyles />

        <aside className="hidden w-[240px] flex-none flex-col border-r border-[var(--qp-border)] bg-[var(--qp-sidebar)] md:flex">
          <div className="flex h-12 items-center px-3.5">
            <Logo />
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
            <Link href="/workspaces" aria-current="page" className={`${NAV_ITEM} !bg-white/[0.06] !text-[#ececec] ${focusRing}`}>
              <LayoutGrid size={15} strokeWidth={1.6} className="flex-none" /> Overview
            </Link>
            {loaded && (
              <button type="button" onClick={() => setGalleryOpen(true)} className={`${NAV_ITEM} mt-0.5 ${focusRing}`}>
                <LayoutTemplate size={15} strokeWidth={1.6} className="flex-none" /> Templates
              </button>
            )}
            {loaded && workspaces.length > 0 && (
              <button type="button" onClick={() => setCreateOpen(true)} className={`${NAV_ITEM} mt-0.5 ${focusRing}`}>
                <Plus size={15} strokeWidth={1.6} className="flex-none" />
                <span className="flex-1">New workspace</span>
                <kbd className="rounded border border-white/[0.12] px-1.5 py-px text-[10px] text-[#8a8a8a]">N</kbd>
              </button>
            )}

            {loaded && presets.length > 0 && (
              <div className="mt-6">
                <p className="px-2.5 pb-1 text-[12px] text-[#8c8c8c]">Quick start</p>
                {presets.slice(0, 4).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    disabled={creating}
                    onClick={() => void startPreset(p)}
                    className={`${NAV_ITEM} !gap-2 !pl-1.5 !pr-1.5 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                  >
                    <TemplateIcon p={p} />
                    <span className="min-w-0 flex-1 truncate">{pendingPreset === p.name ? 'Creating…' : p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {loaded && workspaces.length > 0 && (
              <div className="mt-6">
                <p className="px-2.5 pb-1 text-[12px] text-[#8c8c8c]">Library</p>
                <SidebarStat label="Workspaces" value={workspaces.length} />
                <SidebarStat label="Documents" value={totals.documents} />
                <SidebarStat label="Chats" value={totals.conversations} />
                {totals.indexing > 0 && <SidebarStat label="Indexing" value={totals.indexing} dot="bg-zinc-500" />}
              </div>
            )}
          </nav>
          <div className="border-t border-white/[0.06] p-2">
            {loaded &&
              (settingsHref && settingsTarget ? (
                <Link
                  href={settingsHref}
                  onClick={() => selectWorkspace(settingsTarget.id)}
                  className={`${NAV_ITEM} mb-1 ${focusRing}`}
                >
                  <Settings size={15} strokeWidth={1.6} className="flex-none" /> Workspace settings
                </Link>
              ) : (
                // The settings route needs a workspace id, so with no workspace yet this stays visible but inactive.
                <span
                  aria-disabled="true"
                  title="Create a workspace to open its settings"
                  className={`${NAV_ITEM} mb-1 cursor-not-allowed opacity-50 hover:!bg-transparent hover:!text-[#a8a8a8]`}
                >
                  <Settings size={15} strokeWidth={1.6} className="flex-none" /> Workspace settings
                </span>
              ))}
            <AccountMenu user={user} onLogout={() => void logout()} variant="sidebar" settingsHref={settingsHref} />
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="h-12 flex-none"><div className="mx-auto flex h-full w-full max-w-[1000px] items-center gap-3 px-4 sm:px-8">
            <div className="md:hidden">
              <Logo />
            </div>
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-[13px] text-[#8c8c8c] md:flex">
              <Link href="/workspaces" className={`rounded hover:text-[#e6e6e6] ${focusRing}`}>
                Workspaces
              </Link>
              <ChevronRight size={13} />
              <span className="text-[#cfcfcf]">{firstRun ? 'Get started' : 'Overview'}</span>
            </nav>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className={`ml-auto hidden h-8 w-full max-w-[260px] items-center gap-2 rounded-md border border-white/[0.1] px-3 text-left text-[13px] text-zinc-500 transition-colors hover:border-white/[0.16] md:flex ${focusRing}`}
            >
              <Search size={14} />
              <span className="flex-1">Search…</span>
              <kbd className="rounded border border-white/[0.12] px-1.5 py-px text-[10px] text-[#8a8a8a]">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1 md:hidden">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search"
                className={`grid size-9 place-items-center rounded-md text-[#b8b8b8] hover:bg-white/[0.06] ${focusRing}`}
              >
                <Search size={16} />
              </button>
              <AccountMenu user={user} onLogout={() => void logout()} variant="avatar" settingsHref={settingsHref} />
            </div>
          </div></header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1000px] px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className={COL_W}>
                  <h1 className="text-[20px] font-semibold leading-8 tracking-tight text-white">
                    {firstRun ? 'Create your first workspace' : 'Overview'}
                  </h1>
                  <p className="mt-1 text-[13px] leading-5 text-[#a8a8a8] [text-wrap:pretty]">
                    A workspace holds the documents for one topic. Ask questions across all of them and get answers with sources.
                  </p>
                </div>
                {!firstRun && loaded && (
                  <PixelDissolveButton
                    type="button"
                    label="New workspace"
                    onClick={() => setCreateOpen(true)}
                    color={AUTH_BLUE}
                    dissolveColor={AUTH_DISSOLVE_BLUE}
                    cellSize={4}
                    className={`${PRIMARY_BUTTON_CLASSES} shrink-0`}
                  />
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#5a2f2f] bg-[#2d2020] px-3.5 py-2.5 text-[13px] text-[#f0a09b]"
                >
                  <span>{error}</span>
                  <Pill onClick={() => void load()}>Retry</Pill>
                </div>
              )}

              {loading ? (
                <div className="mt-6 overflow-hidden rounded-lg border border-white/[0.1]">
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="h-11 animate-pulse border-b border-white/[0.06] bg-white/[0.02] last:border-b-0 motion-reduce:animate-none" />
                  ))}
                </div>
              ) : !loaded ? (
                <p className="py-16 text-center text-[13px] text-[#8a8a8a]">Your workspaces couldn’t be loaded.</p>
              ) : (
                <>
                  {firstRun && (
                    <div className={`mt-5 ${COL_W}`}>
                      <CreateForm creating={creating && !pendingPreset} autoFocus onCreate={createWorkspace} />
                    </div>
                  )}

                  {recent.length > 0 && (
                    <section className="mt-6">
                      <div className="rounded-lg border border-white/[0.1]">
                        <ListHead />
                        <ul>
                          {recent.map((w) => (
                            <WorkspaceRow key={w.id} w={w} onOpen={openWorkspace} onDelete={setDeleteTarget} />
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}

                  {presets.length > 0 && (
                    <section id="templates" className="mt-10 scroll-mt-6">
                      <SectionHead
                        hint="Starts an empty workspace with this name. Add your own documents, then ask questions like these."
                        action={
                          <PixelDissolveButton
                            type="button"
                            label="Browse all"
                            onClick={() => setGalleryOpen(true)}
                            color="transparent"
                            textColor="#a8a8a8"
                            dissolveColor="rgba(255,255,255,0.28)"
                            cellSize={4}
                            className={`${PILL_BASE} !h-7 !px-3 border !border-white/10`}
                          />
                        }
                      >
                        Start from a template
                      </SectionHead>
                      <div className={GRID}>
                        {presets.slice(0, 6).map((p) => (
                          <TemplateCard key={p.name} p={p} busy={pendingPreset === p.name} disabled={creating} onPick={startPreset} />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />

        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} locked={creating} labelledBy="create-title">
          <h2 id="create-title" className="text-[15px] font-semibold tracking-tight text-white">
            New workspace
          </h2>
          <p className="mb-4 mt-1.5 text-[13px] leading-5 text-[#a5a5a5]">
            Name it after what it holds. A short tour will help you add documents next.
          </p>
          <CreateForm creating={creating} autoFocus onCreate={createWorkspace} onCancel={() => setCreateOpen(false)} />
        </Dialog>

        <TemplateGallery
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          presets={PRESETS}
          existing={new Set(workspaces.map((w) => w.title.trim().toLowerCase()))}
          pending={pendingPreset}
          creating={creating}
          onPick={(p) => {
            setGalleryOpen(false)
            void startPreset(p)
          }}
        />

        <DeleteDialog workspace={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={removeWorkspace} />
      </main>
    </StatsContext.Provider>
  )
}

export default NotebookHome