import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ShareEventEntity } from '../database/entities/share-event.entity';
import { ShareLinkEntity } from '../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ShareEventsService } from './share-events.service';
import { ShareReferralService } from './share-referral.service';
import { SharedDeckLookup } from './shared-deck-lookup';
import { SharedListLookup } from './shared-list-lookup';

// Must not import AuthModule: AuthModule imports this module for sign-up attribution.
@Module({
  imports: [TypeOrmModule.forFeature([TrackedDeckEntity, CardListEntity, UserEntity, ShareEventEntity, ShareLinkEntity])],
  providers: [SharedDeckLookup, SharedListLookup, ShareEventsService, ShareReferralService],
  exports: [SharedDeckLookup, SharedListLookup, ShareEventsService, ShareReferralService, TypeOrmModule],
})
export class SharingCoreModule {}
