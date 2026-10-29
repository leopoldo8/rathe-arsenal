import { appendFileSync } from 'node:fs';
import type { TEnv } from './config';

/**
 * The GitHub Environment inputs a smoke run needs, by the sign-in mode the environment chose.
 * Names only: values never pass through here, so nothing secret can reach a log.
 */
export function missingInputs(env: TEnv): readonly string[] {
  const has = (name: string): boolean => Boolean(env[name]?.trim());
  const missing: string[] = [];
  if (!has('SMOKE_BASE_URL')) missing.push('SMOKE_BASE_URL');
  const signIn = env['SMOKE_SIGN_IN']?.trim();
  if (signIn !== 'code' && signIn !== 'password' && signIn !== 'none') {
    missing.push('SMOKE_SIGN_IN');
    return missing;
  }
  if (signIn === 'none') return missing;
  if (!has('SMOKE_EMAIL')) missing.push('SMOKE_EMAIL');
  if (signIn === 'password' && !has('SMOKE_PASSWORD')) missing.push('SMOKE_PASSWORD');
  // In CI the inbox is always Resend inbound: dev-response needs EXPOSE_DEV_SECRETS, which no deployed environment has.
  if (signIn === 'code' && !has('RESEND_INBOUND_API_KEY')) missing.push('RESEND_INBOUND_API_KEY');
  return missing;
}

export interface IReadiness {
  readonly ready: boolean;
  /** Process exit code: a manual run that cannot start fails, an automatic one skips. */
  readonly exitCode: 0 | 1;
  readonly message: string;
}

export function decideReadiness(env: TEnv, strict: boolean): IReadiness {
  const missing = missingInputs(env);
  if (missing.length === 0) return { ready: true, exitCode: 0, message: 'All smoke inputs are set.' };
  const list = missing.join(', ');
  if (strict) return { ready: false, exitCode: 1, message: `Smoke cannot run: the GitHub Environment is missing ${list}.` };
  return { ready: false, exitCode: 0, message: `Smoke skipped: the GitHub Environment is missing ${list}. Follow the Smoke test section of scripts/deploy-railway.md.` };
}

function main(): void {
  const result = decideReadiness(process.env, process.env['SMOKE_STRICT'] === 'true');
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) appendFileSync(outputFile, `ready=${result.ready}\n`);
  console.log(result.ready ? result.message : `::${result.exitCode === 1 ? 'error' : 'notice'}::${result.message}`);
  process.exit(result.exitCode);
}

if (require.main === module) main();
