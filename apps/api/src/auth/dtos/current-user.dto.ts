import { EUserRole } from '../../database/entities/user.entity';

export interface ICurrentUser {
  userId: string;
  email: string;
  role: EUserRole;
}
