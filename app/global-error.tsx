'use client';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body className="route-state-page route-state-global-page">
        <main className="route-state-card route-state-global-card">
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
