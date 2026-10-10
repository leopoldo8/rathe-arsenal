import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CollectionModule } from '../collection/collection.module';
import { ReplacementsModule } from '../replacements/replacements.module';
import { StoresModule } from '../stores/stores.module';
import { RecommendationRunnerService } from './recommendation-runner.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsCoreModule } from './recommendations-core.module';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [AuthModule, CollectionModule, StoresModule, ReplacementsModule, RecommendationsCoreModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationRunnerService],
  exports: [RecommendationRunnerService],
})
export class RecommendationsModule {}
