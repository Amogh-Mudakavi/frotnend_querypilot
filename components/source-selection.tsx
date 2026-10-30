'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/*
 * Which sources a question is answered from.
 *
 * The sidebar writes to this, the chat reads from it. It stores the sources that were switched OFF
 * (per workspace, in this browser), so anything newly uploaded is included by default and
 * deleted sources clean themselves up.
 *
 * Only sources that finished indexing can be selected.
 */

const KEY_PREFIX = 'querypilot_excluded_sources_';

export type SelectableDocument = { id: number; ready: boolean };

type SourceSelection = {
  /** Ids to send with a question: ready and not switched off. */
  selectedIds: number[];
  selectedCount: number;
  /** How many sources could be selected right now (finished indexing). */
  selectableCount: number;
  allSelected: boolean;
  someSelected: boolean;
  isSelected: (id: number) => boolean;
  toggle: (id: number) => void;
  selectAll: () => void;
  clearAll: () => void;
};

const SourceSelectionContext = createContext<SourceSelection | null>(null);

export function SourceSelectionProvider({
  workspaceId,
  documents,
  children,
}: {
  workspaceId: number;
  documents: SelectableDocument[];
  children: ReactNode;
}) {
  const storageKey = `${KEY_PREFIX}${workspaceId}`;
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setExcluded(new Set(Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : []));
    } catch {
      setExcluded(new Set());
    }
  }, [storageKey]);

  const commit = useCallback(
    (next: Set<number>) => {
      setExcluded(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {
        /* private mode: the choice still applies for this session */
      }
    },
    [storageKey]
  );

  const readyIds = useMemo(() => documents.filter((doc) => doc.ready).map((doc) => doc.id), [documents]);

  const value = useMemo<SourceSelection>(() => {
    const selectedIds = readyIds.filter((id) => !excluded.has(id));
    const selected = new Set(selectedIds);
    return {
      selectedIds,
      selectedCount: selectedIds.length,
      selectableCount: readyIds.length,
      allSelected: readyIds.length > 0 && selectedIds.length === readyIds.length,
      someSelected: selectedIds.length > 0,
      isSelected: (id) => selected.has(id),
      toggle: (id) => {
        const next = new Set(excluded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        commit(next);
      },
      selectAll: () => commit(new Set()),
      clearAll: () => commit(new Set(readyIds)),
    };
  }, [commit, excluded, readyIds]);

  return <SourceSelectionContext.Provider value={value}>{children}</SourceSelectionContext.Provider>;
}

export function useSourceSelection(): SourceSelection {
  const context = useContext(SourceSelectionContext);
  if (!context) throw new Error('useSourceSelection must be used inside <SourceSelectionProvider>.');
  return context;
}