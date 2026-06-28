import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { EUserRole } from '../../database/entities/user.entity';
import { ICurrentUser } from '../dtos/current-user.dto';

/**
 * Allows only users with the `admin` role. Runs after the global JwtAuthGuard,
 * which populates `request.user` (including `role`) from the per-request DB
 * lookup in JwtStrategy.validate().
 *
 * Usage:
 *   @UseGuards(AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: ICurrentUser | undefined = context.switchToHttp().getRequest().user;
    if (user?.role !== EUserRole.Admin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
