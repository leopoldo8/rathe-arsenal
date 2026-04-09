import { useState } from 'react';
import {
  useImportDecksMutation,
  IImportDecksResponse,
} from '../api/decks';

const FABRARY_URL_REGEX = /^https?:\/\/(www\.)?fabrary\.net\/decks\/[A-Za-z0-9]+/;
const MAX_URLS = 5;

function validateUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return 'URL is required';
  if (!FABRARY_URL_REGEX.test(trimmed)) return 'Must be a valid Fabrary deck URL';
  return null;
}

export function OnboardingForm() {
  const [urls, setUrls] = useState<string[]>(['']);
  const [result, setResult] = useState<IImportDecksResponse | null>(null);
  const importMutation = useImportDecksMutation();

  function handleUrlChange(index: number, value: string): void {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  function handleAddRow(): void {
    if (urls.length >= MAX_URLS) return;
    setUrls((prev) => [...prev, '']);
  }

  function handleRemoveRow(index: number): void {
    if (urls.length <= 1) return;
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setResult(null);

    const trimmedUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (trimmedUrls.length === 0) return;

    // Client-side validation
    const hasErrors = trimmedUrls.some((u) => validateUrl(u) !== null);
    if (hasErrors) return;

    try {
      const response = await importMutation.mutateAsync(trimmedUrls);
      setResult(response);
    } catch {
      // Error handled by TanStack Query
    }
  }

  const validationErrors = urls.map((u) => (u.trim() ? validateUrl(u) : null));
  const hasNonEmpty = urls.some((u) => u.trim().length > 0);
  const hasValidationErrors = validationErrors.some((e) => e !== null);
  const isSubmitDisabled =
    !hasNonEmpty || hasValidationErrors || importMutation.isPending;

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {urls.map((url, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="url"
                  placeholder="https://fabrary.net/decks/..."
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: validationErrors[index] ? '1px solid #e53e3e' : '1px solid #ccc',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                />
                {validationErrors[index] && (
                  <div style={{ color: '#e53e3e', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {validationErrors[index]}
                  </div>
                )}
              </div>
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  style={{ padding: '0.5rem', cursor: 'pointer' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          {urls.length < MAX_URLS && (
            <button type="button" onClick={handleAddRow} style={{ cursor: 'pointer' }}>
              + Add another URL
            </button>
          )}
          <button type="submit" disabled={isSubmitDisabled} style={{ cursor: isSubmitDisabled ? 'not-allowed' : 'pointer' }}>
            {importMutation.isPending ? 'Importing...' : 'Import Decks'}
          </button>
        </div>
      </form>

      {importMutation.error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff5f5', border: '1px solid #e53e3e', borderRadius: '4px' }}>
          <strong>Error:</strong> {(importMutation.error as Error).message}
        </div>
      )}

      {result && <ImportResultSummary result={result} />}
    </div>
  );
}

function ImportResultSummary({ result }: { readonly result: IImportDecksResponse }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3>Import Results</h3>

      {result.imported.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#38a169' }}>
            Imported ({result.imported.length})
          </h4>
          <ul>
            {result.imported.map((deck) => (
              <li key={deck.trackedDeckId}>
                <strong>{deck.name}</strong> ({deck.hero} - {deck.format})
                {deck.readinessSnapshot && (
                  <span> - {deck.readinessSnapshot.effectivePercent.toFixed(1)}% ready</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.skipped.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#d69e2e' }}>
            Skipped ({result.skipped.length})
          </h4>
          <ul>
            {result.skipped.map((s, i) => (
              <li key={i}>
                {s.url} - {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.errors.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: '#e53e3e' }}>
            Errors ({result.errors.length})
          </h4>
          <ul>
            {result.errors.map((err, i) => (
              <li key={i}>
                {err.url} - {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
