import { Module } from '@nestjs/common';
import { FabraryModule } from '../fabrary/fabrary.module';
import { CommunityDecksService } from './community-decks.service';
import { FabraryIndexClient } from './fabrary-index';
import { PublicDecksService } from './public-decks.service';
import { RulesImportService } from './rules-import.service';
import { TournamentSyncService } from './tournament-sync.service';

@Module({
  imports: [FabraryModule],
  providers: [FabraryIndexClient, TournamentSyncService, RulesImportService, CommunityDecksService, PublicDecksService],
  exports: [TournamentSyncService, RulesImportService, CommunityDecksService, PublicDecksService],
})
export class ReferenceModule {}
