/**
 * Tests for AuthProvider — U13 draft key cleanup on signOut and deleteAccount.
 *
 * Covers:
 *  - signOut removes all ra-deck-draft-* keys
 *  - signOut preserves UX prefs (ra-deck-sidebar-expanded, ra-shelf-retired-expanded)
 *  - deleteAccount removes all ra-deck-draft-* keys
 *  - After cleanup, opening deck in Edit mode shows clean entry (no restore prompt)
 *    (documented as integration contract — covered by readStoredDraft returning null)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';

// ---------------------------------------------------------------------------
// Mock auth-fetch so no real HTTP requests are made
// ---------------------------------------------------------------------------

vi.mock('../../lib/auth-fetch', () => ({
  authFetch: vi.fn().mockResolvedValue({
    ok: true,
    jwt: 'mock-jwt',
    user: { id: 'u1', email: 'test@example.com' },
    settings: { theme: 'dark' },
  }),
  AuthFetchError: class AuthFetchError extends Error {
    status: number;
    retryAfterSeconds: number | null;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.retryAfterSeconds = null;
    }
  },
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string): void => { store[key] = value; }),
    removeItem: vi.fn((key: string): void => { delete store[key]; }),
    clear: (): void => { store = {}; },
    get store(): Record<string, string> { return store; },
    get length(): number { return Object.keys(store).length; },
    key: vi.fn((index: number): string | null => Object.keys(store)[index] ?? null),
    keys: (): string[] => Object.keys(store),
  };
})();

// Override Object.keys to return mock store keys when called on localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    ...localStorageMock,
    // Make Object.keys(localStorage) work
    [Symbol.iterator]: function* () {
      yield* localStorageMock.keys();
    },
  },
  writable: true,
});

// Make Object.keys(localStorage) return the mock store keys
const originalObjectKeys = Object.keys;
vi.spyOn(Object, 'keys').mockImplementation((obj: unknown) => {
  if (obj === global.localStorage) {
    return localStorageMock.keys();
  }
  return originalObjectKeys(obj as object);
});

// ---------------------------------------------------------------------------
// Test consumer
// ---------------------------------------------------------------------------

function SignOutButton(): React.ReactElement {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={signOut} data-testid="sign-out">
      Sign out
    </button>
  );
}

function DeleteAccountButton(): React.ReactElement {
  const { deleteAccount } = useAuth();
  return (
    <button
      type="button"
      onClick={() => void deleteAccount('password123')}
      data-testid="delete-account"
    >
      Delete
    </button>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  // Restore Object.keys mock after each test
  vi.spyOn(Object, 'keys').mockImplementation((obj: unknown) => {
    if (obj === global.localStorage) {
      return localStorageMock.keys();
    }
    return originalObjectKeys(obj as object);
  });
});

// ---------------------------------------------------------------------------
// signOut — draft key cleanup
// ---------------------------------------------------------------------------

describe('AuthProvider.signOut — draft key cleanup', () => {
  it('removes all ra-deck-draft-* keys on signOut', async () => {
    localStorageMock.setItem('ra-deck-draft-42', '{"version":"v1","heroIdentifier":null,"format":"Classic Constructed","cards":[]}');
    localStorageMock.setItem('ra-deck-draft-99', '{"version":"v1","heroIdentifier":null,"format":"Blitz","cards":[]}');
    localStorageMock.setItem('ra-deck-draft-7', '{"version":"v1","heroIdentifier":"katsu","format":"Classic Constructed","cards":[]}');

    const { getByTestId } = render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await act(async () => {
      getByTestId('sign-out').click();
    });

    expect(localStorageMock.getItem('ra-deck-draft-42')).toBeNull();
    expect(localStorageMock.getItem('ra-deck-draft-99')).toBeNull();
    expect(localStorageMock.getItem('ra-deck-draft-7')).toBeNull();
  });

  it('preserves UX prefs on signOut (ra-deck-sidebar-expanded, ra-shelf-retired-expanded)', async () => {
    localStorageMock.setItem('ra-deck-sidebar-expanded', 'true');
    localStorageMock.setItem('ra-shelf-retired-expanded', 'false');
    localStorageMock.setItem('ra-deck-draft-42', '{"version":"v1"}');

    const { getByTestId } = render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await act(async () => {
      getByTestId('sign-out').click();
    });

    // Draft keys are removed
    expect(localStorageMock.getItem('ra-deck-draft-42')).toBeNull();
    // UX prefs are preserved
    expect(localStorageMock.getItem('ra-deck-sidebar-expanded')).toBe('true');
    expect(localStorageMock.getItem('ra-shelf-retired-expanded')).toBe('false');
  });

  it('does not throw when no draft keys exist', async () => {
    // No draft keys in localStorage
    const { getByTestId } = render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await expect(
      act(async () => { getByTestId('sign-out').click(); }),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deleteAccount — draft key cleanup
// ---------------------------------------------------------------------------

describe('AuthProvider.deleteAccount — draft key cleanup', () => {
  it('removes all ra-deck-draft-* keys on deleteAccount', async () => {
    localStorageMock.setItem('ra-deck-draft-42', '{"version":"v1","heroIdentifier":null,"format":"Classic Constructed","cards":[]}');
    localStorageMock.setItem('ra-deck-draft-100', '{"version":"v1","heroIdentifier":"briar","format":"Blitz","cards":[]}');

    const { getByTestId } = render(
      <AuthProvider>
        <DeleteAccountButton />
      </AuthProvider>,
    );

    await act(async () => {
      getByTestId('delete-account').click();
      // Wait for the async deleteAccount promise to resolve
      await Promise.resolve();
    });

    expect(localStorageMock.getItem('ra-deck-draft-42')).toBeNull();
    expect(localStorageMock.getItem('ra-deck-draft-100')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration contract: after signOut, readStoredDraft returns null
// ---------------------------------------------------------------------------

describe('AuthProvider — integration: sign-out then Edit entry shows clean state', () => {
  it('after signOut clears ra-deck-draft-A, readStoredDraft returns null for deck A', async () => {
    // Setup: user had a draft for deck 42
    localStorageMock.setItem(
      'ra-deck-draft-42',
      JSON.stringify({
        version: 'v1',
        heroIdentifier: 'katsu',
        format: 'Classic Constructed',
        cards: [{ cardIdentifier: 'pummel-red-dyn', quantity: 2, slot: 'mainboard' }],
      }),
    );

    const { getByTestId } = render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    // Sign out
    await act(async () => {
      getByTestId('sign-out').click();
    });

    // Now simulate re-entry to Edit mode: readStoredDraft should find nothing
    const { readStoredDraft } = await import('../../hooks/useCompositionDraft');
    const result = readStoredDraft('42');
    expect(result).toBeNull();
  });
});
