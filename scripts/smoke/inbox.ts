import { pollUntil } from './poll';

/** The part of a Resend received e-mail the smoke reads. */
export interface IReceivedEmail {
  readonly id: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly createdAt: string;
  readonly text?: string | null;
}

const SPACED_CODE = /(?<!\d)(\d{3})[\s  ](\d{3})(?!\d)/;
const TEXT_CODE = /(?:Seu c[oó]digo|Your code):\s*(\d{3})[\s  ]?(\d{3})(?!\d)/i;

/**
 * The six digits of a sign-in code e-mail. The subject carries them as "482 913 ..." and the plain
 * text part as "Seu código: 482 913" (apps/api/src/email/templates/sign-in-code-email.template.ts).
 * Null when the e-mail is something else (for example the sign-up confirmation).
 */
export function extractCode(subject: string, text: string | null | undefined): string | null {
  const fromSubject = SPACED_CODE.exec(subject);
  if (fromSubject) return `${fromSubject[1]}${fromSubject[2]}`;
  const fromText = text ? TEXT_CODE.exec(text) : null;
  return fromText ? `${fromText[1]}${fromText[2]}` : null;
}

/** Resend sends ISO 8601 for the API but "2023-04-03 22:13:42.674981+00" elsewhere in its docs; accept both. */
export function parseReceivedAt(value: string): number | null {
  const normalized = value
    .trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function bareAddress(recipient: string): string {
  const angle = /<([^>]+)>/.exec(recipient);
  return (angle?.[1] ?? recipient).trim().toLowerCase();
}

export function isAddressedTo(email: IReceivedEmail, address: string): boolean {
  const wanted = address.trim().toLowerCase();
  return email.to.some((recipient) => bareAddress(recipient) === wanted);
}

/** Clock difference tolerated between this machine and Resend. */
export const CLOCK_SKEW_MS = 5_000;

/** Newest first, only e-mails for `address` received no earlier than the code request (minus the clock tolerance). */
export function candidatesFor(emails: readonly IReceivedEmail[], address: string, requestedAtMs: number): readonly IReceivedEmail[] {
  return emails
    .filter((email) => isAddressedTo(email, address))
    .map((email) => ({ email, at: parseReceivedAt(email.createdAt) }))
    .filter((entry): entry is { email: IReceivedEmail; at: number } => entry.at !== null && entry.at >= requestedAtMs - CLOCK_SKEW_MS)
    .sort((a, b) => b.at - a.at)
    .map((entry) => entry.email);
}

export interface IInbox {
  list(): Promise<readonly IReceivedEmail[]>;
  read(id: string): Promise<IReceivedEmail>;
}

export interface IWaitForCodeOptions {
  readonly address: string;
  readonly requestedAtMs: number;
  readonly timeoutMs: number;
  readonly intervalMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

/** Polls the inbox until a sign-in code e-mail for `address` newer than the request shows up. */
export async function waitForCode(inbox: IInbox, options: IWaitForCodeOptions): Promise<string> {
  const looked = new Set<string>();
  return pollUntil(
    async () => {
      let emails: readonly IReceivedEmail[];
      try {
        emails = await inbox.list();
      } catch (error) {
        return { done: false, note: `inbox list failed: ${(error as Error).message}` };
      }
      const fresh = candidatesFor(emails, options.address, options.requestedAtMs);
      for (const email of fresh) {
        const fromSubject = extractCode(email.subject, null);
        if (fromSubject) return { done: true, value: fromSubject };
        if (looked.has(email.id)) continue;
        try {
          const full = await inbox.read(email.id);
          const code = extractCode(full.subject, full.text);
          if (code) return { done: true, value: code };
          looked.add(email.id);
        } catch (error) {
          return { done: false, note: `inbox read failed: ${(error as Error).message}` };
        }
      }
      return { done: false, note: `${emails.length} e-mails listed, ${fresh.length} for ${options.address} since the request, none with a code` };
    },
    { timeoutMs: options.timeoutMs, intervalMs: options.intervalMs, ...(options.sleep ? { sleep: options.sleep } : {}), ...(options.now ? { now: options.now } : {}) },
  );
}

interface IResendListItem {
  id: string;
  to: string[];
  subject: string;
  created_at: string;
}

interface IResendEmail extends IResendListItem {
  text?: string | null;
}

const RESEND_API = 'https://api.resend.com';
const LIST_LIMIT = 20;
const RESEND_TIMEOUT_MS = 15_000;

async function resendGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${RESEND_API}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status} for GET ${path.split('?')[0]}`);
  return (await res.json()) as T;
}

function toReceived(item: IResendEmail): IReceivedEmail {
  return { id: item.id, to: item.to ?? [], subject: item.subject ?? '', createdAt: item.created_at, text: item.text ?? null };
}

/**
 * Reads received e-mails through Resend's receiving API:
 * - list:     GET https://api.resend.com/emails/receiving?limit=N  -> { object: 'list', has_more, data: [{ id, to[], from, subject, created_at, ... }] }
 *             https://resend.com/docs/api-reference/emails/list-received-emails
 * - retrieve: GET https://api.resend.com/emails/receiving/{id}      -> { id, to[], subject, html, text, created_at, ... }
 *             https://resend.com/docs/api-reference/emails/retrieve-received-email
 * Receiving setup: https://resend.com/docs/dashboard/receiving/introduction
 */
export function createResendInbox(apiKey: string): IInbox {
  return {
    async list(): Promise<readonly IReceivedEmail[]> {
      const page = await resendGet<{ data: IResendListItem[] }>(apiKey, `/emails/receiving?limit=${LIST_LIMIT}`);
      return page.data.map(toReceived);
    },
    async read(id: string): Promise<IReceivedEmail> {
      return toReceived(await resendGet<IResendEmail>(apiKey, `/emails/receiving/${encodeURIComponent(id)}`));
    },
  };
}
