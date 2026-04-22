'use client';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          background:
            'linear-gradient(180deg, var(--ui-surface-strong, #0b1220), var(--ui-surface, #0f172a))',
          color: 'var(--ui-text, #e8effa)',
          fontFamily: 'Pretendard, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          display: 'grid',
          placeItems: 'center',
          padding: '20px',
        }}
      >
        <main
          style={{
            width: '100%',
            maxWidth: '560px',
            border: '1px solid var(--ui-border, rgba(142, 166, 203, 0.32))',
            borderRadius: '14px',
            background: 'var(--ui-card-bg, rgba(17, 27, 44, 0.92))',
            padding: '22px',
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.04em', opacity: 0.72 }}>
            FATAL ERROR
          </p>
          <h1 style={{ margin: '8px 0 10px', fontSize: '26px' }}>Unexpected App Failure</h1>
          <p style={{ margin: '0 0 10px', opacity: 0.82 }}>
            A critical error occurred and the app could not render correctly.
          </p>
          {error.digest ? (
            <p style={{ margin: '0 0 14px', fontSize: '12px', opacity: 0.64 }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              border: '1px solid var(--ui-border, rgba(142, 166, 203, 0.42))',
              borderRadius: '9px',
              background:
                'color-mix(in srgb, var(--ui-accent-soft, rgba(39, 77, 196, 0.16)), var(--ui-surface-strong, #ffffff) 66%)',
              color: 'var(--ui-text, #e8effa)',
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Try reload
          </button>
        </main>
      </body>
    </html>
  );
}
