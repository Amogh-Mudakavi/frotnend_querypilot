"use client";

/**
 * Shared chat lifecycle state for a workspace's chat surface.
 *
 * This context is created once per mount of app/workspaces/[workspaceId]/chat/layout.tsx
 * and stays alive across conversation switches and the draft -> persisted-conversation
 * transition, because the layout that owns it is never remounted by those navigations
 * (only the leaf page segment changes). That's what makes:
 *
 *   - conversation switching instant after the first fetch (in-memory cache below)
 *   - "New Chat" a pure client-side reset (no API call)
 *   - draft -> persisted promotion safe (no remount kills the in-flight SSE stream)
 *
 * Deliberately NOT Redux / Zustand / anything external — just React context wrapping
 * a couple of refs and a small piece of state. This is the "simple in-memory cache"
 * called for in the brief.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { chatApi, type Conversation, type ConversationDetail } from "@/lib/django-api";

type ChatCacheContextValue = {
  workspaceId: number;

  /** Returns a cached conversation if we have it, without touching the network. */
  getCached: (id: number) => ConversationDetail | undefined;

  /**
   * Returns a cached conversation immediately if present; otherwise fetches it,
   * caches the result, and returns it. Concurrent calls for the same id share
   * one in-flight request instead of firing duplicate fetches.
   */
  getOrFetch: (id: number) => Promise<ConversationDetail>;

  /** Overwrites/creates a cache entry (used right after a conversation is created,
   *  and to keep the cache in sync as new messages are persisted). */
  setCached: (id: number, detail: ConversationDetail) => void;

  /** Patches an existing cache entry's title (used after the `complete` SSE event). */
  patchTitle: (id: number, title: string) => void;

  /** Drops a single conversation from the cache (used on delete). */
  invalidate: (id: number) => void;
};

const ChatCacheContext = createContext<ChatCacheContextValue | null>(null);

export function ChatCacheProvider({
  workspaceId,
  children,
}: {
  workspaceId: number;
  children: React.ReactNode;
}) {
  // Map<conversationId, ConversationDetail> — the whole cache. A plain ref is
  // enough: reads don't need to be reactive at this level, individual pages
  // hold their own state seeded from this cache and update independently.
  const cacheRef = useRef<Map<number, ConversationDetail>>(new Map());

  // Coalesces concurrent fetches for the same conversation id.
  const inFlightRef = useRef<Map<number, Promise<ConversationDetail>>>(new Map());

  const getCached = useCallback((id: number) => cacheRef.current.get(id), []);

  const setCached = useCallback((id: number, detail: ConversationDetail) => {
    cacheRef.current.set(id, detail);
  }, []);

  const patchTitle = useCallback((id: number, title: string) => {
    const existing = cacheRef.current.get(id);
    if (existing) {
      cacheRef.current.set(id, { ...existing, title });
    }
  }, []);

  const invalidate = useCallback((id: number) => {
    cacheRef.current.delete(id);
    inFlightRef.current.delete(id);
  }, []);

  const getOrFetch = useCallback(
    async (id: number) => {
      const cached = cacheRef.current.get(id);
      if (cached) return cached;

      const inFlight = inFlightRef.current.get(id);
      if (inFlight) return inFlight;

      const promise = chatApi
        .conversation(id)
        .then((detail) => {
          cacheRef.current.set(id, detail);
          inFlightRef.current.delete(id);
          return detail;
        })
        .catch((err) => {
          inFlightRef.current.delete(id);
          throw err;
        });

      inFlightRef.current.set(id, promise);
      return promise;
    },
    [],
  );

  const value = useMemo<ChatCacheContextValue>(
    () => ({
      workspaceId,
      getCached,
      getOrFetch,
      setCached,
      patchTitle,
      invalidate,
    }),
    [workspaceId, getCached, getOrFetch, setCached, patchTitle, invalidate],
  );

  return (
    <ChatCacheContext.Provider value={value}>
      {children}
    </ChatCacheContext.Provider>
  );
}

export function useChatCache() {
  const ctx = useContext(ChatCacheContext);

  if (!ctx) {
    throw new Error("useChatCache must be used within a ChatCacheProvider");
  }

  return ctx;
}