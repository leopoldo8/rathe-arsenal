import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { UserEntity } from '../apps/api/src/database/entities/user.entity';
import { CollectionCardEntity } from '../apps/api/src/database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../apps/api/src/database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../apps/api/src/database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../apps/api/src/database/entities/deck-readiness-snapshot.entity';

// Load .env from the api package (where DATABASE_URL lives)
config({ path: resolve(__dirname, '..', 'apps', 'api', '.env') });

const USAGE = 'Usage: pnpm tsx scripts/delete-user.ts <userId>';

async function main(): Promise<void> {
  const userId = process.argv[2];
  if (!userId) {
    console.error(USAGE);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Check your .env file.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      UserEntity,
      CollectionCardEntity,
      TrackedDeckEntity,
      DeckCardEntity,
      DeckReadinessSnapshotEntity,
    ],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Connected to database.');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    // Count rows before deletion
    const deckIds = await queryRunner.manager
      .getRepository(TrackedDeckEntity)
      .find({ where: { userId }, select: ['id'] });
    const deckIdList = deckIds.map((d) => d.id);

    const snapshotCount =
      deckIdList.length > 0
        ? await queryRunner.manager
            .getRepository(DeckReadinessSnapshotEntity)
            .count({ where: deckIdList.map((id) => ({ trackedDeckId: id })) })
        : 0;

    const deckCardCount =
      deckIdList.length > 0
        ? await queryRunner.manager
            .getRepository(DeckCardEntity)
            .count({ where: deckIdList.map((id) => ({ trackedDeckId: id })) })
        : 0;

    const collectionCardCount = await queryRunner.manager
      .getRepository(CollectionCardEntity)
      .count({ where: { userId } });

    const trackedDeckCount = deckIdList.length;

    console.log(`\nRows to delete for user ${userId}:`);
    console.log(`  deck_readiness_snapshot: ${snapshotCount}`);
    console.log(`  deck_card:               ${deckCardCount}`);
    console.log(`  collection_card:         ${collectionCardCount}`);
    console.log(`  tracked_deck:            ${trackedDeckCount}`);
    console.log(`  user:                    1`);

    // Delete in dependency order (children first).
    // ON DELETE CASCADE is defense-in-depth; explicit ordering is safer.
    if (deckIdList.length > 0) {
      await queryRunner.manager
        .getRepository(DeckReadinessSnapshotEntity)
        .delete(deckIdList.map((id) => ({ trackedDeckId: id })));

      await queryRunner.manager
        .getRepository(DeckCardEntity)
        .delete(deckIdList.map((id) => ({ trackedDeckId: id })));
    }

    await queryRunner.manager
      .getRepository(CollectionCardEntity)
      .delete({ userId });

    await queryRunner.manager
      .getRepository(TrackedDeckEntity)
      .delete({ userId });

    const deleteResult = await queryRunner.manager
      .getRepository(UserEntity)
      .delete({ id: userId });

    if (deleteResult.affected === 0) {
      console.error(`\nUser ${userId} not found in the database.`);
      await queryRunner.rollbackTransaction();
      process.exit(1);
    }

    await queryRunner.commitTransaction();

    console.log(`\nUser ${userId} and all related data deleted successfully.`);
    console.log(
      '\nReminder: The user has been removed from the database. ' +
        'No external services need cleanup (DIY auth, no Clerk).',
    );
  } catch (error) {
    console.error('Error during deletion, rolling back transaction:', error);
    await queryRunner.rollbackTransaction();
    process.exit(1);
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main();
