'use client'

import Link from 'next/link'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  BookOpen,
  ChevronDown,
  FileText,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import {
  usePathname,
  useRouter,
} from 'next/navigation'

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

const ACTIVE_WORKSPACE_KEY =
  'querypilot_active_workspace_id'

const ONBOARDING_PREFIX =
  'querypilot_source_onboarding_seen_'

function message(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

function groupConversations(
  items: Conversation[],
) {
  const now =
    Date.now()

  const day =
    86_400_000

  const groups = [
    {
      label: 'Today',
      items: [] as Conversation[],
    },
    {
      label: 'Yesterday',
      items: [] as Conversation[],
    },
    {
      label: 'Previous 7 days',
      items: [] as Conversation[],
    },
    {
      label: 'Older',
      items: [] as Conversation[],
    },
  ]

  for (
    const item of items
  ) {
    const age =
      now -
      new Date(
        item.updated_at,
      ).getTime()

    if (age < day) {
      groups[0].items.push(
        item,
      )
    } else if (
      age <
      day * 2
    ) {
      groups[1].items.push(
        item,
      )
    } else if (
      age <
      day * 7
    ) {
      groups[2].items.push(
        item,
      )
    } else {
      groups[3].items.push(
        item,
      )
    }
  }

  return groups.filter(
    (group) =>
      group.items.length >
      0,
  )
}

function statusLabel(
  status: Document['status'],
) {
  switch (status) {
    case 'ready':
      return 'Ready'

    case 'processing':
      return 'Processing'

    case 'pending':
      return 'Pending'

    case 'failed':
      return 'Failed'

    default:
      return status
  }
}

function sourceTypeLabel(
  sourceType: string,
) {
  return (
    sourceType?.toUpperCase() ||
    'FILE'
  )
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
  const [
    file,
    setFile,
  ] = useState<File | null>(
    null,
  )

  const [
    uploading,
    setUploading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    notice,
    setNotice,
  ] = useState('')

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setError('')
      setNotice('')
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  if (!open) {
    return null
  }

  const upload =
    async () => {
      if (!file) {
        setError(
          'Choose a file first.',
        )

        return
      }

      setUploading(true)
      setError('')
      setNotice('')

      try {
        const result =
          await documentApi.upload(
            workspaceId,
            file,
          )

        setNotice(
          result.duplicate
            ? 'This source already exists in the notebook.'
            : 'Source uploaded. Processing has started.',
        )

        setFile(null)

        await onUploaded()

        if (!result.duplicate) {
          closeTimerRef.current = setTimeout(
            onClose,
            550,
          )
        }
      } catch (err) {
        setError(
          message(err),
        )
      } finally {
        setUploading(false)
      }
    }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-5">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-background p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Add sources
            </p>

            <h2 className="mt-2 text-2xl font-medium tracking-[-0.03em]">
              Add sources to your notebook
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every conversation in this workspace will be able to use these sources.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close source dialog"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-7 rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-12 text-center">
          <Upload
            size={24}
            className="mx-auto text-muted-foreground"
          />

          <p className="mt-4 text-lg font-medium">
            Drop your files here
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX, XLSX, and CSV up to 50 MB.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <label className="cursor-pointer rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90">
              <Upload
                size={15}
                className="mr-2 inline"
              />

              {file
                ? 'Choose another file'
                : 'Upload files'}

              <input
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.xlsx,.csv"
                onChange={(event) =>
                  setFile(
                    event.target.files?.[0] ??
                      null,
                  )
                }
              />
            </label>

            <button
              type="button"
              disabled
              className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground opacity-60"
            >
              Websites
            </button>

            <button
              type="button"
              disabled
              className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground opacity-60"
            >
              Copied text
            </button>
          </div>

          {file && (
            <p className="mx-auto mt-5 max-w-lg truncate text-xs text-muted-foreground">
              Selected: {file.name}
            </p>
          )}

          {error && (
            <p className="mx-auto mt-4 max-w-lg rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {notice && (
            <p className="mx-auto mt-4 max-w-lg rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {notice}
            </p>
          )}

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() =>
                void upload()
              }
              disabled={
                !file ||
                uploading
              }
              className="rounded-full border border-border px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading
                ? 'Uploading…'
                : 'Add selected source'}
            </button>
          </div>
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
  const router =
    useRouter()

  const pathname =
    usePathname()

  const [
    workspace,
    setWorkspace,
  ] = useState<Workspace | null>(
    null,
  )

  const [
    user,
    setUser,
  ] = useState<User | null>(
    null,
  )

  const [
    documents,
    setDocuments,
  ] = useState<Document[]>(
    [],
  )

  const [
    conversations,
    setConversations,
  ] = useState<Conversation[]>(
    [],
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    sourceModalOpen,
    setSourceModalOpen,
  ] = useState(false)

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false)

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false)

  const [activeConversationId, setActiveConversationId] =
    useState<number | null>(null)

  const onboardingKey =
    `${ONBOARDING_PREFIX}${workspaceId}`

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const [
            workspaces,
            docs,
            chats,
            me,
          ] =
            await Promise.all([
              workspaceApi.list(),
              documentApi.list(
                workspaceId,
              ),
              chatApi.conversations(
                workspaceId,
              ),
              authApi.me(),
            ])

          const found =
            workspaces.find(
              (item) =>
                item.id ===
                workspaceId,
            ) ??
            null

          if (!found) {
            router.replace('/workspaces')
            return
          }

          setWorkspace(found)
          setDocuments(docs)
          setConversations(chats)
          setUser(me)

          sessionStorage.setItem(
            ACTIVE_WORKSPACE_KEY,
            String(workspaceId),
          )
        } catch (err) {
          const apiError =
            err as {
              status?: number
            }

          if (
            apiError.status ===
              401 ||
            apiError.status ===
              403
          ) {
            authApi.clearTokens()
            router.replace(
              '/login',
            )

            return
          }

          setError(
            message(err),
          )
        } finally {
          setLoading(false)
        }
      },
      [
        router,
        workspaceId,
      ],
    )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const match = pathname.match(/\/chat\/(\d+)(?:\/|$)/)
    setActiveConversationId(match ? Number(match[1]) : null)
  }, [pathname])

  useEffect(() => {
    const handleConversationChanged = (
      event: Event,
    ) => {
      const custom =
        event as CustomEvent<{
          conversationId?: number
          title?: string
          conversation?: Conversation
        }>

      const detail =
        custom.detail

      if (
        detail?.conversation &&
        detail.conversation.workspace === workspaceId
      ) {
        setActiveConversationId(detail.conversation.id)
        setConversations(
          (current) => [
            detail.conversation!,
            ...current.filter(
              (item) =>
                item.id !==
                detail
                  .conversation!
                  .id,
            ),
          ],
        )

        return
      }

      if (
        typeof detail?.conversationId ===
          'number' &&
        typeof detail.title ===
          'string'
      ) {
        setActiveConversationId(detail.conversationId)
        setConversations(
          (current) => {
            const updated =
              current.map(
                (item) =>
                  item.id ===
                  detail.conversationId
                    ? {
                        ...item,
                        title:
                          detail.title!,
                        updated_at:
                          new Date().toISOString(),
                      }
                    : item,
              )

            return updated.sort(
              (
                a,
                b,
              ) =>
                new Date(
                  b.updated_at,
                ).getTime() -
                new Date(
                  a.updated_at,
                ).getTime(),
            )
          },
        )
      }
    }

    const handleDocumentsChanged =
      () => {
        void documentApi
          .list(
            workspaceId,
          )
          .then(
            setDocuments,
          )
          .catch(
            () => {},
          )
      }

    window.addEventListener(
      'querypilot:conversation-changed',
      handleConversationChanged,
    )

    window.addEventListener(
      'querypilot:workspace-documents-changed',
      handleDocumentsChanged,
    )

    return () => {
      window.removeEventListener(
        'querypilot:conversation-changed',
        handleConversationChanged,
      )

      window.removeEventListener(
        'querypilot:workspace-documents-changed',
        handleDocumentsChanged,
      )
    }
  }, [workspaceId])

  useEffect(() => {
    if (loading) {
      return
    }

    const seen =
      localStorage.getItem(
        onboardingKey,
      ) === '1'

    const isNewWorkspace =
      window.location.search.includes(
        'new=1',
      )

    if (
      !seen &&
      isNewWorkspace
    ) {
      setSourceModalOpen(
        true,
      )
    }
  }, [
    loading,
    onboardingKey,
  ])

  const finishOnboarding =
    () => {
      localStorage.setItem(
        onboardingKey,
        '1',
      )

      setSourceModalOpen(
        false,
      )
    }

  const createChat =
    () => {
      const draftPath =
        `/workspaces/${workspaceId}/chat`

      // Already sitting on the draft route — re-navigating to the exact
      // same URL is a no-op as far as Next.js routing is concerned (same
      // page, same params), so it wouldn't reset any state on its own.
      // Tell the current draft to reset itself instead. ChatView's
      // "querypilot:new-chat-requested" handler now does a full state
      // reset (see querypilot.tsx), not just clearing the composer.
      if (pathname === draftPath) {
        window.dispatchEvent(
          new CustomEvent(
            'querypilot:new-chat-requested',
          ),
        )

        setMobileOpen(false)
        return
      }

      router.push(draftPath)

      setMobileOpen(false)
    }

  const filteredConversations =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase()

      if (!normalized) {
        return conversations
      }

      return conversations.filter(
        (item) =>
          item.title
            .toLowerCase()
            .includes(
              normalized,
            ),
      )
    }, [
      conversations,
      search,
    ])

  const grouped =
    groupConversations(
      filteredConversations,
    )

  const deleteDocument =
    async (
      id: number,
    ) => {
      try {
        await documentApi.remove(
          id,
        )

        setDocuments(
          (current) =>
            current.filter(
              (item) =>
                item.id !== id,
            ),
        )
      } catch (err) {
        setError(
          message(err),
        )
      }
    }

  const logout =
    async () => {
      setLoggingOut(true)

      try {
        await authApi.logout()
      } catch {
      } finally {
        router.replace(
          '/login',
        )
      }
    }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    )
  }

  if (loggingOut) {
    // Blank the protected UI the instant logout starts, rather than only
    // disabling the sign-out button while the sidebar/workspace stay fully
    // rendered during the redirect to /login (the "logout flash").
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Signing out…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg hover:bg-muted lg:hidden"
          onClick={() =>
            setMobileOpen(true)
          }
          aria-label="Open workspace navigation"
        >
          <Menu size={18} />
        </button>

        <button
          type="button"
          onClick={() =>
            router.push(
              '/workspaces',
            )
          }
          className="flex items-center gap-2.5"
        >
          <span className="grid size-7 place-items-center rounded-[8px] bg-emerald-500 text-white">
            <BookOpen size={15} />
          </span>

          <span className="text-[15px] font-semibold tracking-[-0.02em]">
            QueryPilot
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setSourceModalOpen(
                true,
              )
            }
            className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted sm:flex"
          >
            <Plus size={14} />
            Add source
          </button>

          <div className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground md:flex">
            <span className="size-2 rounded-full bg-emerald-500" />

            {workspace?.title}
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 lg:mx-6">
          {error}
        </div>
      )}

      <aside className="fixed inset-y-14 left-0 z-30 hidden w-[290px] border-r border-border bg-background lg:flex lg:flex-col">
        <WorkspaceSidebar
          activeConversationId={activeConversationId}
          workspace={
            workspace
          }
          user={user}
          conversations={
            grouped
          }
          documents={
            documents
          }
          search={
            search
          }
          setSearch={
            setSearch
          }
          onCreateChat={() =>
            void createChat()
          }
          onBack={() =>
            router.push(
              '/workspaces',
            )
          }
          onOpenSource={() =>
            setSourceModalOpen(
              true,
            )
          }
          onDeleteDocument={(
            id,
          ) =>
            void deleteDocument(
              id,
            )
          }
          onLogout={() =>
            void logout()
          }
          loggingOut={
            loggingOut
          }
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close workspace navigation"
            onClick={() =>
              setMobileOpen(false)
            }
            className="absolute inset-0 bg-black/30"
          />

          <aside className="relative z-10 h-full w-[min(88vw,340px)] border-r border-border bg-background shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() =>
                  setMobileOpen(
                    false,
                  )
                }
                className="grid size-8 place-items-center rounded-lg hover:bg-muted"
              >
                <X size={17} />
              </button>
            </div>

            <WorkspaceSidebar
              activeConversationId={activeConversationId}
              workspace={
                workspace
              }
              user={user}
              conversations={
                grouped
              }
              documents={
                documents
              }
              search={
                search
              }
              setSearch={
                setSearch
              }
              onCreateChat={() =>
                void createChat()
              }
              onBack={() =>
                router.push(
                  '/workspaces',
                )
              }
              onOpenSource={() =>
                setSourceModalOpen(
                  true,
                )
              }
              onDeleteDocument={(
                id,
              ) =>
                void deleteDocument(
                  id,
                )
              }
              onLogout={() =>
                void logout()
              }
              loggingOut={
                loggingOut
              }
              onNavigate={() =>
                setMobileOpen(
                  false,
                )
              }
            />
          </aside>
        </div>
      )}

      <main className="lg:pl-[290px]">
        {children}
      </main>

      <SourceModal
        workspaceId={
          workspaceId
        }
        open={
          sourceModalOpen
        }
        onClose={
          finishOnboarding
        }
        onUploaded={async () => {
          await load()

          window.dispatchEvent(
            new CustomEvent(
              'querypilot:workspace-documents-changed',
            ),
          )
        }}
      />
    </div>
  )
}

function WorkspaceSidebar({
  activeConversationId,
  workspace,
  user,
  conversations,
  documents,
  search,
  setSearch,
  onCreateChat,
  onBack,
  onOpenSource,
  onDeleteDocument,
  onLogout,
  loggingOut,
  onNavigate,
}: {
  activeConversationId: number | null
  workspace:
    | Workspace
    | null
  user:
    | User
    | null
  conversations: {
    label: string
    items: Conversation[]
  }[]
  documents: Document[]
  search: string
  setSearch: (
    value: string,
  ) => void
  onCreateChat: () => void
  onBack: () => void
  onOpenSource: () => void
  onDeleteDocument: (
    id: number,
  ) => void
  onLogout: () => void
  loggingOut: boolean
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 pb-4 pt-5">
        <button
          type="button"
          onClick={
            onBack
          }
          className="flex max-w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            size={14}
            className="rotate-90"
          />

          My notebooks
        </button>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <BookOpen size={15} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              {workspace?.title}
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Notebook
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onCreateChat
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus
            size={15}
          />

          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground focus-within:border-foreground/20">
          <Search size={14} />

          <input
            value={
              search
            }
            onChange={(
              event,
            ) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <section className="mt-6">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Conversations
            </p>

            <button
              type="button"
              onClick={
                onCreateChat
              }
              className="text-[10px] font-medium text-emerald-700 hover:underline"
            >
              New
            </button>
          </div>

          <div className="mt-3 space-y-5">
            {conversations.length ===
            0 ? (
              <p className="px-2 text-xs leading-5 text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              conversations.map(
                (
                  group,
                ) => (
                  <div
                    key={
                      group.label
                    }
                  >
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {
                        group.label
                      }
                    </p>

                    <div className="mt-1.5 space-y-0.5">
                      {group.items.map(
                        (
                          conversation,
                        ) => {
                          const href =
                            `/workspaces/${workspace?.id}/chat/${conversation.id}`

                          const active =
                            activeConversationId === conversation.id

                          return (
                            <Link
                              key={
                                conversation.id
                              }
                              href={
                                href
                              }
                              prefetch={false}
                              onClick={
                                onNavigate
                              }
                              className={`relative block rounded-lg px-2.5 py-2.5 pl-3.5 transition ${
                                active
                                  ? 'bg-emerald-50 text-emerald-900'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              {active && (
                                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-emerald-600" />
                              )}

                              <p className="truncate text-xs font-medium">
                                {
                                  conversation.title
                                }
                              </p>

                              <p
                                className={`mt-1 text-[10px] ${
                                  active
                                    ? 'text-emerald-700/70'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {new Date(
                                  conversation.updated_at,
                                ).toLocaleDateString(
                                  'en-IN',
                                  {
                                    day: 'numeric',
                                    month: 'short',
                                  },
                                )}
                              </p>
                            </Link>
                          )
                        },
                      )}
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>

        <section className="mt-7 border-t border-border pt-5">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Sources
            </p>

            <button
              type="button"
              onClick={
                onOpenSource
              }
              className="text-emerald-700 hover:text-emerald-800"
              aria-label="Add source"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {documents.length ===
            0 ? (
              <button
                type="button"
                onClick={
                  onOpenSource
                }
                className="w-full rounded-xl border border-dashed border-border px-3 py-5 text-left text-xs text-muted-foreground hover:bg-muted/30"
              >
                <p className="font-medium text-foreground">
                  No sources yet
                </p>

                <p className="mt-1 leading-5">
                  Add a file and every chat in this notebook can use it.
                </p>
              </button>
            ) : (
              documents.map(
                (
                  document,
                ) => (
                  <div
                    key={
                      document.id
                    }
                    className="group flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <FileText
                        size={13}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {
                          document.title
                        }
                      </p>

                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {sourceTypeLabel(
                          document.source_type,
                        )}{' '}
                        ·{' '}
                        {statusLabel(
                          document.status,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onDeleteDocument(
                          document.id,
                        )
                      }
                      className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-red-600 group-hover:opacity-100"
                      aria-label={`Delete ${document.title}`}
                    >
                      <Trash2
                        size={13}
                      />
                    </button>
                  </div>
                ),
              )
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          onClick={
            onNavigate
          }
          className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-xs hover:bg-muted"
        >
          <Settings
            size={14}
            className="text-muted-foreground"
          />

          <span className="min-w-0 flex-1 truncate">
            {
              user?.username ||
              'Account'
            }
          </span>

          <span className="text-muted-foreground">
            Settings
          </span>
        </Link>

        <button
          type="button"
          onClick={
            onLogout
          }
          disabled={
            loggingOut
          }
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <LogOut
            size={14}
          />

          {loggingOut
            ? 'Signing out…'
            : 'Sign out'}
        </button>
      </div>
    </div>
  )
}