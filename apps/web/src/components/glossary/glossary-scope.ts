import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { TGlossaryTermId } from './glossary-model';

export interface IGlossaryRegistry {
  register: (term: TGlossaryTermId, owner: string) => () => void;
  subscribe: (listener: () => void) => () => void;
  firstOwnerOf: (term: TGlossaryTermId) => string | undefined;
}

export function createRegistry(): IGlossaryRegistry {
  const owners = new Map<TGlossaryTermId, string[]>();
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());
  return {
    register(term, owner) {
      owners.set(term, [...(owners.get(term) ?? []), owner]);
      notify();
      return () => {
        owners.set(term, (owners.get(term) ?? []).filter((candidate) => candidate !== owner));
        notify();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    firstOwnerOf: (term) => owners.get(term)?.[0],
  };
}

export const GlossaryScopeContext = createContext<IGlossaryRegistry | null>(null);

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** True when this appearance of the word is the first one of its scope; with no scope every appearance is. */
export function useIsFirstAppearance(term: TGlossaryTermId): boolean {
  const registry = useContext(GlossaryScopeContext);
  const owner = useId();
  const own = useMemo<IGlossaryRegistry>(() => registry ?? createRegistry(), [registry]);
  useIsomorphicLayoutEffect(() => (registry === null ? undefined : registry.register(term, owner)), [registry, term, owner]);
  const subscribe = useCallback((listener: () => void) => own.subscribe(listener), [own]);
  const firstOwner = useSyncExternalStore(
    subscribe,
    () => own.firstOwnerOf(term),
    () => undefined,
  );
  return registry === null || firstOwner === owner;
}
