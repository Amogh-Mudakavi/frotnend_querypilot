'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ChevronRight, FileText, SlidersHorizontal, Trash2, type LucideIcon } from 'lucide-react'

import { PixelDissolveButton } from '@/components/pixel-dissolve-button'
import { Btn, FONT_SANS, Pill, QpGlobalStyles, docState, focusRing, inputCls } from '@/components/qp-ui'
import {
  authApi,
  chatApi,
  documentApi,
  workspaceApi,
  type ApiError,
  type Conversation,
  type Document,
  type WorkspaceSettings as WorkspaceSettingsData,
} from '@/lib/django-api'

/* Same shell and tokens as the workspaces home: #191919 page, #202020 sidebar,
   white/[0.06] dividers, indigo primary button with the dissolve effect. */

const ACTIVE_WORKSPACE_KEY = 'querypilot_active_workspace_id'
const NAME_MAX = 120
const AUTH_BLUE = '#3a44a8'
const AUTH_DISSOLVE_BLUE = '#2a3282'
const PRIMARY_BUTTON_CLASSES =
  '!h-[40px] !min-h-0 !w-auto !rounded-full !border !border-[#3a44a8] !bg-[#3a44a8] !px-5 !text-[13px] !font-medium ' +
  '!normal-case !tracking-normal !text-white hover:!bg-[#4651bd] disabled:!opacity-70 whitespace-nowrap'

/* ---------------- Helpers ---------------- */
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function validateName(raw: string): string | null {
  const t = raw.trim()
  if (!t) return 'Give your workspace a name.'
  if (t.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(t)) return "That name contains characters that aren't allowed."
  return null
}

const labelForKey = (key: string) => {
  const t = key.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Fixed "Details" rows; any other key the settings endpoint returns is listed generically.
const CORE_KEYS = new Set(['id', 'title', 'created_at', 'updated_at', 'owner'])

function renderValue(key: string, value: unknown): ReactNode {
  const none = (t: string) => <span className="text-[#7c7c7c]">{t}</span>
  if (value === null || value === undefined || value === '') return none('Not set')
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return key.endsWith('_at') && !Number.isNaN(Date.parse(value)) ? formatDateTime(value) : value
  if (Array.isArray(value)) {
    return value.length === 0 ? none('None') : value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  }
  return <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-[#cfcfcf]">{JSON.stringify(value)}</code>
}

/* ---------------- Pieces ---------------- */
function Logo() {
  return (
    <Link
      href="/workspaces"
      className={`inline-flex items-center gap-2.5 rounded-md text-[14px] font-medium tracking-tight text-[#e6e6e6] ${focusRing}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/querypilot-logo.svg" alt="" width={20} height={20} draggable={false} />
      <span>QueryPilot</span>
    </Link>
  )
}

const navRow = (active: boolean) =>
  `flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] transition-colors ${
    active ? 'bg-white/[0.07] text-[#ececec]' : 'text-[#b8b8b8] hover:bg-white/[0.05] hover:text-[#ececec]'
  } ${focusRing}`

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="py-8 first:pt-0">
      <h2 className="text-[15px] font-medium text-[#ececec]">{title}</h2>
      {description && <p className="mt-1 max-w-[60ch] text-[13px] leading-5 text-[#9a9a9a]">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[13px] text-[#8c8c8c]">{label}</dt>
      <dd className="min-w-0 break-words text-[13.5px] text-[#e0e0e0]">{children}</dd>
    </div>
  )
}

function ListBox({ children }: { children: ReactNode }) {
  return <ul className="overflow-hidden rounded-lg border border-white/[0.07]">{children}</ul>
}

function ListRow({ title, meta, end }: { title: string; meta?: string; end?: ReactNode }) {
  return (
    <li className="flex h-11 items-center gap-4 border-b border-white/[0.06] px-4 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#e6e6e6]">{title}</span>
      {meta && <span className="hidden flex-none text-[12.5px] text-[#8c8c8c] sm:block">{meta}</span>}
      {end}
    </li>
  )
}

/* ---------------- Page ---------------- */
type Tab = 'general' | 'contents' | 'delete'
const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'general', label: 'General', Icon: SlidersHorizontal },
  { id: 'contents', label: 'Contents', Icon: FileText },
  { id: 'delete', label: 'Delete workspace', Icon: Trash2 },
]

export function WorkspaceSettings({ workspaceId: workspaceIdProp }: { workspaceId?: number }) {
  const router = useRouter()
  const params = useParams() as Record<string, string | string[] | undefined>

  // Works with app/workspaces/[workspaceId]/settings (also [id] or [workspace_id]).
  const rawId = params?.workspaceId ?? params?.id ?? params?.workspace_id
  const workspaceId = workspaceIdProp ?? Number(Array.isArray(rawId) ? rawId[0] : rawId)

  const [tab, setTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<WorkspaceSettingsData | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ message: string; notFound: boolean } | null>(null)

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = useCallback(async () => {
    if (!Number.isFinite(workspaceId)) {
      setLoadError({ message: 'This workspace link is not valid.', notFound: true })
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const [data, docs, convs] = await Promise.all([
        workspaceApi.settings(workspaceId),
        documentApi.list(workspaceId).catch(() => [] as Document[]),
        chatApi.conversations(workspaceId).catch(() => [] as Conversation[]),
      ])
      setSettings(data)
      setName(typeof data.title === 'string' ? data.title : '')
      setDocuments(docs)
      setConversations(convs)
    } catch (err) {
      const status = (err as ApiError).status
      if (status === 401 || status === 403) {
        authApi.clearTokens()
        router.replace('/login')
        return
      }
      setLoadError({ message: errorMessage(err), notFound: status === 404 })
    } finally {
      setLoading(false)
    }
  }, [workspaceId, router])

  useEffect(() => {
    void load()
  }, [load])

  const currentTitle = typeof settings?.title === 'string' ? settings.title : ''
  const dirty = name.trim() !== currentTitle && name.trim().length > 0
  const extraEntries = useMemo(() => Object.entries(settings ?? {}).filter(([k]) => !CORE_KEYS.has(k)), [settings])
  const ready = useMemo(() => documents.filter((d) => d.status === 'ready').length, [documents])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const problem = validateName(name)
    if (problem) return setNameError(problem)
    setSaving(true)
    setSaved(false)
    setNameError('')
    try {
      const updated = await workspaceApi.update(workspaceId, { title: name.trim() })
      setSettings((cur) => ({ ...(cur ?? {}), ...updated }))
      setName(updated.title)
      setSaved(true)
    } catch (err) {
      setNameError((err as ApiError).fieldErrors?.title?.join(' ') || errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await workspaceApi.remove(workspaceId)
      if (sessionStorage.getItem(ACTIVE_WORKSPACE_KEY) === String(workspaceId)) sessionStorage.removeItem(ACTIVE_WORKSPACE_KEY)
      router.replace('/workspaces')
    } catch (err) {
      setDeleteError(errorMessage(err))
      setDeleting(false)
    }
  }

  const openHref = `/workspaces/${workspaceId}`

  const tabButtons = (cls: string) =>
    TABS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        aria-current={tab === id ? 'page' : undefined}
        onClick={() => setTab(id)}
        className={`${navRow(tab === id)} ${cls}`}
      >
        <Icon size={15} strokeWidth={1.7} className={id === 'delete' ? 'text-[#f08a84]' : 'text-[#8a8a8a]'} />
        <span className="truncate">{label}</span>
      </button>
    ))

  return (
    <main className="qp-zoom qp-h flex overflow-hidden bg-[#191919] text-[#e6e6e6] antialiased [color-scheme:dark]" style={{ fontFamily: FONT_SANS }}>
      <QpGlobalStyles />

      <aside className="hidden w-[256px] flex-none flex-col border-r border-white/[0.06] bg-[#202020] md:flex">
        <div className="flex h-12 items-center px-3.5">
          <Logo />
        </div>
        <nav aria-label="Settings sections" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
          <Link href="/workspaces" className={navRow(false)}>
            <ArrowLeft size={15} strokeWidth={1.7} className="text-[#8a8a8a]" />
            All workspaces
          </Link>
          {!loading && !loadError && (
            <>
              <p className="truncate px-2.5 pb-1.5 pt-5 text-[12px] text-[#8c8c8c]">{currentTitle || 'Workspace'}</p>
              {tabButtons('')}
            </>
          )}
        </nav>
        {!loadError && (
          <div className="border-t border-white/[0.06] p-2">
            <Link href={openHref} className={navRow(false)}>
              Back to chat
            </Link>
          </div>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-none items-center gap-3 px-3.5 md:px-8">
          <div className="md:hidden">
            <Logo />
          </div>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] text-[#8c8c8c] md:flex">
            <Link href="/workspaces" className={`rounded hover:text-[#e6e6e6] ${focusRing}`}>
              Workspaces
            </Link>
            <ChevronRight size={13} />
            <span className="max-w-[28ch] truncate">{currentTitle || 'Workspace'}</span>
            <ChevronRight size={13} />
            <span className="text-[#cfcfcf]">Settings</span>
          </nav>
          {!loadError && (
            <Link href={openHref} className={`ml-auto rounded-md px-2 py-1 text-[13px] text-[#b8b8b8] hover:text-white md:hidden ${focusRing}`}>
              Chat
            </Link>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[820px] px-4 pb-16 pt-5 sm:px-8 sm:pt-8">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="h-10 animate-pulse rounded-md bg-white/[0.04] motion-reduce:animate-none" />
                ))}
              </div>
            ) : loadError ? (
              <div className="py-16">
                <h1 className="text-[20px] font-semibold tracking-tight text-white">
                  {loadError.notFound ? 'Workspace not found' : 'Settings couldn’t be loaded'}
                </h1>
                <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-6 text-[#a0a0a0]">
                  {loadError.notFound ? 'It may have been deleted, or it belongs to another account.' : loadError.message}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  {!loadError.notFound && <Btn variant="ghost" label="TRY AGAIN" onClick={() => void load()} />}
                  <Link href="/workspaces" className={`text-[13px] text-[#b8b8b8] hover:text-white ${focusRing}`}>
                    Back to workspaces
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-[24px] font-semibold tracking-tight text-white">Settings</h1>
                <p className="mt-1.5 truncate text-[13.5px] text-[#a0a0a0]">{currentTitle || 'Untitled workspace'}</p>

                <div className="mt-6 flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-3 md:hidden">{tabButtons('!w-auto flex-none')}</div>

                <div className="mt-6 divide-y divide-white/[0.06] border-t border-white/[0.06] md:mt-8">
                  {tab === 'general' && (
                    <>
                      <Section title="Name" description="Shown on the workspaces page and at the top of this workspace.">
                        <form onSubmit={save} noValidate className="max-w-[520px]">
                          <label htmlFor="ws-name" className="sr-only">
                            Workspace name
                          </label>
                          <input
                            id="ws-name"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value)
                              setSaved(false)
                              if (nameError) setNameError('')
                            }}
                            maxLength={NAME_MAX}
                            aria-invalid={Boolean(nameError)}
                            aria-describedby={nameError ? 'ws-name-error' : undefined}
                            disabled={saving}
                            className={inputCls}
                          />
                          {nameError && (
                            <p id="ws-name-error" role="alert" className="mt-1.5 text-[12.5px] text-[#f08a84]">
                              {nameError}
                            </p>
                          )}
                          <div className="mt-4 flex items-center gap-3">
                            <PixelDissolveButton
                              type="submit"
                              disabled={!dirty || saving}
                              label={saving ? 'Saving…' : 'Save changes'}
                              color={AUTH_BLUE}
                              dissolveColor={AUTH_DISSOLVE_BLUE}
                              cellSize={5}
                              className={PRIMARY_BUTTON_CLASSES}
                            />
                            {dirty && !saving && (
                              <Btn
                                variant="ghost"
                                label="RESET"
                                onClick={() => {
                                  setName(currentTitle)
                                  setNameError('')
                                }}
                              />
                            )}
                            <p role="status" aria-live="polite" className="text-[13px] text-[#4dab9a]">
                              {saved ? 'Saved' : ''}
                            </p>
                          </div>
                        </form>
                      </Section>

                      <Section title="Details">
                        <dl>
                          <Row label="Workspace ID">{String(settings?.id ?? workspaceId)}</Row>
                          {typeof settings?.created_at === 'string' && <Row label="Created">{formatDateTime(settings.created_at)}</Row>}
                          {typeof settings?.updated_at === 'string' && <Row label="Last updated">{formatDateTime(settings.updated_at)}</Row>}
                          {extraEntries.map(([key, value]) => (
                            <Row key={key} label={labelForKey(key)}>
                              {renderValue(key, value)}
                            </Row>
                          ))}
                        </dl>
                      </Section>
                    </>
                  )}

                  {tab === 'contents' && (
                    <>
                      <Section
                        title="Documents"
                        description={`${plural(documents.length, 'document')}, ${ready} ready to query. Upload and remove documents from inside the workspace.`}
                      >
                        {documents.length === 0 ? (
                          <p className="text-[13.5px] text-[#9a9a9a]">
                            Nothing here yet.{' '}
                            <Link href={openHref} className={`text-[#e6e6e6] underline underline-offset-2 ${focusRing}`}>
                              Open the workspace
                            </Link>{' '}
                            to add your first document.
                          </p>
                        ) : (
                          <ListBox>
                            {documents.map((doc) => (
                              <ListRow
                                key={doc.id}
                                title={doc.title}
                                meta={formatShortDate(doc.uploaded_at)}
                                end={<Pill state={docState(doc.status)} />}
                              />
                            ))}
                          </ListBox>
                        )}
                      </Section>

                      <Section title="Conversations" description={plural(conversations.length, 'chat') + ' in this workspace.'}>
                        {conversations.length === 0 ? (
                          <p className="text-[13.5px] text-[#9a9a9a]">No chats yet. Ask your first question from the workspace.</p>
                        ) : (
                          <ListBox>
                            {conversations.map((conv) => (
                              <ListRow key={conv.id} title={conv.title || 'Untitled conversation'} meta={formatShortDate(conv.updated_at)} />
                            ))}
                          </ListBox>
                        )}
                      </Section>
                    </>
                  )}

                  {tab === 'delete' && (
                    <Section
                      title="Delete workspace"
                      description={`This permanently removes the workspace, its ${plural(documents.length, 'document')} and ${plural(conversations.length, 'chat')}. This cannot be undone.`}
                    >
                      <div className="max-w-[520px]">
                        <label htmlFor="ws-confirm" className="mb-1.5 block text-[12.5px] text-[#a5a5a5]">
                          Type <span className="font-medium text-[#e6e6e6]">{currentTitle}</span> to confirm
                        </label>
                        <input
                          id="ws-confirm"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          disabled={deleting}
                          autoComplete="off"
                          spellCheck={false}
                          className={`${inputCls} focus:!border-[#b3362f]`}
                        />
                        {deleteError && (
                          <p role="alert" className="mt-1.5 text-[12.5px] text-[#f08a84]">
                            {deleteError}
                          </p>
                        )}
                        <div className="mt-4">
                          <Btn
                            variant="danger"
                            label={deleting ? 'DELETING' : 'DELETE WORKSPACE'}
                            disabled={confirmText.trim() !== currentTitle || deleting}
                            onClick={() => void remove()}
                          />
                        </div>
                      </div>
                    </Section>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default WorkspaceSettings