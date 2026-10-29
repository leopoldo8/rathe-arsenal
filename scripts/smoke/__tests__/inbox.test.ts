import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { candidatesFor, extractCode, isAddressedTo, parseReceivedAt, waitForCode, type IInbox, type IReceivedEmail } from '../inbox';

const mail = (over: Partial<IReceivedEmail>): IReceivedEmail => ({
  id: 'e1',
  to: ['smoke@abc.resend.app'],
  subject: '482 913 é o seu código do Rathe Arsenal',
  createdAt: '2026-10-28T12:00:10.000Z',
  ...over,
});

describe('extractCode', () => {
  it('reads the pt-BR subject and strips the space', () => {
    assert.equal(extractCode('482 913 é o seu código do Rathe Arsenal', null), '482913');
  });
  it('reads the en-US subject', () => {
    assert.equal(extractCode('007 120 is your Rathe Arsenal code', null), '007120');
  });
  it('falls back to the text part in both languages', () => {
    assert.equal(extractCode('Entrar', 'Rathe Arsenal\n\nSeu código: 482 913\n\nEntrar'), '482913');
    assert.equal(extractCode('Sign in', 'Your code: 482 913'), '482913');
  });
  it('is null for other e-mails and never takes digits out of a longer number', () => {
    assert.equal(extractCode('Confirme seu e-mail', 'Clique no link'), null);
    assert.equal(extractCode('Pedido 1234 567 8', null), null);
  });
});

describe('parseReceivedAt', () => {
  it('accepts ISO and the Postgres-like form of the Resend docs', () => {
    assert.equal(parseReceivedAt('2026-10-28T12:00:10.000Z'), Date.parse('2026-10-28T12:00:10.000Z'));
    assert.equal(parseReceivedAt('2026-10-28 12:00:10.674981+00'), Date.parse('2026-10-28T12:00:10.674Z'));
  });
  it('is null for garbage', () => {
    assert.equal(parseReceivedAt('yesterday'), null);
  });
});

describe('isAddressedTo / candidatesFor', () => {
  const requestedAt = Date.parse('2026-10-28T12:00:00.000Z');
  it('matches a bare or named address, ignoring case', () => {
    assert.equal(isAddressedTo(mail({ to: ['Smoke <SMOKE@abc.resend.app>'] }), 'smoke@abc.resend.app'), true);
    assert.equal(isAddressedTo(mail({ to: ['other@abc.resend.app'] }), 'smoke@abc.resend.app'), false);
  });
  it('keeps only e-mails for the address received after the request, newest first', () => {
    const old = mail({ id: 'old', createdAt: '2026-10-28T11:50:00.000Z' });
    const other = mail({ id: 'other', to: ['x@abc.resend.app'] });
    const first = mail({ id: 'first', createdAt: '2026-10-28T12:00:05.000Z' });
    const second = mail({ id: 'second', createdAt: '2026-10-28T12:00:20.000Z' });
    const picked = candidatesFor([old, other, first, second], 'smoke@abc.resend.app', requestedAt);
    assert.deepEqual(picked.map((email) => email.id), ['second', 'first']);
  });
  it('tolerates a few seconds of clock difference but not more', () => {
    const justBefore = mail({ id: 'near', createdAt: '2026-10-28T11:59:57.000Z' });
    const wellBefore = mail({ id: 'far', createdAt: '2026-10-28T11:59:50.000Z' });
    assert.deepEqual(candidatesFor([justBefore, wellBefore], 'smoke@abc.resend.app', requestedAt).map((e) => e.id), ['near']);
  });
});

describe('waitForCode', () => {
  const requestedAtMs = Date.parse('2026-10-28T12:00:00.000Z');
  const options = { address: 'smoke@abc.resend.app', requestedAtMs, timeoutMs: 30_000, intervalMs: 5_000 };
  const fakeClock = (): { sleep: (ms: number) => Promise<void>; now: () => number } => {
    let t = 0;
    return { sleep: async (ms) => void (t += ms), now: () => t };
  };

  it('waits through empty polls and reads the code from the subject', async () => {
    let calls = 0;
    const inbox: IInbox = {
      list: async () => (++calls < 3 ? [] : [mail({})]),
      read: async () => assert.fail('the subject already has the code'),
    };
    assert.equal(await waitForCode(inbox, { ...options, ...fakeClock() }), '482913');
    assert.equal(calls, 3);
  });

  it('opens the e-mail when the subject has no code', async () => {
    const inbox: IInbox = {
      list: async () => [mail({ id: 'a', subject: 'Entrar' })],
      read: async () => mail({ id: 'a', subject: 'Entrar', text: 'Seu código: 111 222' }),
    };
    assert.equal(await waitForCode(inbox, { ...options, ...fakeClock() }), '111222');
  });

  it('opens an e-mail without a code only once across polls (a received e-mail does not change)', async () => {
    let reads = 0;
    const inbox: IInbox = {
      list: async () => [mail({ id: 'confirm', subject: 'Confirme seu e-mail' })],
      read: async () => {
        reads += 1;
        return mail({ id: 'confirm', subject: 'Confirme seu e-mail', text: 'Clique no link' });
      },
    };
    await assert.rejects(waitForCode(inbox, { ...options, ...fakeClock() }), /timed out/);
    assert.equal(reads, 1);
  });

  it('never returns the code of an old e-mail or of another address, and times out', async () => {
    const inbox: IInbox = {
      list: async () => [mail({ createdAt: '2026-10-28T11:00:00.000Z' }), mail({ id: 'z', to: ['someone@abc.resend.app'] })],
      read: async () => assert.fail('nothing to open'),
    };
    await assert.rejects(waitForCode(inbox, { ...options, ...fakeClock() }), /timed out after 30s.*none with a code/);
  });

  it('keeps polling through a failing inbox call and reports it on timeout', async () => {
    const inbox: IInbox = { list: async () => Promise.reject(new Error('Resend answered 401 for GET /emails/receiving')), read: async () => assert.fail('unused') };
    await assert.rejects(waitForCode(inbox, { ...options, ...fakeClock() }), /inbox list failed: Resend answered 401/);
  });
});
