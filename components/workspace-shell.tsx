'use client'

import Link from 'next/link'
import {
  BookOpen,
  FileText,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  X,
  Upload,
} from 'lucide-react'
import { PixelDissolveButton } from '@/components/pixel-dissolve-button'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  authApi,
  chatApi,
  documentApi,
  workspaceApi,
  type Conversation,
  type Document,
  type User,
  type Workspace,
} from '@/lib/django-api'

const ACTIVE_WORKSPACE_KEY = 'querypilot_active_workspace_id'
const ONBOARDING_PREFIX = 'querypilot_source_onboarding_seen_'

// Polling backoff for in-progress document processing: starts fast so the
// UI feels responsive right after upload, then backs off so a
// long-running ingestion job doesn't hammer the API forever. Capped both
// in interval length and in total wall-clock time.
const POLL_INTERVALS_MS = [1500, 1500, 3000, 3000, 6000, 10000, 15000]
const POLL_MAX_DURATION_MS = 10 * 60 * 1000 // give up auto-refreshing after 10 minutes

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function groupConversations(items: Conversation[]) {
  const now = Date.now()
  const day = 86_400_000
  const groups = [
    { label: 'Today', items: [] as Conversation[] },
    { label: 'Yesterday', items: [] as Conversation[] },
    { label: 'Previous 7 Days', items: [] as Conversation[] },
    { label: 'Older', items: [] as Conversation[] },
  ]

  for (const item of items) {
    const age = now - new Date(item.updated_at).getTime()
    if (age < day) groups[0].items.push(item)
    else if (age < day * 2) groups[1].items.push(item)
    else if (age < day * 7) groups[2].items.push(item)
    else groups[3].items.push(item)
  }

  return groups.filter((group) => group.items.length > 0)
}

function SourceModal({
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
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setError('')
      setNotice('')
      setDragActive(false)
    }
  }, [open])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  if (!open) return null

  const upload = async () => {
    if (!file) {
      setError('Choose a file first.')
      return
    }
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const result = await documentApi.upload(workspaceId, file)
      setNotice(result.duplicate ? 'This source already exists in this workspace.' : 'Source uploaded. Processing has started.')
      setFile(null)
      await onUploaded()
      if (!result.duplicate) closeTimerRef.current = setTimeout(onClose, 550)
    } catch (err) {
      setError(message(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-5 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0a0f11] shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-5 border-b border-white/[0.07] px-7 py-6 md:px-8 md:py-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">Add sources</p>
            <h2 className="mt-2.5 text-[28px] font-medium tracking-[-0.04em] text-foreground">Add sources to your workspace</h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">Every conversation in this workspace will be able to use these sources.</p>
          </div>
          <button type="button" aria-label="Close source dialog" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-muted-foreground transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="px-6 pb-6 pt-5 md:px-8 md:pb-8">
          <div
            className={`rounded-[22px] border border-dashed px-6 py-12 text-center transition-all duration-300 ${dragActive ? 'border-primary/70 bg-primary/[0.055] shadow-[inset_0_0_0_1px_rgba(13,148,136,0.12)]' : 'border-white/[0.10] bg-white/[0.018] hover:border-white/[0.16] hover:bg-white/[0.025]'}`}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); setError(''); setNotice(''); setFile(event.dataTransfer.files?.[0] ?? null) }}
          >
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-primary shadow-[0_12px_35px_rgba(0,0,0,0.18)]">
              <Upload size={22} />
            </div>
            <p className="mt-5 text-[18px] font-medium tracking-[-0.02em] text-foreground">Drop a file here</p>
            <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">PDF, DOCX, XLSX, and CSV up to 50 MB.</p>
            <div className="mt-7 inline-flex">
              <PixelDissolveButton
                label={file ? 'CHOOSE ANOTHER FILE' : 'CHOOSE A FILE'}
                color="#2C5F34"
                dissolveColor="#004d00"
                onClick={() => document.getElementById(`querypilot-source-input-${workspaceId}`)?.click()}
                className="!min-w-0 !min-h-11 !rounded-xl !px-5 !py-0 !text-[11px] !font-medium !tracking-[0.09em]"
              />
              <input id={`querypilot-source-input-${workspaceId}`} type="file" className="sr-only" accept=".pdf,.docx,.xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </div>
            {file && <p className="mx-auto mt-5 max-w-lg truncate text-[12px] text-muted-foreground">Selected: {file.name}</p>}
            {error && <p className="mx-auto mt-4 max-w-lg text-[12px] text-red-300">{error}</p>}
            {notice && <p className="mx-auto mt-4 max-w-lg text-[12px] text-emerald-300">{notice}</p>}
            <div className="mt-6 flex justify-center">
              <PixelDissolveButton
                label={uploading ? 'UPLOADING' : 'ADD SELECTED SOURCE'}
                color={file && !uploading ? '#e8f4f1' : '#1a2023'}
                dissolveColor={file && !uploading ? '#2C5F34' : '#7b8a8c'}
                disabled={!file || uploading}
                onClick={() => void upload()}
                className="!min-w-0 !min-h-11 !rounded-xl !px-5 !py-0 !text-[11px] !font-medium !tracking-[0.09em] !text-[#08100f] disabled:!text-white/45"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkspaceSidebar({
  pathname,
  workspace,
  user,
  conversations,
  search,
  setSearch,
  onCreateChat,
  onBack,
  onOpenSource,
  onLogout,
  loggingOut,
  onNavigate,
  onToggleSidebar,
}: {
  pathname: string
  workspace: Workspace | null
  user: User | null
  conversations: { label: string; items: Conversation[] }[]
  search: string
  setSearch: (value: string) => void
  onCreateChat: () => void
  onBack: () => void
  onOpenSource: () => void
  onLogout: () => void
  loggingOut: boolean
  onNavigate?: () => void
  onToggleSidebar?: () => void
}) {
  const initials = user?.username?.slice(0, 1).toUpperCase() || 'A'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#070707] text-foreground">
      <div className="border-b border-white/[0.07] px-5 pb-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="group flex min-w-0 items-center gap-3 text-left">
            <span className="truncate text-[19px] font-medium tracking-[-0.04em] text-foreground">QueryPilot</span>
          </button>
          {onToggleSidebar && (
            <button type="button" onClick={onToggleSidebar} aria-label="Hide sidebar" title="Hide sidebar" className="grid size-9 shrink-0 place-items-center rounded-xl border border-transparent text-muted-foreground transition-all duration-200 hover:border-white/[0.07] hover:bg-white/[0.045] hover:text-foreground">
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-foreground/70">
              <BookOpen size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">{workspace?.title || 'Workspace'}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current workspace</p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <PixelDissolveButton
            label="NEW CHAT"
            color="#29333a"
            dissolveColor="#00131d4b"
            onClick={onCreateChat}
            className="w-full !min-h-11 !rounded-xl !px-5 !py-0 !text-[10px] !font-medium !tracking-[0.1em] !text-white"
          />
        </div>

        <label className="mt-3 flex h-11 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0a1012]/90 px-3.5 text-[12px] text-muted-foreground transition-all duration-200 focus-within:border-white/[0.16] focus-within:bg-[#0d0e0f] focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.025)]">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" aria-label="Search chats" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/80" />
          <kbd className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[9px] font-medium text-muted-foreground">\u2318 K</kbd>
        </label>

        <nav className="mt-4 grid gap-1" aria-label="Primary navigation">
          <button type="button" onClick={onBack} className="flex h-11 items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-medium text-foreground/70 transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground"><Home size={16} /> Home</button>
          <button type="button" onClick={onOpenSource} className="flex h-11 items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-medium text-foreground/70 transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground"><FileText size={16} /> Documents</button>
          <button type="button" onClick={onBack} className="flex h-11 items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-medium text-foreground/70 transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground"><FolderKanban size={16} /> Workspaces</button>
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.10)_transparent]">
        <div className="flex items-center justify-between px-2.5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Conversations</span>
            <span className="ml-2 text-[10px] text-muted-foreground/50">{conversations.reduce((count, group) => count + group.items.length, 0)}</span>
          </div>
          <button type="button" onClick={onCreateChat} aria-label="New chat" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground"><Plus size={14} /></button>
        </div>

        {conversations.length === 0 ? (
          <div className="px-3 pt-10 text-center">
            <div className="mx-auto grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.02] text-muted-foreground"><Plus size={16} /></div>
            <p className="mt-4 text-[12px] font-medium text-foreground/75">No conversations yet.</p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Start a new chat to explore your documents.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {conversations.map((group) => (
              <section key={group.label}>
                <p className="px-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">{group.label}</p>
                <div className="mt-2 space-y-1">
                  {group.items.map((conversation) => {
                    const href = `/workspaces/${workspace?.id}/chat/${conversation.id}`
                    const active = pathname === href
                    return (
                      <Link key={conversation.id} href={href} onClick={onNavigate} className={`group relative block rounded-xl px-3 py-2.5 text-[12px] leading-5 transition-all duration-200 ${active ? 'bg-white/[0.06] text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045)]' : 'text-foreground/62 hover:bg-white/[0.035] hover:text-foreground'}`}>
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-white/70" />}
                        <p className="truncate pr-2 font-medium tracking-[-0.005em]">{conversation.title || 'New Chat'}</p>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] p-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-[#202224] text-[12px] font-medium text-foreground">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{user?.username || 'Account'}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{user?.email || ''}</p>
            </div>
            <Link href="/settings" onClick={onNavigate} aria-label="Settings" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground"><Settings size={15} /></Link>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Link href="/settings" onClick={onNavigate} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-[11px] font-medium text-foreground/60 transition-all duration-200 hover:bg-white/[0.035] hover:text-foreground"><Settings size={14} /> Settings</Link>
          <button type="button" onClick={onLogout} disabled={loggingOut} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-[11px] font-medium text-foreground/60 transition-all duration-200 hover:bg-white/[0.035] hover:text-foreground disabled:opacity-40"><LogOut size={14} /> {loggingOut ? 'Signing out' : 'Sign out'}</button>
        </div>
      </div>
    </div>
  )
}

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: number
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const onboardingKey = `${ONBOARDING_PREFIX}${workspaceId}`
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollInFlightRef = useRef(false)
  const pollStartedAtRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [workspaces, docs, chats, me] = await Promise.all([
        workspaceApi.list(),
        documentApi.list(workspaceId),
        chatApi.conversations(workspaceId),
        authApi.me(),
      ])
      const found = workspaces.find((item) => item.id === workspaceId) ?? null
      if (!found) {
        router.replace('/workspaces')
        return
      }
      setWorkspace(found)
      setDocuments(docs)
      setConversations(chats)
      setUser(me)
      sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, String(workspaceId))
    } catch (err) {
      const apiError = err as { status?: number }
      if (apiError.status === 401 || apiError.status === 403) {
        authApi.clearTokens()
        router.replace('/login')
        return
      }
      setError(message(err))
    } finally {
      setLoading(false)
    }
  }, [router, workspaceId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const handleConversationChanged = (event: Event) => {
      const custom = event as CustomEvent<{ conversationId?: number; title?: string; updatedAt?: string; conversation?: Conversation }>
      const detail = custom.detail
      if (detail?.conversation && detail.conversation.workspace === workspaceId) {
        setConversations((current) => [detail.conversation!, ...current.filter((item) => item.id !== detail.conversation!.id)])
        return
      }
      if (typeof detail?.conversationId === 'number' && (typeof detail.title === 'string' || typeof detail.updatedAt === 'string')) {
        setConversations((current) => current.map((item) => item.id === detail.conversationId ? { ...item, ...(typeof detail.title === 'string' ? { title: detail.title } : {}), updated_at: detail.updatedAt ?? new Date().toISOString() } : item).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      }
    }
    const handleDocumentsChanged = () => {
      documentApi.list(workspaceId)
        .then(setDocuments)
        .catch((err) => setError(message(err)))
    }
    window.addEventListener('querypilot:conversation-changed', handleConversationChanged)
    window.addEventListener('querypilot:workspace-documents-changed', handleDocumentsChanged)
    return () => {
      window.removeEventListener('querypilot:conversation-changed', handleConversationChanged)
      window.removeEventListener('querypilot:workspace-documents-changed', handleDocumentsChanged)
    }
  }, [workspaceId])

  // Poll document status while anything is still processing, with backoff
  // and a hard time cap so a stuck ingestion job doesn't poll forever.
  // Guards against overlapping requests (pollInFlightRef) instead of
  // firing a fresh request every tick regardless of whether the last one
  // finished.
  useEffect(() => {
    const hasPending = documents.some((document) => document.status === 'pending' || document.status === 'processing')

    if (!hasPending) {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
      pollStartedAtRef.current = null
      return
    }

    if (pollStartedAtRef.current === null) pollStartedAtRef.current = Date.now()
    let cancelled = false
    let attempt = 0

    const scheduleNext = () => {
      if (cancelled) return
      const elapsed = Date.now() - (pollStartedAtRef.current ?? Date.now())
      if (elapsed > POLL_MAX_DURATION_MS) {
        setError('Document processing is taking longer than expected. Refresh the page to check the latest status.')
        return
      }
      const interval = POLL_INTERVALS_MS[Math.min(attempt, POLL_INTERVALS_MS.length - 1)]
      pollTimeoutRef.current = setTimeout(runPoll, interval)
    }

    const runPoll = async () => {
      if (cancelled || pollInFlightRef.current) {
        scheduleNext()
        return
      }
      pollInFlightRef.current = true
      try {
        const latest = await documentApi.list(workspaceId)
        if (!cancelled) setDocuments(latest)
      } catch (err) {
        if (!cancelled) setError(message(err))
      } finally {
        pollInFlightRef.current = false
        attempt += 1
        if (!cancelled) scheduleNext()
      }
    }

    scheduleNext()

    return () => {
      cancelled = true
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [documents, workspaceId])

  // App Router: window.location.search doesn't update reactively across
  // client-side navigations. useSearchParams() is the supported way to
  // read the query string here.
  useEffect(() => {
    if (loading) return
    const seen = localStorage.getItem(onboardingKey) === '1'
    if (!seen && searchParams.get('new') === '1') setSourceModalOpen(true)
  }, [loading, onboardingKey, searchParams])

  const finishOnboarding = () => {
    localStorage.setItem(onboardingKey, '1')
    setSourceModalOpen(false)
  }

  const createChat = () => {
    const draftPath = `/workspaces/${workspaceId}/chat`
    if (pathname === draftPath) {
      window.dispatchEvent(new CustomEvent('querypilot:new-chat-requested'))
      setMobileOpen(false)
      return
    }
    router.push(draftPath)
    setMobileOpen(false)
  }

  const filteredConversations = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return conversations
    return conversations.filter((item) => item.title.toLowerCase().includes(normalized))
  }, [conversations, search])

  const grouped = groupConversations(filteredConversations)

  const logout = async () => {
    setLoggingOut(true)
    try {
      await authApi.logout()
    } catch (err) {
      // Token revocation on the server failed, but we still clear local
      // state and redirect below — the user's session on this device
      // ends either way. Surface it so a real backend outage isn't silent.
      setError(message(err))
    } finally {
      router.replace('/login')
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#070707] text-sm text-muted-foreground">Loading workspace</div>
  if (loggingOut) return <div className="grid min-h-screen place-items-center bg-[#070707] text-sm text-muted-foreground">Signing out</div>

  return (
    <div className="min-h-screen bg-[#070707] text-foreground">
      {!sidebarCollapsed && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[340px] border-r border-white/[0.07] lg:block">
          <WorkspaceSidebar pathname={pathname} workspace={workspace} user={user} conversations={grouped} search={search} setSearch={setSearch} onCreateChat={createChat} onBack={() => router.push('/workspaces')} onOpenSource={() => setSourceModalOpen(true)} onLogout={() => void logout()} loggingOut={loggingOut} onToggleSidebar={() => setSidebarCollapsed(true)} />
        </aside>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/60" />
          <aside className="relative z-10 h-full w-[min(90vw,380px)] border-r border-white/[0.07] bg-[#070707] shadow-2xl">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.04]"><X size={17} /></button>
            <WorkspaceSidebar pathname={pathname} workspace={workspace} user={user} conversations={grouped} search={search} setSearch={setSearch} onCreateChat={createChat} onBack={() => router.push('/workspaces')} onOpenSource={() => setSourceModalOpen(true)} onLogout={() => void logout()} loggingOut={loggingOut} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <main className={`min-h-screen transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-0" : "lg:pl-[340px]"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/[0.06] bg-[#070707]/82 px-4 backdrop-blur-xl lg:px-7">
          <div className="flex items-center gap-1">
            {sidebarCollapsed ? (
              <button type="button" onClick={() => setSidebarCollapsed(false)} aria-label="Show sidebar" title="Show sidebar" className="hidden size-10 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground lg:grid">
                <PanelLeftOpen size={17} />
              </button>
            ) : (
              <button type="button" onClick={() => setSidebarCollapsed(true)} aria-label="Hide sidebar" title="Hide sidebar" className="hidden size-10 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground lg:grid">
                <PanelLeftClose size={17} />
              </button>
            )}
            <button type="button" className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-white/[0.045] hover:text-foreground lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={17} />
            </button>
          </div>
          <div className="ml-auto">
            <PixelDissolveButton label="ADD SOURCE" color="#f1f3f4" dissolveColor="#8b9295" onClick={() => setSourceModalOpen(true)} className="!min-w-0 !min-h-11 !rounded-xl !px-4 !py-0 !text-[10px] !font-medium !tracking-[0.1em] !text-[#08100f]" />
          </div>
        </header>

        {error && <div className="mx-4 mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-300 lg:mx-6">{error}</div>}
        {children}
      </main>

      <SourceModal workspaceId={workspaceId} open={sourceModalOpen} onClose={finishOnboarding} onUploaded={async () => {
        await load()
        window.dispatchEvent(new CustomEvent('querypilot:workspace-documents-changed'))
      }} />
    </div>
  )
}