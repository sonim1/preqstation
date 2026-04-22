'use client';

import { createContext, type ReactNode, useContext } from 'react';

import { resolveDisplayTimeZone } from '@/lib/date-time';

const TimeZoneContext = createContext('UTC');

export function TimezoneProvider({
  timeZone,
  children,
}: {
  timeZone?: string | null;
  children: ReactNode;
}) {
  return (
    <TimeZoneContext.Provider value={resolveDisplayTimeZone(timeZone)}>
      {children}
    </TimeZoneContext.Provider>
  );
}

export function useTimeZone() {
  return useContext(TimeZoneContext);
}
