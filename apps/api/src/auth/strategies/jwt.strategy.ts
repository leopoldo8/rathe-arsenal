import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { ICurrentUser } from '../dtos/current-user.dto';

export interface IJwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header against `JWT_SECRET`,
 * loads the user from the DB by `payload.sub`, and asserts the user is
 * email-verified before returning the user object that NestJS attaches to
 * `request.user`.
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: IJwtPayload): Promise<ICurrentUser> {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.emailVerifiedAt === null) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email ?? '' };
  }
}
