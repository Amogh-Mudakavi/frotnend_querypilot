'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, BookOpen, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { authApi, workspaceApi, type Workspace } from '@/lib/django-api'

const ACTIVE_WORKSPACE_KEY = 'querypilot_active_workspace_id'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function selectWorkspace(id: number) {
  sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, String(id))
}

const WORKSPACE_NAME_MAX_LENGTH = 120

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

function validateWorkspaceName(raw: string): string | null {
  const trimmed = raw.trim()

  if (!trimmed) {
    return 'Give your notebook a name.'
  }

  if (trimmed.length > WORKSPACE_NAME_MAX_LENGTH) {
    return `Keep it under ${WORKSPACE_NAME_MAX_LENGTH} characters.`
  }

  if (CONTROL_CHARS_PATTERN.test(trimmed)) {
    return 'That name contains characters that aren\u2019t allowed.'
  }

  return null
}

export function NotebookHome() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const items = await workspaceApi.list()
      setWorkspaces(items)
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

  const createNotebook = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = title.trim()

    const validationError = validateWorkspaceName(title)
    if (validationError) {
      setTitleError(validationError)
      return
    }

    setCreating(true)
    setError('')
    setTitleError('')
    try {
      const workspace = await workspaceApi.create(name)
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

  const openNotebook = (workspace: Workspace) => {
    selectWorkspace(workspace.id)
    router.push(`/workspaces/${workspace.id}`)
  }

  const removeNotebook = async (workspace: Workspace) => {
    const confirmed = window.confirm(
      `Delete “${workspace.title}”? This removes the workspace, its documents, and its conversations.`,
    )
    if (!confirmed) return

    try {
      await workspaceApi.remove(workspace.id)
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id))
      if (sessionStorage.getItem(ACTIVE_WORKSPACE_KEY) === String(workspace.id)) {
        sessionStorage.removeItem(ACTIVE_WORKSPACE_KEY)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <main className="min-h-screen bg-[#202327] text-[#f4f6f8]">
      <div className="mx-auto max-w-[1500px] px-6 py-8 md:px-10 md:py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d98a4]">
              QueryPilot
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-[-0.04em] md:text-[40px]">
              My notebooks
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#1f2226] transition hover:bg-[#f0f1f3]"
          >
            <Plus size={16} />
            Create new notebook
          </button>
        </header>

        {error && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="font-medium underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-[50vh] place-items-center rounded-2xl border border-[#30353b] bg-[#23272c] text-sm text-[#8d98a4]">
            Loading your notebooks…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group flex min-h-[225px] flex-col items-center justify-center rounded-2xl border border-[#353a40] bg-transparent px-6 text-center transition hover:border-[#4a5159] hover:bg-[#25292e]"
            >
              <span className="grid size-16 place-items-center rounded-full bg-[#2d3555] text-[#cfd7ff] transition group-hover:scale-105">
                <Plus size={28} strokeWidth={1.8} />
              </span>
              <span className="mt-5 text-lg font-medium">Create new notebook</span>
            </button>

            {workspaces.map((workspace) => (
              <article
                key={workspace.id}
                className="group relative min-h-[225px] rounded-2xl border border-[#353a40] bg-[#343742] p-6 text-left transition hover:-translate-y-0.5 hover:border-[#4a5159] hover:bg-[#393c48]"
              >
                <button
                  type="button"
                  onClick={() => openNotebook(workspace)}
                  className="flex w-full flex-col items-start text-left"
                >
                  <div className="flex w-full items-start justify-between">
                    <span className="grid size-12 place-items-center rounded-xl bg-[#414552] text-[#f6b657]">
                      <BookOpen size={25} strokeWidth={1.8} />
                    </span>
                    <ArrowUpRight size={18} className="text-[#99a1ad] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>

                  <h2 className="mt-7 max-w-full truncate text-xl font-medium tracking-[-0.02em]">
                    {workspace.title}
                  </h2>
                  <p className="mt-1 text-xs text-[#a4acb7]">
                    Updated {new Date(workspace.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="mt-auto pt-8 text-sm font-medium text-white">Open notebook</div>
                </button>

                <button
                  type="button"
                  onClick={() => void removeNotebook(workspace)}
                  aria-label={`Delete ${workspace.title}`}
                  className="absolute bottom-5 right-5 grid size-8 place-items-center rounded-lg text-[#8f98a5] opacity-0 transition hover:bg-black/20 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-5">
          <div className="w-full max-w-md rounded-2xl border border-[#3b4148] bg-[#272b30] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d98a4]">New notebook</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.03em]">Create a notebook</h2>
                <p className="mt-2 text-sm leading-6 text-[#aeb6c1]">Your sources and conversations will live inside this workspace.</p>
              </div>
              <button type="button" onClick={() => { setModalOpen(false); setTitleError('') }} className="rounded-lg p-2 text-[#a0a8b3] hover:bg-white/5 hover:text-white">×</button>
            </div>

            <form onSubmit={createNotebook} className="mt-7">
              <label className="block text-xs font-medium text-[#d8dde4]">Notebook name</label>
              <input
                autoFocus
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  if (titleError) setTitleError('')
                }}
                placeholder="e.g. HR Policies"
                maxLength={WORKSPACE_NAME_MAX_LENGTH}
                aria-invalid={Boolean(titleError)}
                className="mt-2 w-full rounded-xl border border-[#41474f] bg-[#1e2226] px-4 py-3 text-sm outline-none placeholder:text-[#707984] focus:border-[#7884ff]"
              />
              {titleError && (
                <p className="mt-2 text-xs text-red-300">{titleError}</p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => { setModalOpen(false); setTitleError('') }} className="rounded-xl border border-[#41474f] px-4 py-2.5 text-sm text-[#d2d7de] hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={!title.trim() || creating} className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#1f2226] disabled:cursor-not-allowed disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}