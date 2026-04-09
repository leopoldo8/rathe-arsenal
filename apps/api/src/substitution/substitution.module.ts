import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthModule } from '../auth/auth.module';
import { SubstitutionService } from './substitution.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrackedDeckEntity,
      DeckCardEntity,
      CollectionCardEntity,
      DeckReadinessSnapshotEntity,
    ]),
    AuthModule,
  ],
  providers: [SubstitutionService],
  exports: [SubstitutionService],
})
export class SubstitutionModule {}
