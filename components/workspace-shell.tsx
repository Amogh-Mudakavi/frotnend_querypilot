'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Compass,
  Folder,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

import {
  authApi,
  chatApi,
  documentApi,
  workspaceApi,
  type Conversation,
  type Document,
  type User,
  type Workspace,
} from '@/lib/django-api';
import { QpGlobalStyles } from '@/components/qp-ui';
import {
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuStyles,
  MenuTrigger,
  fileKind,
  focusRing,
} from '@/components/chat-ui';
import { AddSourceDialog, WorkspaceTour } from '@/components/workspace-tour';
import { WorkspaceUiProvider, type ResearchOptions } from '@/components/workspace-ui-context';

const ACTIVE_WORKSPACE_KEY = 'querypilot_active_workspace_id';
const COLLAPSED_KEY = 'querypilot_sidebar_collapsed';
const ONBOARDING_PREFIX = 'querypilot_source_onboarding_seen_';
const PINNED_PREFIX = 'querypilot_pinned_chats_';
const TITLE_PREFIX = 'querypilot_workspace_title_';
const WIDTH_KEY = 'querypilot_sidebar_width';
const SIDEBAR_DEFAULT = 336;
const SIDEBAR_MIN = 248;
const SIDEBAR_MAX = 480;
const SIDEBAR_COLLAPSE_AT = 180; // dragging the edge below this snaps to the icon rail

// The Web / Fast research toggles were removed from the UI. The context still expects the value.
const NO_RESEARCH: ResearchOptions = { web: false, fast: false };

const POLL_INTERVALS_MS = [1500, 1500, 3000, 3000, 6000, 10000, 15000];
const POLL_MAX_DURATION_MS = 10 * 60 * 1000;

/** An untitled chat younger than this might still be waiting for its first message, so it is left alone. */
const EMPTY_CHAT_GRACE_MS = 5 * 60 * 1000;

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/* -------------------------------------------------------------------------- */
/*  Data helpers                                                               */
/* -------------------------------------------------------------------------- */

const isPending = (d: Document) => d.status === 'pending' || d.status === 'processing';
const isFailed = (d: Document) => ['failed', 'error'].includes(String(d.status));

// Document field names differ between backends, so read the name defensively.
function docName(d: Document) {
  const record = d as unknown as Record<string, unknown>;
  for (const key of ['title', 'name', 'file_name', 'filename', 'original_filename']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'Untitled source';
}

const DEFAULT_TITLE = /^new (chat|research query)$/i;
const isDefaultTitle = (title?: string | null) => !title || !title.trim() || DEFAULT_TITLE.test(title.trim());
const displayTitle = (title?: string | null) => (isDefaultTitle(title) ? 'New chat' : String(title).trim());

/** Untitled and the API says it has no messages: an empty leftover. Needs `message_count` on the conversation. */
function isEmptyUntitled(c: Conversation) {
  const count = (c as unknown as Record<string, unknown>).message_count;
  return isDefaultTitle(c.title) && typeof count === 'number' && count === 0;
}

type ChatGroup = { label: string; items: Conversation[] };

/** Calendar-day buckets (not rolling 24h), with pinned chats first. */
function groupConversations(items: Conversation[], pinned: ReadonlySet<number>): ChatGroup[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const day = 86_400_000;

  const buckets: ChatGroup[] = [
    { label: 'Pinned', items: [] },
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  const byRecent = [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  for (const item of byRecent) {
    const time = new Date(item.updated_at).getTime();
    if (pinned.has(item.id)) buckets[0].items.push(item);
    else if (time >= today) buckets[1].items.push(item);
    else if (time >= today - day) buckets[2].items.push(item);
    else if (time >= today - 7 * day) buckets[3].items.push(item);
    else buckets[4].items.push(item);
  }
  return buckets.filter((bucket) => bucket.items.length > 0);
}

const scrollbar = '[scrollbar-color:rgba(255,255,255,0.1)_transparent] [scrollbar-width:thin]';

/** Soft fade on the right edge of long titles instead of a hard "…" cut. */
const FADE =
  '[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] [-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)]';

/** One row style for plain sidebar rows: workspace switcher, chat rows, nav items. */
const ROW =
  'flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[16px] transition-colors duration-150 motion-reduce:transition-none';

/** Hover-only actions stay visible on touch screens, where there is no hover. */
const REVEAL =
  'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 data-[state=open]:!opacity-100';

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Full-screen message for crashes and sign-out. It uses the same background (#181818), font (Geist via
 * font-sans), text rendering (antialiased) and text colours as the workspace, so an error never looks
 * like a different app. `fixed inset-0` covers the whole viewport and centres the message properly.
 */
function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#181818] px-6 text-center font-sans text-[#f2f2f2] antialiased">
      <QpGlobalStyles />
      {children}
    </div>
  );
}

/**
 * iOS-style reload indicator. It drops in from the top while the workspace loads and
 * slides back out when done. It never blocks the page: the layout stays visible underneath.
 * Swap the inner span for your own orb component if you have one.
 */
function ThinkingOrb({ visible }: { visible: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={visible ? 'Loading workspace' : undefined}
      aria-hidden={!visible}
      className={`pointer-events-none fixed left-1/2 top-[calc(3.75rem+env(safe-area-inset-top))] z-40 -translate-x-1/2 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none lg:top-5 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
      }`}
    >
      <span className="relative grid size-9 place-items-center rounded-full bg-[#2a2a2a] shadow-lg shadow-black/40 ring-1 ring-inset ring-white/10">
        <span className="absolute size-5 rounded-full bg-zinc-200/30 animate-ping [animation-duration:1.6s] motion-reduce:animate-none" />
        <span className="relative size-3.5 rounded-full bg-gradient-to-br from-zinc-50 to-zinc-400 animate-pulse [animation-duration:1.2s] motion-reduce:animate-none" />
      </span>
    </div>
  );
}

function InlineRename({
  value,
  label,
  onCommit,
  onDone,
  className = '',
}: {
  value: string;
  label: string;
  onCommit: (title: string) => void;
  onDone: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        commit();
        onDone();
      }}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          onDone();
        }
      }}
      aria-label={label}
      spellCheck={false}
      maxLength={80}
      className={`w-full min-w-0 rounded-lg bg-white/[0.05] px-2.5 text-[16px] text-zinc-50 outline-none ring-1 ring-white/[0.18] ${className}`}
    />
  );
}

type DotState = 'ready' | 'indexing' | 'failed';

/**
 * Monochrome status: "in context" is a bright dot that softly pings, indexing is a
 * dim pulsing dot, failed is the only coloured state (red, because it is an error).
 */
function StatusDot({ state }: { state: DotState }) {
  const color = { ready: 'bg-zinc-200', indexing: 'bg-zinc-500', failed: 'bg-red-400' }[state];
  return (
    <span className="relative flex size-2 flex-none" aria-hidden="true">
      {state === 'ready' && (
        <span className="absolute inset-0 rounded-full bg-zinc-200 opacity-40 animate-ping [animation-duration:2.4s] motion-reduce:animate-none" />
      )}
      <span
        className={`relative size-2 rounded-full ${color} ${
          state === 'indexing' ? 'animate-pulse motion-reduce:animate-none' : ''
        }`}
      />
    </span>
  );
}

/** Initial on a flat grey disc. */
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="grid flex-none place-items-center rounded-full bg-zinc-800 text-[14px] font-medium text-zinc-200 ring-1 ring-inset ring-white/10"
    >
      {(name.trim()[0] ?? 'A').toUpperCase()}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Workspace switcher                                                         */
/* -------------------------------------------------------------------------- */

function WorkspaceSelector({
  workspaceId,
  title,
  onRename,
  onOpenSettings,
  onNavigate,
}: {
  workspaceId: number;
  title: string;
  onRename: (title: string) => void;
  onOpenSettings: () => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [items, setItems] = useState<Workspace[]>([]);
  const renameRequested = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    workspaceApi
      .list()
      .then((list: Workspace[]) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        /* the current workspace is still shown */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (renaming) {
    return (
      <InlineRename
        value={title}
        label="Workspace name"
        onCommit={onRename}
        onDone={() => setRenaming(false)}
        className="h-10"
      />
    );
  }

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger asChild>
        <button
          type="button"
          title={title}
          className={`${ROW} text-zinc-100 hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06] ${focusRing}`}
        >
          <Folder size={20} strokeWidth={1.5} className="flex-none text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className={`flex-none text-zinc-500 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </MenuTrigger>

      <MenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)]"
        onCloseAutoFocus={(event: Event) => {
          if (renameRequested.current) {
            event.preventDefault();
            renameRequested.current = false;
          }
        }}
      >
        <MenuLabel>Workspaces</MenuLabel>
        <div className={`max-h-56 overflow-y-auto ${scrollbar}`}>
          {items.map((workspace) => (
            <MenuItem key={workspace.id} asChild onSelect={() => onNavigate?.()}>
              <Link href={`/workspaces/${workspace.id}/chat`} title={workspace.title}>
                <span className="min-w-0 flex-1 truncate">{workspace.title}</span>
                {workspace.id === workspaceId && <Check size={16} strokeWidth={1.75} className="flex-none" />}
              </Link>
            </MenuItem>
          ))}
        </div>
        <MenuSeparator />
        <MenuItem asChild onSelect={() => onNavigate?.()}>
          <Link href="/workspaces">
            <LayoutGrid size={16} strokeWidth={1.75} className="flex-none" />
            <span className="min-w-0 flex-1 truncate">All workspaces</span>
          </Link>
        </MenuItem>
        <MenuItem onSelect={onOpenSettings}>
          <Settings size={16} strokeWidth={1.75} className="flex-none" />
          <span className="min-w-0 flex-1 truncate">Chat settings</span>
        </MenuItem>
        <MenuItem
          onSelect={() => {
            renameRequested.current = true;
            setRenaming(true);
          }}
        >
          <Pencil size={16} strokeWidth={1.75} className="flex-none" />
          <span className="min-w-0 flex-1 truncate">Rename workspace</span>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sources                                                                    */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  title,
  count,
  open,
  onToggle,
  action,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-10 items-center gap-0.5 pl-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? `Collapse ${title}` : `Expand ${title}`}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-[16px] text-zinc-400 transition-colors duration-150 motion-reduce:transition-none hover:text-zinc-100 ${focusRing}`}
      >
        <span>{title}</span>
        {count ? <span className="text-[13px] tabular-nums text-zinc-500">{count}</span> : null}
      </button>
      {action}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onToggle}
        className="grid size-9 flex-none place-items-center rounded-lg text-zinc-500 transition-colors duration-150 motion-reduce:transition-none hover:text-zinc-100"
      >
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          className={`transition-transform duration-150 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
        />
      </button>
    </div>
  );
}

function SourceRow({ doc, onDelete }: { doc: Document; onDelete: (doc: Document) => void }) {
  const [confirming, setConfirming] = useState(false);
  const name = docName(doc);
  const kind = fileKind(name);
  const state: DotState = isFailed(doc) ? 'failed' : isPending(doc) ? 'indexing' : 'ready';
  const statusText = state === 'failed' ? 'Could not be processed' : state === 'indexing' ? 'Indexing…' : 'In context';
  const statusColor = state === 'failed' ? 'text-red-300' : 'text-zinc-500';

  return (
    <li className="group rounded-lg transition-colors duration-150 motion-reduce:transition-none hover:bg-white/[0.04] focus-within:bg-white/[0.04]">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className={`grid size-9 flex-none place-items-center rounded-lg ${kind.badge}`}>
          <kind.Icon size={18} strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1" title={name}>
          <span className="block truncate text-[16px] leading-5 text-zinc-100">{name}</span>
          <span className={`mt-1 flex items-center gap-2 text-[13px] leading-4 ${statusColor}`}>
            <StatusDot state={state} />
            <span className="truncate">
              {kind.label} · {statusText}
            </span>
          </span>
        </span>
        {!confirming && (
          <IconButton
            label={`Delete ${name}`}
            icon={Trash2}
            size={16}
            onClick={() => setConfirming(true)}
            className={REVEAL}
          />
        )}
      </div>

      {confirming && (
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-0.5">
          <span className="text-[16px] text-zinc-400">Delete this source?</span>
          <span className="flex gap-1.5">
            <Button variant="ghost" className="!h-8 !px-3" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              className="!h-8 !px-3 !text-red-300"
              onClick={() => {
                setConfirming(false);
                onDelete(doc);
              }}
            >
              Delete
            </Button>
          </span>
        </div>
      )}
    </li>
  );
}

function SourcesSection({
  documents,
  loading,
  onAddSource,
  onDelete,
}: {
  documents: Document[];
  loading: boolean;
  onAddSource: () => void;
  onDelete: (doc: Document) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(true);
  const pending = documents.filter(isPending).length;

  return (
    <section
      className={`flex-none px-3 pb-5 sm:px-4 ${dragging ? 'rounded-xl ring-1 ring-inset ring-white/30' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onAddSource();
      }}
    >
      <SectionHeader
        title="Sources"
        count={documents.length}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        action={
          pending > 0 ? (
            <span className="mr-1 flex items-center gap-1.5 text-[13px] text-zinc-400">
              <StatusDot state="indexing" />
              {pending} indexing
            </span>
          ) : null
        }
      />

      {open && (
        <>
          <Button variant="secondary" className="mt-1 w-full" onClick={onAddSource}>
            <Plus size={16} strokeWidth={1.75} />
            Add sources
          </Button>

          {documents.length === 0 ? (
            // While loading, show nothing instead of a wrong "No sources yet".
            loading ? null : (
              <div className="px-2.5 pt-3" title="PDF, DOCX, XLSX or CSV, up to 50 MB">
                <p className="text-[16px] leading-6 text-zinc-500">No sources yet</p>
                <p className="text-[13px] leading-5 text-zinc-500">PDF, DOCX, XLSX or CSV, up to 50 MB.</p>
              </div>
            )
          ) : (
            <ul className={`mt-2 max-h-[min(320px,36dvh)] space-y-0.5 overflow-y-auto ${scrollbar}`}>
              {documents.map((doc) => (
                <SourceRow key={doc.id} doc={doc} onDelete={onDelete} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chats                                                                      */
/* -------------------------------------------------------------------------- */

type ChatActions = {
  pinned: ReadonlySet<number>;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onTogglePin: (id: number) => void;
};

function ChatRow({
  chat,
  href,
  active,
  pinned,
  onRename,
  onDelete,
  onTogglePin,
  onNavigate,
}: {
  chat: Conversation;
  href: string;
  active: boolean;
  onNavigate?: () => void;
} & Omit<ChatActions, 'pinned'> & { pinned: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const renameRequested = useRef(false);
  const title = displayTitle(chat.title);
  const when = new Date(chat.updated_at);
  const tooltip = Number.isNaN(when.getTime()) ? title : `${title}\n${when.toLocaleString()}`;

  if (renaming) {
    return (
      <InlineRename
        value={title}
        label="Chat title"
        onCommit={(next) => onRename(chat.id, next)}
        onDone={() => setRenaming(false)}
        className="h-9"
      />
    );
  }

  if (confirming) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-lg bg-white/[0.04] pl-2.5 pr-1">
        <span className="truncate text-[16px] text-zinc-400">Delete this chat?</span>
        <span className="flex gap-1">
          <Button variant="ghost" className="!h-7 !px-2.5" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            className="!h-7 !px-2.5 !text-red-300"
            onClick={() => {
              setConfirming(false);
              onDelete(chat.id);
            }}
          >
            Delete
          </Button>
        </span>
      </div>
    );
  }

  return (
    <div className="group relative">
      <Link
        href={href}
        onClick={onNavigate}
        title={tooltip}
        aria-current={active ? 'page' : undefined}
        className={`${ROW} !h-9 pr-10 ${focusRing} ${
          active ? 'bg-white/[0.08] text-white' : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        {pinned && <Pin size={12} strokeWidth={2} className="-ml-0.5 flex-none -rotate-45 text-zinc-500" />}
        <span className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap ${FADE}`}>{title}</span>
      </Link>

      <Menu>
        <MenuTrigger asChild>
          <IconButton
            label={`Actions for ${title}`}
            icon={MoreVertical}
            size={16}
            className={`absolute right-1 top-1/2 !size-7 -translate-y-1/2 ${REVEAL}`}
          />
        </MenuTrigger>
        <MenuContent
          align="start"
          onCloseAutoFocus={(event: Event) => {
            if (renameRequested.current) {
              event.preventDefault();
              renameRequested.current = false;
            }
          }}
        >
          <MenuItem
            onSelect={() => {
              renameRequested.current = true;
              setRenaming(true);
            }}
          >
            <Pencil size={16} strokeWidth={1.75} className="flex-none" />
            Rename
          </MenuItem>
          <MenuItem onSelect={() => onTogglePin(chat.id)}>
            {pinned ? (
              <PinOff size={16} strokeWidth={1.75} className="flex-none" />
            ) : (
              <Pin size={16} strokeWidth={1.75} className="flex-none" />
            )}
            {pinned ? 'Unpin' : 'Pin'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => setConfirming(true)}>
            <Trash2 size={16} strokeWidth={1.75} className="flex-none" />
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function ChatsSection({
  pathname,
  workspaceId,
  conversations,
  total,
  loading,
  search,
  setSearch,
  searchOpen,
  setSearchOpen,
  searchRef,
  shortcut,
  onNavigate,
  actions,
}: {
  pathname: string;
  workspaceId: number;
  conversations: ChatGroup[];
  total: number;
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  shortcut: string;
  onNavigate?: () => void;
  actions: ChatActions;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="flex min-h-[200px] flex-1 flex-col px-3 sm:px-4">
      <SectionHeader title="Chats" count={total} open={open} onToggle={() => setOpen((value) => !value)} />

      {open && (
        <>
          {searchOpen && (
            <div className="relative mb-2 mt-1 flex flex-none items-center">
              <Search size={18} strokeWidth={1.5} className="pointer-events-none absolute left-3 text-zinc-500" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => {
                  if (!search.trim()) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('');
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search chats"
                aria-label="Search chats"
                spellCheck={false}
                className="h-10 w-full rounded-lg bg-white/[0.04] pl-10 pr-16 text-[16px] text-zinc-100 outline-none ring-1 ring-white/[0.06] transition-colors duration-150 placeholder:text-zinc-500 focus:bg-white/[0.06] focus:ring-white/[0.2] motion-reduce:transition-none"
              />
              <kbd className="pointer-events-none absolute right-2.5 hidden rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-zinc-500 ring-1 ring-inset ring-white/[0.08] sm:block">
                {shortcut}
              </kbd>
            </div>
          )}

          <div className={`min-h-0 flex-1 overflow-y-auto pb-3 ${scrollbar}`}>
            {conversations.length === 0 ? (
              // While loading, show nothing instead of a wrong "No chats yet".
              loading ? null : (
                <p className="px-2.5 py-2 text-[16px] leading-relaxed text-zinc-500">
                  {search.trim() ? 'No chats match your search.' : 'No chats yet. Ask a question to start one.'}
                </p>
              )
            ) : (
              <div className="space-y-4">
                {conversations.map((group) => (
                  <div key={group.label} className="space-y-0.5">
                    <p className="px-2.5 pb-1 pt-1 text-[13px] font-medium text-zinc-500">{group.label}</p>
                    {group.items.map((chat) => {
                      const href = `/workspaces/${workspaceId}/chat/${chat.id}`;
                      return (
                        <ChatRow
                          key={chat.id}
                          chat={chat}
                          href={href}
                          active={pathname === href}
                          pinned={actions.pinned.has(chat.id)}
                          onRename={actions.onRename}
                          onDelete={actions.onDelete}
                          onTogglePin={actions.onTogglePin}
                          onNavigate={onNavigate}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Profile menu: the whole footer row is the trigger. The email lives inside   */
/*  the menu, not on the row.                                                  */
/* -------------------------------------------------------------------------- */

function ProfileMenu({
  user,
  compact = false,
  loggingOut,
  onOpenSettings,
  onOpenTour,
  onLogout,
}: {
  user: User | null;
  compact?: boolean;
  loggingOut: boolean;
  onOpenSettings: () => void;
  onOpenTour: () => void;
  onLogout: () => void;
}) {
  const name = user?.username || 'Account';
  const email = user?.email || '';

  return (
    <Menu>
      <MenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Account menu"
            title={name}
            className={`rounded-full transition-opacity duration-150 hover:opacity-90 ${focusRing}`}
          >
            <Avatar name={name} size={32} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Account menu for ${name}`}
            title={email || name}
            className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 motion-reduce:transition-none hover:bg-white/[0.05] data-[state=open]:bg-white/[0.06] ${focusRing}`}
          >
            <Avatar name={name} size={32} />
            <span className="min-w-0 flex-1 truncate text-[16px] leading-5 text-zinc-100">{name}</span>
            <ChevronsUpDown size={16} strokeWidth={1.5} className="flex-none text-zinc-500 group-hover:text-zinc-300" />
          </button>
        )}
      </MenuTrigger>

      <MenuContent
        side={compact ? 'right' : 'top'}
        align={compact ? 'end' : 'start'}
        className={compact ? '' : 'w-[var(--radix-dropdown-menu-trigger-width)]'}
      >
        {email && <MenuLabel>{email}</MenuLabel>}
        <MenuItem onSelect={onOpenSettings}>
          <Settings size={16} strokeWidth={1.75} className="flex-none" />
          Chat settings
        </MenuItem>
        <MenuItem onSelect={onOpenTour}>
          <Compass size={16} strokeWidth={1.75} className="flex-none" />
          Product tour
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger disabled={loggingOut} onSelect={onLogout}>
          <LogOut size={16} strokeWidth={1.75} className="flex-none" />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                    */
/*  Expanded: brand row, workspace switcher, New chat, Sources, Chats, profile. */
/*  Compact:  a 64px icon rail with the same actions.                          */
/* -------------------------------------------------------------------------- */

type SidebarProps = {
  pathname: string;
  workspaceId: number;
  title: string;
  loading: boolean;
  onRename: (title: string) => void;
  conversations: ChatGroup[];
  chatCount: number;
  chatActions: ChatActions;
  search: string;
  setSearch: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  onOpenSearch: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  shortcut: string;
  documents: Document[];
  onCreateChat: () => void;
  onAddSource: () => void;
  onDeleteDocument: (doc: Document) => void;
  onOpenSettings: () => void;
  onOpenTour: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  user: User | null;
  /** Inside the mobile drawer: the header control closes the drawer instead of collapsing. */
  mobile?: boolean;
  /** Desktop icon rail. */
  compact?: boolean;
  onExpand?: () => void;
  onNavigate?: () => void;
  onToggleSidebar?: () => void;
};

const Logo = ({ size }: { size: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/querypilot-logo.svg" alt="" width={size} height={size} draggable={false} />
);

function WorkspaceSidebar(props: SidebarProps) {
  const { user } = props;

  // On the new-chat page nothing in the chat list is selected, so "New chat" shows as the current page.
  const draftPath = `/workspaces/${props.workspaceId}/chat`;
  const onDraft =
    props.pathname === draftPath || props.pathname === `${draftPath}/` || props.pathname === `${draftPath}/new`;

  const profile = useMemo(
    () => ({
      user,
      loggingOut: props.loggingOut,
      onOpenSettings: props.onOpenSettings,
      onOpenTour: props.onOpenTour,
      onLogout: props.onLogout,
    }),
    [user, props.loggingOut, props.onOpenSettings, props.onOpenTour, props.onLogout]
  );

  /* ----- Collapsed: icon rail ----- */
  if (props.compact) {
    const rail = '!size-10';
    return (
      <div className="flex h-full min-h-0 flex-col items-center font-sans text-zinc-200">
        <div className="flex h-14 flex-none items-center">
          <Link
            href="/"
            aria-label="QueryPilot home"
            title="QueryPilot home"
            className={`grid size-10 place-items-center rounded-lg transition-colors duration-150 motion-reduce:transition-none hover:bg-white/[0.06] ${focusRing}`}
          >
            <Logo size={26} />
          </Link>
        </div>
        <div className="flex flex-col items-center gap-1 pt-2">
          <IconButton label="Expand sidebar" icon={PanelLeftOpen} size={20} className={rail} onClick={props.onExpand} />
          <IconButton label="New chat" icon={Plus} size={20} className={rail} onClick={props.onCreateChat} />
          <IconButton label="Search chats" icon={Search} size={20} className={rail} onClick={props.onOpenSearch} />
          <IconButton label="Add sources" icon={Upload} size={20} className={rail} onClick={props.onAddSource} />
        </div>
        <div className="mt-auto flex flex-none flex-col items-center gap-2 pb-4">
          <ProfileMenu {...profile} compact />
        </div>
      </div>
    );
  }

  /* ----- Expanded ----- */
  return (
    <div className="flex h-full min-h-0 flex-col font-sans text-zinc-200">
      {/* Brand row */}
      <div className="flex flex-none items-center gap-1 pb-2 pl-5 pr-3 pt-5 sm:pl-[26px] sm:pr-4 sm:pt-6">
        <Link
          href="/"
          aria-label="QueryPilot home"
          title="QueryPilot home"
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 ${focusRing}`}
        >
          <Logo size={24} />
          <span className="truncate text-[18px] font-semibold tracking-tight text-zinc-50">QueryPilot</span>
        </Link>
        <IconButton label="Search chats" icon={Search} size={20} className="!size-9" onClick={props.onOpenSearch} />
        {props.onToggleSidebar && (
          <IconButton
            label={props.mobile ? 'Close sidebar' : 'Collapse sidebar'}
            icon={props.mobile ? X : PanelLeftClose}
            size={20}
            className="!size-9"
            onClick={props.onToggleSidebar}
          />
        )}
      </div>

      {/* Workspace identity, separate from the product brand */}
      <div className="flex-none px-3 pb-2 pt-4 sm:px-4">
        <WorkspaceSelector
          workspaceId={props.workspaceId}
          title={props.title}
          onRename={props.onRename}
          onOpenSettings={props.onOpenSettings}
          onNavigate={props.onNavigate}
        />
      </div>

      <nav aria-label="Workspace" className="flex-none px-3 pb-4 sm:px-4">
        <button
          type="button"
          onClick={props.onCreateChat}
          aria-current={onDraft ? 'page' : undefined}
          className={`${ROW} text-zinc-100 hover:bg-white/[0.06] hover:text-white ${focusRing} ${
            onDraft ? 'bg-white/[0.06]' : ''
          }`}
        >
          <Plus size={20} strokeWidth={1.5} className="flex-none text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">New chat</span>
        </button>
      </nav>

      {/* Sources, then Chats. Only this region scrolls. */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${scrollbar}`}>
        <SourcesSection
          documents={props.documents}
          loading={props.loading}
          onAddSource={props.onAddSource}
          onDelete={props.onDeleteDocument}
        />
        <ChatsSection
          pathname={props.pathname}
          workspaceId={props.workspaceId}
          conversations={props.conversations}
          total={props.chatCount}
          loading={props.loading}
          search={props.search}
          setSearch={props.setSearch}
          searchOpen={props.searchOpen}
          setSearchOpen={props.setSearchOpen}
          searchRef={props.searchRef}
          shortcut={props.shortcut}
          onNavigate={props.onNavigate}
          actions={props.chatActions}
        />
      </div>

      {/* Profile footer */}
      <div className="flex-none border-t border-white/[0.06] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <ProfileMenu {...profile} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  chatApi lookups for the methods the backend does not expose yet             */
/*  (rename, detail). Delete is a real method now: chatApi.deleteConversation. */
/* -------------------------------------------------------------------------- */

type AnyFn = (...args: unknown[]) => Promise<unknown>;

function findChatApi(names: string[]): { name: string; call: AnyFn } | null {
  const api = chatApi as unknown as Record<string, unknown>;
  for (const name of names) {
    if (typeof api[name] === 'function') {
      return { name, call: (...args) => (api[name] as AnyFn).apply(chatApi, args) };
    }
  }
  return null;
}

const RENAME_NAMES = ['renameConversation', 'updateConversation', 'update', 'rename'];
const DETAIL_NAMES = ['getConversation', 'conversation', 'conversationDetail', 'retrieveConversation'];

/** Sidebar title for a chat the server never titled: its first question, cut at a word. */
function titleFromQuestion(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const first = clean.charAt(0).toUpperCase() + clean.slice(1);
  const trimEnd = (value: string) => value.replace(/[?.!,;:\s]+$/, '');
  if (first.length <= 48) return trimEnd(first);
  const cut = first.slice(0, 48);
  const lastSpace = cut.lastIndexOf(' ');
  return `${trimEnd(lastSpace > 24 ? cut.slice(0, lastSpace) : cut)}…`;
}

/* -------------------------------------------------------------------------- */
/*  Shell                                                                      */
/* -------------------------------------------------------------------------- */

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [cachedTitle, setCachedTitle] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hiddenChats, setHiddenChats] = useState<ReadonlySet<number>>(new Set());
  const [derivedTitles, setDerivedTitles] = useState<Record<number, string>>({});
  const [pinned, setPinned] = useState<ReadonlySet<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(SIDEBAR_DEFAULT);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [shortcut, setShortcut] = useState('Ctrl K');
  const searchRef = useRef<HTMLInputElement | null>(null);

  const onboardingKey = `${ONBOARDING_PREFIX}${workspaceId}`;
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const pollStartedAtRef = useRef<number | null>(null);
  const pollErrorRef = useRef(false);
  const loadIdRef = useRef(0);
  const loadedForRef = useRef<number | null>(null);
  const probedRef = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    const id = ++loadIdRef.current;
    if (loadedForRef.current !== workspaceId) setLoading(true);
    setError('');
    let redirecting = false;
    try {
      const [workspaces, docs, chats, me] = await Promise.all([
        workspaceApi.list(),
        documentApi.list(workspaceId),
        chatApi.conversations(workspaceId),
        authApi.me(),
      ]);
      if (id !== loadIdRef.current) return;
      const found = workspaces.find((item: Workspace) => item.id === workspaceId) ?? null;
      if (!found) {
        redirecting = true;
        router.replace('/workspaces');
        return;
      }
      setWorkspace(found);
      setDocuments(docs);
      setConversations(chats);
      setUser(me);
      loadedForRef.current = workspaceId;
      try {
        sessionStorage.setItem(ACTIVE_WORKSPACE_KEY, String(workspaceId));
        localStorage.setItem(`${TITLE_PREFIX}${workspaceId}`, found.title);
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (id !== loadIdRef.current) return;
      const apiError = err as { status?: number };
      if (apiError.status === 401 || apiError.status === 403) {
        redirecting = true;
        authApi.clearTokens();
        router.replace('/login');
        return;
      }
      setError(message(err));
    } finally {
      if (id === loadIdRef.current && !redirecting) setLoading(false);
    }
  }, [router, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Show the last known workspace title right away on reload, so the sidebar does not flicker.
  useEffect(() => {
    try {
      setCachedTitle(localStorage.getItem(`${TITLE_PREFIX}${workspaceId}`) ?? '');
    } catch {
      setCachedTitle('');
    }
  }, [workspaceId]);

  // Restore layout preference.
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === '1') setCollapsed(true);
      const savedWidth = Number(localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(savedWidth) && savedWidth >= SIDEBAR_MIN && savedWidth <= SIDEBAR_MAX) {
        widthRef.current = savedWidth;
        setSidebarWidth(savedWidth);
      }
    } catch {
      /* ignore */
    }
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)) {
      setShortcut('⌘K');
    }
  }, []);

  // Pinned chats are a per-browser preference, stored per workspace.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${PINNED_PREFIX}${workspaceId}`);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      setPinned(new Set(Array.isArray(ids) ? ids.filter((v): v is number => typeof v === 'number') : []));
    } catch {
      setPinned(new Set());
    }
  }, [workspaceId]);

  const remember = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(
    (value: boolean) => {
      setCollapsed(value);
      remember(COLLAPSED_KEY, value ? '1' : '0');
    },
    [remember]
  );

  const applyWidth = useCallback((value: number) => {
    const next = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value)));
    widthRef.current = next;
    setSidebarWidth(next);
  }, []);

  // Drag the sidebar edge: follows the pointer, snaps to the icon rail when pulled far enough in,
  // and re-opens from the rail when pulled back out. The chat area follows via --qp-sw.
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };
  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    const x = event.clientX;
    if (x < SIDEBAR_COLLAPSE_AT) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
      applyWidth(x);
    }
  };
  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    remember(WIDTH_KEY, String(widthRef.current));
    remember(COLLAPSED_KEY, event.clientX < SIDEBAR_COLLAPSE_AT ? '1' : '0');
  };
  const resizeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!collapsed) {
        if (widthRef.current - 16 < SIDEBAR_MIN) toggleCollapsed(true);
        else applyWidth(widthRef.current - 16);
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (collapsed) toggleCollapsed(false);
      else applyWidth(widthRef.current + 16);
      remember(WIDTH_KEY, String(widthRef.current));
    } else if (event.key === 'Enter') {
      toggleCollapsed(!collapsed);
    }
  };
  const resetWidth = () => {
    applyWidth(SIDEBAR_DEFAULT);
    toggleCollapsed(false);
    remember(WIDTH_KEY, String(SIDEBAR_DEFAULT));
  };

  const renameWorkspace = (title: string) => {
    setWorkspace((current) => (current ? { ...current, title } : current));
    setCachedTitle(title);
    remember(`${TITLE_PREFIX}${workspaceId}`, title);
    // Persists only if workspaceApi exposes update(id, { title }).
    const api = workspaceApi as unknown as {
      update?: (id: number, data: { title: string }) => Promise<unknown>;
    };
    void api.update?.(workspaceId, { title })?.catch((err: unknown) => setError(message(err)));
  };

  // Delete a source from the sidebar. Removes it right away and restores the list if the API fails.
  const deleteDocument = useCallback(
    async (doc: Document) => {
      const snapshot = documents;
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      try {
        await documentApi.remove(doc.id);
        window.dispatchEvent(new CustomEvent('querypilot:workspace-documents-changed'));
      } catch (err) {
        setDocuments(snapshot);
        setError(message(err));
      }
    },
    [documents]
  );

  /* ----- Chat actions: rename, pin, delete ----- */

  const renameChat = useCallback(
    async (id: number, title: string) => {
      const snapshot = conversations;
      setConversations((cur) => cur.map((c) => (c.id === id ? { ...c, title } : c)));
      setDerivedTitles((cur) => {
        if (!(id in cur)) return cur;
        const { [id]: _removed, ...rest } = cur;
        return rest;
      });
      const rename = findChatApi(RENAME_NAMES);
      if (!rename) {
        setConversations(snapshot);
        setError('Renaming chats is not available yet.');
        return;
      }
      try {
        await (rename.name.toLowerCase().includes('rename') ? rename.call(id, title) : rename.call(id, { title }));
      } catch (err) {
        setConversations(snapshot);
        setError(message(err));
      }
    },
    [conversations]
  );

  const togglePin = useCallback(
    (id: number) => {
      const next = new Set(pinned);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setPinned(next);
      remember(`${PINNED_PREFIX}${workspaceId}`, JSON.stringify(Array.from(next)));
    },
    [pinned, remember, workspaceId]
  );

  // Delete a chat. The row disappears immediately and comes back with an error if the server refuses.
  const deleteChat = useCallback(
    async (id: number) => {
      const snapshot = conversations;
      setConversations((cur) => cur.filter((c) => c.id !== id));
      if (pathname === `/workspaces/${workspaceId}/chat/${id}`) router.push(`/workspaces/${workspaceId}/chat`);
      try {
        await chatApi.deleteConversation(id);
        if (pinned.has(id)) {
          const next = new Set(pinned);
          next.delete(id);
          setPinned(next);
          remember(`${PINNED_PREFIX}${workspaceId}`, JSON.stringify(Array.from(next)));
        }
      } catch (err) {
        setConversations(snapshot);
        setError(message(err));
      }
    },
    [conversations, pathname, pinned, remember, router, workspaceId]
  );

  /*
   * Empty "New chat" cleanup. A chat with no real title is checked once: if it has no messages it is hidden
   * and deleted (best effort); if it does have messages, the sidebar shows its first question as the title.
   * Uses `message_count` from the list when the API sends it, otherwise fetches the chat once.
   */
  useEffect(() => {
    if (loading) return;
    const cutoff = Date.now() - EMPTY_CHAT_GRACE_MS;
    const candidates = conversations.filter((c) => {
      if (!isDefaultTitle(c.title) || probedRef.current.has(c.id)) return false;
      if (pathname === `/workspaces/${workspaceId}/chat/${c.id}`) return false;
      const created = new Date(c.created_at).getTime();
      return Number.isFinite(created) && created < cutoff;
    });
    if (candidates.length === 0) return;
    candidates.forEach((c) => probedRef.current.add(c.id));

    void (async () => {
      const detail = findChatApi(DETAIL_NAMES);
      const empty: number[] = [];
      const titles: Record<number, string> = {};

      for (const chat of candidates) {
        const count = (chat as unknown as Record<string, unknown>).message_count;
        if (count === 0) {
          empty.push(chat.id);
          continue;
        }
        if (!detail) continue;
        try {
          const data = await detail.call(chat.id);
          const messages = isRecord(data) && Array.isArray(data.messages) ? data.messages : null;
          if (!messages) continue;
          if (messages.length === 0) {
            empty.push(chat.id);
            continue;
          }
          const first = messages.find((m) => isRecord(m) && m.role === 'USER');
          const text = isRecord(first) && typeof first.content === 'string' ? titleFromQuestion(first.content) : '';
          if (text) titles[chat.id] = text;
        } catch {
          /* leave this one alone */
        }
      }

      if (Object.keys(titles).length > 0) setDerivedTitles((cur) => ({ ...cur, ...titles }));
      if (empty.length > 0) {
        setHiddenChats((cur) => new Set([...Array.from(cur), ...empty]));
        empty.forEach((id) => void chatApi.deleteConversation(id).catch(() => undefined));
      }
    })();
  }, [conversations, loading, pathname, workspaceId]);

  useEffect(() => {
    const onConversation = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          conversationId?: number;
          title?: string;
          updatedAt?: string;
          conversation?: Conversation;
        }>
      ).detail;
      if (detail?.conversation && detail.conversation.workspace === workspaceId) {
        const next = detail.conversation;
        setConversations((cur) => [next, ...cur.filter((i) => i.id !== next.id)]);
        return;
      }
      if (
        typeof detail?.conversationId === 'number' &&
        (typeof detail.title === 'string' || typeof detail.updatedAt === 'string')
      ) {
        setConversations((cur) =>
          cur
            .map((i) =>
              i.id === detail.conversationId
                ? {
                    ...i,
                    ...(typeof detail.title === 'string' ? { title: detail.title } : {}),
                    updated_at: detail.updatedAt ?? new Date().toISOString(),
                  }
                : i
            )
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        );
      }
    };
    const onDocuments = () => {
      documentApi
        .list(workspaceId)
        .then(setDocuments)
        .catch((err: unknown) => setError(message(err)));
    };
    window.addEventListener('querypilot:conversation-changed', onConversation);
    window.addEventListener('querypilot:workspace-documents-changed', onDocuments);
    return () => {
      window.removeEventListener('querypilot:conversation-changed', onConversation);
      window.removeEventListener('querypilot:workspace-documents-changed', onDocuments);
    };
  }, [workspaceId]);

  const hasPending = documents.some(isPending);

  useEffect(() => {
    if (!hasPending) {
      pollStartedAtRef.current = null;
      return;
    }
    if (pollStartedAtRef.current === null) pollStartedAtRef.current = Date.now();
    let cancelled = false;
    let attempt = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      if (Date.now() - (pollStartedAtRef.current ?? Date.now()) > POLL_MAX_DURATION_MS) {
        setError('Document processing is taking longer than expected. Refresh the page to check the latest status.');
        return;
      }
      const interval = POLL_INTERVALS_MS[Math.min(attempt, POLL_INTERVALS_MS.length - 1)];
      pollTimeoutRef.current = setTimeout(runPoll, interval);
    };

    const runPoll = async () => {
      if (cancelled || pollInFlightRef.current) return scheduleNext();
      pollInFlightRef.current = true;
      try {
        const latest = await documentApi.list(workspaceId);
        if (!cancelled) {
          setDocuments(latest);
          if (pollErrorRef.current) {
            pollErrorRef.current = false;
            setError('');
          }
        }
      } catch (err) {
        if (!cancelled) {
          pollErrorRef.current = true;
          setError(message(err));
        }
      } finally {
        pollInFlightRef.current = false;
        attempt += 1;
        if (!cancelled) scheduleNext();
      }
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
      pollStartedAtRef.current = null;
    };
  }, [hasPending, workspaceId]);

  useEffect(() => {
    if (loading || !workspace) return;
    if (searchParams.get('new') !== '1') return;
    let seen = false;
    try {
      seen = localStorage.getItem(onboardingKey) === '1';
    } catch {
      /* ignore */
    }
    if (seen) {
      router.replace(pathname);
      return;
    }
    setTourOpen(true);
  }, [loading, workspace, onboardingKey, searchParams, router, pathname]);

  const closeTour = () => {
    remember(onboardingKey, '1');
    setTourOpen(false);
    if (searchParams.get('new') === '1') router.replace(pathname);
  };

  const onUploaded = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('querypilot:workspace-documents-changed'));
  }, []);

  const openAddSource = useCallback(() => {
    setSourceOpen(true);
    setMobileOpen(false);
  }, []);

  // Reveals the search field (expanding the sidebar first if needed) and focuses it.
  const openSearch = useCallback(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      if (collapsed) toggleCollapsed(false);
    } else {
      setMobileOpen(true);
    }
    setSearchOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => searchRef.current?.focus()));
  }, [collapsed, toggleCollapsed]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [openSearch]);

  const createChat = () => {
    const draftPath = `/workspaces/${workspaceId}/chat`;
    if (pathname === draftPath) window.dispatchEvent(new CustomEvent('querypilot:new-chat-requested'));
    else router.push(draftPath);
    setMobileOpen(false);
  };

  // Empty leftovers never show (the chat you have open is the exception); untitled chats borrow their first question.
  const visibleConversations = useMemo(
    () =>
      conversations
        .filter((c) => {
          const open = pathname === `/workspaces/${workspaceId}/chat/${c.id}`;
          return open || (!isEmptyUntitled(c) && !hiddenChats.has(c.id));
        })
        .map((c) => (isDefaultTitle(c.title) && derivedTitles[c.id] ? { ...c, title: derivedTitles[c.id] } : c)),
    [conversations, derivedTitles, hiddenChats, pathname, workspaceId]
  );

  const grouped = useMemo(() => {
    const n = search.trim().toLowerCase();
    return groupConversations(
      n ? visibleConversations.filter((i) => displayTitle(i.title).toLowerCase().includes(n)) : visibleConversations,
      pinned
    );
  }, [visibleConversations, search, pinned]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch (err) {
      setError(message(err));
    } finally {
      router.replace('/login');
    }
  };

  const uiValue = useMemo(
    () => ({ sourceCount: documents.length, openAddSource, researchOptions: NO_RESEARCH }),
    [documents.length, openAddSource]
  );

  // Sign-out and crash screens share the workspace look: #181818, Geist, antialiased, theme text colours.
  const status = (text: string) => (
    <StatusScreen>
      <p className="text-[16px] text-[#a6a6a6]">{text}</p>
    </StatusScreen>
  );

  // No more full-page "Loading workspace…" screen. The layout stays visible and the orb shows progress.
  if (loggingOut) return status('Signing out…');

  if (!workspace && !loading && error) {
    return (
      <StatusScreen>
        <div className="max-w-sm">
          <p className="text-[18px] font-medium text-[#f2f2f2]">Couldn’t load this workspace</p>
          <p className="mt-2 text-[16px] leading-relaxed text-[#a6a6a6]">{error}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" onClick={() => void load()}>
              Try again
            </Button>
            <Button variant="secondary" onClick={() => router.push('/workspaces')}>
              All workspaces
            </Button>
          </div>
        </div>
      </StatusScreen>
    );
  }

  const workspaceTitle = workspace?.title || cachedTitle || (loading ? '' : 'Untitled notebook');

  const sidebar = (extra?: {
    mobile?: boolean;
    compact?: boolean;
    onExpand?: () => void;
    onNavigate?: () => void;
    onToggleSidebar?: () => void;
  }) => (
    <WorkspaceSidebar
      pathname={pathname}
      workspaceId={workspaceId}
      title={workspaceTitle}
      loading={loading}
      onRename={renameWorkspace}
      conversations={grouped}
      chatCount={visibleConversations.length}
      chatActions={{ pinned, onRename: (id, title) => void renameChat(id, title), onDelete: (id) => void deleteChat(id), onTogglePin: togglePin }}
      search={search}
      setSearch={setSearch}
      searchOpen={searchOpen}
      setSearchOpen={setSearchOpen}
      onOpenSearch={openSearch}
      searchRef={searchRef}
      shortcut={shortcut}
      documents={documents}
      onCreateChat={createChat}
      onAddSource={openAddSource}
      onDeleteDocument={(doc) => void deleteDocument(doc)}
      onOpenSettings={() => {
        setMobileOpen(false);
        const match = pathname.match(/^\/workspaces\/\d+\/chat\/(\d+)$/);
        const activeChatId = match?.[1];
        const target = activeChatId
          ? `/workspaces/${workspaceId}/chat/settings?conversationId=${activeChatId}`
          : `/workspaces/${workspaceId}/chat/settings`;
        router.push(target);
      }}
      onOpenTour={() => {
        setMobileOpen(false);
        setTourOpen(true);
      }}
      onLogout={() => void logout()}
      loggingOut={loggingOut}
      user={user}
      {...extra}
    />
  );

  return (
    <WorkspaceUiProvider value={uiValue}>
      <div
        className={`qp-minh relative bg-[#181818] font-sans text-zinc-200 antialiased ${resizing ? 'cursor-col-resize select-none' : ''}`}
        style={{ '--qp-sw': `${sidebarWidth}px` } as CSSProperties}
        aria-busy={loading}
      >
        <QpGlobalStyles />
        <MenuStyles />

        {/* iOS-style reload indicator: shows only while the workspace loads. */}
        <ThinkingOrb visible={loading} />

        {/* Desktop sidebar: always mounted so it can slide. */}
        <aside
          aria-label="Workspace sidebar"
          className={`fixed inset-y-0 left-0 z-20 hidden overflow-hidden border-r border-white/[0.06] bg-[#202020] shadow-[1px_0_0_0_rgba(0,0,0,0.5)] lg:block ${
            resizing ? '' : 'transition-[width] duration-200 ease-out motion-reduce:transition-none'
          } ${collapsed ? 'w-16' : 'w-[var(--qp-sw)]'}`}
        >
          {sidebar(
            collapsed
              ? { compact: true, onExpand: () => toggleCollapsed(false) }
              : { onToggleSidebar: () => toggleCollapsed(true) }
          )}
        </aside>

        {/* Drag handle on the sidebar edge: drag to resize, double-click to reset, arrow keys when focused. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={collapsed ? 64 : sidebarWidth}
          tabIndex={0}
          title="Drag to resize, double-click to reset"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={resetWidth}
          onKeyDown={resizeKey}
          style={{ left: collapsed ? 64 : sidebarWidth }}
          className={`group fixed inset-y-0 z-30 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none lg:block ${
            resizing ? '' : 'transition-[left] duration-200 ease-out motion-reduce:transition-none'
          } ${focusRing}`}
        >
          <span
            aria-hidden="true"
            className={`mx-auto block h-full w-px transition-colors duration-150 ${
              resizing ? 'bg-white/40' : 'bg-transparent group-hover:bg-white/30 group-focus-visible:bg-white/30'
            }`}
          />
        </div>

        {/* Mobile top bar (clears the notch / status bar) */}
        <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top))] items-center gap-2 border-b border-white/[0.06] bg-[#181818] px-3 pt-[env(safe-area-inset-top)] lg:hidden">
          <IconButton label="Open sidebar" icon={MenuIcon} onClick={() => setMobileOpen(true)} />
          <p className="min-w-0 flex-1 truncate text-[16px] font-medium text-zinc-100">{workspaceTitle}</p>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/70"
            />
            <aside
              aria-label="Workspace sidebar"
              className="relative z-10 h-full w-[min(88vw,380px)] border-r border-white/10 bg-[#202020] pt-[env(safe-area-inset-top)]"
            >
              {sidebar({
                mobile: true,
                onNavigate: () => setMobileOpen(false),
                onToggleSidebar: () => setMobileOpen(false),
              })}
            </aside>
          </div>
        )}

        {/*
         * Main region: exactly one viewport tall. The page itself never scrolls;
         * the chat owns its own scroll area and the composer stays docked below it.
         */}
        <main
          className={`relative z-0 flex h-dvh min-w-0 flex-col pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0 ${
            resizing ? '' : 'transition-[padding] duration-200 ease-out motion-reduce:transition-none'
          } ${collapsed ? 'lg:pl-16' : 'lg:pl-[var(--qp-sw)]'}`}
        >
          {error && (
            <div
              role="alert"
              className="mx-4 mt-3 flex flex-none items-start gap-3 rounded-lg bg-red-500/[0.08] px-3.5 py-2.5 text-[16px] text-red-200 ring-1 ring-inset ring-red-500/20 lg:mx-6"
            >
              <p className="min-w-0 flex-1 leading-5">{error}</p>
              <IconButton label="Dismiss message" icon={X} size={14} onClick={() => setError('')} className="!size-6" />
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </main>

        <WorkspaceTour
          open={tourOpen}
          onClose={closeTour}
          onFinish={() => {
            closeTour();
            setSourceOpen(true);
          }}
        />
        <AddSourceDialog
          workspaceId={workspaceId}
          open={sourceOpen}
          onClose={() => setSourceOpen(false)}
          onUploaded={onUploaded}
        />
      </div>
    </WorkspaceUiProvider>
  );
}
export default WorkspaceShell;