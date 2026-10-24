import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { ICurrentUser } from '../dtos/current-user.dto';
import { readCookie, SESSION_COOKIE_NAME } from '../session-cookie';

export interface IJwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header (interim: S32 removes it), or the
 * `ra_session` cookie, against `JWT_SECRET`, loads the user from
 * the DB by `payload.sub` and returns the user object that NestJS attaches to
 * `request.user`. An unconfirmed e-mail does not block a session (door 14);
 * it only blocks creating share links.
 *
 * The DB hit on every authenticated request is a deliberate Phase 0 trade-off:
 * it costs one query per request but guarantees that admin actions
 * (suspension, email un-verification) take effect immediately. See
 * `docs/phase-1-followups.md` entry A13 for the Phase 1 escape hatch.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    super({
      // The header goes first on purpose: the extractors do not fall back when the first token fails
      // verification, and a stale `ra_session` cookie must not beat a fresh Bearer token (verify-email
      // hands out a JWT without setting the cookie). S32 drops the header.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => readCookie(req.headers.cookie, SESSION_COOKIE_NAME),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: IJwtPayload): Promise<ICurrentUser> {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }
    // A8 / Phase 1a Unit 2: reject soft-deleted users on the same per-request
    // lookup. This is a field check on the already-loaded entity, not a
    // second query — the A13 trade-off from Phase 0 is preserved.
    if (user.deletedAt !== null) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email ?? '', role: user.role, chatAccess: user.chatAccess };
  }
}
