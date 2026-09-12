'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  ChevronDown,
  FolderOpen,
  HelpCircle,
  Database,
  MessageSquare,
  Clock3,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { PixelDissolveButton } from '@/components/pixel-dissolve-button'
import { authApi, workspaceApi, type User, type Workspace } from '@/lib/django-api'

const ACTIVE_WORKSPACE_KEY = 'querypilot_active_workspace_id'
const WORKSPACE_NAME_MAX_LENGTH = 120

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

function selectWorkspace(id: number) {
  sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, String(id))
}

// Small initials helper so the page never needs hardcoded account data.
function initialsForUser(user: User | null) {
  if (!user) return '—'

  const source = user.username?.trim() || user.email?.trim() || ''
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase() || '—'
}

function displayNameForUser(user: User | null) {
  return user?.username?.trim() || 'Account'
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function validateWorkspaceName(raw: string): string | null {
  const trimmed = raw.trim()

  if (!trimmed) {
    return 'Give your workspace a name.'
  }

  if (trimmed.length > WORKSPACE_NAME_MAX_LENGTH) {
    return `Keep it under ${WORKSPACE_NAME_MAX_LENGTH} characters.`
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    return "That name contains characters that aren't allowed."
  }

  return null
}

function AnimatedReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <span
      className={`qp-reveal ${className}`}
      style={{ '--qp-delay': `${delay}ms` } as Record<string, string>}
    >
      {children}
    </span>
  )
}

function EmptyStateVisual() {
  return (
    <div className="relative flex h-full min-h-[500px] w-full items-center justify-center overflow-visible lg:min-h-[650px] lg:justify-end xl:min-h-[680px]">
      {/* Soft ambient light behind the illustration so it feels embedded in the page. */}
      <div className="pointer-events-none absolute inset-[-14%]">
        <div className="absolute right-[4%] top-[10%] h-[70%] w-[78%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(215,235,225,0.52),transparent_68%)] blur-[10px]" />
        <div className="absolute bottom-[4%] left-[5%] h-[42%] w-[82%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(225,236,231,0.36),transparent_74%)] blur-[12px]" />
      </div>

      {/* The source image is masked at its edges so there is no visible rectangular
          canvas. Multiply blending lets the page / mountain texture remain visible
          through the pale parts of the illustration. */}
      <div
        className="relative z-10 w-[122%] lg:w-[134%] xl:w-[138%]"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, rgba(0,0,0,.98) 58%, rgba(0,0,0,.65) 76%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, rgba(0,0,0,.98) 58%, rgba(0,0,0,.65) 76%, transparent 100%)",
        }}
      >
        <img
          src="/workspace.png"
          alt=""
          aria-hidden="true"
          className="block h-auto w-full object-contain"
          style={{
            mixBlendMode: "darken",
            opacity: 0.96,
            filter: "contrast(1.04) saturate(0.98)",
          }}
        />
      </div>

      {/* Feather the remaining edge so the source canvas never reads as a white card. */}
      <div
        className="pointer-events-none absolute inset-[1%] z-20"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 78% 74% at 50% 50%, transparent 48%, #000 79%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 78% 74% at 50% 50%, transparent 48%, #000 79%, transparent 100%)",
          background: "rgba(251,252,251,0.12)",
        }}
      />
    </div>
  )
}

function FeaturePill({
  icon,
  title,
  description,
  className,
}: {
  icon: React.ReactNode
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-white/70 text-[#0c6b43] shadow-[0_10px_26px_rgba(15,23,42,0.03)] backdrop-blur">
        {icon}
      </div>
      <div className="pt-0.5">
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
          {title}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['01', 'Create a workspace', 'Set up your workspace in seconds'],
    ['02', 'Add your data', 'Upload documents or connect data sources'],
    ['03', 'Ask questions', 'Get accurate, source-grounded answers'],
  ]

  return (
    <section className="mt-4 border-t border-slate-300/70 pt-8 sm:mt-6 sm:pt-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 sm:text-[11px]">
            A simple workflow
          </p>
          <h2 className="mt-2 text-[24px] font-medium tracking-[-0.035em] text-slate-950 sm:text-[29px]">
            How it works
          </h2>
        </div>

        <p className="hidden max-w-[250px] text-right text-[11px] leading-5 text-slate-500 md:block">
          Bring your knowledge together, then ask QueryPilot to find the signal.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0">
        {steps.map(([number, title, description], index) => (
          <div
            key={number}
            className={`group relative min-h-[150px] rounded-2xl border border-slate-200/70 bg-white/38 p-5 backdrop-blur-[2px] transition duration-300 hover:-translate-y-0.5 hover:bg-white/55 ${
              index > 0 ? 'sm:rounded-l-none sm:border-l-0' : ''
            } ${index < 2 ? 'sm:border-r-0' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white/70 text-[11px] font-semibold tracking-[0.08em] text-slate-500">
                {number}
              </span>
              <span className="h-px flex-1 bg-slate-200/70 mx-4 transition group-hover:bg-emerald-200" />
              <span className="size-2 rounded-full bg-emerald-400/70 opacity-50 transition group-hover:scale-125 group-hover:opacity-100" />
            </div>

            <p className="mt-6 text-[15px] font-semibold tracking-[-0.02em] text-slate-950 sm:text-[16px]">
              <AnimatedReveal delay={index * 90}>{title}</AnimatedReveal>
            </p>
            <p className="mt-2 max-w-[250px] text-[12px] leading-5 text-slate-500 sm:text-[12.5px]">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}


function WorkspaceCard({
  workspace,
  onOpen,
  onDelete,
}: {
  workspace: Workspace
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <article className="group relative flex min-h-[192px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/78 p-4 text-left shadow-[0_12px_35px_rgba(15,23,42,0.035)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white/92 hover:shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent opacity-0 transition group-hover:opacity-100" />

      <button
        type="button"
        onClick={onDelete}
        aria-label={`More options for ${workspace.title}`}
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-800 group-hover:opacity-100 focus:opacity-100"
      >
        <MoreHorizontal size={17} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start text-left focus:outline-none"
      >
        <div className="flex w-full items-start justify-between pr-8">
          <span className="grid size-10 place-items-center rounded-xl border border-emerald-100 bg-emerald-50/80 text-[#0c6b43]">
            <FolderOpen size={18} strokeWidth={1.8} />
          </span>
          <span className="mt-1 size-1.5 rounded-full bg-emerald-500/70 opacity-0 transition group-hover:opacity-100" />
        </div>

        <h2 className="mt-5 max-w-full truncate text-[14px] font-semibold tracking-[-0.025em] text-slate-950">
          {workspace.title}
        </h2>

        <p className="mt-1.5 max-w-[245px] text-[10.5px] leading-5 text-slate-500">
          Workspace for documents, conversations, and structured knowledge.
        </p>

        <div className="mt-auto flex w-full items-end justify-between gap-3 pt-6">
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Updated</p>
            <p className="mt-1 text-[10px] font-medium text-slate-600">
              {new Date(workspace.updated_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>

          <span className="text-[10px] font-semibold text-[#0c6b43] opacity-0 transition group-hover:opacity-100">
            Open →
          </span>
        </div>
      </button>
    </article>
  )
}

function CreateWorkspaceCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[192px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/35 px-6 text-center transition hover:border-emerald-200 hover:bg-emerald-50/25"
    >
      <span className="grid size-11 place-items-center rounded-full border border-emerald-100 bg-emerald-50 text-[#0c6b43] transition group-hover:scale-105">
        <Plus size={20} strokeWidth={1.8} />
      </span>
      <span className="mt-4 text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
        Create new workspace
      </span>
      <span className="mt-1 max-w-[190px] text-[10px] leading-5 text-slate-500">
        Set up a new workspace to organize your documents and conversations.
      </span>
    </button>
  )
}

export function NotebookHome() {
  const router = useRouter()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortNewest, setSortNewest] = useState(true)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [items, me] = await Promise.all([
        workspaceApi.list(),
        authApi.me(),
      ])

      setWorkspaces(items)
      setUser(me)
    } catch (err) {
      const apiError = err as { status?: number }

      if (apiError.status === 401 || apiError.status === 403) {
        authApi.clearTokens()
        router.replace('/login')
        return
      }

      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const sortedWorkspaces = useMemo(
    () =>
      [...workspaces].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime(),
      ),
    [workspaces],
  )

  const visibleWorkspaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    const filtered = [...sortedWorkspaces].filter((workspace) =>
      !query ? true : workspace.title.toLowerCase().includes(query),
    )

    if (!sortNewest) {
      filtered.reverse()
    }

    return filtered
  }, [searchQuery, sortNewest, sortedWorkspaces])

  const openCreateModal = () => {
    setTitle('')
    setTitleError('')
    setModalOpen(true)
  }

  const closeCreateModal = () => {
    if (creating) return
    setModalOpen(false)
    setTitleError('')
  }

  const createWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validateWorkspaceName(title)

    if (validationError) {
      setTitleError(validationError)
      return
    }

    setCreating(true)
    setError('')
    setTitleError('')

    try {
      const workspace = await workspaceApi.create(title.trim())
      selectWorkspace(workspace.id)
      setTitle('')
      setModalOpen(false)
      router.push(`/workspaces/${workspace.id}?new=1`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const openWorkspace = (workspace: Workspace) => {
    selectWorkspace(workspace.id)
    router.push(`/workspaces/${workspace.id}`)
  }

  const removeWorkspace = async (workspace: Workspace) => {
    const confirmed = window.confirm(
      `Delete “${workspace.title}”? This removes the workspace, its documents, and its conversations.`,
    )

    if (!confirmed) return

    try {
      await workspaceApi.remove(workspace.id)

      setWorkspaces((current) =>
        current.filter((item) => item.id !== workspace.id),
      )

      if (
        sessionStorage.getItem(ACTIVE_WORKSPACE_KEY) ===
        String(workspace.id)
      ) {
        sessionStorage.removeItem(ACTIVE_WORKSPACE_KEY)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const logout = async () => {
    if (loggingOut) return

    setLoggingOut(true)
    setProfileOpen(false)

    try {
      await authApi.logout()
    } catch {
      // authApi.logout() clears local auth state in its finally block.
    } finally {
      router.replace('/login')
    }
  }

  if (loggingOut) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fbfcfb] text-sm text-slate-500">
        Signing out…
      </div>
    )
  }

  const initials = initialsForUser(user)
  const displayName = displayNameForUser(user)
  const greeting = greetingForHour(new Date().getHours())

  return (
    <main className="min-h-screen bg-[#fbfcfb] text-slate-900">
<style jsx global>{`
  @keyframes qpReveal {
    0% {
      opacity: 0;
      transform: translateY(8px);
      clip-path: inset(0 100% 0 0);
      filter: blur(4px);
    }
    55% {
      opacity: 1;
      clip-path: inset(0 16% 0 0);
      filter: blur(0);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
      clip-path: inset(0 0 0 0);
      filter: blur(0);
    }
  }

  @keyframes qpCardIn {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .qp-card-in {
    animation: qpCardIn 650ms cubic-bezier(.22,.8,.28,1) both;
    animation-delay: var(--qp-card-delay, 0ms);
  }

  @keyframes qpCaret {
    0%, 48% { opacity: 0.25; }
    49%, 100% { opacity: 1; }
  }

  .qp-reveal {
    display: inline-block;
    animation: qpReveal 850ms cubic-bezier(.22,.8,.28,1) both;
    animation-delay: var(--qp-delay, 0ms);
    will-change: transform, opacity, clip-path, filter;
  }

  .qp-caret {
    display: inline-block;
    animation: qpCaret 900ms steps(1, end) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .qp-reveal,
    .qp-caret,
    .qp-card-in {
      animation: none !important;
    }
  }
`}</style>
      <div className="relative flex min-h-screen">
        {/* Full-height primary navigation */}
        <aside className="relative z-20 hidden w-[260px] shrink-0 border-r border-slate-200/80 bg-white/88 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="px-7 pt-7">
            <Link href="/workspaces" className="flex items-center gap-2.5">
              <img
                src="/querypilot-logo.svg"
                alt="QueryPilot"
                className="size-6 object-contain"
              />
              <span className="text-[17px] font-semibold tracking-[-0.035em] text-slate-950">
                QueryPilot
              </span>
            </Link>
          </div>

          <nav className="mt-10 px-4" aria-label="Primary navigation">
            <Link
              href="/workspaces"
              className="flex w-full items-center gap-3 rounded-xl bg-emerald-50/80 px-4 py-3.5 text-left text-[14px] font-semibold text-slate-950"
            >
              <FolderOpen size={16} strokeWidth={1.8} />
              Workspaces
            </Link>

            <Link
              href="/settings"
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[14px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <Settings size={16} strokeWidth={1.8} />
              Settings
            </Link>
          </nav>

          <div className="mt-auto">
            <div className="border-t border-slate-200/70 px-5 py-5">
              <button
                type="button"
                onClick={() => setProfileOpen((current) => !current)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-900">
                    {displayName}
                  </p>
                  <p className="truncate text-[9px] text-slate-500">
                    {user?.email ?? ''}
                  </p>
                </div>

                <ChevronDown
                  size={13}
                  className={`shrink-0 text-slate-400 transition ${
                    profileOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {profileOpen && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
                  <div className="px-3 py-2">
                    <p className="truncate text-[11px] font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">
                      {user?.email ?? ''}
                    </p>
                  </div>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <LogOut size={14} strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="flex w-full items-center gap-3 border-t border-slate-200/70 px-7 py-4.5 text-[13px] font-medium text-slate-600 transition hover:text-slate-950"
            >
              <HelpCircle size={15} strokeWidth={1.8} />
              Help &amp; Support
            </button>
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 overflow-hidden bg-[#fbfcfb]">
          <div className="pointer-events-none absolute inset-0 z-0">
            <img
              src="/hh.avif"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.24] mix-blend-multiply"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(251,252,251,0.9)_0%,rgba(251,252,251,0.68)_28%,rgba(251,252,251,0.44)_56%,rgba(251,252,251,0.14)_82%,rgba(251,252,251,0.18)_100%)]" />
            <div className="absolute -right-36 top-16 h-[520px] w-[820px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(225,237,231,0.46),transparent_70%)] blur-[3px]" />
            <div className="absolute -left-44 bottom-[-90px] h-[460px] w-[720px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(225,236,231,0.34),transparent_72%)] blur-[4px]" />
          </div>

          <header className="relative flex min-h-[58px] items-center gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-7 lg:px-10">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
            >
              <Menu size={18} strokeWidth={1.8} />
            </button>

            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <img
                src="/querypilot-logo.svg"
                alt="QueryPilot"
                className="size-6 object-contain"
              />
              <span className="text-[14px] font-medium tracking-[-0.03em] text-slate-900">QueryPilot</span>
            </div>

            <div className="relative hidden min-w-0 flex-1 md:block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
              <input
                aria-label="Search workspaces"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search workspaces, documents, or anything..."
                className="h-11 w-full max-w-[560px] rounded-xl border border-slate-200/90 bg-white/88 pl-10 pr-16 text-[12px] font-medium text-slate-800 shadow-[0_6px_24px_rgba(15,23,42,0.035)] outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100/80"
              />
              <div className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:flex">
                <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">⌘</kbd>
                <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">K</kbd>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Notifications"
                className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <Bell size={15} strokeWidth={1.8} />
              </button>

              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((current) => !current)}
                  className="flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-slate-100"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
                    {initials}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-slate-400 transition ${
                      profileOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                    <div className="px-3 py-2">
                      <p className="truncate text-[11px] font-semibold text-slate-900">{displayName}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{user?.email ?? ''}</p>
                    </div>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <LogOut size={14} strokeWidth={1.8} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 pb-8 pt-4 sm:px-7 sm:pt-5 lg:px-12 lg:pt-6 xl:px-16">
            <div className="mb-4 md:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                <input
                  aria-label="Search workspaces"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search workspaces..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-3 text-[11px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>
            {error && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="font-medium underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid min-h-[74vh] place-items-center text-sm text-slate-400">
                Loading your workspaces…
              </div>
            ) : sortedWorkspaces.length === 0 ? (
              <div className="relative">
                <div className="grid min-h-[610px] items-center gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10 xl:grid-cols-[0.70fr_1.30fr] xl:gap-12">
                  <div className="relative z-10 max-w-[620px] pt-0 sm:pt-2 lg:pt-0">
                    <AnimatedReveal
                      className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-[11px]"
                    >
                      Welcome to QueryPilot
                    </AnimatedReveal>

                    <h1 className="mt-3 max-w-[660px] text-[43px] font-medium leading-[0.96] tracking-[-0.058em] text-slate-950 sm:text-[53px] lg:text-[60px] xl:text-[66px]">
                      <AnimatedReveal delay={80}>
                        Your knowledge
                      </AnimatedReveal>
                      <br />
                      <AnimatedReveal delay={150}>
                        starts with a workspace.
                      </AnimatedReveal>
                    </h1>

                    <p className="mt-5 max-w-[560px] text-[14px] leading-6 text-slate-500 sm:text-[15px] lg:text-[16px]">
                      <AnimatedReveal delay={240}>
                        Create a workspace to keep your documents, conversations,
                        tables, and data sources organized.
                      </AnimatedReveal>
                    </p>

                    <PixelDissolveButton
                      label="Create your first workspace"
                      onClick={openCreateModal}
                      className="mt-6"
                      color="#0c6b43"
                      dissolveColor="#005026"
                    />
                  </div>

                  <EmptyStateVisual />
                </div>

                <HowItWorks />
              </div>
            ) : (
              <div>
                {(() => {
                  const featuredWorkspace = sortedWorkspaces[0]
                  const latestDate = featuredWorkspace
                    ? new Date(featuredWorkspace.updated_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'

                  return (
                    <>
                      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/75 bg-white/46 px-5 py-6 shadow-[0_20px_70px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-7 sm:py-8 lg:px-9 lg:py-9">
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute right-[-7%] top-[-24%] h-[430px] w-[58%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(215,234,224,0.62),transparent_68%)] blur-[4px]" />
                          <div className="absolute bottom-[-40%] left-[-8%] h-[320px] w-[60%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(226,237,232,0.55),transparent_72%)]" />
                          <div className="absolute right-0 top-0 h-full w-[46%] overflow-hidden opacity-65">
                            <img
                              src="/hh.avif"
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-cover object-[62%_34%] opacity-[0.16] mix-blend-multiply"
                            />
                          </div>
                          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.58)_52%,rgba(255,255,255,0.22)_100%)]" />
                        </div>

                        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                          <div className="max-w-[720px]">
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 sm:text-[11px]">
                              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                              <AnimatedReveal>QueryPilot workspace</AnimatedReveal>
                            </div>

                            <h1 className="mt-3 text-[40px] font-medium leading-[0.96] tracking-[-0.06em] text-slate-950 sm:text-[50px] lg:text-[58px]">
                              <AnimatedReveal delay={70}>
                                {greeting},
                              </AnimatedReveal>{' '}
                              <AnimatedReveal delay={140}>
                                {displayName}.
                              </AnimatedReveal>
                            </h1>

                            <p className="mt-4 max-w-[650px] text-[14px] leading-6 text-slate-600 sm:text-[15px]">
                              <AnimatedReveal delay={220}>
                                Your knowledge is already taking shape. Open a workspace, add context,
                                and turn scattered information into answers you can trust.
                              </AnimatedReveal>
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-2.5">
                              <PixelDissolveButton
                                label="New workspace"
                                onClick={openCreateModal}
                                className="w-fit"
                                color="#0c6b43"
                                dissolveColor="#d1fae5"
                              />
                              <div className="rounded-xl border border-slate-200/80 bg-white/58 px-3.5 py-2.5 text-[10px] font-medium text-slate-500 backdrop-blur-sm sm:text-[11px]">
                                <span className="text-slate-900">{workspaces.length}</span>{' '}
                                {workspaces.length === 1 ? 'workspace' : 'workspaces'} connected
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:w-[430px]">
                            <div className="rounded-2xl border border-white/80 bg-white/62 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.035)] backdrop-blur">
                              <Database size={16} className="text-[#0c6b43]" strokeWidth={1.7} />
                              <p className="mt-5 text-[22px] font-medium tracking-[-0.04em] text-slate-950">{workspaces.length}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Workspaces</p>
                            </div>

                            <div className="rounded-2xl border border-white/80 bg-white/62 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.035)] backdrop-blur">
                              <MessageSquare size={16} className="text-[#0c6b43]" strokeWidth={1.7} />
                              <p className="mt-5 text-[22px] font-medium tracking-[-0.04em] text-slate-950">Ready</p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Conversations</p>
                            </div>

                            <div className="col-span-2 rounded-2xl border border-white/80 bg-white/62 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.035)] backdrop-blur sm:col-span-1">
                              <Clock3 size={16} className="text-[#0c6b43]" strokeWidth={1.7} />
                              <p className="mt-5 truncate text-[15px] font-medium tracking-[-0.02em] text-slate-950">{latestDate}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Latest update</p>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="mt-7">
                        <div className="flex flex-col gap-3 border-b border-slate-300/65 pb-4 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                              Your knowledge base
                            </p>
                            <h2 className="mt-2 text-[24px] font-medium tracking-[-0.04em] text-slate-950 sm:text-[28px]">
                              Workspaces
                            </h2>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSortNewest((current) => !current)}
                              className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white/72 px-3.5 text-[10px] font-medium text-slate-600 shadow-[0_6px_20px_rgba(15,23,42,0.025)] transition hover:bg-white hover:text-slate-900 sm:text-[11px]"
                            >
                              {sortNewest ? 'Last updated' : 'Oldest updated'}
                              <ChevronDown size={12} className={`text-slate-400 transition ${sortNewest ? '' : 'rotate-180'}`} />
                            </button>
                            <button
                              type="button"
                              className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white/72 text-slate-500 shadow-[0_6px_20px_rgba(15,23,42,0.025)] transition hover:bg-white hover:text-slate-900"
                              aria-label="Workspace filters"
                            >
                              <SlidersHorizontal size={13} strokeWidth={1.8} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-1 overflow-x-auto">
                          <button
                            type="button"
                            className="relative shrink-0 rounded-lg bg-white/52 px-3 py-2 text-[10px] font-semibold text-slate-950"
                          >
                            All
                            <span className="absolute inset-x-3 -bottom-[5px] h-px rounded-full bg-[#0c6b43]" />
                          </button>
                          <button
                            type="button"
                            disabled
                            className="shrink-0 rounded-lg px-3 py-2 text-[10px] font-medium text-slate-400"
                          >
                            Owned by me
                          </button>
                          <button
                            type="button"
                            disabled
                            className="shrink-0 rounded-lg px-3 py-2 text-[10px] font-medium text-slate-400"
                          >
                            Shared with me
                          </button>
                        </div>

                        {visibleWorkspaces.length === 0 ? (
                          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/38 px-6 py-14 text-center">
                            <div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400">
                              <Search size={18} strokeWidth={1.8} />
                            </div>
                            <p className="mt-4 text-[13px] font-semibold text-slate-900">No workspaces found</p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              Try a different search term or create a new workspace.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {visibleWorkspaces.map((workspace, index) => (
                              <div
                                key={workspace.id}
                                className="qp-card-in"
                                style={{ '--qp-card-delay': `${index * 70}ms` } as Record<string, string>}
                              >
                                <WorkspaceCard
                                  workspace={workspace}
                                  onOpen={() => openWorkspace(workspace)}
                                  onDelete={() => void removeWorkspace(workspace)}
                                />
                              </div>
                            ))}

                            <div
                              className="qp-card-in"
                              style={{ '--qp-card-delay': `${visibleWorkspaces.length * 70}ms` } as Record<string, string>}
                            >
                              <CreateWorkspaceCard onClick={openCreateModal} />
                            </div>
                          </div>
                        )}
                      </section>

                      <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="relative overflow-hidden rounded-[22px] border border-slate-200/75 bg-white/38 p-6 backdrop-blur-sm">
                          <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-emerald-100/40 blur-3xl" />
                          <div className="relative">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Next move
                            </p>
                            <h3 className="mt-2 text-[19px] font-medium tracking-[-0.03em] text-slate-950">
                              Build context before you ask.
                            </h3>
                            <p className="mt-2 max-w-[610px] text-[12px] leading-5 text-slate-500">
                              Add the documents, structured data, and sources that make your answers useful.
                              QueryPilot keeps the pieces together inside each workspace.
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[10px] text-slate-600">Documents</span>
                              <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[10px] text-slate-600">Conversations</span>
                              <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[10px] text-slate-600">Tables</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-slate-200/75 bg-white/42 p-6 backdrop-blur-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Latest workspace
                          </p>
                          <p className="mt-3 text-[17px] font-semibold tracking-[-0.025em] text-slate-950">
                            {featuredWorkspace?.title ?? 'No workspace'}
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-slate-500">
                            Updated {latestDate}. Open it to continue where you left off.
                          </p>
                          {featuredWorkspace && (
                            <button
                              type="button"
                              onClick={() => openWorkspace(featuredWorkspace)}
                              className="mt-5 inline-flex items-center rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 text-[11px] font-semibold text-[#0c6b43] transition hover:bg-emerald-100/70"
                            >
                              Continue →
                            </button>
                          )}
                        </div>
                      </section>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </section>
      </div>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/15 lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileNavOpen(false)
          }}
        >
          <aside className="flex h-full w-[min(86vw,300px)] flex-col border-r border-slate-200 bg-white/95 shadow-[20px_0_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Link
                href="/workspaces"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img src="/querypilot-logo.svg" alt="QueryPilot" className="size-6 object-contain" />
                <span className="text-[17px] font-semibold tracking-[-0.035em] text-slate-950">QueryPilot</span>
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>

            <nav className="px-3 pt-2" aria-label="Mobile navigation">
              <Link
                href="/workspaces"
                onClick={() => setMobileNavOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl bg-emerald-50/80 px-4 py-3.5 text-[14px] font-semibold text-slate-950"
              >
                <FolderOpen size={17} strokeWidth={1.8} />
                Workspaces
              </Link>
              <Link
                href="/settings"
                onClick={() => setMobileNavOpen(false)}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[14px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              >
                <Settings size={17} strokeWidth={1.8} />
                Settings
              </Link>
            </nav>

            <div className="mt-auto border-t border-slate-200/70 px-5 py-5">
              <button
                type="button"
                onClick={() => setProfileOpen((current) => !current)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-[9px] text-slate-500">{user?.email ?? ''}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-4 flex w-full items-center gap-2 rounded-lg px-1 py-2 text-[11px] font-medium text-slate-600 hover:text-slate-900"
              >
                <LogOut size={14} strokeWidth={1.8} />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/20 p-3 backdrop-blur-[7px] sm:p-6" 
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-workspace-title"
            className="relative w-full max-w-[860px] overflow-hidden rounded-[24px] border border-slate-200/90 bg-[#fbfcfb] shadow-[0_32px_90px_rgba(15,23,42,0.18)]"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-24 top-12 h-[310px] w-[520px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(226,236,232,0.6),transparent_72%)]" />
              <div className="absolute -left-24 bottom-[-30px] h-[220px] w-[390px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(231,239,236,0.5),transparent_72%)]" />
              <img
                src="/hh.avif"
                alt=""
                aria-hidden="true"
                className="absolute inset-y-0 right-0 hidden h-full w-[58%] object-cover object-center opacity-[0.1] sm:block"
              />
            </div>

            <div className="relative p-6 sm:p-9 lg:p-11">
              <button
                type="button"
                onClick={closeCreateModal}
                aria-label="Close create workspace dialog"
                disabled={creating}
                className="absolute right-5 top-5 grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={19} strokeWidth={1.7} />
              </button>

              <div className="grid size-[72px] place-items-center rounded-[18px] border border-emerald-100 bg-emerald-50/65 shadow-[0_10px_30px_rgba(12,107,67,0.06)]">
                <img
                  src="/querypilot-logo.svg"
                  alt="QueryPilot"
                  className="h-12 w-12 object-contain"
                />
              </div>

              <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.23em] text-slate-500">
                New workspace
              </p>

              <h2
                id="create-workspace-title"
                className="mt-2 text-[32px] font-medium tracking-[-0.045em] text-slate-950 sm:text-[38px]"
              >
                Create a workspace
              </h2>

              <p className="mt-2 max-w-[520px] text-[14px] leading-6 text-slate-500">
                Your sources and conversations will live inside this
                workspace.
              </p>

              <form onSubmit={createWorkspace} className="mt-8">
                <label
                  htmlFor="workspace-name"
                  className="block text-[12px] font-semibold text-slate-700"
                >
                  Workspace name
                </label>

                <input
                  id="workspace-name"
                  autoFocus
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    if (titleError) setTitleError('')
                  }}
                  placeholder="e.g. HR Policies"
                  maxLength={WORKSPACE_NAME_MAX_LENGTH}
                  aria-invalid={Boolean(titleError)}
                  disabled={creating}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0c6b43] focus:ring-4 focus:ring-emerald-100/60 disabled:cursor-not-allowed disabled:opacity-60"
                />

                {titleError && (
                  <p className="mt-2 text-xs text-red-600">{titleError}</p>
                )}

                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    disabled={creating}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!title.trim() || creating}
                    className="rounded-xl bg-[#0c6b43] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(12,107,67,0.15)] transition hover:bg-[#095d3a] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {creating ? 'Creating…' : 'Create workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}





export default NotebookHome
