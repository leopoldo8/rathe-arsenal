import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeckTagEntity } from '../database/entities/deck-tag.entity';
import { AuthModule } from '../auth/auth.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

/**
 * TagsModule — exposes GET/POST/DELETE /api/tags for user-defined deck tags.
 *
 * Imports AuthModule to get AuthzService (for assertOwnsTag in delete) and
 * JwtAuthGuard/guards that protect all routes globally.
 *
 * Note: DeckTagEntity is also registered in AuthModule.forFeature to allow
 * AuthzService.assertOwnsTag to use @InjectRepository(DeckTagEntity) without
 * creating a circular dependency between AuthModule and TagsModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeckTagEntity]),
    AuthModule,
  ],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
