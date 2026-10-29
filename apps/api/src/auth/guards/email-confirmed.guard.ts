import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { mapAuthError } from '../auth-error.mapper';
import { ICurrentUser } from '../dtos/current-user.dto';
import { AuthError, EAuthErrorCode } from '../errors';

/** Refuses creating a share link while the account's e-mail is unconfirmed; everything else stays open (door 14). */
@Injectable()
export class EmailConfirmedGuard implements CanActivate {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user: ICurrentUser = context.switchToHttp().getRequest().user;
    const row = await this.users.findOne({ where: { id: user.userId }, select: { id: true, emailVerifiedAt: true } });
    if (row?.emailVerifiedAt) return true;
    throw mapAuthError(new AuthError(EAuthErrorCode.EmailNotConfirmed, 'Confirm your e-mail before creating a share link'));
  }
}
