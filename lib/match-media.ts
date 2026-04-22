type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: MediaQueryChangeListener) => void;
  removeListener?: (listener: MediaQueryChangeListener) => void;
};

export function subscribeMediaQuery(
  mediaQuery: MediaQueryList,
  listener: MediaQueryChangeListener,
) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }

  const legacyMediaQuery = mediaQuery as LegacyMediaQueryList;
  if (typeof legacyMediaQuery.addListener === 'function') {
    legacyMediaQuery.addListener(listener);
    return () => legacyMediaQuery.removeListener?.(listener);
  }

  return () => undefined;
}
