import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareEventEntity } from '../database/entities/share-event.entity';
import { ShareLinkEntity } from '../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ShareEventsService } from './share-events.service';
import { ShareReferralService } from './share-referral.service';
import { SharedDeckLookup } from './shared-deck-lookup';

// Must not import AuthModule: AuthModule imports this module for sign-up attribution.
@Module({
  imports: [TypeOrmModule.forFeature([TrackedDeckEntity, UserEntity, ShareEventEntity, ShareLinkEntity])],
  providers: [SharedDeckLookup, ShareEventsService, ShareReferralService],
  exports: [SharedDeckLookup, ShareEventsService, ShareReferralService, TypeOrmModule],
})
export class SharingCoreModule {}
