'use client';

import { createContext, type ReactNode, useContext } from 'react';

import { DEFAULT_TERMINOLOGY, type Terminology } from '@/lib/terminology';

const TerminologyContext = createContext<Terminology>(DEFAULT_TERMINOLOGY);

export function TerminologyProvider({
  terminology,
  children,
}: {
  terminology: Terminology;
  children: ReactNode;
}) {
  return <TerminologyContext.Provider value={terminology}>{children}</TerminologyContext.Provider>;
}

export function useTerminology() {
  return useContext(TerminologyContext);
}
