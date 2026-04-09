import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { FabraryModule } from '../fabrary/fabrary.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { DecksImportService } from './import/decks-import.service';
import { DecksImportController } from './import/decks-import.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrackedDeckEntity,
      DeckCardEntity,
      CollectionCardEntity,
      DeckReadinessSnapshotEntity,
    ]),
    FabraryModule,
    SubstitutionModule,
  ],
  controllers: [DecksImportController],
  providers: [DecksImportService],
})
export class DecksModule {}
