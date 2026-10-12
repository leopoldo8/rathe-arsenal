import type { Page } from '@playwright/test';

export const CONVERSATION_ID = '00000000-0000-4000-8000-000000000001';

const CONVERSATIONS = [
  { id: CONVERSATION_ID, title: 'Katsu nos torneios recentes', trackedDeckId: null, updatedAt: '2026-10-11T10:00:00.000Z' },
  { id: '00000000-0000-4000-8000-000000000002', title: 'Qual herói montar a seguir?', trackedDeckId: null, updatedAt: '2026-10-10T10:00:00.000Z' },
  { id: '00000000-0000-4000-8000-000000000003', title: 'Regra de gatilhos ao atacar', trackedDeckId: null, updatedAt: '2026-10-03T10:00:00.000Z' },
];

const THREAD = {
  ...CONVERSATIONS[0],
  messages: [
    { id: 'm-1', role: 'user', status: 'done', text: 'Como o pessoal está montando o Katsu nos torneios?', error: null, proposals: [], createdAt: '2026-10-11T10:00:00.000Z' },
    {
      id: 'm-2',
      role: 'assistant',
      status: 'done',
      text: '6 decks de Katsu no top 8 desde agosto. Sobre a ordem dos gatilhos, vale a (rule 6.2.1).\n\n- 3 Flick Knives\n- 3 Lunging Press',
      error: null,
      proposals: [],
      createdAt: '2026-10-11T10:00:30.000Z',
    },
  ],
};

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

/** Stubs `/auth/me` with the given flag and every `/chat` route the screens read; a real turn needs Gemini. */
export async function stubChat(page: Page, chatAccess: boolean): Promise<void> {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill(json({ id: 'chat-e2e', email: 'chat@example.com', role: 'user', chatAccess, settings: { theme: 'dark' } })),
  );
  await page.route('**/api/chat/usage', (route) => route.fulfill(json({ spentUsd: 0.4, budgetUsd: 5, resetsAt: '2026-11-01T00:00:00.000Z' })));
  await page.route('**/api/chat/conversations', (route) =>
    route.request().method() === 'GET' ? route.fulfill(json(CONVERSATIONS)) : route.fulfill({ ...json({ id: CONVERSATION_ID }), status: 201 }),
  );
  await page.route(`**/api/chat/conversations/${CONVERSATION_ID}`, (route) => route.fulfill(json(THREAD)));
}
