'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Loader2, MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { chatApi, type Conversation, type ConversationSettings } from '@/lib/django-api';
import { focusRing } from '@/components/chat-ui';

/* -------------------------------------------------------------------------- */
/*  Chat settings page                                                         */
/*  Settings belong to one chat, so pick a chat on the left and change its     */
/*  switches on the right. Every switch saves as soon as it is flipped.        */
/* -------------------------------------------------------------------------- */

type SettingKey = 'memory_enabled' | 'citations_enabled';

const ROWS: Array<{ key: SettingKey; title: string; hint: string }> = [
  {
    key: 'memory_enabled',
    title: 'Chat memory',
    hint: 'Use earlier messages in this chat as context when answering follow-up questions.',
  },
  {
    key: 'citations_enabled',
    title: 'Show sources',
    hint: 'Show the documents and passages behind each answer, with numbered citations.',
  },
];

const scrollbar = '[scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]';

const DEFAULT_TITLE = /^new (chat|research query)$/i;
const chatTitle = (title?: string | null) =>
  !title || !title.trim() || DEFAULT_TITLE.test(title.trim()) ? 'New chat' : title.trim();

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative mt-0.5 h-5 w-9 flex-none rounded-full transition-colors duration-150 motion-reduce:transition-none ${
        on ? 'bg-zinc-200' : 'bg-white/[0.14]'
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full transition-all duration-150 motion-reduce:transition-none ${
          on ? 'left-[18px] bg-zinc-950' : 'left-0.5 bg-zinc-400'
        }`}
      />
    </span>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ChatSettingsPage() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const searchParams = useSearchParams();
  const workspaceId = Number(params?.workspaceId);
  const requestedChat = Number(searchParams.get('chat'));

  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [settingsMap, setSettingsMap] = useState<Record<number, ConversationSettings>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');

  const mapRef = useRef(settingsMap);
  mapRef.current = settingsMap;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The workspace's chats.
  useEffect(() => {
    if (!Number.isFinite(workspaceId)) return;
    let cancelled = false;
    chatApi
      .conversations(workspaceId)
      .then((list) => {
        if (cancelled) return;
        setChats(list);
        setSelectedId((current) => {
          if (current !== null) return current;
          if (list.some((chat) => chat.id === requestedChat)) return requestedChat;
          return list[0]?.id ?? null;
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setChats([]);
        setError(errorText(err));
      });
    return () => {
      cancelled = true;
    };
    // requestedChat only decides the first selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Settings of the selected chat (fetched once per chat, then kept).
  useEffect(() => {
    if (selectedId === null || mapRef.current[selectedId]) return;
    let cancelled = false;
    setLoadingSettings(true);
    chatApi
      .settings(selectedId)
      .then((value) => {
        if (!cancelled) setSettingsMap((map) => ({ ...map, [selectedId]: value }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingSettings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const selectChat = (id: number) => {
    setSelectedId(id);
    setError('');
    router.replace(`/workspaces/${workspaceId}/chat-settings?chat=${id}`, { scroll: false });
  };

  const current = selectedId !== null ? settingsMap[selectedId] : undefined;
  const selectedChat = chats?.find((chat) => chat.id === selectedId) ?? null;

  // Flip right away, save, and put it back if the server says no.
  const toggle = async (key: SettingKey) => {
    if (selectedId === null || !current || saving) return;
    const id = selectedId;
    const previous = current;
    const next = { ...previous, [key]: !previous[key] };
    setSettingsMap((map) => ({ ...map, [id]: next }));
    setSaving(true);
    setJustSaved(false);
    setError('');
    try {
      const saved = await chatApi.updateSettings(id, { [key]: next[key] });
      setSettingsMap((map) => ({ ...map, [id]: saved }));
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
    } catch (err) {
      setSettingsMap((map) => ({ ...map, [id]: previous }));
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const backHref = selectedId !== null ? `/workspaces/${workspaceId}/chat/${selectedId}` : `/workspaces/${workspaceId}/chat`;

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-16 pt-6 font-sans sm:px-6 lg:pt-10">
      <Link
        href={backHref}
        className={`-ml-2 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[16px] text-zinc-400 transition-colors duration-150 hover:bg-white/[0.05] hover:text-zinc-100 motion-reduce:transition-none ${focusRing}`}
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Back to chat
      </Link>

      <header className="mt-4">
        <h1 className="text-[24px] font-medium leading-[1.2] tracking-tight text-zinc-50 sm:text-[28px]">
          Chat settings
        </h1>
        <p className="mt-2 max-w-2xl text-[16px] leading-6 text-zinc-400">
          Choose how each chat behaves. Changes save automatically and only affect the chat you pick.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg bg-red-500/[0.08] px-3.5 py-2.5 text-[16px] leading-5 text-red-200 ring-1 ring-inset ring-red-500/20"
        >
          {error}
        </div>
      )}

      {chats === null ? (
        <div className="mt-10 flex items-center gap-2 text-[16px] text-zinc-500">
          <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
          <span>Loading chats…</span>
        </div>
      ) : chats.length === 0 ? (
        <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.015] p-6">
          <p className="text-[16px] font-medium text-zinc-100">No chats yet</p>
          <p className="mt-1 text-[16px] leading-6 text-zinc-400">
            Ask a question in a new chat first. Its settings will show up here.
          </p>
          <Link
            href={`/workspaces/${workspaceId}/chat`}
            className={`mt-4 inline-flex h-10 items-center rounded-lg bg-zinc-100 px-4 text-[16px] font-medium text-zinc-950 transition-colors duration-150 hover:bg-white motion-reduce:transition-none ${focusRing}`}
          >
            Start a chat
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          {/* Chat picker */}
          <section aria-label="Chats">
            <p className="mb-2 text-[13px] font-medium text-zinc-500">Chats</p>
            <ul
              className={`max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-white/[0.08] bg-white/[0.015] p-1.5 md:max-h-[480px] ${scrollbar}`}
            >
              {chats.map((chat) => {
                const active = chat.id === selectedId;
                return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => selectChat(chat.id)}
                      title={chatTitle(chat.title)}
                      className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[16px] transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
                        active
                          ? 'bg-white/[0.08] text-white'
                          : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <MessageSquare size={15} strokeWidth={1.75} className="flex-none text-zinc-500" />
                      <span className="min-w-0 flex-1 truncate">{chatTitle(chat.title)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Settings of the picked chat */}
          <section aria-label="Settings for the selected chat">
            <div className="mb-2 flex h-5 items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[13px] font-medium text-zinc-500">
                {selectedChat ? `Settings for “${chatTitle(selectedChat.title)}”` : 'Settings'}
              </p>
              <span role="status" aria-live="polite" className="flex flex-none items-center gap-1.5 text-[13px] text-zinc-500">
                {saving ? (
                  <>
                    <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
                    Saving…
                  </>
                ) : justSaved ? (
                  <>
                    <Check size={13} strokeWidth={2.2} />
                    Saved
                  </>
                ) : null}
              </span>
            </div>

            <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-white/[0.015]">
              {ROWS.map((row) => {
                const on = current ? current[row.key] : false;
                return (
                  <button
                    key={row.key}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={!current || saving}
                    onClick={() => void toggle(row.key)}
                    className={`flex w-full items-start justify-between gap-6 p-4 text-left transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[16px] font-medium leading-5 text-zinc-100">{row.title}</span>
                      <span className="mt-1 block text-[13px] leading-5 text-zinc-400">{row.hint}</span>
                    </span>
                    {loadingSettings && !current ? (
                      <Loader2 size={15} className="mt-0.5 flex-none animate-spin text-zinc-500 motion-reduce:animate-none" />
                    ) : (
                      <Switch on={on} />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedChat && (
              <p className="mt-3 text-[13px] leading-5 text-zinc-500">
                Started {formatWhen(selectedChat.created_at)}
                {current?.updated_at ? ` · Settings changed ${formatWhen(current.updated_at)}` : ''}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default ChatSettingsPage;