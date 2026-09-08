const API_BASE_URL =
  process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://127.0.0.1:8000'

export type AuthTokens = {
  access_token: string
  refresh_token: string
}

export type AuthTokenInput =
  | AuthTokens
  | {
      access: string
      refresh: string
    }

export type ApiErrorPayload = unknown

export type ApiError = Error & {
  status?: number
  code?: string
  data?: unknown
  fieldErrors?: Record<string, string[]>
}

export type User = {
  id: number
  username: string
  email: string
  role: string
}

export type Workspace = {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export type Conversation = {
  id: number
  title: string
  workspace: number
  created_by: number
  created_at: string
  updated_at: string
}

export type Message = {
  id: number
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | string
  content: string
  created_at: string
}

export type ConversationDetail = Conversation & {
  messages: Message[]
}

export type Document = {
  id: number
  title: string
  source_type: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | string
  uploaded_at: string
}

export type DocumentStatus = {
  document_id: number
  status: string
  ingestion_job_id?: number
  job_status?: string
  attempts?: number
  error_message?: string | null
}

export type DocumentUploadResponse = {
  message: string
  document_id: number
  ingestion_job_id?: number
  conversation_id?: number
  status: string
  duplicate: boolean
}

export type ChatSource = {
  document_id: number
  document_name: string
  source_type: string
  chunk_index?: number
  page_start?: number
  page_end?: number
  heading?: string
  table_name?: string
}

export type ChatCompleteData = {
  answer?: string
  route?: string
  grounding_passed?: boolean | null
  sources?: ChatSource[]
  conversation_title?: string
  status?: string
  retry_after_seconds?: number
}

export type SseEvent = {
  event: string
  message?: string
  data?: Record<string, unknown>
}

const tokenStore = {
  get(key: 'access_token' | 'refresh_token') {
    if (typeof window === 'undefined') {
      return null
    }

    const value = localStorage.getItem(`querypilot_${key}`)

    if (value === 'undefined' || value === 'null' || value === '') {
      return null
    }

    return value
  },

  set(tokens: AuthTokenInput) {
    if (typeof window === 'undefined') {
      return
    }

    const access_token =
      'access_token' in tokens
        ? tokens.access_token
        : tokens.access

    const refresh_token =
      'refresh_token' in tokens
        ? tokens.refresh_token
        : tokens.refresh

    if (!access_token || !refresh_token) {
      throw new Error(
        'Login succeeded but no usable JWT tokens were returned.',
      )
    }

    localStorage.setItem(
      'querypilot_access_token',
      access_token,
    )

    localStorage.setItem(
      'querypilot_refresh_token',
      refresh_token,
    )
  },

  clear() {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.removeItem('querypilot_access_token')
    localStorage.removeItem('querypilot_refresh_token')
    // Pending-email is short-lived, single-tab signup→OTP handoff data (set/read
    // directly by auth-pages.tsx), not an auth token — it intentionally stays in
    // sessionStorage and is unrelated to the cross-tab fix above.
    sessionStorage.removeItem('querypilot_pending_email')
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectMessages(
  value: unknown,
  messages: string[] = [],
) {
  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (trimmed) {
      messages.push(trimmed)
    }

    return messages
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMessages(item, messages)
    }

    return messages
  }

  if (isRecord(value)) {
    for (const nestedValue of Object.values(value)) {
      collectMessages(nestedValue, messages)
    }
  }

  return messages
}

function extractFieldErrors(
  data: unknown,
): Record<string, string[]> | undefined {
  if (!isRecord(data)) {
    return undefined
  }

  const candidate = data.error

  if (!isRecord(candidate)) {
    return undefined
  }

  const fieldErrors: Record<string, string[]> = {}

  for (const [field, value] of Object.entries(candidate)) {
    const messages = collectMessages(value)

    if (messages.length > 0) {
      fieldErrors[field] = messages
    }
  }

  return Object.keys(fieldErrors).length > 0
    ? fieldErrors
    : undefined
}

function getErrorMessage(
  data: unknown,
  status: number,
): string {
  if (typeof data === 'string' && data.trim()) {
    return data.trim()
  }

  if (isRecord(data)) {
    if (
      typeof data.detail === 'string' &&
      data.detail.trim()
    ) {
      return data.detail.trim()
    }

    if (
      typeof data.message === 'string' &&
      data.message.trim()
    ) {
      return data.message.trim()
    }

    if (
      typeof data.error === 'string' &&
      data.error.trim()
    ) {
      return data.error.trim()
    }

    const fieldErrors = extractFieldErrors(data)

    if (fieldErrors) {
      const messages = Object.values(fieldErrors).flat()

      if (messages.length > 0) {
        return messages.join(' ')
      }
    }

    const messages = collectMessages(data)

    if (messages.length > 0) {
      return messages.join(' ')
    }
  }

  return `Request failed (${status})`
}

function createApiError(
  data: unknown,
  status: number,
): ApiError {
  const error = new Error(
    getErrorMessage(data, status),
  ) as ApiError

  error.status = status
  error.data = data
  error.fieldErrors = extractFieldErrors(data)

  return error
}

async function parseJsonSafely(
  response: Response,
): Promise<unknown> {
  const contentType =
    response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const refresh_token =
      tokenStore.get('refresh_token')

    if (!refresh_token) {
      return false
    }

    let response: Response

    try {
      response = await fetch(
        `${API_BASE_URL}/api/auth/refresh/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token,
          }),
        },
      )
    } catch {
      return false
    }

    const data =
      await parseJsonSafely(response)

    if (!response.ok || !isRecord(data)) {
      return false
    }

    if (
      typeof data.access_token !== 'string' ||
      typeof data.refresh_token !== 'string'
    ) {
      return false
    }

    tokenStore.set({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })

    return true
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers)

  const access_token =
    tokenStore.get('access_token')

  if (access_token) {
    headers.set(
      'Authorization',
      `Bearer ${access_token}`,
    )
  }

  if (!(init.body instanceof FormData)) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  let response: Response

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...init,
        headers,
      },
    )
  } catch {
    const error = new Error(
      'Unable to reach the server. Please check your connection and try again.',
    ) as ApiError

    error.code = 'NETWORK_ERROR'

    throw error
  }

  if (
    response.status === 401 &&
    retry
  ) {
    const refreshed =
      await refreshAccessToken()

    if (refreshed) {
      return apiFetch<T>(
        path,
        init,
        false,
      )
    }
  }

  const data =
    await parseJsonSafely(response)

  if (!response.ok) {
    if (response.status === 401) {
      tokenStore.clear()
    }

    throw createApiError(
      data,
      response.status,
    )
  }

  return data as T
}

async function parseSseBlock(
  block: string,
): Promise<SseEvent | null> {
  const lines =
    block.split(/\r?\n/)

  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line
        .slice('event:'.length)
        .trim()

      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(
        line
          .slice('data:'.length)
          .trimStart(),
      )
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  const rawData =
    dataLines.join('\n')

  try {
    const parsed =
      JSON.parse(rawData)

    if (isRecord(parsed)) {
      const nestedData =
        isRecord(parsed.data)
          ? parsed.data
          : undefined

      return {
        event: eventName,
        message:
          typeof parsed.message ===
          'string'
            ? parsed.message
            : undefined,
        data: nestedData,
      }
    }

    return {
      event: eventName,
      message: rawData,
    }
  } catch {
    return {
      event: eventName,
      message: rawData,
    }
  }
}

export async function streamChat(
  payload: {
    conversation_id: number
    message: string
  },
  onEvent: (event: SseEvent) => void,
  options?: {
    signal?: AbortSignal
  },
): Promise<void> {
  const send = async (
    retry: boolean,
  ): Promise<Response> => {
    let access_token =
      tokenStore.get('access_token')

    if (!access_token) {
      const refreshed =
        await refreshAccessToken()

      if (refreshed) {
        access_token =
          tokenStore.get(
            'access_token',
          )
      }
    }

    if (!access_token) {
      const authError =
        new Error(
          'You are not authenticated. Please log in again.',
        ) as ApiError

      authError.status = 401
      authError.code =
        'AUTH_REQUIRED'

      throw authError
    }

    let response: Response

    try {
      response = await fetch(
        `${API_BASE_URL}/api/chat/messages/stream/`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept:
              'text/event-stream',
            Authorization:
              `Bearer ${access_token}`,
          },
          body: JSON.stringify(payload),
          signal: options?.signal,
        },
      )
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error
      }

      const networkError =
        new Error(
          'Unable to reach the chat service. Please check your connection and try again.',
        ) as ApiError

      networkError.code =
        'NETWORK_ERROR'

      throw networkError
    }

    if (
      response.status === 401 &&
      retry
    ) {
      const refreshed =
        await refreshAccessToken()

      if (refreshed) {
        return send(false)
      }
    }

    return response
  }

  const response =
    await send(true)

  if (!response.ok) {
    const data =
      await parseJsonSafely(response)

    if (
      response.status === 401
    ) {
      tokenStore.clear()
    }

    throw createApiError(
      data,
      response.status,
    )
  }

  if (!response.body) {
    const error =
      new Error(
        'The chat service returned an empty response.',
      ) as ApiError

    error.code =
      'EMPTY_STREAM'

    throw error
  }

  const reader =
    response.body.getReader()

  const decoder =
    new TextDecoder()

  let buffer = ''

  try {
    while (true) {
      const {
        value,
        done,
      } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(
        value,
        { stream: true },
      )

      const blocks =
        buffer.split(
          /\r?\n\r?\n/,
        )

      buffer =
        blocks.pop() || ''

      for (const block of blocks) {
        const event =
          await parseSseBlock(
            block,
          )

        if (event) {
          onEvent(event)
        }
      }
    }

    buffer += decoder.decode()

    if (buffer.trim()) {
      const event =
        await parseSseBlock(
          buffer,
        )

      if (event) {
        onEvent(event)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const authApi = {
  login: (payload: {
    email: string
    password: string
  }) =>
    apiFetch<AuthTokens>(
      '/api/auth/login/',
      {
        method: 'POST',
        body: JSON.stringify(
          payload,
        ),
      },
    ),

  register: (payload: {
    username: string
    email: string
    password: string
  }) =>
    apiFetch<{ message: string }>(
      '/api/auth/register/',
      {
        method: 'POST',
        body: JSON.stringify(
          payload,
        ),
      },
    ),

  verifyOtp: (payload: {
    email: string
    otp: string
  }) =>
    apiFetch<{ message: string }>(
      '/api/auth/verify-otp/',
      {
        method: 'POST',
        body: JSON.stringify(
          payload,
        ),
      },
    ),

  forgotPassword: (payload: {
    email: string
  }) =>
    apiFetch<{ message: string }>(
      '/api/auth/forgot-password/',
      {
        method: 'POST',
        body: JSON.stringify(
          payload,
        ),
      },
    ),

  resetPassword: (payload: {
    email: string
    otp: string
    new_password: string
  }) =>
    apiFetch<{ message: string }>(
      '/api/auth/reset-password/',
      {
        method: 'POST',
        body: JSON.stringify(
          payload,
        ),
      },
    ),

  me: () =>
    apiFetch<User>(
      '/api/auth/me/',
    ),

  logout: async () => {
    const refresh_token =
      tokenStore.get(
        'refresh_token',
      )

    try {
      return await apiFetch<{
        message: string
      }>(
        '/api/auth/logout/',
        {
          method: 'POST',
          body: JSON.stringify({
            refresh_token,
          }),
        },
      )
    } finally {
      tokenStore.clear()
    }
  },

  saveTokens:
    tokenStore.set,

  clearTokens:
    tokenStore.clear,

  hasAccess: () =>
    Boolean(
      tokenStore.get(
        'access_token',
      ),
    ),
}

export const workspaceApi = {
  list: () =>
    apiFetch<Workspace[]>(
      '/api/workspaces/',
    ),

  create: (
    title: string,
  ) =>
    apiFetch<Workspace>(
      '/api/workspaces/create/',
      {
        method: 'POST',
        body: JSON.stringify({
          title,
        }),
      },
    ),

  remove: (
    id: number,
  ) =>
    apiFetch<void>(
      `/api/workspaces/${id}/`,
      {
        method: 'DELETE',
      },
    ),
}

export const documentApi = {
  list: (
    workspaceId: number,
  ) =>
    apiFetch<Document[]>(
      `/api/documents/?workspace_id=${workspaceId}`,
    ),

  upload: (
    workspaceId: number,
    file: File,
  ) => {
    const body =
      new FormData()

    body.append(
      'workspace_id',
      String(
        workspaceId,
      ),
    )

    body.append(
      'file',
      file,
    )

    return apiFetch<DocumentUploadResponse>(
      '/api/documents/upload/',
      {
        method: 'POST',
        body,
      },
    )
  },

  status: (
    id: number,
  ) =>
    apiFetch<DocumentStatus>(
      `/api/documents/${id}/status/`,
    ),

  remove: (
    id: number,
  ) =>
    apiFetch<{
      message: string
    }>(
      `/api/documents/${id}/`,
      {
        method: 'DELETE',
      },
    ),
}

export const chatApi = {
  conversations: (
    workspaceId: number,
  ) =>
    apiFetch<Conversation[]>(
      `/api/chat/conversations/?workspace_id=${workspaceId}`,
    ),

  conversation: (
    id: number,
  ) =>
    apiFetch<ConversationDetail>(
      `/api/chat/conversations/${id}/`,
    ),

  createConversation: (
    workspaceId: number,
  ) =>
    apiFetch<Conversation>(
      '/api/chat/conversations/',
      {
        method: 'POST',
        body: JSON.stringify({
          workspace_id:
            workspaceId,
        }),
      },
    ),
}

export { tokenStore }