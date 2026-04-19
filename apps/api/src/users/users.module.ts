import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * UsersModule — exposes GET/PATCH /api/users/me/settings for theme persistence.
 *
 * The `UserEntity` repository is needed for reading and writing the `preferences`
 * JSONB column (added by migration 1776621087000).
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
