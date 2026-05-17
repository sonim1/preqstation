'use client';

import type { CSSProperties } from 'react';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const globalPageFallbackStyle = {
  margin: 0,
  minHeight: '100dvh',
  background:
    'var(--ui-glow, radial-gradient(circle at top left, rgba(39, 77, 196, 0.22), transparent 30rem)), linear-gradient(180deg, var(--ui-surface-strong, #0b1220), var(--ui-surface, #0f172a))',
  color: 'var(--ui-text, #e8effa)',
} satisfies CSSProperties;

const globalCardFallbackStyle = {
  border: '1px solid var(--ui-state-shell-border, rgba(142, 166, 203, 0.32))',
  background: 'var(--ui-state-shell-surface, rgba(17, 27, 44, 0.92))',
} satisfies CSSProperties;

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body className="route-state-page route-state-global-page" style={globalPageFallbackStyle}>
        <main className="route-state-card route-state-global-card" style={globalCardFallbackStyle}>
          <p className="route-state-eyebrow">FATAL ERROR</p>
          <h1 className="route-state-title">Unexpected App Failure</h1>
          <p className="route-state-description">
            A critical error occurred and the app could not render correctly.
          </p>
          {error.digest ? <p className="route-state-reference">Ref: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            className="route-state-primary-action route-state-native-button"
          >
            Try reload
          </button>
        </main>
      </body>
    </html>
  );
}
