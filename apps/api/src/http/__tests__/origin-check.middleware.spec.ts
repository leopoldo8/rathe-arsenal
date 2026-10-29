import type { Request, Response } from 'express';
import { allowedOriginOf, originCheck } from '../origin-check.middleware';

const APP = 'https://app.rathearsenal.example';

function run(method: string, origin: string | undefined): { status: number | null; body: unknown; passed: boolean } {
  const check = originCheck(() => `${APP}/some/path?x=1`);
  const result = { status: null as number | null, body: undefined as unknown, passed: false };
  const res = {
    status(code: number) {
      result.status = code;
      return res;
    },
    json(body: unknown) {
      result.body = body;
      return res;
    },
  } as unknown as Response;
  const req = { method, path: '/api/x', headers: origin === undefined ? {} : { origin } } as unknown as Request;
  check(req, res, () => {
    result.passed = true;
  });
  return result;
}

describe('originCheck', () => {
  it('the origin check decides by method and Origin header', () => {
    const cases: ReadonlyArray<[string, string | undefined, boolean]> = [
      ['POST', 'https://evil.example', false],
      ['PUT', 'https://evil.example', false],
      ['PATCH', 'https://evil.example', false],
      ['DELETE', 'https://evil.example', false],
      ['POST', 'null', false],
      ['POST', 'http://app.rathearsenal.example', false],
      ['POST', APP, true],
      ['PUT', APP, true],
      ['PATCH', APP, true],
      ['DELETE', APP, true],
      ['POST', undefined, true],
      ['DELETE', undefined, true],
      ['GET', 'https://evil.example', true],
      ['HEAD', 'https://evil.example', true],
      ['OPTIONS', 'https://evil.example', true],
    ];

    for (const [method, origin, allowed] of cases) {
      const outcome = run(method, origin);
      expect({ method, origin, passed: outcome.passed }).toEqual({ method, origin, passed: allowed });
      if (!allowed) {
        expect(outcome.status).toBe(403);
        expect(outcome.body).toMatchObject({ statusCode: 403, code: 'ORIGIN_REJECTED' });
      }
    }
  });

  it('compares against the origin of the app address, ignoring its path', () => {
    expect(allowedOriginOf('https://app.rathearsenal.example/some/path?x=1')).toBe(APP);
    expect(allowedOriginOf('http://localhost:5173')).toBe('http://localhost:5173');
  });
});
