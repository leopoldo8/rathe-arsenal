import { Module } from '@nestjs/common';
import { FabraryModule } from '../fabrary/fabrary.module';
import { FabraryIndexClient } from './fabrary-index';
import { RulesImportService } from './rules-import.service';
import { TournamentSyncService } from './tournament-sync.service';

@Module({
  imports: [FabraryModule],
  providers: [FabraryIndexClient, TournamentSyncService, RulesImportService],
  exports: [TournamentSyncService, RulesImportService],
})
export class ReferenceModule {}
