import { fileURLToPath } from 'node:url';

export const engineLegalityAlias = {
  '@rathe-arsenal/engine/legality': fileURLToPath(new URL('../../packages/engine/src/legality/index.ts', import.meta.url)),
};
