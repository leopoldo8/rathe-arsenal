import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareEventEntity } from '../database/entities/share-event.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { UserEntity } from '../database/entities/user.entity';
import { SharedDeckLookup } from './shared-deck-lookup';

// Must not import AuthModule: AuthModule imports this module for sign-up attribution.
@Module({
  imports: [TypeOrmModule.forFeature([TrackedDeckEntity, UserEntity, ShareEventEntity])],
  providers: [SharedDeckLookup],
  exports: [SharedDeckLookup, TypeOrmModule],
})
export class SharingCoreModule {}
