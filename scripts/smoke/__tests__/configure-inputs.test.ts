import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import { ConfigError } from '../config';
import { createTerminalPrompter, parseArgs, readInputs, type IPrompter } from '../configure-inputs';

function fakePrompter(answers: Record<string, string>): IPrompter {
  return { ask: async (label) => answers[label] ?? '', close: () => undefined };
}

describe('parseArgs', () => {
  it('takes one environment and the two flags', () => {
    assert.deepEqual(parseArgs(['staging']), { environment: 'staging', noRun: false, dryRun: false });
    assert.deepEqual(parseArgs(['--dry-run', 'production', '--no-run']), { environment: 'production', noRun: true, dryRun: true });
  });
  it('rejects a missing, repeated or unknown argument', () => {
    assert.throws(() => parseArgs([]), ConfigError);
    assert.throws(() => parseArgs(['staging', 'production']), /more than one/);
    assert.throws(() => parseArgs(['qa']), /unknown argument "qa"/);
    assert.throws(() => parseArgs(['staging', '--force']), /unknown argument/);
  });
});

describe('readInputs', () => {
  it('uses the environment and does not prompt when all three are set', async () => {
    let asked = 0;
    const prompter: IPrompter = { ask: async () => String(asked++), close: () => undefined };
    const inputs = await readInputs({ SMOKE_BASE_URL: 'https://app.example/x', SMOKE_EMAIL: 'Smoke@Example.com', SMOKE_PASSWORD: 'pw-0123456789' }, prompter);
    assert.equal(asked, 0);
    assert.equal(inputs.config.signIn, 'password');
    assert.equal(inputs.secrets.SMOKE_BASE_URL, 'https://app.example');
    assert.equal(inputs.secrets.SMOKE_EMAIL, 'smoke@example.com');
  });
  it('prompts for what is missing or empty, and only the password is secret', async () => {
    const asked: [string, boolean][] = [];
    const prompter: IPrompter = {
      async ask(label, secret) {
        asked.push([label.split(' ')[0] ?? '', secret]);
        if (label.startsWith('Base URL')) return 'https://app.example';
        return label.startsWith('Smoke account password') ? 'pw-0123456789' : 'a@b.c';
      },
      close: () => undefined,
    };
    const inputs = await readInputs({ SMOKE_EMAIL: '   ' }, prompter);
    assert.deepEqual(asked, [['Base', false], ['Smoke', false], ['Smoke', true]]);
    assert.equal(inputs.secrets.SMOKE_PASSWORD, 'pw-0123456789');
  });
  it('fails on an empty answer and on a bad URL', async () => {
    await assert.rejects(readInputs({ SMOKE_BASE_URL: 'https://a.example', SMOKE_EMAIL: 'a@b.c' }, fakePrompter({})), /SMOKE_PASSWORD is required/);
    await assert.rejects(readInputs({ SMOKE_BASE_URL: 'nope', SMOKE_EMAIL: 'a@b.c', SMOKE_PASSWORD: 'x' }, fakePrompter({})), /not a valid URL/);
  });
});

describe('createTerminalPrompter', () => {
  it('reads one line per question and never writes the secret answer to the output', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let written = '';
    output.on('data', (chunk: Buffer) => (written += chunk.toString()));
    const prompter = createTerminalPrompter(input, output);
    input.write('https://app.example\nsecret-password-1\n');
    assert.equal(await prompter.ask('URL', false), 'https://app.example');
    assert.equal(await prompter.ask('Password', true), 'secret-password-1');
    prompter.close();
    assert.ok(written.includes('URL: '));
    assert.ok(!written.includes('secret-password-1'));
  });
  it('fails clearly when the input ends', async () => {
    const input = new PassThrough();
    const prompter = createTerminalPrompter(input, new PassThrough());
    input.end();
    await assert.rejects(prompter.ask('URL', false), /input ended/);
    prompter.close();
  });
});
