'use client';

import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUp,
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  FileText,
  ListChecks,
  Loader2,
  ShieldCheck,
  Square,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Root, Text as MdastText } from 'mdast';
import { visit } from 'unist-util-visit';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';

import {
  authApi,
  chatApi,
  documentApi,
  streamChat,
  type ApiError,
  type ChatSource,
  type Conversation,
  type ConversationDetail,
  type Message,
} from '@/lib/django-api';
import { useChatCache } from '@/components/chat-context';
import { IconButton, focusRing } from '@/components/chat-ui';
import { useWorkspaceUi } from '@/components/workspace-ui-context';
import { PixelDissolveButton } from '@/components/pixel-dissolve-button';
import { ThinkingOrb } from 'thinking-orbs';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type ThoughtRecord = { event: string; message: string; status?: string };
type CitationRecord = { index: number; source_index: number; quote?: string };
type UiSource = ChatSource & { index?: number; excerpt?: string };

type MessageMetadata = {
  sources?: UiSource[];
  citations?: CitationRecord[];
  thoughts?: ThoughtRecord[];
  grounding_passed?: boolean | null;
  route?: string | null;
  processing_time_ms?: number;
};

type MessageWithMetadata = Message & { metadata?: MessageMetadata };

type TurnDetails = {
  thoughts: ThoughtRecord[];
  sources: UiSource[];
  citations: CitationRecord[];
  groundingPassed: boolean | null;
  route: string | null;
  processingTimeMs?: number;
};

type LiveAssistant = {
  id: string;
  content: string;
  sources: UiSource[];
  citations: CitationRecord[];
  groundingPassed: boolean | null;
  route: string | null;
  thoughts: ThoughtRecord[];
  completed: boolean;
};

/** What kinds of files the workspace has. Used to pick starter prompts that actually make sense. */
type DocKinds = { text: boolean; table: boolean };

type Suggestion = {
  title: string;
  description: string;
  prompt: string;
  /** any = works on every file, text = needs written documents (PDF, DOCX...), table = needs spreadsheets */
  kind: 'any' | 'text' | 'table';
  minSources?: number;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One column for the header title, messages and composer, so they always line up.
 * It centres inside the main region (not the viewport), so it follows the sidebar.
 */
const COLUMN = 'mx-auto w-full max-w-[800px] px-4 sm:px-6 2xl:max-w-[860px] min-[1920px]:max-w-[960px]';

const scrollbar = '[scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]';

/** Look of the small ghost buttons in this view (Refresh, View all sources). Same overrides as the rest of the site. */
const GHOST_BUTTON =
  '!h-8 !min-h-0 !w-auto !rounded-full !px-3 !text-[13px] !font-medium !normal-case !tracking-normal whitespace-nowrap shrink-0 border !border-white/10';

// Starting points. They fill the composer so the person can edit before sending.
// Only the ones that fit the workspace's files are shown; "Refresh prompts" rotates through what is left.
const SUGGESTIONS: Suggestion[] = [
  {
    title: 'Summarize your sources',
    description: 'Get the main points from everything in this workspace.',
    prompt: 'Give me a short summary of the key points across all the documents in this workspace.',
    kind: 'any',
  },
  {
    title: 'Find conflicts',
    description: 'Identify disagreements and inconsistencies across sources.',
    prompt: 'Do any of these documents disagree with each other? List each conflict and where it comes from.',
    kind: 'any',
    minSources: 2,
  },
  {
    title: 'Extract key information',
    description: 'Find important dates, amounts and deadlines.',
    prompt: 'List every important date, amount and deadline mentioned in these documents.',
    kind: 'text',
  },
  {
    title: 'Create a study guide',
    description: 'Key concepts, terms and review questions.',
    prompt:
      'Create a study guide from my sources: key concepts, important terms with short definitions, and five review questions with answers.',
    kind: 'text',
  },
  {
    title: 'Explain the key terms',
    description: 'Define the specialised terms used across your documents.',
    prompt: 'List the important terms used in these documents and explain each one in plain language.',
    kind: 'text',
  },
  {
    title: 'List action items',
    description: 'Pull out follow-ups and next steps.',
    prompt: 'List every action item, follow-up or next step mentioned in these documents.',
    kind: 'text',
  },
  {
    title: 'Describe the columns',
    description: 'See what columns each spreadsheet has and what one row means.',
    prompt: 'For each spreadsheet in this workspace, list its columns and explain what one row represents.',
    kind: 'table',
  },
  {
    title: 'Look up a record',
    description: 'Pick one record and see every column for it.',
    prompt: 'Pick one record from each spreadsheet and show me every column for it.',
    kind: 'table',
  },
  {
    title: 'Check for odd values',
    description: 'Spot blanks, duplicates and values that look wrong.',
    prompt: 'Check these spreadsheets for blank cells, duplicate rows and values that look wrong.',
    kind: 'table',
  },
];
const SUGGESTIONS_PER_VIEW = 3;

/** Wide, left-aligned column for the empty state; centres inside the main area, not the viewport. */
const HERO_COLUMN = 'mx-auto w-full max-w-[960px] px-4 sm:px-6 2xl:max-w-[1040px] min-[1920px]:max-w-[1180px]';

/** Empty-state copy. It only says what the app does: answers come from your sources, with citations. */
function heroCopy(sourceCount: number, greeting: string, firstName: string) {
  if (sourceCount === 0) {
    return {
      title: 'Add a source to get started',
      body: 'Upload PDFs, Word files or spreadsheets, then ask questions that span them. Every answer cites its evidence.',
    };
  }
  return {
    title: firstName ? `Good ${greeting.toLowerCase()}, ${firstName}` : `Good ${greeting.toLowerCase()}`,
    body: `Questions are answered from ${sourceCount === 1 ? 'your source' : `all ${sourceCount} sources`}, with citations.`,
  };
}

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
}

// First name from the profile when the API provides one; otherwise a clean letters-only username.
function firstNameFrom(user: unknown) {
  if (!isRecord(user)) return '';
  for (const key of ['first_name', 'given_name']) {
    const value = user[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const full = user.name ?? user.full_name;
  if (typeof full === 'string' && full.trim()) return full.trim().split(/\s+/)[0];
  const username = typeof user.username === 'string' ? user.username.replace(/[\d_]+$/, '') : '';
  return /^[A-Za-z]{2,}$/.test(username) ? username.charAt(0).toUpperCase() + username.slice(1).toLowerCase() : '';
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Negative ids for optimistic messages; the counter keeps them unique.
let optimisticIdCounter = 0;
function nextOptimisticId() {
  optimisticIdCounter -= 1;
  return optimisticIdCounter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/**
 * Sidebar title to use when the server did not send one (title generation failed or was skipped).
 * Clean first message: first letter capitalised, no trailing punctuation, cut at a word with "…".
 * The server should save the same fallback so the title survives a page refresh.
 */
function fallbackTitle(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  const first = clean.charAt(0).toUpperCase() + clean.slice(1);
  const trimEnd = (value: string) => value.replace(/[?.!,;:\s]+$/, '');
  if (first.length <= 48) return trimEnd(first);
  const cut = first.slice(0, 48);
  const lastSpace = cut.lastIndexOf(' ');
  return `${trimEnd(lastSpace > 24 ? cut.slice(0, lastSpace) : cut)}…`;
}

/**
 * Best effort: delete a conversation that was created but never got a question accepted,
 * so failed sends do not leave empty "New chat" rows behind.
 * It needs a delete method on chatApi. If yours has a different name, add it to this list.
 */
async function discardConversation(id: number) {
  const api = chatApi as unknown as Record<string, unknown>;
  for (const key of ['deleteConversation', 'removeConversation', 'remove', 'delete']) {
    const fn = api[key];
    if (typeof fn === 'function') {
      try {
        await (fn as (conversationId: number) => Promise<unknown>).call(chatApi, id);
      } catch {
        /* nothing else to do, the sidebar hides empty untitled chats anyway */
      }
      return;
    }
  }
}

const TABLE_FILE = /\.(xlsx|xlsm|xls|csv|tsv)$/i;

// Looks at the file names to learn if the workspace has spreadsheets, written documents, or both.
function docKindsFrom(docs: unknown[]): DocKinds {
  let text = false;
  let table = false;
  for (const doc of docs) {
    if (!isRecord(doc)) continue;
    const names = ['title', 'name', 'file_name', 'filename', 'original_filename']
      .map((key) => doc[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (names.some((name) => TABLE_FILE.test(name.trim()))) table = true;
    else text = true;
  }
  return { text, table };
}

function suggestionFits(item: Suggestion, sourceCount: number, kinds: DocKinds | null) {
  if (item.minSources && sourceCount < item.minSources) return false;
  if (item.kind === 'any' || !kinds) return true;
  return item.kind === 'text' ? kinds.text : kinds.table;
}

function getMetadata(message: Message): MessageMetadata {
  const metadata = (message as MessageWithMetadata).metadata;
  return isRecord(metadata) ? (metadata as MessageMetadata) : {};
}

function normalizeThoughts(value: unknown): ThoughtRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const event = typeof item.event === 'string' ? item.event : '';
    const message = typeof item.message === 'string' ? item.message : '';
    const status = typeof item.status === 'string' ? item.status : undefined;
    return event || message ? [{ event, message, status }] : [];
  });
}

function normalizeSources(value: unknown): UiSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord) as UiSource[];
}

function normalizeCitations(value: unknown): CitationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const index = Number(item.index);
    const sourceIndex = Number(item.source_index);
    return Number.isFinite(index) && Number.isFinite(sourceIndex)
      ? [{ index, source_index: sourceIndex, quote: typeof item.quote === 'string' ? item.quote : undefined }]
      : [];
  });
}

function metadataForMessage(message: Message): TurnDetails {
  const metadata = getMetadata(message);
  return {
    thoughts: normalizeThoughts(metadata.thoughts),
    sources: normalizeSources(metadata.sources),
    citations: normalizeCitations(metadata.citations),
    groundingPassed: typeof metadata.grounding_passed === 'boolean' ? metadata.grounding_passed : null,
    route: typeof metadata.route === 'string' ? metadata.route : null,
    processingTimeMs: typeof metadata.processing_time_ms === 'number' ? metadata.processing_time_ms : undefined,
  };
}

/**
 * Turns plain-text "[1]" into a citation link node. Only touches plain text
 * nodes, so code spans and real links are left alone. A "[n]" that does not
 * match a real citation stays as normal text.
 */
function remarkCitationLinks(validIndices: Set<number>) {
  return (tree: Root) => {
    if (validIndices.size === 0) return;
    visit(tree, 'text', (node: MdastText, index, parent) => {
      if (!parent || index === undefined) return;
      const pattern = /\[(\d{1,3})\]/g;
      const value = node.value;
      let match: RegExpExecArray | null;
      let lastEnd = 0;
      const replacement: Array<MdastText | ReturnType<typeof linkNode>> = [];
      let changed = false;
      while ((match = pattern.exec(value)) !== null) {
        const citationIndex = Number(match[1]);
        changed = true;
        if (match.index > lastEnd) {
          replacement.push({ type: 'text', value: value.slice(lastEnd, match.index) });
        }
        if (validIndices.has(citationIndex)) {
          replacement.push(linkNode(citationIndex, match[0]));
        } else {
          replacement.push({ type: 'text', value: match[0] });
        }
        lastEnd = match.index + match[0].length;
      }
      if (!changed) return;
      if (lastEnd < value.length) {
        replacement.push({ type: 'text', value: value.slice(lastEnd) });
      }
      (parent.children as unknown[]).splice(index, 1, ...replacement);
      return index + replacement.length;
    });
  };
}

function linkNode(citationIndex: number, label: string) {
  return {
    type: 'link' as const,
    url: `#querypilot-citation-${citationIndex}`,
    children: [{ type: 'text' as const, value: label }],
  };
}

/** Real document name from the citation metadata; tries the common field names before falling back. */
function sourceLabel(source: UiSource) {
  const record = source as unknown as Record<string, unknown>;
  for (const key of ['document_name', 'document_title', 'title', 'file_name', 'filename']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Document';
}

// Internal table ids such as "ws_37_doc_26_..." mean nothing to a reader.
const looksInternal = (value: string) => /^ws_\d+_doc_\d+/i.test(value);

function sourceMeta(source: UiSource) {
  const parts: string[] = [];
  if (source.page_start !== undefined && source.page_start !== null) {
    parts.push(
      source.page_end && source.page_end !== source.page_start
        ? `Pages ${source.page_start}\u2013${source.page_end}`
        : `Page ${source.page_start}`
    );
  }
  if (source.heading) parts.push(source.heading);
  if (source.table_name) parts.push(looksInternal(source.table_name) ? 'Table' : `Table: ${source.table_name}`);
  if (source.chunk_index !== undefined && source.chunk_index !== null) {
    parts.push(`Section ${source.chunk_index}`);
  }
  return parts.join(' \u00b7 ');
}

function humanizeEvent(event: string) {
  const text = event.replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function thoughtParts(thought: ThoughtRecord) {
  const title = humanizeEvent(thought.event) || thought.message;
  const message = thought.message.trim();
  const normalizedMessage = message.toLowerCase().replace(/[….\s]+$/, '');
  const detail = message && normalizedMessage !== title.toLowerCase() ? message : '';
  return { title, detail };
}

// A "completed" event replaces its earlier "started" row, so each step shows once.
function mergeThought(list: ThoughtRecord[], next: ThoughtRecord): ThoughtRecord[] {
  if (next.status !== 'started') {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].event === next.event && list[i].status === 'started') {
        const copy = list.slice();
        copy[i] = next;
        return copy;
      }
    }
  }
  return [...list, next];
}

function formatDuration(ms: number) {
  const seconds = ms / 1000;
  if (seconds < 10) return `${Math.max(seconds, 0.1).toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/* -------------------------------------------------------------------------- */
/*  Motion: only for the live status line and expanding panels                 */
/* -------------------------------------------------------------------------- */

function ChatStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        textarea.qpc-composer-textarea { color: #e6e6e6 !important; caret-color: #e6e6e6 !important; }
        textarea.qpc-composer-textarea::placeholder { color: #9aa0a8 !important; opacity: 1 !important; -webkit-text-fill-color: #9aa0a8 !important; }
        @keyframes qpc-shimmer { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
        @keyframes qpc-rise { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: none; } }
        @keyframes qpc-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
        .qpc-shimmer {
          background: linear-gradient(90deg, #71717a 0%, #71717a 38%, #f4f4f5 50%, #71717a 62%, #71717a 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: qpc-shimmer 2.2s linear infinite;
        }
        .qpc-rise { animation: qpc-rise 200ms ease-out both; }
        .qpc-dot { animation: qpc-pulse 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .qpc-shimmer { animation: none; background: none; color: #a1a1aa; }
          .qpc-rise, .qpc-dot { animation: none; }
        }
      `,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Page loader: the thinking orb, centred in the page itself                  */
/* -------------------------------------------------------------------------- */

function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex h-16 w-16 items-center justify-center" aria-hidden="true">
        <ThinkingOrb state="solving" size={64} theme="dark" aria-hidden="true" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Live thoughts: "Responding…" with every pipeline step as it arrives        */
/*  Once the answer starts streaming this collapses into the steps control.    */
/* -------------------------------------------------------------------------- */

function LiveThoughts({ thoughts }: { thoughts: ThoughtRecord[] }) {
  const last = thoughts.length - 1;
  return (
    <div role="status" aria-live="polite" className="py-1">
      <div className="flex items-center gap-2 text-[16px] font-medium text-zinc-400">
        <Loader2 size={15} className="animate-spin text-zinc-400 motion-reduce:animate-none" />
        <span>Responding…</span>
      </div>

      <ol className="ml-0.5 mt-4">
        {thoughts.length === 0 && (
          <li className="text-[16px]">
            <span className="qpc-shimmer inline-block">Getting started…</span>
          </li>
        )}
        {thoughts.map((thought, index) => {
          const { title, detail } = thoughtParts(thought);
          const failed = thought.status === 'failed';
          const current = index === last && !failed;
          return (
            <li key={`${thought.event}-${index}`} className="qpc-rise relative flex gap-3 pb-4 last:pb-0">
              {index < last && (
                <span aria-hidden="true" className="absolute bottom-0 left-[8px] top-5 w-px bg-white/[0.08]" />
              )}
              <span className="relative mt-px grid size-[17px] flex-none place-items-center rounded-full border border-white/[0.18] bg-zinc-950 text-zinc-400">
                {failed ? (
                  <X size={10} strokeWidth={3} className="text-red-300" />
                ) : current ? (
                  <span className="qpc-dot size-1.5 rounded-full bg-zinc-300" />
                ) : (
                  <Check size={10} strokeWidth={3} />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-[16px] font-medium leading-5 ${
                    current ? 'qpc-shimmer inline-block' : failed ? 'text-red-300' : 'text-zinc-200'
                  }`}
                >
                  {title}
                </p>
                {detail && <p className="mt-0.5 text-[16px] leading-[1.6] text-zinc-400">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Answer steps: optional, collapsed by default. Shows the pipeline steps     */
/*  (searching, reading sources...) and never raw model reasoning.             */
/* -------------------------------------------------------------------------- */

function ThoughtsTimeline({
  thoughts,
  isLive = false,
  durationMs,
}: {
  thoughts: ThoughtRecord[];
  isLive?: boolean;
  durationMs?: number;
}) {
  const [open, setOpen] = useState(false);

  if (thoughts.length === 0) return null;
  const last = thoughts.length - 1;

  return (
    <div className="mb-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`-ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[16px] text-zinc-500 transition-colors duration-150 motion-reduce:transition-none hover:bg-white/[0.05] hover:text-zinc-200 ${focusRing}`}
      >
        {isLive ? (
          <span className="qpc-dot size-1.5 rounded-full bg-zinc-300" />
        ) : (
          <ListChecks size={14} strokeWidth={1.75} />
        )}
        <span>Answer steps</span>
        {!isLive && durationMs ? <span className="tabular-nums">{formatDuration(durationMs)}</span> : null}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ol className="qpc-rise ml-1 mt-3">
          {thoughts.map((thought, index) => {
            const { title, detail } = thoughtParts(thought);
            const failed = thought.status === 'failed';
            const pending = isLive && index === last && thought.status === 'started';
            return (
              <li key={`${thought.event}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                {index < last && (
                  <span aria-hidden="true" className="absolute bottom-0 left-[8px] top-5 w-px bg-white/[0.08]" />
                )}
                <span className="relative mt-px grid size-[17px] flex-none place-items-center rounded-full border border-white/[0.18] bg-zinc-950 text-zinc-400">
                  {failed ? (
                    <X size={10} strokeWidth={3} className="text-red-300" />
                  ) : pending ? (
                    <span className="qpc-dot size-1.5 rounded-full bg-zinc-300" />
                  ) : (
                    <Check size={10} strokeWidth={3} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[16px] font-medium leading-5 text-zinc-200">{title}</p>
                  {detail && <p className="mt-0.5 text-[16px] leading-[1.6] text-zinc-400">{detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Markdown answer (Geist throughout, like the rest of the app)               */
/* -------------------------------------------------------------------------- */

function MarkdownAnswer({
  content,
  citations,
  onCitationClick,
}: {
  content: string;
  citations: CitationRecord[];
  onCitationClick: (index: number) => void;
}) {
  const validIndices = useMemo(() => new Set(citations.map((item) => item.index)), [citations]);
  const remarkPlugins = useMemo(() => [remarkGfm, () => remarkCitationLinks(validIndices)], [validIndices]);

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="mb-3 mt-8 font-sans text-[24px] font-semibold tracking-[-0.02em] text-zinc-100">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2.5 mt-7 font-sans text-[20px] font-semibold tracking-[-0.015em] text-zinc-100">{children}</h2>
    ),
    h3: ({ children }) => <h3 className="mb-2 mt-5 font-sans text-[18px] font-semibold text-zinc-200">{children}</h3>,
    p: ({ children }) => (
      <p className="my-4 whitespace-pre-line break-words text-[16px] leading-[1.75] text-zinc-300">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-4 list-disc space-y-2 pl-6 text-[16px] leading-[1.75] text-zinc-300 marker:text-zinc-500">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 list-decimal space-y-2 pl-6 text-[16px] leading-[1.75] text-zinc-300 marker:text-zinc-400">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-white/[0.2] pl-4 text-zinc-400">{children}</blockquote>
    ),
    code: ({ className, children, ...props }) => {
      const isBlock = Boolean(className);
      return isBlock ? (
        <code
          className="block overflow-x-auto rounded-lg border border-white/[0.08] bg-zinc-950 px-4 py-3.5 font-mono text-[14px] leading-6 text-zinc-300"
          {...props}
        >
          {children}
        </code>
      ) : (
        <code className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[14px] text-zinc-200" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => <pre className="my-4 overflow-x-auto">{children}</pre>,
    table: ({ children }) => (
      <div className="my-5 overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="min-w-full border-collapse font-sans text-[16px]">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="whitespace-nowrap border-b border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-left font-medium text-zinc-200">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="border-b border-white/[0.05] px-3.5 py-2 text-zinc-300">{children}</td>,
    a: ({ href, children }) => {
      const match = typeof href === 'string' ? href.match(/^#querypilot-citation-(\d+)$/) : null;
      if (match) {
        const index = Number(match[1]);
        return (
          <button
            type="button"
            onClick={() => onCitationClick(index)}
            aria-label={`Show source ${index}`}
            className={`mx-0.5 inline-grid size-[18px] place-items-center rounded-md bg-white/[0.08] align-[3px] font-sans text-[12px] font-medium leading-none text-zinc-300 tabular-nums transition-colors duration-150 motion-reduce:transition-none hover:bg-white/[0.18] hover:text-white ${focusRing}`}
          >
            {index}
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-zinc-100 underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white/70"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="break-words font-sans [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sources: one card per document (citations grouped), full list on its tab   */
/* -------------------------------------------------------------------------- */

const SOURCE_PREVIEW_LIMIT = 4;

function sourceNumber(source: UiSource, index: number) {
  return source.index ?? index + 1;
}

type SourceGroup = { key: string; name: string; items: Array<{ source: UiSource; number: number }> };

// Several citations from the same document share one card instead of repeating the file name.
function groupSources(sources: UiSource[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  sources.forEach((source, index) => {
    const name = sourceLabel(source);
    const key = String(source.document_id ?? name);
    const group = groups.get(key) ?? { key, name, items: [] };
    group.items.push({ source, number: sourceNumber(source, index) });
    groups.set(key, group);
  });
  return Array.from(groups.values());
}

function SourceCards({
  sources,
  selected,
  onSelect,
  onShowAll,
}: {
  sources: UiSource[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onShowAll: () => void;
}) {
  const groups = useMemo(() => groupSources(sources), [sources]);
  if (sources.length === 0) return null;
  const visible = groups.slice(0, SOURCE_PREVIEW_LIMIT);
  const hidden = groups.length - visible.length;
  const active =
    selected !== null ? sources.find((source, index) => sourceNumber(source, index) === selected) ?? null : null;

  return (
    <div className="mt-6">
      <p className="mb-2 text-[13px] font-medium text-zinc-500">Sources</p>
      <div className={`grid gap-2 ${groups.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {visible.map((group) => (
          <div key={group.key} className="min-w-0 rounded-lg border border-white/[0.08] bg-zinc-900/60 p-3">
            <p className="flex items-center gap-2 text-[16px] font-medium text-zinc-200" title={group.name}>
              <FileText size={14} strokeWidth={1.75} className="flex-none text-zinc-500" />
              <span className="truncate">{group.name}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {group.items.map(({ source, number }) => {
                const meta = sourceMeta(source);
                const label = meta.split(' \u00b7 ')[0] || 'Source';
                const isSelected = selected === number;
                return (
                  <button
                    key={number}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Source ${number}: ${meta || label}`}
                    title={meta || label}
                    onClick={() => onSelect(isSelected ? null : number)}
                    className={`inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-md border pl-1 pr-2.5 text-[13px] transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
                      isSelected
                        ? 'border-white/30 bg-white/[0.08] text-zinc-100'
                        : 'border-white/[0.1] text-zinc-400 hover:border-white/[0.2] hover:bg-white/[0.05] hover:text-zinc-200'
                    }`}
                  >
                    <span className="grid size-5 flex-none place-items-center rounded bg-white/[0.08] text-[12px] tabular-nums text-zinc-300">
                      {number}
                    </span>
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <PixelDissolveButton
          type="button"
          label={`View all ${sources.length} sources`}
          onClick={onShowAll}
          color="transparent"
          textColor="#a1a1aa"
          dissolveColor="rgba(255,255,255,0.28)"
          cellSize={4}
          className={`mt-2 ${GHOST_BUTTON} ${focusRing}`}
        />
      )}

      {active && (
        <div className="qpc-rise mt-3 rounded-lg border border-white/[0.08] bg-zinc-900/60 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[16px] font-medium text-zinc-200">
                <FileText size={14} strokeWidth={1.75} className="flex-none text-zinc-400" />
                <span className="truncate">{sourceLabel(active)}</span>
              </p>
              {sourceMeta(active) && <p className="mt-1 text-[13px] text-zinc-500">{sourceMeta(active)}</p>}
            </div>
            <IconButton label="Close source preview" icon={X} size={14} onClick={() => onSelect(null)} className="!size-7" />
          </div>
          {active.excerpt && (
            <p className="mt-3 border-l border-white/[0.14] pl-3 text-[16px] leading-[1.65] text-zinc-400">
              {active.excerpt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SourcesList({
  sources,
  selected,
  onSelect,
}: {
  sources: UiSource[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  if (sources.length === 0) {
    return <p className="py-4 text-[16px] text-zinc-500">This answer did not use any sources.</p>;
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {sources.map((source, index) => {
        const number = sourceNumber(source, index);
        const open = selected === number;
        return (
          <li key={`${source.document_id}-${number}-${index}`} className="py-3">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onSelect(open ? null : number)}
              className={`flex w-full items-start gap-3 rounded-lg text-left ${focusRing}`}
            >
              <span className="mt-0.5 grid size-5 flex-none place-items-center rounded bg-white/[0.08] text-[12px] tabular-nums text-zinc-300">
                {number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] text-zinc-200">{sourceLabel(source)}</span>
                {sourceMeta(source) && <span className="mt-0.5 block text-[13px] text-zinc-500">{sourceMeta(source)}</span>}
              </span>
              <ChevronDown
                size={14}
                className={`mt-1 flex-none text-zinc-500 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && source.excerpt && (
              <p className="qpc-rise ml-8 mt-2 border-l border-white/[0.14] pl-3 text-[16px] leading-[1.65] text-zinc-400">
                {source.excerpt}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Messages                                                                   */
/* -------------------------------------------------------------------------- */

function AssistantMessage({ message, details }: { message: Message; details: TurnDetails }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [view, setView] = useState<'answer' | 'sources'>('answer');
  const hasSources = details.sources.length > 0;
  const activeView = hasSources ? view : 'answer';

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked, nothing to do */
    }
  };

  // Listen for "querypilot:save-note" to persist this answer as a note.
  const saveNote = () => {
    setSaved(true);
    window.dispatchEvent(
      new CustomEvent('querypilot:save-note', { detail: { messageId: message.id, content: message.content } })
    );
  };

  // Listen for "querypilot:message-feedback" to send this to your API.
  const giveFeedback = (value: 'up' | 'down') => {
    const next = feedback === value ? null : value;
    setFeedback(next);
    window.dispatchEvent(
      new CustomEvent('querypilot:message-feedback', { detail: { messageId: message.id, value: next } })
    );
  };

  const tabBtn = (id: 'answer' | 'sources', label: string, count?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => setView(id)}
      className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-0.5 text-[16px] transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
        view === id ? 'border-zinc-200 font-medium text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-200'
      }`}
    >
      <span>{label}</span>
      {count ? <span className="text-[13px] tabular-nums text-zinc-500">{count}</span> : null}
    </button>
  );

  const activeToggle = '!bg-white/[0.1] !text-zinc-100';

  return (
    <article className="w-full">
      {hasSources && (
        <div role="tablist" aria-label="Answer view" className="mb-5 flex gap-5 border-b border-white/[0.08]">
          {tabBtn('answer', 'Answer')}
          {tabBtn('sources', 'Sources', details.sources.length)}
        </div>
      )}

      {activeView === 'answer' ? (
        <>
          <ThoughtsTimeline thoughts={details.thoughts} durationMs={details.processingTimeMs} />

          <MarkdownAnswer
            content={message.content}
            citations={details.citations}
            onCitationClick={(index) => setSelectedSource(index)}
          />

          <SourceCards
            sources={details.sources}
            selected={selectedSource}
            onSelect={setSelectedSource}
            onShowAll={() => setView('sources')}
          />
        </>
      ) : (
        <SourcesList sources={details.sources} selected={selectedSource} onSelect={setSelectedSource} />
      )}

      {/* Answer actions: secondary to the answer, all icon buttons with labels + tooltips */}
      <div className="-ml-2 mt-5 flex flex-wrap items-center gap-0.5 text-[13px]">
        <IconButton
          label={copied ? 'Copied' : 'Copy answer'}
          icon={copied ? Check : Copy}
          size={15}
          onClick={() => void copyAnswer()}
        />
        <IconButton
          label={saved ? 'Saved to note' : 'Save to note'}
          icon={saved ? Check : BookmarkPlus}
          size={15}
          onClick={saveNote}
          disabled={saved}
        />
        <IconButton
          label="Good response"
          icon={ThumbsUp}
          size={15}
          aria-pressed={feedback === 'up'}
          onClick={() => giveFeedback('up')}
          className={feedback === 'up' ? activeToggle : ''}
        />
        <IconButton
          label="Bad response"
          icon={ThumbsDown}
          size={15}
          aria-pressed={feedback === 'down'}
          onClick={() => giveFeedback('down')}
          className={feedback === 'down' ? activeToggle : ''}
        />

        {details.groundingPassed === true && (
          <span className="ml-2 flex items-center gap-1.5 text-zinc-500">
            <ShieldCheck size={14} strokeWidth={1.75} />
            <span>Based on your sources</span>
          </span>
        )}
        {details.groundingPassed === false && (
          <span className="ml-2 flex items-center gap-1.5 text-zinc-300">
            <AlertCircle size={14} strokeWidth={1.75} />
            <span>Some parts could not be checked against your sources</span>
          </span>
        )}
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? 'Answer copied' : ''}
        </span>
      </div>
    </article>
  );
}

/** A message in the thread: right-aligned, light surface, no heavy card. */
function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-white/[0.06] px-4 py-2.5 text-[16px] leading-6 text-zinc-100 [overflow-wrap:anywhere]">
        {content}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Composer                                                                   */
/*  The sources a question is answered from are chosen in the sidebar.         */
/* -------------------------------------------------------------------------- */

type ComposerProps = {
  value: string;
  setValue: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  onStop: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  totalCount: number;
};

/** Shared behaviour of the two composers: Enter to send, auto-grow, focus on desktop. */
function useComposer({
  value,
  onSend,
  sending,
  textareaRef,
  maxHeight,
}: Pick<ComposerProps, 'value' | 'onSend' | 'sending' | 'textareaRef'> & { maxHeight: number }) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!sending) onSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, textareaRef, maxHeight]);

  // Focus on desktop when the box appears and after each answer finishes.
  useEffect(() => {
    if (sending) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [sending, textareaRef]);

  return handleKeyDown;
}

function SendButton({
  sending,
  canSend,
  onSend,
  onStop,
}: {
  sending: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  return (
    <button
      type="button"
      onClick={sending ? onStop : onSend}
      disabled={!sending && !canSend}
      aria-label={sending ? 'Stop generating' : 'Send message'}
      title={sending ? 'Stop generating' : 'Send message (Enter)'}
      className={`grid size-9 flex-none place-items-center rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
        sending
          ? 'bg-white/[0.08] text-zinc-100 ring-1 ring-inset ring-white/[0.2] hover:bg-white/[0.14]'
          : canSend
            ? 'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200'
            : 'cursor-not-allowed bg-white/[0.06] text-zinc-600'
      }`}
    >
      {sending ? <Square size={12} fill="currentColor" /> : <ArrowUp size={17} strokeWidth={2.2} />}
    </button>
  );
}

// A real border, not a ring: rings are box-shadows, which get anti-aliased unevenly at fractional zoom
// (90%, 110%...) and look patchy. Borders snap to whole pixels. The fill is a white tint, so it always
// sits correctly on whatever colour the page behind it is.
const COMPOSER_SURFACE =
  'rounded-xl border border-white/[0.1] bg-white/[0.035] transition-colors duration-150 motion-reduce:transition-none focus-within:border-white/[0.25]';

/** Empty-state composer: larger box with a status line under the text. */
function HeroComposer(props: ComposerProps) {
  const { value, setValue, onSend, sending, onStop, textareaRef, totalCount } = props;
  const canSend = value.trim().length > 0;
  const handleKeyDown = useComposer({ value, onSend: () => canSend && onSend(), sending, textareaRef, maxHeight: 240 });

  return (
    <div className={COMPOSER_SURFACE}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        placeholder="Ask anything about your sources"
        aria-label="Message"
        className="qpc-composer-textarea block max-h-60 min-h-[72px] w-full resize-none border-0 bg-transparent px-4 pb-2 pt-3.5 text-[16px] leading-6 text-zinc-100 outline-none placeholder:text-[#9aa0a8] sm:min-h-[88px] sm:px-5"
      />

      <div className="flex items-center justify-between gap-3 px-3 pb-3 pl-4 sm:pl-5">
        <span className="min-w-0 truncate text-[13px] tabular-nums text-zinc-500">
          {totalCount === 0
            ? 'No sources yet'
            : `Searching ${totalCount} ${totalCount === 1 ? 'source' : 'sources'}`}
          <span className="hidden text-zinc-600 md:inline"> · Shift + Enter for a new line</span>
        </span>
        <SendButton sending={sending} canSend={canSend} onSend={onSend} onStop={onStop} />
      </div>
    </div>
  );
}

/**
 * Docked composer once a conversation exists.
 * The wrapper is transparent on purpose: it takes the exact colour of the chat area behind it,
 * so there is no darker strip along the bottom of the page.
 */
function Composer(props: ComposerProps) {
  const { value, setValue, onSend, sending, onStop, textareaRef } = props;
  const canSend = value.trim().length > 0;
  const handleKeyDown = useComposer({ value, onSend: () => canSend && onSend(), sending, textareaRef, maxHeight: 176 });

  return (
    <div className="flex-none bg-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <div className={COLUMN}>
        <div className={`flex items-end gap-2 p-2 pl-4 ${COMPOSER_SURFACE}`}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask a follow-up"
            aria-label="Message"
            className="qpc-composer-textarea block max-h-44 min-h-[36px] w-full min-w-0 flex-1 resize-none border-0 bg-transparent py-1.5 text-[16px] leading-6 text-zinc-100 outline-none placeholder:text-[#9aa0a8]"
          />
          <SendButton sending={sending} canSend={canSend} onSend={onSend} onStop={onStop} />
        </div>
        <p className="mt-2 text-center text-[13px] leading-5 text-zinc-500">
          Answers come from your sources. Check key details in the citations.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Starter prompts                                                            */
/* -------------------------------------------------------------------------- */

function SuggestionGrid({
  items,
  disabled,
  onPick,
  onRefresh,
}: {
  items: Suggestion[];
  disabled: boolean;
  onPick: (prompt: string) => void;
  onRefresh?: () => void;
}) {
  return (
    <section aria-label="Starter prompts">
      <div className="mb-2 flex h-9 items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-zinc-500">Try asking</p>
        {onRefresh && (
          <PixelDissolveButton
            type="button"
            label="Refresh"
            onClick={onRefresh}
            color="transparent"
            textColor="#a1a1aa"
            dissolveColor="rgba(255,255,255,0.28)"
            cellSize={4}
            className={`${GHOST_BUTTON} ${focusRing}`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onPick(item.prompt)}
            disabled={disabled}
            title={disabled ? 'Add a source to use this prompt' : 'Fills the message box so you can edit it'}
            className={`flex flex-col gap-1 rounded-lg border border-white/[0.08] p-3.5 text-left transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none md:p-4 ${focusRing}`}
          >
            <span className="truncate text-[16px] font-medium leading-6 text-zinc-100">{item.title}</span>
            <span className="text-[13px] leading-5 text-zinc-400">{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chat view                                                                  */
/*  Layout: [scrolling message list] [composer]. The page never       */
/*  scrolls; only the message list does, so the composer can't cover content.  */
/* -------------------------------------------------------------------------- */

export function ChatView({
  conversationId,
  workspaceId,
}: {
  conversationId?: string;
  workspaceId?: number;
}) {
  const router = useRouter();
  const chatCache = useChatCache();
  // researchOptions ({ web, fast }) is available from useWorkspaceUi() if the API should receive it.
  const { sourceCount } = useWorkspaceUi();
  const isDraft = !conversationId || conversationId === 'new';
  const initialId = isDraft ? null : Number(conversationId);
  const [resolvedId, setResolvedId] = useState<number | null>(
    initialId && Number.isFinite(initialId) ? initialId : null
  );
  const cachedInitial = !isDraft && initialId !== null ? chatCache.getCached(initialId) : undefined;
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    isDraft
      ? {
          id: -1,
          title: 'New chat',
          workspace: workspaceId ?? -1,
          created_by: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        }
      : cachedInitial ?? null
  );
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(!isDraft && !cachedInitial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [turnDetails, setTurnDetails] = useState<Record<number, TurnDetails>>({});
  const [rateLimited, setRateLimited] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [requestStopped, setRequestStopped] = useState(false);
  const [liveAssistant, setLiveAssistant] = useState<LiveAssistant | null>(null);
  const [greeting, setGreeting] = useState('');
  const [firstName, setFirstName] = useState('');
  const [promptPage, setPromptPage] = useState(0);
  // null = still loading, 'unavailable' = the list could not be fetched
  const [workspaceDocs, setWorkspaceDocs] = useState<unknown[] | 'unavailable' | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // Kinds of the workspace's files (spreadsheets, written documents, or both) pick the starter prompts,
  // so a salary sheet never gets a "find deadlines" card. Unknown until the list has loaded.
  const docKinds = useMemo<DocKinds | null>(
    () => {
      if (workspaceDocs === null) return null;
      // Could not check: offer every starter prompt rather than none.
      if (workspaceDocs === 'unavailable') return { text: true, table: true };
      return docKindsFrom(workspaceDocs);
    },
    [workspaceDocs]
  );

  const loadConversation = useCallback(async () => {
    if (isDraft) {
      setLoading(false);
      return;
    }
    if (initialId === null || !Number.isInteger(initialId) || initialId <= 0) {
      setError('Invalid conversation.');
      setLoading(false);
      return;
    }

    const hydrate = (data: ConversationDetail) => {
      const hydrated: Record<number, TurnDetails> = {};
      for (const item of data.messages) {
        if (item.role === 'ASSISTANT') hydrated[item.id] = metadataForMessage(item);
      }
      setTurnDetails(hydrated);
    };

    // Cached: paint instantly, no loading state, no network call.
    const cached = chatCache.getCached(initialId);
    if (cached) {
      setResolvedId(cached.id);
      setConversation(cached);
      hydrate(cached);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // getOrFetch merges concurrent calls for the same id into one request.
      const data = await chatCache.getOrFetch(initialId);
      if (data.workspace !== workspaceId) {
        setConversation(null);
        setError('This conversation does not belong to the selected workspace.');
        return;
      }
      setResolvedId(data.id);
      setConversation(data);
      hydrate(data);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 401 || apiError.status === 403) {
        authApi.clearTokens();
        router.replace('/login');
        return;
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [chatCache, initialId, isDraft, router, workspaceId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Greeting depends on the visitor's local time, so it is set after mount.
  useEffect(() => {
    setGreeting(timeGreeting());
  }, []);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (!cancelled) setFirstName(firstNameFrom(me));
      })
      .catch(() => {
        /* the greeting simply omits the name */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The workspace's files, refreshed whenever the sidebar adds or removes one.
  useEffect(() => {
    if (!workspaceId) {
      setWorkspaceDocs([]);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      documentApi
        .list(workspaceId)
        .then((docs: unknown[]) => {
          if (!cancelled) setWorkspaceDocs(docs);
        })
        .catch(() => {
          if (!cancelled) setWorkspaceDocs('unavailable');
        });
    };
    refresh();
    window.addEventListener('querypilot:workspace-documents-changed', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('querypilot:workspace-documents-changed', refresh);
    };
  }, [workspaceId]);

  // "New chat" on the draft page does not navigate (same URL), so the shell
  // sends this event and we reset to a clean draft in place.
  useEffect(() => {
    if (!isDraft) return;
    const handleNewChatRequested = () => {
      abortRef.current?.abort();
      abortRef.current = null;
      requestRef.current = null;
      setResolvedId(null);
      setConversation({
        id: -1,
        title: 'New chat',
        workspace: workspaceId ?? -1,
        created_by: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
      });
      setMessage('');
      setError('');
      setTurnDetails({});
      setRateLimited(false);
      setRequestFailed(false);
      setRequestStopped(false);
      setLiveAssistant(null);
      setSending(false);
    };
    window.addEventListener('querypilot:new-chat-requested', handleNewChatRequested);
    return () => {
      window.removeEventListener('querypilot:new-chat-requested', handleNewChatRequested);
    };
  }, [isDraft, workspaceId]);

  // The message list is its own scroll container. Only follow new content
  // when the person is already near the bottom.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  };

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation?.messages.length, liveAssistant?.content, liveAssistant?.thoughts.length, sending]);

  const sendMessage = async (override?: string) => {
    const text = (override ?? message).trim();
    if (!text || sending) return;

    if (override === undefined) setMessage('');
    setError('');
    setRateLimited(false);
    setRequestFailed(false);
    setRequestStopped(false);
    setSending(true);
    shouldAutoScrollRef.current = true;

    let activeId = resolvedId;
    let createdConversation: Conversation | null = null;
    const startedAsDraft = activeId === null;

    if (activeId === null) {
      if (!workspaceId) {
        setError('No active workspace selected.');
        setSending(false);
        return;
      }
      try {
        createdConversation = await chatApi.createConversation(workspaceId);
        activeId = createdConversation.id;
        setResolvedId(activeId);
        setConversation((current) => ({
          ...(current ?? createdConversation!),
          ...createdConversation!,
          messages: current?.messages ?? [],
        }));
      } catch (err) {
        setError(errorMessage(err));
        setSending(false);
        return;
      }
    }

    const optimisticUser: Message = {
      id: nextOptimisticId(),
      role: 'USER',
      content: text,
      created_at: new Date().toISOString(),
    };
    setConversation((current) => {
      const updated = current ? { ...current, messages: [...current.messages, optimisticUser] } : current;
      if (updated && activeId) chatCache.setCached(activeId, updated);
      return updated;
    });

    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = `${Date.now()}-${Math.random()}`;
    requestRef.current = requestId;
    const startedAt = Date.now();
    let streamedAnswer = '';
    let localThoughts: ThoughtRecord[] = [];
    let completed = false;
    let failed = false;
    let accepted = false;
    let latestTitle: string | null = null;

    setLiveAssistant({
      id: requestId,
      content: '',
      sources: [],
      citations: [],
      groundingPassed: null,
      route: null,
      thoughts: [],
      completed: false,
    });

    try {
      await streamChat(
        { conversation_id: activeId!, message: text },
        (event) => {
          if (requestRef.current !== requestId) return;
          if (event.event === 'query_received') accepted = true;

          if (event.event === 'answer_delta') {
            const delta = typeof event.data?.delta === 'string' ? event.data.delta : '';
            if (!delta) return;
            streamedAnswer += delta;
            setLiveAssistant((current) =>
              current && current.id === requestId ? { ...current, content: current.content + delta } : current
            );
            return;
          }

          const rawStatus = event.data?.status;
          const status =
            event.event === 'agent_error' || event.event === 'error' || rawStatus === 'failed'
              ? 'failed'
              : rawStatus === 'started'
                ? 'started'
                : 'completed';

          const thoughtMessage =
            event.message || (typeof event.data?.error === 'string' ? event.data.error : event.event);

          localThoughts = mergeThought(localThoughts, { event: event.event, message: thoughtMessage, status });
          setLiveAssistant((current) =>
            current && current.id === requestId ? { ...current, thoughts: localThoughts } : current
          );

          if (event.event === 'agent_error' || event.event === 'error') {
            failed = true;
            setRequestFailed(true);
            setError(thoughtMessage);
          }

          if (event.event === 'complete') {
            completed = true;
            if (failed) return;
            const data = event.data ?? {};
            if (data.status === 'rate_limited') {
              setRateLimited(true);
              setError(event.message || 'Chat quota limit reached. Please try again later.');
              return;
            }
            const nextSources = Array.isArray(data.sources) ? (data.sources as UiSource[]) : [];
            const nextCitations = Array.isArray(data.citations) ? normalizeCitations(data.citations) : [];
            const nextGrounding = typeof data.grounding_passed === 'boolean' ? data.grounding_passed : null;
            const nextRoute = typeof data.route === 'string' ? data.route : null;
            const nextTitle = typeof data.conversation_title === 'string' ? data.conversation_title : null;
            const finalAnswer = typeof data.answer === 'string' ? data.answer : streamedAnswer;
            const durationMs = Date.now() - startedAt;

            setLiveAssistant((current) =>
              current && current.id === requestId
                ? {
                    ...current,
                    content: finalAnswer || current.content,
                    sources: nextSources,
                    citations: nextCitations,
                    groundingPassed: nextGrounding,
                    route: nextRoute,
                    thoughts: localThoughts,
                    completed: true,
                  }
                : current
            );

            if (nextTitle) {
              latestTitle = nextTitle;
              setConversation((current) => (current ? { ...current, title: nextTitle } : current));
              if (activeId) chatCache.patchTitle(activeId, nextTitle);
              window.dispatchEvent(
                new CustomEvent('querypilot:conversation-changed', {
                  detail: { conversationId: activeId, title: nextTitle },
                })
              );
            }

            if (finalAnswer) {
              const localId = nextOptimisticId();
              const assistant: MessageWithMetadata = {
                id: localId,
                role: 'ASSISTANT',
                content: finalAnswer,
                created_at: new Date().toISOString(),
                metadata: {
                  sources: nextSources,
                  citations: nextCitations,
                  thoughts: localThoughts,
                  grounding_passed: nextGrounding,
                  route: nextRoute,
                  processing_time_ms: durationMs,
                },
              };
              setConversation((current) => {
                const updated = current ? { ...current, messages: [...current.messages, assistant] } : current;
                if (updated && activeId) chatCache.setCached(activeId, updated);
                return updated;
              });
              setTurnDetails((current) => ({
                ...current,
                [localId]: {
                  thoughts: localThoughts,
                  sources: nextSources,
                  citations: nextCitations,
                  groundingPassed: nextGrounding,
                  route: nextRoute,
                  processingTimeMs: durationMs,
                },
              }));
            }
          }
        },
        { signal: controller.signal }
      );

      if (!completed && !failed && !controller.signal.aborted) {
        setRequestFailed(true);
        setError('The response stream ended before QueryPilot returned a completed answer.');
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        failed = true;
        setRequestFailed(true);
        setError(errorMessage(err));
      }
    } finally {
      if (requestRef.current === requestId) {
        requestRef.current = null;
        abortRef.current = null;
        setSending(false);
      }

      if (startedAsDraft && createdConversation && workspaceId) {
        const created = createdConversation;
        if (accepted) {
          // The server took the question, so this chat is real, even if the answer failed or was stopped.
          // Put it in the sidebar with a clean title instead of leaving it to show up later as "New chat".
          const title = latestTitle ?? fallbackTitle(text);
          setConversation((current) => {
            if (current) chatCache.setCached(created.id, current);
            return current;
          });
          window.dispatchEvent(
            new CustomEvent('querypilot:conversation-changed', {
              detail: { conversation: { ...created, title } },
            })
          );
          window.history.replaceState(null, '', `/workspaces/${workspaceId}/chat/${created.id}`);
        } else {
          // The question never reached the server: remove the empty chat so it does not pile up in the sidebar,
          // and let the next send start a fresh one.
          void discardConversation(created.id);
          setResolvedId(null);
          setConversation((current) => (current ? { ...current, id: -1, title: 'New chat' } : current));
        }
      }
    }
  };

  const stopGeneration = () => {
    requestRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setRequestStopped(true);
  };

  if (loading) {
    return <PageLoader label="Loading conversation" />;
  }

  if (!conversation) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-6 text-[16px] text-red-300">
        {error || 'Conversation not found.'}
      </div>
    );
  }

  const messages = conversation.messages;
  const showHero = messages.length === 0 && !liveAssistant?.content;

  const copy = greeting
    ? heroCopy(sourceCount, greeting, firstName)
    : { title: '', body: '' };

  // Starter prompts that fit the workspace's files, rotated by "Refresh".
  const pool = SUGGESTIONS.filter((item) => suggestionFits(item, sourceCount, docKinds));
  const visibleSuggestions =
    pool.length === 0
      ? []
      : Array.from(
          { length: Math.min(SUGGESTIONS_PER_VIEW, pool.length) },
          (_, offset) => pool[(promptPage * SUGGESTIONS_PER_VIEW + offset) % pool.length]
        );

  // A starter prompt fills the box so the person can edit it before sending.
  const pickSuggestion = (prompt: string) => {
    setMessage(prompt);
    composerRef.current?.focus();
  };

  const composerProps: ComposerProps = {
    value: message,
    setValue: setMessage,
    onSend: () => void sendMessage(),
    sending,
    onStop: stopGeneration,
    textareaRef: composerRef,
    totalCount: sourceCount,
  };

  return (
    <div className="relative flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden bg-transparent font-sans">
      <ChatStyles />

      {showHero ? (
        <div className={`min-h-0 flex-1 overflow-y-auto ${scrollbar}`}>
          {/*
            Three rows: heading (bottom-aligned), composer, prompts (top-aligned). The outer rows share the leftover
            height equally, so the composer sits on the vertical centre of the available area whatever the screen
            size or sidebar width; on short screens the rows simply grow and the page scrolls.
          */}
          <div className={`${HERO_COLUMN} grid min-h-full grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] py-6 sm:py-8`}>
            <div className="flex flex-col justify-end pb-5 sm:pb-7">
              <h1 className="text-[24px] font-medium leading-[1.2] tracking-tight text-zinc-50 [text-wrap:balance] sm:text-[28px] xl:text-[32px]">
                {copy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-[16px] leading-6 text-zinc-400">{copy.body}</p>
            </div>

            <div>
              <HeroComposer {...composerProps} />
              {error && (
                <p role="alert" className="mt-4 text-[16px] text-red-300">
                  {error}
                </p>
              )}
            </div>

            <div className="pt-5 sm:pt-7">
              {docKinds !== null && visibleSuggestions.length > 0 && (
                <SuggestionGrid
                  items={visibleSuggestions}
                  disabled={sending || sourceCount === 0}
                  onPick={pickSuggestion}
                  onRefresh={pool.length > SUGGESTIONS_PER_VIEW ? () => setPromptPage((page) => page + 1) : undefined}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* The only scrolling element in the chat. The gutter is reserved on both sides so the column never shifts. */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={`min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)] [scrollbar-gutter:stable_both-edges] ${scrollbar}`}
          >
            <div className={`${COLUMN} pb-12 pt-8 lg:pt-12`}>
              <div className="space-y-10">
                {messages.map((item) => {
                  if (item.role === 'USER') {
                    return <UserMessage key={item.id} content={item.content} />;
                  }
                  const details = turnDetails[item.id] ?? metadataForMessage(item);
                  return <AssistantMessage key={item.id} message={item} details={details} />;
                })}

                {sending && liveAssistant && !liveAssistant.content && (
                  <LiveThoughts thoughts={liveAssistant.thoughts} />
                )}

                {liveAssistant && !liveAssistant.completed && liveAssistant.content && (
                  <div className="w-full">
                    <ThoughtsTimeline thoughts={liveAssistant.thoughts} isLive={sending} />
                    <MarkdownAnswer
                      content={liveAssistant.content}
                      citations={liveAssistant.citations}
                      onCitationClick={() => {}}
                    />
                  </div>
                )}

                {requestFailed && error && !rateLimited && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3.5 py-2.5 text-[16px] text-red-200"
                  >
                    {error}
                  </div>
                )}
                {rateLimited && (
                  <div
                    role="alert"
                    className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-zinc-300"
                  >
                    {error}
                  </div>
                )}
                {requestStopped && !error && <div className="text-[16px] text-zinc-500">Generation stopped.</div>}
              </div>
            </div>
          </div>

          <Composer {...composerProps} />
        </>
      )}
    </div>
  );
}

export default ChatView;