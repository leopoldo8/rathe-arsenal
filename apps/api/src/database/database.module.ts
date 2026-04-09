import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserEntity,
  CollectionCardEntity,
  TrackedDeckEntity,
  DeckCardEntity,
  DeckReadinessSnapshotEntity,
} from './entities';

/**
 * Wires the runtime TypeORM connection from `DATABASE_URL`. Other modules
 * call `TypeOrmModule.forFeature([X])` to access repositories.
 *
 * `database/datasource.ts` (the standalone DataSource for the migration CLI
 * and the `scripts/delete-user.ts` dev script) is separate by design — the CLI
 * cannot bootstrap a NestJS module just to run a migration.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          UserEntity,
          CollectionCardEntity,
          TrackedDeckEntity,
          DeckCardEntity,
          DeckReadinessSnapshotEntity,
        ],
        synchronize: false,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
