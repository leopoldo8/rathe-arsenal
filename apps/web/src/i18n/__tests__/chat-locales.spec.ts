import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ptBR } from '../locales/pt-BR';
import { enUS } from '../locales/en-US';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHAT_ERROR_CODES = [
  'CHAT_ACCESS_DENIED',
  'CHAT_TURN_IN_PROGRESS',
  'CHAT_BUDGET_EXHAUSTED',
  'MESSAGE_NOT_RETRYABLE',
  'PROPOSAL_NOT_PENDING',
  'PROPOSAL_STALE',
] as const;

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

function chatSources(): string[] {
  const chatDir = path.join(SRC_ROOT, 'components/chat');
  return [
    ...fs.readdirSync(chatDir).filter((file) => file.endsWith('.tsx')).map((file) => path.join(chatDir, file)),
    path.join(SRC_ROOT, 'components/deck-detail/recommendations/DeckTutorTile.tsx'),
  ];
}

describe('chat locales', () => {
  it('chat copy and error codes exist in both locales', () => {
    expect(keyPaths(enUS.chat).sort()).toEqual(keyPaths(ptBR.chat).sort());
    expect(keyPaths(ptBR.chat).length).toBeGreaterThan(40);
    for (const code of CHAT_ERROR_CODES) {
      expect(typeof ptBR.apiErrors[code]).toBe('string');
      expect(typeof enUS.apiErrors[code]).toBe('string');
    }
  });

  it('chat components hold no user-facing literals', () => {
    const offenders = chatSources().flatMap((file) => {
      const source = fs.readFileSync(file, 'utf-8');
      const textNodes = [...source.matchAll(/(?<![=\s-])>\s*([^<>{}\n]*[A-Za-zÀ-ú][^<>{}\n]*)\s*</g)].map((match) => match[1]!.trim());
      const attributes = [...source.matchAll(/\b(?:placeholder|aria-label|title|alt)="([^"]*)"/g)].map((match) => match[1]!);
      return [...textNodes, ...attributes].filter((text) => /[A-Za-zÀ-ú]/.test(text)).map((text) => `${path.basename(file)}: ${text}`);
    });

    expect(offenders).toEqual([]);
  });
});
