"use client";

import { useRouter } from "next/navigation";

import {

  ChevronDown,

  ChevronUp,

  FileText,

  LoaderCircle,

  Sparkles,

  Check,

  X,

} from "lucide-react";

import { PixelDissolveButton } from "@/components/pixel-dissolve-button";

import ReactMarkdown, { type Components } from "react-markdown";

import remarkGfm from "remark-gfm";

import type { Root, Text as MdastText } from "mdast";

import { visit } from "unist-util-visit";

import {

  useCallback,

  useEffect,

  useMemo,

  useRef,

  useState,

  type KeyboardEvent,

} from "react";

import {

  authApi,

  chatApi,

  streamChat,

  type ApiError,

  type ChatSource,

  type Conversation,

  type ConversationDetail,

  type Message,

} from "@/lib/django-api";

import { useChatCache } from "@/components/chat-context";

type StreamEvent = {

  id: string;

  event: string;

  status: "started" | "completed" | "failed" | "info";

  message: string;

  data?: Record<string, unknown>;

};

type ThoughtRecord = {

  event: string;

  message: string;

  status?: string;

};

type CitationRecord = {

  index: number;

  source_index: number;

};

type UiSource = ChatSource & {

  index?: number;

};

type MessageMetadata = {

  sources?: UiSource[];

  citations?: CitationRecord[];

  thoughts?: ThoughtRecord[];

  grounding_passed?: boolean | null;

  route?: string | null;

};

type MessageWithMetadata = Message & {

  metadata?: MessageMetadata;

};

type AnswerTab = "answer" | "sources" | "thoughts";

type TurnDetails = {

  thoughts: ThoughtRecord[];

  sources: UiSource[];

  citations: CitationRecord[];

  groundingPassed: boolean | null;

  route: string | null;

};

// Monotonic counter so two optimistic messages created within the same

// millisecond never collide on id (Date.now() alone is not unique enough

// under fast typing / rapid sends, and negative-id React keys must stay

// distinct for the lifetime of the conversation view).

let optimisticIdCounter = 0;

function nextOptimisticId() {

  optimisticIdCounter -= 1;

  return optimisticIdCounter;

}

function isRecord(value: unknown): value is Record<string, unknown> {

  return typeof value === "object" && value !== null && !Array.isArray(value);

}

function errorMessage(error: unknown) {

  return error instanceof Error ? error.message : "Something went wrong. Please try again.";

}

function getMetadata(message: Message): MessageMetadata {

  const metadata = (message as MessageWithMetadata).metadata;

  return isRecord(metadata) ? (metadata as MessageMetadata) : {};

}

function normalizeThoughts(value: unknown): ThoughtRecord[] {

  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {

    if (!isRecord(item)) return [];

    const event = typeof item.event === "string" ? item.event : "";

    const message = typeof item.message === "string" ? item.message : "";

    const status = typeof item.status === "string" ? item.status : undefined;

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

      ? [{ index, source_index: sourceIndex }]

      : [];

  });

}

function metadataForMessage(message: Message): TurnDetails {

  const metadata = getMetadata(message);

  return {

    thoughts: normalizeThoughts(metadata.thoughts),

    sources: normalizeSources(metadata.sources),

    citations: normalizeCitations(metadata.citations),

    groundingPassed: typeof metadata.grounding_passed === "boolean" ? metadata.grounding_passed : null,

    route: typeof metadata.route === "string" ? metadata.route : null,

  };

}

/**

 * Turns a plain-text "[3]" into a link node pointing at

 * #querypilot-citation-3, but ONLY inside plain text mdast nodes — never

 * inside existing markdown links, code spans, or other inline nodes.

 * This is a proper AST transform (via remark, before rendering) instead of

 * a regex run against raw markdown source, so it can't misfire on

 * legitimate `[text]\\\\(url)` links or bracketed prose that isn't a citation.

 */

function remarkCitationLinks(validIndices: Set<number>) {

  return (tree: Root) => {

    if (validIndices.size === 0) return;

    visit(tree, "text", (node: MdastText, index, parent) => {

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

          replacement.push({ type: "text", value: value.slice(lastEnd, match.index) });

        }

        if (validIndices.has(citationIndex)) {

          replacement.push(linkNode(citationIndex, match[0]));

        }

        lastEnd = match.index + match[0].length;

      }

      if (!changed) return;

      if (lastEnd < value.length) {

        replacement.push({ type: "text", value: value.slice(lastEnd) });

      }

      (parent.children as unknown[]).splice(index, 1, ...replacement);

      return index + replacement.length;

    });

  };

}

function linkNode(citationIndex: number, label: string) {

  return {

    type: "link" as const,

    url: `#querypilot-citation-${citationIndex}`,

    children: [{ type: "text" as const, value: label }],

  };

}

function sourceLabel(source: UiSource) {

  return source.document_name || "Document source";

}

function sourceMeta(source: UiSource) {

  const parts: string[] = [];

  if (source.page_start !== undefined && source.page_start !== null) {

    parts.push(

      source.page_end && source.page_end !== source.page_start

        ? `Pages ${source.page_start}\u2013${source.page_end}`

        : `Page ${source.page_start}`,

    );

  }

  if (source.heading) parts.push(source.heading);

  if (source.table_name) parts.push(`Table: ${source.table_name}`);

  if (source.chunk_index !== undefined && source.chunk_index !== null) parts.push(`Chunk ${source.chunk_index}`);

  return parts.join(" \u00b7 ");

}

function TabButton({

  label,

  count,

  active,

  onClick,

}: {

  label: string;

  count?: number;

  active: boolean;

  onClick: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={`relative flex h-9 items-center gap-2 rounded-none px-3 text-[12px] font-medium tracking-[-0.005em] transition ${

        active ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"

      }`}

    >

      <span>{label}</span>

      {typeof count === "number" && count > 0 && (

        <span className={`min-w-4 rounded-[5px] border border-white/[0.07] px-1 py-0.5 text-center text-[9px] leading-none ${active ? "border-primary/15 bg-primary/[0.10] text-primary/90" : "bg-white/[0.035] text-foreground/45"}`}>{count}</span>

      )}

      {active && <span className="absolute inset-x-2 -bottom-px h-px rounded-full bg-primary shadow-[0_0_10px_rgba(13,148,136,0.7)]" />}

    </button>

  );

}

function ThinkingBlock({

  events,

  open,

  onToggle,

  failed,

  stopped,

}: {

  events: StreamEvent[];

  open: boolean;

  onToggle: () => void;

  failed: boolean;

  stopped: boolean;

}) {

  if (events.length === 0) return null;

  const latest = events[events.length - 1];

  const title = failed ? "Generation failed" : stopped ? "Generation stopped" : "Thinking";

  return (

    <div className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.015] px-5 py-4 shadow-[0_12px_38px_rgba(0,0,0,0.12)]">

      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">

        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/[0.07] text-primary">

          {failed ? <X size={13} /> : stopped ? <Check size={13} /> : <LoaderCircle size={13} className="animate-spin" />}

        </span>

        <span className="flex-1 text-[13px] font-medium text-foreground">{title}</span>

        <span className="max-w-[55%] truncate text-[11px] text-muted-foreground">{latest.message}</span>

        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}

      </button>

      {open && (

        <div className="mt-4 ml-9 space-y-3 border-l border-white/10 pl-5">

          {events.map((eventItem, index) => (

            <div key={`${eventItem.event}-${index}`} className="relative">

              <span

                className={`absolute -left-[25px] top-1 grid size-3 place-items-center rounded-full border ${

                  eventItem.status === "completed"

                    ? "border-emerald-400/70 bg-emerald-400/15"

                    : eventItem.status === "failed"

                      ? "border-red-400/70 bg-red-400/15"

                      : eventItem.status === "started"

                        ? "border-primary bg-primary/10"

                        : "border-white/20 bg-background"

                }`}

              >

                {eventItem.status === "completed" && <Check size={8} className="text-emerald-300" />}

              </span>

              <p className="text-[12px] leading-5 text-foreground/80">{eventItem.message}</p>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}

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

    h1: ({ children }) => <h1 className="mb-4 mt-7 text-xl font-medium tracking-[-0.03em] text-foreground">{children}</h1>,

    h2: ({ children }) => <h2 className="mb-4 mt-7 text-[17px] font-medium tracking-[-0.015em] text-foreground">{children}</h2>,

    h3: ({ children }) => <h3 className="mb-2 mt-5 text-[14px] font-semibold text-foreground">{children}</h3>,

    p: ({ children }) => <p className="my-3 text-[14px] leading-7 text-foreground/88">{children}</p>,

    ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6 text-[14px] leading-7 text-foreground/88">{children}</ul>,

    ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-[14px] leading-7 text-foreground/88">{children}</ol>,

    li: ({ children }) => <li className="pl-1">{children}</li>,

    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,

    em: ({ children }) => <em className="text-foreground/95">{children}</em>,

    blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary/40 pl-4 text-foreground/65">{children}</blockquote>,

    code: ({ className, children, ...props }) => {

      const isBlock = Boolean(className);

      return isBlock ? (

        <code className="block overflow-x-auto rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 font-mono text-[12px] leading-6 text-foreground/85" {...props}>{children}</code>

      ) : (

        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-foreground/95" {...props}>{children}</code>

      );

    },

    pre: ({ children }) => <pre className="my-4 overflow-x-auto">{children}</pre>,

    table: ({ children }) => <div className="my-5 overflow-x-auto"><table className="min-w-full border-collapse text-[13px]">{children}</table></div>,

    th: ({ children }) => <th className="border-b border-white/10 bg-white/[0.025] px-3 py-2 text-left font-medium text-foreground">{children}</th>,

    td: ({ children }) => <td className="border-b border-white/5 px-3 py-2 text-foreground/80">{children}</td>,

    a: ({ href, children }) => {

      const match = typeof href === "string" ? href.match(/^#querypilot-citation-(\d+)$/) : null;

      if (match) {

        const index = Number(match[1]);

        return (

          <button

            type="button"

            onClick={() => onCitationClick(index)}

            className="mx-0.5 inline-flex min-w-[18px] items-center justify-center rounded-[5px] border border-primary/20 bg-primary/[0.07] px-1 py-0.5 align-[1px] text-[10px] font-medium leading-none text-primary/90 transition hover:border-primary/40 hover:bg-primary/[0.13]"

            title={`Source ${index}`}

          >

            {children}

          </button>

        );

      }

      return <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline decoration-primary/30 underline-offset-2">{children}</a>;

    },

  };

  return <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>{content}</ReactMarkdown>;

}

function SourceList({

  sources,

  highlightedIndex,

}: {

  sources: UiSource[];

  highlightedIndex: number | null;

}) {

  if (!sources.length) return <p className="py-8 text-sm text-muted-foreground">No source data available for this response.</p>;

  return (

    <div className="divide-y divide-white/[0.07]">

      {sources.map((source, index) => {

        const actualIndex = source.index ?? index + 1;

        return (

          <div

            id={`querypilot-source-${actualIndex}`}

            key={`${source.document_id}-${actualIndex}-${index}`}

            className={`flex items-start gap-3 py-4 ${highlightedIndex === actualIndex ? "bg-primary/[0.04]" : ""}`}

          >

            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.02] text-muted-foreground">

              <FileText size={14} />

            </span>

            <div className="min-w-0 flex-1">

              <p className="truncate text-[13px] font-medium text-foreground">{sourceLabel(source)}</p>

              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{sourceMeta(source) || source.source_type || "Source"}</p>

            </div>

            <span className="text-[11px] font-medium text-primary/80">[{actualIndex}]</span>

          </div>

        );

      })}

    </div>

  );

}

// Single, module-level style block for the thought-list entrance animation.

// Previously this was injected per-message via `<style jsx>`, which (a)

// depends on the styled-jsx Babel plugin being wired into the build, which

// most App Router + SWC setups do not have by default, and (b) re-declared

// the same @keyframes once per assistant message in the conversation.

// Rendering it once, keyed by id, at module scope avoids both problems and

// respects prefers-reduced-motion.

function ThoughtAnimationStyles() {

  return (

    <style

      // eslint-disable-next-line react/no-danger

      dangerouslySetInnerHTML={{

        __html: `

        @keyframes querypilot-thought-in {

          0% { opacity: 0; transform: translateY(7px); }

          100% { opacity: 1; transform: translateY(0); }

        }

        @keyframes querypilot-thought-line {

          0% { transform: scaleY(0); transform-origin: top; opacity: 0.12; }

          100% { transform: scaleY(1); transform-origin: top; opacity: 1; }

        }

        @keyframes querypilot-thought-pulse {

          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.02); }

          50% { box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.08); }

        }

        @media (prefers-reduced-motion: reduce) {

          .querypilot-thought-step, .querypilot-thought-line, .querypilot-thought-dot {

            animation: none !important;

          }

        }

      `,

      }}

    />

  );

}

function ThoughtsList({ thoughts }: { thoughts: ThoughtRecord[] }) {

  if (!thoughts.length) return <p className="py-8 text-sm text-muted-foreground">No thought/progress details were stored for this response.</p>;

  return (

    <div className="relative ml-2 pl-7">

      <span

        aria-hidden="true"

        className="querypilot-thought-line absolute bottom-1 left-0 top-1 w-px bg-gradient-to-b from-white/40 via-white/10 to-white/[0.03]"

        style={{ animation: "querypilot-thought-line 420ms cubic-bezier(0.22, 1, 0.36, 1) both" }}

      />

      <div className="space-y-4">

        {thoughts.map((thought, index) => (

          <div

            key={`${thought.event}-${index}`}

            className="querypilot-thought-step relative"

            style={{

              animation: "querypilot-thought-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both",

              animationDelay: `${Math.min(index * 90, 540)}ms`,

            }}

          >

            <span

              aria-hidden="true"

              className="querypilot-thought-dot absolute -left-[31px] top-1 grid size-3 place-items-center rounded-full border border-white/30 bg-[#070707]"

              style={{

                animation: index === thoughts.length - 1

                  ? "querypilot-thought-pulse 1.8s ease-in-out infinite"

                  : "none",

              }}

            >

              <span className="size-1 rounded-full bg-white/70" />

            </span>

            <div className="min-w-0">

              <p className="text-[12px] font-medium leading-5 text-foreground/90">{thought.message || thought.event}</p>

              {thought.event && thought.message && thought.event !== thought.message && (

                <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/55">{thought.event.replaceAll("_", " ")}</p>

              )}

            </div>

          </div>

        ))}

      </div>

    </div>

  );

}

function AssistantMessage({

  message,

  details,

}: {

  message: Message;

  details: TurnDetails;

}) {

  const [tab, setTab] = useState<AnswerTab>("answer");

  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);

  const onCitationClick = (index: number) => {

    setHighlightedSource(index);

    setTab("sources");

    window.setTimeout(() => {

      document.getElementById(`querypilot-source-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

    }, 0);

  };

  return (

    <article className="w-full max-w-[820px] py-1">

      <div className="flex items-center gap-1 border-b border-white/[0.08] pb-0">

        <TabButton label="Answer" active={tab === "answer"} onClick={() => setTab("answer")} />

        <TabButton label="Sources" count={details.sources.length} active={tab === "sources"} onClick={() => setTab("sources")} />

        <TabButton label="Thoughts" count={details.thoughts.length} active={tab === "thoughts"} onClick={() => setTab("thoughts")} />

      </div>

      {tab === "answer" && (

        <div className="pt-1">

          <MarkdownAnswer content={message.content} citations={details.citations} onCitationClick={onCitationClick} />

        </div>

      )}

      {tab === "sources" && <SourceList sources={details.sources} highlightedIndex={highlightedSource} />}

      {tab === "thoughts" && <div className="py-5"><ThoughtsList thoughts={details.thoughts} /></div>}

    </article>

  );

}

function UserMessage({ content }: { content: string }) {

  return (

    <div className="w-full pt-2 pb-1">

      <div className="max-w-[860px] text-[21px] font-medium leading-[1.35] tracking-[-0.025em] text-foreground sm:text-[22px]">

        {content}

      </div>

    </div>

  );

}

function Composer({

  value,

  setValue,

  onSend,

  sending,

  onStop,

}: {

  value: string;

  setValue: (value: string) => void;

  onSend: () => void;

  sending: boolean;

  onStop: () => void;

}) {

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {

    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {

      event.preventDefault();

      onSend();

    }

  };

  return (

    <div className="sticky bottom-0 z-20 bg-gradient-to-t from-[#070707] via-[#070707]/96 to-transparent pb-5 pt-10">

      <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6 lg:px-0">

        <div className="rounded-[26px] border border-white/[0.10] bg-[#0a0f10]/96 p-2.5 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-all duration-300 focus-within:border-primary/30 focus-within:shadow-[0_22px_75px_rgba(0,0,0,0.42),0_0_0_4px_rgba(13,148,136,0.035)]">

          <div className="flex items-end gap-3 rounded-[20px] border border-white/[0.055] bg-white/[0.02] px-4 py-3.5">

            <textarea

              value={value}

              onChange={(event) => setValue(event.target.value)}

              onKeyDown={handleKeyDown}

              rows={1}

              disabled={sending}

              placeholder="Ask anything about your documents\u2026"

              className="min-h-12 max-h-44 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/85 disabled:opacity-60"

            />

            <PixelDissolveButton

              label={sending ? "STOP" : "SEND"}

              color={sending ? "#202428" : "#f1f3f4"}

              dissolveColor={sending ? "#7c8589" : "#a3aaad"}

              disabled={!sending && !value.trim()}

              onClick={sending ? onStop : onSend}

              className={`!min-w-0 !min-h-11 !rounded-xl !px-4 !py-0 !text-[10px] !font-medium !tracking-[0.11em] ${sending ? "!text-white" : "!text-[#111416]"} disabled:!opacity-35`}

            />

          </div>

        </div>

      </div>

    </div>

  );

}

export function ChatView({

  conversationId,

  workspaceId,

}: {

  conversationId?: string;

  workspaceId?: number;

}) {

  const router = useRouter();

  const chatCache = useChatCache();

  const isDraft = !conversationId || conversationId === "new";

  const initialId = isDraft ? null : Number(conversationId);

  const [resolvedId, setResolvedId] = useState<number | null>(initialId && Number.isFinite(initialId) ? initialId : null);

  const cachedInitial = !isDraft && initialId !== null ? chatCache.getCached(initialId) : undefined;

  const [conversation, setConversation] = useState<ConversationDetail | null>(

    isDraft

      ? {

          id: -1,

          title: "New Chat",

          workspace: workspaceId ?? -1,

          created_by: 0,

          created_at: new Date().toISOString(),

          updated_at: new Date().toISOString(),

          messages: [],

        }

      : cachedInitial ?? null,

  );

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(!isDraft && !cachedInitial);

  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");

  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);

  const [thoughtsOpen, setThoughtsOpen] = useState(true);

  const [turnDetails, setTurnDetails] = useState<Record<number, TurnDetails>>({});

  const [rateLimited, setRateLimited] = useState(false);

  const [requestFailed, setRequestFailed] = useState(false);

  const [requestStopped, setRequestStopped] = useState(false);

  const [liveAssistant, setLiveAssistant] = useState<{

    id: string;

    content: string;

    sources: UiSource[];

    citations: CitationRecord[];

    groundingPassed: boolean | null;

    route: string | null;

    thoughts: StreamEvent[];

    thoughtsOpen: boolean;

    completed: boolean;

  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const requestRef = useRef<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const shouldAutoScrollRef = useRef(true);

  const loadConversation = useCallback(async () => {

    if (isDraft) {

      setLoading(false);

      return;

    }

    if (initialId === null || !Number.isInteger(initialId) || initialId <= 0) {

      setError("Invalid conversation.");

      setLoading(false);

      return;

    }

    const hydrate = (data: ConversationDetail) => {

      const hydrated: Record<number, TurnDetails> = {};

      for (const item of data.messages) {

        if (item.role === "ASSISTANT") hydrated[item.id] = metadataForMessage(item);

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

      setError("");

      return;

    }

    setLoading(true);

    setError("");

    try {

      // getOrFetch coalesces concurrent calls for the same id into one request.

      const data = await chatCache.getOrFetch(initialId);

      if (data.workspace !== workspaceId) {

        setConversation(null);

        setError("This conversation does not belong to the selected workspace.");

        return;

      }

      setResolvedId(data.id);

      setConversation(data);

      hydrate(data);

    } catch (err) {

      const apiError = err as ApiError;

      if (apiError.status === 401 || apiError.status === 403) {

        authApi.clearTokens();

        router.replace("/login");

        return;

      }

      setError(errorMessage(err));

    } finally {

      setLoading(false);

    }

  }, [chatCache, initialId, isDraft, router, workspaceId]);

  useEffect(() => { void loadConversation(); }, [loadConversation]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // "New Chat" while already on the draft page doesn't navigate (same URL),

  // so it can't remount this component via `key`. The shell dispatches this

  // event instead; reset to a clean draft in place.

  useEffect(() => {

    if (!isDraft) return;

    const handleNewChatRequested = () => {

      abortRef.current?.abort();

      abortRef.current = null;

      requestRef.current = null;

      setResolvedId(null);

      setConversation({

        id: -1,

        title: "New Chat",

        workspace: workspaceId ?? -1,

        created_by: 0,

        created_at: new Date().toISOString(),

        updated_at: new Date().toISOString(),

        messages: [],

      });

      setMessage("");

      setError("");

      setStreamEvents([]);

      setTurnDetails({});

      setRateLimited(false);

      setRequestFailed(false);

      setRequestStopped(false);

      setLiveAssistant(null);

      setSending(false);

    };

    window.addEventListener("querypilot:new-chat-requested", handleNewChatRequested);

    return () => {

      window.removeEventListener("querypilot:new-chat-requested", handleNewChatRequested);

    };

  }, [isDraft, workspaceId]);

  // Auto-scroll to the newest content, but only if the user was already at

  // (or near) the bottom — never yank them down mid-scroll-up to reread

  // something.

  const handleScroll = useCallback(() => {

    const el = scrollContainerRef.current;

    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;

  }, []);

  useEffect(() => {

    if (!shouldAutoScrollRef.current) return;

    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

  }, [conversation?.messages.length, liveAssistant?.content, sending]);

  const sendMessage = async () => {

    const text = message.trim();

    if (!text || sending) return;

    setMessage("");

    setError("");

    setRateLimited(false);

    setRequestFailed(false);

    setRequestStopped(false);

    setSending(true);

    setStreamEvents([]);

    setThoughtsOpen(true);

    shouldAutoScrollRef.current = true;

    let activeId = resolvedId;

    let createdConversation: Conversation | null = null;

    const startedAsDraft = activeId === null;

    if (activeId === null) {

      if (!workspaceId) {

        setError("No active workspace selected.");

        setSending(false);

        return;

      }

      try {

        createdConversation = await chatApi.createConversation(workspaceId);

        activeId = createdConversation.id;

        setResolvedId(activeId);

        setConversation((current) => ({ ...(current ?? createdConversation!), ...createdConversation!, messages: current?.messages ?? [] }));

      } catch (err) {

        setError(errorMessage(err));

        setSending(false);

        return;

      }

    }

    const optimisticUser: Message = {

      id: nextOptimisticId(),

      role: "USER",

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

    let streamedAnswer = "";

    let localEvents: StreamEvent[] = [];

    let completed = false;

    let failed = false;

    let accepted = false;

    setLiveAssistant({ id: requestId, content: "", sources: [], citations: [], groundingPassed: null, route: null, thoughts: [], thoughtsOpen: true, completed: false });

    try {

      await streamChat(

        { conversation_id: activeId!, message: text },

        (event) => {

          if (requestRef.current !== requestId) return;

          if (event.event === "query_received") accepted = true;

          if (event.event === "answer_delta") {

            const delta = typeof event.data?.delta === "string" ? event.data.delta : "";

            if (!delta) return;

            streamedAnswer += delta;

            setLiveAssistant((current) => current && current.id === requestId ? { ...current, content: current.content + delta } : current);

            return;

          }

          const rawStatus = event.data?.status;

          const status: StreamEvent["status"] = event.event === "agent_error" || event.event === "error" || rawStatus === "failed" ? "failed" : rawStatus === "started" ? "started" : rawStatus === "completed" ? "completed" : "info";

          const next: StreamEvent = {

            id: `${Date.now()}-${Math.random()}`,

            event: event.event,

            status,

            message: event.message || (typeof event.data?.error === "string" ? event.data.error : event.event),

            data: event.data,

          };

          localEvents = [...localEvents, next];

          setStreamEvents(localEvents);

          setLiveAssistant((current) => current && current.id === requestId ? { ...current, thoughts: [...current.thoughts, next] } : current);

          if (event.event === "agent_error" || event.event === "error") {

            failed = true;

            setRequestFailed(true);

            setError(next.message);

          }

          if (event.event === "complete") {

            completed = true;

            if (failed) return;

            const data = event.data ?? {};

            if (data.status === "rate_limited") {

              setRateLimited(true);

              setError(event.message || "Chat quota limit reached. Please try again later.");

              return;

            }

            const nextSources = Array.isArray(data.sources) ? (data.sources as UiSource[]) : [];

            const nextCitations = Array.isArray(data.citations) ? normalizeCitations(data.citations) : [];

            const nextGrounding = typeof data.grounding_passed === "boolean" ? data.grounding_passed : null;

            const nextRoute = typeof data.route === "string" ? data.route : null;

            const nextTitle = typeof data.conversation_title === "string" ? data.conversation_title : null;

            const finalAnswer = typeof data.answer === "string" ? data.answer : streamedAnswer;

            setLiveAssistant((current) => current && current.id === requestId ? { ...current, content: finalAnswer || current.content, sources: nextSources, citations: nextCitations, groundingPassed: nextGrounding, route: nextRoute, completed: true, thoughtsOpen: false } : current);

            if (nextTitle) {

              setConversation((current) => current ? { ...current, title: nextTitle } : current);

              if (activeId) chatCache.patchTitle(activeId, nextTitle);

              window.dispatchEvent(new CustomEvent("querypilot:conversation-changed", { detail: { conversationId: activeId, title: nextTitle } }));

            }

            if (finalAnswer) {

              const localId = nextOptimisticId();

              const assistant: MessageWithMetadata = {

                id: localId,

                role: "ASSISTANT",

                content: finalAnswer,

                created_at: new Date().toISOString(),

                metadata: { sources: nextSources, citations: nextCitations, thoughts: localEvents.map((item) => ({ event: item.event, message: item.message, status: item.status })), grounding_passed: nextGrounding, route: nextRoute },

              };

              setConversation((current) => {

                const updated = current ? { ...current, messages: [...current.messages, assistant] } : current;

                if (updated && activeId) chatCache.setCached(activeId, updated);

                return updated;

              });

              setTurnDetails((current) => ({ ...current, [localId]: { thoughts: assistant.metadata?.thoughts ?? [], sources: nextSources, citations: nextCitations, groundingPassed: nextGrounding, route: nextRoute } }));

            }

          }

        },

        { signal: controller.signal },

      );

      if (!completed && !failed && !controller.signal.aborted) {

        setRequestFailed(true);

        setError("The response stream ended before QueryPilot returned a completed answer.");

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

      if (startedAsDraft && createdConversation && completed && accepted && !failed && !controller.signal.aborted && workspaceId) {

        setConversation((current) => {

          if (current) chatCache.setCached(createdConversation!.id, current);

          return current;

        });

        window.dispatchEvent(new CustomEvent("querypilot:conversation-changed", { detail: { conversation: createdConversation } }));

        window.history.replaceState(null, "", `/workspaces/${workspaceId}/chat/${createdConversation.id}`);

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

    return <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center text-xs text-muted-foreground">Loading conversation\u2026</div>;

  }

  if (!conversation) {

    return <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center p-6 text-sm text-red-300">{error || "Conversation not found."}</div>;

  }

  const messages = conversation.messages;

  return (

    <div className="flex min-h-[calc(100vh-4rem)] flex-col">

      <ThoughtAnimationStyles />

      <div ref={scrollContainerRef} onScroll={handleScroll} className="mx-auto w-full max-w-[900px] flex-1 overflow-y-auto px-5 pb-10 pt-7 sm:px-6 lg:px-0 lg:py-9">

        {messages.length === 0 && !liveAssistant?.content ? (

          <div className="flex min-h-[62vh] items-center justify-center px-5 text-center">

            <div className="max-w-md">

              <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/15 bg-primary/[0.055] text-primary shadow-[0_14px_42px_rgba(13,148,136,0.08)]"><Sparkles size={23} /></div>

              <h2 className="mt-6 text-[32px] font-light tracking-[-0.045em]">Start a new conversation</h2>

              <p className="mx-auto mt-3 max-w-lg text-[14px] leading-7 text-muted-foreground">Ask a question about the documents in this workspace.</p>

            </div>

          </div>

        ) : (

          <div className="space-y-10 pb-6">

            {messages.map((item) => {

              if (item.role === "USER") return <UserMessage key={item.id} content={item.content} />;

              const details = turnDetails[item.id] ?? metadataForMessage(item);

              return <AssistantMessage key={item.id} message={item} details={details} />;

            })}

            {sending && liveAssistant && !liveAssistant.content && (

              <div className="w-full max-w-[820px]">

                <ThinkingBlock events={streamEvents} open={thoughtsOpen} onToggle={() => setThoughtsOpen((value) => !value)} failed={requestFailed} stopped={requestStopped} />

              </div>

            )}

            {liveAssistant && !liveAssistant.completed && liveAssistant.content && (

              <div className="w-full max-w-[820px]">

                <ThinkingBlock events={liveAssistant.thoughts} open={liveAssistant.thoughtsOpen} onToggle={() => setLiveAssistant((current) => current ? { ...current, thoughtsOpen: !current.thoughtsOpen } : current)} failed={requestFailed} stopped={requestStopped} />

                <div className="pt-1 text-[14px] leading-7 text-foreground/90">

                  <MarkdownAnswer content={liveAssistant.content} citations={liveAssistant.citations} onCitationClick={() => {}} />

                </div>

              </div>

            )}

            {requestFailed && error && !rateLimited && (

              <div className="text-xs text-red-300">{error}</div>

            )}

            {rateLimited && <div className="text-xs text-amber-300">{error}</div>}

            {requestStopped && !error && <div className="text-xs text-muted-foreground">Generation stopped.</div>}

            <div ref={scrollAnchorRef} aria-hidden="true" />

          </div>

        )}

      </div>

      <Composer value={message} setValue={setMessage} onSend={() => void sendMessage()} sending={sending} onStop={stopGeneration} />

    </div>

  );

}

export default ChatView;