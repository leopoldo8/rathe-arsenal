export interface IPollOptions {
  readonly timeoutMs: number;
  readonly intervalMs: number;
  /** Injected so tests do not wait. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export type TPollResult<T> = { readonly done: true; readonly value: T } | { readonly done: false; readonly note: string };

export class PollTimeout extends Error {
  constructor(
    readonly lastNote: string,
    readonly timeoutMs: number,
  ) {
    super(`timed out after ${Math.round(timeoutMs / 1000)}s; last observation: ${lastNote}`);
  }
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls `attempt` until it is done or the time is up; always tries once. */
export async function pollUntil<T>(attempt: () => Promise<TPollResult<T>>, options: IPollOptions): Promise<T> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let lastNote = 'no attempt finished';
  for (;;) {
    const result = await attempt();
    if (result.done) return result.value;
    lastNote = result.note;
    if (now() + options.intervalMs > deadline) throw new PollTimeout(lastNote, options.timeoutMs);
    await sleep(options.intervalMs);
  }
}
