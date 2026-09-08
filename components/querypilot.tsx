"use client";

import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  LayoutGrid,
  LogOut,
  Mic,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  authApi,
  chatApi,
  documentApi,
  streamChat,
  type ApiError,
  type ChatSource,
  type Conversation,
  type ConversationDetail,
  type Document,
  type Message,
  type User,
  type Workspace,
} from "@/lib/django-api";

import { useChatCache } from "@/components/chat-context";

type StreamEvent = {
  id: string;
  event: string;
  status: "started" | "completed" | "failed" | "info";
  message: string;
  data?: Record<string, unknown>;
};

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

  const styles =
    variant === "primary"
      ? "bg-foreground text-background hover:bg-foreground/85"
      : "border border-border bg-background hover:bg-muted";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
          {eyebrow}
        </p>

        <h1 className="text-3xl font-semibold tracking-[-0.04em] md:text-[38px]">
          {title}
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      {action}
    </header>
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

  // "new" (or no conversationId at all) means this is a fresh, client-only
  // draft: no backend conversation has been created yet. It only becomes
  // real once the user actually sends a first message (see sendMessage).
  const isDraft = !conversationId || conversationId === "new";

  const initialId = isDraft ? null : Number(conversationId);

  // The id we actually talk to the backend with. Starts as the real id for
  // an existing conversation, or null for a draft until the first send.
  const [resolvedId, setResolvedId] = useState<number | null>(
    initialId !== null && Number.isFinite(initialId) ? initialId : null,
  );

  // If this conversation was already opened once this session, the cache
  // has it — seed state from the cache synchronously so a revisit renders
  // immediately instead of showing a loading state while re-fetching.
  const cachedInitial =
    !isDraft && initialId !== null ? chatCache.getCached(initialId) : undefined;

  const [conversation, setConversation] = useState<ConversationDetail | null>(
    isDraft
      ? {
          id: -1,
          title: "New chat",
          workspace: workspaceId ?? -1,
          created_by: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        }
      : (cachedInitial ?? null),
  );

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(!isDraft && !cachedInitial);

  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");

  const [streamStatus, setStreamStatus] = useState("");

  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);

  const [thoughtsOpen, setThoughtsOpen] = useState(true);

  const [sources, setSources] = useState<ChatSource[]>([]);

  // Thoughts/sources/grounding/route were previously shown only for the
  // single most recent assistant message (a `lastAssistantId` check), so
  // sending a new message made the previous turn's Thoughts vanish entirely
  // instead of staying visible/collapsible. This keeps every turn's details
  // in this session, keyed by that turn's message id.
  const [turnDetails, setTurnDetails] = useState<
    Record<
      number,
      {
        thoughts: StreamEvent[];
        sources: ChatSource[];
        groundingPassed: boolean | null;
        route: string | null;
      }
    >
  >({});

  const [openTurns, setOpenTurns] = useState<Record<number, boolean>>({});

  const [groundingPassed, setGroundingPassed] = useState<boolean | null>(null);

  const [route, setRoute] = useState<string | null>(null);

  const [tabByMessage, setTabByMessage] = useState<Record<number, AnswerTab>>(
    {},
  );

  const [liveTab, setLiveTab] = useState<AnswerTab>("answer");

  const [rateLimited, setRateLimited] = useState(false);

  const [requestFailed, setRequestFailed] = useState(false);

  const [requestStopped, setRequestStopped] = useState(false);

  const [attaching, setAttaching] = useState(false);

  const [attachError, setAttachError] = useState("");

  const [attachMessage, setAttachMessage] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentRequestIdRef = useRef<string | null>(null);

  const [liveAssistant, setLiveAssistant] = useState<{
    id: string;
    content: string;
    sources: ChatSource[];
    groundingPassed: boolean | null;
    route: string | null;
    thoughts: StreamEvent[];
    thoughtsOpen: boolean;
    completed: boolean;
  } | null>(null);

  const loadConversation = useCallback(async () => {
    if (isDraft) {
      // Drafts are intentionally client-only until the first send.
      setLoading(false);
      return;
    }

    // IMPORTANT: this must use the id from the URL, not resolvedId.
    // resolvedId is updated when /chat/new creates its first backend
    // conversation. Using it here would re-run this loader in the middle
    // of the live SSE request and could blank/reload the chat UI.
    if (initialId === null || !Number.isInteger(initialId) || initialId <= 0) {
      setError("Invalid conversation.");
      setLoading(false);
      return;
    }

    // Cache hit: render immediately, no network call, no loading flash.
    // This is what makes A -> B -> A conversation switching feel instant
    // after the first visit, per the brief's caching requirement.
    const cached = chatCache.getCached(initialId);
    if (cached) {
      if (cached.workspace !== workspaceId) {
        setConversation(null);
        setError("This conversation does not belong to the selected workspace.");
        setLoading(false);
        return;
      }

      setResolvedId(cached.id);
      setConversation(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await chatCache.getOrFetch(initialId);

      if (data.workspace !== workspaceId) {
        setConversation(null);
        setError("This conversation does not belong to the selected workspace.");
        return;
      }

      setResolvedId(data.id);
      setConversation(data);
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.status === 401 || apiError.status === 403) {
        authApi.clearTokens();
        router.replace("/login");
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [chatCache, initialId, isDraft, router, workspaceId]);

  // Loading an existing conversation is independent from the lifecycle of
  // an in-flight chat stream. Creating the first conversation for /chat/new
  // must never cause a fetch effect to restart or abort that stream.
  useEffect(() => {
    void loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, isDraft]);

  // Mirror any change to the local `conversation` state back into the
  // shared cache, as long as it has a real (resolved) id. This is the one
  // place that keeps the cache correct — new messages, title updates after
  // `complete`, etc. all flow through setConversation already, so this
  // single effect covers all of them instead of requiring a cache write at
  // every call site (which is easy to miss as the component evolves).
  useEffect(() => {
    if (!conversation || conversation.id <= 0) return;
    chatCache.setCached(conversation.id, conversation);
  }, [conversation, chatCache]);

  useEffect(() => {
    return () => {
      currentRequestIdRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isDraft) return;

    // "New Chat" clicked while already sitting on the draft route
    // (workspace-shell.tsx's createChat sees pathname === draftPath and
    // dispatches this instead of navigating, since navigating to the exact
    // same URL wouldn't cause React to reset anything on its own). This
    // must therefore perform the *entire* reset that a fresh mount would
    // have given us for free: stop any in-flight generation, drop the
    // optimistic/streamed turn, and clear every piece of per-conversation
    // state. Previously this only cleared the composer text, which is why
    // "New Chat" could look like it did nothing if a previous draft attempt
    // had failed, was stopped, or had a lingering streamed answer on screen.
    const handleNewChatRequested = () => {
      currentRequestIdRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;

      setResolvedId(null);
      setConversation({
        id: -1,
        title: "New chat",
        workspace: workspaceId ?? -1,
        created_by: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
      });
      setMessage("");
      setSending(false);
      setError("");
      setStreamStatus("");
      setStreamEvents([]);
      setThoughtsOpen(true);
      setSources([]);
      setTurnDetails({});
      setOpenTurns({});
      setGroundingPassed(null);
      setRoute(null);
      setTabByMessage({});
      setLiveTab("answer");
      setRateLimited(false);
      setRequestFailed(false);
      setRequestStopped(false);
      setLiveAssistant(null);
      setAttachError("");
      setAttachMessage("");
    };

    window.addEventListener(
      "querypilot:new-chat-requested",
      handleNewChatRequested,
    );

    return () =>
      window.removeEventListener(
        "querypilot:new-chat-requested",
        handleNewChatRequested,
      );
  }, [isDraft, workspaceId]);

  const isCurrentRequest = (requestId: string) =>
    currentRequestIdRef.current === requestId &&
    !abortRef.current?.signal.aborted;

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || sending) {
      return;
    }

    if (resolvedId === null && !isDraft) {
      return;
    }

    setMessage("");
    setError("");
    setRateLimited(false);
    setSending(true);
    setLiveTab("answer");
    setStreamStatus("Starting…");
    setStreamEvents([]);
    setThoughtsOpen(true);
    setSources([]);
    setGroundingPassed(null);
    setRoute(null);
    setRequestFailed(false);
    setRequestStopped(false);

    // A draft has no backend conversation yet — create it now, on the very
    // first send. Every subsequent send in this session reuses the same
    // conversation (resolvedId is now set), so repeated "New Chat" clicks or
    // repeated sends never spam empty conversations.
    let activeId = resolvedId;
    const startedAsDraft = activeId === null;
    let createdConversation: Conversation | null = null;

    if (activeId === null) {
      if (!workspaceId) {
        setError("No active workspace selected.");
        setSending(false);
            return;
      }

      try {
        const created = await chatApi.createConversation(workspaceId);
        activeId = created.id;
        createdConversation = created;
        setResolvedId(created.id);
        setConversation((current) => ({
          ...(current ?? created),
          ...created,
          messages: current?.messages ?? [],
        }));
      } catch (err) {
        setError(getErrorMessage(err));
        setSending(false);
            return;
      }
    }

    const optimisticUserMessage: Message = {
      id: -Date.now(),
      role: "USER",
      content: text,
      created_at: new Date().toISOString(),
    };

    setConversation((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: [...current.messages, optimisticUserMessage],
      };
    });

    const controller = new AbortController();

    abortRef.current = controller;

    const requestId = `${Date.now()}-${Math.random()}`;
    currentRequestIdRef.current = requestId;

    let completed = false;
    let streamFailed = false;
    let requestAccepted = false;
    let messagePersisted = false;
    let streamedAnswer = "";
    let localEvents: StreamEvent[] = [];

    // initialize live assistant for this request
    setLiveAssistant({
      id: requestId,
      content: "",
      sources: [],
      groundingPassed: null,
      route: null,
      thoughts: [],
      thoughtsOpen: true,
      completed: false,
    });

    try {
      await streamChat(
        {
          conversation_id: activeId,
          message: text,
        },
        (event) => {
          if (!isCurrentRequest(requestId)) {
            return;
          }

          // The backend emits query_received once the question has been
          // accepted for execution. This flag is used later to decide whether
          // draft promotion is safe.
          if (event.event === "query_received") {
            requestAccepted = true;
          }

          // Final-answer tokens are a separate stream channel. They must
          // never be treated as Thoughts/progress events. Append each delta
          // immediately so the answer appears on screen as it is generated.
          if (event.event === "answer_delta") {
            const delta =
              typeof event.data?.delta === "string"
                ? event.data.delta
                : "";

            if (delta) {
              streamedAnswer += delta;

              setLiveAssistant((current) => {
                if (!current || current.id !== requestId) {
                  return current;
                }

                return {
                  ...current,
                  content: current.content + delta,
                };
              });
            }

            return;
          }

          const rawStatus = event.data?.status;

          const eventStatus: StreamEvent["status"] =
            event.event === "agent_error" ||
            event.event === "error" ||
            rawStatus === "failed"
              ? "failed"
              : rawStatus === "started"
                ? "started"
                : rawStatus === "completed"
                  ? "completed"
                  : "info";

          const eventMessage =
            event.message ||
            (typeof event.data?.error === "string"
              ? event.data.error
              : event.event);

          const nextItem: StreamEvent = {
            id: `${Date.now()}-${Math.random()}`,
            event: event.event,
            status: eventStatus,
            message: eventMessage,
            data: event.data,
          };

          setStreamStatus(eventMessage);

          localEvents = [...localEvents, nextItem];
          setStreamEvents(localEvents);

          setLiveAssistant((cur) => {
            if (!cur || cur.id !== currentRequestIdRef.current) {
              return cur;
            }

            return {
              ...cur,
              thoughts: [...cur.thoughts, nextItem],
            };
          });

          if (event.event === "scope_check" && event.data) {
            const eventRoute = event.data.route;

            if (typeof eventRoute === "string") {
              setRoute(eventRoute);
              setLiveAssistant((cur) =>
                cur && cur.id === currentRequestIdRef.current
                  ? { ...cur, route: eventRoute }
                  : cur,
              );
            }
          }

          if (event.event === "agent_error") {
            streamFailed = true;
            setRequestFailed(true);

            setError(
              event.message ||
                (typeof event.data?.error === "string"
                  ? event.data.error
                  : "The request failed."),
            );
          }

          if (event.event === "complete") {
            completed = true;

            // A terminal failure (agent_error / error) was already observed for
            // this request. A `complete` event arriving after that must never
            // flip the request back into a "success" state.
            if (streamFailed) {
              setStreamStatus(event.message || "Request failed.");
              return;
            }

            const data = event.data ?? {};

            const resultStatus = data.status;

            if (resultStatus === "rate_limited") {
              setRateLimited(true);
              setError(
                event.message ||
                  "Chat quota limit reached. Please try again later.",
              );
              return;
            }

            const nextSources = Array.isArray(data.sources)
              ? (data.sources as ChatSource[])
              : [];
            const nextGrounding =
              typeof data.grounding_passed === "boolean"
                ? data.grounding_passed
                : null;
            const nextRoute =
              typeof data.route === "string" ? data.route : null;
            const nextTitle =
              typeof data.conversation_title === "string"
                ? data.conversation_title
                : null;

            setSources(nextSources);
            setGroundingPassed(nextGrounding);
            setRoute(nextRoute);

            setStreamStatus(event.message || "Request completed.");

            if (nextTitle) {
              setConversation((current) =>
                current && current.title !== nextTitle
                  ? { ...current, title: nextTitle }
                  : current,
              );

              window.dispatchEvent(
                new CustomEvent("querypilot:conversation-changed", {
                  detail: {
                    conversationId: activeId,
                    title: nextTitle,
                  },
                }),
              );
            }

            // Finalize the live assistant with the backend's complete payload.
            const finalAnswer =
              typeof data.answer === "string"
                ? data.answer
                : streamedAnswer;

            setLiveAssistant((cur) => {
              if (!cur || cur.id !== currentRequestIdRef.current) return cur;
              return {
                ...cur,
                content: finalAnswer || cur.content,
                sources: nextSources,
                groundingPassed: nextGrounding,
                route: nextRoute,
                completed: true,
                thoughtsOpen: false,
              };
            });

            // Insert the persisted turn (both the user's message and the
            // answer) into the current in-memory conversation. Previously
            // only the assistant side was ever added here — the user's own
            // message existed only as a transient optimistic bubble that got
            // cleared once the request finished, so it visibly vanished.
            if (finalAnswer && !messagePersisted) {
              messagePersisted = true;

              const assistantMsgId = -Date.now();
              const assistantMsg: Message = {
                id: assistantMsgId,
                role: "ASSISTANT",
                content: finalAnswer,
                created_at: new Date().toISOString(),
              };

              setConversation((cur) => {
                if (!cur) return cur;

                return {
                  ...cur,
                  messages: [...cur.messages, assistantMsg],
                };
              });

              setTurnDetails((current) => ({
                ...current,
                [assistantMsgId]: {
                  thoughts: localEvents,
                  sources: nextSources,
                  groundingPassed: nextGrounding,
                  route: nextRoute,
                },
              }));

              // Collapsed by default once persisted (matches "Thoughts
              // collapse after successful completion"); the user can reopen
              // it any time via the dropdown.
              setOpenTurns((current) => ({
                ...current,
                [assistantMsgId]: false,
              }));
            }
          }

          if (event.event === "error") {
            streamFailed = true;
            setRequestFailed(true);

            setError(event.message || "The request failed.");
          }
        },
        {
          signal: controller.signal,
        },
      );

      if (!completed && !streamFailed && !controller.signal.aborted) {
        setRequestFailed(true);
        setError(
          "The response stream ended before QueryPilot returned a completed answer.",
        );
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      setRequestFailed(true);
      setError(getErrorMessage(err));
    } finally {
      const ownsCurrentRequest = currentRequestIdRef.current === requestId;

      if (ownsCurrentRequest) {
        abortRef.current = null;
        setSending(false);
        currentRequestIdRef.current = null;
      }

      // Now that the request has settled, promote the URL from the draft
      // route to the real conversation. Doing this only now (rather than
      // right after creating the conversation) means the in-flight stream
      // is never interrupted by the route/key change this triggers.
      if (
        startedAsDraft &&
        createdConversation &&
        completed &&
        requestAccepted &&
        !streamFailed &&
        !controller.signal.aborted
      ) {
        window.dispatchEvent(
          new CustomEvent("querypilot:conversation-changed", {
            detail: { conversation: createdConversation },
          }),
        );

        if (workspaceId) {
          // Seed the cache with everything we already have client-side
          // (including the just-streamed answer) *before* swapping the
          // route, so when Next mounts the [conversationId] page for this
          // id, loadConversation finds a cache hit and renders instantly
          // instead of re-fetching a conversation we already fully have.
          if (conversation) {
            chatCache.setCached(createdConversation.id, {
              ...conversation,
              ...createdConversation,
            });
          }

          // router.replace (not window.history.replaceState) so Next's
          // own route/pathname state stays in sync with the URL. Because
          // the persistent chat/layout.tsx never remounts across this
          // change, and this only swaps which leaf page is active, the
          // in-flight stream we just finished handling is unaffected —
          // this call happens after the stream has already settled above.
          router.replace(
            `/workspaces/${workspaceId}/chat/${createdConversation.id}`,
            { scroll: false },
          );
        }
      }
    }
  };

  const stopGeneration = () => {
    const controller = abortRef.current;
    // Drop request identity synchronously so any event already in flight
    // (queued before abort() takes effect) is rejected by isCurrentRequest.
    currentRequestIdRef.current = null;
    controller?.abort();
    abortRef.current = null;
    setSending(false);
    setRequestStopped(true);
    setStreamStatus("Generation stopped.");
    // Keep Thoughts open so the user can see what happened before stopping.

    // The backend has already persisted the user message before execution,
    // and the optimistic user message remains visible in the local history.
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const handleAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || !conversation) {
      return;
    }

    const attachWorkspaceId = workspaceId;

    if (!attachWorkspaceId) {
      setAttachError("No active workspace selected.");
      return;
    }

    setAttaching(true);
    setAttachError("");
    setAttachMessage("");

    try {
      const result = await documentApi.upload(attachWorkspaceId, file);

      setAttachMessage(
        result.duplicate
          ? "This document already exists in the workspace."
          : "Document uploaded. Processing has started.",
      );

      window.dispatchEvent(
        new CustomEvent("querypilot:workspace-documents-changed"),
      );
    } catch (err) {
      setAttachError(getErrorMessage(err));
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-xs text-muted-foreground">
          Loading conversation…
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-5">
        <div
          role="alert"
          className="max-w-md rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700"
        >
          {error || "Conversation not found."}
        </div>
      </div>
    );
  }

  const messages = conversation.messages;

  const setTabForMessage = (messageId: number, tab: AnswerTab) => {
    setTabByMessage((current) => ({
      ...current,
      [messageId]: tab,
    }));
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:px-10">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Conversation
          </p>

          <h1 className="mt-1 truncate text-sm font-medium">
            {conversation.title}
          </h1>
        </div>

        <button
          type="button"
          aria-label="Conversation options"
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 lg:px-10">
        {messages.length === 0 && !liveAssistant?.content ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Sparkles size={18} />
              </div>

              <h2 className="mt-4 text-sm font-medium">No answer yet</h2>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Ask a question about the documents available in this workspace.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {messages.map((item) =>
              item.role === "USER" ? (
                <h2
                  key={item.id}
                  className="text-2xl font-semibold leading-snug tracking-[-0.02em] md:text-[26px]"
                >
                  {item.content}
                </h2>
              ) : (
                <AnswerBlock
                  key={item.id}
                  content={item.content}
                  sources={turnDetails[item.id]?.sources ?? []}
                  groundingPassed={
                    turnDetails[item.id]?.groundingPassed ?? null
                  }
                  route={turnDetails[item.id]?.route ?? null}
                  thoughts={turnDetails[item.id]?.thoughts ?? []}
                  thoughtsOpen={openTurns[item.id] ?? false}
                  onToggleThoughts={
                    turnDetails[item.id]
                      ? () =>
                          setOpenTurns((current) => ({
                            ...current,
                            [item.id]: !current[item.id],
                          }))
                      : undefined
                  }
                  activeTab={tabByMessage[item.id] ?? "answer"}
                  onTabChange={(tab) => setTabForMessage(item.id, tab)}
                />
              ),
            )}

            {liveAssistant &&
              !liveAssistant.completed &&
              liveAssistant.content && (
                <AnswerBlock
                  content={liveAssistant.content}
                  sources={liveAssistant.sources}
                  groundingPassed={liveAssistant.groundingPassed}
                  route={liveAssistant.route}
                  thoughts={liveAssistant.thoughts}
                  thoughtsOpen={liveAssistant.thoughtsOpen}
                  onToggleThoughts={() =>
                    setLiveAssistant((current) =>
                      current && current.id === currentRequestIdRef.current
                        ? {
                            ...current,
                            thoughtsOpen: !current.thoughtsOpen,
                          }
                        : current,
                    )
                  }
                  activeTab={liveTab}
                  onTabChange={setLiveTab}
                />
              )}

            {(sending ||
              ((requestFailed || requestStopped) &&
                streamEvents.length > 0)) && (
              <div>
                <div className="mt-5 rounded-xl border border-border bg-muted/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setThoughtsOpen((value) => !value)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-muted/40"
                    aria-expanded={thoughtsOpen}
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-background border border-border">
                      {requestFailed ? (
                        <X size={10} className="text-red-600" />
                      ) : (
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" />
                      )}
                    </span>

                    <span className="flex-1 text-sm font-medium">Thoughts</span>

                    <span className="hidden max-w-[55%] truncate text-[11px] text-muted-foreground sm:block">
                      {streamStatus || "Researching your knowledge base…"}
                    </span>

                    <ChevronDown
                      size={15}
                      className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                        thoughtsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {thoughtsOpen && (
                    <div className="border-t border-border px-3.5 py-2.5">
                      <div className="space-y-0.5">
                        {streamEvents.map((eventItem) => (
                          <div
                            key={eventItem.id}
                            className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5"
                          >
                            <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                              {eventItem.status === "completed" ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : eventItem.status === "failed" ? (
                                <X size={12} className="text-red-600" />
                              ) : eventItem.status === "started" ? (
                                <LoadingDots />
                              ) : (
                                <span className="size-1.5 rounded-full bg-muted-foreground" />
                              )}
                            </span>

                            <span
                              className={`text-[11px] leading-5 ${
                                eventItem.status === "failed"
                                  ? "text-red-600"
                                  : eventItem.status === "started"
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {eventItem.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {sending ? (
                  <>
                    <div className="flex items-center gap-2.5 pt-4 text-sm text-emerald-700">
                      <LoadingDots />
                      <span>
                        {streamStatus || "Researching your knowledge base…"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="mt-4 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted"
                    >
                      Stop
                    </button>
                  </>
                ) : requestFailed ? (
                  <div className="flex items-center gap-2.5 pt-4 text-sm text-red-600">
                    <X size={14} />
                    <span>This request failed. Try sending it again.</span>
                  </div>
                ) : (
                  requestStopped && (
                    <div className="flex items-center gap-2.5 pt-4 text-sm text-muted-foreground">
                      <span>Generation stopped.</span>
                    </div>
                  )
                )}
              </div>
            )}

            {rateLimited && (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800"
              >
                {error || "Chat quota limit reached. Please try again later."}
              </div>
            )}

            {error && !rateLimited && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
              >
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-border bg-background shadow-sm focus-within:border-emerald-500/60">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              rows={1}
              placeholder="Ask anything…"
              className="max-h-32 min-h-12 w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />

            <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700">
                  Chat
                  <ChevronDown size={12} />
                </span>

                <button
                  type="button"
                  disabled
                  aria-label="Search (not available yet)"
                  className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-40"
                >
                  <Search size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="hidden items-center gap-1.5 pr-1 text-[11px] text-muted-foreground opacity-40 sm:flex">
                  <span className="h-4 w-7 rounded-full bg-muted" />
                  Quick
                </span>

                <button
                  type="button"
                  disabled
                  aria-label="Quick actions (not available yet)"
                  className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-40"
                >
                  <LayoutGrid size={14} />
                </button>

                <button
                  type="button"
                  disabled
                  aria-label="Chat settings (not available yet)"
                  className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-40"
                >
                  <Settings size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attaching}
                  aria-label="Attach document to this conversation"
                  className="grid size-7 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <Paperclip size={14} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.docx,.xlsx,.csv"
                  onChange={handleAttach}
                />

                <button
                  type="button"
                  disabled
                  aria-label="Voice input (not available yet)"
                  className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-40"
                >
                  <Mic size={14} />
                </button>

                <button
                  type="button"
                  aria-label={sending ? "Stop generation" : "Send message"}
                  onClick={sending ? stopGeneration : () => void sendMessage()}
                  disabled={!sending && !message.trim()}
                  className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <span className="size-2.5 rounded-[2px] bg-white" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {attachError && (
            <p className="mt-2 text-[11px] leading-5 text-red-600">
              {attachError}
            </p>
          )}

          {attachMessage && (
            <p className="mt-2 text-[11px] leading-5 text-emerald-700">
              {attachMessage}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span>{conversation.title}</span>

            <span>Enter to send · Shift + Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Answer tabs (Answer / Sources / Citation)                                  */
/* -------------------------------------------------------------------------- */

type AnswerTab = "answer" | "sources" | "citations";

function TabButton({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative pb-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}

      {active && (
        <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-emerald-600" />
      )}
    </button>
  );
}

function LoadingDots() {
  return (
    <span className="grid grid-cols-2 gap-0.5">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="size-1 animate-pulse rounded-[1px] bg-emerald-600"
          style={{
            animationDelay: `${index * 150}ms`,
          }}
        />
      ))}
    </span>
  );
}

function SourceCard({ source, index }: { source: ChatSource; index: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="font-mono text-[10px] text-emerald-700">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            {source.document_name || "Document source"}
          </p>

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            {source.source_type && <span>{source.source_type}</span>}

            {source.page_start !== null && source.page_start !== undefined && (
              <span>
                Page{" "}
                {source.page_end && source.page_end !== source.page_start
                  ? `${source.page_start}–${source.page_end}`
                  : source.page_start}
              </span>
            )}

            {source.heading && <span>{source.heading}</span>}

            {source.table_name && <span>Table: {source.table_name}</span>}

            {source.chunk_index !== null &&
              source.chunk_index !== undefined && (
                <span>Chunk {source.chunk_index}</span>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerBlock({
  content,
  sources,
  groundingPassed,
  route,
  thoughts,
  thoughtsOpen,
  onToggleThoughts,
  activeTab,
  onTabChange,
}: {
  content: string;
  sources: ChatSource[];
  groundingPassed: boolean | null;
  route: string | null;
  thoughts: StreamEvent[];
  thoughtsOpen: boolean;
  onToggleThoughts?: () => void;
  activeTab: AnswerTab;
  onTabChange: (tab: AnswerTab) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-6 border-b border-border">
        <TabButton
          label="Answer"
          active={activeTab === "answer"}
          onClick={() => onTabChange("answer")}
        />

        <TabButton
          label="Sources"
          active={activeTab === "sources"}
          onClick={() => onTabChange("sources")}
        />

        <TabButton
          label="Citation"
          active={activeTab === "citations"}
          onClick={() => onTabChange("citations")}
        />
      </div>

      <div className="pt-5">
        {activeTab === "answer" && (
          <div className="whitespace-pre-wrap text-[14px] leading-7 text-foreground/85">
            {content}
          </div>
        )}

        {activeTab === "sources" &&
          (sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((source, index) => (
                <SourceCard
                  key={`${source.document_id}-${source.chunk_index ?? ""}-${source.table_name ?? ""}-${index}`}
                  source={source}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              No source data available for this response.
            </p>
          ))}

        {activeTab === "citations" && (
          <p className="text-xs leading-5 text-muted-foreground">
            No citation data available for this response yet.
          </p>
        )}
      </div>

      {thoughts.length > 0 && onToggleThoughts && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-muted/20">
          <button
            type="button"
            onClick={onToggleThoughts}
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-muted/40"
            aria-expanded={thoughtsOpen}
          >
            <span className="grid size-5 place-items-center rounded-full bg-background border border-border">
              <Check size={12} className="text-emerald-600" />
            </span>

            <span className="flex-1 text-sm font-medium">Thoughts</span>

            <ChevronDown
              size={15}
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                thoughtsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {thoughtsOpen && (
            <div className="border-t border-border px-3.5 py-2.5">
              <div className="space-y-0.5">
                {thoughts.map((eventItem) => (
                  <div
                    key={eventItem.id}
                    className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                      {eventItem.status === "completed" ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : eventItem.status === "failed" ? (
                        <X size={12} className="text-red-600" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                      )}
                    </span>

                    <span
                      className={`text-[11px] leading-5 ${
                        eventItem.status === "failed"
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {eventItem.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "answer" && groundingPassed !== null && (
        <div className="mt-4 text-[10px] text-muted-foreground">
          Grounding:{" "}
          <span
            className={
              groundingPassed
                ? "font-medium text-emerald-700"
                : "font-medium text-red-600"
            }
          >
            {groundingPassed ? "passed" : "not passed"}
          </span>
          {route && (
            <>
              {" "}
              · Route: <span className="font-medium">{route}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export function SettingsView() {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [loggingOut, setLoggingOut] = useState(false);

  const router = useRouter();

  useEffect(() => {
    void authApi
      .me()
      .then((data) => {
        setUser(data);
      })
      .catch((err) => {
        const apiError = err as ApiError;

        if (apiError.status === 401 || apiError.status === 403) {
          authApi.clearTokens();
          router.replace("/login");
          return;
        }

        setError(getErrorMessage(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = async () => {
    setLoggingOut(true);

    try {
      await authApi.logout();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      router.replace("/login");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-12">
        <div className="text-xs text-muted-foreground">Loading account…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Manage your QueryPilot account."
      />

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mt-10 divide-y divide-border border-y border-border">
        <section className="grid gap-6 py-7 md:grid-cols-[180px_1fr]">
          <div>
            <h2 className="text-sm font-medium">Account</h2>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Your authenticated account information.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium">Username</p>

              <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                {user?.username || "—"}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium">Email</p>

              <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                {user?.email || "—"}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium">Role</p>

              <div className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                {user?.role || "—"}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-7 md:grid-cols-[180px_1fr]">
          <div>
            <h2 className="text-sm font-medium">Security</h2>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Session and account access.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium">Sign out</p>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Revoke your current refresh session and return to login.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={() => void logout()}
              disabled={loggingOut}
            >
              <LogOut size={14} />

              {loggingOut ? "Signing out…" : "Logout"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Optional compatibility exports                                             */
/* -------------------------------------------------------------------------- */

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  );
}

export const Icon = {
  FileText,
  FolderOpen,
  Search,
};