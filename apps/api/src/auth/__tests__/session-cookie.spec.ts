import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from '../auth.controller';
import { SessionService } from '../session.service';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../session-cookie';

type TCookieCall = [string, string, { secure: boolean }];

function configFor(nodeEnv: string): ConfigService {
  return { get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined) } as unknown as ConfigService;
}

function fakeResponse(): { res: Response; cookies: TCookieCall[] } {
  const cookies: TCookieCall[] = [];
  const res = { cookie: (...call: TCookieCall) => cookies.push(call) } as unknown as Response;
  return { res, cookies };
}

/** The `secure` flag of the cookie each cookie-setting route writes, for an environment name. */
async function secureFlagsFor(nodeEnv: string): Promise<{ signOut: boolean | undefined; renewed: boolean | undefined }> {
  const config = configFor(nodeEnv);
  const signOutResponse = fakeResponse();
  await new AuthController({} as never, {} as never, {} as never, config).signOut({ cookies: {} } as unknown as Request, signOutResponse.res);

  const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const session = { id: 's1', revokedAt: null, lastSeenAt: longAgo, user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false, deletedAt: null } };
  const sessions = { findOne: jest.fn().mockResolvedValue(session), update: jest.fn().mockResolvedValue(undefined) };
  const renewedResponse = fakeResponse();
  await new SessionService(sessions as never, { hashToken: (token: string) => token } as never, config).authenticate(
    { cookies: { [SESSION_COOKIE_NAME]: 'token' } } as unknown as Request,
    renewedResponse.res,
  );
  return { signOut: signOutResponse.cookies[0]?.[2].secure, renewed: renewedResponse.cookies[0]?.[2].secure };
}


describe('session cookie options (door 17)', () => {
  it('the cookie is Secure only in production', () => {
    const production = sessionCookieOptions(true);
    const development = sessionCookieOptions(false);

    expect(production.secure).toBe(true);
    expect(development.secure).toBe(false);
    for (const options of [production, development]) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/api', maxAge: 34_560_000 * 1000 });
    }
    expect(SESSION_COOKIE_NAME).toBe('ra_session');
  });

  it('the cookie is Secure only in production, as each route reads NODE_ENV', async () => {
    expect(await secureFlagsFor('production')).toEqual({ signOut: true, renewed: true });
    expect(await secureFlagsFor('development')).toEqual({ signOut: false, renewed: false });
    expect(await secureFlagsFor('test')).toEqual({ signOut: false, renewed: false });
  });
});
