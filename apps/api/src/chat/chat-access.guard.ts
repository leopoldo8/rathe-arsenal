import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { chatError } from './chat-errors';

@Injectable()
export class ChatAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: ICurrentUser | undefined = context.switchToHttp().getRequest().user;
    if (user?.chatAccess !== true) throw chatError('CHAT_ACCESS_DENIED');
    return true;
  }
}
