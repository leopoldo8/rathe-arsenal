import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { RecommendationsCoreModule } from '../recommendations/recommendations-core.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { ReferenceModule } from '../reference/reference.module';
import { ReplacementsModule } from '../replacements/replacements.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { ChatBudgetService } from './chat-budget.service';
import { ChatProposalsService } from './chat-proposals.service';
import { ChatRunnerService } from './chat-runner.service';
import { ChatToolsService } from './chat-tools.service';
import { ChatTurnQueueService } from './chat-turn-queue.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [CollectionModule, RecommendationsCoreModule, RecommendationsModule, ReferenceModule, ReplacementsModule, SubstitutionModule],
  controllers: [ChatController],
  providers: [ChatService, ChatBudgetService, ChatProposalsService, ChatTurnQueueService, ChatToolsService, ChatRunnerService],
  exports: [ChatTurnQueueService, ChatRunnerService],
})
export class ChatModule {}
