import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { CHAT_TURN_FAILURE_CODES } from '../../../api/chat';
import { failureOutcome } from '../chat-failure';

const API_ENTITY = path.resolve(__dirname, '../../../../../api/src/database/entities/chat-message.entity.ts');

function apiFailureCodes(): string[] {
  const source = fs.readFileSync(API_ENTITY, 'utf-8');
  const list = /CHAT_TURN_FAILURE_CODES = \[([\s\S]*?)\] as const/.exec(source)![1]!;
  return [...list.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]!);
}

describe('failureOutcome', () => {
  it('every turn failure code has one outcome', () => {
    const outcomes = Object.fromEntries(CHAT_TURN_FAILURE_CODES.map((code) => [code, failureOutcome(code)]));

    expect([...CHAT_TURN_FAILURE_CODES]).toEqual(apiFailureCodes());
    expect(outcomes).toEqual({
      BUDGET_EXHAUSTED: 'limit',
      NO_API_KEY: 'generic',
      RATE_LIMITED: 'busy',
      PROVIDER_UNAVAILABLE: 'busy',
      PROVIDER_ERROR: 'generic',
      MODEL_TIMEOUT: 'timeout',
      TURN_TIMEOUT: 'timeout',
      MODEL_REFUSED: 'generic',
      MODEL_TRUNCATED: 'generic',
      MODEL_BAD_TOOL_CALL: 'generic',
      TOO_MANY_TOOL_ROUNDS: 'generic',
      HISTORY_REJECTED: 'generic',
      MODEL_EMPTY: 'generic',
      WORKER_LOST: 'timeout',
    });
  });
});
