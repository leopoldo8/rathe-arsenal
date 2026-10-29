export class StepFailure extends Error {}

export interface IStepLog {
  info(line: string): void;
}

/** Runs one named step; a failure carries the step's name so the log says which check broke. */
export async function runStep<T>(name: string, log: IStepLog, body: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const value = await body();
    log.info(`ok    ${name} (${Date.now() - started} ms)`);
    return value;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.info(`FAIL  ${name}: ${reason}`);
    throw new StepFailure(`${name}: ${reason}`);
  }
}

export function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function describeBody(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}...` : flat;
}
