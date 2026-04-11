import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useImportDecksMutation } from '../../api/decks';
import { useTestDeckMutation, ITestDeckResponse } from '../../api/test-deck';
import { ApiError } from '../../lib/api-client';
import { TestDeckResult } from '../../components/TestDeckResult';

export const Route = createFileRoute('/_auth/import')({
  component: ImportPage,
});

/**
 * R15 out-of-onboarding test-mode page.
 *
 * Flow:
 *  1. User pastes a Fabrary URL and clicks "Test".
 *  2. `POST /api/decks/test` computes readiness without persisting.
 *  3. `TestDeckResult` shows the breakdown, path badge, and CTAs.
 *  4. Clicking "Track this deck" or "Track + add cards" calls the
 *     existing `POST /api/decks/import` endpoint, then redirects to
 *     the new tracked deck's detail page on success.
 *
 * Error handling is inline:
 *  - 400 (invalid URL) renders below the input.
 *  - 502 (Fabrary unreachable / timeout) renders a retry affordance.
 */
function ImportPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ITestDeckResponse | null>(null);
  const testMutation = useTestDeckMutation();
  const importMutation = useImportDecksMutation();
  const navigate = useNavigate();

  const isTesting = testMutation.isPending;
  const isTracking = importMutation.isPending;

  const testError = testMutation.error as ApiError | null;
  const importError = importMutation.error as ApiError | null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!url.trim() || isTesting) return;
    testMutation.mutate(url.trim(), {
      onSuccess: (data) => setResult(data),
    });
  };

  const handleTrack = (seedInventory: boolean): void => {
    if (!result || isTracking) return;
    importMutation.mutate(
      { urls: [url.trim()], seedInventory },
      {
        onSuccess: (response) => {
          const imported = response.imported[0];
          if (imported) {
            void navigate({
              to: '/decks/$deckId',
              params: { deckId: String(imported.trackedDeckId) },
            });
          }
        },
      },
    );
  };

  return (
    <section style={{ maxWidth: '720px' }}>
      <Link to="/home" style={{ color: '#3182ce', fontSize: '0.875rem' }}>
        &larr; Back to decks
      </Link>
      <h1 style={{ marginTop: '0.5rem' }}>Test a Fabrary deck</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Paste a Fabrary URL to see how ready your collection is to build it.
        Nothing is saved until you choose to track the deck.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label
          htmlFor="fabrary-url"
          style={{ fontSize: '0.875rem', fontWeight: 600 }}
        >
          Fabrary URL
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            id="fabrary-url"
            type="url"
            placeholder="https://fabrary.net/decks/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              flex: '1 1 320px',
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.9375rem',
            }}
            aria-invalid={testError?.status === 400}
            aria-describedby={testError?.status === 400 ? 'fabrary-url-error' : undefined}
          />
          <button
            type="submit"
            disabled={isTesting || !url.trim()}
            style={{
              padding: '0.5rem 1rem',
              background: '#2b6cb0',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: isTesting || !url.trim() ? 'not-allowed' : 'pointer',
              opacity: isTesting || !url.trim() ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            {isTesting ? (
              <>
                <Spinner /> Fetching from Fabrary...
              </>
            ) : (
              'Test'
            )}
          </button>
        </div>

        {testError?.status === 400 && (
          <div
            id="fabrary-url-error"
            role="alert"
            style={{ color: '#c53030', fontSize: '0.8125rem' }}
          >
            {testError.message || 'Invalid Fabrary URL'}
          </div>
        )}

        {testError && testError.status !== 400 && (
          <div
            role="alert"
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem 1rem',
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '6px',
              color: '#9b2c2c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <span>
              {testError.status === 502
                ? 'Could not reach Fabrary. Please try again.'
                : `Test failed: ${testError.message}`}
            </span>
            <button
              type="button"
              onClick={() => {
                if (url.trim()) testMutation.mutate(url.trim(), { onSuccess: setResult });
              }}
              style={{
                padding: '0.375rem 0.75rem',
                background: 'white',
                color: '#9b2c2c',
                border: '1px solid #9b2c2c',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
      </form>

      {importError && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '6px',
            color: '#9b2c2c',
            fontSize: '0.875rem',
          }}
        >
          Failed to track deck: {importError.message}
        </div>
      )}

      {result && (
        <TestDeckResult
          result={result}
          onTrack={() => handleTrack(false)}
          onTrackAndSeed={() => handleTrack(true)}
          isTracking={isTracking}
        />
      )}
    </section>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '12px',
        height: '12px',
        border: '2px solid rgba(255,255,255,0.5)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}
