'use client';

import { createContext, useContext } from 'react';

export type ResearchOptions = {
  web: boolean;
  fast: boolean;
};

export type WorkspaceUi = {
  sourceCount: number;
  openAddSource: () => void;
  /** Web / Fast research toggles from the Sources sidebar. */
  researchOptions: ResearchOptions;
};

const WorkspaceUiContext = createContext<WorkspaceUi>({
  sourceCount: 0,
  openAddSource: () => {},
  researchOptions: { web: false, fast: false },
});

export const WorkspaceUiProvider = WorkspaceUiContext.Provider;

export function useWorkspaceUi() {
  return useContext(WorkspaceUiContext);
}