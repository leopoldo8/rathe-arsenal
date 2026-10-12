import { catalog } from '@rathe-arsenal/engine';
import { parseThinkingLevel, TGeminiFetch } from '../recommendations/gemini-client';
import { buildSystemInstruction } from './chat-prompt';
import { readLimit, readString, runChatTool, TChatToolbox } from './chat-tools';
import { runTurn } from './chat-turn';
import { callGeminiChat } from './gemini-chat-client';

const QUESTION = 'Which Generic red attack actions with power 6 or more exist? Use search_cards, then answer in two sentences.';

/** Only search_cards answers, from the bundled catalog; every other tool says it is unavailable in the probe. */
const PROBE_TOOLBOX: TChatToolbox = new Proxy({} as TChatToolbox, {
  get: (_target, name: string) =>
    name === 'search_cards'
      ? async (args: Record<string, unknown>) => {
          const query = readString(args, 'query')!.toLowerCase();
          const cards = catalog.cards
            .filter((card) => card.name.toLowerCase().includes(query) || (card.functionalText ?? '').toLowerCase().includes(query))
            .slice(0, readLimit(args))
            .map((card) => ({ cardIdentifier: card.cardIdentifier, name: card.name, power: card.power, pitch: card.pitch }));
          return { cards };
        }
      : async () => ({ error: 'UNAVAILABLE_IN_PROBE' }),
});

/**
 * One real multi-round turn against Gemini, to prove the function-calling and replay shape before go-live.
 * Usage: GEMINI_API_KEY=... node dist/chat/probe-chat.js [--thinking low|medium|high]. The key is never printed.
 */
async function main(): Promise<void> {
  const apiKey = process.env['GEMINI_API_KEY']?.trim();
  if (!apiKey) {
    console.error('usage: GEMINI_API_KEY=... node dist/chat/probe-chat.js [--thinking low|medium|high]');
    process.exit(1);
  }
  const thinkingIndex = process.argv.indexOf('--thinking');
  const thinkingLevel = parseThinkingLevel(thinkingIndex >= 0 ? process.argv[thinkingIndex + 1] : undefined);
  const startedAt = Date.now();
  const result = await runTurn({
    system: buildSystemInstruction({ locale: 'en-US', decks: [], boundDeck: null, today: new Date() }),
    history: [{ role: 'user', parts: [{ text: QUESTION }] }],
    call: (request) => callGeminiChat(apiKey, request, fetch as unknown as TGeminiFetch, { thinkingLevel }),
    recordUsage: async () => undefined,
    runTool: (name, args) => runChatTool(PROBE_TOOLBOX, name, args),
    now: () => Date.now(),
    onTool: (tool, durationMs) => console.log(`tool ${tool} ${durationMs} ms`),
  });
  console.log(
    JSON.stringify(
      {
        outcome: result.kind,
        ...(result.kind === 'failed' ? { code: result.code, detail: result.detail } : { text: result.text }),
        modelCalls: result.calls,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
  process.exit(result.kind === 'done' && result.calls >= 2 ? 0 : 1);
}

if (require.main === module) {
  void main();
}
