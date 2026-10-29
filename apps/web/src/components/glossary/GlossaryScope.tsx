import React, { useRef } from 'react';
import { createRegistry, GlossaryScopeContext, type IGlossaryRegistry } from './glossary-scope';

/**
 * One screen of the app: a word shows its "?" only at its first appearance inside the scope, so
 * "Pitch" is explained once and not at each of its fourteen mentions. The scope is remounted
 * (by its `key`) when the screen changes.
 */
export function GlossaryScope({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const registry = useRef<IGlossaryRegistry | null>(null);
  if (registry.current === null) registry.current = createRegistry();
  return <GlossaryScopeContext.Provider value={registry.current}>{children}</GlossaryScopeContext.Provider>;
}

