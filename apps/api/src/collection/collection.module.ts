import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthModule } from '../auth/auth.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollectionCardEntity,
      DeckCardEntity,
      DeckReadinessSnapshotEntity,
    ]),
    AuthModule,
    SubstitutionModule,
  ],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
