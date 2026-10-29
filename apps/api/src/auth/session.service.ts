import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { IsNull, Not, Repository } from 'typeorm';
import { UserSessionEntity } from '../database/entities/user-session.entity';
import { ICurrentUser } from './dtos/current-user.dto';
import { readSessionToken, setSessionCookie } from './session-cookie';
import { TokenGeneratorService } from './services/token-generator.service';

const SESSION_TOKEN_BYTES = 32;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

interface IResolvedSession {
  readonly user: ICurrentUser;
  /** True when `lastSeenAt` was more than a day old, so the cookie is sent again. */
  readonly renew: boolean;
}

/**
 * Server-side sessions (door 17). A session has no expiry of its own: it lasts until "Sair", a
 * deleted account or a password change revokes it. The token is random and opaque, and only its
 * sha256 is stored.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly isProduction: boolean;

  constructor(
    @InjectRepository(UserSessionEntity)
    private readonly sessions: Repository<UserSessionEntity>,
    private readonly tokenGenerator: TokenGeneratorService,
    config: ConfigService,
  ) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  /** Starts a session for the account and returns the token to put in the cookie. */
  async create(userId: string): Promise<string> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    await this.sessions.save(this.sessions.create({ userId, tokenHash: this.tokenGenerator.hashToken(token) }));
    return token;
  }

  /** The account behind the request's cookie when it names a live session, else null. */
  async authenticate(req: Request, res: Response): Promise<ICurrentUser | null> {
    const token = readSessionToken(req);
    if (!token) return null;
    const resolved = await this.resolve(token);
    if (!resolved) return null;
    if (resolved.renew) setSessionCookie(res, token, this.isProduction);
    return resolved.user;
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.update(
      { tokenHash: this.tokenGenerator.hashToken(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Ends every live session of the account, except the one holding `exceptToken` when given. */
  async revokeAllOf(userId: string, exceptToken?: string): Promise<void> {
    const result = await this.sessions.update(
      {
        userId,
        revokedAt: IsNull(),
        ...(exceptToken ? { tokenHash: Not(this.tokenGenerator.hashToken(exceptToken)) } : {}),
      },
      { revokedAt: new Date() },
    );
    this.logger.log({ event: 'auth.sessions.revoked', userId, count: result.affected ?? 0 });
  }

  private async resolve(token: string): Promise<IResolvedSession | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: this.tokenGenerator.hashToken(token) },
      relations: { user: true },
    });
    const user = session?.user;
    if (!session || session.revokedAt !== null || !user || user.deletedAt !== null) return null;

    const renew = Date.now() - session.lastSeenAt.getTime() > RENEW_AFTER_MS;
    if (renew) await this.sessions.update({ id: session.id }, { lastSeenAt: new Date() });
    return {
      user: { userId: user.id, email: user.email ?? '', role: user.role, chatAccess: user.chatAccess },
      renew,
    };
  }
}
